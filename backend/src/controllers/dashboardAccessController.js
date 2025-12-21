import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";
import { buildDefaultAccessControl } from "../utils/accessControlDefaults.js";
import { canEditDashboard } from "../utils/dashboardAuth.js";
import { selectUsersByIds } from "../repositories/userRepository.js";

const dashboards = () => getSocialhubDb().collection("dashboards");

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

const buildAccessPayload = async (dashboard) => {
  let accessControl = dashboard.accessControl || buildDefaultAccessControl();
  if (!accessControl.userAssignments) accessControl.userAssignments = [];
  if (!accessControl.rolePermissions) accessControl.rolePermissions = buildDefaultAccessControl().rolePermissions;
  const userAssignments = await hydrateAssignments(accessControl.userAssignments);
  return {
    accessMode: accessControl.accessMode || "restricted",
    rolePermissions: accessControl.rolePermissions,
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
  if (!canEditDashboard(dashboard, currentUserId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  let accessControl = dashboard.accessControl;
  if (!accessControl) {
    accessControl = buildDefaultAccessControl();
    await dashboards().updateOne(
      { _id: dashboard._id },
      { $set: { accessControl, updatedAt: new Date() } },
    );
  }

  return res.json(await buildAccessPayload({ ...dashboard, accessControl }));
};

export const updateDashboardAccess = async (req, res) => {
  const { dashboardId } = req.params;
  const { accessMode, rolePermissions } = req.body || {};

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
  if (rolePermissions) nextAccess.rolePermissions = rolePermissions;
  if (!nextAccess.userAssignments) nextAccess.userAssignments = [];

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
  const assignments = Array.isArray(accessControl.userAssignments) ? [...accessControl.userAssignments] : [];
  const idx = assignments.findIndex((a) => a.userId === userId);
  if (idx >= 0) {
    assignments[idx] = { ...assignments[idx], role, fullName: user.fullName, email: user.email };
  } else {
    assignments.push({ id: userId, userId, role, fullName: user.fullName, email: user.email });
  }
  accessControl.userAssignments = assignments;

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
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) return res.status(404).json({ message: "Dashboard not found" });
  const currentUserId = resolveUserId(req);
  if (!canEditDashboard(dashboard, currentUserId)) return res.status(403).json({ message: "Forbidden" });

  const accessControl = dashboard.accessControl || buildDefaultAccessControl();
  const assignments = Array.isArray(accessControl.userAssignments) ? [...accessControl.userAssignments] : [];
  const idx = assignments.findIndex((a) => a.id === assignmentId || a.userId === assignmentId);
  if (idx === -1) return res.status(404).json({ message: "Assignment not found" });
  assignments[idx] = { ...assignments[idx], role };
  accessControl.userAssignments = assignments;

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
  const assignments = Array.isArray(accessControl.userAssignments) ? [...accessControl.userAssignments] : [];
  const next = assignments.filter((a) => a.id !== assignmentId && a.userId !== assignmentId);
  accessControl.userAssignments = next;

  await dashboards().updateOne(
    { _id: dashboard._id },
    { $set: { accessControl, updatedAt: new Date() } },
  );

  const payload = await buildAccessPayload({ ...dashboard, accessControl });
  return res.json(payload);
};
