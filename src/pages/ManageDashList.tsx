import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AIDashboardGenerator } from "../components/AIDashboardGenerator";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Header } from "../components/Header";
import CardDash from "../components/dashboard/CardDash";
import { decorateDashboardForList, type DecoratedDashboard } from "../components/dashboard/dashboardCardUtils";
import ShareDashboardDialog from "../components/dashboard/ShareDashboardDialog";
import UseTemplateDialog from "../components/dashboard/UseTemplateDialog";
import { fetchMe, getCurrentSession, clearSession, type AuthUser } from "../services/auth";
import {
  LayoutDashboard,
  Search,
  Sparkles,
  Clock,
  Star,
  Loader2,
} from "lucide-react";
import { dashboardApi, type Dashboard, type DashboardField } from "../services/dashboards";
import { toast } from "sonner";
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

export default function ManageDashList() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; ownerId?: string | null } | null>(null);
  const [useTemplateOpen, setUseTemplateOpen] = useState(false);
  const [useTemplateTarget, setUseTemplateTarget] = useState<DecoratedDashboard | null>(null);
  const [useTemplateLoading, setUseTemplateLoading] = useState(false);
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
      const seededFromFile = dataFileAttached(data);
      const sanitizedTables = (data.tables || []).map((t) => ({
        ...t,
        sampleRows: seededFromFile ? t.sampleRows : [],
      }));
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
      const seededFromFile = dataFileAttached(data);
      const sanitizedTables =
        res.dashboard.tables?.map((t) => ({
          ...t,
          // Nếu không có file upload thì không gắn sampleRows (tránh dữ liệu ảo)
          sampleRows: seededFromFile ? t.sampleRows : [],
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

  const openDashboard = (id: string) => {
    navigate(`/managedash/${id}`);
  };

  const handleShare = (dashboard: DecoratedDashboard) => {
    setShareTarget({
      id: dashboard.id,
      name: dashboard.displayTitle,
      ownerId: dashboard.userId || dashboard.createdBy || null,
    });
    setShareOpen(true);
  };

  const handleUseTemplate = (dashboard: DecoratedDashboard) => {
    setUseTemplateTarget(dashboard);
    setUseTemplateOpen(true);
  };

  const canRenameDashboard = (dashboard: DecoratedDashboard) => {
    if (!currentUser?.id) return false;
    if (dashboard.userId === currentUser.id) return true;
    const assignments = dashboard.accessControl?.userAssignments || [];
    return assignments.some((assignment) => assignment.userId === currentUser.id && assignment.role === "Admin");
  };

  const handleRenameDashboard = async (id: string, nextTitle: string) => {
    if (!currentUser?.id) {
      toast.error("Please sign in to rename dashboards.");
      return;
    }
    const current = dashboards.find((dashboard) => dashboard.id === id);
    if (!current) return;
    if (!canRenameDashboard(current as DecoratedDashboard)) {
      toast.error("You don't have permission to rename this dashboard.");
      return;
    }
    const previousName = current.name;
    setDashboards((prev) =>
      prev.map((dashboard) =>
        dashboard.id === id
          ? {
              ...dashboard,
              name: nextTitle,
            }
          : dashboard,
      ),
    );
    try {
      await dashboardApi.update(id, {
        name: nextTitle,
        sessionId,
        userId: currentUser.id,
      });
    } catch (err) {
      setDashboards((prev) =>
        prev.map((dashboard) =>
          dashboard.id === id
            ? {
                ...dashboard,
                name: previousName,
              }
            : dashboard,
        ),
      );
      const message = err instanceof Error ? err.message : "Failed to rename dashboard.";
      toast.error(message);
    }
  };

  const handleConfirmUseTemplate = async (openAfter: boolean) => {
    if (!useTemplateTarget) return;
    const session = getCurrentSession();
    if (!session?.token) {
      toast.error("Please sign in to use a template.");
      setUseTemplateOpen(false);
      setUseTemplateTarget(null);
      return;
    }
    setUseTemplateLoading(true);
    try {
      const res = await dashboardApi.useTemplate(useTemplateTarget.id, session.token);
      const created = res.dashboard;
      if (openAfter) {
        navigate(`/managedash/${created.id}`);
      } else {
        setDashboards((prev) => [created, ...prev]);
        toast.success("Dashboard created from template.");
      }
      setUseTemplateOpen(false);
      setUseTemplateTarget(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to use template.");
    } finally {
      setUseTemplateLoading(false);
    }
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

  const derivedDashboards: DecoratedDashboard[] = dashboards.map(decorateDashboardForList);

  const hasDashboards = derivedDashboards.length > 0;
  const recentlyViewed = [...derivedDashboards]
    .sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, 2);
  const sharedDashboards =
    currentUser?.id ? derivedDashboards.filter((dashboard) => dashboard.userId && dashboard.userId !== currentUser.id) : [];
  const ownedDashboards =
    currentUser?.id ? derivedDashboards.filter((dashboard) => dashboard.userId === currentUser.id) : derivedDashboards;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredDashboards = normalizedQuery
    ? ownedDashboards.filter((dashboard) =>
        [dashboard.displayTitle, dashboard.domainLabel, dashboard.statusLabel]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedQuery)),
      )
    : ownedDashboards;

  return (
    <div className="manage-dash-wrapper mdash-surface min-h-screen overflow-y-auto">
      <Header
        onManageDash={() => navigate("/managedash")}
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        onAdmin={() => navigate("/admin")}
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
                      <CardDash
                        key={dashboard.id}
                        id={dashboard.id}
                        title={dashboard.displayTitle}
                        domainLabel={dashboard.domainLabel}
                        overviewCount={dashboard.overviewCount}
                        chartsCount={dashboard.insightsCount}
                        tableCount={dashboard.tableCount}
                        status={dashboard.statusLabel}
                        isFavorite={favoriteIds.has(dashboard.id)}
                          iconPreset={dashboard.iconPreset}
                          lastUpdatedLabel={dashboard.lastViewedLabel}
                          onOpen={openDashboard}
                          onToggleFavorite={toggleFavorite}
                        onShare={() => handleShare(dashboard)}
                        onUseTemplate={() => handleUseTemplate(dashboard)}
                        onRename={canRenameDashboard(dashboard) ? handleRenameDashboard : undefined}
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
                <h3 className="text-xl font-semibold text-slate-900">Shared dashboards</h3>
              </div>
              <div className="dashboard-section-frame">
                {sharedDashboards.length ? (
                  <div className="dashboard-grid">
                    {sharedDashboards.map((dashboard) => (
                      <CardDash
                        key={dashboard.id}
                        id={dashboard.id}
                        title={dashboard.displayTitle}
                        domainLabel={dashboard.domainLabel}
                        overviewCount={dashboard.overviewCount}
                        chartsCount={dashboard.insightsCount}
                        tableCount={dashboard.tableCount}
                        status={dashboard.statusLabel}
                        isFavorite={favoriteIds.has(dashboard.id)}
                            iconPreset={dashboard.iconPreset}
                            lastUpdatedLabel={dashboard.lastViewedLabel}
                            onOpen={openDashboard}
                            onToggleFavorite={toggleFavorite}
                          onShare={() => handleShare(dashboard)}
                          onUseTemplate={() => handleUseTemplate(dashboard)}
                          onRename={canRenameDashboard(dashboard) ? handleRenameDashboard : undefined}
                        />
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-empty">
                    Dashboards that others share with you will appear here.
                  </div>
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
                        <CardDash
                          key={dashboard.id}
                          id={dashboard.id}
                          title={dashboard.displayTitle}
                          domainLabel={dashboard.domainLabel}
                          overviewCount={dashboard.overviewCount}
                          chartsCount={dashboard.insightsCount}
                          tableCount={dashboard.tableCount}
                          status={dashboard.statusLabel}
                          isFavorite={favoriteIds.has(dashboard.id)}
                          iconPreset={dashboard.iconPreset}
                          lastUpdatedLabel={dashboard.lastViewedLabel}
                          onOpen={openDashboard}
                          onToggleFavorite={toggleFavorite}
                          onShare={() => handleShare(dashboard)}
                          onUseTemplate={() => handleUseTemplate(dashboard)}
                          onRename={canRenameDashboard(dashboard) ? handleRenameDashboard : undefined}
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

      {shareTarget && (
        <ShareDashboardDialog
          open={shareOpen}
          onOpenChange={(open) => {
            setShareOpen(open);
            if (!open) setShareTarget(null);
          }}
          dashboardId={shareTarget.id}
          dashboardName={shareTarget.name}
          sharePath={`/managedash/${shareTarget.id}`}
          ownerId={shareTarget.ownerId}
          currentUserId={currentUser?.id || null}
          sessionId={sessionId}
        />
      )}

      {useTemplateTarget && (
        <UseTemplateDialog
          open={useTemplateOpen}
          loading={useTemplateLoading}
          onOpenChange={(open) => {
            setUseTemplateOpen(open);
            if (!open) setUseTemplateTarget(null);
          }}
          onConfirm={handleConfirmUseTemplate}
        />
      )}
    </div>
  );
}
