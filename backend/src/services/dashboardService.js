import OpenAI from "openai";
import { randomUUID } from "crypto";
import { HttpError } from "../utils/httpError.js";
import {
  insertDashboard,
  listDashboardsForOwner,
  deleteDashboardForOwner,
  updateDashboardForOwner,
} from "../repositories/dashboardRepository.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

const ALWAYS_INCLUDED_TABLES = ["customers", "orders", "projects"];

const selectTableTemplates = (description) => {
  const normalized = (description || "").toString().toLowerCase();
  const includeKeys = new Set(ALWAYS_INCLUDED_TABLES);
  TABLE_LIBRARY.forEach((template) => {
    if (template.keywords.some((keyword) => normalized.includes(keyword))) {
      includeKeys.add(template.key);
    }
  });
  const selected = [];
  TABLE_LIBRARY.forEach((template) => {
    if (includeKeys.has(template.key)) {
      selected.push(template);
    }
  });
  if (selected.length < 4) {
    TABLE_LIBRARY.forEach((template) => {
      if (selected.length >= 4) return;
      if (!includeKeys.has(template.key)) {
        selected.push(template);
        includeKeys.add(template.key);
      }
    });
  }
  return selected;
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
    sampleData: "John Smith",
    required: true,
  },
  {
    fieldName: "Email",
    fieldType: "Email",
    description: "Customer email address",
    sampleData: "john.smith@example.com",
    required: true,
  },
  {
    fieldName: "Purchase Amount",
    fieldType: "Currency",
    description: "Total purchase amount",
    sampleData: "$1,234.56",
    required: true,
  },
  {
    fieldName: "Purchase Date",
    fieldType: "Date",
    description: "Date of purchase",
    sampleData: "2024-11-24",
    required: true,
  },
  {
    fieldName: "Status",
    fieldType: "Dropdown",
    description: "Order status",
    sampleData: "Completed",
    required: true,
  },
  {
    fieldName: "Customer Lifetime Value",
    fieldType: "Currency",
    description: "Total value of all customer purchases",
    sampleData: "$5,678.90",
    required: false,
  },
  {
    fieldName: "Subscription Active",
    fieldType: "Boolean",
    description: "Whether customer has active subscription",
    sampleData: "Yes",
    required: false,
  },
  {
    fieldName: "Referral Source",
    fieldType: "Dropdown",
    description: "How customer found us",
    sampleData: "Google Ads",
    required: false,
  },
];

const normalizeField = (field, index) => ({
  id: field.id || randomUUID(),
  fieldName: (field.fieldName || `Field ${index + 1}`).toString().slice(0, 80),
  fieldType: SUPPORTED_TYPES.includes(field.fieldType) ? field.fieldType : "Text",
  description: field.description?.toString().slice(0, 200) || "",
  sampleData: field.sampleData?.toString().slice(0, 80) || "",
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
  const sampleValue = escapeForJsx(field.sampleData || "");
  return `<Card key="${field.id}" className="h-full">
      <CardHeader>
        <CardTitle>${escapeForJsx(field.fieldName)}</CardTitle>${descriptionLine}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{data?.${dataKey} ?? "${sampleValue || "—"}"}</p>
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

function extractJsonPayload(text) {
  if (!text) return null;
  const match = text.match(/```json([\s\S]*?)```/i);
  const jsonString = match ? match[1] : text;
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    return null;
  }
}

export async function generateDashboardFields({ name, description }) {
  if (!name?.trim() || !description?.trim()) {
    throw new HttpError(400, "Name and description are required");
  }
  const client = requireOpenAI();
  const promptMessages = [
    {
      role: "system",
    content:
        'You are a B2B ops data architect. Given a dashboard idea, respond with JSON only. Include a "tables" array describing at least 4 data tables (e.g., Customers, Orders, Projects, Finance, Inventory). Each table should include name, description, purpose, actions[], kpis[] (label, value, trend), recommendedWidgets[], and fields[]. Fields should use only the following types: Text, Number, Currency, Date, Boolean, Email, URL, Dropdown, Multi-select, Percentage.',
    },
    {
      role: "user",
      content: `Dashboard name: ${name}\nDescription: ${description}\nReturn only JSON with the tables and their fields.`,
    },
  ];

  let aiContent = null;
  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: promptMessages,
      temperature: 0.4,
      max_tokens: 800,
    });
    aiContent = completion.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("dashboard generation failed", err.message);
  }

  const parsed = extractJsonPayload(aiContent);
  const aiTables = sanitizeTables(parsed?.tables);
  const tables = aiTables.length ? aiTables : selectTableTemplates(description).map(buildTableBlueprint);
  const fields = tables.flatMap((table) => table.fields);
  const widgets = buildWidgetBlueprints(fields);
  const componentCode = buildDashboardComponent(tables, widgets);
  return { fields, tables, widgets, componentCode };
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
  return listDashboardsForOwner({ sessionId, userId });
}

export async function removeDashboard(id, { sessionId, userId }) {
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  const deleted = await deleteDashboardForOwner(id, { sessionId, userId });
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
