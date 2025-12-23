import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";
import { buildDefaultAccessControl } from "../utils/accessControlDefaults.js";
import { canEditDashboard, isGlobalAdminUser } from "../utils/dashboardAuth.js";
import { selectUsersByIds } from "../repositories/userRepository.js";

const dashboards = () => getSocialhubDb().collection("dashboards");

const ROLE_LABELS = { admin: "Admin", manager: "Manager", viewer: "Viewer" };
const ALLOWED_ROLE_KEYS = new Set(["admin", "manager", "viewer"]);
const normalizeRoleKey = (role) => (role ? String(role).trim().toLowerCase() : "");
const resolveOwnerId = (dashboard) => dashboard?.userId || dashboard?.createdBy || null;

const findDashboardById = async (dashboardId) => {
  let objectId;
  try {
    objectId = new ObjectId(dashboardId);
  } catch {
    return null;
  }
  return dashboards().findOne({ _id: objectId, isDeleted: { $ne: true }, isArchived: { $ne: true } });
};

// Determine the acting user; do NOT fall back to body.userId because that can be the assignee
const resolveUserId = (req) => req.user?.id || req.query?.userId || null;

const hydrateAssignments = async (assignments = []) => {
  const sanitized = Array.isArray(assignments) ? assignments.filter((a) => a && a.userId) : [];
  const ids = sanitized.map((a) => a.userId).filter(Boolean);
  const users = ids.length ? await selectUsersByIds(ids) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return sanitized.map((a) => {
    const matched = userMap.get(a.userId);
    return {
      id: a.id || a.userId,
      userId: a.userId,
      role: a.role || "Viewer",
      fullName: a.fullName || matched?.fullName || "",
      email: a.email || matched?.email || "",
    };
  });
};

const analystTargetRole = (analystPerms) => {
  if (!analystPerms) return "Viewer";
  const canCreateOrEdit = Boolean(analystPerms.create || analystPerms.edit);
  return canCreateOrEdit ? "Manager" : "Viewer";
};

const sanitizeRolePermissions = (rolePermissions = []) => {
  const byRole = new Map();
  const fallback = buildDefaultAccessControl().rolePermissions;
  const defaultMap = new Map(fallback.map((r) => [normalizeRoleKey(r.role), r]));

  (Array.isArray(rolePermissions) ? rolePermissions : []).forEach((entry) => {
    const key = normalizeRoleKey(entry?.role);
    if (!key) return;
    if (key === "owner") return; // owner is implicit
    if (key === "analyst") {
      const target = analystTargetRole(entry?.permissions);
      const targetKey = normalizeRoleKey(target);
      const base = defaultMap.get(targetKey);
      byRole.set(targetKey, {
        role: ROLE_LABELS[targetKey],
        permissions: { ...(base?.permissions || {}), ...(entry?.permissions || {}) },
      });
      return;
    }
    if (!ALLOWED_ROLE_KEYS.has(key)) return;
    const base = defaultMap.get(key);
    const merged = {
      role: ROLE_LABELS[key],
      permissions: {
        view: false,
        create: false,
        edit: false,
        delete: false,
        manageAccess: false,
        ...(base?.permissions || {}),
        ...(entry?.permissions || {}),
      },
    };
    byRole.set(key, merged);
  });

  // ensure every allowed role exists
  ALLOWED_ROLE_KEYS.forEach((key) => {
    if (!byRole.has(key)) {
      const base = defaultMap.get(key);
      byRole.set(key, base || { role: ROLE_LABELS[key], permissions: { view: false, create: false, edit: false, delete: false, manageAccess: false } });
    }
  });

  return Array.from(byRole.values());
};

const sanitizeAssignments = (assignments = [], ownerId, rolePermissions = []) => {
  const analystPerms = (rolePermissions || []).find((r) => normalizeRoleKey(r.role) === "analyst")?.permissions;
  const analystRole = analystTargetRole(analystPerms);
  const unique = new Map();
  (Array.isArray(assignments) ? assignments : []).forEach((assignment) => {
    if (!assignment || !assignment.userId) return;
    const key = assignment.userId;
    const roleKey = normalizeRoleKey(assignment.role);
    if (ownerId && String(assignment.userId) === String(ownerId)) {
      // Owner already has full rights; drop redundant assignment
      return;
    }
    let normalizedRole = "Viewer";
    if (roleKey === "owner") {
      normalizedRole = "Admin";
    } else if (roleKey === "analyst") {
      normalizedRole = analystRole;
    } else if (ALLOWED_ROLE_KEYS.has(roleKey)) {
      normalizedRole = ROLE_LABELS[roleKey];
    }
    unique.set(key, { ...assignment, id: assignment.id || assignment.userId, role: normalizedRole });
  });
  return Array.from(unique.values());
};

const buildAccessPayload = async (dashboard) => {
  const ownerId = resolveOwnerId(dashboard);
  const accessControl = dashboard.accessControl || buildDefaultAccessControl();
  const sanitizedRolePermissions = sanitizeRolePermissions(accessControl.rolePermissions);
  const sanitizedAssignments = sanitizeAssignments(accessControl.userAssignments, ownerId, accessControl.rolePermissions);
  const userAssignments = await hydrateAssignments(sanitizedAssignments);
  return {
    ownerId,
    accessMode: accessControl.accessMode || "restricted",
    rolePermissions: sanitizedRolePermissions,
    userAssignments,
  };
};

export const getDashboardAccess = async (req, res) => {
  const { dashboardId } = req.params;
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    return res.status(404).json({ message: "Dashboard not found" });
  }

  const currentUserId = resolveUserId(req);
  const defaultAccess = buildDefaultAccessControl();
  const ownerId = resolveOwnerId(dashboard);

  let accessControl = dashboard.accessControl;
  if (!accessControl) {
    accessControl = { ...defaultAccess };
    await dashboards().updateOne(
      { _id: dashboard._id },
      { $set: { accessControl, updatedAt: new Date() } },
    );
  }

  const accessMode = accessControl.accessMode || "restricted";
  const rawAssignments = Array.isArray(accessControl.userAssignments) ? accessControl.userAssignments : [];
  const rolePermissions = Array.isArray(accessControl.rolePermissions) && accessControl.rolePermissions.length
    ? accessControl.rolePermissions
    : defaultAccess.rolePermissions;

  const sanitizedAssignments = sanitizeAssignments(rawAssignments, ownerId, rolePermissions);
  const sanitizedRolePermissions = sanitizeRolePermissions(rolePermissions);
  const sanitizedAccessControl = {
    ...accessControl,
    rolePermissions: sanitizedRolePermissions,
    userAssignments: sanitizedAssignments,
  };

  const changed =
    JSON.stringify(accessControl.rolePermissions || []) !== JSON.stringify(sanitizedRolePermissions) ||
    JSON.stringify(accessControl.userAssignments || []) !== JSON.stringify(sanitizedAssignments);

  if (changed) {
    await dashboards().updateOne(
      { _id: dashboard._id },
      { $set: { accessControl: sanitizedAccessControl, updatedAt: new Date() } },
    );
  }

  const userAssignments = await hydrateAssignments(sanitizedAssignments);

  const isOwner = Boolean(ownerId && currentUserId && String(ownerId) === String(currentUserId));
  const isGlobalAdmin = isGlobalAdminUser(req.user);
  const isAssigned = Boolean(
    currentUserId &&
      sanitizedAssignments.some((assignment) => assignment?.userId && String(assignment.userId) === String(currentUserId)),
  );

  const allowAccess =
    accessMode === "public" ||
    (accessMode === "restricted" && (isAssigned || isOwner || isGlobalAdmin)) ||
    (accessMode === "private" && (isOwner || isGlobalAdmin));

  if (!allowAccess) {
    return res.status(403).json({ message: "Forbidden" });
  }

  console.log("[getAccessControl]", {
    dashboardId,
    userId: currentUserId,
    accessMode,
    assignments: userAssignments.map((assignment) => ({ userId: assignment.userId, role: assignment.role })),
    ownerId,
  });

  return res.json({
    ownerId,
    accessMode,
    rolePermissions: sanitizedRolePermissions,
    userAssignments,
  });
};

export const updateDashboardAccess = async (req, res) => {
  const { dashboardId } = req.params;
  const { accessMode, rolePermissions, userAssignments } = req.body || {};

  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    return res.status(404).json({ message: "Dashboard not found" });
  }
  const currentUserId = resolveUserId(req);
  if (!canEditDashboard(dashboard, currentUserId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  console.log("[updateDashboardAccess] incoming", {
    method: req.method,
    url: req.originalUrl,
    dashboardId,
    userId: currentUserId,
    sessionId: req.query?.sessionId,
    payload: { accessMode, rolePermissionsCount: Array.isArray(rolePermissions) ? rolePermissions.length : 0, userAssignmentsCount: Array.isArray(userAssignments) ? userAssignments.length : 0 },
  });

  const nextAccess = dashboard.accessControl || buildDefaultAccessControl();
  if (accessMode) nextAccess.accessMode = accessMode;
  if (rolePermissions) nextAccess.rolePermissions = rolePermissions;
  if (userAssignments) nextAccess.userAssignments = userAssignments;
  if (!nextAccess.userAssignments) nextAccess.userAssignments = [];

  const ownerId = resolveOwnerId(dashboard);
  const sanitizedRolePermissions = sanitizeRolePermissions(nextAccess.rolePermissions);
  const sanitizedAssignments = sanitizeAssignments(nextAccess.userAssignments, ownerId, nextAccess.rolePermissions);
  nextAccess.rolePermissions = sanitizedRolePermissions;
  nextAccess.userAssignments = sanitizedAssignments;

  await dashboards().updateOne(
    { _id: dashboard._id },
    { $set: { accessControl: nextAccess, updatedAt: new Date() } },
  );

  return res.json(await buildAccessPayload({ ...dashboard, accessControl: nextAccess }));
};

// Alias for PATCH /access-mode to update only accessMode
export const updateDashboardAccessMode = async (req, res) => {
  const { dashboardId } = req.params;
  const { accessMode } = req.body || {};
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    return res.status(404).json({ message: "Dashboard not found" });
  }
  const currentUserId = resolveUserId(req);
  if (!canEditDashboard(dashboard, currentUserId)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const nextAccess = dashboard.accessControl || buildDefaultAccessControl();
  if (accessMode) nextAccess.accessMode = accessMode;
  await dashboards().updateOne(
    { _id: dashboard._id },
    { $set: { accessControl: nextAccess, updatedAt: new Date() } },
  );
  return res.json(await buildAccessPayload({ ...dashboard, accessControl: nextAccess }));
};

export const addDashboardUserAssignment = async (req, res) => {
  const { dashboardId } = req.params;
  const { userId, role } = req.body || {};

  if (!userId || !role) {
    return res.status(400).json({ message: "userId and role are required" });
  }
  const roleKey = normalizeRoleKey(role);
  if (roleKey === "owner") {
    return res.status(400).json({ message: "Owner is reserved for the creator" });
  }

  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    return res.status(404).json({ message: "Dashboard not found" });
  }
  const currentUserId = resolveUserId(req);
  if (!canEditDashboard(dashboard, currentUserId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const user = (await selectUsersByIds([userId]))[0];
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const accessControl = dashboard.accessControl || buildDefaultAccessControl();
  const ownerId = resolveOwnerId(dashboard);
  const targetRole =
    roleKey === "analyst"
      ? analystTargetRole(
          (accessControl.rolePermissions || []).find((r) => normalizeRoleKey(r.role) === "analyst")?.permissions,
        )
      : ALLOWED_ROLE_KEYS.has(roleKey)
        ? ROLE_LABELS[roleKey]
        : "Viewer";

  const assignments = Array.isArray(accessControl.userAssignments) ? [...accessControl.userAssignments] : [];
  const idx = assignments.findIndex((a) => a.userId === userId);
  if (idx >= 0) {
    assignments[idx] = { ...assignments[idx], role: targetRole, fullName: user.fullName, email: user.email };
  } else {
    assignments.push({ id: userId, userId, role: targetRole, fullName: user.fullName, email: user.email });
  }
  accessControl.userAssignments = sanitizeAssignments(assignments, ownerId, accessControl.rolePermissions);
  accessControl.rolePermissions = sanitizeRolePermissions(accessControl.rolePermissions);

  await dashboards().updateOne(
    { _id: dashboard._id },
    { $set: { accessControl, updatedAt: new Date() } },
  );

  const payload = await buildAccessPayload({ ...dashboard, accessControl });
  return res.json(payload);
};

export const updateDashboardUserAssignment = async (req, res) => {
  const { dashboardId, assignmentId } = req.params;
  const { role } = req.body || {};
  if (!role) {
    return res.status(400).json({ message: "role is required" });
  }
  const roleKey = normalizeRoleKey(role);
  if (roleKey === "owner") {
    return res.status(400).json({ message: "Owner is reserved for the creator" });
  }
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) return res.status(404).json({ message: "Dashboard not found" });
  const currentUserId = resolveUserId(req);
  if (!canEditDashboard(dashboard, currentUserId)) return res.status(403).json({ message: "Forbidden" });

  const accessControl = dashboard.accessControl || buildDefaultAccessControl();
  const assignments = Array.isArray(accessControl.userAssignments) ? [...accessControl.userAssignments] : [];
  const idx = assignments.findIndex((a) => a.id === assignmentId || a.userId === assignmentId);
  if (idx === -1) return res.status(404).json({ message: "Assignment not found" });
  const ownerId = resolveOwnerId(dashboard);
  const targetRole =
    roleKey === "analyst"
      ? analystTargetRole(
          (accessControl.rolePermissions || []).find((r) => normalizeRoleKey(r.role) === "analyst")?.permissions,
        )
      : ALLOWED_ROLE_KEYS.has(roleKey)
        ? ROLE_LABELS[roleKey]
        : "Viewer";
  assignments[idx] = { ...assignments[idx], role: targetRole };
  accessControl.userAssignments = sanitizeAssignments(assignments, ownerId, accessControl.rolePermissions);
  accessControl.rolePermissions = sanitizeRolePermissions(accessControl.rolePermissions);

  await dashboards().updateOne(
    { _id: dashboard._id },
    { $set: { accessControl, updatedAt: new Date() } },
  );

  const payload = await buildAccessPayload({ ...dashboard, accessControl });
  return res.json(payload);
};

export const removeDashboardUserAssignment = async (req, res) => {
  const { dashboardId, assignmentId } = req.params;
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) return res.status(404).json({ message: "Dashboard not found" });
  const currentUserId = resolveUserId(req);
  if (!canEditDashboard(dashboard, currentUserId)) return res.status(403).json({ message: "Forbidden" });

  const accessControl = dashboard.accessControl || buildDefaultAccessControl();
  const ownerId = resolveOwnerId(dashboard);
  const assignments = Array.isArray(accessControl.userAssignments) ? [...accessControl.userAssignments] : [];
  const next = assignments.filter((a) => a.id !== assignmentId && a.userId !== assignmentId);
  accessControl.userAssignments = sanitizeAssignments(next, ownerId, accessControl.rolePermissions);
  accessControl.rolePermissions = sanitizeRolePermissions(accessControl.rolePermissions);

  await dashboards().updateOne(
    { _id: dashboard._id },
    { $set: { accessControl, updatedAt: new Date() } },
  );

  const payload = await buildAccessPayload({ ...dashboard, accessControl });
  return res.json(payload);
};
