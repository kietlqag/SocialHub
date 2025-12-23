import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AIDashboardGenerator } from "../components/AIDashboardGenerator";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Header } from "../components/Header";
import DashboardCard, { type DashboardCardIconPreset } from "../components/dashboard/DashboardCard";
import { fetchMe, getCurrentSession, clearSession, type AuthUser } from "../services/auth";
import {
  LayoutDashboard,
  Search,
  Sparkles,
  Clock,
  Star,
  Loader2,
  ShoppingCart,
  BarChart3,
  GraduationCap,
  HeartPulse,
} from "lucide-react";
import { dashboardApi, type Dashboard, type DashboardField } from "../services/dashboards";
import "../styles/managedash.css";

const DASHBOARD_SESSION_KEY = "socialhub:dashboards_session";

const getSessionId = () => {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(DASHBOARD_SESSION_KEY);
  if (existing) return existing;
  const generated = (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, "");
  localStorage.setItem(DASHBOARD_SESSION_KEY, generated);
  return generated;
};

type DraftDashboard = {
  id?: string;
  name: string;
  description: string;
  fields: DashboardField[];
  widgets?: Dashboard["widgets"];
  tables?: Dashboard["tables"];
  componentCode?: string;
  relationships?: any[];
  type?: string;
  ui?: {
    defaultTableKey?: string;
    tableDropdownOrder?: string[];
    emptyStateText?: string;
  };
};

type DecoratedDashboard = Dashboard & {
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
};

type DashboardDomain = "healthcare" | "commerce" | "analytics" | "education" | "general";

type DomainVisual = DashboardCardIconPreset & {
  label: string;
};

const domainVisuals: Record<DashboardDomain, DomainVisual> = {
  healthcare: { Icon: HeartPulse, toneClass: "tone-healthcare", label: "Healthcare" },
  commerce: { Icon: ShoppingCart, toneClass: "tone-commerce", label: "Commerce" },
  analytics: { Icon: BarChart3, toneClass: "tone-analytics", label: "Analytics" },
  education: { Icon: GraduationCap, toneClass: "tone-education", label: "Education" },
  general: { Icon: LayoutDashboard, toneClass: "tone-general", label: "Dashboard" },
};

const detectDashboardDomain = (dashboard: Dashboard): DashboardDomain => {
  const normalized = `${dashboard.type || ""} ${dashboard.name || ""} ${dashboard.description || ""}`.toLowerCase();
  if (normalized.includes("health") || normalized.includes("clinic") || normalized.includes("patient")) return "healthcare";
  if (normalized.includes("commerce") || normalized.includes("shop") || normalized.includes("sale") || normalized.includes("store")) return "commerce";
  if (normalized.includes("analytics") || normalized.includes("insight") || normalized.includes("kpi") || normalized.includes("finance")) return "analytics";
  if (normalized.includes("school") || normalized.includes("education") || normalized.includes("student") || normalized.includes("class")) return "education";
  return "general";
};

export default function ManageDashList() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const sessionId = useMemo(getSessionId, []);
  const navigate = useNavigate();

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
    if (!sessionId) return;
    let active = true;
    setLoading(true);
    dashboardApi
      .list(sessionId, currentUser?.id || undefined)
      .then((res) => {
        if (!active) return;
        setDashboards(res.dashboards || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboards");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId, currentUser?.id]);

  useEffect(() => {
    if (!dashboards.length) return;
    setFavoriteIds((prev) => {
      if (prev.size) return prev;
      const seeded = dashboards.slice(0, 2).map((d) => d.id).filter(Boolean);
      return new Set(seeded);
    });
  }, [dashboards]);

  const handleCreateDashboard = async (data: DraftDashboard) => {
    if (!sessionId) return;
    if (data.id) {
      const sanitizedTables = (data.tables || []).map((t) => ({ ...t, sampleRows: [] }));
      const derivedFields =
        data.fields && data.fields.length
          ? data.fields
          : sanitizedTables.flatMap((table, tableIdx) =>
              (table.fields || []).map((f, fieldIdx) => ({
                ...f,
                id: f.id || `${table.key || table.id || tableIdx}-${f.key || fieldIdx}`,
                fieldName: f.fieldName || f.name || f.key || `Field ${fieldIdx + 1}`,
                fieldType: f.fieldType || f.type || "Text",
              })),
            );
      const sanitizedDashboard = {
        id: data.id,
        name: data.name,
        description: data.description || "",
        fields: derivedFields,
        widgets: data.widgets || [],
        tables: sanitizedTables,
        componentCode: data.componentCode || "",
        type: data.type,
        relationships: data.relationships || [],
        ui: data.ui,
      } as Dashboard;
      setDashboards((prev) => [sanitizedDashboard, ...prev]);
      navigate(`/managedash/${data.id}`);
      return;
    }
    try {
      const res = await dashboardApi.create({
        name: data.name,
        description: data.description,
        fields: data.fields,
        tables: data.tables,
        widgets: data.widgets,
        componentCode: data.componentCode,
        type: data.type,
        sessionId,
        userId: currentUser?.id || null,
      });
      const sanitizedTables =
        res.dashboard.tables?.map((t) => ({
          ...t,
          // Nếu không có file upload thì không gắn sampleRows (tránh dữ liệu ảo)
          sampleRows: dataFileAttached(data) ? t.sampleRows : [],
        })) || [];

      const sanitizedDashboard = {
        ...res.dashboard,
        tables: sanitizedTables,
      };

      setDashboards((prev) => [sanitizedDashboard, ...prev]);
      navigate(`/managedash/${res.dashboard.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dashboard");
    }
  };

  const getShareUrl = (dashboardId: string) => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    return `${base}/managedash/${dashboardId}?access=share`;
  };

  const handleShareDashboard = async (dashboardId: string) => {
    const url = getShareUrl(dashboardId);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShareId(dashboardId);
      setTimeout(() => setCopiedShareId((current) => (current === dashboardId ? null : current)), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the copy link chia se");
    }
  };

  const dataFileAttached = (draft: DraftDashboard) => {
    // Khi AI generator có parsedSchema sẽ đính sampleRows vào tables
    // Nếu không có parsedSchema -> tables chỉ là cấu trúc rỗng, tránh hiển thị mock
    return draft.tables?.some((t) => Array.isArray(t.sampleRows) && t.sampleRows.length > 0);
  };

  const openDashboard = (id: string) => {
    navigate(`/managedash/${id}`);
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const derivedDashboards: DecoratedDashboard[] = dashboards.map((d) => {
    const tableFields = Array.isArray(d.tables) ? d.tables.flatMap((t) => t.fields || []) : [];
    const fieldCount = d.fields?.length ? d.fields.length : tableFields.length;
    const widgets = Array.isArray(d.widgets) ? d.widgets : [];
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
    const insightsArr = Array.isArray((d as any).insights) ? (d as any).insights : [];
    const visibleInsightsCount = insightsArr.filter((i: any) => !(i as any)?.hidden).length;
    const totalInsightsCount = insightsArr.length;
    const tableCount = Array.isArray(d.tables) ? d.tables.length : 0;
    const insightsCount = chartCount || visibleInsightsCount || totalInsightsCount;
    const overviewCount = metricCount || widgetCount || Math.max(1, tableCount || 1);
    const domain = detectDashboardDomain(d);
    const visual = domainVisuals[domain] ?? domainVisuals.general;
    const createdLabel = d.createdAt ? new Date(d.createdAt).toLocaleString() : "Just now";
    const updatedLabel = d.updatedAt ? new Date(d.updatedAt).toLocaleString() : null;
    const statusLabel = (d as any).status || "Active";
    const displayTitle = d.name?.trim() || visual.label;
    return {
      ...d,
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
    };
  });

  const hasDashboards = derivedDashboards.length > 0;
  const recentlyViewed = derivedDashboards.slice(0, 4);
  const favoriteDashboardsSeed = favoriteIds.size
    ? derivedDashboards.filter((dashboard) => favoriteIds.has(dashboard.id))
    : derivedDashboards.slice(0, 3);
  const favoriteDashboards = favoriteDashboardsSeed.length ? favoriteDashboardsSeed : derivedDashboards.slice(0, 3);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredDashboards = normalizedQuery
    ? derivedDashboards.filter((dashboard) =>
        [dashboard.displayTitle, dashboard.domainLabel, dashboard.statusLabel]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedQuery)),
      )
    : derivedDashboards;

  return (
    <div className="manage-dash-wrapper mdash-surface min-h-screen overflow-y-auto">
      <Header
        onManageDash={() => navigate("/managedash")}
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        currentUser={currentUser}
        onLogout={() => {
          clearSession();
          setCurrentUser(null);
          navigate("/login");
        }}
      />

      <main className="max-w-7xl mx-auto p-6 sm:p-8 space-y-12 mdash-container">
        <section className="rounded-3xl mdash-hero-card p-8 md:p-10 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="icon-circle">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="hero-chip">AI-Powered</div>
                  <h2 className="text-3xl font-semibold text-slate-900">Dashboard Generator</h2>
                </div>
              </div>
              <p className="text-slate-700 text-lg max-w-2xl">
                Describe your needs in plain language and let AI instantly craft the structure with all the fields, data types, and configurations you require.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={() => setGeneratorOpen(true)} className="gap-2 mdash-primary-btn">
                  <Sparkles className="w-4 h-4" />
                  Create New Dashboard
                </Button>
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-white/60 px-3 py-1.5 rounded-full shadow-inner">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Live AI builder online
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="hero-visual-blob" />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading dashboards...
          </div>
        ) : (
          <>
            <section className="dashboard-section">
              <div className="dashboard-section-header outer">
                <Clock className="w-5 h-5 text-slate-500" />
                <h3 className="text-xl font-semibold text-slate-900">Recently viewed</h3>
              </div>
              <div className="dashboard-section-frame">
                {hasDashboards ? (
                  <div className="dashboard-grid">
                    {recentlyViewed.map((dashboard) => (
                      <DashboardCard
                        key={dashboard.id}
                        id={dashboard.id}
                        title={dashboard.displayTitle}
                        typeLabel={dashboard.domainLabel}
                        overviewCount={dashboard.overviewCount}
                        insightCount={dashboard.insightsCount}
                        tableCount={dashboard.tableCount}
                        status={dashboard.statusLabel}
                        isFavorite={favoriteIds.has(dashboard.id)}
                        variant="recent"
                        icon={dashboard.iconPreset}
                        lastViewed={dashboard.lastViewedLabel}
                        onOpen={openDashboard}
                        onToggleFavorite={toggleFavorite}
                        onShare={handleShareDashboard}
                        shareLabel={copiedShareId === dashboard.id ? "Copied" : "Share"}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-empty">No dashboards viewed yet – start by generating one.</div>
                )}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="dashboard-section-header outer">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <h3 className="text-xl font-semibold text-slate-900">Favorite dashboards</h3>
              </div>
              <div className="dashboard-section-frame">
                {favoriteDashboards.length ? (
                  <div className="dashboard-grid">
                    {favoriteDashboards.map((dashboard) => (
                      <DashboardCard
                        key={dashboard.id}
                        id={dashboard.id}
                        title={dashboard.displayTitle}
                        typeLabel={dashboard.domainLabel}
                        overviewCount={dashboard.overviewCount}
                        insightCount={dashboard.insightsCount}
                        tableCount={dashboard.tableCount}
                        status={dashboard.statusLabel}
                        isFavorite={favoriteIds.has(dashboard.id)}
                        variant="favorite"
                        icon={dashboard.iconPreset}
                        lastViewed={dashboard.lastViewedLabel}
                        onOpen={openDashboard}
                        onToggleFavorite={toggleFavorite}
                        onShare={handleShareDashboard}
                        shareLabel={copiedShareId === dashboard.id ? "Copied" : "Share"}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-empty">Mark dashboards as favorites to see them highlighted here.</div>
                )}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="dashboard-section-header outer between">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-slate-500" />
                  <h3 className="text-xl font-semibold text-slate-900">All dashboards</h3>
                </div>
                <div className="dashboard-controls below inline">
                  <div className="dashboard-search inline-flex items-center gap-2">
                    <Search className="dashboard-search__icon" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search dashboards"
                      className="pl-10 pr-4 mdash-search-input"
                    />
                  </div>
                </div>
              </div>
              <div className="dashboard-section-frame">
                {hasDashboards ? (
                  filteredDashboards.length ? (
                    <div className="dashboard-grid">
                      {filteredDashboards.map((dashboard) => (
                        <DashboardCard
                          key={dashboard.id}
                          id={dashboard.id}
                          title={dashboard.displayTitle}
                          typeLabel={dashboard.domainLabel}
                          overviewCount={dashboard.overviewCount}
                          insightCount={dashboard.insightsCount}
                          tableCount={dashboard.tableCount}
                        status={dashboard.statusLabel}
                        isFavorite={favoriteIds.has(dashboard.id)}
                        icon={dashboard.iconPreset}
                        lastViewed={dashboard.lastViewedLabel}
                        onOpen={openDashboard}
                        onToggleFavorite={toggleFavorite}
                        onShare={handleShareDashboard}
                        shareLabel={copiedShareId === dashboard.id ? "Copied" : "Share"}
                      />
                    ))}
                    </div>
                  ) : (
                    <div className="dashboard-empty">
                      No dashboards found for "{searchQuery}". Try a different term.
                    </div>
                  )
                ) : (
                  <div className="dashboard-empty">Create your first dashboard to populate this list.</div>
                )}
              </div>
            </section>
          </>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}
      </main>

      <AIDashboardGenerator
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onCreateDashboard={handleCreateDashboard}
        sessionId={sessionId}
        userId={currentUser?.id || null}
      />
    </div>
  );
}
