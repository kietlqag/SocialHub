import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";

const collection = () => getSocialhubDb().collection("dashboard_tables");

export async function insertTables(dashboardId, tables) {
  if (!dashboardId || !Array.isArray(tables) || !tables.length) return [];
  const docs = tables.map((table) => ({
    dashboardId: new ObjectId(dashboardId),
    key: table.key,
    name: table.name,
    description: table.description || "",
    fields: table.fields || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  await collection().insertMany(docs);
  return docs.map((doc) => ({ ...doc, id: doc._id?.toString() }));
}

export async function listTablesByDashboard(dashboardId) {
  if (!dashboardId) return [];
  const rows = await collection().find({ dashboardId: new ObjectId(dashboardId) }).toArray();
  return rows.map((row) => ({
    id: row._id.toString(),
    key: row.key,
    name: row.name,
    description: row.description || "",
    fields: row.fields || [],
  }));
}

export async function deleteTablesByDashboard(dashboardId) {
  if (!dashboardId) return;
  await collection().deleteMany({ dashboardId: new ObjectId(dashboardId) });
}
