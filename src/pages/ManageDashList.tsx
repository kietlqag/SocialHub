import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AIDashboardGenerator } from "../components/AIDashboardGenerator";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Header } from "../components/Header";
import { fetchMe, getCurrentSession, clearSession, type AuthUser } from "../services/auth";
import {
  LayoutDashboard,
  Search,
  Sparkles,
  Clock,
  Star,
  ArrowRight,
  Trash2,
  Loader2,
  Store,
  TrendingUp,
  Users,
  Package,
  ShoppingCart,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  icon: LucideIcon;
  accentColor: string;
};

const iconPool: LucideIcon[] = [LayoutDashboard, Store, TrendingUp, Users, Package, ShoppingCart, BarChart3];
const accentPalette = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-pink-500",
  "bg-indigo-500",
];

export default function ManageDashList() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
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

  const dataFileAttached = (draft: DraftDashboard) => {
    // Khi AI generator có parsedSchema sẽ đính sampleRows vào tables
    // Nếu không có parsedSchema -> tables chỉ là cấu trúc rỗng, tránh hiển thị mock
    return draft.tables?.some((t) => Array.isArray(t.sampleRows) && t.sampleRows.length > 0);
  };

  const handleDelete = async (id: string) => {
    if (!sessionId) return;
    try {
      await dashboardApi.delete(id, sessionId, currentUser?.id || undefined);
      setDashboards((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dashboard");
    }
  };

  const openDashboard = (id: string) => {
    navigate(`/managedash/${id}`);
  };

  const derivedDashboards: DecoratedDashboard[] = dashboards.map((d, index) => {
    const tableFields = Array.isArray(d.tables) ? d.tables.flatMap((t) => t.fields || []) : [];
    const fieldCount = d.fields?.length ? d.fields.length : tableFields.length;
    const widgetCount = Array.isArray(d.widgets) ? d.widgets.length : 0;
    const tableCount = Array.isArray(d.tables) ? d.tables.length : 0;
    const overviewCount = 4;
    const insightsCount = widgetCount > 0 ? Math.min(widgetCount, 4) : Math.max(1, Math.min(4, tableCount));
    return {
      ...d,
      fieldCount,
      widgetCount,
      tableCount,
      overviewCount,
      insightsCount,
      createdLabel: d.createdAt ? new Date(d.createdAt).toLocaleString() : "Just now",
      updatedLabel: d.updatedAt ? new Date(d.updatedAt).toLocaleString() : null,
      icon: iconPool[index % iconPool.length],
      accentColor: accentPalette[index % accentPalette.length],
    };
  });

  const hasDashboards = derivedDashboards.length > 0;
  const recentlyViewed = derivedDashboards.slice(0, 3);
  const favoriteDashboards = derivedDashboards.slice(0, 3);

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
        <div className="rounded-2xl mdash-card glass-panel p-4 shadow-md">
          <div className="relative max-w-3xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search dashboards..." className="pl-11 pr-5 mdash-search-input" />
          </div>
        </div>

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
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-500" />
                <h3 className="text-xl font-semibold text-slate-900">Recently viewed</h3>
              </div>
              {hasDashboards ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {recentlyViewed.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <Card
                        key={item.id}
                        className="min-w-[280px] p-4 mdash-card hover:shadow-lg transition-all cursor-pointer hover-lift"
                        onClick={() => openDashboard(item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`accent-pill ${item.accentColor}`}>
                            <IconComponent className="w-5 h-5 text-white drop-shadow-sm" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.updatedLabel || item.createdLabel}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-6 text-center text-slate-500 mdash-card">No dashboards viewed yet — start by generating a dashboard.</Card>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <h3 className="text-xl font-semibold text-slate-900">Favorite dashboards</h3>
              </div>
              {hasDashboards ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favoriteDashboards.map((dashboard, index) => {
                    const IconComponent = dashboard.icon;
                    const isFavorite = index % 2 === 0;
                    return (
                      <Card
                        key={dashboard.id}
                        className="p-6 mdash-card hover:shadow-lg hover-lift transition-all cursor-pointer group"
                        onClick={() => openDashboard(dashboard.id)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 ${dashboard.accentColor} rounded-2xl shadow-inner`}>
                            <IconComponent className="w-6 h-6 text-white drop-shadow" />
                          </div>
                          <Star className={`w-5 h-5 ${isFavorite ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                        </div>
                        <h4 className="text-lg font-semibold text-slate-900 mb-2">{dashboard.name}</h4>
                        <p className="text-sm text-slate-600 mb-4 line-clamp-2">{dashboard.description || "Custom dashboard"}</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Overview</p>
                            <span className="text-sm text-slate-900">{dashboard.overviewCount}</span>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Insights</p>
                            <span className="text-sm text-slate-900">{dashboard.insightsCount}</span>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Tables</p>
                            <span className="text-sm text-slate-900">{dashboard.tableCount}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
                          <span>Updated {dashboard.updatedLabel || dashboard.createdLabel}</span>
                          <Badge className="bg-green-50 text-green-700 border border-green-100">Active</Badge>
                        </div>
                        <Button
                          className="w-full mt-4 gap-2 mdash-ghost-btn"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDashboard(dashboard.id);
                          }}
                        >
                          Open dashboard
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-6 text-center text-gray-500">Mark dashboards as favorites to see them here.</Card>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-slate-500" />
                  <h3 className="text-xl font-semibold text-slate-900">All dashboards</h3>
                </div>
                <Button variant="outline" size="sm" className="mdash-ghost-btn">
                  Sort by: Recent
                </Button>
              </div>
              {hasDashboards ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {derivedDashboards.map((dashboard) => {
                    const IconComponent = dashboard.icon;
                    return (
                      <Card key={dashboard.id} className="p-6 flex flex-col gap-4 mdash-card hover:shadow-lg hover-lift transition">
                        <div className="flex items-start justify-between">
                          <div className={`p-3 ${dashboard.accentColor} rounded-2xl shadow-inner`}>
                            <IconComponent className="w-6 h-6 text-white drop-shadow" />
                          </div>
                          <Star className="w-5 h-5 text-gray-300" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">{dashboard.name}</h4>
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{dashboard.description || "Generated dashboard"}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Overview</p>
                            <span className="text-sm text-slate-900">{dashboard.overviewCount}</span>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Insights</p>
                            <span className="text-sm text-slate-900">{dashboard.insightsCount}</span>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Tables</p>
                            <span className="text-sm text-slate-900">{dashboard.tableCount}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-3">
                            <span>{dashboard.overviewCount} overview</span>
                            <span aria-hidden="true">.</span>
                            <span>{dashboard.insightsCount} insights</span>
                          </div>
                          <Badge className="bg-green-50 text-green-700 border border-green-100">Active</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button className="flex-1 gap-2 mdash-ghost-btn" variant="outline" onClick={() => openDashboard(dashboard.id)}>
                            Open dashboard
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="rounded-lg hover:bg-red-50" onClick={() => handleDelete(dashboard.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-6 text-center text-slate-500 mdash-card">
                  Create your first dashboard to populate this list. Your creations will appear here.
                </Card>
              )}
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
