import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import {
  Save,
  ArrowLeft,
  LayoutDashboard,
  CheckCircle2,
  Download,
  Upload,
  Plus,
  Search,
  Edit2,
  Trash2,
  Database,
  ListChecks,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  PlusSquare,
} from "lucide-react";
import { dashboardApi, type Dashboard, type DashboardField, type DashboardTable } from "../services/dashboards";

type ChartPoint = { label: string; value: number };
type SampleRecord = { id: string; values: Record<string, string>; tableId?: string };
type TimeRange = "7d" | "30d" | "12m";
const timeRangeOptions: TimeRange[] = ["7d", "30d", "12m"];

const SAMPLE_RECORD_COUNT = 10;
const chartColors = ["#6366F1", "#A855F7", "#14B8A6", "#F97316"];
const timeRangeLabels: Record<TimeRange, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "12m": "Last 12 months" };

const DASHBOARD_SESSION_KEY = "socialhub:dashboards_session";
const getSessionId = () => {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(DASHBOARD_SESSION_KEY);
  if (existing) return existing;
  const generated = (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, "");
  localStorage.setItem(DASHBOARD_SESSION_KEY, generated);
  return generated;
};

const getTimelineLabels = (range: TimeRange) => {
  if (range === "7d") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (range === "30d") return ["Week 1", "Week 2", "Week 3", "Week 4"];
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
};

const buildSampleValue = (field: DashboardField, index: number) => {
  if (field.sampleData) return field.sampleData.replace(/\{\{\s*index\s*\}\}/gi, String(index + 1));
  const fallback = `${field.fieldName || "Field"} ${index + 1}`;
  const type = field.fieldType?.toLowerCase?.() || "";
  if (type.includes("date")) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toLocaleDateString();
  }
  if (type.includes("currency") || type.includes("number")) {
    return Intl.NumberFormat("en-US", { style: type.includes("currency") ? "currency" : "decimal", currency: "USD" }).format(1000 + index * 42);
  }
  if (type.includes("email")) {
    const slug = field.fieldName?.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
    return `${slug}${index + 1}@example.com`;
  }
  if (type.includes("boolean")) return index % 2 === 0 ? "Yes" : "No";
  return fallback;
};

const generateSampleRecords = (fields: DashboardField[], prefix?: string): SampleRecord[] =>
  Array.from({ length: fields.length ? SAMPLE_RECORD_COUNT : 0 }).map((_, idx) => ({
    id: `${prefix || "sample"}-${idx + 1}`,
    tableId: prefix,
    values: Object.fromEntries(fields.map((field) => [field.id, buildSampleValue(field, idx)])),
  }));

export default function ManageDashDetail() {
  const { dashId } = useParams();
  const navigate = useNavigate();
  const [sessionId] = useState(getSessionId);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  useEffect(() => {
    if (!dashId || !sessionId) return;
    let active = true;
    setLoading(true);
    dashboardApi
      .list(sessionId)
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
  }, [dashId, sessionId]);

  if (!dashId)
    return (
      <div className="min-h-screen overflow-y-auto bg-gray-50 p-6">
        <Button variant="ghost" onClick={() => navigate("/managedash")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to dashboards
        </Button>
        <div className="text-gray-500">Missing dashboard id.</div>
      </div>
    );

  if (loading)
    return (
      <div className="min-h-screen overflow-y-auto bg-gray-50 p-6">
        <Button variant="ghost" onClick={() => navigate("/managedash")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to dashboards
        </Button>
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );

  if (!dashboard)
    return (
      <div className="min-h-screen overflow-y-auto bg-gray-50 p-6">
        <Button variant="ghost" onClick={() => navigate("/managedash")} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to dashboards
        </Button>
        <div className="text-gray-500">{error || "Dashboard not found."}</div>
      </div>
    );

  const safeDashboard = dashboard ?? { name: "", description: "", fields: [], widgets: [], tables: [] };
  const fallbackTable: DashboardTable = {
    id: "ai-preview",
    name: safeDashboard.name || "Primary dataset",
    description: safeDashboard.description,
    purpose: "AI-recommended data collection",
    actions: ["Add record", "Import data", "Export CSV"],
    kpis: [{ label: "Preview rows", value: `${SAMPLE_RECORD_COUNT}`, trend: "+4 vs sample" }],
    recommendedWidgets: ["Operational KPI", "Record freshness"],
    fields: safeDashboard.fields,
  };
  const tables = safeDashboard.tables && safeDashboard.tables.length > 0 ? safeDashboard.tables : [];
  const mergedTables = tables.length ? tables : fallbackTable.fields.length ? [fallbackTable] : [];

  const totalTables = mergedTables.length;
  const totalFields = mergedTables.reduce((sum, table) => sum + table.fields.length, 0);
  const totalActions = mergedTables.reduce((sum, table) => sum + (table.actions?.length || 0), 0);
  const summaryCards = [
    { label: "Tables", value: totalTables, icon: LayoutDashboard },
    { label: "Fields", value: totalFields, icon: Database },
    { label: "Actions", value: totalActions, icon: ListChecks },
    { label: "Widgets", value: safeDashboard.widgets?.length || 0, icon: Activity },
  ];

  const tableKpis = mergedTables.flatMap((table) => (table.kpis || []).map((kpi) => ({ ...kpi, source: table.name })));
  const fallbackKpis = [
    { label: "Tables", value: `${totalTables}`, trend: "+2 vs last view", source: "Structure" },
    { label: "Avg. fields", value: `${totalTables ? Math.round(totalFields / totalTables) : 0}`, trend: "+1 MoM", source: "Schema" },
  ];
  const overviewKpis = [...tableKpis, ...fallbackKpis].slice(0, 4);

  const timelineLabels = getTimelineLabels(timeRange);
  const base = Math.max(40, totalFields * 10 + totalTables * 24);
  const multiplier = timeRange === "7d" ? 1 : timeRange === "30d" ? 1.25 : 1.8;
  const lineData: ChartPoint[] = timelineLabels.map((label, index) => ({
    label,
    value: Math.round((base * multiplier * (index + 1)) / timelineLabels.length),
  }));

  const donutData: ChartPoint[] = (() => {
    const slice = mergedTables.slice(0, 4);
    if (!slice.length) return [{ label: "Portfolio", value: 1 }];
    return slice.map((table, index) => ({
      label: table.name,
      value: Math.max(1, table.fields.length * 14 + (table.kpis?.length || 0) * 7 + index * 5),
    }));
  })();

  const barData: ChartPoint[] = ["New", "In progress", "At risk", "Completed"].map((label, index) => ({
    label,
    value: Math.max(12, (index + 1) * 20 + totalFields * 0.7 + totalTables * 2),
  }));

  const actionTables = mergedTables.slice(0, 3);
  const hasTables = mergedTables.length > 0;

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

  return (
    <div className="min-h-screen overflow-y-auto bg-gray-50">
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/managedash")} className="gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to dashboards
        </Button>
        <div className="p-6 border-b border-gray-200 bg-white rounded-xl">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Created
                  </div>
                  <h1 className="text-2xl text-gray-900 mt-1">{safeDashboard.name || "AI dashboard"}</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {safeDashboard.description || `Your AI-generated dashboard with ${totalTables} tables and ${totalFields} fields.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary/10 text-primary">{totalTables} tables</Badge>
                <Button variant="outline" onClick={handleCopyCode} disabled={!safeDashboard.componentCode}>
                  {copied ? "Code copied" : "Copy layout code"}
                </Button>
                <Button className="gap-2" disabled>
                  <Save className="w-4 h-4" /> Saved
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Clean layout preview inspired by the reference UI. Organize records instantly, then persist the dashboard to MongoDB when you are ready.
            </p>
          </div>
        </div>

        <div className="min-h-full py-6 space-y-6">
          <Card className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search dashboards, tables, data..." className="pl-10" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Export layout
              </Button>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" /> Import data
              </Button>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add record
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-400" />
                  {label}
                </div>
                <div className="text-2xl font-semibold text-gray-900">{value}</div>
              </Card>
            ))}
          </div>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Insights</h3>
                <p className="text-sm text-gray-500">Charts that highlight key metrics across tables</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {timeRangeOptions.map((range) => (
                  <Button key={range} size="sm" variant={timeRange === range ? "default" : "outline"} onClick={() => setTimeRange(range)}>
                    {timeRangeLabels[range]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1">
                      <LineChart className="w-4 h-4" />
                      Revenue trend
                    </p>
                    <p className="text-lg font-semibold text-gray-900">Revenue flow</p>
                  </div>
                  <span className="text-xs text-green-600">+8% YoY</span>
                </div>
                <LineSparkline data={lineData} />
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1">
                      <PieChart className="w-4 h-4" />
                      Revenue mix
                    </p>
                    <p className="text-lg font-semibold text-gray-900">Revenue mix</p>
                  </div>
                  <span className="text-xs text-gray-500">{donutData.length} segments</span>
                </div>
                <DonutChart data={donutData} />
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1">
                      <BarChart3 className="w-4 h-4" />
                      Pipeline health
                    </p>
                    <p className="text-lg font-semibold text-gray-900">Deals by status</p>
                  </div>
                </div>
                <ColumnChart data={barData} />
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Action widgets</h3>
                <p className="text-sm text-gray-500">Quick operations tied to each core table</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {actionTables.map((table) => (
                <Card key={table.id} className="p-5 border border-dashed border-gray-200 bg-white/70 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{table.name}</p>
                      <p className="text-xs text-gray-500">{table.description || table.purpose}</p>
                    </div>
                    <PlusSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-2">
                    {(table.actions || []).slice(0, 3).map((action) => (
                      <Button key={action} variant="outline" size="sm" className="w-full justify-start">
                        {action}
                      </Button>
                    ))}
                  </div>
                  {table.recommendedWidgets?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {table.recommendedWidgets.map((widget) => (
                        <Badge key={`${table.id}-${widget}`} className="bg-indigo-50 text-indigo-700 text-xs">
                          {widget}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Data tables</h3>
                <p className="text-sm text-gray-500">Search, filter, and edit every dataset</p>
              </div>
            </div>
            {hasTables ? (
              <div className="space-y-5">
                {mergedTables.map((table) => (
                  <TableWidget key={table.id} table={table} />
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center text-gray-500 border border-dashed border-gray-200">No tables were generated for this dashboard.</Card>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Field definitions</h3>
                <p className="text-sm text-gray-500">Review every column powering the tables above</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {mergedTables.map((table) => (
                <Card key={`${table.id}-fields`} className="p-5 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{table.name}</p>
                      <p className="text-xs text-gray-500">{table.description || table.purpose}</p>
                    </div>
                    <Badge className="bg-primary/10 text-primary">{table.fields.length} fields</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {table.fields.map((field) => (
                      <div key={field.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{field.fieldName}</p>
                          <span className="text-[11px] uppercase tracking-wide text-indigo-500">{field.fieldType}</span>
                        </div>
                        {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
                        {field.sampleData && <p className="text-[11px] text-slate-400 mt-1">Example: {field.sampleData}</p>}
                      </div>
                    ))}
                  </div>
                  {table.recommendedWidgets?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {table.recommendedWidgets.map((widget) => (
                        <Badge key={`${table.id}-${widget}`} className="bg-slate-100 text-slate-700 text-xs">
                          {widget}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  );
}

function LineSparkline({ data }: { data: ChartPoint[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((item) => item.value), 1);
  const step = data.length > 1 ? data.length - 1 : 1;
  const points = data
    .map((point, index) => {
      const x = (index / step) * 100;
      const y = 100 - (point.value / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" className="w-full h-24">
      <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
      {data.map((point, index) => {
        const x = (index / step) * 100;
        const y = 100 - (point.value / max) * 100;
        return <circle key={point.label} cx={x} cy={y} r={2.5} fill="#4f46e5" />;
      })}
    </svg>
  );
}

function DonutChart({ data }: { data: ChartPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  let start = 0;
  const segments = data
    .map((item, index) => {
      const portion = item.value / total;
      const end = start + portion;
      const color = chartColors[index % chartColors.length];
      const segment = `${color} ${start * 100}% ${end * 100}%`;
      start = end;
      return segment;
    })
    .join(", ");
  const gradient = segments.length ? `conic-gradient(${segments})` : "#e5e7eb";
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 rounded-full" style={{ backgroundImage: gradient }}>
        <div className="absolute inset-3 bg-white rounded-full" />
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            <span className="text-sm text-gray-900">{item.label}</span>
            <span className="text-xs text-gray-500">{Math.round((item.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="flex items-end gap-3 h-32">
      {data.map((point) => (
        <div key={point.label} className="flex flex-col items-center gap-2">
          <div className="flex h-full w-6 items-end">
            <span className="block w-full rounded-full bg-gradient-to-t from-slate-900 to-slate-500" style={{ height: `${(point.value / max) * 100}%` }} />
          </div>
          <span className="text-[11px] text-gray-500">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

interface TableWidgetProps {
  table: DashboardTable;
}

function TableWidget({ table }: TableWidgetProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const sampleRecords = generateSampleRecords(table.fields as DashboardField[], table.id);
  const filteredRecords = !searchTerm.trim()
    ? sampleRecords
    : sampleRecords.filter((record) => Object.values(record.values).some((value) => value.toLowerCase().includes(searchTerm.toLowerCase())));
  const filteredIds = filteredRecords.map((record) => record.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggleRecordSelection = (recordId: string) => {
    setSelectedIds((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) return prev.filter((id) => !filteredIds.includes(id));
      const merged = new Set([...prev, ...filteredIds]);
      return Array.from(merged);
    });
  };

  return (
    <Card className="border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{table.name}</p>
          <p className="text-xs text-gray-500">{table.description || table.purpose}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {(table.actions || []).slice(0, 3).map((action) => (
            <Badge key={action} className="bg-gray-100 text-gray-700">
              {action}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search records..." value={searchTerm} onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)} className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            Export
          </Button>
          <Button variant="outline" size="sm">
            Import
          </Button>
          <Button size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            Add record
          </Button>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide text-xs">
            <tr>
              <th className="px-4 py-3 text-left w-12">
                <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
              </th>
              <th className="px-4 py-3 text-left w-32">Actions</th>
              {table.fields.map((field) => (
                <th key={field.id} className="px-4 py-3 text-left whitespace-nowrap border-l border-gray-100">
                  {field.fieldName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRecords.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Checkbox checked={selectedIds.includes(record.id)} onCheckedChange={() => toggleRecordSelection(record.id)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
                {table.fields.map((field) => (
                  <td key={`${record.id}-${field.id}`} className="px-4 py-3 text-gray-700 border-l border-gray-50">
                    {record.values[field.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
        <span>
          Showing {filteredRecords.length} of {sampleRecords.length} records
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-gray-500" disabled>
            Previous
          </Button>
          <Button variant="default" size="sm" className="px-3">
            1
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-500" disabled>
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
