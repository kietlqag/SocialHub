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

export type Dashboard = {
  id: string;
  name: string;
  description?: string;
  fields: DashboardField[];
  widgets?: DashboardWidget[];
  componentCode?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type GeneratedDashboardStructure = {
  fields: DashboardField[];
  widgets: DashboardWidget[];
  componentCode: string;
};

const withOwnerParams = (sessionId: string, userId?: string) => {
  const params = new URLSearchParams();
  if (sessionId) params.set("sessionId", sessionId);
  if (userId) params.set("userId", userId);
  return params.toString() ? `?${params.toString()}` : "";
};

export const dashboardApi = {
  generate: (payload: { name: string; description: string }) =>
    api.post<GeneratedDashboardStructure>("/dashboards/generate", payload),
  create: (payload: {
    name: string;
    description: string;
    fields: DashboardField[];
    sessionId: string;
    userId?: string | null;
    widgets?: DashboardWidget[];
    componentCode?: string;
  }) => api.post<{ dashboard: Dashboard }>("/dashboards", payload),
  list: (sessionId: string, userId?: string | null) =>
    api.get<{ dashboards: Dashboard[] }>(`/dashboards${withOwnerParams(sessionId, userId || undefined)}`),
  delete: (id: string, sessionId: string, userId?: string | null) =>
    api.delete<{ success: boolean }>(`/dashboards/${id}${withOwnerParams(sessionId, userId || undefined)}`),
};
