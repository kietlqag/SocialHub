import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";

const collection = () => getSocialhubDb().collection("dashboard_tables");

const SAMPLE_ROW_LIMIT = 50;
const SAMPLE_COLUMN_LIMIT = 50;
const SAMPLE_VALUE_LIMIT = 160;

const sanitizeSampleValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json.length > SAMPLE_VALUE_LIMIT ? `${json.slice(0, SAMPLE_VALUE_LIMIT - 3)}...` : json;
    } catch (err) {
      const str = String(value);
      return str.length > SAMPLE_VALUE_LIMIT ? `${str.slice(0, SAMPLE_VALUE_LIMIT - 3)}...` : str;
    }
  }
  const text = String(value);
  return text.length > SAMPLE_VALUE_LIMIT ? `${text.slice(0, SAMPLE_VALUE_LIMIT - 3)}...` : text;
};

const sanitizeSampleRows = (rows = []) => {
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.slice(0, SAMPLE_ROW_LIMIT).map((row) => {
    if (!row || typeof row !== "object") return {};
    const sanitized = {};
    Object.entries(row)
      .slice(0, SAMPLE_COLUMN_LIMIT)
      .forEach(([key, value]) => {
        if (!key) return;
        sanitized[key] = sanitizeSampleValue(value);
      });
    return sanitized;
  });
};

export async function insertTables(dashboardId, tables) {
  if (!dashboardId || !Array.isArray(tables) || !tables.length) return [];
  const docs = tables.map((table) => ({
    dashboardId: new ObjectId(dashboardId),
    key: table.key,
    name: table.name,
    description: table.description || "",
    fields: table.fields || [],
    sampleRows: sanitizeSampleRows(table.sampleRows),
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
    sampleRows: sanitizeSampleRows(row.sampleRows),
  }));
}

export async function deleteTablesByDashboard(dashboardId) {
  if (!dashboardId) return;
  await collection().deleteMany({ dashboardId: new ObjectId(dashboardId) });
}
