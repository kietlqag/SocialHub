import { api } from "./api";

export type DashboardField = {
  id: string;
  fieldName: string;
  fieldType: string;
  description?: string;
  sampleData?: string;
  required: boolean;
};

export type DashboardWidget = {
  fieldId: string;
  title: string;
  fieldType: string;
  dataKey: string;
  description?: string;
  codeSnippet: string;
};

export type DashboardTable = {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  actions?: string[];
  kpis?: { label: string; value: string; trend?: string }[];
  recommendedWidgets?: string[];
  fields: DashboardField[];
  sampleRows?: Record<string, any>[];
};

export type Dashboard = {
  id: string;
  name: string;
  description?: string;
  fields: DashboardField[];
  widgets?: DashboardWidget[];
  tables?: DashboardTable[];
  componentCode?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type GeneratedDashboardStructure = {
  fields: DashboardField[];
  tables: DashboardTable[];
  widgets: DashboardWidget[];
  componentCode: string;
};

type InferredSchema = {
  fileName: string;
  fileType: "csv" | "excel";
  tables: Array<{
    name: string;
    columns: Array<{ name: string; inferredType: "number" | "string" | "date" | "boolean" | "mixed" }>;
    numericFields: string[];
    sampleRows: Record<string, any>[];
  }>;
};

const withOwnerParams = (sessionId: string, userId?: string) => {
  const params = new URLSearchParams();
  if (sessionId) params.set("sessionId", sessionId);
  if (userId) params.set("userId", userId);
  return params.toString() ? `?${params.toString()}` : "";
};

export const dashboardApi = {
  generate: (payload: { name: string; description: string; type?: string; fileProvided?: boolean; inferredSchema?: InferredSchema }) =>
    api.post<GeneratedDashboardStructure>("/dashboards/generate", payload),
  create: (payload: {
    name: string;
    description: string;
    fields: DashboardField[];
    sessionId: string;
    userId?: string | null;
    widgets?: DashboardWidget[];
    tables?: DashboardTable[];
    componentCode?: string;
    type?: string;
  }) => api.post<{ dashboard: Dashboard }>("/dashboards", payload),
  list: (sessionId: string, userId?: string | null) =>
    api.get<{ dashboards: Dashboard[] }>(`/dashboards${withOwnerParams(sessionId, userId || undefined)}`),
  delete: (id: string, sessionId: string, userId?: string | null) =>
    api.delete<{ success: boolean }>(`/dashboards/${id}${withOwnerParams(sessionId, userId || undefined)}`),
};
