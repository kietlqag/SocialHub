import { useEffect, useMemo, useState } from "react";
import { dashboardProfiles, type MetricConfig } from "./profiles";

export type MetricValue = {
  key: string;
  label: string;
  value: number | string;
  icon?: MetricConfig["icon"];
  description?: string;
  sourceTable?: string;
};

type Params = {
  projectType: string;
  selectedTables?: string[];
  description?: string;
  hasData?: boolean;
};

// Heuristic to guess profile purely from business description.
const inferProfile = (projectType: string, description?: string) => {
  const normalized = `${projectType} ${description || ""}`.toLowerCase();
  if (normalized.includes("hospital") || normalized.includes("clinic") || normalized.includes("patient")) return "hospital";
  if (normalized.includes("school") || normalized.includes("education") || normalized.includes("class") || normalized.includes("student"))
    return "school";
  if (normalized.includes("hr") || normalized.includes("human resource") || normalized.includes("employee")) return "hr";
  if (normalized.includes("crm") || normalized.includes("sales") || normalized.includes("pipeline") || normalized.includes("deal"))
    return "crm";
  if (
    normalized.includes("store") ||
    normalized.includes("shop") ||
    normalized.includes("retail") ||
    normalized.includes("ecommerce") ||
    normalized.includes("commerce")
  )
    return "store";
  return projectType || "crm"; // default to sales-style KPIs instead of metadata.
};

const getProfileMetrics = (projectType: string) => {
  const profile = dashboardProfiles.find((p) => p.type === projectType);
  if (profile) return profile.metrics;
  // fallback to CRM-ish business KPIs (still business, not metadata)
  const fallback = dashboardProfiles.find((p) => p.type === "crm");
  return fallback ? fallback.metrics : [];
};

function fakeValueForMetric(key: string): number {
  // Deterministic-ish mock so UI looks consistent.
  const seed = Array.from(key).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = 10 + (seed % 90);
  if (key.toLowerCase().includes("revenue")) return base * 1000;
  if (key.toLowerCase().includes("rate")) return Math.min(100, 70 + (seed % 25));
  return base;
}

export function useDynamicDashboardMetrics({ projectType, selectedTables = [], description, hasData = true }: Params) {
  const resolvedType = inferProfile(projectType, description);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricValue[]>([]);

  const availableMetrics = useMemo(() => getProfileMetrics(resolvedType), [resolvedType]);

  useEffect(() => {
    if (!hasData) {
      setMetrics([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const normalizedTables = selectedTables.map((t) => t.toLowerCase().trim()).filter(Boolean);

    // Filter metrics by selected tables (optional). If none or no matches, fall back to all domain KPIs.
    const filtered =
      normalizedTables.length > 0
        ? availableMetrics.filter(
            (m) => !m.sourceTable || normalizedTables.includes(m.sourceTable.toLowerCase().trim())
          )
        : availableMetrics;

    const finalMetrics = filtered.length > 0 ? filtered : availableMetrics;

    // Simulate fetch; replace with real API per metric later.
    const resolved: MetricValue[] = finalMetrics.map((m) => ({
      key: m.key,
      label: m.label,
      icon: m.icon,
      description: m.description,
      sourceTable: m.sourceTable,
      value: fakeValueForMetric(m.key),
    }));

    setMetrics(resolved);
    setLoading(false);
  }, [availableMetrics, selectedTables, hasData]);

  return { metrics, loading };
}
