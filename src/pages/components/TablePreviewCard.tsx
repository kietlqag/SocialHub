import { useMemo } from "react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { DashboardField, DashboardTable } from "../../services/dashboards";
import { Search } from "lucide-react";
import { Input } from "../../components/ui/input";
import { useNavigate } from "react-router-dom";

type Props = {
  table: DashboardTable;
  dashboardId?: string;
  title?: string;
  description?: string;
  actionsOverride?: string[];
  previewColumns?: string[];
};

const SAMPLE_ROWS = 5;

const displayFieldName = (field: DashboardField) => field.fieldName || (field as any).name || field.key || field.id || "Field";

const buildSampleValue = (field: DashboardField, index: number) => {
  if (field.sampleData) return field.sampleData.replace(/\{\{\s*index\s*\}\}/gi, String(index + 1));
  const fallback = `${displayFieldName(field)} ${index + 1}`;
  const type = field.fieldType?.toLowerCase?.() || "";
  if (type.includes("date")) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toLocaleDateString();
  }
  if (type.includes("currency") || type.includes("number")) {
    return Intl.NumberFormat("en-US", { style: type.includes("currency") ? "currency" : "decimal", currency: "USD" }).format(1000 + index * 42);
  }
  if (type.includes("email")) {
    const slug = field.fieldName?.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
    return `${slug}${index + 1}@example.com`;
  }
  if (type.includes("boolean")) return index % 2 === 0 ? "Yes" : "No";
  return fallback;
};

export function TablePreviewCard({ table, dashboardId, title, description, actionsOverride, previewColumns }: Props) {
  const navigate = useNavigate();
  const fields = useMemo(() => {
    if (previewColumns && previewColumns.length) {
      const normalized = previewColumns.map((c) => c.toLowerCase());
      const selected = table.fields.filter(
        (f) => normalized.includes((f.id || "").toLowerCase()) || normalized.includes((f.fieldName || "").toLowerCase())
      );
      if (selected.length) return selected.slice(0, 4);
    }
    return table.fields.slice(0, 4);
  }, [previewColumns, table.fields]);

  const sampleRows = useMemo(() => {
    const provided = (table as any).sampleRows as Record<string, any>[] | undefined;
    // Only show provided sample rows (from uploaded file). Avoid synthesizing mock data.
    if (provided && provided.length) return provided.slice(0, SAMPLE_ROWS);
    return [];
  }, [table]);

  return (
    <Card className="p-5 space-y-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-gray-900 truncate">{title || table.name}</h4>
          <p className="text-sm text-gray-500 truncate">{description || table.description || table.purpose}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(dashboardId ? `/managedash/${dashboardId}?table=${table.id}` : `/managedash`)}
          className="shrink-0"
        >
          View all →
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(actionsOverride || table.actions || []).slice(0, 3).map((action) => (
          <Button key={action} variant="outline" size="sm">
            {action}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3 flex-1 min-h-[180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-10 pr-3" placeholder="Search preview..." />
        </div>
        {sampleRows.length === 0 ? (
          <div className="text-sm text-gray-500">No sample data</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  {fields.map((field) => (
                    <th key={field.id || field.key || displayFieldName(field)} className="px-3 py-2 text-left whitespace-nowrap">
                      {displayFieldName(field)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sampleRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white">
                    {fields.map((field) => (
                      <td key={field.id || field.key || displayFieldName(field)} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {row[field.id || field.key || ""]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {table.recommendedWidgets?.length ? (
        <div className="flex flex-wrap gap-2">
          {table.recommendedWidgets.slice(0, 4).map((widget) => (
            <Badge key={`${table.id}-${widget}`} className="bg-slate-100 text-slate-700 text-xs">
              {widget}
            </Badge>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
