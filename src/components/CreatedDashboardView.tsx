import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Check, Save, ArrowLeft } from "lucide-react";
import { Badge } from "./ui/badge";

interface Field {
  id: string;
  fieldName: string;
  fieldType: string;
  description?: string;
  sampleData?: string;
}

interface CreatedDashboardViewProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: { name: string; fields: Field[] } | null;
  onSave?: (dashboard: { name: string; fields: Field[] }) => void;
}

export function CreatedDashboardView({ isOpen, onClose, dashboard, onSave }: CreatedDashboardViewProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!dashboard) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      onSave?.(dashboard);
    } finally {
      setIsSaving(false);
      onClose();
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
              <DialogDescription className="text-sm text-gray-600">Review the generated dashboard fields and save it to your collection.</DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary px-2 py-1">{dashboard.fields.length} fields</Badge>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? "Saving..." : <><Save className="w-4 h-4" /> Save Dashboard</>}
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-auto bg-gray-50 h-[62vh]">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
