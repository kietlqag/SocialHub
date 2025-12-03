import { Skeleton } from "../components/ui/skeleton";
import { Card } from "../components/ui/card";
import { useDynamicDashboardMetrics } from "./useDynamicDashboardMetrics";

type Props = {
  projectType: string;
  selectedTables: string[];
  description?: string;
};

function StatCard({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
    </Card>
  );
}

export function DashboardOverview({ projectType, selectedTables, description }: Props) {
  const { metrics, loading } = useDynamicDashboardMetrics({ projectType, selectedTables, description });

  const placeholderCount = loading ? Math.max(selectedTables.length || 4, 4) : metrics.length || 4;
  const items = loading ? Array.from({ length: placeholderCount }) : metrics.length ? metrics : Array.from({ length: 4 });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Overview</h3>
          <p className="text-sm text-gray-500">Business metrics tailored to your tables</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item, idx) =>
          loading ? (
            <Card key={`skeleton-${idx}`} className="p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20" />
            </Card>
          ) : (
            <StatCard key={item.key} label={item.label} value={item.value} icon={item.icon} />
          )
        )}
      </div>
    </div>
  );
}
