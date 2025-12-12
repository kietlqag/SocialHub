import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
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
    type?: string;
    description: string;
    fields: DashboardField[];
    widgets?: DashboardWidget[];
    componentCode?: string;
  }) => void;
}

type ParsedTable = {
  name: string;
  columns: { name: string; inferredType: "number" | "string" | "date" | "boolean" | "mixed" }[];
  numericFields: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
};

type ParsedSchema = {
  fileName: string;
  fileType: "csv" | "excel";
  tables: ParsedTable[];
  totalColumns: number;
  totalRows: number;
};

export function AIDashboardGenerator({ isOpen, onClose, onCreateDashboard }: AIDashboardGeneratorProps) {
  const [step, setStep] = useState<"describe" | "review">("describe");
  const [description, setDescription] = useState("");
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardType, setDashboardType] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFields, setGeneratedFields] = useState<DashboardField[]>([]);
  const [generatedWidgets, setGeneratedWidgets] = useState<DashboardWidget[]>([]);
  const [generatedTables, setGeneratedTables] = useState<DashboardTable[]>([]);
  const [componentCode, setComponentCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [parsedSchema, setParsedSchema] = useState<ParsedSchema | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const dashboardTypes = [
    { value: "ecommerce", label: "Thuong mai dien tu", description: "Theo doi don hang, doanh thu, ton kho va hanh vi khach hang." },
    { value: "healthcare", label: "Y te", description: "Quan ly benh nhan, lich hen, ket qua xet nghiem va hieu suat phong kham." },
    { value: "education", label: "Giao duc", description: "Theo doi lop hoc, tien do hoc tap, diem so va dang ky khoa hoc." },
    { value: "finance", label: "Tai chinh", description: "Tong hop dong tien, chi phi, loi nhuan, KPI tai chinh va rui ro." },
    { value: "saas", label: "SaaS / San pham so", description: "Theo doi subscription, churn, MRR, hanh vi nguoi dung va funnel chuyen doi." },
  ];
  const dashboardTemplates: Record<
    string,
    {
      overview: { label: string; value: string; trend: string }[];
      insights: { title: string; metric: string; change: string; description: string }[];
      tables: DashboardTable[];
    }
  > = {
    ecommerce: {
      overview: [
        { label: "Total revenue", value: "$240k", trend: "+12% MoM" },
        { label: "Average order value", value: "$82.5", trend: "+4% WoW" },
        { label: "Conversion rate", value: "3.8%", trend: "+0.4pp" },
        { label: "Refund rate", value: "1.2%", trend: "-0.2pp" },
      ],
      insights: [
        { title: "Top channel", metric: "Paid Social", change: "+18% orders", description: "Facebook + Instagram campaigns are outperforming email by revenue contribution this week." },
        { title: "Bestseller", metric: "Wireless Earbuds Pro", change: "$42k sales", description: "Drives 26% of revenue; consider bundling with cases to lift AOV." },
        { title: "At-risk segment", metric: "Loyalty Tier Silver", change: "-9% repeat rate", description: "Re-engage with a limited-time free shipping offer to reduce churn." },
      ],
      tables: [
        {
          id: "orders",
          name: "Orders",
          description: "Orders, payments, fulfillment status",
          fields: [
            { id: "orderId", fieldName: "Order ID", fieldType: "Text", required: true },
            { id: "customerId", fieldName: "Customer ID", fieldType: "Text", required: true },
            { id: "orderDate", fieldName: "Order Date", fieldType: "Date", required: true },
            { id: "orderValue", fieldName: "Order Value", fieldType: "Currency", required: true },
            { id: "status", fieldName: "Status", fieldType: "Dropdown", required: true, description: "pending, paid, shipped, delivered, refunded" },
            { id: "channel", fieldName: "Channel", fieldType: "Text", required: false },
          ],
          sampleRows: [],
        },
        {
          id: "products",
          name: "Products",
          description: "Catalog, pricing, and inventory",
          fields: [
            { id: "sku", fieldName: "SKU", fieldType: "Text", required: true },
            { id: "name", fieldName: "Product Name", fieldType: "Text", required: true },
            { id: "category", fieldName: "Category", fieldType: "Text", required: true },
            { id: "price", fieldName: "Price", fieldType: "Currency", required: true },
            { id: "inventory", fieldName: "Inventory", fieldType: "Number", required: true },
          ],
          sampleRows: [],
        },
        {
          id: "customers",
          name: "Customers",
          description: "Customer profiles and behavior",
          fields: [
            { id: "customerId", fieldName: "Customer ID", fieldType: "Text", required: true },
            { id: "name", fieldName: "Full Name", fieldType: "Text", required: true },
            { id: "email", fieldName: "Email", fieldType: "Email", required: true },
            { id: "lifetimeValue", fieldName: "Lifetime Value", fieldType: "Currency", required: false },
            { id: "lastOrderDate", fieldName: "Last Order Date", fieldType: "Date", required: false },
          ],
          sampleRows: [],
        },
      ],
    },
    healthcare: {
      overview: [
        { label: "Appointments today", value: "128", trend: "+6% vs avg" },
        { label: "Avg wait time", value: "11.2 min", trend: "-2.3 min" },
        { label: "No-show rate", value: "3.1%", trend: "-0.6pp" },
        { label: "Bed occupancy", value: "82%", trend: "+3pp" },
      ],
      insights: [
        { title: "Peak specialty", metric: "Cardiology", change: "+14% bookings", description: "Bookings surged after email campaign; ensure adequate staffing in afternoons." },
        { title: "Follow-up gap", metric: "7.8 days", change: "-1.1 days", description: "Average follow-up scheduling time improved; target <6 days to cut readmissions." },
        { title: "Top cancellation reason", metric: "Insurance issue", change: "28% of cancels", description: "Surface insurance verification earlier in the flow to reduce same-day drops." },
      ],
      tables: [
        {
          id: "patients",
          name: "Patients",
          description: "Patient demographics and identifiers",
          fields: [
            { id: "patientId", fieldName: "Patient ID", fieldType: "Text", required: true },
            { id: "fullName", fieldName: "Full Name", fieldType: "Text", required: true },
            { id: "dob", fieldName: "Date of Birth", fieldType: "Date", required: true },
            { id: "email", fieldName: "Email", fieldType: "Email", required: false },
            { id: "phone", fieldName: "Phone", fieldType: "Text", required: false },
          ],
          sampleRows: [],
        },
        {
          id: "appointments",
          name: "Appointments",
          description: "Scheduling, status, and outcomes",
          fields: [
            { id: "appointmentId", fieldName: "Appointment ID", fieldType: "Text", required: true },
            { id: "patientId", fieldName: "Patient ID", fieldType: "Text", required: true },
            { id: "provider", fieldName: "Provider", fieldType: "Text", required: true },
            { id: "scheduledDate", fieldName: "Scheduled Date", fieldType: "Date", required: true },
            { id: "status", fieldName: "Status", fieldType: "Dropdown", required: true, description: "scheduled, in-progress, completed, cancelled, no-show" },
          ],
          sampleRows: [],
        },
        {
          id: "labs",
          name: "Lab Results",
          description: "Key lab metrics and status",
          fields: [
            { id: "labId", fieldName: "Lab ID", fieldType: "Text", required: true },
            { id: "patientId", fieldName: "Patient ID", fieldType: "Text", required: true },
            { id: "testType", fieldName: "Test Type", fieldType: "Text", required: true },
            { id: "resultValue", fieldName: "Result Value", fieldType: "Text", required: true },
            { id: "resultDate", fieldName: "Result Date", fieldType: "Date", required: true },
          ],
          sampleRows: [],
        },
      ],
    },
    education: {
      overview: [
        { label: "Active students", value: "3,240", trend: "+5.2% YoY" },
        { label: "Avg completion", value: "76%", trend: "+3pp" },
        { label: "Attendance", value: "91%", trend: "+1.5pp" },
        { label: "Engagement time", value: "42 min/day", trend: "+6%" },
      ],
      insights: [
        { title: "Course momentum", metric: "Data Science 101", change: "+18% completions", description: "Students complete faster after adding weekly office hours." },
        { title: "Risk cohort", metric: "First-year remote", change: "-9% attendance", description: "Send nudges before live sessions and add bite-size recaps." },
        { title: "Top feedback", metric: "Hands-on labs", change: "4.7/5 rating", description: "Lab-heavy courses show higher retention; add lab variants to low-engagement courses." },
      ],
      tables: [
        {
          id: "students",
          name: "Students",
          description: "Student records and enrollment",
          fields: [
            { id: "studentId", fieldName: "Student ID", fieldType: "Text", required: true },
            { id: "fullName", fieldName: "Full Name", fieldType: "Text", required: true },
            { id: "email", fieldName: "Email", fieldType: "Email", required: true },
            { id: "cohort", fieldName: "Cohort", fieldType: "Text", required: false },
            { id: "status", fieldName: "Status", fieldType: "Dropdown", required: true, description: "enrolled, active, paused, graduated" },
          ],
          sampleRows: [],
        },
        {
          id: "courses",
          name: "Courses",
          description: "Course metadata and pacing",
          fields: [
            { id: "courseId", fieldName: "Course ID", fieldType: "Text", required: true },
            { id: "title", fieldName: "Course Title", fieldType: "Text", required: true },
            { id: "instructor", fieldName: "Instructor", fieldType: "Text", required: true },
            { id: "category", fieldName: "Category", fieldType: "Text", required: false },
            { id: "durationWeeks", fieldName: "Duration (weeks)", fieldType: "Number", required: false },
          ],
          sampleRows: [],
        },
        {
          id: "progress",
          name: "Course Progress",
          description: "Engagement and completion signals",
          fields: [
            { id: "studentId", fieldName: "Student ID", fieldType: "Text", required: true },
            { id: "courseId", fieldName: "Course ID", fieldType: "Text", required: true },
            { id: "completionRate", fieldName: "Completion Rate", fieldType: "Percentage", required: false },
            { id: "attendance", fieldName: "Attendance", fieldType: "Percentage", required: false },
            { id: "lastActive", fieldName: "Last Active", fieldType: "Date", required: false },
          ],
          sampleRows: [],
        },
      ],
    },
    finance: {
      overview: [
        { label: "MRR", value: "$410k", trend: "+8% QoQ" },
        { label: "Gross margin", value: "61%", trend: "+2pp" },
        { label: "Cash runway", value: "14.2 mo", trend: "+0.5 mo" },
        { label: "Burn multiple", value: "1.5x", trend: "-0.2x" },
      ],
      insights: [
        { title: "Expense driver", metric: "Cloud spend", change: "+11% MoM", description: "High storage growth; archive cold data and right-size instances." },
        { title: "Revenue risk", metric: "Top 5 customers", change: "32% MRR", description: "Concentration risk; prioritize expansion in mid-market to diversify." },
        { title: "Collections", metric: "DSO 42 days", change: "-3 days", description: "Faster collections after switching to auto-reminders; target sub-38 days." },
      ],
      tables: [
        {
          id: "transactions",
          name: "Transactions",
          description: "Cash movements and categories",
          fields: [
            { id: "txnId", fieldName: "Transaction ID", fieldType: "Text", required: true },
            { id: "date", fieldName: "Date", fieldType: "Date", required: true },
            { id: "category", fieldName: "Category", fieldType: "Text", required: true },
            { id: "amount", fieldName: "Amount", fieldType: "Currency", required: true },
            { id: "type", fieldName: "Type", fieldType: "Dropdown", required: true, description: "income, expense" },
          ],
          sampleRows: [],
        },
        {
          id: "accounts",
          name: "Accounts",
          description: "Cash accounts and balances",
          fields: [
            { id: "accountId", fieldName: "Account ID", fieldType: "Text", required: true },
            { id: "name", fieldName: "Account Name", fieldType: "Text", required: true },
            { id: "balance", fieldName: "Balance", fieldType: "Currency", required: true },
            { id: "owner", fieldName: "Owner", fieldType: "Text", required: false },
          ],
          sampleRows: [],
        },
        {
          id: "subscriptions",
          name: "Subscriptions",
          description: "Recurring revenue contracts",
          fields: [
            { id: "subscriptionId", fieldName: "Subscription ID", fieldType: "Text", required: true },
            { id: "customer", fieldName: "Customer", fieldType: "Text", required: true },
            { id: "mrr", fieldName: "MRR", fieldType: "Currency", required: true },
            { id: "term", fieldName: "Term", fieldType: "Text", required: false },
            { id: "renewalDate", fieldName: "Renewal Date", fieldType: "Date", required: false },
          ],
          sampleRows: [],
        },
      ],
    },
    saas: {
      overview: [
        { label: "Active users", value: "18,240", trend: "+9% MoM" },
        { label: "DAU/MAU", value: "31%", trend: "+2pp" },
        { label: "Net revenue retention", value: "118%", trend: "+3pp" },
        { label: "Churn rate", value: "2.4%", trend: "-0.5pp" },
      ],
      insights: [
        { title: "Activation", metric: "Day-7 activation 43%", change: "+5pp", description: "Guided onboarding increased setup completion; extend to self-serve funnel." },
        { title: "Expansion", metric: "Seat expansion +14%", change: "+6pp QoQ", description: "Teams on Growth plan expanding fastest; upsell to Pro with usage-based add-ons." },
        { title: "Churn cluster", metric: "SMB low-engagement", change: "38% of churn", description: "Users with <3 weekly actions churn in 14 days; trigger in-app check-ins." },
      ],
      tables: [
        {
          id: "users",
          name: "Users",
          description: "Accounts and roles",
          fields: [
            { id: "userId", fieldName: "User ID", fieldType: "Text", required: true },
            { id: "email", fieldName: "Email", fieldType: "Email", required: true },
            { id: "role", fieldName: "Role", fieldType: "Text", required: false },
            { id: "plan", fieldName: "Plan", fieldType: "Text", required: true },
            { id: "signupDate", fieldName: "Signup Date", fieldType: "Date", required: true },
          ],
          sampleRows: [],
        },
        {
          id: "sessions",
          name: "Sessions",
          description: "Usage events and engagement",
          fields: [
            { id: "sessionId", fieldName: "Session ID", fieldType: "Text", required: true },
            { id: "userId", fieldName: "User ID", fieldType: "Text", required: true },
            { id: "startedAt", fieldName: "Started At", fieldType: "Date", required: true },
            { id: "duration", fieldName: "Duration (minutes)", fieldType: "Number", required: false },
            { id: "actions", fieldName: "Actions", fieldType: "Number", required: false },
          ],
          sampleRows: [],
        },
        {
          id: "subscriptionsSaas",
          name: "Subscriptions",
          description: "Billing and lifecycle",
          fields: [
            { id: "subscriptionId", fieldName: "Subscription ID", fieldType: "Text", required: true },
            { id: "userId", fieldName: "User ID", fieldType: "Text", required: true },
            { id: "mrr", fieldName: "MRR", fieldType: "Currency", required: true },
            { id: "status", fieldName: "Status", fieldType: "Dropdown", required: true, description: "trialing, active, past_due, canceled" },
            { id: "renewalDate", fieldName: "Renewal Date", fieldType: "Date", required: false },
          ],
          sampleRows: [],
        },
      ],
    },
  };

  const fileInfo = useMemo(() => {
    if (!dataFile) return "";
    const sizeKb = dataFile.size / 1024;
    return `${dataFile.name} • ${sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + " MB" : sizeKb.toFixed(1) + " KB"}`;
  }, [dataFile]);

  const inferValueType = (value: any): "number" | "string" | "date" | "boolean" | "mixed" => {
    if (value === null || value === undefined || value === "") return "mixed";
    if (typeof value === "number" && !Number.isNaN(value)) return "number";
    if (typeof value === "boolean") return "boolean";
    if (value instanceof Date || (!Number.isNaN(Date.parse(value)) && /\d{4}/.test(String(value)))) return "date";
    if (typeof value === "string") return "string";
    return "mixed";
  };

  const detectNumericFields = (rows: Record<string, any>[], columns: string[]) => {
    const numericFields: string[] = [];
    columns.forEach((col) => {
      const values = rows.map((r) => r[col]).filter((v) => v !== undefined && v !== null && v !== "");
      if (!values.length) return;
      const numericCount = values.filter((v) => typeof v === "number" && !Number.isNaN(v)).length;
      if (numericCount / values.length >= 0.7) numericFields.push(col);
    });
    return numericFields;
  };

  const parseCSV = (text: string): ParsedSchema => {
    const cleanText = text.replace(/^\uFEFF/, "");
    let parsed = Papa.parse<Record<string, any>>(cleanText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimiter: "", // let Papa auto-detect , ; \t
      transformHeader: (h) => (h ?? "").toString().trim(),
    });

    // Fallback to XLSX CSV reader if Papa fails to produce headers
    if ((parsed.errors.length && !(parsed.meta.fields?.length)) || !(parsed.meta.fields?.length)) {
      try {
        const wb = XLSX.read(cleanText, { type: "string" });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) throw new Error("No sheet found");
        const rowsArr = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1 }) as any[][];
        if (!rowsArr.length) throw new Error("Empty CSV");
        const headers = (rowsArr[0] as any[]).map((h, idx) => (h ? String(h).trim() : `Column ${idx + 1}`));
        const dataRows = rowsArr.slice(1).filter((r) => r.some((cell) => cell !== undefined && cell !== null && cell !== ""));
        const dataObjs = dataRows.map((r) => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""])));
        parsed = {
          data: dataObjs,
          errors: [],
          meta: { fields: headers },
        } as any;
      } catch {
        throw new Error("Unable to read this file. Please upload a valid CSV dataset.");
      }
    }

    if (parsed.errors.length) throw new Error("Unable to read this file. Please upload a valid CSV dataset.");
    const rows = (parsed.data || []).filter((r) => Object.keys(r).length > 0);
    const columns = parsed.meta.fields || [];
    if (!columns.length) throw new Error("No columns detected in this CSV.");

    const numericFields = detectNumericFields(rows, columns);
    const sampleRows = rows.slice(0, 10);

    const table: ParsedTable = {
      name: "Uploaded data",
      columns: columns.map((c) => {
        const vals = rows.map((r) => r[c]).filter((v) => v !== undefined && v !== null && v !== "");
        const inferred = inferValueType(vals[0]);
        return { name: c, inferredType: inferred };
      }),
      numericFields,
      sampleRows,
      totalRows: rows.length,
    };

    return {
      fileName: dataFile?.name || "uploaded.csv",
      fileType: "csv",
      tables: [table],
      totalColumns: columns.length,
      totalRows: rows.length,
    };
  };

  const parseExcel = async (file: File): Promise<ParsedSchema> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetNames = workbook.SheetNames || [];
    if (!sheetNames.length) throw new Error("No sheets found in this Excel file.");

    const tables: ParsedTable[] = sheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!rows.length) {
        return {
          name: sheetName,
          columns: [],
          numericFields: [],
          sampleRows: [],
          totalRows: 0,
        };
      }
      const headers = (rows[0] as any[]).map((h, idx) => (h ? String(h) : `Column ${idx + 1}`));
      const dataRowsArray = rows.slice(1).filter((r) => r.some((cell) => cell !== undefined && cell !== null && cell !== ""));
      const dataRowsObjects = dataRowsArray.map((r) =>
        Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""]))
      );

      const numericFields = detectNumericFields(dataRowsObjects, headers);
      const sampleRows = dataRowsObjects.slice(0, 10);

      const columns = headers.map((h, idx) => {
        const vals = dataRowsArray.map((r) => r[idx]).filter((v) => v !== undefined && v !== null && v !== "");
        const inferred = inferValueType(vals[0]);
        return { name: h, inferredType: inferred };
      });

      return {
        name: sheetName,
        columns,
        numericFields,
        sampleRows,
        totalRows: dataRowsObjects.length,
      };
    });

    const totalColumns = tables.reduce((sum, t) => sum + t.columns.length, 0);
    const totalRows = tables.reduce((sum, t) => sum + t.totalRows, 0);

    return {
      fileName: file.name,
      fileType: "excel",
      tables,
      totalColumns,
      totalRows,
    };
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
        const schema = parseCSV(text);
        setParsedSchema(schema);
      } else if (ext.endsWith(".xls") || ext.endsWith(".xlsx")) {
        const schema = await parseExcel(file);
        setParsedSchema(schema);
      } else {
        throw new Error("Unsupported file type. Upload CSV or Excel.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read this file. Please upload a valid CSV or Excel dataset.");
      setParsedSchema(null);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    const template = dashboardTemplates[dashboardType] || dashboardTemplates["ecommerce"] || { overview: [], insights: [], tables: [] };
    const fallbackTables = template.tables;
    const fallbackFields: DashboardField[] = fallbackTables
      .flatMap((t) => t.fields || [])
      .reduce<DashboardField[]>((acc, f) => {
        if (!acc.find((x) => x.fieldName === f.fieldName)) acc.push(f);
        return acc;
      }, []);
    try {
      const res = await dashboardApi.generate({
        name: dashboardName,
        description,
        type: dashboardType,
        fileProvided: Boolean(parsedSchema),
        inferredSchema: parsedSchema
          ? {
              fileName: parsedSchema.fileName,
              fileType: parsedSchema.fileType,
              tables: parsedSchema.tables.map((t) => ({
                name: t.name,
                columns: t.columns,
                numericFields: t.numericFields,
                sampleRows: t.sampleRows,
              })),
            }
          : undefined,
      });
      const tables = res.tables?.length ? res.tables : fallbackTables;
      const fields = res.fields?.length ? res.fields : fallbackFields;
      const widgets = res.widgets || [];
      onCreateDashboard?.({
        name: dashboardName.trim(),
        type: dashboardType,
        description: description.trim(),
        fields,
        widgets,
        tables,
        componentCode: res.componentCode || "",
      });
      setGeneratedFields(fields);
      setGeneratedTables(tables);
      setGeneratedWidgets(widgets);
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
      type: dashboardType,
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
    setDashboardType("");
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

              <div className="space-y-3">
                <label className="text-sm text-gray-700">Loai dashboard</label>
                <Select value={dashboardType} onValueChange={setDashboardType}>
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Chon mot loai (vi du: Thuong mai dien tu)" />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboardTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{type.label}</span>
                          <span className="text-xs text-gray-500">{type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
              <label className="text-sm text-gray-700 flex items-center justify-between">
                <span>Upload sample data (optional)</span>
                <span className="text-xs text-gray-500">CSV, XLS, XLSX • Max 10MB</span>
              </label>
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                />
                <div
                  className="flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                  onClick={triggerFileSelect}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                >
                  <div className="text-sm text-gray-600">
                    {fileInfo ? <span>{fileInfo}</span> : <span>Drop a CSV/Excel file or click to browse.</span>}
                  </div>
                  <Button variant="outline" size="sm" type="button">Choose file</Button>
                </div>
                {parsedSchema && (
                  <div className="mt-3 text-xs text-gray-600 space-y-1">
                    {parsedSchema.fileType === "csv" ? (
                      <>
                        <div>Detected columns: {parsedSchema.tables[0]?.columns.length ?? 0}</div>
                        <div>
                          Numeric fields: {parsedSchema.tables[0]?.numericFields.slice(0, 6).join(", ") || "None"}
                          {parsedSchema.tables[0] && parsedSchema.tables[0].numericFields.length > 6 ? "..." : ""}
                        </div>
                        <div>Sample rows: {parsedSchema.tables[0]?.sampleRows.length ?? 0}</div>
                      </>
                    ) : (
                      <>
                        <div>Detected sheets: {parsedSchema.tables.length}</div>
                        <div>Total columns: {parsedSchema.totalColumns}</div>
                        <div>
                          Numeric fields:{" "}
                          {parsedSchema.tables
                            .flatMap((t) => t.numericFields)
                            .slice(0, 6)
                            .join(", ") || "None"}
                          {parsedSchema.tables.flatMap((t) => t.numericFields).length > 6 ? "..." : ""}
                        </div>
                        <div>
                          Sample rows per sheet:{" "}
                          {parsedSchema.tables.length
                            ? Math.min(10, Math.max(...parsedSchema.tables.map((t) => t.sampleRows.length || 0)))
                            : 0}
                        </div>
                        <div>
                          Sheets:{" "}
                          {parsedSchema.tables
                            .slice(0, 3)
                            .map((t) => t.name)
                            .join(", ")}
                          {parsedSchema.tables.length > 3 ? "..." : ""}
                        </div>
                      </>
                    )}
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
                  disabled={!description.trim() || !dashboardName.trim() || !dashboardType || isGenerating}
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
