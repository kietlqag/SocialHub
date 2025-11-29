import { useState } from "react";
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

interface DashboardField {
  id: string;
  fieldName: string;
  fieldType: string;
  description: string;
  sampleData: string;
  required: boolean;
}

interface AIDashboardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDashboard?: (data: { name: string; fields: DashboardField[] }) => void;
}

export function AIDashboardGenerator({ isOpen, onClose, onCreateDashboard }: AIDashboardGeneratorProps) {
  const [step, setStep] = useState<"describe" | "review">("describe");
  const [description, setDescription] = useState("");
  const [dashboardName, setDashboardName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFields, setGeneratedFields] = useState<DashboardField[]>([]);

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

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Simulate AI generation with a delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate mock fields based on description
    const mockFields: DashboardField[] = [
      {
        id: "1",
        fieldName: "Customer Name",
        fieldType: "Text",
        description: "Full name of the customer",
        sampleData: "John Smith",
        required: true,
      },
      {
        id: "2",
        fieldName: "Email",
        fieldType: "Email",
        description: "Customer email address",
        sampleData: "john.smith@example.com",
        required: true,
      },
      {
        id: "3",
        fieldName: "Purchase Amount",
        fieldType: "Currency",
        description: "Total purchase amount",
        sampleData: "$1,234.56",
        required: true,
      },
      {
        id: "4",
        fieldName: "Purchase Date",
        fieldType: "Date",
        description: "Date of purchase",
        sampleData: "2024-11-24",
        required: true,
      },
      {
        id: "5",
        fieldName: "Status",
        fieldType: "Dropdown",
        description: "Order status",
        sampleData: "Completed",
        required: true,
      },
      {
        id: "6",
        fieldName: "Customer Lifetime Value",
        fieldType: "Currency",
        description: "Total value of all customer purchases",
        sampleData: "$5,678.90",
        required: false,
      },
      {
        id: "7",
        fieldName: "Subscription Active",
        fieldType: "Boolean",
        description: "Whether customer has active subscription",
        sampleData: "Yes",
        required: false,
      },
      {
        id: "8",
        fieldName: "Referral Source",
        fieldType: "Dropdown",
        description: "How customer found us",
        sampleData: "Google Ads",
        required: false,
      },
    ];

    setGeneratedFields(mockFields);
    setIsGenerating(false);
    setStep("review");
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
    onCreateDashboard?.({ name: dashboardName, fields: generatedFields });
    handleClose();
  };

  const handleClose = () => {
    setStep("describe");
    setDescription("");
    setDashboardName("");
    setGeneratedFields([]);
    setIsGenerating(false);
    onClose();
  };

  const handleBack = () => setStep("describe");

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
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="w-4 h-4 text-gray-600 mt-0.5" />
                  <p className="text-sm text-gray-700">Example prompts to get you started:</p>
                </div>
                <ul className="text-sm text-gray-600 space-y-2 ml-6">
                  <li className="list-disc">"Create a sales tracking dashboard with customer name, purchase amount, date, product category, and order status"</li>
                  <li className="list-disc">"Build an employee management dashboard to track name, position, department, salary, hire date, and performance rating"</li>
                  <li className="list-disc">"Design a project management dashboard with project name, client, budget, deadline, status, and team members"</li>
                </ul>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-gray-700">Dashboard Name</label>
                <Input
                  placeholder="e.g., Customer Management, Sales Tracking, Inventory Dashboard"
                  value={dashboardName}
                  onChange={(e) => setDashboardName((e.target as HTMLInputElement).value)}
                  className="text-base"
                />
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
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
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

            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
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
                      {generatedFields.map((field, index) => (
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
