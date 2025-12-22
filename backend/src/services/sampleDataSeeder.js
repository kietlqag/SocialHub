import { insertRecord, updateRecordById, countRecordsByDashboard } from "../repositories/dashboardRecordRepository.js";
import { SYSTEM_FIELDS } from "../../../shared/systemFields.js";

const SYSTEM_FIELD_LOOKUP = new Set(SYSTEM_FIELDS.map((key) => key.toLowerCase()));

const normalizeKey = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const isIdColumn = (key = "") => {
  const normalized = key.trim().toLowerCase();
  if (!normalized.length) return false;
  if (normalized === "id") return true;
  return normalized.endsWith("id");
};

const isSystemFieldKey = (key = "") => {
  if (!key) return false;
  const normalized = key.toString().trim().toLowerCase();
  return SYSTEM_FIELD_LOOKUP.has(normalized);
};

const buildRowLookup = (row = {}) => {
  const lookup = new Map();
  Object.keys(row || {}).forEach((key) => {
    const normalized = normalizeKey(key);
    if (normalized) lookup.set(normalized, key);
  });
  return lookup;
};

const pickRowValue = (row = {}, lookup = new Map(), candidates = []) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      return row[candidate];
    }
    const normalized = normalizeKey(candidate);
    const matchKey = normalized ? lookup.get(normalized) : null;
    if (matchKey && Object.prototype.hasOwnProperty.call(row, matchKey)) {
      return row[matchKey];
    }
  }
  return undefined;
};

const buildRecordFromRow = (table, row) => {
  if (!row || typeof row !== "object") return {};
  const base = { ...row };
  const lookup = buildRowLookup(row);
  const fields = Array.isArray(table?.fields) ? table.fields : [];

  fields.forEach((field) => {
    if (!field || !field.key) return;
    if (field.systemField || isSystemFieldKey(field.key)) return;
    const candidates = [
      field.key,
      field.fieldName,
      field.name,
      field.label,
      field.displayField,
      field.originalKey,
    ]
      .concat(
        typeof field.key === "string"
          ? [field.key.replace(/_/g, " "), field.key.replace(/_/g, "").toLowerCase()]
          : [],
      )
      .filter(Boolean);
    const value = pickRowValue(row, lookup, candidates);
    if (value !== undefined) {
      base[field.key] = value;
    }
  });

  SYSTEM_FIELDS.forEach((systemKey) => {
    delete base[systemKey];
    delete base[systemKey.toLowerCase()];
  });

  delete base.createdAt;
  delete base.updatedAt;

  return base;
};

const getPreviewRows = (preview) => {
  if (!preview) return [];
  if (Array.isArray(preview.rowsPreview) && preview.rowsPreview.length) return preview.rowsPreview;
  if (Array.isArray(preview.sampleRows) && preview.sampleRows.length) return preview.sampleRows;
  return [];
};

const detectIdColumn = (rows = []) => {
  const firstRow = rows.find((row) => row && typeof row === "object");
  if (!firstRow) return null;
  const keys = Object.keys(firstRow);
  return keys.find((key) => isIdColumn(key)) || null;
};

const buildPreviewIndex = (previewTables = []) => {
  return previewTables.map((table, index) => ({
    index,
    table,
    normalizedName: normalizeKey(table?.name || table?.title || ""),
    normalizedColumns: Array.from(
      new Set(
        getPreviewRows(table)
          .flatMap((row) => Object.keys(row || {}))
          .map((key) => normalizeKey(key))
          .filter(Boolean),
      ),
    ),
  }));
};

const matchPreviewForTable = (table, previewIndex, assigned = new Set()) => {
  const normalizedTableKey = normalizeKey(table?.key || "");
  const normalizedTableName = normalizeKey(table?.name || "");

  let match = previewIndex.find(
    (entry) =>
      !assigned.has(entry.index) &&
      entry.normalizedName &&
      (entry.normalizedName === normalizedTableKey || entry.normalizedName === normalizedTableName),
  );

  if (match) return match;

  const fieldKeys = Array.isArray(table?.fields)
    ? table.fields
        .map((field) => normalizeKey(field?.key || field?.name || field?.fieldName || ""))
        .filter(Boolean)
    : [];

  let bestScore = 0;
  previewIndex.forEach((entry) => {
    if (assigned.has(entry.index)) return;
    if (!entry.normalizedColumns.length || !fieldKeys.length) return;
    const score = fieldKeys.reduce((count, key) => (entry.normalizedColumns.includes(key) ? count + 1 : count), 0);
    if (score > bestScore) {
      bestScore = score;
      match = entry;
    }
  });

  if (match) return match;

  return previewIndex.find((entry) => !assigned.has(entry.index)) || null;
};

const collectReferenceFields = (table) => {
  if (!table || !Array.isArray(table.fields)) return [];
  return table.fields.filter((field) => {
    if (!field || !field.key) return false;
    const type = (field.type || field.fieldType || "").toString().toLowerCase();
    if (type === "reference" || type === "ref") return true;
    if (field.referenceTableKey || field.reference || field.ref) return true;
    return false;
  });
};

const inferTableFromForeignKey = (key = "") => {
  const lower = key.toString().toLowerCase();
  if (!lower.endsWith("_id")) return null;
  const base = lower.replace(/_id$/, "");
  if (!base.length) return null;
  if (base.endsWith("y")) return `${base.slice(0, -1)}ies`;
  if (!base.endsWith("s")) return `${base}s`;
  return base;
};

const resolveReferenceTableKey = (field, idColumnLookup) => {
  const explicit =
    field.referenceTableKey ||
    field.referenceTable ||
    field.ref ||
    (field.reference && (field.reference.tableKey || field.reference.table));
  if (explicit) return explicit;

  const candidates = [field.key, field.fieldName, field.label, field.name, field.displayField].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = normalizeKey(candidate);
    if (normalized && idColumnLookup.has(normalized)) {
      return idColumnLookup.get(normalized);
    }
  }

  const inferred = inferTableFromForeignKey(field.key);
  if (inferred && idColumnLookup.has(inferred)) {
    return inferred;
  }
  return inferred;
};

const setIdMapping = (map, originalId, newId) => {
  if (!map || originalId === undefined || originalId === null || !newId) return;
  map.set(originalId, newId);
  if (typeof originalId === "number" || typeof originalId === "boolean") {
    map.set(originalId.toString(), newId);
  }
  if (typeof originalId === "string") {
    map.set(originalId.trim(), newId);
  }
};

export async function seedSampleDataForDashboard(dashboardId, tables = [], samplePreview = null) {
  if (!dashboardId || !Array.isArray(tables) || !tables.length) return;

  const existingCount = await countRecordsByDashboard({ dashboardId });
  if (existingCount > 0) {
    console.log("[seedSampleDataForDashboard] skip seeding; existing records detected", {
      dashboardId,
      existingCount,
    });
    return;
  }

  const previewTables = Array.isArray(samplePreview?.tables) ? samplePreview.tables : [];
  const previewIndex = buildPreviewIndex(previewTables);
  const assigned = new Set();
  const rowsByTableKey = new Map();
  const idColumnByTable = new Map();

  tables.forEach((table) => {
    const match = matchPreviewForTable(table, previewIndex, assigned);
    if (!match) {
      if (Array.isArray(table?.sampleRows) && table.sampleRows.length) {
        rowsByTableKey.set(table.key, table.sampleRows.slice(0, 50));
        const idColumn = detectIdColumn(table.sampleRows);
        if (idColumn) {
          idColumnByTable.set(table.key, idColumn);
        }
      }
      return;
    }
    assigned.add(match.index);
    const rows = getPreviewRows(match.table);
    if (!rows.length) {
      if (Array.isArray(table?.sampleRows) && table.sampleRows.length) {
        rowsByTableKey.set(table.key, table.sampleRows.slice(0, 50));
        const idColumn = detectIdColumn(table.sampleRows);
        if (idColumn) {
          idColumnByTable.set(table.key, idColumn);
        }
      }
      return;
    }
    rowsByTableKey.set(table.key, rows.slice(0, 50));
    const idColumn = detectIdColumn(rows);
    if (idColumn) {
      idColumnByTable.set(table.key, idColumn);
    }
  });

  if (!rowsByTableKey.size) return;

  const idColumnLookup = new Map();
  idColumnByTable.forEach((column, tableKey) => {
    const normalized = normalizeKey(column);
    if (normalized) {
      idColumnLookup.set(normalized, tableKey);
    }
  });

  const idMap = {};
  const insertedRecordsByTable = new Map();

  for (const table of tables) {
    const tableKey = table?.key;
    if (!tableKey) continue;
    const rows = rowsByTableKey.get(tableKey);
    if (!rows || !rows.length) continue;

    const idColumn = idColumnByTable.get(tableKey) || null;
    const map = idColumn ? new Map() : null;
    if (map) {
      idMap[tableKey] = map;
    }

    const insertedRows = [];
    insertedRecordsByTable.set(tableKey, insertedRows);

    for (const row of rows) {
      const recordData = buildRecordFromRow(table, row);
      if (!recordData || !Object.keys(recordData).length) continue;
      const created = await insertRecord({ dashboardId, tableKey, record: recordData });
      if (!created || !created.id) continue;
      insertedRows.push({ row, recordId: created.id });
      if (map && idColumn) {
        const originalId = row?.[idColumn];
        if (originalId !== undefined && originalId !== null) {
          setIdMapping(map, originalId, created.id);
        }
      }
    }

    if (map && map.size === 0) {
      delete idMap[tableKey];
    }
  }

  for (const table of tables) {
    const tableKey = table?.key;
    if (!tableKey) continue;
    const insertedRows = insertedRecordsByTable.get(tableKey);
    if (!insertedRows || !insertedRows.length) continue;
    const referenceFields = collectReferenceFields(table);
    if (!referenceFields.length) continue;

    for (const entry of insertedRows) {
      const { row, recordId } = entry;
      if (!row || !recordId) continue;
      const recordData = buildRecordFromRow(table, row);
      let touched = false;

      referenceFields.forEach((field) => {
        const fieldKey = field?.key;
        if (!fieldKey) return;
        const originalValue = recordData[fieldKey];
        if (originalValue === undefined || originalValue === null || originalValue === "" || originalValue === "--") {
          return;
        }
        const targetTableKey = resolveReferenceTableKey(field, idColumnLookup);
        if (!targetTableKey || !idMap[targetTableKey]) {
          const originalKey = `${fieldKey}_original`;
          if (!Object.prototype.hasOwnProperty.call(recordData, originalKey)) {
            recordData[originalKey] = originalValue;
          }
          recordData[fieldKey] = null;
          touched = true;
          return;
        }
        const lookup = idMap[targetTableKey];
        const mappedId = lookup.get(originalValue) || lookup.get(String(originalValue));
        if (mappedId) {
          const originalKey = `${fieldKey}_original`;
          if (!Object.prototype.hasOwnProperty.call(recordData, originalKey)) {
            recordData[originalKey] = originalValue;
          }
          recordData[fieldKey] = mappedId;
        } else {
          const originalKey = `${fieldKey}_original`;
          if (!Object.prototype.hasOwnProperty.call(recordData, originalKey)) {
            recordData[originalKey] = originalValue;
          }
          recordData[fieldKey] = null;
        }
        touched = true;
      });

      if (touched) {
        await updateRecordById({ dashboardId, tableKey, recordId, record: recordData });
      }
    }
  }

  console.log("[seedSampleDataForDashboard] idMap", {
    dashboardId,
    tables: Object.entries(idMap).map(([key, map]) => ({ tableKey: key, count: map.size })),
  });
}
