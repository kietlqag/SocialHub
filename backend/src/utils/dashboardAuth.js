export const canViewDashboard = (dashboard, currentUserId) => {
  if (!dashboard) return false;
  if (dashboard.userId && dashboard.userId === currentUserId) return true;
  if (dashboard.accessControl?.accessMode === "public") return true;
  return false;
};

export const canEditDashboard = (dashboard, currentUserId) => {
  if (!dashboard) return false;
  return Boolean(dashboard.userId) && dashboard.userId === currentUserId;
};
