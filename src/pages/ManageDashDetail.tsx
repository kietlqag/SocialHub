import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  ArrowLeft,
  BarChart2,
  BarChart3,
  Clock,
  DollarSign,
  Filter,
  LineChart,
  ShoppingCart,
  PieChart,
  Plus,
  Eye,
  Pencil,
  Search,
  Table as TableIcon,
  Trash2,
  Users,
  X,
  Settings2,
  MoreHorizontal,
  Layers3,
  ChartBar,
  BarChartHorizontal,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dashboardApi, type Dashboard, type DashboardTable, type DashboardField } from "../services/dashboards";
import type { WidgetConfig, WidgetResult } from "../../shared/types/dashboard";
import { fetchMe, getCurrentSession, clearSession, type AuthUser } from "../services/auth";
import {
  ResponsiveContainer as ReResponsiveContainer,
  LineChart as ReLineChart,
  Line as ReLine,
  XAxis as ReXAxis,
  YAxis as ReYAxis,
  CartesianGrid as ReCartesianGrid,
  Tooltip as ReTooltip,
  Legend as ReLegend,
  BarChart as ReBarChart,
  Bar as ReBar,
  PieChart as RePieChart,
  Pie as RePie,
  Cell as ReCell,
} from "recharts";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { generateDetailedInsights, type InsightWidget, type TableSchema } from "../dashboard/insightGenerator";
import { useDynamicDashboardMetrics } from "../dashboard/useDynamicDashboardMetrics";
import { Input } from "../components/ui/input";
import { EditTableStructureModal } from "../components/EditTableStructureModal";
import { CreateTableModal } from "../components/CreateTableModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import "../styles/managedash-detail.css";
import { SYSTEM_FIELDS, isSystemField } from "../../shared/systemFields";
import { useTableFilters, type FilterGroup } from "../components/table/filters/useTableFilters";
import { TableFiltersModal } from "../components/table/filters/TableFiltersModal";
import { AccessControlTab } from "../components/dashboard/AccessControlTab";
import { useDashboardPermissions } from "../dashboard/useDashboardPermissions";

const SYSTEM_KEYS = new Set(["id", "_id", "created_at", "updated_at"]);
const DASHBOARD_SESSION_KEY = "socialhub:dashboards_session";
const getSessionId = () => {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(DASHBOARD_SESSION_KEY);
  if (existing) return existing;
  const generated = (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^?z0-9-]/gi, "");
  localStorage.setItem(DASHBOARD_SESSION_KEY, generated);
  return generated;
};

type MetricCardProps = {
  icon: LucideIcon;
  title: string;
  value?: string | number;
  description?: string;
  onDelete?: (() => void) | null;
  deletable?: boolean;
  className?: string;
};

type NormalizedField = {
  key: string;
  type: string;
  required?: boolean;
  enumValues?: string[];
  label: string;
  isId: boolean;
  isReference?: boolean;
  referenceTableKey?: string | null;
  original: any;
};

type MetricAggregation = "sum" | "avg" | "min" | "max" | "count";
type MetricType =
  | "sum"
  | "average"
  | "min"
  | "max"
  | "count"
  | "sum_conditional"
  | "average_conditional"
  | "count_conditional";

type ConditionOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "ne" | "contains" | "between";

type WidgetCondition = {
  field: string;
  operator: ConditionOperator;
  value: string | number;
  value2?: string | number;
};

type MetricIcon = "money" | "analytics" | "trend" | "cart" | "users" | "star";

type ChartType = "line" | "bar" | "pie" | "horizontal-bar";

type ChartTemplateConfig = {
  id: string;
  label: string;
  description: string;
  config: {
    title?: string;
    chartType?: ChartType | "table";
    metric?: "count" | "sum" | "average" | "min" | "max";
    metricField?: string;
    groupByField?: string;
    timeBucket?: "day" | "week" | "month" | "year";
  };
};

type ChartCardProps = {
  title: string;
  description?: string;
  type: ChartType;
  dataset?: Array<{ label: string; value: number }>;
  unit?: string;
  isLoading?: boolean;
  valueLabel?: string;
  onChangeType?: (next: ChartType) => void;
  onRemove?: () => void;
  readOnly?: boolean;
};

type AddWidgetFormState = {
  tableKey: string;
  columnKey: string;
  aggregation: MetricAggregation;
  metricType: MetricType;
  title: string;
  icon: MetricIcon;
  conditionField?: string;
  conditionOperator?: ConditionOperator;
  conditionValue?: string;
  conditionValue2?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const beautifyLabel = (text: string) =>
  text
    .replace(/([?z0-9])([?Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const getFieldKey = (field: any) => field.key || field.fieldName || field.name || field.id || "";

const displayFieldName = (field: any) => field.fieldName || field.name || field.key || field.id || "Field";

const isSystemKey = (key = "") => isSystemField({ key, type: undefined });

const isSelfReferencingId = (field: { key?: string; isReference?: boolean; referenceTableKey?: string | null }, tableKey?: string) => {
  // Only hide if it is a system-like key; user-defined reference IDs should remain visible.
  if (!field?.key || !tableKey) return false;
  if (!field.isReference) return false;
  if (!isSystemField(field)) return false;
  const target = field.referenceTableKey?.toLowerCase();
  return target && target === tableKey.toLowerCase();
};

const normalizeFieldVisibility = <T extends { key?: string; fieldName?: string; name?: string; system?: boolean; systemField?: boolean; visible?: boolean; visibleInTable?: boolean; hidden?: boolean }>(
  field: T,
): T & { visible: boolean; visibleInTable: boolean; hidden: boolean } => {
  const key = String(field.key || (field as any).fieldName || (field as any).name || "");
  const isSystem = field.system === true || field.systemField === true || SYSTEM_KEYS.has(key);
  const rawVisibleInTable = field.visibleInTable;
  const rawHidden = field.hidden;
  let visible: boolean;
  if (rawVisibleInTable !== undefined || rawHidden !== undefined) {
    if (rawHidden === true) visible = false;
    else if (rawVisibleInTable === false) visible = false;
    else visible = true;
  } else {
    visible = isSystem ? false : true;
  }
  return {
    ...field,
    visible,
    visibleInTable: visible,
    hidden: !visible,
  };
};

const getVisibleFields = (fields: any[] = []) =>
  fields.filter((f) => {
    const key = (f.key || f.fieldName || f.name || "").toString();
    const isSystem = isSystemFieldName(key) || isSystemKey(key);
    const visibleFlag = f.visible ?? f.visibleInTable;
    const isVisible = visibleFlag !== undefined ? visibleFlag !== false : isSystem ? false : true;
    if (!isVisible) return false;
    if (!key) return false;
    // keep foreign keys visible even if system-like
    if (isForeignKeyFieldName(key)) return true;
    return true;
  });

const formatMetricValue = (value: number | null | undefined, formatted?: string | null) => {
  if (value === null || value === undefined) return "No data yet";
  if (typeof formatted === "string" && formatted.length) return formatted;
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) : "No data yet";
};

const pickMetricIcon = (title: string, icon?: MetricIcon) => {
  if (icon === "money") return DollarSign;
  if (icon === "analytics") return BarChart2;
  if (icon === "trend" || icon === "star") return LineChart;
  if (icon === "cart") return ShoppingCart;
  if (icon === "users") return Users;
  const lower = title.toLowerCase();
  const moneyHints = ["revenue", "amount", "price", "cost", "payment", "billing", "bill", "invoice", "sale", "sales"];
  return moneyHints.some((hint) => lower.includes(hint)) ? DollarSign : BarChart2;
};

const formatValueWithUnit = (value: number, unit?: string) => {
  if (!Number.isFinite(value)) return "0";
  if (unit?.toLowerCase() === "vnd") {
    return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
};

const isNumericField = (field: any) => (field?.type || "").toLowerCase() === "number";
const isDateField = (field: any) => {
  const name = ((field?.name || field?.key || "") as string).toLowerCase();
  return (field?.type || "").toLowerCase() === "date" || /date|created_at|createdat|time|timestamp/.test(name);
};
const isStatusOrCategoryField = (field: any) => {
  const name = ((field?.name || field?.key || "") as string).toLowerCase();
  const type = (field?.type || "").toLowerCase();
  return ["string", "boolean", "enum"].includes(type) && /status|state|category|type|tag/.test(name);
};
const isForeignKeyField = (field: any) => {
  const name = ((field?.name || field?.key || "") as string);
  const lower = name.toLowerCase();
  return ["string", "number"].includes((field?.type || "").toLowerCase()) && /(_id$|id$)/i.test(name) && lower !== "_id";
};
const looksLikeMoneyField = (field: any) => {
  const name = ((field?.name || field?.key || "") as string).toLowerCase();
  return isNumericField(field) && /(amount|total|price|revenue|cost|payment|bill|salary)/.test(name);
};

const mapAggregationForMetricType = (metricType: MetricType): MetricAggregation => {
  if (metricType === "average" || metricType === "average_conditional") return "avg";
  if (metricType === "min") return "min";
  if (metricType === "max") return "max";
  if (metricType === "count" || metricType === "count_conditional") return "count";
  return "sum";
};

const getIconStyle = (icon?: MetricIcon) => {
  const palette: Record<MetricIcon, { bg: string; shadow: string }> = {
    money: { bg: "linear-gradient(135deg, #0ea5e9, #38bdf8)", shadow: "0 12px 22px rgba(14, 165, 233, 0.35)" },
    analytics: { bg: "linear-gradient(135deg, #6366f1, #8b5cf6)", shadow: "0 12px 22px rgba(99, 102, 241, 0.3)" },
    trend: { bg: "linear-gradient(135deg, #10b981, #34d399)", shadow: "0 12px 22px rgba(16, 185, 129, 0.3)" },
    cart: { bg: "linear-gradient(135deg, #f59e0b, #facc15)", shadow: "0 12px 22px rgba(245, 158, 11, 0.35)" },
    users: { bg: "linear-gradient(135deg, #8b5cf6, #a855f7)", shadow: "0 12px 22px rgba(139, 92, 246, 0.35)" },
    star: { bg: "linear-gradient(135deg, #f97316, #fb923c)", shadow: "0 12px 22px rgba(249, 115, 22, 0.35)" },
  };
  const found = icon ? palette[icon] : undefined;
  return found || palette.analytics;
};

const CHART_CARD_HEIGHT = 240;
const CHART_BODY_MIN_HEIGHT = 200;

const ChartCard = ({ title, description, type, dataset, unit, isLoading, hasData, valueLabel, onChangeType, onRemove, readOnly }: ChartCardProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const data = (dataset || [])
    .map((d) => ({
      label: d.label || "Unknown",
      value: Number.isFinite(d.value) ? d.value : 0,
    }))
    .filter((d) => Number.isFinite(d.value));

  const showEmpty = !isLoading && !data.length;
  const colors = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#F97316"];
  const hasMenuActions = !readOnly && (onChangeType || onRemove);

  return (
    <div
      className="mdChartCard modernChartCard"
      style={{
        minHeight: CHART_CARD_HEIGHT,
        height: CHART_CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
        transition: "transform 150ms ease, box-shadow 150ms ease",
        position: "relative",
      }}
    >
      <div className="mdChartHeader">
        <div>
          <p className="mdChartTitle">{title}</p>
          {description ? <p className="mdChartSubtitle">{description}</p> : null}
        </div>
        <div />
      </div>
      {hasMenuActions && (
        <>
          <button
            type="button"
            className="insightCloseBtn"
            aria-label="More"
            onClick={() => setMenuOpen((p) => !p)}
            style={{ position: "absolute", top: 10, right: 10 }}
          >
            <MoreHorizontal className="w-4 h-4 text-slate-500" />
          </button>
          {menuOpen && (
            <div
              className="tableCardGlass"
              style={{
                position: "absolute",
                top: 36,
                right: 12,
                minWidth: 170,
                padding: 6,
                zIndex: 20,
                boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
                borderRadius: 12,
              }}
            >
              <p className="mdMainSubtitle" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>Chart type</p>
              {onChangeType
                ? ([
                    { key: "bar", icon: ChartBar },
                    { key: "line", icon: LineChart },
                    { key: "pie", icon: PieChart },
                    { key: "horizontal-bar", icon: BarChartHorizontal },
                  ] as { key: ChartType; icon: LucideIcon }[]).map(({ key, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onChangeType?.(key);
                      }}
                      className="mdGhostBtn"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 10,
                        color: key === type ? "#4f46e5" : "#0f172a",
                        fontWeight: key === type ? 700 : 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      {beautifyLabel(key)}
                    </button>
                  ))
                : null}
              {onRemove ? (
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    className="mdGhostBtn text-red-600"
                    style={{ width: "100%", textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}
                    onClick={() => {
                      setMenuOpen(false);
                      onRemove?.();
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove chart
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
      <div
        style={{
          flex: 1,
          padding: "8px 12px 16px 0",
          width: "100%",
          minHeight: CHART_BODY_MIN_HEIGHT,
          height: CHART_BODY_MIN_HEIGHT,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 12,
          paddingRight: 12,
        }}
        className="fade-in"
      >
        {isLoading ? (
          <div className="h-full w-full rounded-lg bg-slate-100 animate-pulse p-3 space-y-3">
            <div className="h-3 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-200" />
            <div className="h-3 w-5/6 rounded bg-slate-200" />
            <div className="h-3 w-1/3 rounded bg-slate-200" />
          </div>
        ) : showEmpty ? (
          <div className="flex h-full items-center justify-center flex-col text-slate-500 fade-in">
            <div className="h-12 w-12 rounded-full border border-dashed border-slate-300 flex items-center justify-center mb-3">
              <BarChart2 className="w-5 h-5 opacity-70" />
            </div>
            <p className="text-sm">No data yet for this period</p>
          </div>
        ) : type === "pie" ? (
          <ReResponsiveContainer width="100%" height={CHART_BODY_MIN_HEIGHT}>
            <RePieChart>
              <RePie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
              >
                {data.map((_, idx) => (
                  <ReCell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
                ))}
              </RePie>
              <ReTooltip
                formatter={(v: any) => formatValueWithUnit(Number(v), unit)}
                labelFormatter={(label: any) => String(label)}
              />
              <ReLegend verticalAlign="bottom" height={24} />
            </RePieChart>
          </ReResponsiveContainer>
        ) : type === "horizontal-bar" ? (
          <ReResponsiveContainer width="100%" height={CHART_BODY_MIN_HEIGHT}>
            <ReBarChart data={data} layout="vertical" margin={{ left: 18, right: 12, top: 8, bottom: 8 }}>
              <ReCartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <ReXAxis type="number" tickFormatter={(v) => formatValueWithUnit(Number(v), unit)} />
              <ReYAxis type="category" dataKey="label" width={90} />
              <ReTooltip formatter={(v: any) => formatValueWithUnit(Number(v), unit)} />
              <ReLegend />
              <ReBar name={valueLabel || "Value"} dataKey="value" radius={[6, 6, 6, 6]} fill={colors[0]} animationDuration={400} />
            </ReBarChart>
          </ReResponsiveContainer>
        ) : type === "line" ? (
          <ReResponsiveContainer width="100%" height={CHART_BODY_MIN_HEIGHT}>
            <ReLineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
              <ReCartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <ReXAxis dataKey="label" />
              <ReYAxis tickFormatter={(v) => formatValueWithUnit(Number(v), unit)} />
              <ReTooltip formatter={(v: any) => formatValueWithUnit(Number(v), unit)} />
              <ReLegend />
              <ReLine name={valueLabel || "Value"} type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2.2} dot={{ r: 3 }} />
            </ReLineChart>
          </ReResponsiveContainer>
        ) : (
          <ReResponsiveContainer width="100%" height={CHART_BODY_MIN_HEIGHT}>
            <ReBarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
              <ReCartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <ReXAxis dataKey="label" />
              <ReYAxis tickFormatter={(v) => formatValueWithUnit(Number(v), unit)} />
              <ReTooltip formatter={(v: any) => formatValueWithUnit(Number(v), unit)} />
              <ReLegend />
              <ReBar name={valueLabel || "Value"} dataKey="value" radius={[6, 6, 0, 0]} fill={colors[0]} animationDuration={400} />
            </ReBarChart>
          </ReResponsiveContainer>
        )}
      </div>
    </div>
  );
};


const normalizeFields = (fields: any[] = []): NormalizedField[] =>
  fields
    .map((field) => {
      const key = getFieldKey(field);
      if (!key) return null;
      const lowerKey = key.toLowerCase();
      const enumValues = Array.isArray((field as any).enumValues)
        ? (field as any).enumValues
        : Array.isArray((field as any).enum)
          ? (field as any).enum
          : Array.isArray((field as any).options)
            ? (field as any).options
            : undefined;
      const resolvedType = (field.type || field.fieldType || (field as any).dataType || "").toString().toLowerCase() || "string";
      const endsWithId = lowerKey.endsWith("_id");
      const isReferenceType =
        resolvedType === "reference" ||
        Boolean((field as any).references) ||
        (field as any)?.semanticRole === "foreign_id" ||
        (field as any)?.semanticType === "reference";
      const isReference = isReferenceType || endsWithId;
      const baseKey = endsWithId ? lowerKey.replace(/_id$/, "") : lowerKey;
      const fromRef =
        (field as any).ref ||
        (field as any).references?.table ||
        (field as any).references?.tableKey;
      const referenceTableKey = isReference
        ? (fromRef as string) || (baseKey.endsWith("s") ? baseKey : `${baseKey}s`)
        : null;
      return {
        key,
        type: resolvedType,
        required: Boolean(field.required || field.isRequired),
        enumValues,
        label: beautifyLabel(key),
        isId: lowerKey === "id" || lowerKey === "_id",
        isReference,
        referenceTableKey,
        original: field,
      };
    })
    .filter((f): f is NormalizedField => Boolean(f));

const labelPreferenceOrder = ["name", "full_name", "email", "title", "code", "_id"];

const isSystemFieldName = (key: string) => {
  const lower = key.toLowerCase();
  return lower === "id" || lower === "_id" || lower === "created_at" || lower === "updated_at";
};

const isForeignKeyFieldName = (key: string) => {
  const lower = key.toLowerCase();
  if (isSystemFieldName(lower)) return false;
  return lower.endsWith("_id");
};

const inferTableKeyFromFieldKey = (fieldKey: string): string => {
  const base = fieldKey.replace(/_id$/i, "");
  return base.endsWith("s") ? base : `${base}s`;
};

const humanizeTableKey = (key: string): string => {
  if (!key) return "";
  const base = key.replace(/_/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
};

const validateFormValues = (fields: NormalizedField[], values: Record<string, any>, tableKey?: string) => {
  const errors: Record<string, string> = {};
  fields.forEach((field) => {
    if ((!field.isReference && isSystemField(field)) || isSelfReferencingId(field, tableKey)) return;
    const raw = values[field.key];
    const isEmpty = raw === "" || raw === undefined || raw === null;
    if (field.required && isEmpty) {
      errors[field.key] = "This field is required";
      return;
    }
    if (field.type === "number" && !isEmpty && Number.isNaN(Number(raw))) {
      errors[field.key] = "Enter a valid number";
    }
    if (field.key.toLowerCase().includes("email") && !isEmpty && typeof raw === "string" && !EMAIL_REGEX.test(raw)) {
      errors[field.key] = "Enter a valid email";
    }
  });
  return errors;
};

const normalizeGeneratorFieldType = (value: string | undefined): TableSchema["fields"][number]["type"] => {
  const lower = (value || "").toLowerCase();
  if (lower.includes("date") || lower.includes("time")) return "date";
  if (lower.includes("bool")) return "boolean";
  if (lower.includes("int") || lower.includes("num") || lower.includes("decimal") || lower.includes("float")) return "number";
  if (lower.includes("enum")) return "enum";
  if (lower === "id") return "id";
  return "string";
};

const buildRecordPayload = (fields: NormalizedField[], values: Record<string, any>, tableKey?: string) => {
  const payload: Record<string, any> = {};
  fields.forEach((field) => {
    if ((!field.isReference && isSystemField(field)) || isSelfReferencingId(field, tableKey)) return;
    const raw = values[field.key];
    if (field.type === "number") {
      if (raw === "" || raw === undefined || raw === null) return;
      const parsed = Number(raw);
      payload[field.key] = Number.isNaN(parsed) ? raw : parsed;
      return;
    }
    if (field.type === "boolean") {
      payload[field.key] = Boolean(raw);
      return;
    }
    payload[field.key] = raw;
  });
  return payload;
};

const MetricCard = ({
  icon: Icon,
  title,
  value = "No data",
  onDelete,
  deletable,
  className = "",
  iconKey,
}: MetricCardProps & { iconKey?: MetricIcon }) => {
  const iconStyle = getIconStyle(iconKey);
  const displayTitle =
    typeof title === "string" && title.length ? `${title.charAt(0).toUpperCase()}${title.slice(1).toLowerCase()}` : title;
  return (
    <div className={`kpiCard relative ${className}`}>
      {deletable && onDelete && (
        <button className="metricDeleteBtn" title="Remove widget" aria-label="Remove widget" onClick={onDelete}>
          ×
        </button>
      )}
      <div className="kpiIcon" style={{ background: iconStyle.bg, boxShadow: iconStyle.shadow }}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="kpiTitle">{displayTitle}</p>
        <p className="kpiValue">{value}</p>
      </div>
    </div>
  );
};

const numericFieldTypes = ["number", "integer", "int", "float", "double", "decimal", "currency", "money", "amount", "numeric"];
const looksNumericField = (field: any) => numericFieldTypes.includes((field?.type || field?.fieldType || "").toString().toLowerCase());

type AddWidgetModalProps = {
  open: boolean;
  onClose: () => void;
  tables: DashboardTable[];
  onSave: (data: {
    tableKey: string;
    columnKey: string;
    aggregation: MetricAggregation;
    metricType: MetricType;
    title: string;
    icon: MetricIcon;
    condition?: WidgetCondition;
  }) => Promise<void>;
  saving: boolean;
  maxReached: boolean;
};

const isConditionalMetric = (metricType: MetricType) => metricType.includes("conditional");

const AddWidgetModal = ({ open, onClose, tables, onSave, saving, maxReached }: AddWidgetModalProps) => {
  const iconOptions: { value: MetricIcon; label: string; color: string }[] = [
    { value: "money", label: "Money", color: "#0ea5e9" },
    { value: "analytics", label: "Analytics", color: "#6366f1" },
    { value: "trend", label: "Trend", color: "#10b981" },
    { value: "cart", label: "Cart", color: "#f59e0b" },
    { value: "users", label: "Users", color: "#8b5cf6" },
    { value: "star", label: "Star", color: "#f97316" },
  ];
  const [form, setForm] = useState<AddWidgetFormState>({
    tableKey: tables[0]?.key || tables[0]?.id || "",
    columnKey: "",
    aggregation: "sum",
    metricType: "sum",
    title: "",
    icon: "analytics",
  });
  const [columns, setColumns] = useState<any[]>([]);
  const [allColumns, setAllColumns] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const buildDefaultTitle = (agg: MetricAggregation, field: any) => {
    const label = beautifyLabel(getFieldKey(field) || "");
    return agg === "avg" ? `Average ${label}` : `Total ${label}`;
  };

  const pickIconByField = (field: any): MetricIcon => {
    const key = (getFieldKey(field) || "").toLowerCase();
    const moneyHints = ["price", "amount", "total", "revenue", "cost", "bill", "fee", "payment", "salary"];
    return moneyHints.some((h) => key.includes(h)) ? "money" : "analytics";
  };

  const updateColumns = (tableKey: string) => {
    const table = tables.find((t) => (t.key || t.id) === tableKey);
    const numericFields = (table?.fields || []).filter(looksNumericField);
    const allFields = (table?.fields || []).filter((f) => getFieldKey(f));
    setColumns(numericFields);
    setAllColumns(allFields);
    if (numericFields.length === 0) {
      setError("This table has no numeric fields available for metrics.");
    } else {
      setError(null);
      const first = numericFields[0];
      setForm((prev) => ({
        ...prev,
        columnKey: prev.columnKey && numericFields.some((f) => getFieldKey(f) === prev.columnKey) ? prev.columnKey : getFieldKey(first),
        title: prev.title || buildDefaultTitle(prev.aggregation, first),
        icon: pickIconByField(first),
        conditionField: prev.conditionField || getFieldKey(allFields[0]) || "",
      }));
    }
  };

  useEffect(() => {
    if (open) {
      const initialTableKey = tables[0]?.key || tables[0]?.id || "";
      setForm((prev) => ({ ...prev, tableKey: prev.tableKey || initialTableKey }));
      updateColumns(initialTableKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tables]);

  const handleChange = (field: keyof AddWidgetFormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onAggregationChange = (agg: MetricAggregation) => {
    const col = columns.find((c) => getFieldKey(c) === form.columnKey);
    handleChange("aggregation", agg);
    handleChange(
      "metricType",
      agg === "sum" ? "sum" : agg === "avg" ? "average" : form.metricType,
    );
    if (col) {
      handleChange("title", buildDefaultTitle(agg, col));
    }
  };

  const onTableChange = (tableKey: string) => {
    handleChange("tableKey", tableKey);
    setForm((prev) => ({ ...prev, columnKey: "", conditionField: "" }));
    updateColumns(tableKey);
  };

  const onColumnChange = (columnKey: string) => {
    const field = columns.find((c) => getFieldKey(c) === columnKey);
    handleChange("columnKey", columnKey);
    if (field) {
      handleChange("title", buildDefaultTitle(form.aggregation, field));
      handleChange("icon", pickIconByField(field));
    }
  };

  const canSave = Boolean(form.tableKey && form.columnKey && !saving && !maxReached && columns.length > 0);

  if (!open) return null;

  return (
    <div className="mdModalOverlay">
      <div className="mdModal">
        <div className="mdModalHeader">
          <h3 className="mdModalTitle">Add widget</h3>
          <Button variant="ghost" className="mdGhostBtn" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mdModalBody">
          <div className="mdField">
            <label className="mdLabel">Table</label>
            <Select value={form.tableKey} onValueChange={onTableChange}>
              <SelectTrigger className="mdSelect">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent position="popper" className="mdSelectContent">
                {tables.map((table) => (
                  <SelectItem key={table.key || table.id} value={table.key || table.id || ""}>
                    {table.name || table.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mdField">
            <label className="mdLabel">Column (numeric)</label>
            <Select value={form.columnKey} onValueChange={onColumnChange} disabled={!columns.length}>
              <SelectTrigger className="mdSelect">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent position="popper" className="mdSelectContent">
                {columns.map((field) => (
                  <SelectItem key={getFieldKey(field)} value={getFieldKey(field)}>
                    {beautifyLabel(getFieldKey(field))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!columns.length && <p className="mdHint text-red-500">This table has no numeric fields available for metrics.</p>}
            {error && columns.length > 0 && <p className="mdHint text-red-500">{error}</p>}
          </div>

          <div className="mdField">
            <label className="mdLabel">Metric type</label>
            <Select
              value={form.metricType}
              onValueChange={(v) => {
                const next = v as MetricType;
                handleChange("metricType", next);
                handleChange("aggregation", mapAggregationForMetricType(next));
                if (!next.includes("conditional")) {
                  handleChange("conditionField", "");
                  handleChange("conditionOperator", undefined);
                  handleChange("conditionValue", undefined);
                  handleChange("conditionValue2", undefined);
                } else if (!form.conditionField && allColumns.length) {
                  handleChange("conditionField", getFieldKey(allColumns[0]));
                }
              }}
            >
              <SelectTrigger className="mdSelect">
                <SelectValue placeholder="Select metric type" />
              </SelectTrigger>
              <SelectContent position="popper" className="mdSelectContent">
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="average">Average</SelectItem>
                <SelectItem value="min">Min</SelectItem>
                <SelectItem value="max">Max</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="sum_conditional">Sum (conditional)</SelectItem>
                <SelectItem value="average_conditional">Average (conditional)</SelectItem>
                <SelectItem value="count_conditional">Count (conditional)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.metricType.includes("conditional") && (
            <div className="mdField space-y-3">
              <div>
                <label className="mdLabel">Condition column</label>
                <Select
                  value={form.conditionField || ""}
                  onValueChange={(v) => handleChange("conditionField", v)}
                  disabled={!allColumns.length}
                >
                  <SelectTrigger className="mdSelect">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="mdSelectContent">
                    {allColumns.map((field) => (
                      <SelectItem key={getFieldKey(field)} value={getFieldKey(field)}>
                        {beautifyLabel(getFieldKey(field))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mdLabel">Operator</label>
                <Select
                  value={form.conditionOperator || "gt"}
                  onValueChange={(v) => handleChange("conditionOperator", v as ConditionOperator)}
                >
                  <SelectTrigger className="mdSelect">
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="mdSelectContent">
                    <SelectItem value="gt">{">"}</SelectItem>
                    <SelectItem value="gte">{">="}</SelectItem>
                    <SelectItem value="lt">{"<"}</SelectItem>
                    <SelectItem value="lte">{"<="}</SelectItem>
                    <SelectItem value="eq">{"="}</SelectItem>
                    <SelectItem value="ne">{"!="}</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="between">between</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mdLabel">Value</label>
                <Input
                  value={form.conditionValue ?? ""}
                  onChange={(e) => handleChange("conditionValue", e.target.value)}
                  placeholder="Enter value"
                />
              </div>

              {form.conditionOperator === "between" && (
                <div>
                  <label className="mdLabel">Value 2 (for between)</label>
                  <Input
                    value={form.conditionValue2 ?? ""}
                    onChange={(e) => handleChange("conditionValue2", e.target.value)}
                    placeholder="Enter value 2"
                  />
                </div>
              )}
            </div>
          )}

          <div className="mdField">
            <label className="mdLabel">Widget title</label>
            <Input value={form.title} onChange={(e) => handleChange("title", e.target.value)} placeholder="Total revenue" />
          </div>

          <div className="mdField">
            <label className="mdLabel">Icon</label>
            <Select value={form.icon} onValueChange={(v) => handleChange("icon", v as MetricIcon)}>
              <SelectTrigger className="mdSelect">
                <SelectValue placeholder="Icon" />
              </SelectTrigger>
              <SelectContent position="popper" className="mdSelectContent">
                {iconOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "999px",
                          background: opt.color,
                          display: "inline-block",
                        }}
                      />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mdModalFooter">
          <Button variant="outline" onClick={onClose} className="mdGhostBtn">
            Cancel
          </Button>
          <Button
            className="primaryBtn"
            disabled={!canSave}
            onClick={async () => {
              const condition =
                isConditionalMetric(form.metricType) && form.conditionField && form.conditionOperator && form.conditionValue !== undefined
                  ? {
                      field: form.conditionField,
                      operator: form.conditionOperator,
                      value:
                        form.conditionOperator === "between"
                          ? form.conditionValue
                          : form.conditionValue,
                      value2: form.conditionOperator === "between" ? form.conditionValue2 : undefined,
                    }
                  : undefined;
              await onSave({
                tableKey: form.tableKey,
                columnKey: form.columnKey,
                aggregation: form.aggregation,
                metricType: form.metricType,
                title: form.title || "Metric",
                icon: form.icon,
                condition,
              });
            }}
          >
            {saving ? "Saving..." : "Save widget"}
          </Button>
        </div>
      </div>
    </div>
  );
};

type InsightForm = {
  title: string;
  chartType: "line" | "bar" | "pie" | "table";
  sourceTable: string;
  metricOp: "sum" | "count" | "avg" | "min" | "max";
  metricField?: string;
  groupByField?: string;
  timeBucket?: "day" | "week" | "month" | "year";
  limit?: number;
};

type AddInsightModalProps = {
  open: boolean;
  onClose: () => void;
  tables: DashboardTable[];
  tableSchemas: TableSchema[];
  recordsByTable: Record<string, any[]>;
  onSaved?: () => void;
  onSave: (data: InsightForm) => Promise<void>;
  saving: boolean;
};

const AddInsightModal = ({ open, onClose, tables, tableSchemas, recordsByTable, onSave, onSaved, saving }: AddInsightModalProps) => {
  const defaultTable = tables[0]?.key || tables[0]?.id || "";
  const [form, setForm] = useState<InsightForm>({
    title: "",
    chartType: "bar",
    sourceTable: defaultTable,
    metricOp: "count",
    metricField: "",
    groupByField: "",
    timeBucket: "day",
    limit: 5,
  });
  const [selectedMetricField, setSelectedMetricField] = useState<string>("");
  const [selectedGroupField, setSelectedGroupField] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customMetricField, setCustomMetricField] = useState("");
  const [customGroupField, setCustomGroupField] = useState("");
  const [metricError, setMetricError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ChartTemplateConfig[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Array<{ label: string; value: number }>>([]);
  const previewTimer = useRef<NodeJS.Timeout | null>(null);

  const currentSchema = useMemo(() => {
    return tableSchemas.find((s) => {
      const name = (s as any).tableName || s.name;
      return s.key === form.sourceTable || name === form.sourceTable;
    });
  }, [tableSchemas, form.sourceTable]);

  const metricFieldOptions = useMemo(() => {
    return (currentSchema?.fields || [])
      .filter((f) => f.type === "number" || f.type === "date")
      .map((f) => {
        const value = (f as any).name || (f as any).key || "";
        return value ? { value, label: beautifyLabel(value) } : null;
      })
      .filter(Boolean) as { value: string; label: string }[];
  }, [currentSchema]);

  const groupFieldOptions = useMemo(() => {
    return (currentSchema?.fields || [])
      .filter((f) => ["string", "boolean", "date", "enum"].includes(f.type))
      .map((f) => {
        const value = (f as any).name || (f as any).key || "";
        return value ? { value, label: beautifyLabel(value) } : null;
      })
      .filter(Boolean) as { value: string; label: string }[];
  }, [currentSchema]);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      sourceTable: prev.sourceTable || defaultTable,
    }));
  }, [defaultTable, open]);

  useEffect(() => {
    if (!open) return;
    setSelectedMetricField("");
    setSelectedGroupField("");
    setCustomMetricField("");
    setCustomGroupField("");
    setMetricError(null);
  }, [form.sourceTable, open]);

  useEffect(() => {
    if (!open || !currentSchema) return;
    // metric default for sum/avg/min/max
    const needsNumeric = ["sum", "avg", "min", "max"].includes(form.metricOp);
    if (needsNumeric && !selectedMetricField && metricFieldOptions.length) {
      setSelectedMetricField(metricFieldOptions[0].value);
    }
    // smart defaults for group and time bucket
    if (!selectedGroupField && groupFieldOptions.length) {
      const prefer = groupFieldOptions.find((f) =>
        ["status", "category", "type", "customer", "user"].some((kw) => f.value.toLowerCase().includes(kw)),
      );
      if (prefer) setSelectedGroupField(prefer.value);
    }
    if (!form.timeBucket && (currentSchema.fields || []).some((f) => f.type === "date")) {
      setForm((prev) => ({ ...prev, timeBucket: "day" }));
    }
  }, [open, currentSchema, form.metricOp, metricFieldOptions, groupFieldOptions, selectedMetricField, selectedGroupField]);

  const handleChange = (key: keyof InsightForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resolvedMetricField = customMetricField || selectedMetricField || form.metricField || "";
  const resolvedGroupField = customGroupField || selectedGroupField || form.groupByField || "";
  const canSave = Boolean(form.title && form.sourceTable && !saving);
  const groupFieldMeta = useMemo(() => {
    if (!currentSchema || !resolvedGroupField) return null;
    return (currentSchema.fields || []).find(
      (f) => (f as any).name === resolvedGroupField || (f as any).key === resolvedGroupField,
    ) || null;
  }, [currentSchema, resolvedGroupField]);
  const metricLabel = useMemo(() => {
    if (resolvedMetricField) return beautifyLabel(resolvedMetricField);
    if (form.metricOp === "count") return "Count";
    if (form.metricOp === "sum") return "Sum";
    if (form.metricOp === "avg") return "Average";
    if (form.metricOp === "min") return "Min";
    if (form.metricOp === "max") return "Max";
    return "Value";
  }, [form.metricOp, resolvedMetricField]);

  const computePreview = useCallback(() => {
    if (!form.sourceTable) {
      setPreviewData([]);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    const needsNumeric = ["sum", "avg", "min", "max"].includes(form.metricOp);
    if (needsNumeric && !resolvedMetricField) {
      setPreviewData([]);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    const rows = recordsByTable[form.sourceTable] || [];
    if (!rows.length) {
      setPreviewData([]);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    try {
      const buckets = new Map<string, { total: number; count: number; min?: number; max?: number }>();
      const bucketizeDate = (val: any) => {
        const dt = val ? new Date(val) : null;
        if (!dt || Number.isNaN(dt.getTime())) return "(No date)";
        const y = dt.getFullYear();
        const m = `${dt.getMonth() + 1}`.padStart(2, "0");
        const d = `${dt.getDate()}`.padStart(2, "0");
        if (form.timeBucket === "year") return `${y}`;
        if (form.timeBucket === "month") return `${y}-${m}`;
        if (form.timeBucket === "week") {
          const oneJan = new Date(dt.getFullYear(), 0, 1);
          const numberOfDays = Math.floor((dt.valueOf() - oneJan.valueOf()) / 86400000);
          const week = Math.ceil((dt.getDay() + 1 + numberOfDays) / 7);
          return `${y}-W${String(week).padStart(2, "0")}`;
        }
        return `${y}-${m}-${d}`;
      };
      const normalizeGroupLabel = (raw: any) => {
        const groupKeyMissing = raw === null || raw === undefined || raw === "";
        const isDateGrouping = Boolean(form.timeBucket) || groupFieldMeta?.type === "date";
        if (!groupKeyMissing) return raw;
        if (isDateGrouping) return "(No date)";
        if ((resolvedGroupField || "").toLowerCase().match(/customer|user/)) return "(No value)";
        return "(Unspecified)";
      };

      rows.forEach((r: any) => {
        const row = r && typeof r === "object" && "record" in r ? r.record : r;
        let groupKeyRaw = resolvedGroupField ? row?.[resolvedGroupField] : "All";
        if (resolvedGroupField && form.timeBucket) {
          groupKeyRaw = bucketizeDate(row?.[resolvedGroupField]);
        }
        const groupKey = normalizeGroupLabel(groupKeyRaw);
        let val = 1;
        if (form.metricOp !== "count") {
          const raw = row?.[resolvedMetricField];
          const num = Number(raw);
          if (raw === null || raw === undefined || Number.isNaN(num)) return;
          val = num;
        }
        const current = buckets.get(groupKey ?? "Unknown") || { total: 0, count: 0, min: undefined, max: undefined };
        current.total += val;
        current.count += 1;
        current.min = current.min === undefined ? val : Math.min(current.min, val);
        current.max = current.max === undefined ? val : Math.max(current.max, val);
        buckets.set(groupKey ?? "Unknown", current);
      });
      const dataset = Array.from(buckets.entries()).map(([label, stats]) => {
        let value = 0;
        if (form.metricOp === "count") value = stats.total;
        else if (form.metricOp === "sum") value = stats.total;
        else if (form.metricOp === "avg") value = stats.count ? stats.total / stats.count : 0;
        else if (form.metricOp === "min") value = stats.min ?? 0;
        else if (form.metricOp === "max") value = stats.max ?? 0;
        const safeLabel = normalizeGroupLabel(label);
        return { label: safeLabel?.toString?.() || "(Unspecified)", value };
      });
      setPreviewData(dataset);
      setPreviewError(null);
    } catch (err) {
      setPreviewError("Could not load preview. Please check your configuration or try again.");
      setPreviewData([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [form.metricOp, form.sourceTable, form.timeBucket, recordsByTable, resolvedGroupField, resolvedMetricField, groupFieldMeta]);

  const triggerPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      computePreview();
    }, 450);
  }, [computePreview]);

  useEffect(() => {
    if (!open) return;
    triggerPreview();
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [
    open,
    form.sourceTable,
    form.chartType,
    form.metricOp,
    form.timeBucket,
    form.limit,
    resolvedMetricField,
    resolvedGroupField,
    triggerPreview,
  ]);

  const buildTemplates = useCallback((): ChartTemplateConfig[] => {
    if (!currentSchema) return [{ id: "custom", label: "Custom chart", description: "Configure manually", config: {} }];
    const fields = currentSchema.fields || [];
    const tableName = tables.find((t) => (t.key || t.id) === form.sourceTable)?.name || form.sourceTable || "Records";
    const numeric = fields.filter(isNumericField);
    const dateField = fields.find(isDateField);
    const statusField = fields.find(isStatusOrCategoryField);
    const moneyField = fields.find(looksLikeMoneyField) || numeric.find(looksLikeMoneyField);

    const list: ChartTemplateConfig[] = [];
    list.push({
      id: "count_records",
      label: "Count records",
      description: "Total rows",
      config: { title: `${tableName} count`, metric: "count", chartType: "bar" },
    });

    if (statusField) {
      const key = (statusField as any).name || (statusField as any).key || "";
      list.push({
        id: "count_status",
        label: "Count by status",
        description: "Group by status/category",
        config: { title: `${tableName} by status`, metric: "count", groupByField: key, chartType: "bar" },
      });
    }

    if (moneyField && dateField) {
      const moneyKey = (moneyField as any).name || (moneyField as any).key || "";
      const dateKey = (dateField as any).name || (dateField as any).key || "";
      list.push({
        id: "revenue_month",
        label: "Revenue by month",
        description: "Sum revenue over months",
        config: {
          title: `${tableName} revenue by month`,
          metric: "sum",
          metricField: moneyKey,
          groupByField: dateKey,
          timeBucket: "month",
          chartType: "line",
        },
      });
    }

    if (dateField) {
      const dateKey = (dateField as any).name || (dateField as any).key || "";
      list.push({
        id: "records_day",
        label: "Records by day",
        description: "Count per day",
        config: {
          title: `${tableName} by day`,
          metric: "count",
          groupByField: dateKey,
          timeBucket: "day",
          chartType: "line",
        },
      });
    }

    list.push({ id: "custom", label: "Custom chart", description: "Configure manually", config: {} });
    return list;
  }, [currentSchema, form.sourceTable, tables]);

  const applyTemplateToForm = useCallback(
    (tpl: ChartTemplateConfig) => {
      if (!tpl) return;
      setActiveTemplateId(tpl.id);
      const cfg = tpl.config || {};
      const metricOp =
        cfg.metric === "average"
          ? "avg"
          : cfg.metric === "min"
            ? "min"
            : cfg.metric === "max"
              ? "max"
              : cfg.metric === "sum"
                ? "sum"
                : "count";
      const safeMetricField =
        cfg.metricField && metricFieldOptions.some((o) => o.value === cfg.metricField) ? cfg.metricField : "";
      const safeGroupField =
        cfg.groupByField && groupFieldOptions.some((o) => o.value === cfg.groupByField) ? cfg.groupByField : "";
      setForm((prev) => ({
        ...prev,
        title: cfg.title ?? prev.title,
        chartType: (cfg.chartType as InsightForm["chartType"]) || prev.chartType,
        metricOp: metricOp as InsightForm["metricOp"],
        timeBucket: cfg.timeBucket || prev.timeBucket,
      }));
      setSelectedMetricField(safeMetricField);
      setSelectedGroupField(safeGroupField);
      setCustomMetricField("");
      setCustomGroupField("");
      setMetricError(null);
    },
    [groupFieldOptions, metricFieldOptions],
  );

  useEffect(() => {
    if (!open) return;
    const tpl = buildTemplates();
    const ensured = tpl.length ? tpl : [{ id: "custom", label: "Custom chart", description: "Configure manually", config: {} }];
    setTemplates(ensured);
    const first = ensured[0];
    if (first) applyTemplateToForm(first);
  }, [open, form.sourceTable, buildTemplates, applyTemplateToForm]);

  useEffect(() => {
    if (!open) return;
    // if tables change while modal is open, realign sourceTable and templates
    if (!form.sourceTable && defaultTable) {
      setForm((prev) => ({ ...prev, sourceTable: defaultTable }));
    }
  }, [defaultTable, form.sourceTable, open]);

  const nlPreview = () => {
    const metricText =
      form.metricOp === "count"
        ? "Count"
        : form.metricOp === "sum"
          ? "Sum"
          : form.metricOp === "avg"
            ? "Average"
            : form.metricOp === "min"
              ? "Min"
              : "Max";
    const tableName = tables.find((t) => (t.key || t.id) === form.sourceTable)?.name || form.sourceTable || "records";
    const metricFieldLabel = resolvedMetricField ? beautifyLabel(resolvedMetricField) : metricText;
    const groupLabel = resolvedGroupField ? beautifyLabel(resolvedGroupField) : "";
    const timeLabel = form.timeBucket ? beautifyLabel(form.timeBucket) : "";
    const groupPart = groupLabel ? ` grouped by ${groupLabel}` : "";
    const timePart = groupLabel && timeLabel ? ` per ${timeLabel}` : "";
    return `${metricFieldLabel} of ${tableName}${groupPart}${timePart}`;
  };
  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    try {
      await onSave({
        ...form,
        metricField: resolvedMetricField || undefined,
        groupByField: resolvedGroupField || undefined,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      const message = (err as any)?.message || "Failed to save chart";
      toast.error(message);
    }
  };

  if (!open) return null;

  return (
    <div className="mdModalOverlay">
      <div className="mdModal" style={{ display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
        <div className="mdModalHeader" style={{ position: "sticky", top: 0, zIndex: 2, background: "rgba(255,255,255,0.9)" }}>
          <h3 className="mdModalTitle">Add chart</h3>
          <Button type="button" variant="ghost" className="mdGhostBtn" onClick={handleClose}>
            Close
          </Button>
        </div>
        <div className="mdModalBody" style={{ overflowY: "auto", flex: 1 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)",
              gap: 16,
            }}
          >
            <div className="mdField" style={{ alignSelf: "start" }}>
              <p className="mdLabel" style={{ marginBottom: 8 }}>
                Chart templates
              </p>
              <div className="flex flex-col gap-2">
                {(templates.length ? templates : buildTemplates()).map((tpl) => {
                  const active = tpl.id === activeTemplateId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplateToForm(tpl)}
                      className={active ? "mdSelect activeTemplate" : "mdSelect mdGhostBtn"}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: active ? "1px solid #7c3aed" : "1px solid #e5e7eb",
                        background: active ? "linear-gradient(135deg,#ede9fe,#e0f2fe)" : "transparent",
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{tpl.label}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{tpl.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mdField" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="mdField">
                <label className="mdLabel">Title</label>
                <Input value={form.title} onChange={(e) => handleChange("title", e.target.value)} placeholder="Orders by status" />
              </div>
              <div className="mdField">
                <label className="mdLabel">Source table</label>
                <Select value={form.sourceTable} onValueChange={(v) => handleChange("sourceTable", v)}>
                  <SelectTrigger className="mdSelect">
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="mdSelectContent">
                    {tables.map((table) => (
                      <SelectItem key={table.key || table.id} value={table.key || table.id || ""}>
                        {table.name || table.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mdField">
                <label className="mdLabel">Chart type</label>
                <Select value={form.chartType} onValueChange={(v) => handleChange("chartType", v as InsightForm["chartType"])}>
                  <SelectTrigger className="mdSelect">
                    <SelectValue placeholder="Chart type" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="mdSelectContent">
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="pie">Pie</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mdGridTwo">
                <div className="mdField">
                  <label className="mdLabel">Metric</label>
                  <Select
                    value={form.metricOp}
                    onValueChange={(v) => {
                      setMetricError(null);
                      handleChange("metricOp", v as InsightForm["metricOp"]);
                      if (v === "count") setSelectedMetricField("");
                    }}
                  >
                    <SelectTrigger className="mdSelect">
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="mdSelectContent">
                      <SelectItem value="count">Count</SelectItem>
                      <SelectItem value="sum">Sum</SelectItem>
                      <SelectItem value="avg">Average</SelectItem>
                      <SelectItem value="min">Min</SelectItem>
                      <SelectItem value="max">Max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.metricOp !== "count" && (
                  <div className="mdField">
                    <label className="mdLabel">Metric field</label>
                    <Select
                      value={selectedMetricField || "__none__"}
                      onValueChange={(v) => {
                        const next = v === "__none__" ? "" : v;
                        setSelectedMetricField(next);
                        if (["sum", "avg", "min", "max"].includes(form.metricOp) && next) {
                          const isNumeric = metricFieldOptions.some((opt) => opt.value === next);
                          setMetricError(isNumeric ? null : "Field must be numeric");
                        } else {
                          setMetricError(null);
                        }
                      }}
                    >
                      <SelectTrigger className="mdSelect">
                        <SelectValue placeholder="Select metric field" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="mdSelectContent">
                        <SelectItem value="__none__">None</SelectItem>
                        {metricFieldOptions.length === 0 ? (
                          <SelectItem value="__loading__" disabled>
                            Loading...
                          </SelectItem>
                        ) : (
                          metricFieldOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {metricError ? <p className="text-xs text-red-500 mt-1">{metricError}</p> : null}
                  </div>
                )}
              </div>

              <div className="mdGridTwo">
                <div className="mdField">
                  <label className="mdLabel">Group by field (optional)</label>
                  <Select
                    value={selectedGroupField || "__none__"}
                    onValueChange={(v) => setSelectedGroupField(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="mdSelect">
                      <SelectValue placeholder="Select group field" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="mdSelectContent">
                      <SelectItem value="__none__">None</SelectItem>
                      {groupFieldOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedGroupField && (
                  <div className="mdField">
                    <label className="mdLabel">Group by time</label>
                    <Select value={form.timeBucket || "day"} onValueChange={(v) => handleChange("timeBucket", v as InsightForm["timeBucket"])}>
                      <SelectTrigger className="mdSelect">
                        <SelectValue placeholder="Time bucket" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="mdSelectContent">
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="year">Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="mdField" style={{ marginTop: 4 }}>
                <Button
                  variant="ghost"
                  className="mdGhostBtn"
                  onClick={() =>
                    setShowAdvanced((prev) => {
                      if (prev) {
                        setCustomMetricField("");
                        setCustomGroupField("");
                      }
                      return !prev;
                    })
                  }
                >
                  {showAdvanced ? "Hide advanced options" : "Advanced options (for power users)"}
                </Button>
              </div>
              {showAdvanced && (
                <div className="mdGridTwo">
                  <div className="mdField">
                    <label className="mdLabel">Metric field (custom)</label>
                    <Input
                      value={customMetricField}
                      onChange={(e) => setCustomMetricField(e.target.value)}
                      placeholder="custom_metric_column"
                    />
                  </div>
                  <div className="mdField">
                    <label className="mdLabel">Group by field (custom)</label>
                    <Input
                      value={customGroupField}
                      onChange={(e) => setCustomGroupField(e.target.value)}
                      placeholder="custom_group_column"
                    />
                  </div>
                </div>
              )}

              <div className="mdField">
                <label className="mdLabel">Limit (optional)</label>
                <Input
                  type="number"
                  value={form.limit ?? ""}
                  onChange={(e) => handleChange("limit", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="5"
                />
              </div>

              <div className="mdField">
                <p className="mdMainSubtitle">This chart will show:</p>
                <p className="mdChartTitle" style={{ fontSize: 14 }}>{nlPreview()}</p>
              </div>
              <div className="mdField">
                <p className="mdLabel">Preview</p>
                <p className="mdMainSubtitle">See how this chart will look before saving.</p>
                <div className="tableCardGlass" style={{ padding: 12, minHeight: 300 }}>
                  {previewLoading ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-slate-500 rounded-full" />
                      <span>Loading preview...</span>
                    </div>
                  ) : previewError ? (
                    <div className="flex flex-col gap-2 text-red-500">
                      <span>{previewError}</span>
                      <Button variant="outline" className="mdGhostBtn" onClick={() => computePreview()}>
                        Refresh preview
                      </Button>
                    </div>
                  ) : previewData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-500 gap-2" style={{ height: 240 }}>
                      <div className="h-12 w-12 rounded-full border border-dashed border-slate-300 flex items-center justify-center">
                        <BarChart2 className="w-5 h-5 opacity-70" />
                      </div>
                      <p className="text-sm text-center">Select a source table and valid metric options to see a preview.</p>
                      <Button variant="outline" className="mdGhostBtn" onClick={() => computePreview()}>
                        Refresh preview
                      </Button>
                    </div>
                  ) : (
                    <div style={{ height: 280 }}>
                  <ChartCard
                    title={form.title || "Chart preview"}
                    description={nlPreview()}
                    type={form.chartType as ChartType}
                    dataset={previewData}
                    unit={undefined}
                    isLoading={false}
                    valueLabel={metricLabel}
                  />
                </div>
              )}
            </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mdModalFooter" style={{ position: "sticky", bottom: 0, zIndex: 2, background: "rgba(255,255,255,0.9)" }}>
          <Button type="button" variant="outline" onClick={handleClose} className="mdGhostBtn">
            Cancel
          </Button>
          <Button
            className="primaryBtn"
            disabled={!canSave || saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Save chart"}
          </Button>
        </div>
      </div>
    </div>
  );
};

type AddRecordModalProps = {
  open: boolean;
  onClose: () => void;
  tableName: string;
  fields: NormalizedField[];
  values: Record<string, any>;
  errors: Record<string, string>;
  tableKey?: string;
  mode: "create" | "edit";
  referenceOptions: Record<
    string,
    { options: { value: string; label: string }[]; loading?: boolean; loaded?: boolean; error?: string; targetTable?: string }
  >;
  onChange: (key: string, value: any) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

const AddRecordModal = ({
  open,
  onClose,
  tableName,
  fields,
  values,
  errors,
  tableKey,
  mode,
  referenceOptions,
  onChange,
  onSubmit,
  isSubmitting,
}: AddRecordModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const renderFieldInput = (field: NormalizedField) => {
    const system = isSystemFieldName(field.key) || isSelfReferencingId(field, tableKey);
    if (mode === "create" && system) return null;
    const isReferenceField = field.isReference && field.referenceTableKey;
    const isReadOnly = mode === "edit" && (system || isReferenceField);
    const handleChange = (key: string, value: any) => {
      if (isReadOnly) return;
      onChange(key, value);
    };
    if (field.isReference) {
      const targetTableKey =
        field.referenceTableKey && field.referenceTableKey.trim().length > 0
          ? field.referenceTableKey
          : inferTableKeyFromFieldKey(field.key);
      const refKey = `${tableKey}:${field.key}`;
      const refData = referenceOptions[refKey] || referenceOptions[field.key] || { options: [], loading: true, targetTable: targetTableKey };
      const opts = refData.options || [];
      const base = field.key.replace(/_id$/i, "");
      const placeholderBase = base || field.label.toLowerCase();
      const placeholder = `Select ${placeholderBase}`;
      const targetTable = refData.targetTable || targetTableKey;
      const tableLabel = humanizeTableKey(targetTable);
      return (
        <Select
          value={values[field.key] ?? ""}
          onValueChange={(val) => handleChange(field.key, val)}
          disabled={isSubmitting || refData.loading || isReadOnly}
        >
          <SelectTrigger className="mdSelect" aria-label={field.label}>
            <SelectValue placeholder={refData.loading ? "Loading options..." : placeholder} />
          </SelectTrigger>
          <SelectContent className="mdSelectContent">
            {refData.loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
            ) : opts.length ? (
              opts.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No records available in {tableLabel || targetTable}. Add one first.
              </div>
            )}
          </SelectContent>
        </Select>
      );
    }
    if (field.type === "boolean") {
      return (
        <label className="mdCheckbox">
          <input
            type="checkbox"
            checked={Boolean(values[field.key])}
            onChange={(e) => handleChange(field.key, e.target.checked)}
            disabled={isReadOnly}
          />
          <span>Enable</span>
        </label>
      );
    }
    if (field.type === "enum") {
      if (field.enumValues && field.enumValues.length) {
        return (
          <select
            className="mdSelect"
            value={values[field.key] ?? ""}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={isReadOnly}
          >
            <option value="">Select an option</option>
            {field.enumValues.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      }
      return (
        <Input
          value={values[field.key] ?? ""}
          onChange={(e) => handleChange(field.key, e.target.value)}
          placeholder="Enter value"
          readOnly={isReadOnly}
        />
      );
    }
    const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
    return (
      <Input
        type={inputType}
        value={values[field.key] ?? ""}
        onChange={(e) => handleChange(field.key, inputType === "number" ? e.target.value : e.target.value)}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        readOnly={isReadOnly}
        disabled={isReadOnly}
      />
    );
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="mdModalOverlay" onClick={handleOverlayClick}>
      <div className="mdModal" role="dialog" aria-modal="true">
        <div className="mdModalHeader">
          <div>
            <p className="mdMainSubtitle">{mode === "edit" ? "Update record" : "Create a new record"}</p>
            <h3 className="mdModalTitle">
              {mode === "edit" ? "Edit" : "Add"} {tableName} record
            </h3>
          </div>
          <Button variant="ghost" className="mdGhostBtn" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <div className="mdModalBody">
          {fields
            .filter(
              (field) =>
                !(
                  (!field.isReference && isSystemField(field)) ||
                  isSelfReferencingId(field, tableKey)
                ),
            )
            .map((field) => (
              // readonly for edit mode on system/self-reference/reference ids
              (() => {
                const isReadOnlyField =
                  mode === "edit" &&
                  (isSystemField(field) || isSelfReferencingId(field, tableKey) || (field.isReference && field.referenceTableKey));
                return (
              <div
                key={field.key}
                className={`mdFormGroup ${
                  isReadOnlyField ? "opacity-70" : ""
                }`}
              >
                <label className="mdFormLabel">
                  {field.label} {field.required && <span className="requiredStar">*</span>}
                </label>
                {renderFieldInput(field)}
                {errors[field.key] && <p className="mdInputError">{errors[field.key]}</p>}
              </div>
                );
              })()
            ))}
        </div>
        <div className="mdModalFooter">
          <Button variant="outline" className="mdGhostBtn" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button className="primaryBtn" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
};

type ViewRecordModalProps = {
  open: boolean;
  onClose: () => void;
  record: Record<string, any> | null;
  fields: NormalizedField[];
  entityName?: string;
  referenceOptions: Record<
    string,
    { options: { value: string; label: string }[]; loading?: boolean; loaded?: boolean; error?: string; targetTable?: string }
  >;
  onOpenReference?: (tableKey: string, id: string) => void;
};

const ViewRecordModal = ({
  open,
  onClose,
  record,
  fields,
  entityName,
  referenceOptions,
  onOpenReference,
}: ViewRecordModalProps) => {
  if (!open || !record) return null;

  const isEmptyValue = (val: any) => val === null || val === undefined || val === "";

  const formatValue = (field: NormalizedField, value: any) => {
    if (isEmptyValue(value)) return "Not provided";
    if (field.type === "boolean") return value ? "Yes" : "No";
    if (field.type === "number") {
      const num = Number(value);
      return Number.isNaN(num) ? String(value) : num.toLocaleString();
    }
    if (field.type === "date") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }
    return String(value);
  };

  const assignSection = (field: NormalizedField) => {
    const key = field.key.toLowerCase();
    if (["_id", "id", "created_at", "updated_at", "createdat", "updatedat"].includes(key)) return "System";
    if (key.includes("name") || key.includes("gender") || key.includes("dob") || key.includes("birth")) return "Basic information";
    if (key.includes("email") || key.includes("phone") || key.includes("contact") || key.includes("address")) return "Contact";
    return "Details";
  };

  const grouped = fields.reduce<Record<string, NormalizedField[]>>((acc, f) => {
    const section = assignSection(f);
    if (!acc[section]) acc[section] = [];
    acc[section].push(f);
    return acc;
  }, {});

  const sectionOrder = ["Basic information", "Contact", "Details", "System"];
  const orderedSections = Object.entries(grouped).sort((a, b) => sectionOrder.indexOf(a[0]) - sectionOrder.indexOf(b[0]));

  return (
    <div className="mdModalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mdModal viewModal" role="dialog" aria-modal="true">
        <div className="mdModalHeader viewHeader">
          <div className="viewHeaderText">
            <p className="mdMainSubtitle">View record</p>
            <h3 className="mdModalTitle">
              {(record as any)?.name
                ? `${beautifyLabel((record as any)?.name)} details`
                : entityName
                  ? `${beautifyLabel(entityName)} details`
                  : fields.length
                    ? `${beautifyLabel(fields[0].original?.tableName || "Entity")} details`
                    : "View entity"}
            </h3>
            {record?._id && (
              <p className="mdMainSubtitle">ID: {record._id}{record?.created_at ? ` · Created ${new Date(record.created_at).toLocaleDateString()}` : ""}</p>
            )}
          </div>
          <Button variant="ghost" className="mdGhostBtn" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="viewContent">
          {orderedSections.map(([section, items]) => (
            <div key={section} className="viewSectionCard">
              <div className="viewSectionHeader">
                <span className="viewSectionTitle">{section}</span>
              </div>
              <div className="viewSectionGrid">
                {items.map((field) => {
                  const val = (record as any)?.[field.key];
                  const empty = isEmptyValue(val);
                  if (empty) {
                    return (
                      <div key={field.key} className="viewField">
                        <div className="viewLabel">{beautifyLabel(field.key)}</div>
                        <div className="viewValue muted">Not provided</div>
                      </div>
                    );
                  }
                  return (
                    <div key={field.key} className="viewField">
                      <div className="viewLabel">{beautifyLabel(field.key)}</div>
                      <div className="viewValue">
                        {field.isReference && field.referenceTableKey ? (
                          (() => {
                            const refData = referenceOptions[field.key];
                            const matched = refData?.options?.find((opt) => opt.value === val);
                            const displayValue = matched?.label || val;
                            const display =
                              typeof displayValue === "string" && displayValue.length > 24
                                ? `${displayValue.slice(0, 10)}?${displayValue.slice(-6)}`
                                : displayValue;
                            return onOpenReference ? (
                              <span
                                className="underline cursor-pointer hover:opacity-80"
                                style={{ color: "#2563eb" }}
                                onClick={() => onOpenReference(field.referenceTableKey as string, String(val))}
                              >
                                {display}
                              </span>
                            ) : (
                              <span>{display}</span>
                            );
                          })()
                        ) : (
                          formatValue(field, val)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mdModalFooter viewFooter">
          <Button className="primaryBtn" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function ManageDashDetail() {
  const { dashId } = useParams();
  const navigate = useNavigate();
  const [sessionId] = useState(getSessionId);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [overviewKpis, setOverviewKpis] = useState<
    { id: string; title: string; description?: string; value: number | string; icon?: ReactNode }[]
  >([]);
  const [chartConfigs, setChartConfigs] = useState<InsightWidget[]>([]);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const { filtersByTable, setTableFilters, activeCounts: filterCounts } = useTableFilters();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [selectedRecordTableKey, setSelectedRecordTableKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [recordsByTable, setRecordsByTable] = useState<Record<string, any[]>>({});
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [referenceOptions, setReferenceOptions] = useState<
    Record<
      string,
      { options: { value: string; label: string }[]; loading?: boolean; loaded?: boolean; error?: string; targetTable?: string }
    >
  >({});
  const [widgetResults, setWidgetResults] = useState<WidgetResult[]>([]);
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfig[]>([]);
  const [isAddInsightOpen, setIsAddInsightOpen] = useState(false);
  const [savingInsight, setSavingInsight] = useState(false);
  const preloadedTablesRef = useRef<Set<string>>(new Set());
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [savingWidget, setSavingWidget] = useState(false);
  const [removingWidgetIds, setRemovingWidgetIds] = useState<Set<string>>(new Set());
  const [confirmWidgetId, setConfirmWidgetId] = useState<string | null>(null);
  const [confirmInsight, setConfirmInsight] = useState<InsightWidget | null>(null);
  const [isEditSchemaOpen, setIsEditSchemaOpen] = useState(false);
  const [schemaTargetKey, setSchemaTargetKey] = useState<string | null>(null);
  const WIDGETS_PER_PAGE = 8;
  const CHARTS_PER_PAGE = 4;
  const [widgetPage, setWidgetPage] = useState(1);
  const [chartPage, setChartPage] = useState(1);
  const permissions = useDashboardPermissions(dashId, { userId: currentUser?.id ?? null, sessionId });
  const isOwner = Boolean(
    dashboard?.userId &&
      currentUser?.id &&
      String(dashboard.userId) === String(currentUser.id)
  );

  // Record-level permissions
  const canViewRecord = isOwner || permissions.hasPermission("view");
  const canCreateRecord = isOwner || permissions.hasPermission("create");
  const canEditRecord = isOwner || permissions.hasPermission("edit");
  const canDeleteRecord = isOwner || permissions.hasPermission("delete");

  // Layout / admin-level permissions
  const canManageAccess = isOwner || permissions.hasPermission("manageAccess");
  const canModifyLayout = canManageAccess;
  const handleForbidden = (err: any) => {
    const status = err?.response?.status || err?.status;
    if (status === 403) {
      toast.error("You can only view this public dashboard. Only the owner can make changes.");
      return true;
    }
    return false;
  };

  // Reset modals when navigating to a different dashboard or landing
  useEffect(() => {
    setIsAddInsightOpen(false);
    setIsAddWidgetOpen(false);
    setIsEditOpen(false);
    setIsDeleteOpen(false);
    setIsViewOpen(false);
    setIsAddOpen(false);
  }, [dashId]);

  useEffect(() => {
    const session = getCurrentSession();
    if (session?.user) setCurrentUser(session.user);
    if (session?.token) {
      fetchMe(session.token)
        .then((res) => setCurrentUser(res.user))
        .catch(() => {
          clearSession();
          setCurrentUser(null);
        });
    }
  }, []);

  useEffect(() => {
    if (!dashId || !sessionId) return;
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        const res = await dashboardApi.list(sessionId, currentUser?.id || undefined);
        let found = (res.dashboards || []).find((d) => d.id === dashId) as Dashboard | undefined;
        if (!found) {
          const fallback = await dashboardApi.getById(dashId, { sessionId, userId: currentUser?.id || undefined });
          found = (fallback as any)?.dashboard;
        }
        if (!active) return;
        if (!found) {
          setError("Dashboard not found");
          setDashboard(null);
          return;
        }
        const normalized =
          found && found.tables
            ? {
                ...found,
                tables: found.tables.map((t) => ({
                  ...t,
                  fields: (t.fields || []).map((f) => normalizeFieldVisibility(f)),
                })),
              }
            : found || null;
        setDashboard(normalized as Dashboard | null);
        setError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load dashboard";
        setError(message);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [dashId, sessionId, currentUser?.id]);

  useEffect(() => {
    if (!dashId || !sessionId) return;
    dashboardApi
      .listWidgets(dashId, { sessionId, userId: currentUser?.id })
      .then((res) => setWidgetConfigs(res.widgets || []))
      .catch(() => setWidgetConfigs([]));
  }, [dashId, sessionId, currentUser?.id]);

  const safeDashboard = useMemo(
    () => dashboard ?? { name: "", description: "", fields: [], widgets: [], tables: [] },
    [dashboard],
  );

  useEffect(() => {
    if (safeDashboard.widgets && safeDashboard.widgets.length) {
      setWidgetConfigs(safeDashboard.widgets as WidgetConfig[]);
    }
  }, [safeDashboard.widgets]);

  const effectiveWidgets = useMemo<WidgetConfig[]>(
    () => (Array.isArray(widgetConfigs) ? widgetConfigs.slice(0, 12) : []),
    [widgetConfigs],
  );

  const mergedTables = useMemo(
    () => (safeDashboard.tables && safeDashboard.tables.length > 0 ? safeDashboard.tables : []),
    [safeDashboard],
  );

  const handleTableCreated = useCallback(
    (table: DashboardTable | any) => {
      setDashboard((prev) => {
        if (!prev) return prev;
        const normalizedTable = {
          ...table,
          fields: (table.fields || []).map((f: any) => normalizeFieldVisibility(f)),
        };
        const nextTables = [...(prev.tables || []), normalizedTable];
        return { ...prev, tables: nextTables };
      });
      const nextId = table.key || table.id;
      if (nextId) {
        setActiveTableId(nextId);
        setActiveSection(nextId);
      }
    },
    [],
  );

  const tableSchemas = useMemo<TableSchema[]>(() => {
    return mergedTables
      .map((table, idx) => {
        const key = (table.key || table.id || `table-${idx}`).toString();
        const fields =
          (table.fields || [])
            .map((field: any) => {
              const fKey = getFieldKey(field);
              if (!fKey) return null;
              return {
                key: fKey.toString(),
                type: normalizeGeneratorFieldType((field.type || field.fieldType || "") as string),
              };
            })
            .filter(Boolean) as TableSchema["fields"];
        if (!fields.length) return null;
        return {
          key,
          name: table.name || key,
          fields,
        };
      })
      .filter(Boolean) as TableSchema[];
  }, [mergedTables]);

  const totalRecordCount = useMemo(
    () =>
      Object.values(recordsByTable).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0) +
      mergedTables.reduce(
        (sum, t) => sum + (Array.isArray((t as any).sampleRows) ? (t as any).sampleRows.length : 0),
        0,
      ),
    [recordsByTable, mergedTables],
  );

  const hasData = totalRecordCount > 0;
  const totalTables = mergedTables.length;
  const totalFields = mergedTables.reduce((sum, table) => sum + (table.fields?.length || 0), 0);
  const widgetsLimitReached = effectiveWidgets.length >= 12;
  const visibleInsights = useMemo(() => {
    const visible = chartConfigs.filter((i) => !i.hidden);
    const custom = visible.filter((i) => !i.autoGenerated);
    const auto = visible.filter((i) => i.autoGenerated);
    // show all, but keep custom charts first
    return [...custom, ...auto];
  }, [chartConfigs]);
  const dataDrivenMetrics: any[] = useMemo(() => [], []);
  const metricWidgets = effectiveWidgets.filter((w) => w.type === "metric");
  const chartWidgets = effectiveWidgets.filter((w) => w.type === "chart");
  const renderedWidgetList = metricWidgets.length ? metricWidgets : dataDrivenMetrics.length ? dataDrivenMetrics : overviewKpis;
  const totalWidgets = renderedWidgetList.length;
  const totalWidgetPages = Math.max(1, Math.ceil(totalWidgets / WIDGETS_PER_PAGE));
  const pagedWidgets = renderedWidgetList.slice((widgetPage - 1) * WIDGETS_PER_PAGE, widgetPage * WIDGETS_PER_PAGE);
  const renderedChartList = chartWidgets.length ? chartWidgets : visibleInsights;
  const totalCharts = renderedChartList.length;
  const totalChartPages = Math.max(1, Math.ceil(totalCharts / CHARTS_PER_PAGE));
  const pagedCharts = renderedChartList.slice((chartPage - 1) * CHARTS_PER_PAGE, chartPage * CHARTS_PER_PAGE);
  const totalInsights = useMemo(() => chartConfigs.filter((i) => !i.hidden).length, [chartConfigs]);

  const tableOptions = useMemo(
    () =>
      mergedTables.map((table, idx) => ({
        id: table.key || table.id || `table-${idx}`,
        title: table.name || `Table ${idx + 1}`,
        description: table.description || table.purpose || "",
        count:
          (recordsByTable[table.key || table.id || ""] || []).length ||
          (Array.isArray((table as any).sampleRows) ? (table as any).sampleRows.length : 0),
        ref: table,
      })),
    [mergedTables, recordsByTable],
  );
  const filteredTableOptions = useMemo(() => {
    if (!sidebarSearch.trim()) return tableOptions;
    const term = sidebarSearch.trim().toLowerCase();
    return tableOptions.filter((t) => (t.title || "").toLowerCase().includes(term));
  }, [tableOptions, sidebarSearch]);

  useEffect(() => {
    if (!tableOptions.length) return;
    if (!activeTableId || !tableOptions.some((t) => t.id === activeTableId)) {
      setActiveTableId(tableOptions[0].id);
    }
  }, [tableOptions, activeTableId]);

  const dashboardInput = useMemo(
    () => ({
      id: safeDashboard.id || undefined,
      name: safeDashboard.name || "Dashboard",
      description: safeDashboard.description,
      tables: tableSchemas,
    }),
    [safeDashboard.id, safeDashboard.name, safeDashboard.description, tableSchemas],
  );

  const mergedInsights = useMemo(() => {
    const persisted = Array.isArray(safeDashboard.insights) ? (safeDashboard.insights as InsightWidget[]) : [];
    const autoGenerated = generateDetailedInsights(dashboardInput).map((ins) => ({
      ...ins,
      autoGenerated: true,
      hidden: false,
    }));
    const map = new Map<string, InsightWidget>();
    autoGenerated.forEach((insight) => {
      map.set(insight.id, insight);
    });
    persisted.forEach((insight) => {
      if (!insight?.id) return;
      const base = map.get(insight.id);
      // Persisted overrides win for hidden/manual flags
      map.set(insight.id, {
        ...base,
        ...insight,
      });
    });
    return Array.from(map.values()).filter((ins) => !ins.hidden);
  }, [dashboardInput, safeDashboard.insights]);

  const selectedTables = useMemo(() => mergedTables.map((t) => t.name || t.id || "").filter(Boolean), [mergedTables]);

  const projectType = useMemo(() => {
    const normalized = `${safeDashboard.name || ""} ${safeDashboard.description || ""}`.toLowerCase();
    if (normalized.includes("hospital") || normalized.includes("clinic")) return "hospital";
    if (normalized.includes("school") || normalized.includes("education") || normalized.includes("class")) return "school";
    if (normalized.includes("store") || normalized.includes("retail") || normalized.includes("shop") || normalized.includes("sales")) return "store";
    if (normalized.includes("hr") || normalized.includes("human resource") || normalized.includes("employee")) return "hr";
    if (normalized.includes("crm") || normalized.includes("deal") || normalized.includes("pipeline")) return "crm";
    return "crm";
  }, [safeDashboard.description, safeDashboard.name]);

  const { metrics } = useDynamicDashboardMetrics({
    projectType,
    selectedTables,
    description: safeDashboard.description,
    hasData,
  });

  useEffect(() => {
    const withData =
      hasData && metrics?.length
        ? metrics.map((m) => ({
            id: m.key,
            title: m.label,
            description: m.description,
            value: m.value,
            icon: m.icon,
          }))
        : null;
    const placeholders = [
      { id: "kpi-1", title: "Revenue", description: "No data", value: 0 },
      { id: "kpi-2", title: "Active users", description: "No data", value: 0 },
      { id: "kpi-3", title: "Conversion", description: "No data", value: "0%" },
    ];
    setOverviewKpis(withData && withData.length ? withData : placeholders);
  }, [metrics, hasData]);

  useEffect(() => {
    const placeholderTableKey = tableSchemas[0]?.key || "placeholder";
    const placeholders: InsightWidget[] = [
      {
        id: "placeholder-ts",
        title: "Activity over time",
        description: "No data yet",
        chartType: "line",
        sourceTable: placeholderTableKey,
        metric: { op: "count", field: null },
        groupBy: { field: "created_at", timeBucket: "day" },
        autoGenerated: true,
        editable: false,
      },
      {
        id: "placeholder-breakdown",
        title: "Category breakdown",
        description: "No data yet",
        chartType: "bar",
        sourceTable: placeholderTableKey,
        metric: { op: "count", field: null },
        groupBy: { field: "category" },
        autoGenerated: true,
        editable: false,
      },
    ];
    const visible = mergedInsights.filter((i) => !i.hidden);
    const nextCharts = visible.length ? visible : placeholders;
    setChartConfigs(nextCharts);
  }, [mergedInsights, tableSchemas]);

  const fetchTableRecords = useCallback(
    async (tableKey: string, filterGroup?: FilterGroup | null) => {
      if (!dashId || !tableKey) return;
      try {
        const res = await dashboardApi.listRecords({
          dashboardId: dashId,
          tableKey,
          sessionId,
          userId: currentUser?.id,
          filters: filterGroup || null,
        });
        setRecordsByTable((prev) => ({ ...prev, [tableKey]: res.records || [] }));
      } catch {
        // Best-effort; sampleRows will be used as fallback.
      }
    },
    [dashId, sessionId, currentUser?.id],
  );

  const fetchDashboardData = useCallback(async () => {
    if (!dashId) return;
    try {
      const res = await dashboardApi.getDashboardData(dashId, { sessionId, userId: currentUser?.id });
      setWidgetResults(res.widgets || []);
    } catch {
      // ignore errors to keep UI responsive
    }
  }, [dashId, sessionId, currentUser?.id]);

  useEffect(() => {
    const activeOption = tableOptions.find((t) => t.id === activeTableId) || tableOptions[0];
    const activeTable = activeOption?.ref;
    if (!dashId || !activeTable) return;
    const tableKey = activeTable.key || activeTable.id || "";
    if (!tableKey) return;
    fetchTableRecords(tableKey, filtersByTable[tableKey] || null);
  }, [dashId, activeTableId, tableOptions, sessionId, filtersByTable, fetchTableRecords]);

  useEffect(() => {
    if (!dashId) return;
    fetchDashboardData();
  }, [dashId, fetchDashboardData]);

  const allTableKeys = useMemo(
    () => mergedTables.map((t) => t.key || t.id || "").filter(Boolean) as string[],
    [mergedTables],
  );

  // Preload counts for all tables so sidebar badges show immediately, but only once per table key
  useEffect(() => {
    if (!dashId || !allTableKeys.length) return;
    const targets = allTableKeys.filter((k) => !preloadedTablesRef.current.has(k));
    if (!targets.length) return;
    targets.forEach((k) => preloadedTablesRef.current.add(k));
      Promise.all(
        targets.map((tableKey) =>
          dashboardApi
            .listRecords({ dashboardId: dashId, tableKey, sessionId, userId: currentUser?.id })
            .then((res) => ({ tableKey, records: res.records || [] }))
            .catch(() => ({ tableKey, records: [] })),
      ),
    ).then((results) => {
      setRecordsByTable((prev) => {
        const next = { ...prev };
        results.forEach(({ tableKey, records }) => {
          next[tableKey] = records;
        });
        return next;
      });
    });
  }, [dashId, sessionId, currentUser?.id, allTableKeys]);

  const fetchReferenceOptions = useCallback(
    async (field: NormalizedField) => {
      const targetTable = field.referenceTableKey && field.referenceTableKey.trim().length > 0
        ? field.referenceTableKey
        : inferTableKeyFromFieldKey(field.key);
      if (!dashId || !targetTable) return;
      const fieldKey = field.key;
      setReferenceOptions((prev) => ({
        ...prev,
        [fieldKey]: { ...(prev[fieldKey] || {}), loading: true, loaded: false, error: undefined, targetTable },
      }));
      try {
        const res = await dashboardApi.listRecords({
          dashboardId: dashId,
          tableKey: targetTable,
          sessionId,
          userId: currentUser?.id,
        });
        const records = res.records || [];
        const mapped = records
          .map((row: any) => {
            const base = (row as any).record || row;
            const value = (row as any)._id || (row as any).id || base?._id || base?.id;
            if (!value) return null;
            let label: string | undefined;
            if (base?.first_name || base?.last_name) {
              label = `${base.first_name || ""} ${base.last_name || ""}`.trim();
            } else if (base?.specialty && (base?.first_name || base?.last_name)) {
              label = `${base.first_name || ""} ${base.last_name || ""} – ${base.specialty}`.trim();
            }
            if (!label) {
              const labelKey = labelPreferenceOrder.find((k) => base && k in base);
              label = labelKey ? base[labelKey] : undefined;
            }
            if (!label) label = `#${value}`;
            return { value: String(value), label: String(label) };
          })
          .filter(Boolean) as { value: string; label: string }[];
        console.log("reference options", fieldKey, mapped);
        setReferenceOptions((prev) => ({
          ...prev,
          [fieldKey]: { options: mapped, loading: false, loaded: true, targetTable },
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load reference data";
        toast.error(message);
        setReferenceOptions((prev) => ({
          ...prev,
          [fieldKey]: { options: [], loading: false, loaded: true, error: message, targetTable },
        }));
      }
    },
    [dashId, sessionId, currentUser?.id],
  );

  const activeTableOption = useMemo(() => {
    if (!tableOptions.length) return undefined;
    if (activeSection !== "overview") {
      return tableOptions.find((t) => t.id === activeSection) || tableOptions[0];
    }
    if (activeTableId) {
      return tableOptions.find((t) => t.id === activeTableId) || tableOptions[0];
    }
    return tableOptions[0];
  }, [activeSection, activeTableId, tableOptions]);

  const activeTable = activeTableOption?.ref;
  const activeTableKey = activeTable ? activeTable.key || activeTable.id || "" : "";
  const handleSchemaSaved = useCallback(
    (updatedFields: DashboardField[]) => {
      const targetKey = schemaTargetKey || activeTableKey;
      if (!targetKey) return;
      const normalizedFields = (updatedFields || []).map((f) => normalizeFieldVisibility(f));
      setDashboard((prev) => {
        if (!prev) return prev;
        const nextTables = (prev.tables || []).map((table) =>
          (table.key || table.id) === targetKey ? { ...table, fields: normalizedFields } : table,
        );
        return { ...prev, tables: nextTables };
      });
      setReferenceOptions({});
      fetchTableRecords(targetKey, filtersByTable[targetKey] || null);
    },
    [schemaTargetKey, activeTableKey, fetchTableRecords, filtersByTable],
  );
  const normalizedActiveFields = useMemo(() => normalizeFields(activeTable?.fields || []), [activeTable]);
  const visibleFields = useMemo(() => getVisibleFields(activeTable?.fields || []), [activeTable]);
  const filterFields = useMemo(
    () =>
      normalizedActiveFields.map((f) => ({
        key: f.key,
        type: f.type,
        label: f.label,
        enumValues: f.enumValues,
        isReference: f.isReference,
        referenceTableKey: f.referenceTableKey,
      })),
    [normalizedActiveFields],
  );
  const widgetResultMap = useMemo<Record<string, WidgetResult>>(
    () =>
      widgetResults.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, WidgetResult>),
    [widgetResults],
  );

  const tableRecords = useMemo(() => {
    if (!activeTable) return [];
    const fetched = activeTableKey ? recordsByTable[activeTableKey] : undefined;
    if (fetched && fetched.length) return fetched;
    if (Array.isArray(activeTable.sampleRows)) return activeTable.sampleRows;
    return [];
  }, [activeTable, activeTableKey, recordsByTable]);

  const tableDisplayRecords = useMemo(
    () =>
      tableRecords.map((rec) => {
        if (rec && typeof rec === "object" && "record" in (rec as any)) {
          const base = (rec as any).record || {};
          return { __meta: rec, ...base };
        }
        return rec;
      }),
    [tableRecords],
  );

  const activeFieldMap = useMemo(() => {
    const map = new Map<string, NormalizedField>();
    normalizedActiveFields.forEach((f) => {
      if (f.key) map.set(f.key, f);
    });
    return map;
  }, [normalizedActiveFields]);

  const filteredRecords = useMemo(() => {
    const group = filtersByTable[activeTableKey] || null;
    const term = tableSearch.toLowerCase();

    const matchCondition = (val: any, cond: any, fieldMeta?: NormalizedField) => {
      const op = cond.operator;
      if (val === undefined || val === null) return false;
      const raw = typeof val === "string" ? val : String(val);
      const targetType = (fieldMeta?.type || "").toLowerCase();
      const asNumber = Number(raw);
      const normalizeStr = (v: any) => String(v ?? "").toLowerCase();
      switch (op) {
        case "contains":
          return normalizeStr(raw).includes(normalizeStr(cond.value));
        case "starts_with":
          return normalizeStr(raw).startsWith(normalizeStr(cond.value));
        case "equals":
          return normalizeStr(raw) === normalizeStr(cond.value);
        case "not_equals":
          return normalizeStr(raw) !== normalizeStr(cond.value);
        case "gt":
          return targetType === "date" ? new Date(raw) > new Date(cond.value) : asNumber > Number(cond.value);
        case "gte":
          return targetType === "date" ? new Date(raw) >= new Date(cond.value) : asNumber >= Number(cond.value);
        case "lt":
          return targetType === "date" ? new Date(raw) < new Date(cond.value) : asNumber < Number(cond.value);
        case "lte":
          return targetType === "date" ? new Date(raw) <= new Date(cond.value) : asNumber <= Number(cond.value);
        case "between":
          if (targetType === "date") {
            const d = new Date(raw).getTime();
            return d >= new Date(cond.value).getTime() && d <= new Date(cond.valueTo).getTime();
          }
          return asNumber >= Number(cond.value) && asNumber <= Number(cond.valueTo);
        case "in":
          return Array.isArray(cond.value) && cond.value.map((v: any) => normalizeStr(v)).includes(normalizeStr(raw));
        default:
          return true;
      }
    };

    const passesFilters = (rec: any) => {
      if (!group || !group.conditions.length) return true;
      const results = group.conditions.map((cond) => {
        const fieldMeta = activeFieldMap.get(cond.field);
        const val = rec?.[cond.field];
        return matchCondition(val, cond, fieldMeta);
      });
      return group.mode === "AND" ? results.every(Boolean) : results.some(Boolean);
    };

    return tableDisplayRecords
      .filter((rec) => {
        if (!rec || typeof rec !== "object") return false;
        return passesFilters(rec);
      })
      .filter((rec) => {
        if (!tableSearch.trim()) return true;
        return Object.entries(rec).some(([key, value]) => {
          if (key === "__meta") return false;
          const valueStr = value === null || value === undefined ? "" : String(value);
          if (valueStr.toLowerCase().includes(term)) return true;
          const fieldMeta = activeFieldMap.get(key);
          if (fieldMeta?.isReference) {
            const opts = referenceOptions[key]?.options || [];
            const matched = opts.find((opt) => String(opt.value) === valueStr);
            if (matched?.label && matched.label.toLowerCase().includes(term)) return true;
          }
          return false;
        });
      });
  }, [activeFieldMap, activeTableKey, filtersByTable, referenceOptions, tableDisplayRecords, tableSearch]);

  const recordColumns = useMemo(() => {
    if (visibleFields.length) {
      return visibleFields
        .map((field) => ({ key: getFieldKey(field), label: displayFieldName(field) }))
        .filter((col) => Boolean(col.key) && !isSystemKey(col.key || ""))
        .slice(0, 6);
    }
    if (tableRecords.length) {
      return Object.keys(tableRecords[0])
        .filter((key) => key && !isSystemKey(key))
        .slice(0, 6)
        .map((key) => ({ key, label: beautifyLabel(key) }));
    }
    return [];
  }, [tableRecords, visibleFields]);

  const recordColumnCount = Math.max(recordColumns.length, 1);
  const actionsColumnWidth = 110;
  const viewFields = useMemo(() => {
    const targetKey = selectedRecordTableKey || activeTableKey;
    const targetTable = mergedTables.find((t) => (t.key || t.id || "") === targetKey);
    return normalizeFields(targetTable?.fields || []);
  }, [activeTableKey, mergedTables, selectedRecordTableKey]);

  useEffect(() => {
    if (!isAddOpen || !normalizedActiveFields.length) return;
    const initial: Record<string, any> = {};
    normalizedActiveFields.forEach((field) => {
      if (isSystemField(field) || isSelfReferencingId(field, activeTableKey)) return;
      initial[field.key] = field.type === "boolean" ? false : "";
    });
    setFormValues(initial);
    setFormErrors({});
  }, [isAddOpen, normalizedActiveFields, activeTableKey]);

  const [editFormValues, setEditFormValues] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!isEditOpen || !selectedRecord) return;
    const initial: Record<string, any> = {};
    normalizedActiveFields.forEach((field) => {
      const system = isSystemField(field) || isSelfReferencingId(field, activeTableKey);
      const value = (selectedRecord as any)?.[field.key];
      initial[field.key] = value !== undefined ? value : field.type === "boolean" ? false : "";
      if (system && value === undefined) {
        initial[field.key] = "";
      }
    });
    setEditFormValues(initial);
    setFormErrors({});
  }, [isEditOpen, selectedRecord, normalizedActiveFields, activeTableKey]);

  const handleEditSubmit = async () => {
    if (!dashId || !activeTableKey || !selectedRecord) return;
    const validation = validateFormValues(normalizedActiveFields, editFormValues, activeTableKey);
    setFormErrors(validation);
    if (Object.keys(validation).length) return;
    const recordId = getRecordId(selectedRecord);
    if (!recordId) {
      toast.error("Missing record id");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = buildRecordPayload(normalizedActiveFields, editFormValues, activeTableKey);
      await dashboardApi.updateDashboardRecord(dashId, activeTableKey, recordId, payload, sessionId, currentUser?.id);
      toast.success("Record updated");
      setIsEditOpen(false);
      setSelectedRecord(null);
      await fetchTableRecords(activeTableKey, filtersByTable[activeTableKey] || null);
      await fetchDashboardData();
    } catch (err) {
      if (handleForbidden(err)) return;
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Failed to update record";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isAddOpen) return;
    normalizedActiveFields
      .filter((f) => f.isReference && f.referenceTableKey)
      .forEach((f) => {
        const cache = referenceOptions[f.key];
        if (cache?.loading) return;
        if (cache?.loaded) return;
        fetchReferenceOptions(f);
      });
  }, [isAddOpen, normalizedActiveFields, referenceOptions, fetchReferenceOptions]);

  useEffect(() => {
    normalizedActiveFields
      .filter((f) => f.isReference && f.referenceTableKey)
      .forEach((f) => {
        const cache = referenceOptions[f.key];
        if (cache?.loading) return;
        if (cache?.loaded) return;
        fetchReferenceOptions(f);
      });
  }, [activeTableKey, normalizedActiveFields, referenceOptions, fetchReferenceOptions]);

  const handleCopyCode = async () => {
    if (!safeDashboard?.componentCode) return;
    try {
      await navigator.clipboard.writeText(safeDashboard.componentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenAdd = () => {
    if (!canCreateRecord || !activeTable) return;
    setIsAddOpen(true);
  };

  const handleFormChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmitRecord = async () => {
    if (!dashId || !activeTableKey) return;
    const validation = validateFormValues(normalizedActiveFields, formValues, activeTableKey);
    setFormErrors(validation);
    if (Object.keys(validation).length) return;
    setIsSubmitting(true);
    try {
      const payload = buildRecordPayload(normalizedActiveFields, formValues, activeTableKey);
      const res = await dashboardApi.createDashboardRecord(dashId, activeTableKey, payload, sessionId, currentUser?.id);
      const createdRecord = (res as any)?.record || payload;
      setRecordsByTable((prev) => {
        const prevRecords = prev[activeTableKey] || [];
        return { ...prev, [activeTableKey]: [createdRecord, ...prevRecords] };
      });
      setIsAddOpen(false);
      setFormValues({});
      setFormErrors({});
      toast.success("Record added successfully");
      await fetchTableRecords(activeTableKey, filtersByTable[activeTableKey] || null);
      await fetchDashboardData();
    } catch (err) {
      if (handleForbidden(err)) return;
      const status = (err as any)?.response?.status || (err as any)?.status;
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.data?.error ||
        (err as any)?.message ||
        "Failed to add record";
      if (status === 404) {
        toast.error("API endpoint not found. Check backend routes /dashboards/:id/records");
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRecordValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "--";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const handleView = (record: any) => {
    setSelectedRecord(record);
    setSelectedRecordTableKey(activeTableKey);
    setIsViewOpen(true);
  };

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setSelectedRecordTableKey(activeTableKey);
    setIsEditOpen(true);
  };

  const handleDelete = (record: any) => {
    setSelectedRecord(record);
    setSelectedRecordTableKey(activeTableKey);
    setIsDeleteOpen(true);
  };

  const openReferenceModal = async (tableKey: string, recordId: string) => {
    if (!dashId || !tableKey || !recordId) return;
    const normalizeId = (val: any) => (typeof val === "string" ? val : val?._id || val?.id || "");
    const localRecords = recordsByTable[tableKey] || [];
    const localHit = localRecords.find((r) => normalizeId(r) === recordId || normalizeId((r as any)?.record) === recordId);
    if (localHit) {
      const base = (localHit as any).record || localHit;
      setSelectedRecord(base);
      setSelectedRecordTableKey(tableKey);
      setIsViewOpen(true);
      return;
    }
    if (!/^[?f?F0-9]{24}$/.test(recordId)) {
      toast.error("Referenced record not found");
      return;
    }
    try {
      const res = await dashboardApi.getRecord({ dashboardId: dashId, tableKey, recordId, sessionId, userId: currentUser?.id });
      const record = (res as any)?.record?.record || (res as any)?.record || res;
      setSelectedRecord(record);
      setSelectedRecordTableKey(tableKey);
      setIsViewOpen(true);
    } catch (err) {
      const status = (err as any)?.response?.status || (err as any)?.status;
      const message =
        status === 404
          ? "Referenced record not found"
          : (err as any)?.response?.data?.message || (err as any)?.message || "Failed to load reference";
      toast.error(message);
    }
  };

  const getRecordId = (record: any) => (record?._id || record?.id || record?.__meta?._id || record?.__meta?.id || "");

  const handleDeleteConfirm = async () => {
    if (!dashId || !activeTableKey || !selectedRecord) return;
    const recordId = getRecordId(selectedRecord);
    if (!recordId) {
      toast.error("Missing record id");
      return;
    }
    try {
      await dashboardApi.deleteDashboardRecord(dashId, activeTableKey, recordId, sessionId, currentUser?.id);
      toast.success("Record deleted");
      setIsDeleteOpen(false);
      setSelectedRecord(null);
      await fetchTableRecords(activeTableKey, filtersByTable[activeTableKey] || null);
      await fetchDashboardData();
    } catch (err) {
      if (handleForbidden(err)) return;
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Failed to delete record";
      toast.error(message);
    }
  };

  const handleConfirmWidgetDelete = async () => {
    if (!canModifyLayout) {
      setConfirmWidgetId(null);
      return;
    }
    if (!dashId || !confirmWidgetId) return;
    const target = widgetConfigs.find((w) => w.id === confirmWidgetId || w.widgetKey === confirmWidgetId);
    const isManual = target?.source === "manual";
    setRemovingWidgetIds((prev) => {
      const next = new Set(prev);
      next.add(confirmWidgetId);
      return next;
    });
    setTimeout(() => {
      setWidgetConfigs((prev) => prev.filter((w) => w.id !== confirmWidgetId && w.widgetKey !== confirmWidgetId));
    }, 220);
    try {
      if (isManual) {
        await dashboardApi.deleteWidget(dashId, target?.id || confirmWidgetId, { sessionId, userId: currentUser?.id });
      } else {
        await dashboardApi.hideWidgetOverride(
          dashId,
          { widgetKey: target?.widgetKey || confirmWidgetId },
          { sessionId, userId: currentUser?.id },
        );
      }
      await fetchDashboardData();
    } catch (err) {
      if (handleForbidden(err)) return;
      const message = (err as any)?.message || "Failed to delete widget";
      toast.error(message);
    } finally {
      setConfirmWidgetId(null);
    }
  };

  const handleSaveWidget = async (data: {
    tableKey: string;
    columnKey: string;
    aggregation: MetricAggregation;
    metricType: MetricType;
    title: string;
    icon: MetricIcon;
    condition?: WidgetCondition;
  }) => {
    if (!canModifyLayout) {
      return;
    }
    if (!dashId) return;
    setSavingWidget(true);
    try {
      const res = await dashboardApi.createWidget(
        dashId,
        {
          tableKey: data.tableKey,
          columnKey: data.columnKey,
          aggregation: data.aggregation,
          metricType: data.metricType,
          condition: data.condition,
          title: data.title,
          icon: data.icon,
        },
        { sessionId, userId: currentUser?.id },
      );
      setWidgetConfigs((prev) => [...prev, res.widget].slice(0, 12));
      setIsAddWidgetOpen(false);
      await fetchDashboardData();
    } catch (err) {
      if (handleForbidden(err)) return;
      const message = (err as any)?.message || "Failed to save widget";
      toast.error(message);
    } finally {
      setSavingWidget(false);
    }
  };

  const handleSaveInsight = async (data: InsightForm) => {
    if (!canModifyLayout) {
      return;
    }
    if (!dashId) return;
    setSavingInsight(true);
    try {
      const metricField = data.metricField || undefined;
      const groupField = data.groupByField || undefined;
      const payload = {
        title: data.title,
        chartType: data.chartType,
        sourceTable: data.sourceTable,
        metric: { op: data.metricOp, field: metricField || null },
        groupBy: groupField ? { field: groupField, timeBucket: data.timeBucket } : undefined,
        limit: data.limit,
      };
      const res = await dashboardApi.createInsight(dashId, payload, { sessionId, userId: currentUser?.id });
      setChartConfigs((prev) => [...prev, res.insight].filter((i) => !i.hidden));
      setIsAddInsightOpen(false);
    } catch (err) {
      if (handleForbidden(err)) return;
      const message = (err as any)?.message || "Failed to save insight";
      toast.error(message);
    } finally {
      setSavingInsight(false);
    }
  };

  const handleRemoveInsight = async (insight: InsightWidget) => {
    if (!canModifyLayout) {
      return;
    }
    if (!dashId) return;
    try {
      if (insight.autoGenerated) {
        await dashboardApi.updateInsight(dashId, insight.id, { hidden: true }, { sessionId, userId: currentUser?.id });
        setChartConfigs((prev) => prev.map((i) => (i.id === insight.id ? { ...i, hidden: true } : i)).filter((i) => !i.hidden));
      } else {
        await dashboardApi.deleteInsight(dashId, insight.id, { sessionId, userId: currentUser?.id });
        setChartConfigs((prev) => prev.filter((i) => i.id !== insight.id));
      }
    } catch (err) {
      if (handleForbidden(err)) return;
      const status = (err as any)?.response?.status || (err as any)?.status;
      const nextState = (prev: InsightWidget[]) =>
        insight.autoGenerated
          ? prev.map((i) => (i.id === insight.id ? { ...i, hidden: true } : i)).filter((i) => !i.hidden)
          : prev.filter((i) => i.id !== insight.id);
      // If backend says 404 (already gone), treat as successful local removal
      setChartConfigs((prev) => nextState(prev));
      if (status !== 404) {
        const message = (err as any)?.message || "Failed to update insight";
        toast.error(message);
      }
    }
  };

  const mergeSeriesToRows = (series: { name: string; points: { x: any; y: number }[] }[]) => {
    const map = new Map<any, Record<string, any>>();
    series.forEach((s) => {
      s.points.forEach((p) => {
        const existing = map.get(p.x) || { x: p.x };
        existing[s.name || "value"] = p.y;
        map.set(p.x, existing);
      });
    });
    return Array.from(map.values()).sort((a, b) => (a.x > b.x ? 1 : -1));
  };

  const buildSeriesFromRecords = (records: any[], widget: WidgetConfig) => {
    const aggregate = widget.aggregate || "count";
    const groupBy = widget.groupByField;
    const seriesConfigs = Array.isArray(widget.seriesConfig) && widget.seriesConfig.length
      ? widget.seriesConfig
      : [{ name: widget.title || "Series", filter: undefined }];
    const series = seriesConfigs.map((sc, idx) => {
      const buckets = new Map<any, { total: number; count: number; min?: number; max?: number }>();
      const filtered = sc.filter
        ? records.filter((r) => Object.entries(sc.filter || {}).every(([k, v]) => r?.[k] === v))
        : records;
      filtered.forEach((row) => {
        const key = groupBy ? row?.[groupBy] ?? "Unknown" : "All";
        const current = buckets.get(key) || { total: 0, count: 0, min: undefined, max: undefined };
        const val = aggregate === "count" ? 1 : Number(row?.[widget.valueField || ""] ?? 0);
        if (aggregate === "count") {
          current.total += 1;
        } else if (!Number.isNaN(val)) {
          current.total += val;
          current.count += 1;
          current.min = current.min === undefined ? val : Math.min(current.min, val);
          current.max = current.max === undefined ? val : Math.max(current.max, val);
        }
        buckets.set(key, current);
      });
      const points = Array.from(buckets.entries())
        .map(([x, stats]) => {
          let y = 0;
          if (aggregate === "count") y = stats.total;
          if (aggregate === "sum") y = stats.total;
          if (aggregate === "avg") y = stats.count ? stats.total / stats.count : 0;
          if (aggregate === "min") y = stats.min ?? 0;
          if (aggregate === "max") y = stats.max ?? 0;
          return { x, y };
        })
        .sort((a, b) => (a.x > b.x ? 1 : -1));
      return { name: sc.name || `Series ${idx + 1}`, points };
    });
    return series;
  };

  const summarizeInsight = useCallback(
    (insight: InsightWidget) => {
      const sourceTable = insight.sourceTable;
      const table = mergedTables.find((t) => (t.key || t.id) === sourceTable);
      const rows = recordsByTable[sourceTable] || (Array.isArray((table as any)?.sampleRows) ? (table as any).sampleRows : []);
      if (!rows.length) {
        return { series: [], summary: "No data yet" };
      }
      const op = insight.metric?.op || "count";
      const valueField = insight.metric?.field || "";
      const groupField = insight.groupBy?.field;
      const bucket = insight.groupBy?.timeBucket;

      const formatBucket = (val: any) => {
        const date = val ? new Date(val) : null;
        if (!date || Number.isNaN(date.getTime())) return "Unknown";
        const y = date.getFullYear();
        const m = `${date.getMonth() + 1}`.padStart(2, "0");
        const d = `${date.getDate()}`.padStart(2, "0");
        if (bucket === "year") return `${y}`;
        if (bucket === "month") return `${y}-${m}`;
        if (bucket === "week") {
          const oneJan = new Date(date.getFullYear(), 0, 1);
          const numberOfDays = Math.floor((date.valueOf() - oneJan.valueOf()) / 86400000);
          const week = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
          return `${y}-W${String(week).padStart(2, "0")}`;
        }
        return `${y}-${m}-${d}`;
      };

      const buckets = new Map<string, { total: number; count: number; min?: number; max?: number }>();
      const pickValue = (row: any, key: string) => {
        if (!row || !key) return undefined;
        if (key in row) return row[key];
        const lower = key.toLowerCase();
        const match = Object.keys(row).find((k) => k.toLowerCase() === lower);
        return match ? row[match] : undefined;
      };
      rows.forEach((rawRow) => {
        const row = rawRow && typeof rawRow === "object" && "record" in (rawRow as any) ? (rawRow as any).record : rawRow;
        let groupKey = "All";
        if (groupField) {
          const raw = pickValue(row, groupField);
          groupKey = bucket ? formatBucket(raw) : raw ?? "Unknown";
        }
        let numericValue: number;
        if (op === "count") {
          numericValue = 1;
        } else {
          const rawVal = pickValue(row, valueField);
          const num = Number(rawVal);
          if (rawVal === null || rawVal === undefined || Number.isNaN(num)) return;
          numericValue = num;
        }
        const current = buckets.get(groupKey) || { total: 0, count: 0, min: undefined, max: undefined };
        current.total += numericValue;
        current.count += 1;
        current.min = current.min === undefined ? numericValue : Math.min(current.min, numericValue);
        current.max = current.max === undefined ? numericValue : Math.max(current.max, numericValue);
        buckets.set(groupKey, current);
      });

      const formatNumber = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

      const series = Array.from(buckets.entries()).map(([label, stats]) => {
        let value = 0;
        if (op === "count") value = stats.total;
        else if (op === "sum") value = stats.total;
        else if (op === "avg") value = stats.count ? stats.total / stats.count : 0;
        else if (op === "min") value = stats.min ?? 0;
        else if (op === "max") value = stats.max ?? 0;
        return { label, value };
      });

      const summary =
        series.length > 0
          ? series
              .slice(0, 3)
              .map((s) => `${s.label}: ${formatNumber(s.value)}`)
              .join(" | ")
          : "No data yet";

      return { series, summary };
    },
    [recordsByTable, mergedTables],
  );

  const handleUpdateInsightType = async (insight: InsightWidget, nextType: ChartType) => {
    if (!dashId) return;
    try {
      const backendType: InsightWidget["chartType"] = nextType === "horizontal-bar" ? "bar" : (nextType as any);
      await dashboardApi.updateInsight(dashId, insight.id, { chartType: backendType }, { sessionId, userId: currentUser?.id });
      setChartConfigs((prev) =>
        prev.map((i) => (i.id === insight.id ? { ...i, chartType: backendType } : i)),
      );
    } catch (err) {
      if (handleForbidden(err)) return;
      toast.error((err as any)?.message || "Failed to update chart type");
    }
  };

  useEffect(() => {
    if (widgetPage > totalWidgetPages) {
      setWidgetPage(totalWidgetPages);
    }
  }, [totalWidgetPages, widgetPage]);

  useEffect(() => {
    if (chartPage > totalChartPages) {
      setChartPage(totalChartPages);
    }
  }, [totalChartPages, chartPage]);

  const renderContent = () => {
    if (activeSection === "overview") {
      const renderChart = (widget: WidgetConfig) => {
        const result = widgetResultMap[widget.id];
        const records = widget.sourceTable ? recordsByTable[widget.sourceTable] || [] : [];
        const seriesToUse =
          result && result.hasData && result.series && result.series.length
            ? result.series
            : records.length
              ? buildSeriesFromRecords(records, widget)
              : [];
        if (!seriesToUse.length || seriesToUse.every((s) => !s.points.length || s.points.every((p) => p.y === 0))) {
          return <p className="mdChartSubtitle">No data yet</p>;
        }
        const isCategorical = widget.groupByField && widget.groupByField !== widget.dateField;
        const data = mergeSeriesToRows(seriesToUse);
        const colors = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9"];
        if (isCategorical) {
          return (
            <ReResponsiveContainer width="100%" height={220}>
              <ReBarChart data={data}>
                <ReCartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <ReXAxis dataKey="x" tick={{ fontSize: 12 }} />
                <ReYAxis tick={{ fontSize: 12 }} />
                <ReTooltip />
                <ReLegend />
                {seriesToUse.map((s, idx) => (
                  <ReBar key={s.name || idx} dataKey={s.name || `s${idx}`} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} />
                ))}
              </ReBarChart>
            </ReResponsiveContainer>
          );
        }
        return (
          <ReResponsiveContainer width="100%" height={220}>
            <ReLineChart data={data}>
              <ReCartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <ReXAxis dataKey="x" tick={{ fontSize: 12 }} />
              <ReYAxis tick={{ fontSize: 12 }} />
              <ReTooltip />
              <ReLegend />
              {seriesToUse.map((s, idx) => (
                <ReLine
                  key={s.name || idx}
                  type="monotone"
                  dataKey={s.name || `s${idx}`}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </ReLineChart>
          </ReResponsiveContainer>
        );
      };
      return (
        <div className="contentGrid">
          <div className="overviewSection">
            <div className="overviewSectionHeader">
              <div>
                <h4 className="overviewSectionTitle">Key metrics</h4>
                <p className="mdMainSubtitle">Key metrics and analytics</p>
              </div>
              <div className="tableActions">
                <div className="flex items-center gap-2 mr-2 text-sm text-slate-600">
                  <span>Page {widgetPage} of {totalWidgetPages}</span>
                  <Button
                    variant="outline"
                    className="mdGhostBtn"
                    size="sm"
                    disabled={widgetPage === 1}
                    onClick={() => setWidgetPage((p) => Math.max(1, p - 1))}
                  >
                    &lt;
                  </Button>
                  <Button
                    variant="outline"
                    className="mdGhostBtn"
                    size="sm"
                    disabled={widgetPage === totalWidgetPages}
                    onClick={() => setWidgetPage((p) => Math.min(totalWidgetPages, p + 1))}
                  >
                    &gt;
                  </Button>
                </div>
                {canModifyLayout && (
                  <Button
                    variant="outline"
                    className="mdGhostBtn"
                    disabled={widgetsLimitReached || !mergedTables.length}
                    title={
                      widgetsLimitReached
                        ? "You reached the maximum number of overview widgets."
                        : !mergedTables.length
                          ? "Add a table first to create widgets."
                          : ""
                    }
                    onClick={() => setIsAddWidgetOpen(true)}
                  >
                    Add widget
                  </Button>
                )}
                <Button variant="ghost" className="mdGhostBtn">
                  <Clock className="w-4 h-4 mr-2" />
                  Last 30 days
                </Button>
              </div>
            </div>
            <div className="overviewSectionGrid overviewMetricsGrid">
            {pagedWidgets.map((item, idx) => {
              const isWidget = (item as WidgetConfig).type !== undefined;
              if (isWidget) {
                const widget = item as WidgetConfig;
                const result = widgetResultMap[widget.id];
                  const hasData = Boolean(result?.hasData && (result?.value !== null && result?.value !== undefined));
                const displayValue = formatMetricValue(result?.value, result?.formattedValue as string | undefined);
                const Icon = pickMetricIcon(widget.title || "", widget.icon as MetricIcon | undefined);
                  const deletable = canModifyLayout && widget.source !== "hidden";
                return (
                  <MetricCard
                    key={widget.id}
                    icon={Icon}
                    title={widget.title}
                    value={displayValue as any}
                    description={hasData ? widget.description || "Data available" : "No data yet"}
                    deletable={deletable}
                    iconKey={widget.icon as MetricIcon | undefined}
                      onDelete={deletable ? () => setConfirmWidgetId(widget.id || widget.widgetKey || "") : null}
                      className={removingWidgetIds.has(widget.id) ? "removing" : ""}
                  />
                );
              }
                const fallback = item as any;
                return (
                  <MetricCard
                    key={fallback.id || idx}
                    icon={BarChart2}
                    title={fallback.title || "Metric"}
                    value={fallback.value || "No data"}
                    description={fallback.description || "No data"}
                  />
                );
              })}
            </div>
          </div>

          <div className="overviewSection">
            <div className="overviewSectionHeader">
              <div>
                <h4 className="overviewSectionTitle">Detailed charts</h4>
              </div>
              <div className="tableActions">
                {totalChartPages > 1 && (
                  <div className="flex items-center gap-2 mr-2 text-sm text-slate-600">
                    <span>Page {chartPage} of {totalChartPages}</span>
                    <Button
                      variant="outline"
                      className="mdGhostBtn"
                      size="sm"
                      disabled={chartPage === 1}
                      onClick={() => setChartPage((p) => Math.max(1, p - 1))}
                    >
                      &lt;
                    </Button>
                    <Button
                      variant="outline"
                      className="mdGhostBtn"
                      size="sm"
                      disabled={chartPage === totalChartPages}
                      onClick={() => setChartPage((p) => Math.min(totalChartPages, p + 1))}
                    >
                      &gt;
                    </Button>
                  </div>
                )}
                {canModifyLayout && (
                  <Button
                    variant="outline"
                    className="mdGhostBtn"
                    disabled={!mergedTables.length}
                    onClick={() => setIsAddInsightOpen(true)}
                    title={!mergedTables.length ? "Add a table first to create charts" : ""}
                  >
                    Add chart
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="mdGhostBtn"
                  disabled={!mergedTables.length}
                  title={!mergedTables.length ? "Add data first" : ""}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Last 30 days
                </Button>
              </div>
            </div>
            <div className="overviewSectionGrid overviewInsightsGrid">
              {pagedCharts.map((c, idx) => {
                const isWidget = (c as WidgetConfig).type !== undefined;
                const insight = c as InsightWidget;
                const result = isWidget ? widgetResultMap[(c as WidgetConfig).id] : null;
                const insightSummary = !isWidget ? summarizeInsight(insight) : null;

                const chartType: ChartType = isWidget
                  ? "bar"
                  : insight.chartType === "line"
                    ? "line"
                    : insight.chartType === "pie"
                      ? "pie"
                      : insight.chartType === "table"
                        ? "horizontal-bar"
                        : "bar";

                const dataset = (() => {
                  if (isWidget) {
                    const widget = c as WidgetConfig;
                    const resultSeries =
                      result?.series && result.series.length
                        ? result.series[0].points || []
                        : (() => {
                            const built = buildSeriesFromRecords(recordsByTable[widget.sourceTable] || [], widget) || [];
                            return built[0]?.points || [];
                          })();
                    return (resultSeries || [])
                      .map((p) => ({
                        label: p.x !== undefined && p.x !== null ? String(p.x) : "Unknown",
                        value: Number(p.y) || 0,
                      }))
                      .filter((d) => Number.isFinite(d.value));
                  }
                  return (insightSummary?.series || []).map((s) => ({
                    label: s.label || "Unknown",
                    value: Number(s.value) || 0,
                  }));
                })();

                const isLoading = isWidget ? result === undefined && !dataset.length : false;

                const handleChangeType =
                  canModifyLayout && !isWidget ? (next: ChartType) => handleUpdateInsightType(insight, next) : undefined;

                const handleRemove =
                  !canModifyLayout
                    ? undefined
                    : isWidget
                      ? () => setConfirmWidgetId((c as WidgetConfig).id || "")
                      : () => setConfirmInsight(insight);

                return (
                  <ChartCard
                    key={(c as any).id || idx}
                    title={(c as any).title || "Chart"}
                    description={(c as any).description || undefined}
                    type={chartType}
                    dataset={dataset}
                    unit={undefined}
                    isLoading={isLoading}
                    onChangeType={handleChangeType}
                    onRemove={handleRemove}
                    readOnly={!canModifyLayout}
                  />
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "access-control" && dashId && canManageAccess) {
      return <AccessControlTab dashboardId={dashId} sessionId={sessionId} userId={currentUser?.id} />;
    }

    const activeOption = tableOptions.find((t) => t.id === activeSection) || activeTableOption;
    if (!activeOption) {
      return (
        <Card className="p-6 tableCardGlass">
          <div className="tableHeader">
            <div>
              <h3 className="mainTitle">Tables</h3>
              <p className="mdMainSubtitle">No tables available</p>
            </div>
          </div>
        </Card>
      );
    }

    const tableKey = activeOption.ref?.key || activeOption.ref?.id || "";

    const canAnyRowAction = canViewRecord || canEditRecord || canDeleteRecord;

    return (
      <div className="tableCardGlass">
        <div className="tableHeader">
          <div>
            <h3 className="mainTitle">{activeOption.title}</h3>
            <p className="mdMainSubtitle">{activeOption.description || "Manage records and fields"}</p>
          </div>
          <div className="tableActions">
            <div className="mdSearch">
              <Search className="searchIcon" />
              <Input
                placeholder="Search records..."
                className="searchInput"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
            {canManageAccess && (
              <Button
                variant="ghost"
                className="mdGhostBtn"
                disabled={!tableKey}
                onClick={() => {
                  setSchemaTargetKey(tableKey);
                  setIsEditSchemaOpen(true);
                }}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Edit columns
              </Button>
            )}
            <Button
              variant="outline"
              className="mdGhostBtn relative"
              onClick={() => setIsFiltersOpen(true)}
              disabled={!tableKey}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {filterCounts[tableKey] ? (
                <span className="ml-2 rounded-full bg-indigo-500 px-2 text-xs font-semibold text-white">
                  {filterCounts[tableKey]}
                </span>
              ) : null}
            </Button>
            {canCreateRecord && (
              <Button className="primaryBtn" onClick={handleOpenAdd} disabled={!tableKey}>
                <Plus className="w-4 h-4 mr-2" />
                Add record
              </Button>
            )}
          </div>
        </div>

        <div className="recordTableWrap simple">
            <div className="recordTableScroll">
            <div className="recordTable">
              <div
                className="recordHeaderRow"
                  style={{
                    gridTemplateColumns: canAnyRowAction
                      ? `repeat(${recordColumnCount}, minmax(140px, 1fr)) ${actionsColumnWidth}px`
                      : `repeat(${recordColumnCount}, minmax(140px, 1fr))`,
                  }}
                >
                {recordColumns.map((col) => (
                  <div key={col.key} className="recordCell header">
                    {col.label}
                  </div>
                ))}
                {canAnyRowAction && <div className="recordCell header">Actions</div>}
              </div>
              {filteredRecords.length ? (
                filteredRecords.map((record, idx) => {
                  const meta = (record as any).__meta;
                return (
                  <div
                    key={(meta as any)?.id || (record as any)?.id || (meta as any)?._id || idx}
                    className="recordRow"
                    style={{
                      gridTemplateColumns: canAnyRowAction
                        ? `repeat(${recordColumnCount}, minmax(140px, 1fr)) ${actionsColumnWidth}px`
                        : `repeat(${recordColumnCount}, minmax(140px, 1fr))`,
                    }}
                  >
                    {recordColumns.map((col) => (
                      <div key={col.key} className="recordCell">
                        {(() => {
                          const val = (record as any)?.[col.key];
                          const fieldMeta = activeFieldMap.get(col.key);
                          if (fieldMeta?.isReference && fieldMeta.referenceTableKey && val) {
                            const refData = referenceOptions[col.key];
                            const matched = refData?.options?.find((opt) => opt.value === val);
                            const displayValue = matched?.label || val;
                            const display =
                              typeof displayValue === "string" && displayValue.length > 16
                                ? `${displayValue.slice(0, 6)}?${displayValue.slice(-4)}`
                                : renderRecordValue(displayValue);
                            return (
                              <span
                                className="underline text-sm cursor-pointer hover:opacity-80"
                                style={{ color: "#2563eb" }}
                                onClick={() => openReferenceModal(fieldMeta.referenceTableKey as string, String(val))}
                              >
                                {display}
                              </span>
                            );
                          }
                          return renderRecordValue(val);
                        })()}
                      </div>
                    ))}
                    {canAnyRowAction && (
                      <div className="recordCell recordActions">
                        {canViewRecord && (
                          <button className="recordIconBtn view" title="View record" onClick={() => handleView(record)}>
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {canEditRecord && (
                          <button className="recordIconBtn edit" title="Edit" onClick={() => handleEdit(record)}>
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDeleteRecord && (
                          <button className="recordIconBtn danger" title="Delete" onClick={() => handleDelete(record)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
              ) : (
                <div className="tableEmpty padded">
                  {tableDisplayRecords.length
                    ? "No records match your search."
                    : "No data yet. Add your first record to populate this table."}
                </div>
              )}
            </div>
            </div>
        </div>
      </div>
    );
  };

  const sidebarItems = useMemo(
    () => {
      const items = [{ id: "overview", label: "Overview", icon: BarChart3 } as any];
      items.push(
        ...filteredTableOptions.map((table) => ({
          id: table.id,
          label: table.title,
          icon: TableIcon,
          count: table.count,
        })),
      );
      if (canModifyLayout) {
        items.push({ id: "add-table", label: "Add table", icon: Plus, add: true });
      }
      if (canManageAccess) {
        items.push({ id: "access-control", label: "Access control", icon: ShieldCheck });
      }
      return items;
    },
    [filteredTableOptions, canModifyLayout, canManageAccess],
  );

  if (!dashId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <div className="text-gray-500">Missing dashboard id.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="mdDetailPage">
      <div className="mdDetailBg" />
      <div className="mdDetailLayout">
        <aside className="mdDetailSidebar">
          <div className="mdSidebarHeader">
            <div className="mdAvatar">{safeDashboard.name?.slice(0, 2).toUpperCase() || "DB"}</div>
            <div>
              <div className="mdSidebarTitle">{safeDashboard.name || "AI dashboard"}</div>
              <div className="mdSidebarSubtitle">{safeDashboard.type || "healthcare"}</div>
            </div>
            <button className="mdBackIcon" onClick={() => navigate("/managedash")} aria-label="Back to dashboards">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="mdSidebarSearch">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              placeholder="Search..."
              className="mdSidebarSearchInput"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />
          </div>
          <nav className="mdSidebarNav">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                className={`mdNavItem ${!item.add && activeSection === item.id ? "active" : ""} ${item.add ? "mdNavItemGhost" : ""}`}
                onClick={() => {
                  if (item.add) {
                    setIsCreateTableOpen(true);
                    return;
                  }
                  setActiveSection(item.id);
                  const targetTable = tableOptions.find((t) => t.id === item.id);
                  if (targetTable) setActiveTableId(item.id);
                }}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {typeof item.count === "number" && <span className="mdNavBadge">{item.count}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <main className="mdDetailMain">
          <div className="mdMainHeader">
            <div>
              <p className="mdMainSubtitle">Updated {new Date().toLocaleDateString()}</p>
              <h1 className="mdMainTitle">{safeDashboard.name || "AI Dashboard"}</h1>
              <p className="mdMainSubtitle">Modern overview with analytics and tables</p>
            </div>
          </div>

          <div className="mdContentArea">{renderContent()}</div>
          {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        </main>
      </div>

      <EditTableStructureModal
        open={Boolean(isEditSchemaOpen && dashId && (schemaTargetKey || activeTableKey))}
        onClose={() => {
          setIsEditSchemaOpen(false);
          setSchemaTargetKey(null);
        }}
        dashboardId={dashId || ""}
        tableKey={schemaTargetKey || activeTableKey}
        tables={mergedTables as DashboardTable[]}
        sessionId={sessionId}
        userId={currentUser?.id}
        onSaved={handleSchemaSaved}
      />

      <CreateTableModal
        isOpen={canManageAccess && isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        dashboardId={dashId || ""}
        existingTables={mergedTables as DashboardTable[]}
        sessionId={sessionId}
        userId={currentUser?.id}
        onCreated={handleTableCreated}
      />

      <TableFiltersModal
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        tableKey={activeTableKey}
        fields={filterFields}
        value={filtersByTable[activeTableKey] || null}
        onChange={(next) => setTableFilters(activeTableKey, next)}
      />

      <AddRecordModal
        open={canCreateRecord && isAddOpen}
        onClose={() => setIsAddOpen(false)}
        tableName={activeTable?.name || "table"}
        tableKey={activeTableKey}
        fields={normalizedActiveFields}
        values={formValues}
        errors={formErrors}
        mode="create"
        referenceOptions={referenceOptions}
        onChange={handleFormChange}
        onSubmit={handleSubmitRecord}
        isSubmitting={isSubmitting}
      />

      <ViewRecordModal
        open={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setSelectedRecord(null);
          setSelectedRecordTableKey(null);
        }}
        record={selectedRecord}
        fields={viewFields}
        referenceOptions={referenceOptions}
        onOpenReference={openReferenceModal}
        entityName={
          mergedTables.find((t) => (t.key || t.id || "") === (selectedRecordTableKey || activeTableKey))?.name ||
          activeTable?.name ||
          activeTableKey ||
          "Entity"
        }
      />

      <AddRecordModal
        open={canEditRecord && isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedRecord(null);
        }}
        tableName={activeTable?.name || "table"}
        tableKey={activeTableKey}
        fields={normalizedActiveFields}
        values={editFormValues}
        errors={formErrors}
        mode="edit"
        referenceOptions={referenceOptions}
        onChange={(key, value) => {
          setEditFormValues((prev) => ({ ...prev, [key]: value }));
          if (formErrors[key]) {
            setFormErrors((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }
        }}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
      />

      <DeleteConfirmDialog
        open={isDeleteOpen}
        record={selectedRecord}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelectedRecord(null);
        }}
        onConfirm={handleDeleteConfirm}
      />

      <AddInsightModal
        open={canModifyLayout && isAddInsightOpen}
        onClose={() => setIsAddInsightOpen(false)}
        tables={mergedTables as DashboardTable[]}
        recordsByTable={recordsByTable}
        tableSchemas={tableSchemas}
        onSave={handleSaveInsight}
        saving={savingInsight}
      />

      <AddWidgetModal
        open={canModifyLayout && isAddWidgetOpen}
        onClose={() => setIsAddWidgetOpen(false)}
        tables={mergedTables as DashboardTable[]}
        onSave={handleSaveWidget}
        saving={savingWidget}
        maxReached={widgetsLimitReached}
      />

      {confirmWidgetId && (
        <div className="mdModalOverlay">
          <div className="mdModal">
            <div className="mdModalHeader">
              <h3 className="mdModalTitle">Remove widget?</h3>
            </div>
            <div className="mdModalBody">
              <p className="mdMainSubtitle">This widget will be removed from your dashboard.</p>
            </div>
            <div className="mdModalFooter">
              <Button variant="outline" onClick={() => setConfirmWidgetId(null)} className="mdGhostBtn">
                Cancel
              </Button>
              <Button className="primaryBtn" onClick={handleConfirmWidgetDelete}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmInsight && (
        <div className="mdModalOverlay">
          <div className="mdModal">
            <div className="mdModalHeader">
              <h3 className="mdModalTitle">Remove insight?</h3>
            </div>
            <div className="mdModalBody">
              <p className="mdMainSubtitle">
                {confirmInsight.autoGenerated
                  ? "This insight will be hidden for this dashboard."
                  : "This manual insight will be removed."}
              </p>
            </div>
            <div className="mdModalFooter">
              <Button variant="outline" onClick={() => setConfirmInsight(null)} className="mdGhostBtn">
                Cancel
              </Button>
              <Button
                className="primaryBtn"
                onClick={async () => {
                  await handleRemoveInsight(confirmInsight);
                  setConfirmInsight(null);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
