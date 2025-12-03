import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import {
  Sparkles,
  Loader2,
  Check,
  ArrowLeft,
  Plus,
  Trash2,
  Info,
  Database,
} from "lucide-react";
import { cn } from "./ui/utils";
import {
  dashboardApi,
  type DashboardField,
  type DashboardTable,
  type DashboardWidget,
} from "../services/dashboards";

interface AIDashboardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDashboard?: (data: {
    name: string;
    description: string;
    fields: DashboardField[];
    widgets?: DashboardWidget[];
    componentCode?: string;
  }) => void;
}

export function AIDashboardGenerator({ isOpen, onClose, onCreateDashboard }: AIDashboardGeneratorProps) {
  const [step, setStep] = useState<"describe" | "review">("describe");
  const [description, setDescription] = useState("");
  const [dashboardName, setDashboardName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFields, setGeneratedFields] = useState<DashboardField[]>([]);
  const [generatedWidgets, setGeneratedWidgets] = useState<DashboardWidget[]>([]);
  const [generatedTables, setGeneratedTables] = useState<DashboardTable[]>([]);
  const [componentCode, setComponentCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [parsedSchema, setParsedSchema] = useState<{
    fields: DashboardField[];
    exampleRows: Record<string, any>[];
    detectedMetrics: string[];
  } | null>(null);

  const fieldTypes = [
    "Text",
    "Number",
    "Currency",
    "Date",
    "Boolean",
    "Email",
    "URL",
    "Dropdown",
    "Multi-select",
    "Percentage",
  ];

  const fileInfo = useMemo(() => {
    if (!dataFile) return "";
    return `${dataFile.name} • ${(dataFile.size / 1024).toFixed(1)} KB`;
  }, [dataFile]);

  const inferType = (value: string): string => {
    if (!value) return "Text";
    const lower = value.toLowerCase();
    if (!Number.isNaN(Number(value)) && value.trim() !== "") return "Number";
    if (!Number.isNaN(Date.parse(value))) return "Date";
    if (["true", "false", "yes", "no"].includes(lower)) return "Boolean";
    if (lower.includes("@")) return "Email";
    if (lower.startsWith("http")) return "URL";
    return "Text";
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) throw new Error("File is empty");
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => line.split(","));
    const sampleRows = rows.slice(0, 5).map((cols) => Object.fromEntries(headers.map((h, idx) => [h, cols[idx] ?? ""])));
    const fields: DashboardField[] = headers.map((h, idx) => {
      const sample = rows.map((r) => r[idx]).filter(Boolean);
      const sampleValue = sample[0] || "";
      return {
        id: h || `col-${idx}`,
        fieldName: h || `Column ${idx + 1}`,
        fieldType: inferType(sampleValue),
        description: "",
        sampleData: sampleValue,
        required: false,
      };
    });
    const detectedMetrics = fields.filter((f) => ["Number", "Currency", "Percentage"].includes(f.fieldType)).map((f) => f.fieldName);
    return { fields, sampleRows, detectedMetrics };
  };

  const handleFileSelect = async (file: File | null) => {
    if (!file) {
      setDataFile(null);
      setParsedSchema(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Please upload a file under 10MB.");
      return;
    }
    const ext = file.name.toLowerCase();
    setError(null);
    setDataFile(file);
    try {
      if (ext.endsWith(".csv")) {
        const text = await file.text();
        const { fields, sampleRows, detectedMetrics } = parseCSV(text);
        setParsedSchema({ fields, exampleRows: sampleRows, detectedMetrics });
      } else if (ext.endsWith(".xls") || ext.endsWith(".xlsx")) {
        setError("Excel parsing not available in this build. Please upload CSV.");
        setParsedSchema(null);
      } else {
        setError("Unsupported file type. Upload CSV or Excel.");
        setParsedSchema(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read this file. Please upload a valid CSV or Excel dataset.");
      setParsedSchema(null);
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const res = await dashboardApi.generate({
        name: dashboardName,
        description,
        fileProvided: Boolean(parsedSchema),
        inferredSchema: parsedSchema
          ? {
              tables: [
                {
                  id: "uploaded-table",
                  name: dataFile?.name.replace(/\.[^/.]+$/, "") || "Uploaded data",
                  description: "Schema inferred from uploaded file",
                  fields: parsedSchema.fields,
                  actions: ["Add record", "Import data", "Export"],
                  kpis: [],
                },
              ],
              fields: parsedSchema.fields,
              detectedMetrics: parsedSchema.detectedMetrics,
              exampleRows: parsedSchema.exampleRows,
            }
          : undefined,
      });
      onCreateDashboard?.({
        name: dashboardName.trim(),
        description: description.trim(),
        fields: res.fields,
        widgets: res.widgets || [],
        tables: res.tables || [],
        componentCode: res.componentCode || "",
      });
      setGeneratedTables(res.tables || []);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate dashboard");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddField = () => {
    const newField: DashboardField = {
      id: Date.now().toString(),
      fieldName: "New Field",
      fieldType: "Text",
      description: "",
      sampleData: "",
      required: false,
    };
    setGeneratedFields([...generatedFields, newField]);
  };

  const handleRemoveField = (id: string) => {
    setGeneratedFields(generatedFields.filter((field) => field.id !== id));
  };

  const handleFieldUpdate = (id: string, key: keyof DashboardField, value: string | boolean) => {
    setGeneratedFields(
      generatedFields.map((field) => (field.id === id ? { ...field, [key]: value } : field))
    );
  };

  const handleCreateDashboard = () => {
    onCreateDashboard?.({
      name: dashboardName,
      description,
      fields: generatedFields,
      widgets: generatedWidgets,
      tables: generatedTables,
      componentCode,
    });
    handleClose();
  };

  const handleClose = () => {
    setStep("describe");
    setDescription("");
    setDashboardName("");
    setGeneratedFields([]);
    setGeneratedWidgets([]);
    setGeneratedTables([]);
    setComponentCode("");
    setCopied(false);
    setIsGenerating(false);
    setError(null);
    setDataFile(null);
    setParsedSchema(null);
    onClose();
  };

  const handleBack = () => setStep("describe");

  const handleCopyCode = async () => {
    if (!componentCode) return;
    try {
      await navigator.clipboard.writeText(componentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const contentSizeClass = step === "describe"
    ? "w-full sm:w-auto max-w-[92vw] sm:max-w-lg lg:max-w-xl max-h-[80vh]"
    : "w-full max-w-[min(1180px,95vw)] min-w-[min(920px,95vw)] h-[90vh] max-h-[90vh]";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className={cn("w-full overflow-hidden p-0", contentSizeClass)}>
        {step === "describe" ? (
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <DialogTitle className="text-2xl">Describe Your Dashboard</DialogTitle>
              </div>
              <DialogDescription className="text-base">
                Tell our AI what kind of dashboard you want to create. Be specific about the data fields,
                metrics, and information you need to track.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm text-gray-700">Dashboard Name</label>
              <Input
                placeholder="e.g., Customer Management, Sales Tracking, Inventory Dashboard"
                value={dashboardName}
                onChange={(e) => setDashboardName((e.target as HTMLInputElement).value)}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-700 flex items-center justify-between">
                <span>Upload sample data (optional)</span>
                <span className="text-xs text-gray-500">CSV, XLS, XLSX • Max 10MB</span>
              </label>
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    {fileInfo ? <span>{fileInfo}</span> : <span>Drop a CSV/Excel file or click to browse.</span>}
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    />
                    <Button variant="outline" size="sm">Choose file</Button>
                  </label>
                </div>
                {parsedSchema && (
                  <div className="mt-3 text-xs text-gray-600 space-y-1">
                    <div>Detected columns: {parsedSchema.fields.length}</div>
                    <div>Numeric fields: {parsedSchema.detectedMetrics.slice(0, 5).join(", ")}{parsedSchema.detectedMetrics.length > 5 ? "..." : ""}</div>
                    <div>Sample rows: {parsedSchema.exampleRows.length}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-gray-700">Describe your dashboard</label>
              <Textarea
                placeholder="Example: I need a customer relationship management dashboard that tracks customer information including their name, email, phone number, company, deal value, last contact date, and current status in the sales pipeline..."
                value={description}
                  onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
                  className="min-h-[200px] text-base resize-none"
                />
                <p className="text-xs text-gray-500">The more details you provide, the better we can structure your dashboard</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!description.trim() || !dashboardName.trim() || isGenerating}
                  className="gap-2 min-w-[160px]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Dashboard
                    </>
                  )}
                </Button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={handleBack}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <DialogTitle className="text-xl mb-1">Review Dashboard Structure</DialogTitle>
                    <DialogDescription className="text-sm">Review and customize the generated fields for your dashboard</DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 gap-1">
                    <Check className="w-3 h-3" />
                    {generatedFields.length} fields generated
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden p-6 bg-gray-50">
              <div className="flex flex-col gap-6 h-full">
                <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium uppercase tracking-wider w-[200px]">Field Name</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium uppercase tracking-wider w-[160px]">Field Type</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium uppercase tracking-wider w-[280px]">Description</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium uppercase tracking-wider w-[200px]">Sample Data</th>
                          <th className="text-center px-4 py-3 text-xs text-gray-600 font-medium uppercase tracking-wider w-[100px]">Required</th>
                          <th className="text-center px-4 py-3 text-xs text-gray-600 font-medium uppercase tracking-wider w-[80px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {generatedFields.map((field) => (
                          <tr key={field.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <Input value={field.fieldName} onChange={(e) => handleFieldUpdate(field.id, "fieldName", (e.target as HTMLInputElement).value)} className="h-9 border-gray-200" />
                            </td>
                            <td className="px-4 py-3">
                              <Select value={field.fieldType} onValueChange={(value) => handleFieldUpdate(field.id, "fieldType", value)}>
                                <SelectTrigger className="h-9 border-gray-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {fieldTypes.map((type) => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              <Input value={field.description} onChange={(e) => handleFieldUpdate(field.id, "description", (e.target as HTMLInputElement).value)} className="h-9 border-gray-200" placeholder="Enter description..." />
                            </td>
                            <td className="px-4 py-3">
                              <Input value={field.sampleData} onChange={(e) => handleFieldUpdate(field.id, "sampleData", (e.target as HTMLInputElement).value)} className="h-9 border-gray-200" placeholder="Example data..." />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center">
                                <Checkbox checked={field.required} onCheckedChange={(c) => handleFieldUpdate(field.id, "required", c as boolean)} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center">
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveField(field.id)} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <Button variant="outline" size="sm" onClick={handleAddField} className="gap-2"><Plus className="w-4 h-4" />Add Field</Button>
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Generated widget code</div>
                      <div className="text-xs text-gray-500">Copy this snippet to render the dashboard widgets.</div>
                    </div>
                    <Button size="sm" variant="outline" disabled={!componentCode} onClick={handleCopyCode}>
                      {copied ? "Copied" : "Copy code"}
                    </Button>
                  </div>
                  <pre className="bg-slate-950 text-slate-100 text-xs overflow-auto p-4 max-h-[220px]">
                    {componentCode || "// Generate to preview widget code"}
                  </pre>
                </Card>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Database className="w-4 h-4" />
                  <span>Your dashboard will be created with {generatedFields.length} fields</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleBack}>Back</Button>
                  <Button onClick={handleCreateDashboard} disabled={generatedFields.length === 0} className="gap-2 min-w-[160px]"><Check className="w-4 h-4" />Create Dashboard</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
