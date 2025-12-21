import { randomUUID } from "crypto";
import { HttpError } from "../utils/httpError.js";
import { findDashboardById } from "../repositories/dashboardRepository.js";
import { DashboardTableModel } from "../models/dashboardTableModel.js";
import { migrateFieldRenames } from "../utils/schemaMigration.js";
import { mongoose } from "../mongoose.js";
import { SYSTEM_FIELDS, isSystemField } from "../../../shared/systemFields.js";
import { canEditDashboard, canViewDashboard } from "../utils/dashboardAuth.js";

const FIELD_TYPES = new Set(["string", "number", "boolean", "date", "enum", "reference", "id"]);
const RESERVED_KEYS = new Set(["_id", "created_at", "updated_at", ...SYSTEM_FIELDS]);

const parseOwner = (req) => ({
  sessionId: req.body.sessionId || req.query.sessionId || null,
  userId: req.user?.id || req.body.userId || req.query.userId || null,
});

const normalizeKey = (key = "") => key.toString().trim();

const normalizeField = (field) => {
  const key = normalizeKey(field.key || field.fieldKey || field.name || field.id || "");
  const label = field.label || field.displayName || field.name || field.fieldName || key;
  const type = (field.type || "").toString().toLowerCase() || "string";
  const visible = field.visibleInTable !== undefined ? field.visibleInTable : field.visible;
  return {
    id: field.id || field.fieldId || field._id?.toString?.() || randomUUID(),
    key,
    label,
    type,
    required: Boolean(field.required),
    visibleInTable: visible !== false,
    options: Array.isArray(field.options) ? field.options.filter(Boolean) : undefined,
    referenceTable: field.referenceTable || field.referenceTableKey || field.ref || field.references?.tableKey,
    displayField: field.displayField || field.referenceLabelField,
    system: field.system === true || field.systemField === true,
    systemField: field.systemField === true,
    previousKey: field.previousKey || field.originalKey || field.oldKey,
  };
};

const buildSystemFields = (existingSystemFields = []) => {
  if (existingSystemFields.length) return existingSystemFields;
  return [
    { key: "_id", type: "id", required: true, system: true, systemField: true },
    { key: "created_at", type: "date", required: true, system: true, systemField: true },
    { key: "updated_at", type: "date", required: true, system: true, systemField: true },
  ];
};

const validateFields = (fields) => {
  const seen = new Set();
  fields.forEach((field) => {
    const key = normalizeKey(field.key);
    const lower = key.toLowerCase();
    if (!key) throw new HttpError(400, "Each field requires a key");
    if (RESERVED_KEYS.has(lower)) throw new HttpError(400, `Field key ${key} is reserved`);
    if (seen.has(lower)) throw new HttpError(400, `Duplicate field key: ${key}`);
    seen.add(lower);
    if (!FIELD_TYPES.has(field.type)) throw new HttpError(400, `Unsupported field type: ${field.type}`);
    if (field.type === "enum") {
      if (!field.options || !field.options.length) throw new HttpError(400, `Enum field ${key} requires options`);
    }
    if (field.type === "reference") {
      if (!field.referenceTable || !field.displayField) {
        throw new HttpError(400, `Reference field ${key} requires referenceTable and displayField`);
      }
    }
  });
};

export async function getTableSchema(req, res) {
  const owner = parseOwner(req);
  const { dashboardId, tableKey } = req.params;
  if (!dashboardId || !tableKey) {
    throw new HttpError(400, "dashboardId and tableKey are required");
  }
  if (!mongoose.Types.ObjectId.isValid(dashboardId)) {
    throw new HttpError(400, "Invalid dashboardId");
  }
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    throw new HttpError(404, "Dashboard not found");
  }
  if (!canViewDashboard(dashboard, owner.userId)) {
    throw new HttpError(403, "Forbidden");
  }
  const tableFilter = {
    dashboardId: new mongoose.Types.ObjectId(dashboardId),
    $or: [{ key: tableKey }],
  };
  if (mongoose.Types.ObjectId.isValid(tableKey)) {
    tableFilter.$or.push({ _id: new mongoose.Types.ObjectId(tableKey) });
  }
  const table = await DashboardTableModel.findOne(tableFilter).lean();
  if (!table) {
    throw new HttpError(404, "Table not found");
  }
  res.json({
    table: { key: table.key, name: table.name, description: table.description },
    fields: table.fields || [],
  });
}

export async function updateTableSchema(req, res) {
  const owner = parseOwner(req);
  const { dashboardId, tableKey } = req.params;
  if (!dashboardId || !tableKey) throw new HttpError(400, "dashboardId and tableKey are required");
  if (!owner.userId) throw new HttpError(400, "userId required");
  if (!mongoose.Types.ObjectId.isValid(dashboardId)) throw new HttpError(400, "Invalid dashboardId");
  const incomingFields = Array.isArray(req.body?.fields) ? req.body.fields : [];
  if (!incomingFields.length) throw new HttpError(400, "fields array is required");

  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) throw new HttpError(404, "Dashboard not found");
  if (!canEditDashboard(dashboard, owner.userId)) {
    throw new HttpError(403, "Forbidden");
  }

  const tableFilter = {
    dashboardId: new mongoose.Types.ObjectId(dashboardId),
    $or: [{ key: tableKey }],
  };
  if (mongoose.Types.ObjectId.isValid(tableKey)) {
    tableFilter.$or.push({ _id: new mongoose.Types.ObjectId(tableKey) });
  }
  const table = await DashboardTableModel.findOne(tableFilter);
  if (!table) throw new HttpError(404, "Table not found");

  const existingFields = Array.isArray(table.fields) ? table.fields : [];
  const existingSystemFields = existingFields.filter(
    (f) => isSystemField(f) || f.system === true || f.systemField === true || SYSTEM_FIELDS.includes(f.key),
  );
  const normalizedIncoming = incomingFields
    .map((f) => normalizeField(f))
    .filter((f) => f.key && !isSystemField(f) && f.system !== true && f.systemField !== true);

  validateFields(normalizedIncoming);

  const systemFields = buildSystemFields(existingSystemFields).map((f) => ({
    ...f,
    id: f.id || randomUUID(),
    system: true,
    systemField: true,
  }));

  const existingById = new Map();
  const existingByKey = new Map();
  existingFields.forEach((f) => {
    if (f.id) existingById.set(f.id, f);
    if (f.key) existingByKey.set(f.key, f);
  });

  const renames = [];
  const nextFields = normalizedIncoming.map((field) => {
    const matchById = field.id ? existingById.get(field.id) : null;
    const matchByKey = existingByKey.get(field.key) || (field.previousKey ? existingByKey.get(field.previousKey) : null);
    const existing = matchById || matchByKey;
    const previousKey = field.previousKey || existing?.key;
    if (existing && previousKey && previousKey !== field.key) {
      renames.push({ from: previousKey, to: field.key });
    }
    return {
      ...(existing || {}),
      ...field,
      id: field.id || existing?.id || randomUUID(),
      system: false,
      systemField: false,
    };
  });

  table.fields = [...systemFields, ...nextFields];
  await table.save();

  if (renames.length) {
    await migrateFieldRenames({ dashboardId, tableKey, renames });
  }

  res.json({
    table: { key: table.key, name: table.name, description: table.description },
    fields: table.fields,
  });
}
