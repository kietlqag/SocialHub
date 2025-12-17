import OpenAI from "openai";
import { randomUUID } from "crypto";
import { HttpError } from "../utils/httpError.js";
import {
  insertDashboard,
  listDashboardsForOwner,
  deleteDashboardForOwner,
  updateDashboardForOwner,
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
} from "../repositories/dashboardRecordRepository.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MIN_TABLES = 2;
const MAX_TABLES = 12;

const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

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

const sanitizeTables = (tables = []) => {
  if (!Array.isArray(tables)) return [];
  return tables
    .map((table, tableIndex) => {
      const normalizedFields =
        Array.isArray(table.fields) && table.fields.length
          ? table.fields.map((field, fieldIndex) => normalizeField(field, fieldIndex))
          : FALLBACK_FIELDS.map((field, index) => normalizeField(field, index));
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
      };
    })
    .filter((table) => table.fields.length);
};

const ensureSystemFields = (fields = []) => {
  const requiredKeys = ["_id", "created_at", "updated_at"];
  const existing = new Set(fields.map((f) => f.key));
  const system = [
    { key: "_id", type: "id", required: true },
    { key: "created_at", type: "date", required: true },
    { key: "updated_at", type: "date", required: true },
  ];
  const merged = [...fields];
  system.forEach((f) => {
    if (!existing.has(f.key)) {
      merged.unshift({ ...f, required: true });
      existing.add(f.key);
    }
  });
  return merged;
};

const allowedFieldTypes = ["id", "string", "number", "boolean", "date", "enum", "reference", "text"];

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
  let currentMessages = messages;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: currentMessages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      });
      const choice = completion.choices?.[0];
      const finish = choice?.finish_reason;
      const content = choice?.message?.content?.trim() || "";
      if (finish === "length") {
        throw new HttpError(502, "AI output truncated (finish_reason=length)");
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
      if (attempt >= 2) {
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
          return {
            ...field,
            key: fkey,
            type: normalizedType,
            required: Boolean(field.required),
            options: Array.isArray(field.options) ? field.options.slice(0, 20) : undefined,
            ref: field.ref || field.reference || undefined,
          };
        })
      : [];
    const withSystem = ensureSystemFields(normalizedFields);
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

    const fromFieldKey = mapField(fromTable, rel.fromFieldKey, rel.fromField);
    const toFieldKey = mapField(toTable, rel.toFieldKey, rel.toField);
    if (!fromTableKey || !toTableKey || !fromFieldKey || !toFieldKey || !rel.type) {
      errors.push(`Relationship ${idx + 1} is incomplete`);
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
      errors.push(`Relationship ${idx + 1} references missing fromFieldKey ${fromFieldKey}`);
    }
    if (toTable && toFieldKey && !toFieldExists) {
      errors.push(`Relationship ${idx + 1} references missing toFieldKey ${toFieldKey}`);
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
    widgets: normalizedWidgets,
  };

  const tablesForReturn = normalizedTables.map(({ fieldKeyByName, ...rest }) => rest);

  return { tables: tablesForReturn, relationships: normalizedRelationships, insights: normalizedInsights, ui };
}

async function generatePlan({ name, description, type }) {
  const libraryKeys = TABLE_LIBRARY.map((t) => `${t.key}:${t.name}`).join("; ");
  const messages = [
    {
      role: "system",
      content: `You are an AI planner for dynamic dashboards. Propose domain context, complexity, relevant table keys from a library, any custom tables, and insight goals.\nTable library keys you can reference: ${libraryKeys}.\nReturn ONLY valid JSON with: { domain, complexity("low"|"medium"|"high"), proposed_table_keys: string[], proposed_custom_tables:[{name, reason}], insight_goals:string[], confidence:number(0..1) }. No markdown/backticks.`,
    },
    {
      role: "user",
      content: `Dashboard name: ${name}\nDashboard type: ${type || ""}\nDescription: ${description}\nReturn JSON only.`,
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

async function generateSchemaAndInsights({ name, description, type, plan }) {
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
  const messages = [
    {
      role: "system",
      content: `You are an AI schema + insight generator for a modern dashboard. Use the provided plan and user description to build data tables, relationships, insights, and UI widget metadata.\nConstraints:\n- Max 10 tables, each max 10 fields (including system fields).\n- Max 8 insights, max 8 widgets.\nRequirements:\n- Return ONLY JSON. No markdown, no backticks, no explanation.\n- Tables: [{ key, name, description, fields:[{ key, type(id|string|number|boolean|date|enum|reference|text), required, options?, ref? }] }]\n- Relationships: [{ fromTableKey, fromFieldKey, toTableKey, toFieldKey, type("one-to-many"|"many-to-one"|"many-to-many") }]\n- Insights: [{ id, title, kind("kpi"|"trend"|"breakdown"|"table"), source:{ tableKey, metric("count"|"sum"|"avg"), fieldKey?, groupByFieldKey?, timeFieldKey? }, visualization?:{ chartType("line"|"bar"|"pie") } }]\n- UI: { defaultTableKey, tableDropdownOrder, emptyStateText, widgets:[{ id, type("stat_card"|"chart"|"data_table"), title, tableKey, insightId?, fields?, layout? }] }\n- Include system fields in every table: _id(id, required), created_at(date, required), updated_at(date, required).\n- Table library keys for inspiration (optional): ${libraryKeys}.`,
    },
    {
      role: "user",
      content: `Dashboard name: ${name}\nDashboard type: ${type || ""}\nDescription: ${description}\nPlan JSON: ${planJson}\nTable templates (optional to reuse/rename): ${JSON.stringify(
        templateHints,
      )}\nReturn JSON only.`,
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

export async function generateDashboardFields({ name, description, type }) {
  if (!name?.trim() || !description?.trim()) {
    throw new HttpError(400, "Name and description are required");
  }
  const plan = await generatePlan({ name, description, type });
  const blueprint = await generateSchemaAndInsights({ name, description, type, plan });
  const tables = blueprint.tables || [];
  const relationships = blueprint.relationships || [];
  const insights = blueprint.insights || [];
  const aiWidgets = Array.isArray(blueprint.ui?.widgets) ? blueprint.ui.widgets : [];
  const widgets = aiWidgets.length ? aiWidgets : buildDefaultWidgets(tables, insights);
  const ui = {
    ...(blueprint.ui || {}),
    widgets,
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

export async function generateAndPersistDashboard({ name, type, description, sessionId, userId }) {
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  const blueprint = await generateDashboardFields({ name, description, type });
  const dashboard = await insertDashboard({
    name,
    type,
    description,
    sessionId,
    userId,
  });
  await insertTables(dashboard.id, blueprint.tables);
  await insertRelationships(dashboard.id, blueprint.relationships);
  return {
    dashboardId: dashboard.id,
    name: dashboard.name,
    type: dashboard.type,
    description: dashboard.description,
    tables: blueprint.tables,
    relationships: blueprint.relationships,
    insights: blueprint.insights,
    ui: blueprint.ui,
    widgets: blueprint.widgets,
  };
}

export async function saveDashboard({ sessionId, userId, name, description, fields, widgets, componentCode, tables }) {
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
  });
  return payload;
}

export async function listDashboards({ sessionId, userId }) {
  if (!sessionId && !userId) return [];
  const dashboards = await listDashboardsForOwner({ sessionId, userId });
  const withSchema = await Promise.all(
    dashboards.map(async (dash) => {
      const tables = await listTablesByDashboard(dash.id);
      const relationships = await listRelationshipsByDashboard(dash.id);
      const ui = dash.ui || {
        defaultTableKey: tables[0]?.key || "",
        tableDropdownOrder: tables.map((t) => t.key),
        emptyStateText: "No records yet. Click Add record to start.",
      };
      const insights = dash.insights || [];
      const widgets = dash.widgets || ui.widgets || buildDefaultWidgets(tables, insights);
      return { ...dash, tables, relationships, insights, ui: { ...ui, widgets }, widgets };
    }),
  );
  return withSchema;
}

export async function removeDashboard(id, { sessionId, userId }) {
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
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
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  const next = await updateDashboardForOwner(id, { sessionId, userId }, updates);
  if (!next) {
    throw new HttpError(404, "Dashboard not found");
  }
  return next;
}

export async function addDashboardRecord({ dashboardId, tableKey, record, sessionId, userId }) {
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  if (!dashboardId || !tableKey || !record || typeof record !== "object") {
    throw new HttpError(400, "dashboardId, tableKey, and record are required");
  }
  // verify ownership
  const dashboards = await listDashboardsForOwner({ sessionId, userId });
  const exists = dashboards.find((d) => d.id === dashboardId);
  if (!exists) {
    // Ownership check failed or dashboard missing; return empty set instead of 404 to keep UI empty-state friendly
    return [];
  }
  const inserted = await insertDashboardRecord({ dashboardId, tableKey, record });
  return inserted;
}

export async function listDashboardRecords({ dashboardId, tableKey, sessionId, userId }) {
  if (!dashboardId || !tableKey) {
    throw new HttpError(400, "dashboardId and tableKey are required");
  }
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  const dashboards = await listDashboardsForOwner({ sessionId, userId });
  const exists = dashboards.find((d) => d.id === dashboardId);
  if (!exists) {
    throw new HttpError(404, "Dashboard not found");
  }
  const records = await listRecordsByDashboard({ dashboardId, tableKey });
  return records || [];
}
