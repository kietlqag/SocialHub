import { listUsers, getUsersByIds } from "../repositories/adminRepository.js";
import { getSocialhubDb } from "../mongo.js";
import { ObjectId } from "mongodb";

export async function getUsers(req, res) {
  const users = await listUsers();

  let dashboardCounts = new Map();
  try {
    const db = getSocialhubDb();
    const counts = await db
      .collection("dashboards")
      .aggregate([
        {
          $project: {
            owner: {
              $ifNull: ["$userId", { $ifNull: ["$ownerId", "$ui.userId"] }],
            },
            createdAt: 1,
            updatedAt: 1,
          },
        },
        { $match: { owner: { $ne: null } } },
        { $group: { _id: "$owner", count: { $sum: 1 }, lastUpdated: { $max: "$updatedAt" } } },
      ])
      .toArray();
    dashboardCounts = new Map(counts.map((c) => [String(c._id), { count: c.count, lastUpdated: c.lastUpdated }]));
  } catch (err) {
    // If Mongo isn't configured, just return SQL users
    console.warn("Admin getUsers: could not load dashboard counts from Mongo:", err.message);
  }

  const merged = users.map((u) => {
    const dash = dashboardCounts.get(String(u.id));
    return {
      ...u,
      dashboards: dash?.count ?? 0,
      lastDashboardUpdate: dash?.lastUpdated || null,
    };
  });

  res.json({ users: merged });
}

export async function getDashboards(req, res) {
  const db = getSocialhubDb();
  const docs = await db
    .collection("dashboards")
    .find(
      {},
      {
        projection: {
          name: 1,
          description: 1,
          type: 1,
          widgets: 1,
          insights: 1,
          tables: 1,
          createdAt: 1,
          updatedAt: 1,
          userId: 1,
          ownerId: 1,
          "ui.userId": 1,
        },
      }
    )
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(200)
    .toArray();

  const ownerIds = Array.from(
    new Set(
      docs
        .map((d) => d.userId || d.ownerId || d.ui?.userId)
        .filter(Boolean)
        .map((id) => String(id))
    )
  );

  const owners = await getUsersByIds(ownerIds);
  const ownerMap = new Map(owners.map((o) => [String(o.id), o]));

  const dashboards = docs.map((d) => {
    const ownerId = d.userId || d.ownerId || d.ui?.userId || null;
    const owner = ownerId ? ownerMap.get(String(ownerId)) : null;
    return {
      id: d._id instanceof ObjectId ? d._id.toString() : String(d._id),
      name: d.name,
      description: d.description || "",
      type: d.type || "",
      ownerId: ownerId || null,
      ownerName: owner?.name || owner?.email || null,
      tableCount: Array.isArray(d.tables) ? d.tables.length : 0,
      widgetCount: Array.isArray(d.widgets) ? d.widgets.length : 0,
      insightCount: Array.isArray(d.insights) ? d.insights.length : 0,
      createdAt: d.createdAt || null,
      updatedAt: d.updatedAt || null,
    };
  });

  res.json({ dashboards });
}
