import crypto from "crypto";
import {
  findDashboardById,
  findMembership,
  findServiceProfileById,
  getOrganizationById,
  insertDashboard,
  insertDataSource,
  insertOrganization,
  insertRecommendation,
  insertServiceProfile,
  insertWidget,
  listOrganizationsForUser,
  selectDashboardServiceBindings,
  selectDashboards,
  selectDataSources,
  selectRecommendations,
  selectServiceProfiles,
  selectWidgets,
  upsertDashboardServiceBinding,
  upsertMember,
} from "../repositories/platformRepository.js";
import { createNotification as createNotificationRepo } from "../repositories/notificationRepository.js";
import { HttpError } from "../utils/httpError.js";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

async function withUniqueSlug(name, insertFn) {
  const base = slugify(name) || `workspace-${crypto.randomBytes(3).toString("hex")}`;
  let attempt = base;
  for (let i = 0; i < 5; i += 1) {
    try {
      return await insertFn(attempt);
    } catch (err) {
      if (err.code === "23505" && err.constraint === "organizations_slug_key") {
        attempt = `${base}-${crypto.randomBytes(2).toString("hex")}`;
        continue;
      }
      throw err;
    }
  }
  throw new HttpError(500, "Unable to generate organization slug. Please try a different name.");
}

async function ensureMembership(userId, organizationId) {
  const membership = await findMembership(userId, organizationId);
  if (!membership) {
    throw new HttpError(404, "Ban khong thuoc to chuc nay.");
  }
  return membership;
}

async function ensureDashboard(organizationId, dashboardId) {
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    throw new HttpError(404, "Khong tim thay dashboard.");
  }
  if (dashboard.organization_id !== organizationId) {
    throw new HttpError(403, "Dashboard khong thuoc to chuc nay.");
  }
  return dashboard;
}

async function ensureServiceProfile(organizationId, serviceProfileId) {
  const profile = await findServiceProfileById(serviceProfileId);
  if (!profile) {
    throw new HttpError(404, "Khong tim thay cau hinh dich vu.");
  }
  if (profile.organization_id !== organizationId) {
    throw new HttpError(403, "Dich vu khong thuoc to chuc nay.");
  }
  return profile;
}

export async function createOrganization(ownerId, payload) {
  if (!payload?.name) {
    throw new HttpError(400, "Ten to chuc la bat buoc.");
  }
  const metadata = payload.metadata || {
    departments: payload.departments ?? [],
    systems: payload.systems ?? [],
  };
  const insert = async (slug) => {
    const orgRow = await insertOrganization(ownerId, { ...payload, metadata }, slug);
    await upsertMember(orgRow.id, ownerId, "owner");
    return { ...orgRow, role: "owner" };
  };
  return withUniqueSlug(payload.name, insert);
}

export async function listUserOrganizations(userId) {
  return listOrganizationsForUser(userId);
}

export async function createDataSource(userId, organizationId, payload) {
  await ensureMembership(userId, organizationId);
  if (!payload?.name || !payload?.type) {
    throw new HttpError(400, "Bo sung name va type cho data source.");
  }
  return insertDataSource(organizationId, payload);
}

export async function listDataSources(userId, organizationId) {
  await ensureMembership(userId, organizationId);
  return selectDataSources(organizationId);
}

export async function createDashboard(userId, organizationId, payload) {
  await ensureMembership(userId, organizationId);
  if (!payload?.title) {
    throw new HttpError(400, "Dashboard can mot tieu de.");
  }
  const dashboard = await insertDashboard(organizationId, payload, userId);
  // Observer: persist notification on dashboard creation (best-effort)
  try {
    await createNotificationRepo({
      title: "New dashboard created",
      message: `Dashboard "${dashboard.title}" has been created.`,
      type: "dashboard_created",
      metadata: {
        dashboardId: dashboard.id,
        organizationId,
        createdBy: userId,
      },
      user_id: userId,
      read: false,
    });
  } catch (err) {
    console.error("Failed to record dashboard creation notification", err);
  }
  return dashboard;
}

export async function listDashboards(userId, organizationId) {
  await ensureMembership(userId, organizationId);
  return selectDashboards(organizationId);
}

export async function createWidget(userId, organizationId, dashboardId, payload) {
  await ensureMembership(userId, organizationId);
  await ensureDashboard(organizationId, dashboardId);
  if (!payload?.title || !payload?.visualization) {
    throw new HttpError(400, "Widget can title va visualization.");
  }
  return insertWidget(dashboardId, payload);
}

export async function listWidgets(userId, organizationId, dashboardId) {
  await ensureMembership(userId, organizationId);
  await ensureDashboard(organizationId, dashboardId);
  return selectWidgets(dashboardId);
}

export async function createServiceProfile(userId, organizationId, payload) {
  await ensureMembership(userId, organizationId);
  if (!payload?.name || !payload?.serviceType) {
    throw new HttpError(400, "Dich vu can name va serviceType.");
  }
  return insertServiceProfile(organizationId, payload);
}

export async function listServiceProfiles(userId, organizationId) {
  await ensureMembership(userId, organizationId);
  return selectServiceProfiles(organizationId);
}

export async function bindServiceToDashboard(userId, organizationId, dashboardId, payload) {
  await ensureMembership(userId, organizationId);
  await ensureDashboard(organizationId, dashboardId);
  await ensureServiceProfile(organizationId, payload.serviceProfileId);
  return upsertDashboardServiceBinding(dashboardId, payload);
}

export async function listDashboardServices(userId, organizationId, dashboardId) {
  await ensureMembership(userId, organizationId);
  await ensureDashboard(organizationId, dashboardId);
  return selectDashboardServiceBindings(dashboardId);
}

const buildRecommendationResult = (payload) => {
  const departments = payload.departments?.length ? payload.departments : ["Operations"];
  const metrics = payload.metrics?.length ? payload.metrics : ["Revenue", "Active users", "Incidents"];
  const services = payload.services ?? ["database", "security"];
  const dashboards = departments.map((dept, index) => ({
    title: `${dept} Control`,
    description: `Theo doi KPI quan trong cho ${dept.toLowerCase()}`,
    widgets: metrics.map((metric) => ({
      title: `${metric} trend`,
      visualization: metric.toLowerCase().includes("rate") ? "line" : "bar",
      size: index === 0 ? "xl" : "md",
      metric,
    })),
  }));
  const managedServices = services.map((svc) => ({
    serviceType: svc,
    name:
      svc === "database"
        ? "Managed PostgreSQL cluster"
        : svc === "security"
        ? "Identity Guard"
        : `Managed ${svc}`,
    notes:
      svc === "database"
        ? "Tu dong sao luu, theo doi hieu nang va scaling."
        : svc === "security"
        ? "SSO, RBAC, theo doi truy cap."
        : "Thiet lap, giam sat, tu dong canh bao.",
  }));
  return {
    summary: `Da phan tich ${departments.length} phong ban va ${metrics.length} KPI de de xuat dashboard.`,
    dashboards,
    managedServices,
  };
};

export async function createRecommendation(userId, organizationId, payload) {
  await ensureMembership(userId, organizationId);
  if (!payload?.companyName) {
    throw new HttpError(400, "companyName la bat buoc de goi y dashboard.");
  }
  const prompt = {
    companyName: payload.companyName,
    departments: payload.departments || [],
    metrics: payload.metrics || [],
    services: payload.services || [],
    notes: payload.notes || "",
  };
  const result = buildRecommendationResult(prompt);
  return insertRecommendation(organizationId, userId, prompt, result);
}

export async function listRecommendations(userId, organizationId) {
  await ensureMembership(userId, organizationId);
  return selectRecommendations(organizationId);
}

export async function ensureOrgMembership(userId, organizationId) {
  return ensureMembership(userId, organizationId);
}

export async function loadOrgContext(orgId) {
  const org = await getOrganizationById(orgId);
  if (!org) return null;
  const dataSources = await selectDataSources(orgId);
  return {
    organization: {
      id: org.id,
      name: org.name,
      industry: org.industry,
      employeeCount: org.employeeCount,
      dataVolume: org.dataVolume,
      description: org.description,
    },
    dataSources: dataSources.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      status: d.status,
    })),
  };
}
