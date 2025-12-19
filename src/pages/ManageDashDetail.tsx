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
  PieChart,
  Plus,
  Eye,
  Pencil,
  Search,
  Table as TableIcon,
  Trash2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dashboardApi, type Dashboard, type DashboardTable } from "../services/dashboards";
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
} from "recharts";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { buildDomainModel, generateInsightChartsFromDomain, type InsightChartConfig } from "../dashboard/insightGenerator";
import { useDynamicDashboardMetrics } from "../dashboard/useDynamicDashboardMetrics";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import "../styles/managedash-detail.css";

const DASHBOARD_SESSION_KEY = "socialhub:dashboards_session";
const getSessionId = () => {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(DASHBOARD_SESSION_KEY);
  if (existing) return existing;
  const generated = (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, "");
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

type MetricAggregation = "sum" | "avg";

type MetricIcon = "money" | "analytics";

type AddWidgetFormState = {
  tableKey: string;
  columnKey: string;
  aggregation: MetricAggregation;
  title: string;
  icon: MetricIcon;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const beautifyLabel = (text: string) =>
  text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const getFieldKey = (field: any) => field.key || field.fieldName || field.name || field.id || "";

const displayFieldName = (field: any) => field.fieldName || field.name || field.key || field.id || "Field";

const getVisibleFields = (fields: any[] = []) =>
  fields.filter((f) => {
    const key = (f.key || f.fieldName || f.name || "").toString().toLowerCase();
    return key && key !== "_id" && key !== "created_at" && key !== "updated_at";
  });

const formatMetricValue = (value: number | null | undefined, formatted?: string | null) => {
  if (value === null || value === undefined) return "No data yet";
  if (typeof formatted === "string" && formatted.length) return formatted;
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) : "No data yet";
};

const pickMetricIcon = (title: string) => {
  const lower = title.toLowerCase();
  const moneyHints = ["revenue", "amount", "price", "cost", "payment", "billing", "bill", "invoice", "sale", "sales"];
  return moneyHints.some((hint) => lower.includes(hint)) ? DollarSign : BarChart2;
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
          : undefined;
      const resolvedType = (field.type || field.fieldType || (field as any).dataType || "").toString().toLowerCase() || "string";
      const endsWithId = lowerKey.endsWith("_id");
      const isReferenceType = resolvedType === "reference" || Boolean((field as any).references);
      const isReference = isReferenceType || endsWithId;
      const baseKey = endsWithId ? lowerKey.replace(/_id$/, "") : lowerKey;
      const fromRef = (field as any).references?.table || (field as any).references?.tableKey;
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

const isSystemTimestampField = (key: string) => {
  const lower = key.toLowerCase();
  return lower === "created_at" || lower === "updated_at";
};

const labelPreferenceOrder = ["name", "full_name", "email", "title", "code", "_id"];

const validateFormValues = (fields: NormalizedField[], values: Record<string, any>) => {
  const errors: Record<string, string> = {};
  fields.forEach((field) => {
    if (field.isId || isSystemTimestampField(field.key)) return;
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

const buildRecordPayload = (fields: NormalizedField[], values: Record<string, any>) => {
  const payload: Record<string, any> = {};
  fields.forEach((field) => {
    if (field.isId || isSystemTimestampField(field.key)) return;
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
  description = "No data",
  onDelete,
  deletable,
  className = "",
}: MetricCardProps) => (
  <div className={`kpiCard relative ${className}`}>
    {deletable && onDelete && (
      <button className="metricDeleteBtn" title="Remove widget" aria-label="Remove widget" onClick={onDelete}>
        ×
      </button>
    )}
    <div className="kpiIcon">
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="kpiTitle">{title}</p>
      <p className="kpiValue">{value}</p>
      <p className="mdMainSubtitle">{description}</p>
    </div>
  </div>
);

const numericFieldTypes = ["number", "integer", "int", "float", "double", "decimal", "currency", "money", "amount", "numeric"];
const looksNumericField = (field: any) => numericFieldTypes.includes((field?.type || field?.fieldType || "").toString().toLowerCase());

type AddWidgetModalProps = {
  open: boolean;
  onClose: () => void;
  tables: DashboardTable[];
  onSave: (data: { tableKey: string; columnKey: string; aggregation: MetricAggregation; title: string; icon: MetricIcon }) => Promise<void>;
  saving: boolean;
  maxReached: boolean;
};

const AddWidgetModal = ({ open, onClose, tables, onSave, saving, maxReached }: AddWidgetModalProps) => {
  const [form, setForm] = useState<AddWidgetFormState>({
    tableKey: tables[0]?.key || tables[0]?.id || "",
    columnKey: "",
    aggregation: "sum",
    title: "",
    icon: "analytics",
  });
  const [columns, setColumns] = useState<any[]>([]);
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
    setColumns(numericFields);
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
    if (col) {
      handleChange("title", buildDefaultTitle(agg, col));
    }
  };

  const onTableChange = (tableKey: string) => {
    handleChange("tableKey", tableKey);
    setForm((prev) => ({ ...prev, columnKey: "" }));
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
            <Select value={form.aggregation} onValueChange={(v) => onAggregationChange(v as MetricAggregation)}>
              <SelectTrigger className="mdSelect">
                <SelectValue placeholder="Select aggregation" />
              </SelectTrigger>
              <SelectContent position="popper" className="mdSelectContent">
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="avg">Average</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                <SelectItem value="money">Money</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
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
              await onSave({
                tableKey: form.tableKey,
                columnKey: form.columnKey,
                aggregation: form.aggregation,
                title: form.title || "Metric",
                icon: form.icon,
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

type AddRecordModalProps = {
  open: boolean;
  onClose: () => void;
  tableName: string;
  fields: NormalizedField[];
  values: Record<string, any>;
  errors: Record<string, string>;
  referenceOptions: Record<
    string,
    { options: { value: string; label: string }[]; loading?: boolean; error?: string; targetTable?: string }
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
    if (field.isId) return null;
    if (field.isReference && field.referenceTableKey) {
      const refData = referenceOptions[field.key] || { options: [], loading: true };
      const opts = refData.options || [];
      const placeholder = `Select ${field.label.toLowerCase()}`;
      const targetTable = refData.targetTable || field.referenceTableKey;
      return (
        <Select
          value={values[field.key] ?? ""}
          onValueChange={(val) => onChange(field.key, val)}
          disabled={isSubmitting || refData.loading}
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
                No records available in {targetTable}. Add one first.
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
            onChange={(e) => onChange(field.key, e.target.checked)}
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
            onChange={(e) => onChange(field.key, e.target.value)}
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
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder="Enter value"
        />
      );
    }
    const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
    return (
      <Input
        type={inputType}
        value={values[field.key] ?? ""}
        onChange={(e) => onChange(field.key, inputType === "number" ? e.target.value : e.target.value)}
        placeholder={`Enter ${field.label.toLowerCase()}`}
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
            <p className="mdMainSubtitle">Create a new record</p>
            <h3 className="mdModalTitle">Add {tableName} record</h3>
          </div>
          <Button variant="ghost" className="mdGhostBtn" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <div className="mdModalBody">
          {fields.filter((field) => !field.isId && !isSystemTimestampField(field.key)).map((field) => (
            <div key={field.key} className="mdFormGroup">
              <label className="mdFormLabel">
                {field.label} {field.required && <span className="requiredStar">*</span>}
              </label>
              {renderFieldInput(field)}
              {errors[field.key] && <p className="mdInputError">{errors[field.key]}</p>}
            </div>
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
};

const ViewRecordModal = ({ open, onClose, record, fields, entityName }: ViewRecordModalProps) => {
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
                      <div className="viewValue">{formatValue(field, val)}</div>
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
  const [chartConfigs, setChartConfigs] = useState<InsightChartConfig[]>([]);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [recordsByTable, setRecordsByTable] = useState<Record<string, any[]>>({});
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [referenceOptions, setReferenceOptions] = useState<
    Record<string, { options: { value: string; label: string }[]; loading?: boolean; error?: string; targetTable?: string }>
  >({});
  const [widgetResults, setWidgetResults] = useState<WidgetResult[]>([]);
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfig[]>([]);
  const preloadedTablesRef = useRef<Set<string>>(new Set());
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [savingWidget, setSavingWidget] = useState(false);
  const [removingWidgetIds, setRemovingWidgetIds] = useState<Set<string>>(new Set());
  const [confirmWidgetId, setConfirmWidgetId] = useState<string | null>(null);

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
    dashboardApi
      .list(sessionId, currentUser?.id || undefined)
      .then((res) => {
        if (!active) return;
        const found = (res.dashboards || []).find((d) => d.id === dashId);
        if (!found) setError("Dashboard not found");
        setDashboard(found || null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
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
  const totalInsights = chartConfigs.length;

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

  useEffect(() => {
    if (!tableOptions.length) return;
    if (!activeTableId || !tableOptions.some((t) => t.id === activeTableId)) {
      setActiveTableId(tableOptions[0].id);
    }
  }, [tableOptions, activeTableId]);

  const domainModel = useMemo(
    () => buildDomainModel(safeDashboard, mergedTables as DashboardTable[]),
    [safeDashboard, mergedTables],
  );

  const defaultInsights = useMemo(() => generateInsightChartsFromDomain(domainModel), [domainModel]);

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
    const placeholders: InsightChartConfig[] = [
      { id: "placeholder-ts", title: "Activity over time", description: "No data", type: "timeSeries", range: "Empty" } as any,
      { id: "placeholder-breakdown", title: "Category breakdown", description: "No data", type: "breakdown" } as any,
    ];
    const nextCharts = hasData && defaultInsights.length ? defaultInsights : placeholders;
    setChartConfigs(nextCharts);
  }, [defaultInsights, hasData]);

  const fetchTableRecords = useCallback(
    async (tableKey: string) => {
      if (!dashId || !tableKey) return;
      try {
        const res = await dashboardApi.listRecords({ dashboardId: dashId, tableKey, sessionId, userId: currentUser?.id });
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
    fetchTableRecords(tableKey);
  }, [dashId, activeTableId, tableOptions, sessionId, fetchTableRecords]);

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
      const targetTable = field.referenceTableKey;
      if (!dashId || !targetTable) return;
      const fieldKey = field.key;
      setReferenceOptions((prev) => ({
        ...prev,
        [fieldKey]: { ...(prev[fieldKey] || {}), loading: true, error: undefined, targetTable },
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
          [fieldKey]: { options: mapped, loading: false, targetTable },
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load reference data";
        toast.error(message);
        setReferenceOptions((prev) => ({
          ...prev,
          [fieldKey]: { options: [], loading: false, error: message, targetTable },
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
  const normalizedActiveFields = useMemo(() => normalizeFields(activeTable?.fields || []), [activeTable]);
  const visibleFields = useMemo(() => getVisibleFields(activeTable?.fields || []), [activeTable]);
  const widgetResultMap = useMemo<Record<string, WidgetResult>>(
    () =>
      widgetResults.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, WidgetResult>),
    [widgetResults],
  );

  const dataDrivenMetrics: any[] = useMemo(() => [], []);

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

  const recordColumns = useMemo(() => {
    if (visibleFields.length) {
      return visibleFields
        .map((field) => ({ key: getFieldKey(field), label: displayFieldName(field) }))
        .filter((col) => Boolean(col.key))
        .slice(0, 6);
    }
    if (tableRecords.length) {
      return Object.keys(tableRecords[0])
        .filter((key) => key && key !== "_id" && key !== "id")
        .slice(0, 6)
        .map((key) => ({ key, label: beautifyLabel(key) }));
    }
    return [];
  }, [tableRecords, visibleFields]);

  const recordColumnCount = (recordColumns.length || 1) + 1;

  useEffect(() => {
    if (!isAddOpen || !normalizedActiveFields.length) return;
    const initial: Record<string, any> = {};
    normalizedActiveFields.forEach((field) => {
      if (field.isId || isSystemTimestampField(field.key)) return;
      initial[field.key] = field.type === "boolean" ? false : "";
    });
    setFormValues(initial);
    setFormErrors({});
  }, [isAddOpen, normalizedActiveFields]);

  const [editFormValues, setEditFormValues] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!isEditOpen || !selectedRecord) return;
    const initial: Record<string, any> = {};
    normalizedActiveFields.forEach((field) => {
      if (field.isId || isSystemTimestampField(field.key)) return;
      initial[field.key] = (selectedRecord as any)?.[field.key] ?? (field.type === "boolean" ? false : "");
    });
    setEditFormValues(initial);
    setFormErrors({});
  }, [isEditOpen, selectedRecord, normalizedActiveFields]);

  const handleEditSubmit = async () => {
    if (!dashId || !activeTableKey || !selectedRecord) return;
      const validation = validateFormValues(normalizedActiveFields, editFormValues);
      setFormErrors(validation);
      if (Object.keys(validation).length) return;
      const recordId = getRecordId(selectedRecord);
      if (!recordId) {
      toast.error("Missing record id");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = buildRecordPayload(normalizedActiveFields, editFormValues);
      await dashboardApi.updateDashboardRecord(dashId, activeTableKey, recordId, payload, sessionId, currentUser?.id);
      toast.success("Record updated");
      setIsEditOpen(false);
      setSelectedRecord(null);
      await fetchTableRecords(activeTableKey);
      await fetchDashboardData();
    } catch (err) {
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
        if (cache && (cache.options?.length || cache.loading === false)) return;
        fetchReferenceOptions(f);
      });
  }, [isAddOpen, normalizedActiveFields, referenceOptions, fetchReferenceOptions]);

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
    if (!activeTable) return;
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
    const validation = validateFormValues(normalizedActiveFields, formValues);
    setFormErrors(validation);
    if (Object.keys(validation).length) return;
    setIsSubmitting(true);
    try {
      const payload = buildRecordPayload(normalizedActiveFields, formValues);
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
      await fetchTableRecords(activeTableKey);
      await fetchDashboardData();
    } catch (err) {
      const status = (err as any)?.status;
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
    setIsViewOpen(true);
  };

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setIsEditOpen(true);
  };

  const handleDelete = (record: any) => {
    setSelectedRecord(record);
    setIsDeleteOpen(true);
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
      await fetchTableRecords(activeTableKey);
      await fetchDashboardData();
    } catch (err) {
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Failed to delete record";
      toast.error(message);
    }
  };

  const handleConfirmWidgetDelete = async () => {
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
      const message = (err as any)?.message || "Failed to delete widget";
      toast.error(message);
    } finally {
      setConfirmWidgetId(null);
    }
  };

  const handleSaveWidget = async (data: { tableKey: string; columnKey: string; aggregation: MetricAggregation; title: string; icon: MetricIcon }) => {
    if (!dashId) return;
    setSavingWidget(true);
    try {
      const res = await dashboardApi.createWidget(
        dashId,
        {
          tableKey: data.tableKey,
          columnKey: data.columnKey,
          aggregation: data.aggregation,
          title: data.title,
          icon: data.icon,
        },
        { sessionId, userId: currentUser?.id },
      );
      setWidgetConfigs((prev) => [...prev, res.widget].slice(0, 12));
      setIsAddWidgetOpen(false);
      await fetchDashboardData();
    } catch (err) {
      const message = (err as any)?.message || "Failed to save widget";
      toast.error(message);
    } finally {
      setSavingWidget(false);
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

  const renderContent = () => {
    if (activeSection === "overview") {
      const metricWidgets = effectiveWidgets.filter((w) => w.type === "metric");
      const chartWidgets = effectiveWidgets.filter((w) => w.type === "chart");
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
          <div className="tableHeader">
            <div>
              <h3 className="mainTitle">Overview</h3>
              <p className="mdMainSubtitle">Key metrics and analytics</p>
            </div>
            <div className="tableActions">
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
              <Button variant="ghost" className="mdGhostBtn">
                <Clock className="w-4 h-4 mr-2" />
                Last 30 days
              </Button>
            </div>
          </div>

          <div className="overviewSection">
            <div className="overviewSectionHeader">
              <h4 className="overviewSectionTitle">Key metrics</h4>
            </div>
            <div className="overviewSectionGrid overviewMetricsGrid">
            {(metricWidgets.length ? metricWidgets : dataDrivenMetrics.length ? dataDrivenMetrics : overviewKpis).map((item, idx) => {
              const isWidget = (item as WidgetConfig).type !== undefined;
              if (isWidget) {
                const widget = item as WidgetConfig;
                const result = widgetResultMap[widget.id];
                  const hasData = Boolean(result?.hasData && (result?.value !== null && result?.value !== undefined));
                const displayValue = formatMetricValue(result?.value, result?.formattedValue as string | undefined);
                const Icon = widget.icon === "money" ? DollarSign : widget.icon === "analytics" ? BarChart2 : pickMetricIcon(widget.title || "");
                  const deletable = widget.source !== "hidden";
                return (
                  <MetricCard
                    key={widget.id}
                    icon={Icon}
                    title={widget.title}
                    value={displayValue as any}
                    description={hasData ? widget.description || "Data available" : "No data yet"}
                    deletable={deletable}
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
              <h4 className="overviewSectionTitle">Detailed insights</h4>
            </div>
            <div className="overviewSectionGrid overviewInsightsGrid">
              {(chartWidgets.length ? chartWidgets : chartConfigs).map((c, idx) => {
                const isWidget = (c as WidgetConfig).type !== undefined;
                const chartIcon = isWidget ? BarChart2 : c.type === "timeSeries" ? LineChart : PieChart;
                const ChartIcon = chartIcon;
                const result = isWidget ? widgetResultMap[(c as WidgetConfig).id] : null;
                const hasData = result?.hasData;
                return (
                  <div key={(c as any).id || idx} className="mdChartCard">
                    <div className="mdChartIcon">
                      {ChartIcon ? <ChartIcon className="w-6 h-6 text-indigo-600" /> : <PieChart className="w-6 h-6 text-indigo-600" />}
                    </div>
                    <div>
                      <p className="mdChartTitle">{(c as any).title || "Chart"}</p>
                      {isWidget ? renderChart(c as WidgetConfig) : <p className="mdChartSubtitle">{c.description || "No data"}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
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
              <Input placeholder="Search records..." className="searchInput" />
            </div>
            <Button variant="outline" className="mdGhostBtn">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button className="primaryBtn" onClick={handleOpenAdd} disabled={!tableKey}>
              <Plus className="w-4 h-4 mr-2" />
              Add record
            </Button>
          </div>
        </div>

        <div className="recordTableWrap simple">
          <div className="recordTable">
            <div className="recordHeaderRow" style={{ gridTemplateColumns: `repeat(${recordColumnCount}, minmax(140px, 1fr))` }}>
              {recordColumns.map((col) => (
                <div key={col.key} className="recordCell header">
                  {col.label}
                </div>
              ))}
              <div className="recordCell header">Actions</div>
            </div>
            {tableDisplayRecords.length ? (
              tableDisplayRecords.map((record, idx) => {
                const meta = (record as any).__meta;
                return (
              <div
                key={(meta as any)?.id || (record as any)?.id || (meta as any)?._id || idx}
                className="recordRow"
                style={{ gridTemplateColumns: `repeat(${recordColumnCount}, minmax(140px, 1fr))` }}
              >
                    {recordColumns.map((col) => (
                      <div key={col.key} className="recordCell">
                        {renderRecordValue((record as any)?.[col.key])}
                      </div>
                    ))}
                    <div className="recordCell recordActions">
                      <button className="recordIconBtn view" title="View record" onClick={() => handleView(record)}>
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="recordIconBtn edit" title="Edit" onClick={() => handleEdit(record)}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button className="recordIconBtn danger" title="Delete" onClick={() => handleDelete(record)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="tableEmpty padded">No data yet. Add your first record to populate this table.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const sidebarItems = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: BarChart3 },
      ...tableOptions.map((table) => ({
        id: table.id,
        label: table.title,
        icon: TableIcon,
        count: table.count,
      })),
    ],
    [tableOptions],
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
          </div>
          <div className="mdSidebarSearch">
            <Search className="w-4 h-4 text-slate-400" />
            <input placeholder="Search..." className="mdSidebarSearchInput" />
          </div>
          <nav className="mdSidebarNav">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                className={`mdNavItem ${activeSection === item.id ? "active" : ""}`}
                onClick={() => {
                  setActiveSection(item.id);
                  if (item.id !== "overview") setActiveTableId(item.id);
                }}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {typeof item.count === "number" && <span className="mdNavBadge">{item.count}</span>}
              </button>
            ))}
          </nav>
          <div className="mdSidebarFooter">
            <Button
              variant="outline"
              className="mdFooterBtn"
              onClick={() => navigate("/managedash")}
            >
              <ArrowLeft className="w-4 h-4" /> Back to dashboards
            </Button>
          </div>
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

      <AddRecordModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        tableName={activeTable?.name || "table"}
        fields={normalizedActiveFields}
        values={formValues}
        errors={formErrors}
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
        }}
        record={selectedRecord}
        fields={normalizedActiveFields}
        entityName={activeTable?.name || activeTableKey || "Entity"}
      />

      <AddRecordModal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedRecord(null);
        }}
        tableName={activeTable?.name || "table"}
        fields={normalizedActiveFields}
        values={editFormValues}
        errors={formErrors}
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

      <AddWidgetModal
        open={isAddWidgetOpen}
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
    </div>
  );
}
