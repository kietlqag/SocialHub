import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AIDashboardGenerator } from "../components/AIDashboardGenerator";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { NotificationDropdown } from "../components/NotificationDropdown";
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
  name: string;
  description: string;
  fields: DashboardField[];
  widgets?: Dashboard["widgets"];
  tables?: Dashboard["tables"];
  componentCode?: string;
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
  const sessionId = useMemo(getSessionId, []);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setLoading(true);
    dashboardApi
      .list(sessionId)
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
  }, [sessionId]);

  const handleCreateDashboard = async (data: DraftDashboard) => {
    if (!sessionId) return;
    try {
      const res = await dashboardApi.create({
        name: data.name,
        description: data.description,
        fields: data.fields,
        tables: data.tables,
        widgets: data.widgets,
        componentCode: data.componentCode,
        sessionId,
      });
      setDashboards((prev) => [res.dashboard, ...prev]);
      navigate(`/managedash/${res.dashboard.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dashboard");
    }
  };

  const handleDelete = async (id: string) => {
    if (!sessionId) return;
    try {
      await dashboardApi.delete(id, sessionId);
      setDashboards((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dashboard");
    }
  };

  const openDashboard = (id: string) => {
    navigate(`/managedash/${id}`);
  };

  const derivedDashboards: DecoratedDashboard[] = dashboards.map((d, index) => {
    const fieldCount = d.fields?.length || 0;
    const widgetCount = Array.isArray(d.widgets) ? d.widgets.length : 0;
    const tableCount = Array.isArray(d.tables) ? d.tables.length : 0;
    return {
      ...d,
      fieldCount,
      widgetCount,
      tableCount,
      createdLabel: d.createdAt ? new Date(d.createdAt).toLocaleString() : "Just now",
      updatedLabel: d.updatedAt ? new Date(d.updatedAt).toLocaleString() : null,
      icon: iconPool[index % iconPool.length],
      accentColor: accentPalette[index % accentPalette.length],
    };
  });

  const hasDashboards = derivedDashboards.length > 0;
  const recentlyViewed = derivedDashboards.slice(0, 3);
  const favoriteDashboards = derivedDashboards.slice(0, 3);

  const initials = useMemo(() => {
    if (!sessionId) return "SH";
    return sessionId.slice(0, 2).toUpperCase();
  }, [sessionId]);

  return (
    <div className="manage-dash-wrapper min-h-screen overflow-y-auto bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4 max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search dashboards..." className="pl-10 pr-4" />
            </div>
            <div className="flex items-center gap-4">
              <NotificationDropdown />
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-10">
        <section className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-8 border border-indigo-100">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-2xl text-gray-900">AI Dashboard Generator</h2>
              </div>
              <p className="text-gray-700 mb-4 max-w-2xl">
                Describe your needs in plain language and let AI instantly craft the structure with all the fields, data types, and configurations you require.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={() => setGeneratorOpen(true)} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Create New Dashboard
                </Button>
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-white/70 px-3 py-1.5 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  AI-Powered
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="w-32 h-32 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-3xl opacity-20" />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading dashboards...
          </div>
        ) : (
          <>
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-600" />
                <h3 className="text-xl font-semibold text-gray-900">Recently viewed</h3>
              </div>
              {hasDashboards ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {recentlyViewed.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <Card
                        key={item.id}
                        className="min-w-[280px] p-4 hover:shadow-lg transition-all cursor-pointer"
                        onClick={() => openDashboard(item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${item.accentColor}`}>
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.updatedLabel || item.createdLabel}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-6 text-center text-gray-500">No dashboards viewed yet.</Card>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <h3 className="text-xl font-semibold text-gray-900">Favorite dashboards</h3>
              </div>
              {hasDashboards ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favoriteDashboards.map((dashboard, index) => {
                    const IconComponent = dashboard.icon;
                    const isFavorite = index % 2 === 0;
                    return (
                      <Card
                        key={dashboard.id}
                        className="p-6 hover:shadow-lg transition-all cursor-pointer group"
                        onClick={() => openDashboard(dashboard.id)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 ${dashboard.accentColor} rounded-xl`}>
                            <IconComponent className="w-6 h-6 text-white" />
                          </div>
                          <Star className={`w-5 h-5 ${isFavorite ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">{dashboard.name}</h4>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{dashboard.description || "Custom dashboard"}</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Fields</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm text-gray-900">{dashboard.fieldCount}</span>
                              <span className="text-xs text-green-600">Configured</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Widgets</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm text-gray-900">{dashboard.widgetCount}</span>
                              <span className="text-xs text-blue-600">Linked</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Tables</p>
                            <span className="text-sm text-gray-900">{dashboard.tableCount}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-500">
                          <span>Updated {dashboard.updatedLabel || dashboard.createdLabel}</span>
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>
                        <Button
                          className="w-full mt-4 gap-2"
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

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">All dashboards</h3>
                <Button variant="outline" size="sm">
                  Sort by: Recent
                </Button>
              </div>
              {hasDashboards ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {derivedDashboards.map((dashboard) => {
                    const IconComponent = dashboard.icon;
                    return (
                      <Card key={dashboard.id} className="p-6 flex flex-col gap-4 hover:shadow-lg transition">
                        <div className="flex items-start justify-between">
                          <div className={`p-3 ${dashboard.accentColor} rounded-xl`}>
                            <IconComponent className="w-6 h-6 text-white" />
                          </div>
                          <Star className="w-5 h-5 text-gray-300" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{dashboard.name}</h4>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{dashboard.description || "Generated dashboard"}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Fields</p>
                            <span className="text-sm text-gray-900">{dashboard.fieldCount}</span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Widgets</p>
                            <span className="text-sm text-gray-900">{dashboard.widgetCount}</span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Tables</p>
                            <span className="text-sm text-gray-900">{dashboard.tableCount}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-3">
                            <span>{dashboard.fieldCount} fields</span>
                            <span aria-hidden="true">.</span>
                            <span>{dashboard.widgetCount} widgets</span>
                          </div>
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button className="flex-1 gap-2" variant="outline" onClick={() => openDashboard(dashboard.id)}>
                            Open dashboard
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(dashboard.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-6 text-center text-gray-500">Create your first dashboard to populate this list.</Card>
              )}
            </section>
          </>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}
      </main>

      <AIDashboardGenerator isOpen={generatorOpen} onClose={() => setGeneratorOpen(false)} onCreateDashboard={handleCreateDashboard} />
    </div>
  );
}
