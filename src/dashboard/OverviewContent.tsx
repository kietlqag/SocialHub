import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";

type OverviewContentProps = {
  kpis: { id: string; title: string; description?: string; value: number | string; icon?: React.ReactNode }[];
  range: string;
  colors: string[];
};

export function OverviewContent({ kpis, range, colors }: OverviewContentProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        <Button variant="outline" size="sm">
          {range}
        </Button>
      </div>
      {kpis.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.id} className="p-4 bg-white border border-gray-200 rounded-2xl">
              <div className="text-xs uppercase tracking-wide text-gray-500">{kpi.title}</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.description || "No data"}</div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-4 text-sm text-gray-600 border border-dashed border-gray-200">No data. Import data to see KPIs.</Card>
      )}
    </div>
  );
}
