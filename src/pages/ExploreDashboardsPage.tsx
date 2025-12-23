import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardApi, type PublicDashboardSummary } from "../services/dashboards";
import { Header } from "../components/Header";
import type { AuthUser } from "../services/auth";
import { Button } from "../components/ui/button";
import CardDash from "../components/dashboard/CardDash";
import { decorateDashboardForList, type DecoratedDashboard } from "../components/dashboard/dashboardCardUtils";
import type { Dashboard } from "../services/dashboards";
import ShareDashboardDialog from "../components/dashboard/ShareDashboardDialog";
import "../styles/explore.css";
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

export const ExploreDashboardsPage = ({ currentUser, onLogout }: { currentUser?: AuthUser | null; onLogout?: () => void }) => {
  const [dashboards, setDashboards] = useState<PublicDashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [domainFilter, setDomainFilter] = useState<"all" | "commerce" | "healthcare" | "analytics" | "education">("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; ownerId?: string | null } | null>(null);
  const sessionId = useMemo(getSessionId, []);
  const navigate = useNavigate();

  const fetchDashboards = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.listPublicDashboards();
      setDashboards(res || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load public dashboards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const list = dashboards.filter((d) => {
      const matchesTerm = !term || d.name.toLowerCase().includes(term) || (d.ownerName || "").toLowerCase().includes(term);

      const normalized = `${d.type || ""} ${d.description || ""}`.toLowerCase();
      const matchesDomain =
        domainFilter === "all" ||
        (domainFilter === "commerce" &&
          (normalized.includes("commerce") ||
            normalized.includes("e-commerce") ||
            normalized.includes("ecommerce") ||
            normalized.includes("order") ||
            normalized.includes("orders") ||
            normalized.includes("customer") ||
            normalized.includes("customers") ||
            normalized.includes("product") ||
            normalized.includes("products"))) ||
        (domainFilter === "healthcare" &&
          (normalized.includes("health") || normalized.includes("clinic") || normalized.includes("patient"))) ||
        (domainFilter === "analytics" &&
          (normalized.includes("analytics") ||
            normalized.includes("insight") ||
            normalized.includes("kpi") ||
            normalized.includes("finance"))) ||
        (domainFilter === "education" &&
          (normalized.includes("education") ||
            normalized.includes("school") ||
            normalized.includes("student") ||
            normalized.includes("class")));

      return matchesTerm && matchesDomain;
    });
    const sorted = [...list].sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return sortOrder === "newest" ? bDate - aDate : aDate - bDate;
    });
    return sorted;
  }, [dashboards, search, sortOrder, domainFilter]);

  const decoratedDashboards: DecoratedDashboard[] = useMemo(
    () =>
      filtered.map((d) => {
        const base = decorateDashboardForList({
          id: d._id,
          userId: d.userId,
          name: d.name,
          description: d.description,
          type: d.type,
          status: (d as any).status,
          ui: d.ui,
          fields: [],
          widgets: d.widgets || [],
          tables: d.tables || [],
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        } as Dashboard);
        return { ...base, ownerName: d.ownerName };
      }),
    [filtered],
  );

  const openDashboard = (id: string) => navigate(`/managedash/${id}`);

  const handleShare = (dashboard: DecoratedDashboard) => {
    setShareTarget({
      id: dashboard.id,
      name: dashboard.displayTitle,
      ownerId: dashboard.userId || dashboard.createdBy || null,
    });
    setShareOpen(true);
  };

  return (
    <>
      <Header
        currentUser={currentUser || null}
        onLogout={onLogout}
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        onManageDash={() => navigate("/managedash")}
      />
      <div className="explore-page">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-end mb-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold text-slate-900 leading-tight">Explore dashboards</h1>
              <p className="text-base text-indigo-500 max-w-xl">Browse dashboards that have been shared publicly.</p>
            </div>

            <div className="px-5 py-2 rounded-full bg-indigo-100/80 text-xs font-semibold text-indigo-700 shadow-sm">
              {filtered.length} public dashboards
            </div>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-empty">Loading public dashboards...</div>
        ) : error ? (
          <div className="explore-empty">
            <p>{error}</p>
            <Button onClick={fetchDashboards}>Retry</Button>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-6">
            <section className="flex gap-8 mt-8 items-stretch">
              {/* Sidebar filters */}
              <aside className="w-64 shrink-0">
                <div className="explore-filter-card space-y-6">
                  {/* Search */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">Search</p>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="7" />
                          <line x1="16.65" y1="16.65" x2="21" y2="21" />
                        </svg>
                      </span>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or owner"
                        className="explore-search-input w-full rounded-2xl border border-slate-200 bg-white/90 px-9 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  {/* Filter checkboxes */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600">Filter</p>

                    <div className="space-y-2 text-sm text-slate-700">
                      {(
                        [
                          ["all", "All"],
                          ["commerce", "Commerce"],
                          ["healthcare", "Healthcare"],
                          ["analytics", "Analytics"],
                          ["education", "Education"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="domain-filter"
                            value={key}
                            checked={domainFilter === key}
                            onChange={() => setDomainFilter(key)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Sort by */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600">Sort by</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSortOrder("newest")}
                        className={`sort-button ${sortOrder === "newest" ? "sort-button--active" : ""}`}
                      >
                        Newest
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder("oldest")}
                        className={`sort-button ${sortOrder === "oldest" ? "sort-button--active" : ""}`}
                      >
                        Oldest
                      </button>
                    </div>
                  </div>
                </div>
              </aside>

              {/* Dashboard list */}
              <div className="flex-1">
                {filtered.length === 0 ? (
                  <div className="explore-empty">
                    <p>No public dashboards yet.</p>
                    <p className="explore-hint">You can make your dashboard public from the Access control tab.</p>
                  </div>
                ) : (
                  <section className="dashboard-section">
                    <div className="dashboard-section-frame">
                      <div className="dashboard-grid">
                        {decoratedDashboards.map((d) => (
                          <CardDash
                            key={d.id}
                            id={d.id}
                            title={d.displayTitle}
                            domainLabel={d.domainLabel}
                            status={d.statusLabel}
                            isFavorite={false}
                            iconPreset={d.iconPreset}
                            lastUpdatedLabel={d.lastViewedLabel}
                            createdBy={d.ownerName}
                            hideStats
                            onOpen={() => openDashboard(d.id)}
                            onShare={() => handleShare(d)}
                          />
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </section>
          </div>
        )}

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
      </div>
    </>
  );
};

export default ExploreDashboardsPage;
