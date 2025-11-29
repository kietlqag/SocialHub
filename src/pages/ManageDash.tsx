import { useEffect, useState } from "react";
import { AIDashboardGenerator } from "../components/AIDashboardGenerator";
import { CreatedDashboardView } from "../components/CreatedDashboardView";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface SavedDashboard {
  id: string;
  name: string;
  fields: any[];
  createdAt?: number;
}

const STORAGE_KEY = "socialhub:saved_dashboards";

export default function ManageDash() {
  const [saved, setSaved] = useState<SavedDashboard[]>([]);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [selected, setSelected] = useState<{ name: string; fields: any[] } | null>(null);
  const [createdOpen, setCreatedOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setSaved(JSON.parse(raw));
    } catch (e) {
      setSaved([]);
    }
  }, []);

  const handleCreateDashboard = (data: { name: string; fields: any[] }) => {
    setSelected(data);
    setCreatedOpen(true);
  };

  const handleSaveDashboard = (dash: { name: string; fields: any[] }) => {
    const newItem: SavedDashboard = {
      id: Date.now().toString(),
      name: dash.name || "Untitled dashboard",
      fields: dash.fields || [],
      createdAt: Date.now(),
    };
    const updated = [newItem, ...saved];
    setSaved(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    const updated = saved.filter((s) => s.id !== id);
    setSaved(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Dashboards</h2>
          <p className="text-sm text-gray-600">Create, view, and manage dashboards generated with AI</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setGeneratorOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Create from AI</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {saved.length === 0 && (
          <div className="col-span-3 text-center text-gray-500 py-10">
            <div className="text-lg mb-2">No saved dashboards yet</div>
            <div className="text-sm">Use the generator to create a new dashboard or import one.</div>
          </div>
        )}

        {saved.map((s) => (
          <Card key={s.id} className="p-4 flex flex-col justify-between">
            <div>
              <div className="text-lg font-medium">{s.name}</div>
              <div className="text-xs text-gray-500 mt-1">{s.fields?.length || 0} fields • {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</div>
              <div className="mt-3 text-sm text-gray-700">
                {s.fields.slice(0, 6).map((f: any) => (
                  <div key={f.id} className="text-xs text-gray-600">{f.fieldName} • {f.fieldType}</div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">Preview</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => { setSelected({ name: s.name, fields: s.fields }); setCreatedOpen(true); }}>
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

      <AIDashboardGenerator isOpen={generatorOpen} onClose={() => setGeneratorOpen(false)} onCreateDashboard={handleCreateDashboard} />

      <CreatedDashboardView isOpen={createdOpen} onClose={() => setCreatedOpen(false)} dashboard={selected} onSave={handleSaveDashboard} />
    </div>
  );
}
