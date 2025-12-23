import { randomUUID } from "crypto";
import { HttpError } from "../utils/httpError.js";
import { findDashboardById } from "../repositories/dashboardRepository.js";
import { DashboardTableModel } from "../models/dashboardTableModel.js";
import { migrateFieldRenames } from "../utils/schemaMigration.js";
import { mongoose } from "../mongoose.js";
import { SYSTEM_FIELDS, isSystemField } from "../../../shared/systemFields.js";
import { canEditDashboard, canViewDashboard, isGlobalAdminUser } from "../utils/dashboardAuth.js";
import { listRelationshipsByDashboard } from "../repositories/dashboardRelationshipRepository.js";

const FIELD_TYPES = new Set(["string", "number", "boolean", "date", "enum", "reference", "id"]);
const SYSTEM_KEY_SET = new Set(["id", "_id", "created_at", "updated_at"]);
const RESERVED_KEYS = new Set(["_id", "created_at", "updated_at", ...SYSTEM_FIELDS]);

const parseOwner = (req) => ({
  sessionId: req.body.sessionId || req.query.sessionId || null,
  userId: req.user?.id || req.body.userId || req.query.userId || null,
});

const normalizeKey = (key = "") => key.toString().trim();

const hasAllowEditReferenceProp = (field = {}) => Object.prototype.hasOwnProperty.call(field, "allowEditReference");

const isReferenceLikeField = (field = {}) => {
  const semanticType = (field.semanticType || "").toString().toLowerCase();
  return semanticType === "reference" || field.ref != null;
};

const ensureAllowEditReferenceDefault = (field = {}) => {
  if (isReferenceLikeField(field) && field.allowEditReference === undefined) {
    return { ...field, allowEditReference: false };
  }
  return field;
};

const normalizeField = (field) => {
  const key = normalizeKey(field.key || field.fieldKey || field.name || field.id || "");
  const lowerKey = key.toLowerCase();
  const label = field.label || field.displayName || field.name || field.fieldName || key;
  const type = (field.type || "").toString().toLowerCase() || "string";
  const visible = field.visibleInTable !== undefined ? field.visibleInTable : field.visible;
  const hasAllowEditReference = hasAllowEditReferenceProp(field);
  const allowEditReference =
    hasAllowEditReference && field.allowEditReference !== undefined ? Boolean(field.allowEditReference) : undefined;
  const displayField = field.displayField || field.referenceLabelField;
  const displayTemplate = field.displayTemplate || field.referenceDisplayTemplate;
  const displayKey = field.displayKey || field.labelKey || field.referenceLabelKey;
  const requiredRaw = field.required ?? field.isRequired;
  const isSystemKey = SYSTEM_KEY_SET.has(lowerKey);
  return {
    id: field.id || field.fieldId || field._id?.toString?.() || randomUUID(),
    key,
    label,
    type,
    required: requiredRaw === undefined ? false : Boolean(requiredRaw),
    isRequired: requiredRaw === undefined ? false : Boolean(requiredRaw),
    visibleInTable: visible !== false,
    options: Array.isArray(field.options) ? field.options.filter(Boolean) : undefined,
    referenceTable: field.referenceTable || field.referenceTableKey || field.ref || field.references?.tableKey,
    displayField,
    displayTemplate,
    displayKey,
    labelKey: field.labelKey || field.referenceLabelKey || displayKey,
    system: isSystemKey,
    systemField: isSystemKey,
    previousKey: field.previousKey || field.originalKey || field.oldKey,
    ...(hasAllowEditReference ? { allowEditReference } : {}),
    ...(field.ref ? { ref: field.ref } : {}),
    ...(field.semanticType ? { semanticType: field.semanticType } : {}),
    ...(field.semanticRole ? { semanticRole: field.semanticRole } : {}),
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
    if (isReferenceLikeField(field)) {
      const refTable = field.referenceTable || field.referenceTableKey || field.ref;
      const displayKey = field.displayField || field.displayKey || field.labelKey;
      if (!refTable || !displayKey) {
        throw new HttpError(400, `Reference field ${key} requires ref table and displayField`);
      }
    }
  });
};

const normalizeLower = (value = "") => normalizeKey(value).toLowerCase();

const findReferenceDependencies = async ({ dashboardId, tableKey, tableId, removedKeys }) => {
  const normalizedRemoved = new Set(
    (removedKeys || [])
      .map((key) => normalizeLower(key))
      .filter((key) => key && !SYSTEM_KEY_SET.has(key)),
  );
  if (!normalizedRemoved.size) return [];

  const normalizedTableKey = normalizeLower(tableKey);
  const otherTables = await DashboardTableModel.find({
    dashboardId: new mongoose.Types.ObjectId(dashboardId),
    ...(tableId ? { _id: { $ne: tableId } } : {}),
  }).lean();

  const dependencies = [];
  otherTables.forEach((tbl) => {
    const fields = Array.isArray(tbl?.fields) ? tbl.fields : [];
    fields.forEach((field) => {
      const refTarget = normalizeLower(
        field.referenceTable || field.referenceTableKey || field.ref || field?.references?.tableKey,
      );
      const type = (field.type || field.fieldType || "").toString().toLowerCase();
      const semanticType = (field.semanticType || "").toString().toLowerCase();
      const isReferenceField = type === "reference" || semanticType === "reference" || Boolean(refTarget);
      if (!isReferenceField) return;
      if (!refTarget || refTarget !== normalizedTableKey) return;

      const candidatePairs = [
        field.displayField,
        field.displayKey,
        field.labelKey,
        field?.references?.fieldKey,
        field?.references?.field,
      ];
      const match = candidatePairs
        .map((key) => ({ raw: key, normalized: normalizeLower(key) }))
        .find((entry) => entry.normalized && normalizedRemoved.has(entry.normalized));
      if (match) {
        dependencies.push({
          targetField: match.raw || match.normalized,
          sourceTable: tbl.name || tbl.key || tbl._id?.toString?.(),
          sourceField: field.key || field.name || field.id,
        });
      }
    });
  });

  const relationships = await listRelationshipsByDashboard(dashboardId);
  relationships.forEach((rel) => {
    const targetTable = normalizeLower(rel.toTableKey);
    const targetField = normalizeLower(rel.toFieldKey);
    if (!targetField || !targetTable) return;
    if (targetTable !== normalizedTableKey) return;
    if (!normalizedRemoved.has(targetField)) return;
    dependencies.push({
      targetField: rel.toFieldKey || rel.toField,
      sourceTable: rel.fromTableKey || rel.fromTable || "unknown",
      sourceField: rel.fromFieldKey || rel.fromField || null,
    });
  });

  return dependencies;
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
  const isGlobalAdmin = isGlobalAdminUser(req.user);
  if (!canViewDashboard(dashboard, owner.userId, { isGlobalAdmin })) {
    return res.status(403).json({ message: "Forbidden" });
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
  const fieldsWithAllowEdit = (table.fields || []).map((f) => ensureAllowEditReferenceDefault(f));
  res.json({
    table: { key: table.key, name: table.name, description: table.description },
    fields: fieldsWithAllowEdit,
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
  console.log(
    "[updateTableSchema] incoming allowEditReference flags",
    incomingFields.map((f) => ({
      key: f?.key || f?.id,
      allowEditReference: f?.allowEditReference,
      system: f?.system === true || f?.systemField === true,
    })),
  );
  console.log(
    "[updateTableSchema] incoming required flags",
    incomingFields.map((f) => ({
      key: f?.key || f?.id,
      required: f?.required,
      isRequired: f?.isRequired,
    })),
  );

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

  const existingFields = Array.isArray(table.fields)
    ? table.fields.map((f) => ensureAllowEditReferenceDefault(typeof f?.toObject === "function" ? f.toObject() : f))
    : [];
  const existingSystemFields = existingFields.filter((f) => SYSTEM_KEY_SET.has(String(f.key || "").toLowerCase()));
  const normalizedIncomingAll = incomingFields.map((f) => ensureAllowEditReferenceDefault(normalizeField(f)));
  const normalizedIncoming = normalizedIncomingAll.filter(
    (f) => f.key && !SYSTEM_KEY_SET.has(String(f.key || "").toLowerCase()),
  );

  validateFields(normalizedIncoming);

  const incomingKeySet = new Set(normalizedIncoming.map((f) => normalizeLower(f.key)).filter(Boolean));
  const existingKeyMap = new Map();
  const removedKeys = [];
  existingFields.forEach((f) => {
    const normalizedKey = normalizeLower(f.key);
    if (!normalizedKey || SYSTEM_KEY_SET.has(normalizedKey)) return;
    if (!existingKeyMap.has(normalizedKey)) {
      existingKeyMap.set(normalizedKey, f.key || normalizedKey);
    }
    if (!incomingKeySet.has(normalizedKey)) {
      removedKeys.push(normalizedKey);
    }
  });

  if (removedKeys.length) {
    const dependencies = await findReferenceDependencies({
      dashboardId,
      tableKey: table.key || tableKey,
      tableId: table._id,
      removedKeys,
    });
    if (dependencies.length) {
      const dep = dependencies[0];
      const targetKey = normalizeLower(dep.targetField || "") || removedKeys[0];
      const humanField = existingKeyMap.get(targetKey) || dep.targetField || targetKey;
      const sourceTable = dep.sourceTable || "another table";
      const sourceField = dep.sourceField ? `field "${dep.sourceField}"` : "a reference field";
      throw new HttpError(
        400,
        `Cannot delete field "${humanField}" because ${sourceField} in table "${sourceTable}" references it. Update or remove that reference first.`,
      );
    }
  }

  const incomingById = new Map();
  const incomingByKey = new Map();
  normalizedIncomingAll.forEach((f) => {
    if (f?.id) incomingById.set(f.id, f);
    if (f?.key) incomingByKey.set(f.key, f);
  });

  const baseSystemFields = buildSystemFields(existingSystemFields)
    .map((f) => ensureAllowEditReferenceDefault(f))
    .map((f) => ({
      ...f,
      id: f.id || randomUUID(),
      system: true,
      systemField: true,
    }));

  const systemFields = baseSystemFields.map((f) => {
    const incoming = (f.id && incomingById.get(f.id)) || incomingByKey.get(f.key);
    const next = { ...f };
    if (incoming && isReferenceLikeField(f)) {
      if (hasAllowEditReferenceProp(incoming)) {
        next.allowEditReference = Boolean(incoming.allowEditReference);
      }
      const incomingDisplayField = incoming.displayField || incoming.displayKey || incoming.labelKey;
      if (incomingDisplayField) {
        next.displayField = incomingDisplayField;
      }
      if (incoming.displayKey) {
        next.displayKey = incoming.displayKey;
      }
      if (incoming.labelKey) {
        next.labelKey = incoming.labelKey;
      }
      if (incoming.displayTemplate) {
        next.displayTemplate = incoming.displayTemplate;
      }
    }

    // lock down critical props for system fields
    next.key = f.key;
    next.type = f.type;
    next.ref = f.ref;
    next.semanticType = f.semanticType;
    next.semanticRole = f.semanticRole;
    return ensureAllowEditReferenceDefault(next);
  });

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
    const required = field.required !== undefined ? field.required : existing?.required;
    const isRequired = field.isRequired !== undefined ? field.isRequired : existing?.isRequired;
    const merged = {
      ...(existing || {}),
      ...field,
      id: field.id || existing?.id || randomUUID(),
      system: false,
      systemField: false,
      ...(required !== undefined ? { required: required === true } : {}),
      ...(isRequired !== undefined ? { isRequired: isRequired === true } : {}),
    };
    const isRefLikeExisting = existing && isReferenceLikeField(existing);
    if (isRefLikeExisting && hasAllowEditReferenceProp(field)) {
      merged.allowEditReference = Boolean(field.allowEditReference);
    } else if (!existing && hasAllowEditReferenceProp(field)) {
      merged.allowEditReference = Boolean(field.allowEditReference);
    }

    // lock down immutable reference-like props on existing fields
    if (isRefLikeExisting) {
      merged.key = existing.key;
      merged.type = existing.type;
      merged.ref = existing.ref;
      merged.semanticType = existing.semanticType;
      merged.semanticRole = existing.semanticRole;
    }
    return ensureAllowEditReferenceDefault(merged);
  });

  const updatedFields = [...systemFields, ...nextFields].map((f) => ensureAllowEditReferenceDefault(f));
  console.log(
    "[updateTableSchema] normalized required flags",
    updatedFields.map((f) => ({
      key: f?.key,
      required: f?.required,
      isRequired: f?.isRequired,
      system: f?.system,
      systemField: f?.systemField,
    })),
  );
  const updatedTable = await DashboardTableModel.findOneAndUpdate(
    tableFilter,
    { $set: { fields: updatedFields, updatedAt: new Date() } },
    { new: true },
  );
  const persistedAllowEditRefs = (updatedTable?.fields || updatedFields)
    .filter((f) => isReferenceLikeField(f))
    .map((f) => ({ key: f.key, allowEditReference: f.allowEditReference, system: f.system || f.systemField }));
  console.log("[updateTableSchema] persisted allowEditReference", persistedAllowEditRefs);

  if (renames.length) {
    await migrateFieldRenames({ dashboardId, tableKey, renames });
  }

  const tableToReturn = updatedTable || table;
  res.json({
    table: { key: tableToReturn.key, name: tableToReturn.name, description: tableToReturn.description },
    fields: (tableToReturn.fields || updatedFields).map((f) => ensureAllowEditReferenceDefault(f)),
  });
}
