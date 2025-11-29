import { api } from "./api";
import { AuthResponse } from "./auth";

export type Organization = {
  id: string;
  ownerId: string;
  name: string;
  slug?: string;
  industry?: string;
  employeeCount?: number;
  dataVolume?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  role?: string;
};

export type DataSource = {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Dashboard = {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  aiSummary?: string;
  layout?: Record<string, unknown>[];
  status: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceProfile = {
  id: string;
  organizationId: string;
  name: string;
  serviceType: string;
  status: string;
  config: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type Recommendation = {
  id: string;
  organizationId: string;
  requestedBy?: string;
  prompt: Record<string, unknown>;
  result?: {
    summary?: string;
    dashboards?: Array<{
      title: string;
      description?: string;
      widgets?: Array<{ title: string; visualization: string; metric?: string; size?: string }>;
    }>;
    managedServices?: Array<{ serviceType: string; name: string; notes?: string }>;
  };
  status: string;
  createdAt?: string;
  completedAt?: string;
};

type Token = string;

const ensureToken = () => {
  const raw = sessionStorage.getItem("socialhub_auth_session") ?? localStorage.getItem("socialhub_auth_session");
  if (!raw) throw new Error("Please sign in to use the builder.");
  const parsed = JSON.parse(raw) as AuthResponse;
  if (!parsed?.token) throw new Error("Session token is invalid.");
  return parsed.token;
};

export const platformApi = {
  listOrganizations: async () => {
    const token = ensureToken();
    try {
      const res = await api.get<{ organizations: Organization[] }>("/orgs", token);
      return res.organizations;
    } catch (err) {
      if (err instanceof Error && err.message.includes("Not Found")) {
        return [];
      }
      throw err;
    }
  },
  createOrganization: async (payload: Partial<Organization>) => {
    const token = ensureToken();
    const res = await api.post<{ organization: Organization }>("/orgs", payload, token);
    return res.organization;
  },
  listDataSources: async (orgId: string) => {
    const token = ensureToken();
    const res = await api.get<{ dataSources: DataSource[] }>(`/orgs/${orgId}/datasources`, token);
    return res.dataSources;
  },
  createDataSource: async (orgId: string, payload: Partial<DataSource>) => {
    const token = ensureToken();
    const res = await api.post<{ dataSource: DataSource }>(`/orgs/${orgId}/datasources`, payload, token);
    return res.dataSource;
  },
  listDashboards: async (orgId: string) => {
    const token = ensureToken();
    const res = await api.get<{ dashboards: Dashboard[] }>(`/orgs/${orgId}/dashboards`, token);
    return res.dashboards;
  },
  createDashboard: async (orgId: string, payload: Partial<Dashboard>) => {
    const token = ensureToken();
    const res = await api.post<{ dashboard: Dashboard }>(`/orgs/${orgId}/dashboards`, payload, token);
    return res.dashboard;
  },
  listServices: async (orgId: string) => {
    const token = ensureToken();
    const res = await api.get<{ services: ServiceProfile[] }>(`/orgs/${orgId}/services`, token);
    return res.services;
  },
  createService: async (orgId: string, payload: Partial<ServiceProfile>) => {
    const token = ensureToken();
    const res = await api.post<{ service: ServiceProfile }>(`/orgs/${orgId}/services`, payload, token);
    return res.service;
  },
  createRecommendation: async (orgId: string, payload: Record<string, unknown>) => {
    const token = ensureToken();
    const res = await api.post<{ recommendation: Recommendation }>(`/orgs/${orgId}/recommendations`, payload, token);
    return res.recommendation;
  },
  listRecommendations: async (orgId: string) => {
    const token = ensureToken();
    const res = await api.get<{ recommendations: Recommendation[] }>(`/orgs/${orgId}/recommendations`, token);
    return res.recommendations;
  },
};




