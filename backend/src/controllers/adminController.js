import { listUsers, getUsersByIds, createUserAdmin, updateUserAdmin, deleteUserAdmin } from "../repositories/adminRepository.js";
import { getSocialhubDb } from "../mongo.js";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "../repositories/userRepository.js";
import { HttpError } from "../utils/httpError.js";
import { listActivities, insertActivity } from "../repositories/activityRepository.js";

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

export async function getDashboardDetail(req, res) {
  const db = getSocialhubDb();
  let objectId;
  try {
    objectId = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: "Invalid dashboard id" });
  }

  const doc = await db.collection("dashboards").findOne(
    { _id: objectId },
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
  );

  if (!doc) return res.status(404).json({ error: "Dashboard not found" });

  const ownerId = doc.userId || doc.ownerId || doc.ui?.userId || null;
  let owner = null;
  if (ownerId) {
    const owners = await getUsersByIds([String(ownerId)]);
    owner = owners?.[0] || null;
  }

  const tables = Array.isArray(doc.tables) ? doc.tables.map((t) => ({
    key: t.key || t.id || t.name,
    name: t.name || t.tableName || t.key || "Table",
    fields: Array.isArray(t.fields)
      ? t.fields.map((f) => ({
          key: f.key || f.id || f.name,
          name: f.name || f.fieldName || f.key,
          type: f.type || f.fieldType || "Text",
        }))
      : [],
    sampleRows: Array.isArray(t.sampleRows) ? t.sampleRows.slice(0, 3) : [],
  })) : [];

  res.json({
    dashboard: {
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description || "",
      type: doc.type || "",
      ownerId: ownerId || null,
      ownerName: owner?.name || owner?.email || null,
      tableCount: tables.length,
      widgetCount: Array.isArray(doc.widgets) ? doc.widgets.length : 0,
      insightCount: Array.isArray(doc.insights) ? doc.insights.length : 0,
      createdAt: doc.createdAt || null,
      updatedAt: doc.updatedAt || null,
      tables,
    },
  });
}

export async function createUser(req, res) {
  const { email, password, fullName, company, role, isVerified } = req.body || {};
  if (!email) throw new HttpError(400, "Email is required");
  const existing = await findUserByEmail(email);
  if (existing) throw new HttpError(409, "Email already exists");
  const pw = password && password.length >= 6 ? password : Math.random().toString(36).slice(2, 10);
  const passwordHash = await bcrypt.hash(pw, 10);
  const user = await createUserAdmin({ email, passwordHash, fullName, company, role, isVerified });
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "user.create",
      targetType: "user",
      targetId: user.id,
      metadata: { email, role: user.role, company: user.company },
    });
  } catch (err) {
    console.warn("Failed to log activity (create user):", err.message);
  }
  res.status(201).json({ user, tempPassword: password ? undefined : pw });
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const { fullName, company, role, isVerified } = req.body || {};
  const user = await updateUserAdmin(id, { fullName, company, role, isVerified });
  if (!user) return res.status(404).json({ error: "User not found" });
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "user.update",
      targetType: "user",
      targetId: user.id,
      metadata: { fullName, company, role, isVerified },
    });
  } catch (err) {
    console.warn("Failed to log activity (update user):", err.message);
  }
  res.json({ user });
}

export async function deleteUser(req, res) {
  const ok = await deleteUserAdmin(req.params.id);
  if (!ok) return res.status(404).json({ error: "User not found" });
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "user.delete",
      targetType: "user",
      targetId: req.params.id,
      metadata: {},
    });
  } catch (err) {
    console.warn("Failed to log activity (delete user):", err.message);
  }
  res.json({ success: true });
}

export async function getActivity(req, res) {
  try {
    const logs = await listActivities({ limit: 200 });
    const userIds = Array.from(new Set(logs.map((l) => l.userId).filter(Boolean))).map(String);
    const users = userIds.length ? await getUsersByIds(userIds) : [];
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const decorated = logs.map((l) => {
      const owner = l.userId ? userMap.get(String(l.userId)) : null;
      return {
        ...l,
        userName: owner ? owner.name || owner.email : "System",
        userEmail: owner?.email || null,
      };
    });
    res.json({ logs: decorated });
  } catch (err) {
    // If the activity_logs table doesn't exist yet, avoid crashing the API
    if (err.code === "42P01") {
      console.warn("activity_logs table missing; returning empty activity list");
      return res.json({ logs: [] });
    }
    throw err;
  }
}
