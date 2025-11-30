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

const buildDashboardComponent = (widgets) => {
  if (!widgets.length) return "";
  const widgetMarkup = widgets.map((widget) => indentSnippet(widget.codeSnippet, 6)).join("\n\n");
  return `import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

export function GeneratedDashboard({ data = {} }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
${widgetMarkup}
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
        "You are a B2B SaaS data architect. Given a dashboard idea, respond with pure JSON describing fields. Only use these fieldType values: Text, Number, Currency, Date, Boolean, Email, URL, Dropdown, Multi-select, Percentage. Create 6-10 thoughtful fields.",
    },
    {
      role: "user",
      content: `Dashboard name: ${name}\nDescription: ${description}\nRespond with {\"fields\": [{fieldName, fieldType, description, sampleData, required}]}`,
    },
  ];

  let aiContent = null;
  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: promptMessages,
      temperature: 0.4,
      max_tokens: 600,
    });
    aiContent = completion.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("dashboard generation failed", err.message);
  }

  const parsed = extractJsonPayload(aiContent);
  const rawFields = Array.isArray(parsed?.fields) && parsed.fields.length ? parsed.fields : FALLBACK_FIELDS;
  const normalized = rawFields.map((field, index) => normalizeField(field, index)).slice(0, 12);
  const fields = normalized.length ? normalized : FALLBACK_FIELDS.map((field, index) => normalizeField(field, index));
  const widgets = buildWidgetBlueprints(fields);
  const componentCode = buildDashboardComponent(widgets);
  return { fields, widgets, componentCode };
}

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

export async function saveDashboard({ sessionId, userId, name, description, fields, widgets, componentCode }) {
  if (!sessionId && !userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  if (!Array.isArray(fields) || !fields.length) {
    throw new HttpError(400, "fields are required");
  }
  const normalizedFields = fields.map((f, idx) => normalizeField(f, idx));
  const payload = await insertDashboard({
    sessionId: sessionId || null,
    userId: userId || null,
    name,
    description: description || "",
    fields: normalizedFields,
    widgets: sanitizeWidgets(widgets, normalizedFields),
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
