import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardApi, type PublicDashboardSummary } from "../services/dashboards";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import "../styles/explore.css";

const PlaceholderAvatar = ({ name }: { name?: string }) => {
  const initials = (name || "SH")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return <div className="explore-avatar">{initials}</div>;
};

export const ExploreDashboardsPage = () => {
  const [dashboards, setDashboards] = useState<PublicDashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
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

  const tags = useMemo(() => {
    const set = new Set<string>();
    dashboards.forEach((d) => (d.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [dashboards]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return dashboards.filter((d) => {
      const matchesTerm =
        !term ||
        d.name.toLowerCase().includes(term) ||
        (d.description || "").toLowerCase().includes(term) ||
        (d.owner?.fullName || "").toLowerCase().includes(term);
      const matchesTag = !tagFilter || (d.tags || []).includes(tagFilter);
      return matchesTerm && matchesTag;
    });
  }, [dashboards, search, tagFilter]);

  return (
    <div className="explore-page">
      <div className="explore-hero">
        <div>
          <p className="explore-subtitle">Browse public dashboards</p>
          <h1 className="explore-title">Explore dashboards</h1>
          <p className="explore-copy">Browse dashboards that have been shared publicly.</p>
        </div>
        <div className="explore-count-pill">{filtered.length} public dashboards</div>
      </div>

      <div className="explore-filters">
        <Input
          placeholder="Search dashboards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="explore-search"
        />
        <select
          className="explore-select"
          value={tagFilter || ""}
          onChange={(e) => setTagFilter(e.target.value || null)}
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <Button variant="ghost" className="explore-reload" onClick={fetchDashboards} disabled={loading}>
          Reload
        </Button>
      </div>

      {loading ? (
        <div className="explore-grid">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="explore-card skeleton" />
          ))}
        </div>
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
        <div className="explore-grid">
          {filtered.map((dash) => (
            <div
              key={dash._id}
              className="explore-card"
              onClick={() => navigate(`/managedash/${dash._id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/managedash/${dash._id}`)}
            >
              <div className="explore-card-header">
                <div>
                  <h3 className="explore-card-title">{dash.name}</h3>
                  <p className="explore-card-desc">{dash.description || "No description"}</p>
                </div>
                <div className="explore-tables-pill">{dash.tablesCount || 0} tables</div>
              </div>

              <div className="explore-owner">
                <PlaceholderAvatar name={dash.owner?.fullName} />
                <div>
                  <div className="explore-owner-name">{dash.owner?.fullName || "Unknown owner"}</div>
                  <div className="explore-updated">
                    Updated {dash.updatedAt ? new Date(dash.updatedAt).toLocaleDateString() : "N/A"}
                  </div>
                </div>
              </div>

              <div className="explore-tags">
                {(dash.tags || []).map((tag) => (
                  <span key={tag} className="explore-tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="explore-card-actions">
                <Button className="explore-view-btn" onClick={(e) => { e.stopPropagation(); navigate(`/managedash/${dash._id}`); }}>
                  View dashboard
                </Button>
                <Button variant="ghost" className="explore-fav-btn" onClick={(e) => e.stopPropagation()}>
                  ☆
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExploreDashboardsPage;
