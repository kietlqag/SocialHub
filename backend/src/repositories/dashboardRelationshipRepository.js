import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";

const collection = () => getSocialhubDb().collection("dashboard_relationships");

export async function insertRelationships(dashboardId, relationships) {
  if (!dashboardId || !Array.isArray(relationships) || !relationships.length) return [];
  const docs = relationships.map((rel) => ({
    dashboardId: new ObjectId(dashboardId),
    fromTableKey: rel.fromTableKey,
    fromFieldKey: rel.fromFieldKey,
    toTableKey: rel.toTableKey,
    toFieldKey: rel.toFieldKey,
    type: rel.type,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  await collection().insertMany(docs);
  return docs.map((doc) => ({ ...doc, id: doc._id?.toString() }));
}

export async function listRelationshipsByDashboard(dashboardId) {
  if (!dashboardId) return [];
  const rows = await collection().find({ dashboardId: new ObjectId(dashboardId) }).toArray();
  return rows.map((row) => ({
    id: row._id.toString(),
    fromTableKey: row.fromTableKey,
    fromFieldKey: row.fromFieldKey,
    toTableKey: row.toTableKey,
    toFieldKey: row.toFieldKey,
    type: row.type,
  }));
}

export async function deleteRelationshipsByDashboard(dashboardId) {
  if (!dashboardId) return;
  await collection().deleteMany({ dashboardId: new ObjectId(dashboardId) });
}
