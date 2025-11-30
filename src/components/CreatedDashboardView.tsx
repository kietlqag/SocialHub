import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Check, Save, ArrowLeft } from "lucide-react";
import { Badge } from "./ui/badge";
import { type DashboardWidget } from "../services/dashboards";

interface Field {
  id: string;
  fieldName: string;
  fieldType: string;
  description?: string;
  sampleData?: string;
}

interface CreatedDashboard {
  name: string;
  description?: string;
  fields: Field[];
  widgets?: DashboardWidget[];
  componentCode?: string;
}

interface CreatedDashboardViewProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: CreatedDashboard | null;
  onSave?: (dashboard: CreatedDashboard) => Promise<void> | void;
}

export function CreatedDashboardView({ isOpen, onClose, dashboard, onSave }: CreatedDashboardViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!dashboard) return null;

  const handleSave = async () => {
    if (!dashboard || !onSave) return onClose();
    setError(null);
    setIsSaving(true);
    try {
      await onSave(dashboard);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save dashboard");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!dashboard?.componentCode) return;
    try {
      await navigator.clipboard.writeText(dashboard.componentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <DialogTitle className="text-lg">{dashboard.name || "New Dashboard"}</DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {dashboard.description || "Review the generated dashboard fields and save it to your collection."}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary px-2 py-1">{dashboard.fields.length} fields</Badge>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? "Saving..." : <><Save className="w-4 h-4" /> Save Dashboard</>}
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-auto bg-gray-50 h-[62vh] space-y-6">
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {dashboard.fields.map((f) => (
                <div key={f.id} className="border border-gray-100 rounded p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{f.fieldName}</div>
                      <div className="text-xs text-gray-500">{f.fieldType}</div>
                    </div>
                    <div className="text-green-600"><Check className="w-4 h-4" /></div>
                  </div>
                  {f.description && <div className="text-xs text-gray-600 mt-2">{f.description}</div>}
                  {f.sampleData && <div className="text-xs text-gray-400 mt-2">Example: {f.sampleData}</div>}
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-gray-800">Generated widget code</div>
                <div className="text-xs text-gray-500">Use this React snippet to render the fields as dashboard widgets.</div>
              </div>
              <Button size="sm" variant="outline" disabled={!dashboard.componentCode} onClick={handleCopyCode}>
                {copied ? "Copied" : "Copy code"}
              </Button>
            </div>
            <pre className="bg-slate-950 text-slate-100 text-xs overflow-auto p-4 max-h-[240px]">
              {dashboard.componentCode || "// No widget code generated"}
            </pre>
          </Card>
        </div>

        {error && (
          <div className="px-6 text-sm text-red-600">{error}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
