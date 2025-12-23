export const DASHBOARD_ROLE_DEFAULTS = {
  owner: { view: true, create: true, edit: true, delete: true, manageAccess: true },
  admin: { view: true, create: true, edit: true, delete: true, manageAccess: true },
  manager: { view: true, create: true, edit: true, delete: false, manageAccess: false },
  viewer: { view: true, create: false, edit: false, delete: false, manageAccess: false },
};

const resolveOwnerId = (dashboard) => dashboard?.userId || dashboard?.createdBy || null;

export function getUserDashboardRoleId(dashboard, userId = null) {
  if (!dashboard || !userId) return null;
  const ownerId = resolveOwnerId(dashboard);
  const ac = dashboard.accessControl || {};
  const assignments = Array.isArray(ac.userAssignments)
    ? ac.userAssignments
    : Array.isArray(ac.assignments)
      ? ac.assignments
      : [];
  const found = assignments.find((a) => a?.userId === userId);
  if (found?.role) return found.role.toLowerCase();
  if (ownerId && ownerId === userId) return "owner";
  return null;
}

export function getRolePermissions(dashboard, roleId) {
  const ac = dashboard?.accessControl || {};
  const roleKey = roleId ? roleId.toLowerCase() : null;
  if (!roleKey) return { view: false, create: false, edit: false, delete: false, manageAccess: false };
  if (roleKey === "owner") return DASHBOARD_ROLE_DEFAULTS.owner;
  if (roleKey === "analyst") return { ...DASHBOARD_ROLE_DEFAULTS.viewer }; // Analyst is deprecated
  const fromArray = Array.isArray(ac.rolePermissions)
    ? ac.rolePermissions.find((r) => r?.role?.toLowerCase() === roleKey)
    : null;
  if (fromArray?.permissions) return fromArray.permissions;
  const configured = ac.roles?.[roleKey];
  if (configured) return configured;
  return DASHBOARD_ROLE_DEFAULTS[roleKey] || { view: false, create: false, edit: false, delete: false, manageAccess: false };
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
