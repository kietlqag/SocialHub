import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ArrowLeft, BarChart3, Table, Search, Filter, Plus, BarChart2, PieChart, LineChart, Clock, DollarSign, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dashboardApi, type Dashboard, type DashboardTable } from "../services/dashboards";
import { buildDomainModel, generateInsightChartsFromDomain, type InsightChartConfig } from "../dashboard/insightGenerator";
import { useDynamicDashboardMetrics } from "../dashboard/useDynamicDashboardMetrics";
import { Input } from "../components/ui/input";
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

type ChartPoint = { label: string; value: number };

type MetricCardProps = {
  icon: LucideIcon;
  title: string;
  value?: string | number;
  description?: string;
};

const MetricCard = ({ icon: Icon, title, value = "No data", description = "No data" }: MetricCardProps) => (
  <div className="kpiCard">
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

export default function ManageDashDetail() {
  const { dashId } = useParams();
  const navigate = useNavigate();
  const [sessionId] = useState(getSessionId);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [draftRecord, setDraftRecord] = useState<Record<string, any>>({});
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordsByTable, setRecordsByTable] = useState<Record<string, any[]>>({});

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

  // Memoize the fallback dashboard object to avoid a new reference every render (which was retriggering effects).
  const safeDashboard = useMemo(
    () => dashboard ?? { name: "", description: "", fields: [], widgets: [], tables: [] },
    [dashboard],
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
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

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

  // Fetch records for the active table
  useEffect(() => {
    const activeOption = tableOptions.find((t) => t.id === activeTableId) || tableOptions[0];
    const activeTable = activeOption?.ref;
    if (!dashId || !activeTable) return;
    const tableKey = activeTable.key || activeTable.id || "";
    let cancelled = false;
    dashboardApi
      .listRecords({ dashboardId: dashId, tableKey, sessionId })
      .then((res) => {
        if (cancelled) return;
        setRecordsByTable((prev) => ({ ...prev, [tableKey]: res.records || [] }));
      })
      .catch(() => {
        // swallow; UI will fall back to sampleRows
      });
    return () => {
      cancelled = true;
    };
  }, [dashId, activeTableId, tableOptions, sessionId]);

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
    return (
      <div className="contentGrid">
        <div className="tableHeader">
          <div>
            <h3 className="mainTitle">Overview</h3>
            <p className="mdMainSubtitle">Key metrics and analytics</p>
          </div>
          <div className="tableActions">
            <Button variant="ghost" className="mdGhostBtn">
              <Clock className="w-4 h-4 mr-2" />
              Last 30 days
            </Button>
          </div>
        </div>

        <div className="kpiGrid">
          <MetricCard icon={DollarSign} title="Revenue" />
          <MetricCard icon={Users} title="Active users" />
          <MetricCard icon={LineChart} title="Conversion" />
          <MetricCard icon={PieChart} title="Pending reports" />
        </div>

        <div className="chartRow">
          {chartConfigs.map((c) => (
            <div key={c.id} className="mdChartCard">
              <div className="mdChartIcon">
                {c.type === "timeSeries" ? <LineChart className="w-6 h-6 text-indigo-600" /> : <PieChart className="w-6 h-6 text-indigo-600" />}
              </div>
              <div>
                <p className="mdChartTitle">{c.title}</p>
                <p className="mdChartSubtitle">No data yet</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeOption = tableOptions.find((t) => t.id === activeSection) || tableOptions[0];
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

  const activeTable = activeOption.ref;
  const visibleFields = getVisibleFields(activeTable?.fields || []);

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
          <Button className="primaryBtn">
            <Plus className="w-4 h-4 mr-2" />
            Add record
          </Button>
        </div>
      </div>

      <div className="tableList">
        {visibleFields.slice(0, 6).map((field) => (
          <div key={field.key || field.id || field.name} className="tableFieldCard">
            <p className="infoLabel">{displayFieldName(field)}</p>
            <p className="infoType">{field.fieldType || (field as any).type || "Text"}</p>
          </div>
        ))}
      </div>

      <div className="tableEmpty">
        No data yet. Add your first record to populate this table.
      </div>
    </div>
  );
};

  const sidebarItems = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: BarChart3, count: overviewKpis.length },
      ...tableOptions.map((table) => ({
        id: table.id,
        label: table.title,
        icon: Table,
        count: table.count,
      })),
    ],
    [overviewKpis.length, tableOptions],
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
            <div className="mdMainActions">
              <Button variant="ghost" className="mdGhostBtn">
                <Search className="w-4 h-4 mr-2" />
                Global search
              </Button>
              <Button variant="ghost" className="mdGhostBtn">
                <BarChart2 className="w-4 h-4 mr-2" />
                Last 30 days
              </Button>
              <Button variant="outline" className="mdGhostBtn" onClick={handleCopyCode}>
                Copy layout
              </Button>
            </div>
          </div>

          <div className="mdContentArea">{renderContent()}</div>
          {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        </main>
      </div>
    </div>
  );
}

// (No extra helper components needed below)
