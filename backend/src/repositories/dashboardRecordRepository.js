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
