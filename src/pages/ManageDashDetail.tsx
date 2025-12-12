import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ArrowLeft, BarChart3, Table } from "lucide-react";
import { dashboardApi, type Dashboard, type DashboardTable } from "../services/dashboards";
import { buildDomainModel, generateInsightChartsFromDomain, type InsightChartConfig } from "../dashboard/insightGenerator";
import { useDynamicDashboardMetrics } from "../dashboard/useDynamicDashboardMetrics";
import { Sidebar } from "../dashboard/Sidebar";
import { ContentWrapper } from "../dashboard/ContentWrapper";
import { OverviewContent } from "../dashboard/OverviewContent";
import { InsightsContent } from "../dashboard/InsightsContent";
import { Input } from "../components/ui/input";

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
  const [activeSection, setActiveSection] = useState<"overview" | "insights" | "tables">("overview");

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
  const mergedTables = safeDashboard.tables && safeDashboard.tables.length > 0 ? safeDashboard.tables : [];
  const hasData = mergedTables.some((t) => Array.isArray((t as any).sampleRows) && (t as any).sampleRows.length > 0);

  const totalTables = mergedTables.length;
  const totalFields = mergedTables.reduce((sum, table) => sum + (table.fields?.length || 0), 0);
  const totalInsights = chartConfigs.length;
  const tableOptions = useMemo(
    () =>
      mergedTables.map((table, idx) => ({
        id: table.key || table.id || `table-${idx}`,
        title: table.name || `Table ${idx + 1}`,
        description: table.description || table.purpose || "",
        count: Array.isArray((table as any).sampleRows) ? (table as any).sampleRows.length : 0,
        ref: table,
      })),
    [mergedTables],
  );
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [tablesMenuOpen, setTablesMenuOpen] = useState(false);

  useEffect(() => {
    if (!tableOptions.length) return;
    if (!activeTableId || !tableOptions.some((t) => t.id === activeTableId)) {
      setActiveTableId(tableOptions[0].id);
    }
  }, [tableOptions, activeTableId]);
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

  const displayFieldName = (field: any) => field.fieldName || field.name || field.key || field.id || "Field";
  const getVisibleFields = (fields: any[] = []) =>
    fields.filter((f) => {
      const key = (f.key || f.fieldName || f.name || "").toString().toLowerCase();
      return key && key !== "_id" && key !== "created_at" && key !== "updated_at";
    });

  useEffect(() => {
    setTableConfigs(
      mergedTables.map((table, idx) => {
        const visibleFields = getVisibleFields(table.fields || []);
        return {
          id: table.id || table.key || `table-${idx}`,
          title: table.name,
          description: table.description || table.purpose,
          actions: (table.actions || []).slice(0, 3),
          columns: visibleFields.slice(0, 4).map((f) => displayFieldName(f)),
          sourceTable: table.id || table.key || `table-${idx}`,
        };
      }),
    );
  }, [mergedTables]);

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

const renderContent = () => {
  if (activeSection === "overview") {
    return <OverviewContent kpis={overviewKpis} range={timeRange} colors={chartColors} />;
  }
  if (activeSection === "insights") {
    return (
      <InsightsContent
        charts={chartConfigs}
        renderChart={renderInsightChart}
        buildChartData={buildChartData}
        range={timeRange}
        rangeLabel={timeRangeLabels[timeRange]}
      />
    );
  }
  if (activeSection === "tables") {
    if (!tableOptions.length) {
      return <Card className="p-8 text-center text-gray-500 border border-dashed border-gray-200">No tables available</Card>;
    }
    const activeOption = tableOptions.find((t) => t.id === activeTableId) || tableOptions[0];
    const activeTable = activeOption.ref;
    const visibleFields = getVisibleFields(activeTable?.fields || []);
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{activeOption.title}</h2>
            <p className="text-sm text-gray-600">{activeOption.description || "No description"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(activeTable?.actions && activeTable.actions.length ? activeTable.actions : ["Add record", "Segment", "Update"])
            .slice(0, 3)
            .map((action) => (
              <Button key={action} variant="outline">
                {action}
              </Button>
            ))}
        </div>
        <div className="relative max-w-md">
          <Input placeholder="Search preview..." className="pl-10" />
        </div>
        <Card className="p-10 text-center text-gray-500 border border-dashed border-gray-200">
          {safeDashboard.ui?.emptyStateText || "No sample data"}
        </Card>
        {visibleFields.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleFields.slice(0, 4).map((field) => (
              <Card key={field.key || field.id} className="p-4">
                <div className="text-sm font-semibold text-gray-900">{displayFieldName(field)}</div>
                <div className="text-xs text-gray-500 capitalize">{field.fieldType || (field as any).type || "Text"}</div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  return <OverviewContent kpis={overviewKpis} range={timeRange} colors={chartColors} />;
};

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: BarChart3, count: overviewKpis.length },
    { id: "insights", label: "Insights", icon: BarChart3, count: totalInsights },
    { id: "tables", label: "Tables", icon: Table, count: tableOptions.length },
  ];

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
    <div className="min-h-screen flex bg-[#F8F9FB]">
      <Sidebar
        items={sidebarItems}
        activeId={activeSection}
        onSelect={setActiveSection}
        header={
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3 px-1">
              <div className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-800">
                {safeDashboard.name?.slice(0, 2).toUpperCase() || "DB"}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{safeDashboard.name || "AI dashboard"}</div>
                <div className="text-xs text-gray-500">{safeDashboard.type || "V1"}</div>
              </div>
            </div>
          </div>
        }
        footer={
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => navigate("/managedash")}
          >
            <ArrowLeft className="w-4 h-4" /> Back to dashboards
          </Button>
        }
        tableDropdown={{
          label: "Tables",
          icon: Table,
          count: tableOptions.length,
          open: tablesMenuOpen,
          onToggle: () => setTablesMenuOpen((v) => !v),
          content: (
            <div className="py-2">
              {tableOptions.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => {
                    setActiveTableId(table.id);
                    setActiveSection("tables");
                    setTablesMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#F5F5F5] flex items-center gap-2"
                >
                  <span className="flex-1 font-semibold text-sm text-gray-900">{table.title}</span>
                  <span className="text-xs text-gray-600">{table.count}</span>
                </button>
              ))}
            </div>
          ),
        }}
      />

      <div className="flex-1 flex flex-col">
        <ContentWrapper
          title={safeDashboard.name || "AI dashboard"}
          subtitle={safeDashboard.description || `Your AI-generated dashboard with ${totalTables} tables and ${totalFields} fields.`}
          onCopyLayout={handleCopyCode}
          onExport={() => {}}
          onImport={() => {}}
          onAddRecord={() => {}}
          actionsDisabled={!dashboard}
          showActions={false}
          showSearch={false}
        >
          {renderContent()}
        </ContentWrapper>
        {error && <div className="px-6 pb-6 text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}

function buildChartData(config: InsightChartConfig, range: TimeRange): ChartPoint[] {
  if (config.description === "No data" || config.range === "Empty") return [];
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
  const hasData = data.length > 0;
  if (config.type === "timeSeries")
    return (
      <div className="w-full h-full flex items-center">
        {hasData ? (
          <LineSparkline data={data} />
        ) : (
          <div className="w-full h-full border border-dashed border-gray-200 rounded-lg p-4 flex items-center justify-center text-xs text-gray-500">
            Empty time series chart
          </div>
        )}
      </div>
    );
  if (config.type === "breakdown")
    return (
      <div className="w-full h-full flex items-center">
        {hasData ? (
          <DonutChart data={data} />
        ) : (
          <div className="w-full h-full border border-dashed border-gray-200 rounded-lg p-4 flex items-center justify-center text-xs text-gray-500">
            Empty breakdown chart
          </div>
        )}
      </div>
    );
  return (
    <div className="w-full h-full flex items-center">
      {hasData ? (
        <ColumnChart data={data} />
      ) : (
        <div className="w-full h-full border border-dashed border-gray-200 rounded-lg p-4 flex items-center justify-center text-xs text-gray-500">
          Empty column chart
        </div>
      )}
    </div>
  );
}

function LineSparkline({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg">
        No data
      </div>
    );
  }
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
  if (!data.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg">
        No data
      </div>
    );
  }
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
  if (!data.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg">
        No data
      </div>
    );
  }
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
