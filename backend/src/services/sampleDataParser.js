import Papa from "papaparse";
import * as XLSX from "xlsx";

const MAX_SAMPLE_ROWS = 50;
const MAX_SAMPLE_COLUMNS = 50;
const MAX_SHEETS = 5;
const PROMPT_SAMPLE_ROWS = 3;
const PROMPT_SAMPLE_COLUMNS = 12;
const MAX_VALUE_LENGTH = 160;

const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "text/plain"]);
const EXCEL_MIME_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

const sanitizeString = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (!str.length) return "";
  return str.length > MAX_VALUE_LENGTH ? `${str.slice(0, MAX_VALUE_LENGTH - 1)}...` : str;
};

const isBooleanString = (value) => {
  if (typeof value !== "string") return false;
  const lower = value.trim().toLowerCase();
  return lower === "true" || lower === "false";
};

const isNumericString = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.length) return false;
  return !Number.isNaN(Number(trimmed));
};

const isDateString = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.length) return false;
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return false;
  // Require at least two date separators or ISO pattern to reduce false positives
  return /\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(trimmed);
};

const inferColumnType = (values = []) => {
  let hasNumber = false;
  let hasBoolean = false;
  let hasDate = false;
  let hasString = false;

  for (const raw of values) {
    if (raw === null || raw === undefined || raw === "") continue;
    if (typeof raw === "number") {
      hasNumber = true;
      continue;
    }
    if (typeof raw === "boolean") {
      hasBoolean = true;
      continue;
    }
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      hasDate = true;
      continue;
    }
    if (typeof raw === "string") {
      if (isNumericString(raw)) {
        hasNumber = true;
        continue;
      }
      if (isBooleanString(raw)) {
        hasBoolean = true;
        continue;
      }
      if (isDateString(raw)) {
        hasDate = true;
        continue;
      }
      hasString = true;
      continue;
    }
    if (typeof raw === "object") {
      // JSON column, treat as string
      hasString = true;
      continue;
    }
  }

  const detected = [hasNumber, hasBoolean, hasDate, hasString].filter(Boolean).length;
  if (!detected) return "string";
  if (detected > 1 && !hasString) return "mixed";
  if (detected > 1) return "mixed";
  if (hasNumber) return "number";
  if (hasBoolean) return "boolean";
  if (hasDate) return "date";
  return "string";
};

const normalizeRow = (row = {}) => {
  const entries = Object.entries(row)
    .filter(([key]) => key !== undefined && key !== null && key !== "__EMPTY" && key !== "__rowNum__")
    .slice(0, MAX_SAMPLE_COLUMNS);
  const normalized = {};
  for (const [key, value] of entries) {
    if (value === null || value === undefined) {
      normalized[key] = "";
      continue;
    }
    if (value instanceof Date) {
      normalized[key] = value.toISOString();
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      normalized[key] = value;
      continue;
    }
    if (typeof value === "object") {
      try {
        const json = JSON.stringify(value);
        normalized[key] = sanitizeString(json);
      } catch {
        normalized[key] = sanitizeString(String(value));
      }
      continue;
    }
    normalized[key] = sanitizeString(value);
  }
  return normalized;
};

const normalizeColumns = (rows = []) => {
  const columnNames = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => {
        if (key) set.add(key);
      });
      return set;
    }, new Set()),
  ).slice(0, MAX_SAMPLE_COLUMNS);

  return columnNames.map((name) => {
    const values = rows.slice(0, MAX_SAMPLE_ROWS * 2).map((row) => row?.[name]);
    return {
      name,
      inferredType: inferColumnType(values),
    };
  });
};

const parseCsvBuffer = (buffer) => {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header?.trim() || header,
  });
  if (parsed.errors?.length) {
    const firstError = parsed.errors[0];
    throw new Error(firstError.message || "Unable to parse CSV file");
  }
  const rows = Array.isArray(parsed.data) ? parsed.data.filter((row) => Object.keys(row || {}).length > 0) : [];
  const sampleRows = rows.slice(0, MAX_SAMPLE_ROWS).map((row) => normalizeRow(row));
  const columns = normalizeColumns(sampleRows.length ? sampleRows : rows);
  return {
    fileType: "csv",
    tables: [
      {
        name: "Sheet1",
        columns,
        numericFields: columns.filter((col) => col.inferredType === "number").map((col) => col.name),
        sampleRows,
        totalRows: rows.length,
        totalColumns: columns.length,
      },
    ],
    totalRows: rows.length,
    totalColumns: columns.length,
  };
};

const parseExcelBuffer = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames.slice(0, MAX_SHEETS);
  const tables = [];
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    const normalizedRows = rows.map((row) => normalizeRow(row));
    const sampleRows = normalizedRows.slice(0, MAX_SAMPLE_ROWS);
    const columns = normalizeColumns(sampleRows.length ? sampleRows : normalizedRows);
    tables.push({
      name: sheetName,
      columns,
      numericFields: columns.filter((col) => col.inferredType === "number").map((col) => col.name),
      sampleRows,
      totalRows: normalizedRows.length,
      totalColumns: columns.length,
    });
  }
  const totalRows = tables.reduce((sum, table) => sum + table.totalRows, 0);
  const totalColumns = tables.reduce((max, table) => Math.max(max, table.totalColumns), 0);
  return {
    fileType: "excel",
    tables,
    totalRows,
    totalColumns,
  };
};

const detectFileType = (file) => {
  const { mimetype = "", originalname = "" } = file || {};
  const lowerName = originalname.toLowerCase();
  if (CSV_MIME_TYPES.has(mimetype) || lowerName.endsWith(".csv")) {
    return "csv";
  }
  if (EXCEL_MIME_TYPES.has(mimetype) || /\.(xlsx|xls|xlsm|xlsb)$/i.test(lowerName)) {
    return "excel";
  }
  return null;
};

export const summarizeSamplePreview = (preview, options = {}) => {
  if (!preview || !Array.isArray(preview.tables) || !preview.tables.length) return "";
  const rowLimit = options.rowLimit || PROMPT_SAMPLE_ROWS;
  const columnLimit = options.columnLimit || PROMPT_SAMPLE_COLUMNS;
  return preview.tables
    .map((table) => {
      const columnSummary = (table.columns || [])
        .slice(0, columnLimit)
        .map((col) => `${col.name}:${col.inferredType}`)
        .join(", ");
      const sampleSummary = (table.sampleRows || [])
        .slice(0, rowLimit)
        .map((row, idx) => {
          const entries = Object.entries(row || {})
            .slice(0, columnLimit)
            .map(([key, value]) => `${key}=${value}`)
            .join(", ");
          return `Row ${idx + 1}: ${entries}`;
        })
        .join("\n");
      return `Table ${table.name || "Sample"} (rows~${table.totalRows || "?"})\nColumns: ${columnSummary}\n${sampleSummary}`;
    })
    .join("\n\n");
};

export const parseSampleDataFile = (file) => {
  if (!file || !file.buffer) return null;
  const type = detectFileType(file);
  if (!type) {
    throw new Error("Unsupported sample file type");
  }
  if (type === "csv") {
    const result = parseCsvBuffer(file.buffer);
    return {
      fileName: file.originalname || "sample.csv",
      ...result,
    };
  }
  if (type === "excel") {
    const result = parseExcelBuffer(file.buffer);
    return {
      fileName: file.originalname || "sample.xlsx",
      ...result,
    };
  }
  throw new Error("Unsupported sample file type");
};

export const normalizeSamplePreview = (raw) => {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const tables = Array.isArray(parsed.tables) ? parsed.tables : [];
  if (!tables.length) return null;
  return {
    fileName: parsed.fileName || "sample",
    fileType: parsed.fileType === "excel" || parsed.fileType === "csv" ? parsed.fileType : "csv",
    totalRows: parsed.totalRows || tables.reduce((sum, table) => sum + (table.totalRows || 0), 0),
    totalColumns: parsed.totalColumns || Math.max(...tables.map((table) => (table.columns || []).length), 0),
    tables: tables.map((table) => {
      const columns = Array.isArray(table.columns)
        ? table.columns.slice(0, MAX_SAMPLE_COLUMNS).map((col) => ({
            name: sanitizeString(col.name || col.key || col.id || "Column"),
            inferredType: col.inferredType || col.type || "string",
          }))
        : [];
      const rows = Array.isArray(table.sampleRows)
        ? table.sampleRows.slice(0, MAX_SAMPLE_ROWS).map((row) => normalizeRow(row))
        : [];
      return {
        name: sanitizeString(table.name || table.title || "Sample"),
        columns,
        numericFields: columns.filter((col) => col.inferredType === "number").map((col) => col.name),
        sampleRows: rows,
        totalRows: table.totalRows || rows.length,
        totalColumns: columns.length,
      };
    }),
  };
};
