import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";
import { DashboardTableModel } from "../models/dashboardTableModel.js";

export const getPublicDashboards = async (req, res) => {
  const db = getSocialhubDb();
  const dashboards = await db
    .collection("dashboards")
    .find({
      "accessControl.accessMode": "public",
      isDeleted: { $ne: true },
      isArchived: { $ne: true },
    })
    .sort({ updatedAt: -1 })
    .toArray();

  const ids = dashboards.map((d) => d._id).filter(Boolean);
  let tableCounts = [];
  if (ids.length) {
    tableCounts = await DashboardTableModel.aggregate([
      { $match: { dashboardId: { $in: ids.map((id) => new ObjectId(id)) } } },
      { $group: { _id: "$dashboardId", count: { $sum: 1 } } },
    ]);
  }
  const tableCountMap = new Map(tableCounts.map((t) => [t._id.toString(), t.count]));

  const payload = dashboards.map((d) => ({
    _id: d._id.toString(),
    name: d.name,
    description: d.description || "",
    owner: d.userId
      ? {
          id: d.userId,
          fullName: d.userFullName || d.userName || d.ownerName || d.userId,
        }
      : null,
    updatedAt: d.updatedAt || d.createdAt,
    tablesCount: tableCountMap.get(d._id.toString()) || (Array.isArray(d.tables) ? d.tables.length : 0) || 0,
    favoriteCount: d.favoriteCount || 0,
    tags: d.tags || [],
  }));

  res.json(payload);
};
