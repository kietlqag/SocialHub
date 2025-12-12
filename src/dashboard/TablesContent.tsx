import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { TablePreviewCard } from "../pages/components/TablePreviewCard";
import type { DashboardTable } from "../services/dashboards";

type TablesContentProps = {
  dashboardId?: string;
  tableConfigs: {
    id: string;
    title: string;
    description?: string;
    actions: string[];
    columns: string[];
    sourceTable: string;
  }[];
  mergedTables: DashboardTable[];
};

export function TablesContent({ dashboardId, tableConfigs, mergedTables }: TablesContentProps) {
  const findTable = (id: string) => mergedTables.find((t) => t.id === id) || mergedTables[0];
  const hasTables = mergedTables.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Tables</h2>
        <Button variant="outline" size="sm" className="gap-2" disabled={!hasTables}>
          + Add table
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tableConfigs.length ? (
          tableConfigs.map((cfg) => {
            const table = findTable(cfg.sourceTable);
            if (!table) return null;
            return (
              <TablePreviewCard
                key={cfg.id}
                table={table}
                dashboardId={dashboardId}
                title={cfg.title}
                description={cfg.description}
                actionsOverride={cfg.actions}
                previewColumns={cfg.columns}
              />
            );
          })
        ) : (
          <Card className="p-10 text-center text-gray-500 border border-dashed border-gray-200">No tables were generated for this dashboard.</Card>
        )}
      </div>
    </div>
  );
}
