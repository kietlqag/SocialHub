import {
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  GraduationCap,
  HeartPulse,
} from "lucide-react";
import type { Dashboard, DashboardField } from "../../services/dashboards";
import type { DashboardCardIconPreset } from "./DashboardCard";

export type DashboardDomain = "healthcare" | "commerce" | "analytics" | "education" | "general";

export type DomainVisual = DashboardCardIconPreset & {
  label: string;
};

export type DecoratedDashboard = Dashboard & {
  fieldCount: number;
  widgetCount: number;
  tableCount: number;
  createdLabel: string;
  updatedLabel: string | null;
  domain: DashboardDomain;
  domainLabel: string;
  iconPreset: DomainVisual;
  statusLabel: string;
  lastViewedLabel: string | null;
  displayTitle: string;
  overviewCount: number;
  insightsCount: number;
  ownerName?: string;
};

export const domainVisuals: Record<DashboardDomain, DomainVisual> = {
  healthcare: { Icon: HeartPulse, toneClass: "tone-healthcare", label: "Healthcare" },
  commerce: { Icon: ShoppingCart, toneClass: "tone-commerce", label: "Commerce" },
  analytics: { Icon: BarChart3, toneClass: "tone-analytics", label: "Analytics" },
  education: { Icon: GraduationCap, toneClass: "tone-education", label: "Education" },
  general: { Icon: LayoutDashboard, toneClass: "tone-general", label: "Dashboard" },
};

export const detectDashboardDomain = (
  dashboard: Pick<Dashboard, "name" | "description" | "type">,
): DashboardDomain => {
  const normalized = `${dashboard.type || ""} ${dashboard.name || ""} ${dashboard.description || ""}`.toLowerCase();
  if (normalized.includes("health") || normalized.includes("clinic") || normalized.includes("patient")) return "healthcare";
  if (
    normalized.includes("commerce") ||
    normalized.includes("e-commerce") ||
    normalized.includes("ecommerce") ||
    normalized.includes("shop") ||
    normalized.includes("store") ||
    normalized.includes("sale") ||
    normalized.includes("order") ||
    normalized.includes("orders") ||
    normalized.includes("customer") ||
    normalized.includes("customers") ||
    normalized.includes("product") ||
    normalized.includes("products") ||
    normalized.includes("cart") ||
    normalized.includes("saas")
  )
    return "commerce";
  if (normalized.includes("analytics") || normalized.includes("insight") || normalized.includes("kpi") || normalized.includes("finance")) return "analytics";
  if (normalized.includes("school") || normalized.includes("education") || normalized.includes("student") || normalized.includes("class")) return "education";
  return "general";
};

export const decorateDashboardForList = (dashboard: Dashboard): DecoratedDashboard => {
  const tableFields = Array.isArray(dashboard.tables)
    ? dashboard.tables.flatMap((t) => (t.fields as DashboardField[] | undefined) || [])
    : [];
  const fieldCount = dashboard.fields?.length ? dashboard.fields.length : tableFields.length;
  const widgets = Array.isArray(dashboard.widgets) ? dashboard.widgets : [];

  const metricWidgets = widgets.filter((w: any) => {
    const type = (w.type || "").toString().toLowerCase();
    const variant = (w.variant || "").toString().toLowerCase();
    return !w.hidden && (type === "metric" || variant === "metric");
  });
  const metricCount = metricWidgets.length;

  const chartWidgets = widgets.filter((w: any) => {
    const type = (w.type || "").toString().toLowerCase();
    const variant = (w.variant || "").toString().toLowerCase();
    const visualType = (w.visualType || "").toString().toLowerCase();
    return (
      !w.hidden &&
      (type === "chart" ||
        variant === "chart" ||
        type.includes("chart") ||
        variant.includes("chart") ||
        visualType.includes("chart"))
    );
  });
  const chartCount = chartWidgets.length;
  const widgetCount = widgets.length;

  const insightsArr = Array.isArray((dashboard as any).insights) ? (dashboard as any).insights : [];
  const visibleInsightsCount = insightsArr.filter((i: any) => !(i as any)?.hidden).length;
  const totalInsightsCount = insightsArr.length;

  const tableCount = Array.isArray(dashboard.tables) ? dashboard.tables.length : 0;
  const insightsCount = chartCount || visibleInsightsCount || totalInsightsCount;
  const overviewCount = metricCount || widgetCount || Math.max(1, tableCount || 1);

  const domain = detectDashboardDomain(dashboard);
  const visual = domainVisuals[domain] ?? domainVisuals.general;

  const createdLabel = dashboard.createdAt ? new Date(dashboard.createdAt).toLocaleString() : "Just now";
  const updatedLabel = dashboard.updatedAt ? new Date(dashboard.updatedAt).toLocaleString() : null;
  const statusLabel = (dashboard as any).status || "Active";
  const displayTitle = dashboard.name?.trim() || visual.label;
  const ownerName = (dashboard as any).ownerName;

  return {
    ...dashboard,
    fieldCount,
    widgetCount,
    tableCount,
    overviewCount,
    insightsCount,
    createdLabel,
    updatedLabel,
    domain,
    domainLabel: visual.label,
    iconPreset: visual,
    statusLabel,
    lastViewedLabel: updatedLabel || createdLabel,
    displayTitle,
    ownerName,
  };
};
