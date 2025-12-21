export const DASHBOARD_ROLE_DEFAULTS = {
  owner: { view: true, create: true, edit: true, delete: true, manageAccess: true },
  admin: { view: true, create: true, edit: true, delete: true, manageAccess: true },
  manager: { view: true, create: true, edit: true, delete: false, manageAccess: false },
  analyst: { view: true, create: false, edit: false, delete: false, manageAccess: false },
  viewer: { view: true, create: false, edit: false, delete: false, manageAccess: false },
};

export function getUserDashboardRoleId(dashboard, userId = null) {
  if (!dashboard || !userId) return null;
  const ac = dashboard.accessControl || {};
  const found = Array.isArray(ac.assignments) ? ac.assignments.find((a) => a?.userId === userId) : null;
  if (found?.role) return found.role;
  if (dashboard.userId && dashboard.userId === userId) return "owner";
  return null;
}

export function getRolePermissions(dashboard, roleId) {
  const ac = dashboard?.accessControl || {};
  if (!roleId) return { view: false, create: false, edit: false, delete: false, manageAccess: false };
  const configured = ac.roles?.[roleId];
  if (configured) return configured;
  return DASHBOARD_ROLE_DEFAULTS[roleId] || { view: false, create: false, edit: false, delete: false, manageAccess: false };
}

export function getDashboardPermissionsForUser(dashboard, userId = null) {
  const roleId = getUserDashboardRoleId(dashboard, userId);
  const perms = getRolePermissions(dashboard, roleId);
  return { roleId, ...perms };
}

export function canManageDashboardAccess(dashboard, userId = null) {
  const perms = getDashboardPermissionsForUser(dashboard, userId);
  return !!perms.manageAccess;
}

export function canViewDashboardData(dashboard, userId = null, isPublicVisitor = false) {
  if (isPublicVisitor) return false;
  const perms = getDashboardPermissionsForUser(dashboard, userId);
  return !!perms.view;
}

export function canCreateRecords(dashboard, userId = null) {
  const perms = getDashboardPermissionsForUser(dashboard, userId);
  return !!perms.create;
}

export function canEditRecords(dashboard, userId = null) {
  const perms = getDashboardPermissionsForUser(dashboard, userId);
  return !!perms.edit;
}

export function canDeleteRecords(dashboard, userId = null) {
  const perms = getDashboardPermissionsForUser(dashboard, userId);
  return !!perms.delete;
}
