import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getSocialhubDb } from "../mongo.js";
import { HttpError } from "../utils/httpError.js";
import { listUsers, getUsersByIds, createUserAdmin, updateUserAdmin, deleteUserAdmin } from "../repositories/adminRepository.js";
import { findUserByEmail } from "../repositories/userRepository.js";
import { listActivities, insertActivity } from "../repositories/activityRepository.js";
import { listRecordsByDashboard } from "../repositories/dashboardRecordRepository.js";

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
            status: 1,
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

  let externalTableCounts = new Map();
  try {
    const counts = await db
      .collection("dashboard_tables")
      .aggregate([{ $group: { _id: "$dashboardId", count: { $sum: 1 } } }])
      .toArray();
    externalTableCounts = new Map(counts.map((c) => [String(c._id), c.count]));
  } catch (err) {
    // collection may not exist; fall back to embedded tables
  }

  const ownerIds = Array.from(
    new Set(
      docs
        .map((d) => d.userId || d.ownerId || d.ui?.userId)
        .filter(Boolean)
        .map((id) => String(id))
    )
  );

  const owners = ownerIds.length ? await getUsersByIds(ownerIds) : [];
  const ownerMap = new Map(owners.map((o) => [String(o.id), o]));

  const dashboards = docs.map((d) => {
    const ownerId = d.userId || d.ownerId || d.ui?.userId || null;
    const owner = ownerId ? ownerMap.get(String(ownerId)) : null;
    const id = d._id instanceof ObjectId ? d._id.toString() : String(d._id);
    const tableCount =
      externalTableCounts.get(id) ?? (Array.isArray(d.tables) ? d.tables.length : 0);
    return {
      id,
      name: d.name,
      description: d.description || "",
      type: d.type || "",
      ownerId: ownerId || null,
      ownerName: owner?.name || owner?.email || null,
      tableCount,
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

  let externalTables = [];
  try {
    externalTables = await db
      .collection("dashboard_tables")
      .find({ dashboardId: objectId })
      .project({ _id: 0, dashboardId: 0 })
      .toArray();
  } catch (err) {
    // ignore missing collection
  }
  const rawTables = externalTables.length ? externalTables : Array.isArray(doc.tables) ? doc.tables : [];
  const tables = normalizeTables(rawTables);

  const ownerId = doc.userId || doc.ownerId || doc.ui?.userId || null;
  let owner = null;
  if (ownerId) {
    const owners = await getUsersByIds([String(ownerId)]);
    owner = owners?.[0] || null;
  }

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

export async function duplicateDashboardAdmin(req, res) {
  const db = getSocialhubDb();
  let objectId;
  try {
    objectId = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: "Invalid dashboard id" });
  }
  const doc = await db.collection("dashboards").findOne({ _id: objectId });
  if (!doc) return res.status(404).json({ error: "Dashboard not found" });
  const now = new Date();
  const clone = {
    ...doc,
    _id: new ObjectId(),
    name: `${doc.name || "Dashboard"} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("dashboards").insertOne(clone);
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "dashboard.duplicate",
      targetType: "dashboard",
      targetId: req.params.id,
      metadata: { cloneId: clone._id.toString(), name: clone.name },
    });
  } catch (err) {
    console.warn("Failed to log activity (dashboard.duplicate):", err.message);
  }
  res.status(201).json({ dashboard: { id: clone._id.toString(), name: clone.name } });
}

export async function updateDashboardStatus(req, res) {
  const { status } = req.body || {};
  if (!status) throw new HttpError(400, "Status required");
  const db = getSocialhubDb();
  const objectId = new ObjectId(req.params.id);
  const doc = await db.collection("dashboards").findOneAndUpdate(
    { _id: objectId },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!doc.value) return res.status(404).json({ error: "Dashboard not found" });
  try {
    const action =
      status === "locked"
        ? "dashboard.lock"
        : status === "archived"
          ? "dashboard.archive"
          : status === "active"
            ? "dashboard.activate"
            : "dashboard.status_update";
    await insertActivity({
      userId: req.user?.id || null,
      action,
      targetType: "dashboard",
      targetId: req.params.id,
      metadata: { status },
    });
  } catch (err) {
    console.warn("Failed to log activity (dashboard status):", err.message);
  }
  res.json({ dashboard: { id: req.params.id, status } });
}

export async function deleteDashboardAdmin(req, res) {
  const db = getSocialhubDb();
  const objectId = new ObjectId(req.params.id);
  const resDelete = await db.collection("dashboards").deleteOne({ _id: objectId });
  if (!resDelete.deletedCount) return res.status(404).json({ error: "Dashboard not found" });
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "dashboard.delete",
      targetType: "dashboard",
      targetId: req.params.id,
      metadata: {},
    });
  } catch (err) {
    console.warn("Failed to log activity (dashboard.delete):", err.message);
  }
  res.json({ success: true });
}

function ensureDashboard(id) {
  try {
    return new ObjectId(id);
  } catch {
    throw new HttpError(400, "Invalid dashboard id");
  }
}

const extractTables = (doc) => (Array.isArray(doc.tables) ? doc.tables : []);

function normalizeTables(tables = []) {
  return tables.map((t, idx) => ({
    key: t.key || t.id || t.name || `table_${idx}`,
    name: t.name || t.label || t.tableName || t.key || `Table ${idx + 1}`,
    fields: Array.isArray(t.fields)
      ? t.fields.map((f, i) => ({
          key: f.key || f.id || f.name || `field_${i}`,
          name: f.name || f.label || f.fieldName || f.key || `Field ${i + 1}`,
          type: f.type || f.fieldType || "Text",
        }))
      : [],
    sampleRows: Array.isArray(t.sampleRows) ? t.sampleRows.slice(0, 5) : [],
  }));
}

function assertUniqueTableKey(tables, key, currentKey) {
  const duplicate = tables.find((t) => t.key === key && t.key !== currentKey);
  if (duplicate) throw new HttpError(409, "Table key already exists");
}

function assertUniqueFieldKeys(fields) {
  const keys = fields.map((f) => f.key || f.id || f.name);
  const dup = keys.find((k, idx) => k && keys.indexOf(k) !== idx);
  if (dup) throw new HttpError(409, `Duplicate field key: ${dup}`);
}

export async function listDashboardTables(req, res) {
  const db = getSocialhubDb();
  const objectId = ensureDashboard(req.params.id);
  let tables = [];
  try {
    tables = await db
      .collection("dashboard_tables")
      .find({ dashboardId: objectId })
      .project({ _id: 0, dashboardId: 0 })
      .toArray();
  } catch (err) {
    // collection may not exist
  }
  if (!tables.length) {
    const doc = await db.collection("dashboards").findOne({ _id: objectId });
    if (!doc) return res.status(404).json({ error: "Dashboard not found" });
    tables = extractTables(doc);
  }
  res.json({ tables: normalizeTables(tables) });
}

export async function addDashboardTable(req, res) {
  const db = getSocialhubDb();
  const objectId = ensureDashboard(req.params.id);
  const doc = await db.collection("dashboards").findOne({ _id: objectId });
  if (!doc) return res.status(404).json({ error: "Dashboard not found" });

  const tables = extractTables(doc);
  const { key, name, fields = [], sampleRows = [] } = req.body || {};
  if (!key) throw new HttpError(400, "Table key is required");
  assertUniqueTableKey(tables, key);
  const normalizedFields = (fields || []).map((f, idx) => ({
    key: f.key || f.id || `field_${idx}`,
    name: f.name || f.fieldName || f.key || `Field ${idx + 1}`,
    type: f.type || f.fieldType || "Text",
  }));
  assertUniqueFieldKeys(normalizedFields);
  const table = {
    key,
    name: name || key,
    fields: normalizedFields,
    sampleRows: Array.isArray(sampleRows) ? sampleRows : [],
  };
  const updatedTables = [...tables, table];
  await db.collection("dashboards").updateOne(
    { _id: objectId },
    { $set: { tables: updatedTables, updatedAt: new Date() } }
  );
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "table.create",
      targetType: "table",
      targetId: key,
      metadata: { dashboardId: req.params.id },
    });
  } catch (err) {
    console.warn("Failed to log activity (table.create):", err.message);
  }
  res.status(201).json({ table });
}

export async function updateDashboardTable(req, res) {
  const db = getSocialhubDb();
  const objectId = ensureDashboard(req.params.id);
  const currentKey = req.params.tableKey;
  const doc = await db.collection("dashboards").findOne({ _id: objectId });
  if (!doc) return res.status(404).json({ error: "Dashboard not found" });
  const tables = extractTables(doc);
  const idx = tables.findIndex((t) => t.key === currentKey);
  if (idx === -1) return res.status(404).json({ error: "Table not found" });

  const { key, name, fields, sampleRows } = req.body || {};
  const nextKey = key || currentKey;
  assertUniqueTableKey(tables, nextKey, currentKey);
  const normalizedFields = Array.isArray(fields)
    ? fields.map((f, i) => ({
        key: f.key || f.id || `field_${i}`,
        name: f.name || f.fieldName || f.key || `Field ${i + 1}`,
        type: f.type || f.fieldType || "Text",
      }))
    : tables[idx].fields || [];
  assertUniqueFieldKeys(normalizedFields);

  const nextTable = {
    ...tables[idx],
    key: nextKey,
    name: name || tables[idx].name,
    fields: normalizedFields,
    sampleRows: Array.isArray(sampleRows) ? sampleRows : tables[idx].sampleRows || [],
  };
  const updatedTables = [...tables];
  updatedTables[idx] = nextTable;
  await db.collection("dashboards").updateOne(
    { _id: objectId },
    { $set: { tables: updatedTables, updatedAt: new Date() } }
  );
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "table.update",
      targetType: "table",
      targetId: nextKey,
      metadata: { dashboardId: req.params.id },
    });
  } catch (err) {
    console.warn("Failed to log activity (table.update):", err.message);
  }
  res.json({ table: nextTable });
}

export async function deleteDashboardTable(req, res) {
  const db = getSocialhubDb();
  const objectId = ensureDashboard(req.params.id);
  const targetKey = req.params.tableKey;
  const doc = await db.collection("dashboards").findOne({ _id: objectId });
  if (!doc) return res.status(404).json({ error: "Dashboard not found" });
  const tables = extractTables(doc);
  const next = tables.filter((t) => t.key !== targetKey);
  if (next.length === tables.length) return res.status(404).json({ error: "Table not found" });
  await db.collection("dashboards").updateOne(
    { _id: objectId },
    { $set: { tables: next, updatedAt: new Date() } }
  );
  try {
    await insertActivity({
      userId: req.user?.id || null,
      action: "table.delete",
      targetType: "table",
      targetId: targetKey,
      metadata: { dashboardId: req.params.id },
    });
  } catch (err) {
    console.warn("Failed to log activity (table.delete):", err.message);
  }
  res.json({ success: true });
}

export async function previewDashboardTable(req, res) {
  const db = getSocialhubDb();
  const objectId = ensureDashboard(req.params.id);
  const targetKey = req.params.tableKey;
  const doc = await db.collection("dashboards").findOne({ _id: objectId });
  if (!doc) return res.status(404).json({ error: "Dashboard not found" });
  const tables = extractTables(doc);
  const table = tables.find((t) => t.key === targetKey);
  if (!table) return res.status(404).json({ error: "Table not found" });
  const rows = Array.isArray(table.sampleRows) ? table.sampleRows.slice(0, 20) : [];
  res.json({ rows, fields: table.fields || [] });
}

export async function listDashboardTableRecords(req, res) {
  const { id: dashboardId, tableKey } = req.params;
  const limit = Number(req.query.limit || 20);
  const records = await listRecordsByDashboard({ dashboardId, tableKey });
  res.json({ records: records.slice(0, limit) });
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
