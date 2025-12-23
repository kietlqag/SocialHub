import { buildDefaultAccessControl } from "./accessControlDefaults.js";

const sameId = (a, b) => {
  if (!a || !b) return false;
  return String(a) === String(b);
};

const resolveRolePermissions = (dashboard) => {
  const access = dashboard?.accessControl || buildDefaultAccessControl();
  return Array.isArray(access.rolePermissions) && access.rolePermissions.length
    ? access.rolePermissions
    : buildDefaultAccessControl().rolePermissions;
};

const toLowerArray = (values) =>
  Array.isArray(values) ? values.map((val) => (typeof val === "string" ? val.toLowerCase() : String(val || "").toLowerCase())) : [];

const resolveOwnerId = (dashboard) => dashboard?.userId || dashboard?.createdBy || null;

export const isGlobalAdminUser = (user) => {
  if (!user) return false;
  if (user.isGlobalAdmin) return true;
  const singleRole = typeof user.role === "string" ? user.role.toLowerCase() : null;
  if (singleRole && (singleRole === "admin" || singleRole === "globaladmin" || singleRole === "superadmin")) {
    return true;
  }
  const roles = toLowerArray(user.roles);
  return roles.some((role) => role === "admin" || role === "globaladmin" || role === "superadmin");
};

const userHasManageAccess = (dashboard, currentUserId) => {
  if (!dashboard || !currentUserId) return false;
  const access = dashboard.accessControl || {};
  const assignments = Array.isArray(access.userAssignments) ? access.userAssignments : [];
  const matched = assignments.find((a) => sameId(a?.userId, currentUserId));
  if (!matched) return false;
  const perms = resolveRolePermissions(dashboard).find(
    (r) => r.role?.toLowerCase() === matched.role?.toLowerCase(),
  );
  return !!perms?.permissions?.manageAccess;
};

export const canViewDashboard = (dashboard, currentUserId, options = {}) => {
  if (!dashboard) return false;

  const access = dashboard.accessControl || {};
  const accessMode = access.accessMode || "restricted";
  const assignments = Array.isArray(access.userAssignments) ? access.userAssignments : [];
  const ownerId = resolveOwnerId(dashboard);
  const isOwner = ownerId && sameId(ownerId, currentUserId);
  const isGlobalAdmin = Boolean(options?.isGlobalAdmin);
  const hasAssignment = Boolean(
    currentUserId && assignments.some((assignment) => assignment && sameId(assignment.userId, currentUserId)),
  );

  let allowed = false;
  if (isOwner || isGlobalAdmin) {
    allowed = true;
  } else if (accessMode === "public") {
    allowed = true;
  } else if (accessMode === "restricted") {
    allowed = hasAssignment;
  } else if (accessMode === "private") {
    allowed = false;
  }

  console.log("[canViewDashboard]", {
    id: dashboard._id ? String(dashboard._id) : String(dashboard.id || ""),
    userId: currentUserId,
    accessMode: access.accessMode,
    isOwner,
    isGlobalAdmin,
    hasAssignment,
  });

  return allowed;
};

export const canEditDashboard = (dashboard, currentUserId) => {
  if (!dashboard) return false;
  const ownerId = resolveOwnerId(dashboard);
  if (ownerId && sameId(ownerId, currentUserId)) return true;
  return userHasManageAccess(dashboard, currentUserId);
};
