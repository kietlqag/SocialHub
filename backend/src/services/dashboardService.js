import OpenAI from "openai";
import { randomUUID } from "crypto";
import { HttpError } from "../utils/httpError.js";
import {
  insertDashboard,
  listDashboardsForOwner,
  deleteDashboardForOwner,
  updateDashboardForOwner,
  findDashboardForOwner,
  findDashboardById,
  updateDashboardById,
} from "../repositories/dashboardRepository.js";
import {
  insertTables,
  listTablesByDashboard,
  deleteTablesByDashboard,
} from "../repositories/dashboardTableRepository.js";
import {
  insertRelationships,
  listRelationshipsByDashboard,
  deleteRelationshipsByDashboard,
} from "../repositories/dashboardRelationshipRepository.js";
import {
  insertRecord as insertDashboardRecord,
  listRecordsByDashboard,
  updateRecordById,
  deleteRecordById,
  countRecordsByFieldValue,
} from "../repositories/dashboardRecordRepository.js";
import { upsertHideOverride, listOverridesByDashboard } from "../repositories/dashboardWidgetOverrideRepository.js";
import { SYSTEM_FIELDS, isSystemField } from "../../../shared/systemFields.js";
import { findRecordById } from "../repositories/dashboardRecordRepository.js";
import { canEditDashboard, canViewDashboard } from "../utils/dashboardAuth.js";
import { createNotification as createNotificationRepo } from "../repositories/notificationRepository.js";
import { summarizeSamplePreview } from "./sampleDataParser.js";
import { seedSampleDataForDashboard } from "./sampleDataSeeder.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MIN_TABLES = 2;
const MAX_TABLES = 12;

const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const loadDashboardOrThrow = async (dashboardId) => {
  const dashboard = await findDashboardById(dashboardId);
  if (!dashboard) {
    throw new HttpError(404, "Dashboard not found");
  }
  return dashboard;
};

const assertCanViewDashboard = async (dashboardId, currentUserId) => {
  const dashboard = await loadDashboardOrThrow(dashboardId);
  if (!canViewDashboard(dashboard, currentUserId)) {
    throw new HttpError(403, "Forbidden");
  }
  return dashboard;
};

const assertCanEditDashboard = async (dashboardId, currentUserId) => {
  if (!currentUserId) {
    throw new HttpError(400, "userId required");
  }
  const dashboard = await loadDashboardOrThrow(dashboardId);
  if (!canEditDashboard(dashboard, currentUserId)) {
    throw new HttpError(403, "Forbidden");
  }
  return dashboard;
};

const requireOpenAI = () => {
  if (!openaiClient) {
    throw new HttpError(503, "AI provider not configured");
  }
  return openaiClient;
};

const SUPPORTED_TYPES = [
  "Text",
  "Number",
  "Currency",
  "Date",
  "Boolean",
  "Email",
  "URL",
  "Dropdown",
  "Multi-select",
  "Percentage",
];

const TABLE_LIBRARY = [
  {
    key: "customers",
    name: "Customers & Clients",
    description: "A 360° view of leads, accounts, and key contacts to nurture relationships.",
    purpose: "Track contact info, segment customers, and monitor lifetime value.",
    keywords: ["customer", "client", "account", "crm", "relationship"],
    actions: ["Add customer", "Segment customers", "Send onboarding kit"],
    kpis: [
      { label: "Active customers", value: "1,280", trend: "+8% MoM" },
      { label: "Avg. CLV", value: "$12,400", trend: "+3% vs last quarter" },
    ],
    recommendedWidgets: ["Customer growth trend", "Top accounts by revenue", "Retention risk by segment"],
    fields: [
      { fieldName: "Customer name", fieldType: "Text", description: "Primary contact or company name", sampleData: "Mai Pham", required: true },
      { fieldName: "Status", fieldType: "Dropdown", description: "Lifecycle stage in the journey", sampleData: "Active", required: true },
      { fieldName: "Segment", fieldType: "Dropdown", description: "Geography or industry bucket", sampleData: "APAC Mid-market", required: false },
      { fieldName: "Account owner", fieldType: "Text", description: "Internal teammate responsible", sampleData: "Hoa Nguyen", required: false },
      { fieldName: "Lifetime value", fieldType: "Currency", description: "Sum of historical revenue", sampleData: "$24,500", required: false },
      { fieldName: "Last engaged", fieldType: "Date", description: "Most recent touchpoint", sampleData: "2025-02-10", required: false },
    ],
  },
  {
    key: "orders",
    name: "Orders / Contracts",
    description: "Revenue events, contracts, or purchase orders that drive the business.",
    purpose: "Monitor deal progress, value, and fulfillment status across teams.",
    keywords: ["order", "contract", "deal", "revenue", "pipeline", "subscription"],
    actions: ["Create order", "Log milestone", "Update fulfillment"],
    kpis: [
      { label: "Open deals", value: "42", trend: "-2 vs last week" },
      { label: "Win rate", value: "38%", trend: "+4 pt QoQ" },
    ],
    recommendedWidgets: ["Revenue trend over time", "Orders by status", "Pipeline by owner"],
    fields: [
      { fieldName: "Order ID", fieldType: "Text", description: "Unique identifier for the order or contract", sampleData: "ORD-2025-098", required: true },
      { fieldName: "Customer", fieldType: "Text", description: "Linked customer name", sampleData: "Nova Logistics", required: true },
      { fieldName: "Status", fieldType: "Dropdown", description: "Current fulfillment status", sampleData: "Awaiting invoice", required: true },
      { fieldName: "Deal value", fieldType: "Currency", description: "Total value of the order", sampleData: "$48,000", required: true },
      { fieldName: "Created date", fieldType: "Date", description: "When the opportunity was opened", sampleData: "2025-01-22", required: false },
      { fieldName: "Owner", fieldType: "Text", description: "Sales rep or AE assigned", sampleData: "Tuan Do", required: false },
    ],
  },
  {
    key: "projects",
    name: "Projects / Campaigns",
    description: "Strategic initiatives such as launches, campaigns, or implementations.",
    purpose: "Track progress, deadlines, budgets, and cross-team involvement.",
    keywords: ["project", "campaign", "deadline", "initiative", "task", "launch"],
    actions: ["Add project", "Update milestone", "Share status report"],
    kpis: [
      { label: "Active projects", value: "11", trend: "+2 vs last sprint" },
      { label: "On-time rate", value: "87%", trend: "+5 pt QoQ" },
    ],
    recommendedWidgets: ["Project progress funnel", "Budget vs spend", "Task load by owner"],
    fields: [
      { fieldName: "Project name", fieldType: "Text", description: "Short identifier for the initiative", sampleData: "CRM Refresh", required: true },
      { fieldName: "Client", fieldType: "Text", description: "Customer or internal partner", sampleData: "Mercury Retail", required: false },
      { fieldName: "Stage", fieldType: "Dropdown", description: "Current phase of the project", sampleData: "In execution", required: true },
      { fieldName: "Budget", fieldType: "Currency", description: "Allocated budget", sampleData: "$180,000", required: false },
      { fieldName: "Deadline", fieldType: "Date", description: "Planned delivery date", sampleData: "2025-05-30", required: false },
      { fieldName: "Owner", fieldType: "Text", description: "Responsible team or person", sampleData: "Campaign Ops", required: false },
    ],
  },
  {
    key: "finance",
    name: "Finance / Revenue",
    description: "Financial performance, revenue recognition, and budgeting data.",
    purpose: "Surface monthly revenue, costs, gross margin, and cash health.",
    keywords: ["finance", "revenue", "profit", "budget", "cost", "expense"],
    actions: ["Add forecast", "Record expense", "Share summary"],
    kpis: [
      { label: "MTD revenue", value: "$1.2M", trend: "+11% vs last month" },
      { label: "Gross margin", value: "64%", trend: "+2 pt YoY" },
    ],
    recommendedWidgets: ["Revenue by region", "Expense breakout", "Cash runway"],
    fields: [
      { fieldName: "Period", fieldType: "Text", description: "Month or quarter label", sampleData: "Feb 2025", required: true },
      { fieldName: "Revenue", fieldType: "Currency", description: "Total revenue recognized", sampleData: "$1,240,000", required: true },
      { fieldName: "Expenses", fieldType: "Currency", description: "Total operating costs", sampleData: "$680,000", required: true },
      { fieldName: "Profit", fieldType: "Currency", description: "Revenue minus expenses", sampleData: "$560,000", required: false },
      { fieldName: "Forecast", fieldType: "Currency", description: "Expected revenue for the period", sampleData: "$1,300,000", required: false },
      { fieldName: "Cash runway", fieldType: "Number", description: "Months of runway left", sampleData: "10", required: false },
    ],
  },
  {
    key: "employees",
    name: "Employees / Team Members",
    description: "People data including roles, compensation, and capacity.",
    purpose: "Understand staffing, availability, and HR metrics.",
    keywords: ["employee", "team", "people", "hr", "talent", "org"],
    actions: ["Add team member", "Update role", "Log headcount change"],
    kpis: [
      { label: "Headcount", value: "68", trend: "+3 vs last quarter" },
      { label: "Avg. tenure", value: "3.4 yrs", trend: "+0.2 vs last year" },
    ],
    recommendedWidgets: ["Headcount by department", "Open roles vs hires", "Utilization heatmap"],
    fields: [
      { fieldName: "Name", fieldType: "Text", description: "Person or contractor name", sampleData: "Linh Trinh", required: true },
      { fieldName: "Role", fieldType: "Text", description: "Job title", sampleData: "Product Marketing Manager", required: true },
      { fieldName: "Department", fieldType: "Dropdown", description: "Org area", sampleData: "Marketing", required: false },
      { fieldName: "Status", fieldType: "Dropdown", description: "Employment status", sampleData: "Active", required: false },
      { fieldName: "Start date", fieldType: "Date", description: "Hire date", sampleData: "2023-07-01", required: false },
      { fieldName: "Monthly cost", fieldType: "Currency", description: "Compensation impact", sampleData: "$6,200", required: false },
    ],
  },
  {
    key: "inventory",
    name: "Inventory / Fulfillment",
    description: "Product, asset, or shipment stock health for logistics teams.",
    purpose: "Monitor stock, replenishment, and delivery timelines.",
    keywords: ["inventory", "stock", "logistics", "warehouse", "retail"],
    actions: ["Add inventory", "Mark delivered", "Create transfer"],
    kpis: [
      { label: "SKU health", value: "118", trend: "4 out of stock" },
      { label: "Fulfillment SLA", value: "97%", trend: "+1 pt MoM" },
    ],
    recommendedWidgets: ["Stock by warehouse", "Backorder alerts", "Shipments by status"],
    fields: [
      { fieldName: "SKU", fieldType: "Text", description: "Product or asset identifier", sampleData: "SKU-4872", required: true },
      { fieldName: "Warehouse", fieldType: "Dropdown", description: "Fulfillment location", sampleData: "Hanoi Fulfillment", required: true },
      { fieldName: "Quantity", fieldType: "Number", description: "Units available", sampleData: "320", required: true },
      { fieldName: "Status", fieldType: "Dropdown", description: "Stock state", sampleData: "Available", required: false },
      { fieldName: "Incoming", fieldType: "Number", description: "Units on order", sampleData: "120", required: false },
      { fieldName: "Last counted", fieldType: "Date", description: "Last inventory audit", sampleData: "2025-01-20", required: false },
    ],
  },
];

const normalizeNameKey = (value) =>
  (value || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const remapSampleRowsForTable = (previewTable, table) => {
  if (!previewTable || !Array.isArray(previewTable.sampleRows) || !previewTable.sampleRows.length) {
    return [];
  }
  if (!table || !Array.isArray(table.fields) || !table.fields.length) {
    return previewTable.sampleRows;
  }

  const columnByNormalized = new Map();
  if (Array.isArray(previewTable.columns)) {
    previewTable.columns.forEach((col) => {
      const normalized = normalizeNameKey(col?.name || col?.key || "");
      if (normalized) {
        columnByNormalized.set(normalized, col.name || col.key);
      }
    });
  }

  return previewTable.sampleRows.map((row) => {
    if (!row || typeof row !== "object") return {};
    const base = { ...row };
    table.fields.forEach((field) => {
      const fieldKey = field?.key?.toString();
      if (!fieldKey) return;
      const normalizedKey = normalizeNameKey(fieldKey);
      const fieldName = field?.name || field?.fieldName || field?.label || "";
      const normalizedName = normalizeNameKey(fieldName);
      const candidates = [fieldKey, fieldName, field?.fieldName, field?.label]
        .filter(Boolean)
        .map((value) => value.toString());

      let value;
      for (const candidate of candidates) {
        if (Object.prototype.hasOwnProperty.call(row, candidate)) {
          value = row[candidate];
          break;
        }
      }

      if (value === undefined && columnByNormalized.size) {
        const columnName = columnByNormalized.get(normalizedKey) || columnByNormalized.get(normalizedName);
        if (columnName && Object.prototype.hasOwnProperty.call(row, columnName)) {
          value = row[columnName];
        }
      }

      if (value === undefined) {
        const matchKey = Object.keys(row).find((key) => normalizeNameKey(key) === normalizedKey);
        if (matchKey) {
          value = row[matchKey];
        }
      }

      if (value !== undefined) {
        base[fieldKey] = value;
      }
    });
    return base;
  });
};

const TYPE_PROMPT_HINTS = {
  healthcare: {
    plan:
      "Focus on healthcare workflows: patients, appointments, providers, lab results, treatments, billing, and clinical metrics. Avoid e-commerce concepts such as orders, carts, products, SKUs, revenue, or inventory.",
    schema:
      "Generate medical data structures: patients, encounters, appointments, providers, departments, procedures, lab_results, medications. Use healthcare terminology (visit_count, wait_time, admission_rate, outcomes). Do not introduce e-commerce fields or widgets (orders, revenue, SKU, cart, product).",
  },
  education: {
    plan:
      "Focus on education workflows: students, courses, classes, instructors, enrollments, assessments, attendance. Avoid sales or e-commerce language.",
    schema:
      "Produce academic tables (students, courses, enrollments, grades, attendance). Favor metrics like completion_rate, engagement_time, GPA. Do not create commerce-specific fields.",
  },
  finance: {
    plan:
      "Center on financial reporting: transactions, accounts, budgets, cash flow, forecasts, profitability. Limit marketing or inventory language.",
    schema:
      "Return finance-oriented tables (transactions, accounts, forecasts, expenses, revenue). Emphasize financial KPIs (gross_margin, burn_rate, runway).",
  },
  saas: {
    plan:
      "Focus on SaaS analytics: users, subscriptions, activation, retention, product usage, feature adoption, churn. Avoid physical inventory or retail terms.",
    schema:
      "Generate SaaS data (users, subscriptions, sessions, feature_usage). Metrics should include activation_rate, retention, seat_expansion, churn, MRR.",
  },
  ecommerce: {
    plan:
      "Focus on e-commerce funnels: orders, customers, products, inventory, fulfillment, marketing performance.",
    schema:
      "Return commerce tables (orders, customers, products, inventory, shipments) with revenue-oriented metrics.",
  },
};

const buildSamplePreviewContext = (samplePreview) => {
  if (!samplePreview || !Array.isArray(samplePreview.tables) || !samplePreview.tables.length) {
    return null;
  }
  return summarizeSamplePreview(samplePreview, { rowLimit: 3, columnLimit: 10 });
};

const isReferenceLikeField = (field = {}) => {
  const semanticType = (field.semanticType || "").toString().toLowerCase();
  return semanticType === "reference" || field.ref != null;
};

const attachSampleRowsToTables = (tables = [], samplePreview) => {
  if (!Array.isArray(tables) || !tables.length) return tables;
  if (!samplePreview || !Array.isArray(samplePreview.tables) || !samplePreview.tables.length) {
    return tables;
  }

  const previewTables = samplePreview.tables.map((table, index) => ({
    index,
    normalizedName: normalizeNameKey(table.name),
    columns: Array.isArray(table.columns)
      ? table.columns.map((col) => normalizeNameKey(col.name)).filter(Boolean)
      : [],
    sampleRows: Array.isArray(table.sampleRows) ? table.sampleRows : [],
  }));

  const assigned = new Set();

  const findBestMatchIndex = (table) => {
    const normalizedTableName = normalizeNameKey(table.key || table.name);
    if (!normalizedTableName && !Array.isArray(table.fields)) return -1;

    // Exact name match on first pass
    const exactIndex = previewTables.findIndex(
      (preview) => !assigned.has(preview.index) && preview.normalizedName && preview.normalizedName === normalizedTableName,
    );
    if (exactIndex !== -1) return exactIndex;

    const tableFieldKeys = Array.isArray(table.fields)
      ? table.fields.map((field) => normalizeNameKey(field.key || field.name || field.fieldName)).filter(Boolean)
      : [];
    if (!tableFieldKeys.length) return -1;

    let bestIndex = -1;
    let bestScore = 0;
    previewTables.forEach((preview) => {
      if (assigned.has(preview.index)) return;
      if (!preview.columns.length) return;
      const overlap = tableFieldKeys.reduce(
        (count, key) => (preview.columns.includes(key) ? count + 1 : count),
        0,
      );
      if (overlap > bestScore) {
        bestScore = overlap;
        bestIndex = preview.index;
      }
    });

    return bestIndex;
  };

  return tables.map((table) => {
    const matchIndex = findBestMatchIndex(table);
    if (matchIndex === -1) return table;
    assigned.add(matchIndex);
    const preview = samplePreview.tables.find((t, idx) => idx === matchIndex);
    if (!preview || !Array.isArray(preview.sampleRows)) return table;
    return {
      ...table,
      sampleRows: remapSampleRowsForTable(preview, table),
    };
  });
};

const baseNameFromIdKey = (key = "") => {
  const normalized = normalizeNameKey(key);
  if (!normalized || !normalized.endsWith("id")) return "";
  return normalized.replace(/_?id$/i, "");
};

const SYSTEM_KEY_SET = new Set(["id", "_id"].map((k) => normalizeNameKey(k)));

const collectPrimaryKeyMeta = (tables = []) => {
  const meta = [];
  tables.forEach((table) => {
    const tableKey = table.key || table.id || table.name || "";
    const normalizedTable = normalizeNameKey(tableKey);
    const fields = Array.isArray(table.fields) ? table.fields : [];
    const idField =
      fields.find((f) => normalizeNameKey(f.key) === "id") ||
      fields.find((f) => normalizeNameKey(f.key).endsWith("id")) ||
      fields[0];
    const pkKey = idField?.key || "id";
    const pkValues = new Set();
    (Array.isArray(table.sampleRows) ? table.sampleRows : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const value = row[pkKey];
      if (value === undefined || value === null || value === "") return;
      pkValues.add(String(value));
    });
    meta.push({
      tableKey,
      normalizedTable,
      pkKey,
      normalizedPk: normalizeNameKey(pkKey),
      pkValues,
    });
  });
  return meta;
};

const DISPLAY_FIELD_PRIORITIES = ["name", "full_name", "fullname", "title", "code", "email", "phone"];
const NAME_FIRST_KEYS = ["first_name", "firstname"];
const NAME_LAST_KEYS = ["last_name", "lastname", "surname"];
const SYSTEM_FIELD_KEYS = new Set(["id", "_id", "created_at", "updated_at"]);
const STRING_LIKE_TYPES = new Set(["string", "text", "enum", "email", "phone", "varchar"]);

const getFieldKey = (field = {}) => (field.key || field.name || field.fieldName || field.id || "").toString();
const normalizeTableKey = (value = "") => value.toString().trim().toLowerCase();

const resolveDisplayConfigForTable = (table = {}) => {
  const fields = Array.isArray(table.fields) ? table.fields : [];
  const entryByLower = new Map();
  fields.forEach((field) => {
    const key = getFieldKey(field);
    if (!key) return;
    const lower = key.toLowerCase();
    if (!entryByLower.has(lower)) {
      entryByLower.set(lower, { key, field });
    }
  });

  const findEntry = (candidates = []) => candidates.map((token) => entryByLower.get(token)).find(Boolean);

  const firstEntry = findEntry(NAME_FIRST_KEYS);
  const lastEntry = findEntry(NAME_LAST_KEYS);
  if (firstEntry && lastEntry) {
    const template = `{{${firstEntry.key}}} {{${lastEntry.key}}}`;
    return {
      displayField: firstEntry.key,
      displayKey: firstEntry.key,
      labelKey: firstEntry.key,
      displayTemplate: template,
    };
  }

  const prioritized = findEntry(DISPLAY_FIELD_PRIORITIES);
  if (prioritized) {
    return {
      displayField: prioritized.key,
      displayKey: prioritized.key,
      labelKey: prioritized.key,
    };
  }

  const firstStringField = fields.find((field) => {
    const key = getFieldKey(field);
    if (!key) return false;
    const lower = key.toLowerCase();
    if (SYSTEM_FIELD_KEYS.has(lower)) return false;
    const type = (field.type || field.fieldType || field.dataType || "").toString().toLowerCase();
    if (!type) return true;
    if (STRING_LIKE_TYPES.has(type)) return true;
    if (type === "id") return false;
    if (["number", "boolean", "date", "datetime"].includes(type)) return false;
    return true;
  });
  if (firstStringField) {
    const key = getFieldKey(firstStringField);
    return {
      displayField: key,
      displayKey: key,
      labelKey: key,
    };
  }

  const fallbackIdEntry = findEntry(["id", "_id"]) || (fields.length ? { key: getFieldKey(fields[0]) } : null);
  const fallbackKey = fallbackIdEntry?.key || "id";
  return {
    displayField: fallbackKey,
    displayKey: fallbackKey,
    labelKey: fallbackKey,
  };
};

const buildRecordValueGetter = (record = {}) => {
  const lowerMap = new Map();
  Object.entries(record || {}).forEach(([key, value]) => {
    if (key) {
      const lower = key.toLowerCase();
      if (!lowerMap.has(key)) lowerMap.set(key, value);
      if (!lowerMap.has(lower)) lowerMap.set(lower, value);
    }
  });
  return (fieldKey) => {
    if (!fieldKey) return undefined;
    if (Object.prototype.hasOwnProperty.call(record, fieldKey)) {
      return record[fieldKey];
    }
    const lower = fieldKey.toLowerCase();
    return lowerMap.get(lower);
  };
};

const resolveDisplayValueForRecord = (record = {}, table = {}, config = {}) => {
  const getter = buildRecordValueGetter(record);
  const template = config.displayTemplate;
  if (template) {
    const rendered = template
      .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, token) => {
        const value = getter(token);
        return value === undefined || value === null ? "" : String(value);
      })
      .replace(/\s+/g, " ")
      .trim();
    if (rendered) return rendered;
  }

  const candidateKeys = [
    config.displayField,
    config.displayKey,
    config.labelKey,
    ...DISPLAY_FIELD_PRIORITIES,
    ...NAME_FIRST_KEYS,
    ...NAME_LAST_KEYS,
  ].filter(Boolean);

  for (const key of candidateKeys) {
    const value = getter(key);
    if (value !== undefined && value !== null && String(value).trim().length) {
      return String(value).trim();
    }
  }

  const fallbackConfig = resolveDisplayConfigForTable(table);
  const fallbackValue = getter(fallbackConfig.displayField);
  if (fallbackValue !== undefined && fallbackValue !== null && String(fallbackValue).trim().length) {
    return String(fallbackValue).trim();
  }

  const idValue = getter("id") ?? getter("_id");
  if (idValue !== undefined && idValue !== null) return String(idValue);
  return "";
};

const isReferenceFieldToTable = (field = {}, targetTableKey = "") => {
  const type = (field.type || field.fieldType || "").toString().toLowerCase();
  const semanticType = (field.semanticType || "").toString().toLowerCase();
  const refTarget =
    field.referenceTableKey ||
    field.referenceTable ||
    field.ref ||
    (field.references && (field.references.tableKey || field.references.table));
  const normalizedTarget = normalizeTableKey(targetTableKey);
  const normalizedRef = normalizeTableKey(refTarget);
  const isReferenceField = type === "reference" || semanticType === "reference" || Boolean(normalizedRef);
  if (!isReferenceField) return false;
  if (!normalizedRef) return false;
  return normalizedRef === normalizedTarget;
};

export async function findRecordReferences({ dashboardId, targetTableKey, targetId }) {
  if (!dashboardId || !targetTableKey || !targetId) return [];
  const tables = await listTablesByDashboard(dashboardId);
  const referenceFields = [];

  tables.forEach((table) => {
    const tableKey = table?.key || table?.id;
    if (!tableKey) return;
    const fields = Array.isArray(table.fields) ? table.fields : [];
    fields.forEach((field) => {
      const fieldKey = getFieldKey(field);
      if (!fieldKey) return;
      if (!isReferenceFieldToTable(field, targetTableKey)) return;
      referenceFields.push({ tableKey, fieldKey });
    });
  });

  if (!referenceFields.length) return [];

  const counts = await Promise.all(
    referenceFields.map(async ({ tableKey, fieldKey }) => {
      const count = await countRecordsByFieldValue({ dashboardId, tableKey, fieldKey, value: targetId });
      return { tableKey, fieldKey, count };
    }),
  );

  return counts.filter((entry) => entry.count > 0);
}

const inferForeignKeysFromSamples = (tables = []) => {
  if (!Array.isArray(tables) || !tables.length) return tables;

  const pkMeta = collectPrimaryKeyMeta(tables);
  const tableMetaByNorm = new Map(pkMeta.map((m) => [m.normalizedTable, m]));
  const tableByKey = new Map();
  const tableByLower = new Map();
  tables.forEach((table) => {
    const key = (table.key || table.id || table.name || "").toString();
    if (!key) return;
    tableByKey.set(key, table);
    tableByLower.set(key.toLowerCase(), table);
  });
  const resolveTableByKey = (key) => {
    if (!key) return null;
    return tableByKey.get(key) || tableByLower.get(String(key).toLowerCase()) || null;
  };

  const scoreCandidate = ({ patternHit, nameHit, overlapRatio, pkNameHit }) =>
    (nameHit ? 2 : 0) + (pkNameHit ? 1 : 0) + (overlapRatio || 0) * 3 + (patternHit ? 0.5 : 0);

  const pickTarget = (fieldKey, values) => {
    const normalizedKey = normalizeNameKey(fieldKey);
    const base = baseNameFromIdKey(fieldKey);
    const distinctValues = Array.from(values || []);
    let best = null;

    pkMeta.forEach((meta) => {
      const nameHit =
        (base && (meta.normalizedTable === base || meta.normalizedTable === `${base}s` || base === meta.normalizedTable.replace(/s$/, ""))) ||
        (base && meta.normalizedTable === `${base}es`);
      const patternHit = normalizedKey.endsWith("id");
      const pkNameHit = normalizedKey === meta.normalizedPk;

      let overlapRatio = 0;
      if (distinctValues.length) {
        const matches = distinctValues.filter((v) => meta.pkValues.has(v)).length;
        overlapRatio = matches / distinctValues.length;
      }

      // Do not infer just because of naming patterns; require meaningful signal.
      const qualifies = overlapRatio >= 0.8 || nameHit || pkNameHit;
      if (!qualifies) return;

      const score = scoreCandidate({ patternHit, nameHit, overlapRatio, pkNameHit });
      if (!best || score > best.score) {
        best = { meta, score };
      }
    });

    return best ? best.meta.tableKey : null;
  };

  return tables.map((table) => {
    const sampleRows = Array.isArray(table.sampleRows) ? table.sampleRows : [];
    const fields = Array.isArray(table.fields) ? table.fields : [];

    const enhancedFields = fields.map((field) => {
      const fieldKey = field.key || field.name || field.fieldName;
      const normalizedKey = normalizeNameKey(fieldKey);
      const isPrimaryId = normalizedKey === "id" || normalizedKey === "_id" || SYSTEM_KEY_SET.has(normalizedKey);
      const isTimestamp =
        normalizedKey === "created_at" ||
        normalizedKey === "updated_at" ||
        normalizedKey === "createdat" ||
        normalizedKey === "updatedat";

      if (!fieldKey) return field;
      if (isPrimaryId) {
        return {
          ...field,
          type: "id",
          semanticType: field.semanticType || "countable_entity",
          semanticRole: field.semanticRole || "entity_id",
          ref: null,
          referenceTable: undefined,
          referenceTableKey: undefined,
          system: true,
          systemField: true,
          allowEditReference: field.allowEditReference === undefined ? false : Boolean(field.allowEditReference),
        };
      }

      if (isTimestamp) {
        return {
          ...field,
          type: "date",
          semanticType: "timestamp",
          semanticRole: field.semanticRole,
          ref: null,
          referenceTable: undefined,
          referenceTableKey: undefined,
          system: true,
          systemField: true,
        };
      }

      if (isReferenceLikeField(field)) {
        const refKey =
          field.ref ||
          field.referenceTable ||
          field.referenceTableKey ||
          (field.references && (field.references.tableKey || field.references.table));
        const targetTable = resolveTableByKey(refKey);
        const displayConfig = targetTable ? resolveDisplayConfigForTable(targetTable) : null;
        const allowReference = field.allowEditReference === undefined ? false : Boolean(field.allowEditReference);
        const updated = {
          ...field,
          type: "id",
          semanticType: "reference",
          semanticRole: "foreign_id",
          ref: refKey || field.ref || null,
          referenceTable: field.referenceTable || refKey || field.referenceTableKey || null,
          allowEditReference: allowReference,
        };
        if (displayConfig) {
          updated.displayField = field.displayField || displayConfig.displayField;
          updated.displayKey = field.displayKey || displayConfig.displayKey;
          updated.labelKey = field.labelKey || displayConfig.labelKey;
          if (!field.displayTemplate && displayConfig.displayTemplate) {
            updated.displayTemplate = displayConfig.displayTemplate;
          }
        } else {
          const fallbackDisplay = field.displayField || field.displayKey || field.labelKey || "id";
          updated.displayField = fallbackDisplay;
          updated.displayKey = field.displayKey || fallbackDisplay;
          updated.labelKey = field.labelKey || fallbackDisplay;
        }
        return updated;
      }

      // Normalize old mistaken references/IDs that are not explicit references.
      const looksLikeIdName = normalizedKey.endsWith("id");
      const baseName = baseNameFromIdKey(fieldKey);
      const values = new Set();
      sampleRows.forEach((row) => {
        if (!row || typeof row !== "object") return;
        const value = row[fieldKey];
        if (value === undefined || value === null || value === "") return;
        values.add(String(value));
      });

      const sampleLooksCode = Array.from(values).some((v) => /[A-Za-z]/.test(v) || v.includes("-") || v.includes("_"));
      const mostlyNonNumeric = Array.from(values).some((v) => Number.isNaN(Number(v)));
      const preferString = sampleLooksCode || mostlyNonNumeric;

      if (!baseName) {
        // If it merely ends with ID but we have no base name, treat as generic, not reference.
        if (looksLikeIdName && !isReferenceLikeField(field)) {
          return {
            ...field,
            type: preferString ? "string" : field.type === "number" ? "number" : field.type || "string",
            semanticType:
              field.semanticType && field.semanticType !== "reference" && field.semanticType !== "foreign_id"
                ? field.semanticType
                : "generic",
            semanticRole: field.semanticRole && field.semanticRole !== "foreign_id" ? field.semanticRole : undefined,
            ref: null,
            referenceTable: null,
            referenceTableKey: null,
            allowEditReference: undefined,
          };
        }
        return field;
      }

      const targetTable = pickTarget(fieldKey, values);
      // Do not infer reference by name alone; require overlap or explicit metadata (targetTable) and skip if sample looks like codes.
      if (!targetTable || sampleLooksCode) {
        if (looksLikeIdName && !isReferenceLikeField(field)) {
          return {
            ...field,
            type: preferString ? "string" : field.type === "number" ? "number" : field.type || "string",
            semanticType:
              field.semanticType && field.semanticType !== "reference" && field.semanticType !== "foreign_id"
                ? field.semanticType
                : "generic",
            semanticRole: field.semanticRole && field.semanticRole !== "foreign_id" ? field.semanticRole : undefined,
            ref: null,
            referenceTable: null,
            referenceTableKey: null,
            allowEditReference: undefined,
          };
        }
        return field;
      }
      const targetTableDef = resolveTableByKey(targetTable) || resolveTableByKey(normalizeNameKey(targetTable));
      const displayConfig = resolveDisplayConfigForTable(targetTableDef || {});

      const assigned = {
        ...field,
        type: "id",
        semanticType: "reference",
        semanticRole: "foreign_id",
        ref: targetTable,
        referenceTable: field.referenceTable || targetTable,
        system: true,
        systemField: true,
        allowEditReference: field.allowEditReference === undefined ? false : Boolean(field.allowEditReference),
        displayField: field.displayField || displayConfig.displayField,
        displayKey: field.displayKey || displayConfig.displayKey,
        labelKey: field.labelKey || displayConfig.labelKey,
        ...(field.displayTemplate || displayConfig.displayTemplate
          ? { displayTemplate: field.displayTemplate || displayConfig.displayTemplate }
          : {}),
      };
      console.log("[inferFK] assign ref", { table: table.key || table.name, field: fieldKey, ref: targetTable });
      return assigned;
    });

    return { ...table, fields: enhancedFields };
  });
};

const makeFieldId = (tableKey, index) => `${tableKey}-${index}-${randomUUID().slice(0, 6)}`;

const buildTableFields = (tableKey, templateFields) =>
  templateFields.map((field, index) =>
    normalizeField(
      {
        ...field,
        id: field.id || makeFieldId(tableKey, index),
      },
      index,
    ),
  );

const buildTableBlueprint = (template) => ({
  id: `${template.key}-${randomUUID()}`,
  name: template.name,
  description: template.description,
  purpose: template.purpose,
  actions: template.actions,
  kpis: template.kpis,
  recommendedWidgets: template.recommendedWidgets,
  fields: buildTableFields(template.key, template.fields),
});

const FALLBACK_FIELDS = [
  {
    fieldName: "Customer Name",
    fieldType: "Text",
    description: "Full name of the customer",
    required: true,
  },
  {
    fieldName: "Email",
    fieldType: "Email",
    description: "Customer email address",
    required: true,
  },
  {
    fieldName: "Purchase Amount",
    fieldType: "Currency",
    description: "Total purchase amount",
    required: true,
  },
  {
    fieldName: "Purchase Date",
    fieldType: "Date",
    description: "Date of purchase",
    required: true,
  },
  {
    fieldName: "Status",
    fieldType: "Dropdown",
    description: "Order status",
    required: true,
  },
  {
    fieldName: "Customer Lifetime Value",
    fieldType: "Currency",
    description: "Total value of all customer purchases",
    required: false,
  },
  {
    fieldName: "Subscription Active",
    fieldType: "Boolean",
    description: "Whether customer has active subscription",
    required: false,
  },
  {
    fieldName: "Referral Source",
    fieldType: "Dropdown",
    description: "How customer found us",
    required: false,
  },
];

const inferRefTable = (key = "") => {
  if (!key.toLowerCase().endsWith("_id")) return null;
  const base = key.replace(/_id$/i, "");
  if (!base) return null;
  if (base.endsWith("y")) return `${base.slice(0, -1)}ies`;
  if (!base.endsWith("s")) return `${base}s`;
  return base;
};

const addField = (fields, field) => {
  if (fields.some((f) => f?.key === field.key)) return;
  fields.push(field);
};

const normalizeField = (field, index) => ({
  id: field.id || randomUUID(),
  fieldName: (field.fieldName || `Field ${index + 1}`).toString().slice(0, 80),
  fieldType: SUPPORTED_TYPES.includes(field.fieldType) ? field.fieldType : "Text",
  description: field.description?.toString().slice(0, 200) || "",
  sampleData: "",
  required: Boolean(field.required),
});

const escapeForJsx = (value = "") => value.replace(/[`"\\]/g, (char) => ({ "`": "\\`", '"': '\\"', "\\": "\\\\" }[char]));

const toDataKey = (label = "", index = 0) => {
  const cleaned = label
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!cleaned.length) return `field${index + 1}`;
  const [first, ...rest] = cleaned;
  return `${first}${rest.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join("")}`.slice(0, 60);
};

const buildWidgetSnippet = (field, dataKey) => {
  const descriptionLine = field.description
    ? `\n      <CardDescription>${escapeForJsx(field.description)}</CardDescription>`
    : "";
  const sampleValue = escapeForJsx(field.sampleData || "No data");
  return `<Card key="${field.id}" className="h-full">
      <CardHeader>
        <CardTitle>${escapeForJsx(field.fieldName)}</CardTitle>${descriptionLine}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{data?.${dataKey} ?? "${sampleValue}"}</p>
      </CardContent>
    </Card>`;
};

const indentSnippet = (snippet, spaces = 4) => {
  const pad = " ".repeat(spaces);
  return snippet
    .split("\n")
    .map((line) => (line.length ? `${pad}${line}` : line))
    .join("\n");
};

const buildTableSnippet = (table) => {
  const description = escapeForJsx(table.description || table.purpose || "");
  return `<Card key="${table.id}" className="h-full">
      <CardHeader>
        <CardTitle>${escapeForJsx(table.name)}</CardTitle>
        ${description ? `<CardDescription>${description}</CardDescription>` : ""}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">${description || "Structured data table to manage records."}</p>
      </CardContent>
    </Card>`;
};

const buildDashboardComponent = (tables, widgets) => {
  const widgetMarkup = widgets.length ? widgets.map((widget) => indentSnippet(widget.codeSnippet, 6)).join("\n\n") : "";
  const tableMarkup = tables.length ? tables.map((table) => indentSnippet(buildTableSnippet(table), 6)).join("\n\n") : "";
  if (!widgetMarkup && !tableMarkup) return "";
  const sections = [];
  if (widgetMarkup) {
    sections.push(`    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
${widgetMarkup}
    </div>`);
  }
  if (tableMarkup) {
    sections.push(`    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
${tableMarkup}
    </div>`);
  }
  return `import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

export function GeneratedDashboard({ data = {} }) {
  return (
    <div className="space-y-6">
${sections.join("\n\n")}
    </div>
  );
}`;
};

const buildRelationships = (tables = []) => {
  const rels = [];
  const find = (keyword) => tables.find((t) => t.name.toLowerCase().includes(keyword));
  const customers = find("customer");
  const orders = find("order") || find("contract");
  const projects = find("project") || find("campaign");
  const finance = find("finance") || find("revenue");
  if (customers && orders) {
    rels.push({
      fromTable: orders.name,
      toTable: customers.name,
      description: "Orders/Contracts reference Customers & Clients",
    });
  }
  if (orders && finance) {
    rels.push({
      fromTable: finance.name,
      toTable: orders.name,
      description: "Finance aggregates values from Orders/Contracts",
    });
  }
  if (projects && customers) {
    rels.push({
      fromTable: projects.name,
      toTable: customers.name,
      description: "Projects/Campaigns are linked to Customers & Clients",
    });
  }
  return rels;
};

const buildWidgetBlueprints = (fields) =>
  fields.map((field, index) => {
    const dataKey = toDataKey(field.fieldName, index);
    return {
      fieldId: field.id,
      title: field.fieldName,
      fieldType: field.fieldType,
      dataKey,
      description: field.description || "",
      codeSnippet: buildWidgetSnippet(field, dataKey),
    };
  });

const SAMPLE_ROW_LIMIT = 50;
const SAMPLE_COLUMN_LIMIT = 50;
const SAMPLE_VALUE_LIMIT = 160;

const sanitizeWidgets = (widgets = [], fields = []) => {
  if (!Array.isArray(widgets)) return [];
  const allowedIds = new Set(fields.map((f) => f.id));
  return widgets
    .filter((widget) => widget?.fieldId && allowedIds.has(widget.fieldId))
    .map((widget) => ({
      fieldId: widget.fieldId,
      title: widget.title?.toString().slice(0, 80) || "Widget",
      fieldType: SUPPORTED_TYPES.includes(widget.fieldType) ? widget.fieldType : "Text",
      dataKey: widget.dataKey?.toString().slice(0, 80) || "",
      description: widget.description?.toString().slice(0, 200) || "",
      codeSnippet: widget.codeSnippet?.toString() || "",
    }));
};

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
    const entries = Object.entries(row).slice(0, SAMPLE_COLUMN_LIMIT);
    const sanitized = {};
    entries.forEach(([key, value]) => {
      if (!key) return;
      sanitized[key] = sanitizeSampleValue(value);
    });
    return sanitized;
  });
};

const sanitizeTables = (tables = []) => {
  if (!Array.isArray(tables)) return [];
  const dropExtraIdFields = (fields = []) => {
    const hasSystemId = fields.some((f) => f?.key === "id" && f?.systemField);
    if (!hasSystemId) return fields;
    return fields.filter((f) => {
      if (!f) return false;
      if (f.systemField) return true;
      const type = (f.type || "").toString().toLowerCase();
      if (type === "id" && !f.ref && !f.referenceTableKey) {
        return false;
      }
      return true;
    });
  };
  return tables
    .map((table, tableIndex) => {
      const normalizedFields =
        Array.isArray(table.fields) && table.fields.length
          ? normalizeIdFields(dropExtraIdFields(table.fields.map((field, fieldIndex) => normalizeField(field, fieldIndex))))
          : normalizeIdFields(dropExtraIdFields(FALLBACK_FIELDS.map((field, index) => normalizeField(field, index))));
      return {
        id: table.id?.toString() || `table-${tableIndex}-${randomUUID()}`,
        name: table.name?.toString().slice(0, 120) || `Table ${tableIndex + 1}`,
        description: table.description?.toString().slice(0, 200) || "",
        purpose: table.purpose?.toString().slice(0, 200) || "",
        actions: Array.isArray(table.actions)
          ? table.actions.map((action) => action?.toString().slice(0, 120)).filter(Boolean)
          : [],
        kpis: Array.isArray(table.kpis)
          ? table.kpis
              .map((kpi) => ({
                label: kpi?.label?.toString().slice(0, 80) || "Metric",
                value: kpi?.value?.toString().slice(0, 40) || "N/A",
                trend: kpi?.trend?.toString().slice(0, 40) || "",
              }))
              .filter((kpi) => kpi.label && kpi.value)
          : [],
        recommendedWidgets: Array.isArray(table.recommendedWidgets)
          ? table.recommendedWidgets.map((widget) => widget?.toString().slice(0, 200)).filter(Boolean)
          : [],
        fields: normalizedFields,
            sampleRows: sanitizeSampleRows(table.sampleRows),
      };
    })
    .filter((table) => table.fields.length);
};

const normalizeIdFields = (fields = []) => {
  const normalized = [];
  const seen = new Set();
  fields.forEach((field) => {
    if (!field) return;
    const key = field.key === "_id" ? "id" : field.key;
    if (!key || seen.has(key)) return;
    normalized.push({ ...field, key });
    seen.add(key);
  });
  return normalized;
};

const ensureSystemFields = (fields = [], tableKey = "") => {
  const normalized = [];

  fields.forEach((field) => {
    if (!field || !field.key) return;
    let next = { ...field };
    const lowerKey = next.key.toString().toLowerCase();

    // Normalize primary id
    if (lowerKey === "id") {
      next = {
        ...next,
        key: "id",
        type: "id",
        required: true,
        systemField: true,
        semanticType: "countable_entity",
        semanticRole: "entity_id",
        options: null,
        ref: null,
        hidden: true,
      };
      addField(normalized, next);
      return;
    }

    // Normalize system timestamps
    if (lowerKey === "created_at" || lowerKey === "updated_at") {
      next = {
        ...next,
        type: "date",
        required: true,
        systemField: true,
        semanticType: "timestamp",
        semanticRole: lowerKey === "created_at" ? "system_created_at" : "system_updated_at",
        options: null,
        ref: null,
        hidden: true,
      };
      addField(normalized, next);
      return;
    }

    // Foreign keys: *_id (but skip self-referencing duplicates)
    if (lowerKey.endsWith("_id")) {
      const refTable = inferRefTable(lowerKey);
      if (refTable && refTable === tableKey) {
        // Drop duplicate self id like product_id in products table
        return;
      }
      next = {
        ...next,
        type: "id",
        semanticType: "reference",
        semanticRole: "foreign_id",
        ref: refTable || next.ref || null,
      };
      addField(normalized, next);
      return;
    }

    addField(normalized, next);
  });

  // Ensure required system fields exist and remain hidden
  const systemFields = [
    {
      key: "id",
      type: "id",
      required: true,
      systemField: true,
      semanticType: "countable_entity",
      semanticRole: "entity_id",
      options: null,
      ref: null,
      hidden: true,
    },
    {
      key: "created_at",
      type: "date",
      required: true,
      systemField: true,
      semanticType: "timestamp",
      semanticRole: "system_created_at",
      options: null,
      ref: null,
      hidden: true,
    },
    {
      key: "updated_at",
      type: "date",
      required: true,
      systemField: true,
      semanticType: "timestamp",
      semanticRole: "system_updated_at",
      options: null,
      ref: null,
      hidden: true,
    },
  ];

  systemFields.forEach((sf) => addField(normalized, sf));

  return normalizeIdFields(normalized);
};

const allowedFieldTypes = ["id", "string", "number", "boolean", "date", "enum", "reference", "text"];
const allowedSemanticTypes = [
  "money",
  "quantity",
  "countable_entity",
  "timestamp",
  "category",
  "status",
  "boolean",
  "generic",
  "reference",
];
const allowedSemanticRoles = [
  "transaction_value",
  "entity_id",
  "entity_name",
  "time_dimension",
  "group_dimension",
  "state",
  "generic",
  "foreign_id",
  "system_created_at",
  "system_updated_at",
];

const inferSemantic = (key = "", type = "") => {
  const lower = key.toLowerCase();
  if (lower.endsWith("_id") && lower !== "id") return { semanticType: "reference", semanticRole: "foreign_id" };
  if (lower === "_id" || lower === "id") return { semanticType: "countable_entity", semanticRole: "entity_id" };
  if (type === "date") return { semanticType: "timestamp", semanticRole: "time_dimension" };
  if (type === "boolean") return { semanticType: "boolean", semanticRole: "state" };
  if (type === "number") {
    if (lower.includes("amount") || lower.includes("total") || lower.includes("price") || lower.includes("cost") || lower.includes("revenue")) {
      return { semanticType: "money", semanticRole: "transaction_value" };
    }
    if (lower.includes("quantity") || lower.includes("qty") || lower.includes("count")) {
      return { semanticType: "quantity", semanticRole: "countable_entity" };
    }
  }
  if (lower.includes("status") || lower.includes("state")) return { semanticType: "status", semanticRole: "state" };
  if (lower.includes("type") || lower.includes("category")) return { semanticType: "category", semanticRole: "group_dimension" };
  if (lower.includes("name")) return { semanticType: "countable_entity", semanticRole: "entity_name" };
  return { semanticType: "generic", semanticRole: "generic" };
};

const nameIncludesAny = (value = "", tokens = []) => {
  const lower = value.toLowerCase();
  return tokens.some((t) => lower.includes(t));
};

const buildWidgetKey = (dashboardId, tableKey, valueField, aggregate) =>
  `${dashboardId || "dash"}:${tableKey || "table"}:${valueField || "value"}:${aggregate || "metric"}`;

const generateOverviewWidgetsFromSchema = (dashboardDescription = "", tables = [], dashboardId = "") => {
  const widgets = [];
  const usedIds = new Set();
  const makeId = (candidate) => {
    let base = candidate || `widget-${widgets.length + 1}`;
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);
    return id;
  };

  const numericTypeHints = ["number", "integer", "int", "float", "double", "decimal", "currency", "money", "amount", "numeric"];
  const monetaryHints = ["price", "amount", "cost", "total", "revenue", "income", "payment", "bill", "fee", "salary"];
  const quantityHints = ["qty", "quantity", "stock", "inventory", "units", "items", "orders"];
  const timeHints = ["duration", "time_spent", "waiting_time", "processing_time"];
  const statusTokens = ["pending", "completed", "cancelled", "overdue", "low_stock"];
  const descriptionWantsAvg = dashboardDescription.toLowerCase().includes("average") || dashboardDescription.toLowerCase().includes("avg");

  const prettify = (value = "") =>
    value
      .toString()
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isNumericField = (field, tableSampleRows = []) => {
    const type = (field.type || field.fieldType || "").toString().toLowerCase();
    if (numericTypeHints.includes(type)) return true;
    const key = field.key || field.name || field.fieldName;
    if (!key) return false;
    return tableSampleRows.some((row) => typeof row?.[key] === "number" && Number.isFinite(row[key]));
  };

  const scoreField = (name = "") => {
    const lower = name.toLowerCase();
    let score = 0;
    if (monetaryHints.some((h) => lower.includes(h))) score += 3;
    if (quantityHints.some((h) => lower.includes(h))) score += 2;
    if (timeHints.some((h) => lower.includes(h))) score += 1;
    return score;
  };

  const selectMetrics = [];

  tables.forEach((table) => {
    const fields = Array.isArray(table.fields) ? table.fields : [];
    const sampleRows = Array.isArray((table || {}).sampleRows) ? table.sampleRows : [];
    const tableKey = table.key || table.id || (table.name ? slugify(table.name) : `table-${selectMetrics.length + 1}`);

    fields.forEach((field) => {
      const fieldKey = field.key || field.name || field.fieldName;
      if (!fieldKey) return;
      if (!isNumericField(field, sampleRows)) return;
      const score = scoreField(fieldKey);
      if (score <= 0) return;

      const isMonetary = monetaryHints.some((h) => fieldKey.toLowerCase().includes(h));
      const isQuantity = quantityHints.some((h) => fieldKey.toLowerCase().includes(h));
      const isTime = timeHints.some((h) => fieldKey.toLowerCase().includes(h));

      // Always prefer sum for monetary/quantity/time totals
      selectMetrics.push({
        key: `${tableKey}-${fieldKey}-sum`,
        widgetKey: `${dashboardId || "dash"}:${tableKey}:${fieldKey}:sum`,
        label: `Total ${prettify(fieldKey)}`,
        table: tableKey,
        type: "sum",
        field: fieldKey,
        priority: isMonetary ? 3 : isQuantity ? 2 : isTime ? 1 : 0,
        description: `Sum of ${prettify(fieldKey)}`,
      });

      // Avg only when description asks or field suggests it (duration/time/avg naming)
      const wantsAvg =
        descriptionWantsAvg ||
        isTime ||
        fieldKey.toLowerCase().includes("avg") ||
        fieldKey.toLowerCase().includes("average");
      if (wantsAvg) {
        selectMetrics.push({
        key: `${tableKey}-${fieldKey}-avg`,
        widgetKey: `${dashboardId || "dash"}:${tableKey}:${fieldKey}:avg`,
        label: `Average ${prettify(fieldKey)}`,
        table: tableKey,
        type: "avg",
        field: fieldKey,
        priority: isMonetary ? 2 : isQuantity ? 1 : isTime ? 2 : 0,
          description: `Average of ${prettify(fieldKey)}`,
        });
      }
    });

    // Status-based conditional counts (allowed)
    fields
      .filter((f) => Array.isArray(f.enumValues) && f.enumValues.length)
      .forEach((f) => {
        const statuses = f.enumValues.filter((v) => statusTokens.some((t) => v.toLowerCase().includes(t))).slice(0, 2);
        statuses.forEach((stateVal, idx) => {
          selectMetrics.push({
            key: `${tableKey}-${f.key || f.name || "status"}-${idx}-count`,
            label: `${prettify(stateVal)} ${prettify(table.name || tableKey)}`,
            table: tableKey,
            type: "count_conditional",
            field: f.key || f.name || f.fieldName,
            filter: { [f.key || f.name || f.fieldName]: stateVal },
            priority: 1,
            description: `Count where ${prettify(f.key || f.name || "status")} = ${prettify(stateVal)}`,
          });
        });
      });
  });

  // Prioritize and cap to 8 widgets to keep overview clean
  const sorted = selectMetrics
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);

  sorted.forEach((metric) => {
    if (metric.type === "count_conditional") {
      widgets.push({
        id: metric.widgetKey || makeId(metric.key),
        title: metric.label,
        type: "metric",
        sourceTable: metric.table,
        aggregate: "count",
        valueField: metric.field,
        filter: metric.filter,
        description: metric.description,
        widgetKey: metric.widgetKey || metric.key,
        source: "auto",
      });
      return;
    }
    widgets.push({
      id: metric.widgetKey || makeId(metric.key),
      title: metric.label,
      type: "metric",
      sourceTable: metric.table,
      aggregate: metric.type === "avg" ? "avg" : "sum",
      valueField: metric.field,
      description: metric.description,
      widgetKey: metric.widgetKey || metric.key,
      source: "auto",
    });
  });

  return widgets;
};

const needsWidgetRegeneration = (widgets = [], tables = []) => {
  if (!Array.isArray(widgets) || widgets.length === 0) return true;
  // Regenerate if legacy count widgets dominate or any metric is not sum/avg/count_conditional with a valueField
  const invalidMetrics = widgets.some(
    (w) =>
      w?.type === "metric" &&
      !(
        (["sum", "avg", "count"].includes(w?.aggregate) && w?.valueField) ||
        (w?.aggregate === "count" && w?.filter)
      ),
  );
  if (invalidMetrics) return true;
  const countMetrics = widgets.filter((w) => w?.type === "metric" && w?.aggregate === "count");
  const allCountLike = countMetrics.length === widgets.length && widgets.length >= Math.max(1, tables.length);
  return allCountLike;
};

export async function listDashboardWidgets(dashboardId, { sessionId, userId }) {
  try {
    const dashboard = await assertCanViewDashboard(dashboardId, userId);
    const tables = await listTablesByDashboard(dashboardId);
    const overrides = await listOverridesByDashboard(dashboardId);
    const hiddenKeys = new Set(
      overrides.filter((o) => o.hidden && o.widgetKey).map((o) => o.widgetKey),
    );
    const autoWidgets = generateOverviewWidgetsFromSchema(dashboard.description || dashboard.name || "", tables, dashboardId).filter(
      (w) => !hiddenKeys.has(w.widgetKey),
    );
    const stored = Array.isArray(dashboard.widgets) ? dashboard.widgets : [];
    const manualWidgets = stored
      .filter((w) => w?.source === "manual" && !w?.hidden)
      .map((w) => ({
        ...w,
        widgetKey: w.widgetKey || buildWidgetKey(dashboardId, w.sourceTable, w.valueField, w.aggregate || "sum"),
      }));
    const manualKeys = new Set(manualWidgets.map((w) => w.widgetKey || w.id || w.title));
    const autoVisible = autoWidgets.filter((w) => !manualKeys.has(w.widgetKey));
    return [...autoVisible, ...manualWidgets].slice(0, 12);
  } catch (err) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logPath = path.resolve(process.cwd(), "widget-error.log");
      fs.appendFileSync(logPath, `${new Date().toISOString()} listDashboardWidgets ${dashboardId}: ${err?.stack || err}\n`);
    } catch (_) {
      // ignore logging errors
    }
    console.error("listDashboardWidgets error", err);
    throw err;
  }
}

export async function addManualWidget(dashboardId, { sessionId, userId }, payload) {
  const dashboard = await assertCanEditDashboard(dashboardId, userId);
  const owner = { sessionId, userId };
  const tables = await listTablesByDashboard(dashboardId);
  const tableKeys = new Set(tables.map((t) => t.key || t.id));
  if (!tableKeys.has(payload.tableKey)) {
    throw new HttpError(400, "Invalid tableKey");
  }
  const metricType = payload.metricType || payload.aggregation;
  const aggregationMap = {
    sum: "sum",
    average: "avg",
    avg: "avg",
    min: "min",
    max: "max",
    count: "count",
    sum_conditional: "sum",
    average_conditional: "avg",
    count_conditional: "count",
  };
  const aggregation = aggregationMap[metricType] || payload.aggregation;
  const allowedAggregations = ["sum", "avg", "min", "max", "count"];
  if (!allowedAggregations.includes(aggregation)) {
    throw new HttpError(400, "Invalid aggregation");
  }
  let filter = undefined;
  if (payload.condition && payload.condition.field && payload.condition.operator && payload.condition.value !== undefined) {
    const { field, operator, value, value2 } = payload.condition;
    const fieldKey = `record.${field}`;
    if (operator === "between" && value2 !== undefined) {
      filter = { [field]: { $gte: value, $lte: value2 } };
    } else {
      const opMap = {
        gt: "$gt",
        gte: "$gte",
        lt: "$lt",
        lte: "$lte",
        eq: "$eq",
        ne: "$ne",
        contains: "$regex",
      };
      const mongoOp = opMap[operator] || "$eq";
      filter =
        operator === "contains"
          ? { [field]: { [mongoOp]: value, $options: "i" } }
          : { [field]: { [mongoOp]: value } };
    }
  }
  const newWidget = {
    id: randomUUID(),
    title: payload.title?.toString().slice(0, 120) || "Metric",
    type: "metric",
    sourceTable: payload.tableKey,
    aggregate: aggregation,
    metricType: metricType,
    valueField: payload.columnKey,
    description: payload.title?.toString().slice(0, 160) || "",
    icon: payload.icon?.toString().slice(0, 40) || undefined,
    source: "manual",
    filter: filter || (payload.filter && typeof payload.filter === "object" ? payload.filter : undefined),
  };
  const existingManual = Array.isArray(dashboard.widgets) ? dashboard.widgets.filter((w) => w?.source === "manual") : [];
  const nextWidgets = [...existingManual, newWidget].slice(0, 12);
  const updated = await updateDashboardForOwner(dashboardId, owner, { widgets: nextWidgets });
  if (!updated) {
    throw new HttpError(500, "Failed to save widget");
  }
  return newWidget;
}

export async function addInsight(dashboardId, { sessionId, userId }, payload) {
  const dashboard = await assertCanEditDashboard(dashboardId, userId);
  const owner = { sessionId, userId };

  const tables = await listTablesByDashboard(dashboardId);
  const tableKeys = new Set(tables.map((t) => t.key || t.id));
  if (!tableKeys.has(payload.sourceTable)) {
    throw new HttpError(400, "Invalid sourceTable");
  }

  const newInsight = {
    id: payload.id?.toString() || `insight-${randomUUID().slice(0, 8)}`,
    title: payload.title?.toString().slice(0, 120) || "Insight",
    description: payload.description?.toString().slice(0, 240) || "",
    chartType: ["line", "bar", "pie", "table"].includes(payload.chartType) ? payload.chartType : "bar",
    sourceTable: payload.sourceTable,
    metric: {
      op: ["sum", "count", "avg"].includes(payload.metric?.op) ? payload.metric.op : "count",
      field: payload.metric?.field || null,
    },
    groupBy: payload.groupBy?.field
      ? {
          field: payload.groupBy.field,
          timeBucket: ["day", "week", "month"].includes(payload.groupBy.timeBucket) ? payload.groupBy.timeBucket : undefined,
        }
      : undefined,
    filter: Array.isArray(payload.filter) ? payload.filter : undefined,
    limit: Number.isFinite(payload.limit) ? Number(payload.limit) : undefined,
    editable: true,
    autoGenerated: false,
    hidden: false,
  };

  const existing = Array.isArray(dashboard.insights) ? dashboard.insights : [];
  const deduped = existing.filter((i) => i?.id !== newInsight.id);
  const next = [...deduped, newInsight];
  const updated =
    (await updateDashboardForOwner(dashboardId, owner, { insights: next })) ||
    (await updateDashboardById(dashboardId, { insights: next }));
  if (!updated) throw new HttpError(500, "Failed to save insight");
  return newInsight;
}

export async function removeWidget(dashboardId, { sessionId, userId }, widgetId) {
  const dashboard = await assertCanEditDashboard(dashboardId, userId);
  const owner = { sessionId, userId };
  const tables = await listTablesByDashboard(dashboardId);
  const autoGenerated = generateOverviewWidgetsFromSchema(dashboard.description || dashboard.name || "", tables);
  const stored = Array.isArray(dashboard.widgets) ? dashboard.widgets : [];
  const manual = stored.filter((w) => w?.source === "manual");
  const existsManual = manual.some((w) => w.id === widgetId);
  if (existsManual) {
    const next = stored.filter((w) => w.id !== widgetId);
    const updated =
      (await updateDashboardForOwner(dashboardId, owner, { widgets: next })) ||
      (await updateDashboardById(dashboardId, { widgets: next }));
    if (!updated) throw new HttpError(500, "Failed to remove widget");
    return { success: true };
  }
  const alreadyHidden = stored.some(
    (w) =>
      (w.id === widgetId || (w.title && autoGenerated.find((aw) => aw.title === w.title && aw.id === widgetId))) &&
      w.hidden,
  );
  if (alreadyHidden) return { success: true };
  const targetAuto =
    autoGenerated.find((w) => w.id === widgetId || w.widgetKey === widgetId) ||
    autoGenerated.find((w) => w.title === widgetId);
  const widgetKey = targetAuto?.widgetKey || widgetId;
  await upsertHideOverride(dashboardId, widgetKey);
  return { success: true };
}

export async function removeInsight(dashboardId, { sessionId, userId }, insightId) {
  const dashboard = await assertCanEditDashboard(dashboardId, userId);
  const owner = { sessionId, userId };

  const insights = Array.isArray(dashboard.insights) ? dashboard.insights : [];
  const target = insights.find((i) => i?.id === insightId);
  let next = insights;

  if (!target) {
    // If the insight does not exist yet (e.g., auto-generated only), persist a hidden placeholder
    next = [
      ...insights,
      {
        id: insightId,
        autoGenerated: true,
        editable: false,
        hidden: true,
      },
    ];
  } else if (target.autoGenerated) {
    next = insights.map((i) => (i.id === insightId ? { ...i, hidden: true } : i));
  } else {
    next = insights.filter((i) => i.id !== insightId);
  }

  const updated =
    (await updateDashboardForOwner(dashboardId, owner, { insights: next })) ||
    (await updateDashboardById(dashboardId, { insights: next }));
  if (!updated) throw new HttpError(500, "Failed to update insights");
  return { success: true };
}

export async function updateInsight(dashboardId, { sessionId, userId }, insightId, payload) {
  const dashboard = await assertCanEditDashboard(dashboardId, userId);
  const owner = { sessionId, userId };

  const insights = Array.isArray(dashboard.insights) ? dashboard.insights : [];
  const target = insights.find((i) => i?.id === insightId);
  const hidden = payload?.hidden === true;

  let next = insights;
  if (target) {
    next = insights.map((i) => (i.id === insightId ? { ...i, hidden } : i));
  } else {
    next = [
      ...insights,
      {
        id: insightId,
        autoGenerated: true,
        editable: false,
        hidden,
      },
    ];
  }

  const updated =
    (await updateDashboardForOwner(dashboardId, owner, { insights: next })) ||
    (await updateDashboardById(dashboardId, { insights: next }));
  if (!updated) throw new HttpError(500, "Failed to update insight");
  return { success: true };
}

const slugify = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `key-${randomUUID().slice(0, 6)}`;

const dedupeKey = (candidate, usedSet) => {
  const base = candidate || `key-${randomUUID().slice(0, 6)}`;
  let key = base;
  let counter = 2;
  while (usedSet.has(key)) {
    key = `${base}-${counter}`;
    counter += 1;
  }
  usedSet.add(key);
  return key;
};

function extractJsonObject(text) {
  if (!text) return null;
  const fencedJson = text.match(/```json([\s\S]*?)```/i);
  const fenced = !fencedJson && text.match(/```([\s\S]*?)```/);
  let candidate = fencedJson ? fencedJson[1] : fenced ? fenced[1] : null;
  if (!candidate) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      candidate = text.slice(start, end + 1);
    }
  }
  const jsonString = (candidate || text).trim();
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("AI response parse failed", {
      rawPreview: text?.slice(0, 500),
      extractedPreview: jsonString?.slice(0, 500),
    });
    throw new HttpError(502, "AI returned invalid JSON");
  }
}

function validatePlan(rawPlan) {
  if (!rawPlan || typeof rawPlan !== "object") {
    throw new HttpError(502, "Invalid AI plan response: missing JSON object");
  }
  const complexity = ["low", "medium", "high"].includes(rawPlan.complexity) ? rawPlan.complexity : "medium";
  const proposedTableKeys = Array.isArray(rawPlan.proposed_table_keys)
    ? rawPlan.proposed_table_keys
        .map((k) => k?.toString().trim())
        .filter(Boolean)
        .map((k) => slugify(k))
    : [];
  const proposedCustomTables = Array.isArray(rawPlan.proposed_custom_tables)
    ? rawPlan.proposed_custom_tables
        .map((t) => ({
          name: t?.name?.toString().slice(0, 120) || "",
          reason: t?.reason?.toString().slice(0, 200) || "",
        }))
        .filter((t) => t.name)
    : [];
  const insightGoals = Array.isArray(rawPlan.insight_goals)
    ? rawPlan.insight_goals.map((g) => g?.toString().slice(0, 200)).filter(Boolean)
    : [];
  const confidenceRaw = Number(rawPlan.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0.5;
  return {
    domain: rawPlan.domain?.toString().slice(0, 120) || "",
    complexity,
    proposed_table_keys: proposedTableKeys,
    proposed_custom_tables: proposedCustomTables,
    insight_goals: insightGoals,
    confidence,
  };
}

const stripSystemFields = (record = {}) => {
  if (!record || typeof record !== "object") return {};
  const cleaned = { ...record };
  SYSTEM_FIELDS.forEach((k) => {
    delete cleaned[k];
    delete cleaned[k.toLowerCase()];
  });
  // common camelCase variants
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  return cleaned;
};

const BLUEPRINT_JSON_SCHEMA = {
  name: "dashboard_schema",
  schema: {
    type: "object",
    properties: {
      tables: {
        type: "array",
        minItems: MIN_TABLES,
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  type: {
                    type: "string",
                    enum: allowedFieldTypes,
                  },
                  required: { type: "boolean" },
                  options: { type: "array", items: { type: "string" } },
                  ref: { type: "string" },
                },
                required: ["key", "type"],
              },
            },
          },
          required: ["key", "name", "fields"],
        },
      },
      relationships: { type: "array" },
      insights: { type: "array" },
      ui: { type: "object" },
    },
    required: ["tables"],
  },
};

const PLAN_JSON_SCHEMA = {
  name: "dashboard_schema",
  schema: {
    type: "object",
    properties: {
      domain: { type: "string" },
      complexity: { type: "string", enum: ["low", "medium", "high"] },
      proposed_table_keys: { type: "array", items: { type: "string" } },
      proposed_custom_tables: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, reason: { type: "string" } },
          required: ["name"],
        },
      },
      insight_goals: { type: "array", items: { type: "string" } },
      confidence: { type: "number" },
    },
    required: ["complexity", "proposed_table_keys"],
  },
};

async function callWithRepair({
  messages,
  temperature = 0.4,
  maxTokens = 900,
  validator,
  label = "response",
  jsonSchema = BLUEPRINT_JSON_SCHEMA,
}) {
  const client = requireOpenAI();
  let lastContent = "";
  const baseMessages = Array.isArray(messages) ? [...messages] : [];
  let currentMessages = baseMessages;
  let tokens = Math.max(300, maxTokens);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: currentMessages,
        temperature,
        max_tokens: tokens,
        response_format: { type: "json_object" },
      });
      const choice = completion.choices?.[0];
      const finish = choice?.finish_reason;
      const content = choice?.message?.content?.trim() || "";
      if (finish === "length") {
        lastContent = content;
        if (attempt >= 3) {
          throw new HttpError(502, "AI output truncated (finish_reason=length)");
        }
        tokens = Math.min(tokens + 1200, 6000);
        const tokenHint = Math.max(400, tokens - 200);
        currentMessages = [
          ...baseMessages,
          {
            role: "system",
            content: `Previous ${label} response was truncated. Return concise JSON under ${tokenHint} tokens. Trim optional descriptions and keep each table to essential fields only.`,
          },
        ];
        continue;
      }
      lastContent = content;
      try {
        if (choice?.message?.parsed) {
          return validator(choice.message.parsed);
        }
        const parsed = JSON.parse(content);
        return validator(parsed);
      } catch (parseErr) {
        // Fallback if json_object not honored
        const fallbackParsed = extractJsonObject(content);
        return validator(fallbackParsed);
      }
    } catch (err) {
      // If OpenAI rate limits, don't retry to avoid additional 429 hits
      if (err?.status === 429 || /rate limit/i.test(err?.message || "")) {
        throw new HttpError(429, "Rate limited by AI provider. Please retry in ~20s.");
      }
      if (attempt >= 3) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(502, err.message || "AI returned invalid JSON");
      }
      currentMessages = [
        ...currentMessages,
        {
          role: "system",
          content: `Previous ${label} invalid: ${err.message}.\nLast response:\n${lastContent?.slice(
            0,
            4000,
          )}\nReturn ONLY corrected JSON.`,
        },
      ];
    }
  }
  throw new HttpError(502, `AI failed to produce valid ${label}`);
}

function validateBlueprint(rawBlueprint) {
  const errors = [];
  if (!rawBlueprint || typeof rawBlueprint !== "object") {
    throw new HttpError(502, "Invalid AI response: missing JSON object");
  }

  const blueprintName = rawBlueprint.name?.toString() || "";
  const blueprintDescription = rawBlueprint.description?.toString() || "";
  // Legacy safety: some legacy code paths referenced `description` directly
  // inside this validator. Keep a scoped alias so any remaining references
  // resolve without throwing a ReferenceError.
  const description = blueprintDescription;

  const tableMap = new Map();
  const tableKeySet = new Set();
  const tableNameMap = new Map();

  const normalizeTable = (table, index) => {
    const name = table?.name?.toString().trim();
    const keyCandidate = table?.key?.toString().trim() || (name ? slugify(name) : `table-${index + 1}`);
    const key = dedupeKey(keyCandidate, tableKeySet);
    if (!name) errors.push("Table missing name");
    if (!table.fields || !Array.isArray(table.fields)) errors.push(`Table ${name || key} missing fields array`);
    const fieldKeyByName = {};
    const fieldKeySet = new Set();
      const normalizedFields = Array.isArray(table.fields)
        ? table.fields.map((field, fieldIndex) => {
            const fname = field.fieldName || field.name || field.key || `Field ${fieldIndex + 1}`;
            const fkeyCandidate = field.key || (field.name ? slugify(field.name) : slugify(fname));
            const fkey = dedupeKey(fkeyCandidate, fieldKeySet);
            fieldKeyByName[fname.toString().toLowerCase()] = fkey;
            const ftype = field.type || field.fieldType;
            if (!ftype) errors.push(`Field ${fname} missing type`);
            if (ftype && !allowedFieldTypes.includes(ftype)) errors.push(`Field ${fname} has unsupported type ${ftype}`);
            const normalizedType = allowedFieldTypes.includes(ftype) ? ftype : "string";
            const semType = allowedSemanticTypes.includes(field.semanticType) ? field.semanticType : inferSemantic(fkey, normalizedType).semanticType;
            const semRole = allowedSemanticRoles.includes(field.semanticRole) ? field.semanticRole : inferSemantic(fkey, normalizedType).semanticRole;
            return {
              ...field,
              key: fkey,
              type: normalizedType,
              required: Boolean(field.required),
              semanticType: semType,
              semanticRole: semRole,
              options: Array.isArray(field.options) ? field.options.slice(0, 20) : undefined,
              ref: field.ref || field.reference || undefined,
            };
          })
        : [];
    const withSystem = ensureSystemFields(normalizedFields, key);
    withSystem.forEach((f) => {
      if (f.key) {
        const lower = f.key.toString().toLowerCase();
        if (!fieldKeyByName[lower]) fieldKeyByName[lower] = f.key;
        fieldKeySet.add(f.key);
      }
    });
    return {
      key,
      name,
      description: table.description?.toString().slice(0, 300) || "",
      purpose: table.purpose?.toString().slice(0, 300) || "",
      fields: withSystem,
      fieldKeyByName,
    };
  };

  let tablesRaw = Array.isArray(rawBlueprint.tables) ? rawBlueprint.tables : [];
  if (tablesRaw.length < MIN_TABLES) {
    throw new HttpError(502, `AI returned too few tables (got ${tablesRaw.length}, min ${MIN_TABLES})`);
  }
  if (tablesRaw.length > MAX_TABLES) {
    tablesRaw = tablesRaw.slice(0, MAX_TABLES);
  }

  const normalizedTables = tablesRaw.map((table, idx) => {
    const normalized = normalizeTable(table, idx);
    tableMap.set(normalized.key, normalized);
    if (normalized.name) tableNameMap.set(normalized.name.toLowerCase(), normalized.key);
    return normalized;
  });

  const allowedRelationshipTypes = ["one-to-many", "many-to-one", "many-to-many"];
  const relationshipsRaw = Array.isArray(rawBlueprint.relationships) ? rawBlueprint.relationships : [];

  const findForeignKeyCandidate = (table, targetTableKey) => {
    if (!table?.fields?.length || !targetTableKey) return null;
    const lowerTarget = targetTableKey.toLowerCase();
    const exactMatch = table.fields.find((f) => f?.key?.toString().toLowerCase() === `${lowerTarget}_id`);
    if (exactMatch) return exactMatch.key;
    const byRef = table.fields.find((f) => f?.ref === targetTableKey);
    if (byRef) return byRef.key;
    const inferred = table.fields.find((f) => inferRefTable(f?.key?.toString()) === targetTableKey);
    if (inferred) return inferred.key;
    return null;
  };

  const normalizedRelationships = relationshipsRaw.map((rel, idx) => {
    let fromTableKey = rel.fromTableKey || tableNameMap.get(rel.fromTable?.toString().toLowerCase());
    let toTableKey = rel.toTableKey || tableNameMap.get(rel.toTable?.toString().toLowerCase());
    if (!fromTableKey && rel.fromTable) fromTableKey = slugify(rel.fromTable);
    if (!toTableKey && rel.toTable) toTableKey = slugify(rel.toTable);
    const fromTable = fromTableKey ? tableMap.get(fromTableKey) : null;
    const toTable = toTableKey ? tableMap.get(toTableKey) : null;
    const mapField = (table, fieldKey, fieldName) => {
      if (fieldKey) return fieldKey;
      if (!table || !fieldName) return null;
      return table.fieldKeyByName[fieldName.toString().toLowerCase()] || null;
    };

    let fromFieldKey = mapField(fromTable, rel.fromFieldKey, rel.fromField);
    let toFieldKey = mapField(toTable, rel.toFieldKey, rel.toField);

    // Repair toFieldKey: map *_id to primary id of target table
    if (toTable && (!toFieldKey || !toTable.fields?.some((f) => f.key === toFieldKey))) {
      if (rel.toFieldKey?.toString().toLowerCase().endsWith("_id")) {
        const primaryId = toTable.fields.find((f) => f.key === "id");
        if (primaryId) {
          toFieldKey = "id";
        }
      }
    }

    // Repair fromFieldKey if missing on fromTable: try FK candidates to target table
    if (fromTable && (!fromFieldKey || !fromTable.fields?.some((f) => f.key === fromFieldKey))) {
      const candidate = findForeignKeyCandidate(fromTable, toTableKey);
      if (candidate) {
        fromFieldKey = candidate;
      }
    }

    if (!fromTableKey || !toTableKey || !fromFieldKey || !toFieldKey || !rel.type) {
      errors.push(`Relationship ${idx + 1} is incomplete (from ${fromTableKey || "?"}.${fromFieldKey || "?"} -> ${toTableKey || "?"}.${toFieldKey || "?"})`);
    }
    if (fromTableKey && !tableMap.has(fromTableKey)) {
      errors.push(`Relationship ${idx + 1} references missing fromTableKey ${fromTableKey}`);
    }
    if (toTableKey && !tableMap.has(toTableKey)) {
      errors.push(`Relationship ${idx + 1} references missing toTableKey ${toTableKey}`);
    }
    const fromFieldExists = fromTable?.fields?.some((f) => f.key === fromFieldKey);
    const toFieldExists = toTable?.fields?.some((f) => f.key === toFieldKey);
    if (fromTable && fromFieldKey && !fromFieldExists) {
      errors.push(`Relationship ${idx + 1} missing fromFieldKey ${fromFieldKey} in table ${fromTableKey}`);
    }
    if (toTable && toFieldKey && !toFieldExists) {
      errors.push(`Relationship ${idx + 1} missing toFieldKey ${toFieldKey} in table ${toTableKey}`);
    }
    if (rel.type && !allowedRelationshipTypes.includes(rel.type)) {
      errors.push(`Relationship ${idx + 1} has unsupported type ${rel.type}`);
    }
    return { fromTableKey, fromFieldKey, toTableKey, toFieldKey, type: rel.type };
  });

  normalizedTables.forEach((table) => {
    if (!table.key) errors.push("Table missing key after normalization");
    if (!table.name) errors.push(`Table ${table.key} missing name`);
    if (!Array.isArray(table.fields) || !table.fields.length) {
      errors.push(`Table ${table.key} missing fields`);
    }
    table.fields.forEach((field) => {
      if (!field.key) errors.push(`Field missing key in table ${table.key}`);
      if (!field.type) errors.push(`Field ${field.key} missing type in table ${table.key}`);
      if (field.type && !allowedFieldTypes.includes(field.type)) {
        errors.push(`Field ${field.key} has unsupported type ${field.type}`);
      }
    });
  });

  if (errors.length) {
    throw new HttpError(502, `Invalid AI response: ${errors.join("; ")}`);
  }

  const fieldMapByTable = new Map(
    normalizedTables.map((t) => [t.key, new Set(t.fields.map((f) => f.key))]),
  );

  const rawInsights = Array.isArray(rawBlueprint.insights) ? rawBlueprint.insights : [];
  const allowedInsightKinds = ["kpi", "trend", "breakdown", "table"];
  const allowedMetrics = ["count", "sum", "avg"];
  const normalizedInsights = rawInsights
    .map((insight, idx) => {
      const sourceTableKey = insight?.source?.tableKey;
      if (!sourceTableKey || !fieldMapByTable.has(sourceTableKey)) return null;
      const fieldSet = fieldMapByTable.get(sourceTableKey);
      const fieldKey = insight?.source?.fieldKey;
      const groupByFieldKey = insight?.source?.groupByFieldKey;
      const timeFieldKey = insight?.source?.timeFieldKey;
      if (fieldKey && !fieldSet.has(fieldKey)) return null;
      if (groupByFieldKey && !fieldSet.has(groupByFieldKey)) return null;
      if (timeFieldKey && !fieldSet.has(timeFieldKey)) return null;
      const id = insight.id?.toString() || `insight-${idx + 1}-${randomUUID().slice(0, 6)}`;
      const kind = allowedInsightKinds.includes(insight.kind) ? insight.kind : "kpi";
      const metric = allowedMetrics.includes(insight?.source?.metric) ? insight.source.metric : "count";
      return {
        id,
        title: insight.title?.toString().slice(0, 120) || `Insight ${idx + 1}`,
        kind,
        source: {
          tableKey: sourceTableKey,
          metric,
          fieldKey: fieldKey || null,
          groupByFieldKey: groupByFieldKey || null,
          timeFieldKey: timeFieldKey || null,
        },
        visualization: insight.visualization,
        autoGenerated: true,
        editable: false,
        hidden: Boolean(insight.hidden),
      };
    })
    .filter(Boolean);

  const insightMap = new Map(normalizedInsights.map((insight) => [insight.id, insight]));

  const normalizeWidgets = () => {
    const allowedWidgetTypes = ["stat_card", "chart", "data_table"];
    const rawWidgets = Array.isArray(rawBlueprint.ui?.widgets) ? rawBlueprint.ui.widgets : [];
    return rawWidgets
      .map((widget, idx) => {
        const tableKey = widget.tableKey || widget.table || widget.table_id;
        if (!tableKey || !fieldMapByTable.has(tableKey)) return null;
        const insightId = widget.insightId || widget.insightID;
        if (insightId && !insightMap.has(insightId)) return null;
        const type = allowedWidgetTypes.includes(widget.type) ? widget.type : "data_table";
        const id = widget.id?.toString() || `widget-${idx + 1}-${randomUUID().slice(0, 6)}`;
        return {
          id,
          type,
          title: widget.title?.toString().slice(0, 120) || "Widget",
          tableKey,
          insightId: insightId || null,
          fields: Array.isArray(widget.fields) ? widget.fields : undefined,
          layout: widget.layout || undefined,
        };
      })
      .filter(Boolean);
  };

  const normalizedWidgets = normalizeWidgets();
  const generatedWidgets = generateOverviewWidgetsFromSchema(blueprintDescription || blueprintName || "", normalizedTables);

  const tableOrderRaw = Array.isArray(rawBlueprint.ui?.tableDropdownOrder) ? rawBlueprint.ui.tableDropdownOrder : [];
  const dropdownOrder = [...new Set([...tableOrderRaw.filter((k) => tableMap.has(k)), ...normalizedTables.map((t) => t.key)])];
  const defaultTableKey =
    rawBlueprint.ui?.defaultTableKey && tableMap.has(rawBlueprint.ui.defaultTableKey)
      ? rawBlueprint.ui.defaultTableKey
      : normalizedTables[0]?.key || "";

  const ui = {
    defaultTableKey,
    tableDropdownOrder: dropdownOrder,
    emptyStateText:
      rawBlueprint.ui?.emptyStateText?.toString().slice(0, 200) || "No records yet. Click Add record to start.",
    widgets: generatedWidgets.length ? generatedWidgets : normalizedWidgets,
  };

  const tablesForReturn = normalizedTables.map(({ fieldKeyByName, ...rest }) => rest);

  return {
    tables: tablesForReturn,
    relationships: normalizedRelationships,
    insights: normalizedInsights,
    ui,
    widgets: generatedWidgets.length ? generatedWidgets : normalizedWidgets,
  };
}

async function generatePlan({ name, description, type, samplePreview }) {
  const libraryKeys = TABLE_LIBRARY.map((t) => `${t.key}:${t.name}`).join("; ");
  const sampleContext = buildSamplePreviewContext(samplePreview);
  const typeKey = (type || "").toLowerCase();
  const typeHint = TYPE_PROMPT_HINTS[typeKey]?.plan;
  const messages = [
    {
      role: "system",
      content: `You are an AI planner for dynamic dashboards. Propose domain context, complexity, relevant table keys from a library, any custom tables, and insight goals.\nTable library keys you can reference: ${libraryKeys}.\nReturn ONLY valid JSON with: { domain, complexity("low"|"medium"|"high"), proposed_table_keys: string[], proposed_custom_tables:[{name, reason}], insight_goals:string[], confidence:number(0..1) }. No markdown/backticks.`,
    },
    {
      role: "user",
      content: `Dashboard name: ${name}\nDashboard type: ${type || ""}\nDescription: ${description}\n${
        typeHint ? `Domain focus: ${typeHint}\n` : ""
      }${
        sampleContext ? `Sample data preview:\n${sampleContext}\n` : ""
      }Return JSON only.`,
    },
  ];
  return callWithRepair({
    messages,
    temperature: 0.45,
    maxTokens: 600,
    validator: validatePlan,
    label: "plan JSON",
    jsonSchema: PLAN_JSON_SCHEMA,
  });
}

async function generateSchemaAndInsights({ name, description, type, plan, samplePreview }) {
  const planJson = JSON.stringify(plan);
  const libraryKeys = TABLE_LIBRARY.map((t) => `${t.key}:${t.name}`).join("; ");
  const selectedTemplates = Array.isArray(plan?.proposed_table_keys)
    ? TABLE_LIBRARY.filter((tpl) => plan.proposed_table_keys.includes(tpl.key))
    : [];
  const templateHints = selectedTemplates.map((tpl) => ({
    key: tpl.key,
    name: tpl.name,
    sampleFields: tpl.fields?.slice(0, 6).map((f) => ({ name: f.fieldName, type: f.fieldType })),
  }));
  const sampleContext = buildSamplePreviewContext(samplePreview);
  const typeKey = (type || "").toLowerCase();
  const typeHint = TYPE_PROMPT_HINTS[typeKey]?.schema;
  const messages = [
    {
      role: "system",
      content: `You are an AI schema + insight generator for a modern dashboard. Use the provided plan and user description to build data tables, relationships, insights, and UI widget metadata.\nConstraints:\n- Max 10 tables, each max 10 fields (including system fields).\n- Max 8 insights, max 8 widgets.\nRequirements:\n- Return ONLY JSON. No markdown, no backticks, no explanation.\n- Tables: [{ key, name, description, fields:[{ key, type(id|string|number|boolean|date|enum|reference|text), required, options?, ref?, semanticType?(money|quantity|countable_entity|timestamp|category|status|boolean|generic|reference), semanticRole?(transaction_value|entity_id|entity_name|time_dimension|group_dimension|state|generic|foreign_id|system_created_at|system_updated_at) }] }]\n- Relationships: [{ fromTableKey, fromFieldKey, toTableKey, toFieldKey, type("one-to-many"|"many-to-one"|"many-to-many") }]. fromFieldKey is the foreign key column (customer_id, order_id, product_id, etc.). toFieldKey should almost always be "id" (the primary key of the referenced table).\n- Insights: [{ id, title, kind("kpi"|"trend"|"breakdown"|"table"), source:{ tableKey, metric("count"|"sum"|"avg"), fieldKey?, groupByFieldKey?, timeFieldKey? }, visualization?:{ chartType("line"|"bar"|"pie") } }]\n- UI: { defaultTableKey, tableDropdownOrder, emptyStateText, widgets:[{ id, type("stat_card"|"chart"|"data_table"), title, tableKey, insightId?, fields?, layout? }] }\n- Include system fields in every table: id (primary key), created_at(date), updated_at(date). These are internal; do not duplicate them as custom fields.\n- Table library keys for inspiration (optional): ${libraryKeys}.`,
    },
    {
      role: "user",
      content: `Dashboard name: ${name}\nDashboard type: ${type || ""}\nDescription: ${description}\nPlan JSON: ${planJson}\nTable templates (optional to reuse/rename): ${JSON.stringify(
        templateHints,
      )}\n${typeHint ? `Domain focus: ${typeHint}\n` : ""}${sampleContext ? `Sample data preview:\n${sampleContext}\n` : ""}Return JSON only.`,
    },
  ];

  return callWithRepair({
    messages,
    temperature: 0.35,
    maxTokens: Math.max(3000, 3000),
    validator: validateBlueprint,
    label: "schema JSON",
    jsonSchema: BLUEPRINT_JSON_SCHEMA,
  });
}

const buildDefaultWidgets = (tables = [], insights = []) => {
  const widgets = [];
  const tableWidgets = tables.map((table, idx) => ({
    id: `table-${idx + 1}`,
    type: "data_table",
    title: `${table.name || "Table"} data`,
    tableKey: table.key,
    fields: Array.isArray(table.fields) ? table.fields.map((f) => f.key) : [],
  }));
  widgets.push(...tableWidgets);
  const insightWidgets = insights
    .slice(0, 4)
    .map((insight, idx) => ({
      id: `insight-${idx + 1}`,
      type: insight.kind === "kpi" ? "stat_card" : "chart",
      title: insight.title || `Insight ${idx + 1}`,
      tableKey: insight.source?.tableKey || tables[0]?.key || "",
      insightId: insight.id,
    }))
    .filter((w) => w.tableKey);
  const extra = insightWidgets.slice(0, Math.min(4, Math.max(2, insightWidgets.length || 0)));
  widgets.push(...extra);
  return widgets;
};

export async function generateDashboardFields({ name, description, type, samplePreview }) {
  if (!name?.trim() || !description?.trim()) {
    throw new HttpError(400, "Name and description are required");
  }
  const plan = await generatePlan({ name, description, type, samplePreview });
  const blueprint = await generateSchemaAndInsights({ name, description, type, plan, samplePreview });
  const tablesWithSamples = attachSampleRowsToTables(blueprint.tables || [], samplePreview);
  const tables = inferForeignKeysFromSamples(tablesWithSamples);
  const relationships = blueprint.relationships || [];
  const insights = blueprint.insights || [];
  const aiWidgets = Array.isArray(blueprint.widgets)
    ? blueprint.widgets
    : Array.isArray(blueprint.ui?.widgets)
      ? blueprint.ui.widgets
      : [];
  const widgets = aiWidgets.length ? aiWidgets : generateOverviewWidgetsFromSchema(description, tables);
  const ui = {
    ...(blueprint.ui || {}),
    widgets: needsWidgetRegeneration(widgets, tables)
      ? generateOverviewWidgetsFromSchema(description, tables)
      : widgets,
    tableDropdownOrder:
      Array.isArray(blueprint.ui?.tableDropdownOrder) && blueprint.ui.tableDropdownOrder.length
        ? blueprint.ui.tableDropdownOrder
        : tables.map((t) => t.key),
    defaultTableKey:
      blueprint.ui?.defaultTableKey && tables.find((t) => t.key === blueprint.ui.defaultTableKey)
        ? blueprint.ui.defaultTableKey
        : tables[0]?.key || "",
    emptyStateText: blueprint.ui?.emptyStateText || "No records yet. Click Add record to start.",
  };
  return {
    fields: [],
    tables,
    relationships,
    insights,
    widgets,
    componentCode: "",
    ui,
  };
}

export async function generateAndPersistDashboard({ name, type, description, sessionId, userId, samplePreview }) {
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  const blueprint = await generateDashboardFields({ name, description, type, samplePreview });
  const widgets = needsWidgetRegeneration(blueprint.widgets, blueprint.tables)
    ? generateOverviewWidgetsFromSchema(description, blueprint.tables)
    : blueprint.widgets;
  const dashboard = await insertDashboard({
    name,
    type,
    description,
    sessionId,
    userId,
    widgets: widgets || [],
    insights: blueprint.insights || [],
    ui: blueprint.ui || {},
    samplePreview,
  });
  await insertTables(dashboard.id, blueprint.tables);
  await insertRelationships(dashboard.id, blueprint.relationships);
  if (samplePreview && Array.isArray(samplePreview.tables) && samplePreview.tables.length) {
    try {
      await seedSampleDataForDashboard(dashboard.id, blueprint.tables, samplePreview);
    } catch (err) {
      console.error("[seedSampleDataForDashboard] failed", err);
    }
  }
  return {
    dashboardId: dashboard.id,
    name: dashboard.name,
    type: dashboard.type,
    description: dashboard.description,
    tables: blueprint.tables,
    relationships: blueprint.relationships,
    insights: blueprint.insights,
    ui: { ...blueprint.ui, widgets },
    widgets,
  };
}

export async function saveDashboard({ sessionId, userId, name, description, fields, widgets, componentCode, tables, samplePreview }) {
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  const normalizedTables = sanitizeTables(tables);
  const normalizedFields = normalizedTables.length
    ? normalizedTables.flatMap((table) => table.fields)
    : Array.isArray(fields)
      ? fields.map((field, idx) => normalizeField(field, idx))
      : [];
  if (!normalizedFields.length) {
    throw new HttpError(400, "fields are required");
  }
  const payload = await insertDashboard({
    sessionId: sessionId || null,
    userId: userId || null,
    name,
    description: description || "",
    fields: normalizedFields,
    widgets: sanitizeWidgets(widgets, normalizedFields),
    tables: normalizedTables,
    componentCode: componentCode?.toString() || "",
    samplePreview,
  });
  // Observer: persist notification when a dashboard is created (best-effort, non-blocking)
  try {
    await createNotificationRepo({
      title: "New dashboard created",
      message: `Dashboard "${payload.name}" has been created.`,
      type: "dashboard_created",
      metadata: {
        dashboardId: payload.id,
        createdBy: userId || null,
      },
      user_id: userId || null,
      read: false,
    });
  } catch (err) {
    console.error("Failed to record dashboard creation notification", err);
  }
  return payload;
}

const hydrateDashboard = async (dash) => {
  const tablesRaw = await listTablesByDashboard(dash.id);
  const tables = tablesRaw.map((table) => {
    const fields = Array.isArray(table.fields)
      ? table.fields.map((f) => {
          const baseType = (f.type || f.fieldType || "").toString().toLowerCase();
          const options = f.options || f.enumValues || f.enum || f.choices;
          const hasEnum = Array.isArray(options) && options.length > 0;
          const normalizedType = hasEnum && (!baseType || baseType === "string") ? "enum" : baseType || "string";
          return {
            ...f,
            type: normalizedType,
            enumValues: hasEnum ? options : undefined,
            options: hasEnum ? options : f.options,
          };
        })
      : [];
    return { ...table, fields };
  });
  const relationships = await listRelationshipsByDashboard(dash.id);
  const ui = dash.ui || {
    defaultTableKey: tables[0]?.key || "",
    tableDropdownOrder: tables.map((t) => t.key),
    emptyStateText: "No records yet. Click Add record to start.",
  };
  const insightsRaw = Array.isArray(dash.insights) ? dash.insights : [];
  const insightMap = new Map();
  insightsRaw.forEach((insight) => {
    if (!insight?.id) return;
    insightMap.set(insight.id, {
      ...insight,
      autoGenerated: insight.autoGenerated !== false,
      editable: insight.editable !== false,
    });
  });
  const insights = Array.from(insightMap.values());
  const manual = Array.isArray(dash.widgets) ? dash.widgets.filter((w) => w?.source === "manual") : [];
  const overrides = await listOverridesByDashboard(dash.id);
  const hiddenKeys = new Set(overrides.filter((o) => o.hidden && o.widgetKey).map((o) => o.widgetKey));
  let autoWidgets = generateOverviewWidgetsFromSchema(dash.description || dash.name || "", tables, dash.id).filter(
    (w) => !hiddenKeys.has(w.widgetKey),
  );
  if (needsWidgetRegeneration(autoWidgets, tables)) {
    autoWidgets = generateOverviewWidgetsFromSchema(dash.description || dash.name || "", tables, dash.id).filter(
      (w) => !hiddenKeys.has(w.widgetKey),
    );
  }
  const manualWidgets = manual.map((w) => ({
    ...w,
    widgetKey: w.widgetKey || buildWidgetKey(dash.id, w.sourceTable, w.valueField, w.aggregate || "sum"),
  }));
  const manualKeys = new Set(manualWidgets.map((w) => w.widgetKey || w.id || w.title));
  const autoVisible = autoWidgets.filter((w) => !manualKeys.has(w.widgetKey));
  const widgets = [...autoVisible, ...manualWidgets].slice(0, 12);
  return { ...dash, tables, relationships, insights, ui: { ...ui, widgets }, widgets };
};

export async function listDashboards({ sessionId, userId }) {
  if (!sessionId && !userId) return [];
  const dashboards = await listDashboardsForOwner({ sessionId, userId });
  const withSchema = await Promise.all(dashboards.map((dash) => hydrateDashboard(dash)));
  return withSchema;
}

export async function getDashboardByIdForViewer(dashboardId, userId) {
  const dashboard = await assertCanViewDashboard(dashboardId, userId);
  return hydrateDashboard(dashboard);
}

export async function removeDashboard(id, { sessionId, userId }) {
  if (!userId) {
    throw new HttpError(400, "userId required");
  }
  await assertCanEditDashboard(id, userId);
  const deleted = await deleteDashboardForOwner(id, { sessionId, userId });
  if (deleted) {
    await deleteTablesByDashboard(id);
    await deleteRelationshipsByDashboard(id);
  }
  if (!deleted) {
    throw new HttpError(404, "Dashboard not found");
  }
}

export async function updateDashboard(id, { sessionId, userId }, updates) {
  if (!userId) {
    throw new HttpError(400, "userId required");
  }
  await assertCanEditDashboard(id, userId);
  const next = await updateDashboardForOwner(id, { sessionId, userId }, updates);
  if (!next) {
    throw new HttpError(404, "Dashboard not found");
  }
  return next;
}

export async function addDashboardRecord({ dashboardId, tableKey, record, sessionId, userId }) {
  if (!userId) {
    throw new HttpError(400, "userId required");
  }
  if (!dashboardId || !tableKey || !record || typeof record !== "object") {
    throw new HttpError(400, "dashboardId, tableKey, and record are required");
  }
  await assertCanEditDashboard(dashboardId, userId);
  const sanitizedRecord = stripSystemFields(record);
  const inserted = await insertDashboardRecord({ dashboardId, tableKey, record: sanitizedRecord });
  return inserted;
}

const LOOKUP_MAX_RECORDS = 500;

export async function getReferenceLookups({ dashboardId, refTableKeys, userId }) {
  if (!dashboardId) {
    throw new HttpError(400, "dashboardId required");
  }
  const requestedKeys = Array.isArray(refTableKeys)
    ? refTableKeys
    : typeof refTableKeys === "string"
      ? refTableKeys.split(",")
      : [];
  const targets = Array.from(
    new Set(
      requestedKeys
        .map((key) => (key === undefined || key === null ? "" : String(key).trim()))
        .filter((key) => key.length > 0),
    ),
  );
  if (!targets.length) {
    return {};
  }

  await assertCanViewDashboard(dashboardId, userId);
  const tables = await listTablesByDashboard(dashboardId);
  const tableByKey = new Map();
  const tableByLower = new Map();
  tables.forEach((table) => {
    const key = (table.key || table.id || table.name || "").toString();
    if (!key) return;
    tableByKey.set(key, table);
    tableByLower.set(key.toLowerCase(), table);
  });
  const resolveTable = (key) => {
    if (!key) return null;
    const raw = tableByKey.get(key) || tableByLower.get(String(key).toLowerCase());
    return raw || null;
  };

  const lookupPairs = await Promise.all(
    targets.map(async (targetKey) => {
      const table = resolveTable(targetKey);
      if (!table) {
        return [targetKey, {}];
      }
      const tableKey = table.key || targetKey;
      const displayConfig = resolveDisplayConfigForTable(table);
      const records = await listRecordsByDashboard({ dashboardId, tableKey });
      const primaryRows = records.slice(0, LOOKUP_MAX_RECORDS).map((row) => row.record || row);
      const fallbackRows = Array.isArray(table.sampleRows) ? table.sampleRows.slice(0, LOOKUP_MAX_RECORDS) : [];
      const sourceRows = primaryRows.length ? primaryRows : fallbackRows;
      const mapping = {};
      sourceRows.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const base = entry.record && typeof entry.record === "object" ? entry.record : entry;
        const getter = buildRecordValueGetter(base);
        const variants = new Set(["_id", "id"]);
        if (typeof tableKey === "string" && tableKey.length) {
          const lower = tableKey.toLowerCase();
          variants.add(`${lower}_id`);
          const singular = lower.replace(/s$/i, "");
          if (singular && singular !== lower) {
            variants.add(`${singular}_id`);
            variants.add(`${singular}id`);
          }
        }
        const idCandidate = Array.from(variants)
          .map((key) => getter(key))
          .concat([entry?._id, entry?.id])
          .find((value) => value !== undefined && value !== null && String(value).trim().length > 0);
        if (!idCandidate) return;
        const id = String(idCandidate);
        if (!id || mapping[id]) return;
        const displayRaw = resolveDisplayValueForRecord(base, table, displayConfig);
        const display = displayRaw && displayRaw.trim().length ? displayRaw : id.slice(0, 8);
        mapping[id] = { id, display };
      });
      return [targetKey, mapping];
    }),
  );

  return lookupPairs.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

export async function listDashboardRecords({ dashboardId, tableKey, sessionId, userId }) {
  if (!dashboardId || !tableKey) {
    throw new HttpError(400, "dashboardId and tableKey are required");
  }
  await assertCanViewDashboard(dashboardId, userId);
  const records = await listRecordsByDashboard({ dashboardId, tableKey });
  return records || [];
}

export async function getDashboardRecord({ dashboardId, tableKey, recordId, sessionId, userId }) {
  if (!dashboardId || !tableKey || !recordId) {
    throw new HttpError(400, "dashboardId, tableKey, and recordId are required");
  }
  await assertCanViewDashboard(dashboardId, userId);
  const record = await findRecordById({ dashboardId, tableKey, recordId });
  if (!record) throw new HttpError(404, "Record not found");
  return record;
}

export async function getRecordReferences({ dashboardId, tableKey, recordId, userId }) {
  if (!dashboardId || !tableKey || !recordId) {
    throw new HttpError(400, "dashboardId, tableKey, and recordId are required");
  }
  await assertCanEditDashboard(dashboardId, userId);
  return findRecordReferences({ dashboardId, targetTableKey: tableKey, targetId: recordId });
}

export async function updateDashboardRecordService({ dashboardId, tableKey, recordId, record, sessionId, userId }) {
  if (!dashboardId || !tableKey || !recordId || !record) {
    throw new HttpError(400, "dashboardId, tableKey, recordId, and record are required");
  }
  await assertCanEditDashboard(dashboardId, userId);
  const updated = await updateRecordById({ dashboardId, tableKey, recordId, record: stripSystemFields(record) });
  if (!updated) throw new HttpError(404, "Record not found");
  return updated;
}

export async function deleteDashboardRecordService({ dashboardId, tableKey, recordId, sessionId, userId }) {
  if (!dashboardId || !tableKey || !recordId) {
    throw new HttpError(400, "dashboardId, tableKey, and recordId are required");
  }
  await assertCanEditDashboard(dashboardId, userId);
  const references = await findRecordReferences({ dashboardId, targetTableKey: tableKey, targetId: recordId });
  if (references.length) {
    const err = new HttpError(409, "Cannot delete: record is referenced");
    err.references = references;
    throw err;
  }
  const deleted = await deleteRecordById({ dashboardId, tableKey, recordId });
  if (!deleted) throw new HttpError(404, "Record not found");
  return true;
}

export async function getDashboardData({ dashboardId, sessionId, userId, from, to }) {
  if (!dashboardId) throw new HttpError(400, "dashboardId required");
  const dashboard = await assertCanViewDashboard(dashboardId, userId);
  const tables = await listTablesByDashboard(dashboardId);
  const tableKeySet = new Set(tables.map((t) => t.key));
  const widgets =
    dashboard.widgets && dashboard.widgets.length
      ? dashboard.widgets
      : generateOverviewWidgetsFromSchema(dashboard.description || dashboard.name || "", tables);
  const finalWidgets = generateOverviewWidgetsFromSchema(dashboard.description || dashboard.name || "", tables);
  const rawRecords = await listRecordsByDashboard({ dashboardId });
  const recordsByTable = rawRecords.reduce((acc, row) => {
    const key = row.tableKey;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row.record || row);
    return acc;
  }, {});

  const dateRange =
    from || to
      ? {
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        }
      : undefined;

    const results = finalWidgets.map((widget) => evaluateWidget(widget, recordsByTable, tableKeySet, dateRange));
    return { dashboardId, widgets: results };
}

function evaluateWidget(widget, recordsByTable, tableKeySet, dateRange) {
  if (!widget || !widget.sourceTable || !tableKeySet.has(widget.sourceTable)) {
    return { id: widget?.id || "unknown", type: widget?.type || "metric", hasData: false, error: "table not found" };
  }
  const rows = recordsByTable[widget.sourceTable] || [];
  const filtered = rows.filter((row) => applyWidgetFilter(row, widget, dateRange));
  const aggregate = widget.aggregate || "count";

  if (widget.type === "table") {
    return {
      id: widget.id,
      type: widget.type,
      hasData: filtered.length > 0,
      rows: filtered.slice(0, 50),
    };
  }

  if (widget.type === "chart") {
    return evaluateChartWidget(widget, filtered);
  }

  // metric
  let value = 0;
  if (aggregate === "count") {
    value = filtered.length;
  } else {
    const vals = filtered.map((row) => Number(row?.[widget.valueField] ?? 0)).filter((v) => !Number.isNaN(v));
    if (!vals.length) {
      return { id: widget.id, type: widget.type, hasData: false, value: 0 };
    }
    if (aggregate === "sum") value = vals.reduce((a, b) => a + b, 0);
    if (aggregate === "avg") value = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (aggregate === "min") value = Math.min(...vals);
    if (aggregate === "max") value = Math.max(...vals);
  }
  return { id: widget.id, type: widget.type, hasData: filtered.length > 0, value };
}

function aggregateValue(row, field, aggregate) {
  if (aggregate === "count") return 1;
  const val = Number(row?.[field]);
  if (Number.isNaN(val)) return 0;
  return val;
}

function evaluateChartWidget(widget, filteredRows) {
  const aggregate = widget.aggregate || "count";
  const groupBy = widget.groupByField;
  const buildSeries = (name, extraFilter) => {
    const subset = filteredRows.filter((row) => {
      if (!extraFilter) return true;
      return Object.entries(extraFilter).every(([k, v]) => row?.[k] === v);
    });
    const buckets = new Map();
    subset.forEach((row) => {
      const key = groupBy ? row?.[groupBy] ?? "Unknown" : "All";
      const current = buckets.get(key) || { total: 0, count: 0, min: undefined, max: undefined };
      const val = aggregate === "count" ? 1 : Number(row?.[widget.valueField] ?? 0);
      if (aggregate === "count") {
        current.total += 1;
      } else if (!Number.isNaN(val)) {
        current.total += val;
        current.count += 1;
        current.min = current.min === undefined ? val : Math.min(current.min, val);
        current.max = current.max === undefined ? val : Math.max(current.max, val);
      }
      buckets.set(key, current);
    });
    const points = Array.from(buckets.entries())
      .map(([x, stats]) => {
        let y = 0;
        if (aggregate === "count") y = stats.total;
        if (aggregate === "sum") y = stats.total;
        if (aggregate === "avg") y = stats.count ? stats.total / stats.count : 0;
        if (aggregate === "min") y = stats.min ?? 0;
        if (aggregate === "max") y = stats.max ?? 0;
        return { x, y };
      })
      .sort((a, b) => (a.x > b.x ? 1 : -1));
    return { name, points };
  };

  const series = Array.isArray(widget.seriesConfig) && widget.seriesConfig.length
    ? widget.seriesConfig.map((s, idx) => buildSeries(s.name || `Series ${idx + 1}`, s.filter))
    : [buildSeries(widget.title || "Series", null)];

  const hasData = series.some((s) => s.points.length > 0 && s.points.some((p) => p.y !== 0));
  return { id: widget.id, type: widget.type, hasData, series };
}

function applyWidgetFilter(row, widget, dateRange) {
  if (!row) return false;
  if (widget.filter && typeof widget.filter === "object") {
    const keys = Object.keys(widget.filter);
    for (const key of keys) {
      if (row[key] !== widget.filter[key]) return false;
    }
  }
  if (widget.dateField && dateRange && (dateRange.from || dateRange.to)) {
    const val = row[widget.dateField];
    if (!val) return false;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return false;
    if (dateRange.from && d < dateRange.from) return false;
    if (dateRange.to && d > dateRange.to) return false;
  }
  return true;
}
