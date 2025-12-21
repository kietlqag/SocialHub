import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";
import { DashboardTableModel } from "../models/dashboardTableModel.js";
import { selectUsersByIds } from "../repositories/userRepository.js";

export const getPublicDashboards = async (req, res) => {
  try {
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

    const userIds = Array.from(new Set(dashboards.map((d) => d.userId).filter(Boolean)));
    let users = [];
    if (userIds.length) {
      try {
        users = await selectUsersByIds(userIds);
      } catch (userErr) {
        console.error("getPublicDashboards user lookup error", userErr);
        users = [];
      }
    }
    const userMap = new Map(
      users.map((u) => [u.id, u.fullName || u.displayName || u.name || u.email || u.id]),
    );

    const ids = dashboards.map((d) => d._id).filter(Boolean);
    let tableCounts = [];
    if (ids.length) {
      try {
        tableCounts = await DashboardTableModel.aggregate([
          {
            $match: {
              dashboardId: {
                $in: ids
                  .map((id) => {
                    try {
                      return new ObjectId(id.toString());
                    } catch {
                      return null;
                    }
                  })
                  .filter(Boolean),
              },
            },
          },
          { $group: { _id: "$dashboardId", count: { $sum: 1 } } },
        ]);
      } catch (aggErr) {
        console.error("getPublicDashboards aggregate error", aggErr);
        tableCounts = [];
      }
    }
    const tableCountMap = new Map(tableCounts.map((t) => [t._id.toString(), t.count]));

    const payload = dashboards.map((d) => ({
      _id: d._id.toString(),
      name: d.name,
      userId: d.userId,
      ownerName:
        d.userFullName ||
        d.userName ||
        d.ownerName ||
        userMap.get(d.userId) ||
        "Unknown owner",
      type: d.type || "",
      widgetsCount: Array.isArray(d.widgets) ? d.widgets.length : undefined,
      updatedAt: d.updatedAt || d.createdAt,
      tablesCount: tableCountMap.get(d._id.toString()) || (Array.isArray(d.tables) ? d.tables.length : 0) || 0,
    }));

    res.json(payload);
  } catch (err) {
    console.error("getPublicDashboards error", err);
    res.status(500).json({ message: "Internal Server Error", error: err?.message || "Unknown error" });
  }
};
