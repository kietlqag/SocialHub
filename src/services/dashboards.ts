import { api } from "./api";
import type {
  Dashboard as SharedDashboard,
  FieldDefinition,
  WidgetConfig,
  WidgetResult,
} from "../../shared/types/dashboard";

export type DashboardWidget = WidgetConfig;

export type DashboardField = FieldDefinition & {
  id?: string;
  name?: string;
  fieldName?: string;
  fieldType?: string;
  description?: string;
  sampleData?: string;
};

export type DashboardTable = {
  id?: string;
  key?: string;
  name: string;
  description?: string;
  purpose?: string;
  actions?: string[];
  kpis?: { label: string; value: string; trend?: string }[];
  recommendedWidgets?: string[];
  fields: DashboardField[];
  sampleRows?: Record<string, any>[];
};

export type Dashboard = SharedDashboard & {
  id: string;
  fields?: DashboardField[];
  tables?: DashboardTable[];
  componentCode?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  relationships?: Array<{
    fromTableKey: string;
    fromFieldKey: string;
    toTableKey: string;
    toFieldKey: string;
    type: string;
  }>;
  ui?: {
    defaultTableKey?: string;
    tableDropdownOrder?: string[];
    emptyStateText?: string;
  };
};

export type GeneratedDashboardStructure = {
  dashboardId: string;
  name: string;
  type?: string;
  description?: string;
  tables: DashboardTable[];
  relationships?: Array<{
    fromTableKey: string;
    fromFieldKey: string;
    toTableKey: string;
    toFieldKey: string;
    type: string;
  }>;
  ui?: {
    defaultTableKey?: string;
    tableDropdownOrder?: string[];
    emptyStateText?: string;
  };
  widgets?: DashboardWidget[];
  componentCode?: string;
};

export type DashboardDataResponse = {
  dashboardId: string;
  widgets: WidgetResult[];
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
  generate: (payload: {
    name: string;
    description: string;
    type?: string;
    sessionId: string;
    userId?: string | null;
    fileProvided?: boolean;
    inferredSchema?: InferredSchema;
  }) =>
    api.post<GeneratedDashboardStructure>("/api/dashboards/generate", payload),
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
  }) => api.post<{ dashboard: Dashboard }>("/api/dashboards", payload),
  list: (sessionId: string, userId?: string | null) =>
    api.get<{ dashboards: Dashboard[] }>(`/api/dashboards${withOwnerParams(sessionId, userId || undefined)}`),
  delete: (id: string, sessionId: string, userId?: string | null) =>
    api.delete<{ success: boolean }>(`/api/dashboards/${id}${withOwnerParams(sessionId, userId || undefined)}`),
  listRecords: (params: { dashboardId: string; tableKey: string; sessionId?: string; userId?: string | null }) => {
    const query = new URLSearchParams();
    query.set("dashboardId", params.dashboardId);
    query.set("tableKey", params.tableKey);
    if (params.sessionId) query.set("sessionId", params.sessionId);
    if (params.userId) query.set("userId", params.userId);
    return api.get<{ records: Record<string, any>[] }>(`/api/records?${query.toString()}`);
  },
  addRecord: (payload: {
    dashboardId: string;
    tableKey: string;
    record: Record<string, any>;
    sessionId: string;
    userId?: string | null;
  }) =>
    api.post<{ record: { id: string; tableKey: string; record: Record<string, any> } }>(
      `/api/dashboards/${payload.dashboardId}/records`,
      payload,
    ),
  createDashboardRecord: (dashboardId: string, tableKey: string, record: Record<string, any>, sessionId?: string, userId?: string | null) => {
    const query = new URLSearchParams();
    if (sessionId) query.set("sessionId", sessionId);
    if (userId) query.set("userId", userId);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    const body = {
      tableKey,
      table: tableKey,
      record,
      data: record,
    };
    return api.post<{ record: Record<string, any> }>(`/api/dashboards/${dashboardId}/records${queryString}`, body);
  },
  updateDashboardRecord: (
    dashboardId: string,
    tableKey: string,
    recordId: string,
    record: Record<string, any>,
    sessionId?: string,
    userId?: string | null,
  ) => {
    const query = new URLSearchParams();
    if (sessionId) query.set("sessionId", sessionId);
    if (userId) query.set("userId", userId);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return api.put<{ record: Record<string, any> }>(
      `/api/tables/${tableKey}/records/${recordId}${queryString}`,
      { record },
    );
  },
  deleteDashboardRecord: (dashboardId: string, tableKey: string, recordId: string, sessionId?: string, userId?: string | null) => {
    const query = new URLSearchParams();
    if (sessionId) query.set("sessionId", sessionId);
    if (userId) query.set("userId", userId);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return api.delete<{ success: boolean }>(`/api/tables/${tableKey}/records/${recordId}${queryString}`);
  },
  getDashboardData: (dashboardId: string, params: { sessionId?: string; userId?: string | null; from?: string; to?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.sessionId) query.set("sessionId", params.sessionId);
    if (params.userId) query.set("userId", params.userId);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    return api.get<DashboardDataResponse>(`/api/dashboards/${dashboardId}/data${query.toString() ? `?${query.toString()}` : ""}`);
  },
};
