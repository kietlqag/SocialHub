import crypto from "crypto";
import { query } from "./db.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const parseJsonField = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
};

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
  const res = await query(
    `SELECT id, role
     FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId]
  );
  if (res.rowCount === 0) {
    throw new HttpError(404, "Ban khong thuoc to chuc nay.");
  }
  return res.rows[0];
}

async function ensureDashboard(organizationId, dashboardId) {
  const res = await query(
    `SELECT id, organization_id
     FROM dashboards
     WHERE id = $1`,
    [dashboardId]
  );
  const dashboard = res.rows[0];
  if (!dashboard) {
    throw new HttpError(404, "Khong tim thay dashboard.");
  }
  if (dashboard.organization_id !== organizationId) {
    throw new HttpError(403, "Dashboard khong thuoc to chuc nay.");
  }
  return dashboard;
}

async function ensureServiceProfile(organizationId, serviceProfileId) {
  const res = await query(
    `SELECT id, organization_id
     FROM service_profiles
     WHERE id = $1`,
    [serviceProfileId]
  );
  const profile = res.rows[0];
  if (!profile) {
    throw new HttpError(404, "Khong tim thay cau hinh dich vu.");
  }
  if (profile.organization_id !== organizationId) {
    throw new HttpError(403, "Dich vu khong thuoc to chuc nay.");
  }
  return profile;
}

const mapOrganization = (row) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  slug: row.slug,
  industry: row.industry,
  employeeCount: row.employee_count,
  dataVolume: row.data_volume,
  description: row.description,
  metadata: parseJsonField(row.metadata, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  role: row.role,
});

const mapDataSource = (row) => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  type: row.type,
  status: row.status,
  config: parseJsonField(row.config, {}),
  lastSyncedAt: row.last_synced_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapDashboard = (row) => ({
  id: row.id,
  organizationId: row.organization_id,
  title: row.title,
  description: row.description,
  aiSummary: row.ai_summary,
  status: row.status,
  layout: parseJsonField(row.layout, []),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWidget = (row) => ({
  id: row.id,
  dashboardId: row.dashboard_id,
  dataSourceId: row.data_source_id,
  title: row.title,
  visualization: row.visualization,
  config: parseJsonField(row.config, {}),
  position: parseJsonField(row.position, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapServiceProfile = (row) => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  serviceType: row.service_type,
  status: row.status,
  config: parseJsonField(row.config, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapBinding = (row) => ({
  id: row.id,
  dashboardId: row.dashboard_id,
  serviceProfileId: row.service_profile_id,
  scope: row.scope,
  createdAt: row.created_at,
  service: mapServiceProfile({
    ...row,
    organization_id: row.organization_id,
    name: row.service_name,
    service_type: row.service_type,
    status: row.service_status,
    config: row.service_config,
    created_at: row.service_created_at,
    updated_at: row.service_updated_at,
  }),
});

const mapRecommendation = (row) => ({
  id: row.id,
  organizationId: row.organization_id,
  requestedBy: row.requested_by,
  prompt: parseJsonField(row.prompt, {}),
  result: parseJsonField(row.result, {}),
  status: row.status,
  createdAt: row.created_at,
  completedAt: row.completed_at,
});

export async function createOrganization(ownerId, payload) {
  if (!payload?.name) {
    throw new HttpError(400, "Ten to chuc la bat buoc.");
  }
  const metadata = payload.metadata || {
    departments: payload.departments ?? [],
    systems: payload.systems ?? [],
  };
  const insert = async (slug) => {
    const res = await query(
      `INSERT INTO organizations (owner_id, name, slug, industry, employee_count, data_volume, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        ownerId,
        payload.name,
        slug,
        payload.industry || null,
        payload.employeeCount ?? null,
        payload.dataVolume || null,
        payload.description || null,
        JSON.stringify(metadata),
      ]
    );
    const organization = res.rows[0];
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
       VALUES ($1, $2, 'owner', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [organization.id, ownerId]
    );
    return mapOrganization({ ...organization, role: "owner" });
  };
  return withUniqueSlug(payload.name, insert);
}

export async function listOrganizationsForUser(userId) {
  const res = await query(
    `SELECT o.*, m.role
     FROM organizations o
     JOIN organization_members m ON m.organization_id = o.id
     WHERE m.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return res.rows.map(mapOrganization);
}

export async function createDataSource(userId, organizationId, payload) {
  await ensureMembership(userId, organizationId);
  if (!payload?.name || !payload?.type) {
    throw new HttpError(400, "Bo sung name va type cho data source.");
  }
  const res = await query(
    `INSERT INTO data_sources (organization_id, name, type, status, config, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      organizationId,
      payload.name,
      payload.type,
      payload.status || "draft",
      JSON.stringify(payload.config || {}),
      payload.lastSyncedAt || null,
    ]
  );
  return mapDataSource(res.rows[0]);
}

export async function listDataSources(userId, organizationId) {
  await ensureMembership(userId, organizationId);
  const res = await query(
    `SELECT *
     FROM data_sources
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows.map(mapDataSource);
}

export async function createDashboard(userId, organizationId, payload) {
  await ensureMembership(userId, organizationId);
  if (!payload?.title) {
    throw new HttpError(400, "Dashboard can mot tieu de.");
  }
  const res = await query(
    `INSERT INTO dashboards (organization_id, title, description, ai_summary, layout, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      organizationId,
      payload.title,
      payload.description || null,
      payload.aiSummary || null,
      JSON.stringify(payload.layout || []),
      payload.status || "draft",
      userId,
    ]
  );
  return mapDashboard(res.rows[0]);
}

export async function listDashboards(userId, organizationId) {
  await ensureMembership(userId, organizationId);
  const res = await query(
    `SELECT *
     FROM dashboards
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows.map(mapDashboard);
}

export async function createWidget(userId, organizationId, dashboardId, payload) {
  await ensureMembership(userId, organizationId);
  await ensureDashboard(organizationId, dashboardId);
  if (!payload?.title || !payload?.visualization) {
    throw new HttpError(400, "Widget can title va visualization.");
  }
  const res = await query(
    `INSERT INTO dashboard_widgets (dashboard_id, data_source_id, title, visualization, config, position)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      dashboardId,
      payload.dataSourceId || null,
      payload.title,
      payload.visualization,
      JSON.stringify(payload.config || {}),
      JSON.stringify(
        payload.position || {
          x: 0,
          y: 0,
          w: 6,
          h: 4,
        }
      ),
    ]
  );
  return mapWidget(res.rows[0]);
}

export async function listWidgets(userId, organizationId, dashboardId) {
  await ensureMembership(userId, organizationId);
  await ensureDashboard(organizationId, dashboardId);
  const res = await query(
    `SELECT *
     FROM dashboard_widgets
     WHERE dashboard_id = $1
     ORDER BY created_at ASC`,
    [dashboardId]
  );
  return res.rows.map(mapWidget);
}

export async function createServiceProfile(userId, organizationId, payload) {
  await ensureMembership(userId, organizationId);
  if (!payload?.name || !payload?.serviceType) {
    throw new HttpError(400, "Dich vu can name va serviceType.");
  }
  const res = await query(
    `INSERT INTO service_profiles (organization_id, name, service_type, status, config)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      organizationId,
      payload.name,
      payload.serviceType,
      payload.status || "draft",
      JSON.stringify(payload.config || {}),
    ]
  );
  return mapServiceProfile(res.rows[0]);
}

export async function listServiceProfiles(userId, organizationId) {
  await ensureMembership(userId, organizationId);
  const res = await query(
    `SELECT *
     FROM service_profiles
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows.map(mapServiceProfile);
}

export async function bindServiceToDashboard(userId, organizationId, dashboardId, payload) {
  await ensureMembership(userId, organizationId);
  await ensureDashboard(organizationId, dashboardId);
  await ensureServiceProfile(organizationId, payload.serviceProfileId);
  const res = await query(
    `INSERT INTO dashboard_service_bindings (dashboard_id, service_profile_id, scope)
     VALUES ($1, $2, $3)
     ON CONFLICT (dashboard_id, service_profile_id) DO UPDATE SET scope = EXCLUDED.scope
     RETURNING id, dashboard_id, service_profile_id, scope, created_at`,
    [dashboardId, payload.serviceProfileId, payload.scope || null]
  );
  const row = res.rows[0];
  const serviceRes = await query(`SELECT * FROM service_profiles WHERE id = $1`, [
    payload.serviceProfileId,
  ]);
  return mapBinding({
    ...row,
    organization_id: serviceRes.rows[0].organization_id,
    service_name: serviceRes.rows[0].name,
    service_type: serviceRes.rows[0].service_type,
    service_status: serviceRes.rows[0].status,
    service_config: serviceRes.rows[0].config,
    service_created_at: serviceRes.rows[0].created_at,
    service_updated_at: serviceRes.rows[0].updated_at,
  });
}

export async function listDashboardServices(userId, organizationId, dashboardId) {
  await ensureMembership(userId, organizationId);
  await ensureDashboard(organizationId, dashboardId);
  const res = await query(
    `SELECT b.*, sp.organization_id, sp.name AS service_name, sp.service_type, sp.status AS service_status,
            sp.config AS service_config, sp.created_at AS service_created_at, sp.updated_at AS service_updated_at
     FROM dashboard_service_bindings b
     JOIN service_profiles sp ON sp.id = b.service_profile_id
     WHERE b.dashboard_id = $1
     ORDER BY b.created_at DESC`,
    [dashboardId]
  );
  return res.rows.map(mapBinding);
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
  const res = await query(
    `INSERT INTO ai_recommendations (organization_id, requested_by, prompt, result, status, completed_at)
     VALUES ($1, $2, $3, $4, 'completed', NOW())
     RETURNING *`,
    [organizationId, userId, JSON.stringify(prompt), JSON.stringify(result)]
  );
  return mapRecommendation(res.rows[0]);
}

export async function listRecommendations(userId, organizationId) {
  await ensureMembership(userId, organizationId);
  const res = await query(
    `SELECT *
     FROM ai_recommendations
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows.map(mapRecommendation);
}
