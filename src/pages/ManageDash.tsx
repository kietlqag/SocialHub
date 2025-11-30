import { useEffect, useMemo, useState } from "react";
import { AIDashboardGenerator } from "../components/AIDashboardGenerator";
import { CreatedDashboardView } from "../components/CreatedDashboardView";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Plus, Trash2 } from "lucide-react";
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
  componentCode?: string;
};

export default function ManageDash() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [selected, setSelected] = useState<DraftDashboard | null>(null);
  const [createdOpen, setCreatedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useMemo(getSessionId, []);

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

  const handleCreateDashboard = (data: DraftDashboard) => {
    setSelected(data);
    setCreatedOpen(true);
  };

  const handleSaveDashboard = async (dash: DraftDashboard) => {
    if (!sessionId) throw new Error("Missing session");
    const res = await dashboardApi.create({
      name: dash.name,
      description: dash.description,
      fields: dash.fields,
      widgets: dash.widgets,
      componentCode: dash.componentCode,
      sessionId,
    });
    setDashboards((prev) => [res.dashboard, ...prev]);
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Dashboards</h2>
          <p className="text-sm text-gray-600">Create, view, and manage dashboards generated with AI</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setGeneratorOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create from AI
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {!loading && dashboards.length === 0 && (
          <div className="col-span-3 text-center text-gray-500 py-10">
            <div className="text-lg mb-2">No saved dashboards yet</div>
            <div className="text-sm">Use the generator to create a new dashboard or import one.</div>
          </div>
        )}

        {dashboards.map((s) => (
          <Card key={s.id} className="p-4 flex flex-col justify-between">
            <div>
              <div className="text-lg font-medium">{s.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                {s.fields?.length || 0} fields - {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "-"}
              </div>
              <div className="mt-3 text-sm text-gray-700">
                {s.fields.slice(0, 6).map((f) => (
                  <div key={f.id} className="text-xs text-gray-600">{f.fieldName} - {f.fieldType}</div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">Preview</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelected({
                      name: s.name,
                      description: s.description || "",
                      fields: s.fields,
                      widgets: s.widgets,
                      componentCode: s.componentCode,
                    });
                    setCreatedOpen(true);
                  }}
                >
                  View
                </Button>
                <Button variant="destructive" size="icon" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <AIDashboardGenerator
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onCreateDashboard={handleCreateDashboard}
      />

      <CreatedDashboardView
        isOpen={createdOpen}
        onClose={() => setCreatedOpen(false)}
        dashboard={selected}
        onSave={handleSaveDashboard}
      />
    </div>
  );
}




