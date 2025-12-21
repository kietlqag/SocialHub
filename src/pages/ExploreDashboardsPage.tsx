import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardApi, type PublicDashboardSummary } from "../services/dashboards";
import { Header } from "../components/Header";
import type { AuthUser } from "../services/auth";
import { Button } from "../components/ui/button";
import CardDash from "../components/dashboard/CardDash";
import { decorateDashboardForList, type DecoratedDashboard } from "../components/dashboard/dashboardCardUtils";
import type { Dashboard } from "../services/dashboards";
import "../styles/explore.css";
import "../styles/managedash.css";

export const ExploreDashboardsPage = ({ currentUser, onLogout }: { currentUser?: AuthUser | null; onLogout?: () => void }) => {
  const [dashboards, setDashboards] = useState<PublicDashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
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
      return matchesTerm;
    });
    const sorted = [...list].sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return sortOrder === "newest" ? bDate - aDate : aDate - bDate;
    });
    return sorted;
  }, [dashboards, search, sortOrder]);

  const decoratedDashboards: DecoratedDashboard[] = useMemo(
    () =>
      filtered.map((d) =>
        decorateDashboardForList({
          id: d._id,
          userId: d.userId,
          name: d.name,
          description: (d as any).description || "",
          type: d.type || "",
          fields: [],
          widgets: [],
          tables: [],
          createdAt: (d as any).createdAt,
          updatedAt: d.updatedAt,
        } as Dashboard),
      ),
    [filtered],
  );

  const openDashboard = (id: string) => navigate(`/managedash/${id}`);

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
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-indigo-400 uppercase">Browse public dashboards</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">Explore dashboards</h1>
              <p className="mt-1 text-sm text-slate-500">Browse dashboards that have been shared publicly.</p>
            </div>

            <div className="px-5 py-2 rounded-full bg-indigo-100/80 text-xs font-semibold text-indigo-700 shadow-sm">
              {filtered.length} public dashboards
            </div>
          </div>

          {/* Search/sort bar removed per request */}
        </div>

        {loading ? (
          <div className="dashboard-empty">Loading public dashboards...</div>
        ) : error ? (
          <div className="explore-empty">
            <p>{error}</p>
            <Button onClick={fetchDashboards}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="explore-empty">
            <p>No public dashboards yet.</p>
            <p className="explore-hint">You can make your dashboard public from the Access control tab.</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-6">
            <section className="dashboard-section">
              <div className="dashboard-section-frame">
                <div className="dashboard-grid">
                  {decoratedDashboards.map((d) => (
                    <CardDash
                      key={d.id}
                      id={d.id}
                      title={d.displayTitle}
                      domainLabel={d.domainLabel}
                      overviewCount={d.overviewCount}
                      chartsCount={d.insightsCount}
                      tableCount={d.tableCount}
                      status={d.statusLabel}
                      isFavorite={false}
                      iconPreset={d.iconPreset}
                      lastUpdatedLabel={d.lastViewedLabel}
                      onOpen={() => openDashboard(d.id)}
                    />
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
};

export default ExploreDashboardsPage;
