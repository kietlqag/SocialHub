import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Layout, BarChart3, Users, Database, Zap, Shield } from "lucide-react";

const features = [
  {
    icon: Layout,
    title: "Drag & Drop Builder",
    description: "Create custom dashboards with our intuitive drag-and-drop interface. No coding required."
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Monitor your business metrics with live data visualization and customizable charts and graphs."
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Share dashboards with your team, set permissions, and collaborate on business insights in real-time."
  },
  {
    icon: Database,
    title: "Data Integration",
    description: "Connect to multiple data sources including databases, APIs, spreadsheets, and third-party services."
  },
  {
    icon: Zap,
    title: "Smart Automation",
    description: "Set up automated alerts, reports, and workflows to keep your business running smoothly."
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level security with SOC 2 compliance, role-based access control, and data encryption."
  }
];

export function Features() {
  return (
    <section id="features" className="feature-section py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="section-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900">
            Everything you need to manage your business
          </h2>
          <p className="section-subtitle mt-4 max-w-2xl mx-auto text-xl">
            Powerful dashboard tools designed to help you visualize data, track performance, and make informed decisions.
          </p>
        </div>
        
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index} className="relative feature-card">
              <CardHeader>
                <div className="flex items-center">
                  <div className="flex-shrink-0 icon-bubble">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="ml-3 text-lg font-semibold text-slate-900">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-slate-600">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
