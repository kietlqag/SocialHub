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
  const normalizeField = (field = {}) => {
    const key = (field.key || field.name || field.id || "").toString();
    const baseType = (field.type || field.fieldType || "").toString().toLowerCase();
    const options = field.options || field.enumValues || field.enum || field.choices;
    const hasEnum = Array.isArray(options) && options.length > 0;
    const looksLikeEnumKey = /status|state|category|type/i.test(key);
    const normalizedType = hasEnum
      ? "enum"
      : baseType || (looksLikeEnumKey ? "enum" : "string");
    return {
      ...field,
      key,
      type: normalizedType,
      enumValues: hasEnum ? options : field.enumValues,
      options: hasEnum ? options : field.options,
    };
  };
  return rows.map((row) => ({
    id: row._id.toString(),
    key: row.key,
    name: row.name,
    description: row.description || "",
    fields: Array.isArray(row.fields) ? row.fields.map((f) => normalizeField(f)) : [],
  }));
}

export async function deleteTablesByDashboard(dashboardId) {
  if (!dashboardId) return;
  await collection().deleteMany({ dashboardId: new ObjectId(dashboardId) });
}
