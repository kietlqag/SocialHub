import { Card } from "../components/ui/card";
import type { InsightChartConfig } from "./insightGenerator";

type ChartPoint = { label: string; value: number };

type InsightsContentProps = {
  charts: InsightChartConfig[];
  renderChart: (config: InsightChartConfig, data: ChartPoint[]) => React.ReactNode;
  buildChartData: (config: InsightChartConfig, range: any) => ChartPoint[];
  range: any;
  rangeLabel: string;
};

export function InsightsContent({ charts, renderChart, buildChartData, range, rangeLabel }: InsightsContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Insights</h2>
        <span className="text-sm text-gray-500">{rangeLabel}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(charts.length ? charts : []).map((chart) => {
          const data = buildChartData(chart, range);
          return (
            <Card key={chart.title} className="p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{chart.title}</h3>
                  <p className="text-sm text-gray-500">{chart.description || "No data"}</p>
                </div>
                <span className="text-xs text-gray-500">{chart.range || rangeLabel}</span>
              </div>
              <div className="mt-2 h-36 flex items-center justify-center w-full">
                {renderChart(chart, data)}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
