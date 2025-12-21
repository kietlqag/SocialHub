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

export const canViewDashboard = (dashboard, currentUserId) => {
  if (!dashboard) return false;
  if (dashboard.userId && sameId(dashboard.userId, currentUserId)) return true;
  if (dashboard.accessControl?.accessMode === "public") return true;
  return false;
};

export const canEditDashboard = (dashboard, currentUserId) => {
  if (!dashboard) return false;
  if (dashboard.userId && sameId(dashboard.userId, currentUserId)) return true;
  return userHasManageAccess(dashboard, currentUserId);
};
