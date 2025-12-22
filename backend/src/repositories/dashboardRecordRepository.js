import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";

const collection = () => getSocialhubDb().collection("dashboard_records");

export async function insertRecord({ dashboardId, tableKey, record }) {
  if (!dashboardId || !tableKey || !record || typeof record !== "object") return null;
  const now = new Date();
  const doc = {
    dashboardId: new ObjectId(dashboardId),
    tableKey,
    record,
    createdAt: now,
    updatedAt: now,
  };
  const res = await collection().insertOne(doc);
  return { id: res.insertedId.toString(), tableKey, record, createdAt: now, updatedAt: now };
}

export async function listRecordsByDashboard({ dashboardId, tableKey }) {
  if (!dashboardId) return [];
  const filter = { dashboardId: new ObjectId(dashboardId) };
  if (tableKey) filter.tableKey = tableKey;
  const rows = await collection().find(filter).sort({ createdAt: -1 }).toArray();
  return rows.map((row) => ({
    id: row._id.toString(),
    tableKey: row.tableKey,
    record: row.record,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function countRecordsByDashboard({ dashboardId, tableKey }) {
  if (!dashboardId) return 0;
  const filter = { dashboardId: new ObjectId(dashboardId) };
  if (tableKey) filter.tableKey = tableKey;
  return collection().countDocuments(filter);
}

export async function findRecordById({ dashboardId, tableKey, recordId }) {
  if (!dashboardId || !recordId) return null;
  if (!ObjectId.isValid(recordId)) return null;
  const filter = { _id: new ObjectId(recordId), dashboardId: new ObjectId(dashboardId) };
  if (tableKey) filter.tableKey = tableKey;
  const row = await collection().findOne(filter);
  if (!row) return null;
  return {
    id: row._id.toString(),
    tableKey: row.tableKey,
    record: row.record,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function updateRecordById({ dashboardId, tableKey, recordId, record }) {
  if (!dashboardId || !recordId || !record || typeof record !== "object") return null;
  if (!ObjectId.isValid(recordId)) return null;
  const filter = { _id: new ObjectId(recordId), dashboardId: new ObjectId(dashboardId) };
  if (tableKey) filter.tableKey = tableKey;
  const now = new Date();
  const res = await collection().findOneAndUpdate(
    filter,
    { $set: { record, updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!res.value) return null;
  return {
    id: res.value._id.toString(),
    tableKey: res.value.tableKey,
    record: res.value.record,
    createdAt: res.value.createdAt,
    updatedAt: res.value.updatedAt,
  };
}

export async function deleteRecordById({ dashboardId, tableKey, recordId }) {
  if (!dashboardId || !recordId) return false;
  if (!ObjectId.isValid(recordId)) return false;
  const filter = { _id: new ObjectId(recordId), dashboardId: new ObjectId(dashboardId) };
  if (tableKey) filter.tableKey = tableKey;
  const res = await collection().deleteOne(filter);
  return res.deletedCount > 0;
}
