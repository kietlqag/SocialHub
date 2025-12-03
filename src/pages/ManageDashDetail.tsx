import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Save, ArrowLeft, LayoutDashboard, CheckCircle2, Download, Upload, Plus, Search } from "lucide-react";
import { dashboardApi, type Dashboard, type DashboardTable } from "../services/dashboards";
import { DashboardOverview } from "../dashboard/DashboardOverview";
import { TablePreviewCard } from "./components/TablePreviewCard";
import { buildDomainModel, generateInsightChartsFromDomain, type InsightChartConfig } from "../dashboard/insightGenerator";
import { useDynamicDashboardMetrics } from "../dashboard/useDynamicDashboardMetrics";
import { useMemo } from "react";

type ChartPoint = { label: string; value: number };
type TimeRange = "7d" | "30d" | "12m";
const timeRangeOptions: TimeRange[] = ["7d", "30d", "12m"];

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

export default function ManageDashDetail() {
  const { dashId } = useParams();
  const navigate = useNavigate();
  const [sessionId] = useState(getSessionId);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [overviewKpis, setOverviewKpis] = useState<
    { id: string; title: string; description?: string; value: number | string; icon?: React.ReactNode }[]
  >([]);
  const [chartConfigs, setChartConfigs] = useState<InsightChartConfig[]>([]);
  const [tableConfigs, setTableConfigs] = useState<
    {
      id: string;
      title: string;
      description?: string;
      actions: string[];
      columns: string[];
      sourceTable: string;
    }[]
  >([]);

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

  const safeDashboard = dashboard ?? { name: "", description: "", fields: [], widgets: [], tables: [] };
  const tables = safeDashboard.tables && safeDashboard.tables.length > 0 ? safeDashboard.tables : [];
  const mergedTables = tables;

  const totalTables = mergedTables.length;
  const totalFields = mergedTables.reduce((sum, table) => sum + table.fields.length, 0);

  const hasTables = mergedTables.length > 0;
  const domainModel = useMemo(() => buildDomainModel(safeDashboard, mergedTables as DashboardTable[]), [safeDashboard, mergedTables]);
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
  const { metrics } = useDynamicDashboardMetrics({ projectType, selectedTables, description: safeDashboard.description });
  useEffect(() => {
    // initialize KPI configs from AI metrics
    if (metrics && metrics.length) {
      setOverviewKpis(
        metrics.map((m) => ({
          id: m.key,
          title: m.label,
          description: m.description,
          value: m.value,
          icon: m.icon,
        }))
      );
    }
  }, [metrics]);

  useEffect(() => {
    // initialize chart configs
    setChartConfigs(defaultInsights);
  }, [defaultInsights]);

  useEffect(() => {
    // initialize table preview configs from current tables
    setTableConfigs(
      mergedTables.map((table) => ({
        id: table.id,
        title: table.name,
        description: table.description || table.purpose,
        actions: (table.actions || []).slice(0, 3),
        columns: table.fields.slice(0, 4).map((f) => f.fieldName || f.id),
        sourceTable: table.id,
      }))
    );
  }, [mergedTables]);

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
            <div className="w-full max-w-2xl relative mx-auto sm:mx-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search dashboards, tables, data..." className="pl-10" />
            </div>
            <div className="flex flex-wrap gap-2 items-center sm:justify-end">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Overview", value: overviewKpis.length },
              { label: "Insights", value: chartConfigs.length },
              { label: "Tables", value: tableConfigs.length },
            ].map((item) => (
              <Card key={item.label} className="p-4 rounded-2xl flex flex-col gap-1">
                <span className="text-2xl font-semibold text-gray-900">{item.value}</span>
                <span className="text-sm text-gray-600">{item.label}</span>
              </Card>
            ))}
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Overview</h3>
                <p className="text-sm text-gray-500">Business KPIs generated from your description</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOverviewKpis((prev) => [...prev, { id: `kpi-${prev.length + 1}`, title: "New KPI", value: 0 }])}>
                + Add KPI
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {overviewKpis.map((kpi) => (
                <Card key={kpi.id} className="p-4 flex flex-col gap-2 rounded-2xl">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {kpi.icon}
                    <span className="truncate">{kpi.title}</span>
                  </div>
                  {kpi.description && <p className="text-xs text-gray-500 line-clamp-2">{kpi.description}</p>}
                  <div className="text-2xl font-semibold text-gray-900">{kpi.value}</div>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Insights</h3>
                <p className="text-sm text-gray-500">Charts that highlight key metrics across tables</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setChartConfigs((prev) => [
                      ...prev,
                      { id: `chart-${prev.length + 1}`, title: "New chart", type: "breakdown", source: "custom", timeRangeMode: timeRange },
                    ])
                  }
                >
                  + Add chart
                </Button>
                {timeRangeOptions.map((range) => (
                  <Button key={range} size="sm" variant={timeRange === range ? "default" : "outline"} onClick={() => setTimeRange(range)}>
                    {timeRangeLabels[range]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chartConfigs.map((chart) => {
                const data = buildChartData(chart, timeRange);
                return (
                  <Card
                    key={chart.id}
                    className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 h-full min-h-[320px] flex flex-col gap-3 min-w-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">{chart.title}</p>
                        {chart.description && <p className="text-xs text-gray-500">{chart.description}</p>}
                      </div>
                      <span className="text-[11px] text-gray-400">{chart.timeRangeMode || timeRangeLabels[timeRange]}</span>
                    </div>
                    <div className="flex-1 w-full h-[280px] max-h-[300px] flex items-center justify-center min-w-0">
                      {renderInsightChart(chart, data)}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Data tables</h3>
                <p className="text-sm text-gray-500">Quick preview of each dataset. Open full table to edit.</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setTableConfigs((prev) => [
                    ...prev,
                    {
                      id: `table-${prev.length + 1}`,
                      title: "New preview",
                      description: "Custom preview",
                      actions: [],
                      columns: [],
                      sourceTable: mergedTables[0]?.id || "",
                    },
                  ])
                }
                disabled={!mergedTables.length}
              >
                + Add table
              </Button>
            </div>
            {hasTables ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tableConfigs.map((cfg) => {
                  const table = mergedTables.find((t) => t.id === cfg.sourceTable) || mergedTables[0];
                  if (!table) return null;
                  return (
                    <TablePreviewCard
                      key={cfg.id}
                      table={table as DashboardTable}
                      dashboardId={dashId}
                      title={cfg.title}
                      description={cfg.description}
                      actionsOverride={cfg.actions}
                      previewColumns={cfg.columns}
                    />
                  );
                })}
              </div>
            ) : (
              <Card className="p-10 text-center text-gray-500 border border-dashed border-gray-200">No tables were generated for this dashboard.</Card>
            )}
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
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6366F1" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
      </linearGradient>
      <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points={`${points} 100,100 0,100`} fill="url(#lineGradient)" />
      {data.map((point, index) => {
        const x = (index / step) * 100;
        const y = 100 - (point.value / max) * 100;
        return <circle key={point.label} cx={x} cy={y} r={3} fill="#4f46e5" />;
      })}
    </svg>
  );
}

function DonutChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) return null;
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  let accumulated = 0;

  return (
    <div className="flex items-center gap-4 w-full justify-start">
      <svg viewBox="0 0 140 140" className="h-full w-32">
        {data.map((item, idx) => {
          const startAngle = (accumulated / total) * Math.PI * 2;
          const slice = (item.value / total) * Math.PI * 2;
          accumulated += item.value;
          const endAngle = startAngle + slice;
          const largeArc = slice > Math.PI ? 1 : 0;
          const radius = 60;
          const cx = 70;
          const cy = 70;
          const startX = cx + radius * Math.cos(startAngle);
          const startY = cy + radius * Math.sin(startAngle);
          const endX = cx + radius * Math.cos(endAngle);
          const endY = cy + radius * Math.sin(endAngle);
          const d = `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
          return <path key={item.label} d={d} fill={chartColors[idx % chartColors.length]} />;
        })}
        <circle cx="70" cy="70" r="36" fill="white" />
      </svg>
      <div className="space-y-1 text-xs text-gray-600">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
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
    <div className="flex items-end gap-3 h-full w-full max-w-full">
      {data.map((point, idx) => (
        <div key={point.label} className="flex flex-col items-center gap-1 flex-1 min-w-[40px]">
          <div className="flex h-full w-full items-end">
            <span
              className="block w-full rounded-md bg-gradient-to-t from-indigo-500 to-indigo-400"
              style={{ height: `${(point.value / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-500 text-center truncate w-full">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function buildChartData(config: InsightChartConfig, range: TimeRange): ChartPoint[] {
  if (config.type === "timeSeries") {
    const labels = getTimelineLabels(range);
    return labels.map((label, idx) => ({ label, value: Math.max(5, (idx + 1) * 10 + Math.floor(Math.random() * 20)) }));
  }

  const pickGroups = (): string[] => {
    const key = (config.groupByField || config.title).toLowerCase();
    if (key.includes("status") || key.includes("stage")) return ["New", "In progress", "Completed", "On hold"];
    if (key.includes("owner") || key.includes("team")) return ["Team A", "Team B", "Team C"];
    if (key.includes("category")) return ["Category A", "Category B", "Category C", "Category D"];
    if (key.includes("department")) return ["ER", "ICU", "Ward", "Lab"];
    return ["Segment A", "Segment B", "Segment C"];
  };

  if (config.type === "funnel") {
    const steps = ["Stage 1", "Stage 2", "Stage 3", "Stage 4"];
    let current = 100;
    return steps.map((step) => {
      current = Math.max(8, Math.round(current * (0.5 + Math.random() * 0.25)));
      return { label: step, value: current };
    });
  }

  const groups = pickGroups();
  return groups.map((g) => ({ label: g, value: Math.max(10, Math.round(Math.random() * 80 + 20)) }));
}

function renderInsightChart(config: InsightChartConfig, data: ChartPoint[]) {
  if (config.type === "timeSeries")
    return (
      <div className="w-full h-full flex items-center">
        <LineSparkline data={data} />
      </div>
    );
  if (config.type === "breakdown")
    return (
      <div className="w-full h-full flex items-center">
        <DonutChart data={data} />
      </div>
    );
  return (
    <div className="w-full h-full flex items-center">
      <ColumnChart data={data} />
    </div>
  );
}
