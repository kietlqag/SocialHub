import { Dashboard, DashboardField, DashboardTable } from "../services/dashboards";

export type InsightChartType = "timeSeries" | "breakdown" | "funnel" | "distribution";

export interface InsightChartConfig {
  id: string;
  title: string;
  description?: string;
  type: InsightChartType;
  xField?: string;
  yField?: string;
  groupByField?: string;
  valueField?: string;
  timeRangeMode?: "last7Days" | "last30Days" | "last12Months";
}

export type DomainModel = {
  domain: "store" | "hospital" | "crm" | "hr" | "school" | "generic";
  tables: DashboardTable[];
};

const inferDomain = (dashboard: Dashboard): DomainModel["domain"] => {
  const txt = `${dashboard.name || ""} ${dashboard.description || ""}`.toLowerCase();
  if (txt.match(/hospital|clinic|patient|admission|bed/)) return "hospital";
  if (txt.match(/school|education|course|class/)) return "school";
  if (txt.match(/hr|human resource|employee|payroll|attendance/)) return "hr";
  if (txt.match(/crm|sales|deal|pipeline|opportunity/)) return "crm";
  if (txt.match(/store|retail|ecommerce|order|inventory|product/)) return "store";
  return "generic";
};

const hasFieldType = (fields: DashboardField[], keyword: string) => fields.some((f) => f.fieldType?.toLowerCase?.().includes(keyword));
const hasFieldName = (fields: DashboardField[], keyword: string) => fields.some((f) => (f.fieldName || "").toLowerCase().includes(keyword));

export function buildDomainModel(dashboard: Dashboard, tables: DashboardTable[]): DomainModel {
  return { domain: inferDomain(dashboard), tables };
}

export function generateInsightChartsFromDomain(domainModel: DomainModel): InsightChartConfig[] {
  const { domain, tables } = domainModel;
  const pickTableByName = (keys: string[]) =>
    tables.find((t) => keys.some((k) => (t.name || t.id || "").toLowerCase().includes(k))) || tables[0];

  const configs: InsightChartConfig[] = [];

  const pushTimeSeries = (id: string, title: string, opts?: Partial<InsightChartConfig>) =>
    configs.push({ id, title, type: "timeSeries", timeRangeMode: "last30Days", ...opts });
  const pushBreakdown = (id: string, title: string, opts?: Partial<InsightChartConfig>) =>
    configs.push({ id, title, type: "breakdown", timeRangeMode: "last30Days", ...opts });
  const pushDistribution = (id: string, title: string, opts?: Partial<InsightChartConfig>) =>
    configs.push({ id, title, type: "distribution", timeRangeMode: "last30Days", ...opts });

  if (domain === "store") {
    const orders = pickTableByName(["order"]);
    const products = pickTableByName(["product"]);
    pushTimeSeries("revenue-trend", "Revenue over time", { xField: "date", yField: "revenue", valueField: "revenue" });
    pushBreakdown("orders-by-status", "Orders by status", { groupByField: "status", valueField: "count" });
    pushBreakdown("sales-by-category", "Sales by category", { groupByField: "category", valueField: "revenue" });
    if (products) pushDistribution("top-products", "Top products by revenue", { groupByField: "product", valueField: "revenue" });
  } else if (domain === "hospital") {
    const patients = pickTableByName(["patient"]);
    pushTimeSeries("admissions-discharges", "Admissions vs Discharges", { xField: "date", yField: "count" });
    pushBreakdown("patients-by-dept", "Patients by department", { groupByField: "department", valueField: "count" });
    pushBreakdown("emergency-trend", "Emergency cases over time", { xField: "date", yField: "cases" });
    if (patients && (hasFieldType(patients.fields, "number") || hasFieldName(patients.fields, "severity"))) {
      pushDistribution("severity-mix", "Patients by severity", { groupByField: "severity", valueField: "count" });
    }
  } else if (domain === "crm") {
    pushTimeSeries("pipeline-value", "Pipeline value over time", { xField: "date", yField: "value" });
    pushBreakdown("deals-by-stage", "Deals by stage", { groupByField: "stage", valueField: "count" });
    pushBreakdown("deals-by-owner", "Deals by owner", { groupByField: "owner", valueField: "count" });
    pushDistribution("win-rate", "Win rate trend", { xField: "date", yField: "winRate" });
  } else if (domain === "hr") {
    pushTimeSeries("headcount-trend", "Headcount over time", { xField: "date", yField: "headcount" });
    pushBreakdown("new-hires-vs-exits", "New hires vs resignations", { groupByField: "status", valueField: "count" });
    pushBreakdown("attendance", "Attendance rate by team", { groupByField: "team", valueField: "attendance" });
  } else if (domain === "school") {
    pushTimeSeries("enrollment-trend", "Enrollment over time", { xField: "date", yField: "enrollments" });
    pushBreakdown("courses-by-category", "Courses by category", { groupByField: "category", valueField: "count" });
    pushBreakdown("assignments-status", "Assignments by status", { groupByField: "status", valueField: "count" });
  } else {
    pushTimeSeries("activity-trend", "Key metric over time", { xField: "date", yField: "value" });
    pushBreakdown("category-breakdown", "Breakdown by category", { groupByField: "category", valueField: "value" });
  }

  return configs.slice(0, 4);
}
