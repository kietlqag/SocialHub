import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";

type DashboardContentProps = {
  overviewCount: number;
  insightsCount: number;
  tablesCount: number;
};

export function DashboardContent({ overviewCount, insightsCount, tablesCount }: DashboardContentProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
        {[{ label: "Overview", value: overviewCount, description: "Business KPIs generated from your description" }, { label: "Insights", value: insightsCount, description: "Charts that highlight key metrics across tables" }, { label: "Tables", value: tablesCount, description: "Quick preview of each dataset. Open full table to edit." }].map((item) => (
          <div key={item.label} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{item.value}</div>
              <div className="text-base font-semibold text-gray-900">{item.label}</div>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
          </div>
        ))}
      </Card>

      <Card className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Customers & Clients</h3>
          <p className="text-sm text-gray-600">A 360° view of leads, accounts, and key contacts to nurture relationships.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant="secondary">Add customer</Button>
            <Button variant="outline">Segment customers</Button>
            <Button variant="outline">Update fulfillment</Button>
          </div>
        </div>
        <Button variant="ghost" className="text-sm text-gray-700">View all →</Button>
      </Card>

      <Card className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Projects / Campaigns</h3>
          <p className="text-sm text-gray-600">Strategic initiatives such as launches, campaigns, or implementations.</p>
        </div>
        <Button variant="ghost" className="text-sm text-gray-700">View all →</Button>
      </Card>
    </div>
  );
}
