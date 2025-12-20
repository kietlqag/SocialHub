import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";
import { buildDefaultAccessControl } from "../utils/accessControlDefaults.js";

const dashboards = () => getSocialhubDb().collection("dashboards");

const findDashboardById = async (dashboardId) => {
  let objectId;
  try {
    objectId = new ObjectId(dashboardId);
  } catch {
    return null;
  }
  return dashboards().findOne({ _id: objectId });
};

export const getDashboardAccess = async (req, res) => {
  const { dashboardId } = req.params;
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    return res.status(404).json({ message: "Dashboard not found" });
  }

  let accessControl = dashboard.accessControl;
  if (!accessControl) {
    accessControl = buildDefaultAccessControl();
    await dashboards().updateOne(
      { _id: dashboard._id },
      { $set: { accessControl, updatedAt: new Date() } },
    );
  }

  return res.json(accessControl);
};

export const updateDashboardAccess = async (req, res) => {
  const { dashboardId } = req.params;
  const { accessMode, rolePermissions } = req.body || {};

  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    return res.status(404).json({ message: "Dashboard not found" });
  }

  const nextAccess = dashboard.accessControl || buildDefaultAccessControl();
  if (accessMode) nextAccess.accessMode = accessMode;
  if (rolePermissions) nextAccess.rolePermissions = rolePermissions;

  await dashboards().updateOne(
    { _id: dashboard._id },
    { $set: { accessControl: nextAccess, updatedAt: new Date() } },
  );

  return res.json(nextAccess);
};

// Alias for PATCH /access-mode to update only accessMode
export const updateDashboardAccessMode = async (req, res) => {
  const { dashboardId } = req.params;
  const { accessMode } = req.body || {};
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    return res.status(404).json({ message: "Dashboard not found" });
  }
  const nextAccess = dashboard.accessControl || buildDefaultAccessControl();
  if (accessMode) nextAccess.accessMode = accessMode;
  await dashboards().updateOne(
    { _id: dashboard._id },
    { $set: { accessControl: nextAccess, updatedAt: new Date() } },
  );
  return res.json(nextAccess);
};
