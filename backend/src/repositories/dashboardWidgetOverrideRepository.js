import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";

const collection = () => getSocialhubDb().collection("dashboard_widget_overrides");

export async function upsertHideOverride(dashboardId, widgetKey) {
  if (!dashboardId || !widgetKey) return null;
  const now = new Date();
  const res = await collection().findOneAndUpdate(
    { dashboardId, widgetKey },
    { $set: { dashboardId, widgetKey, hidden: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  return res.value;
}

export async function listOverridesByDashboard(dashboardId) {
  if (!dashboardId) return [];
  const docs = await collection().find({ dashboardId }).toArray();
  return docs;
}
