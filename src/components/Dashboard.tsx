import { useMemo, useState } from "react";
import {
  BarChart3,
  DollarSign,
  LineChart,
  PieChart,
  Table as TableIcon,
  Users,
  User,
  Calendar,
  FlaskConical,
  CreditCard,
  Search,
  Clock3,
  Inbox,
  Database,
  Sparkles,
  Activity,
  Plus,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { NotificationDropdown } from "./NotificationDropdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import "../styles/dashboard.css";

interface DashboardProps {
  onLogout?: () => void;
  onSettingsOpen?: () => void;
}

const navItems = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "insights", label: "Insights", icon: LineChart },
  { key: "tables", label: "Tables", icon: TableIcon },
  { key: "patients", label: "Patients", icon: User },
  { key: "appointments", label: "Appointments", icon: Calendar },
  { key: "lab", label: "Lab Results", icon: FlaskConical },
  { key: "billing", label: "Billing", icon: CreditCard },
];

export function Dashboard({ onLogout, onSettingsOpen }: DashboardProps) {
  const [active, setActive] = useState<string>("overview");
  const today = useMemo(() => new Date().toLocaleDateString(), []);

  const MetricCard = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className="dashCard metricCard">
      <div className="metricIcon">
        <Icon className="w-5 h-5" />
      </div>
      <div className="metricBody">
        <p className="metricLabel">{title}</p>
        <p className="metricValue">No data</p>
      </div>
    </div>
  );

  const EmptyChart = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="dashCard chartCard">
      <div className="cardHeader">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <Badge variant="outline" className="glassBadge">
          <Clock3 className="w-4 h-4 mr-1" />
          Last 30 days
        </Badge>
      </div>
      <div className="emptyChart">
        <Activity className="w-12 h-12 emptyIcon" />
        <p className="emptyTitle">No data yet</p>
        <p className="emptySubtitle">Connect a data source to see trends.</p>
      </div>
    </div>
  );

  const renderContent = () => {
    if (active === "overview") {
      return (
        <div className="contentGrid">
          <div className="metricsRow">
            <MetricCard icon={DollarSign} title="Revenue" />
            <MetricCard icon={Users} title="Active users" />
            <MetricCard icon={LineChart} title="Conversion" />
            <MetricCard icon={PieChart} title="Pending reports" />
          </div>

          <div className="gridTwo overviewCharts">
            <div className="dashCard chartCardLarge">
              <div className="cardHeader">
                <div>
                  <h3>Visitors statistics</h3>
                  <p>Last 30 days</p>
                </div>
                <Badge variant="outline" className="glassBadge">
                  <Clock3 className="w-4 h-4 mr-1" />
                  Last 30 days
                </Badge>
              </div>
              <div className="chartPlaceholder">
                <LineChart className="w-12 h-12 text-indigo-500" />
                <p className="emptySubtitle">Connect data to view traffic trends.</p>
              </div>
            </div>

            <div className="dashCard miniStack">
              <div className="cardHeader">
                <div>
                  <h3>Alerts</h3>
                  <p>System health</p>
                </div>
              </div>
              <div className="stackList">
                {[ "Blood cancer patients", "Kidney damage", "Pending labs" ].map((item) => (
                  <div key={item} className="stackItem">
                    <div className="stackIcon">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="stackTitle">{item}</p>
                      <p className="stackSubtitle">No data yet</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dashCard tableCard">
            <div className="cardHeader">
              <div>
                <h3>Recent patient appointment</h3>
                <p>Track patient data and other information</p>
              </div>
              <div className="headerActions">
                <div className="searchBox">
                  <Search className="searchIcon" />
                  <Input placeholder="Search patient..." className="searchInput" />
                </div>
                <Button className="primaryBtn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add data
                </Button>
              </div>
            </div>
            <div className="emptyStateRow">
              <Inbox className="emptyIcon" />
              <div>
                <p className="emptyTitle">No appointments</p>
                <p className="emptySubtitle">Add your first record to see it here.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (active === "insights") {
      return (
        <div className="contentGrid">
          <div className="gridTwo">
            <EmptyChart title="Activity over time" subtitle="Track usage trends" />
            <EmptyChart title="Category breakdown" subtitle="See distribution by segment" />
          </div>
        </div>
      );
    }

    if (active === "tables" || active === "patients") {
      return (
        <div className="contentGrid">
          <div className="dashCard">
            <div className="cardHeader">
              <div>
                <h3>Data tables</h3>
                <p>Browse your workspace entities</p>
              </div>
              <div className="headerActions">
                <Button className="primaryBtn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add data
                </Button>
              </div>
            </div>

            <Tabs defaultValue="patients">
              <TabsList className="pillTabs">
                <TabsTrigger value="patients">Patients</TabsTrigger>
                <TabsTrigger value="appointments">Appointments</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>

              <TabsContent value="patients">
                <div className="infoFields">
                  {[
                    { label: "first_name", icon: User, type: "string" },
                    { label: "last_name", icon: Users, type: "string" },
                    { label: "date_of_birth", icon: Calendar, type: "date" },
                    { label: "gender", icon: Users, type: "enum" },
                  ].map((field) => {
                    const Icon = field.icon;
                    return (
                      <div key={field.label} className="infoCard">
                        <div className="infoIcon">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="infoLabel">{field.label}</p>
                          <p className="infoType">{field.type}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="emptyStateRow">
                  <Database className="emptyIcon" />
                  <div>
                    <p className="emptyTitle">No patient records</p>
                    <p className="emptySubtitle">Start by adding data to see patient details here.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="appointments">
                <div className="emptyStateRow">
                  <Inbox className="emptyIcon" />
                  <div>
                    <p className="emptyTitle">No appointments</p>
                    <p className="emptySubtitle">Add your first appointment to view it here.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="billing">
                <div className="emptyStateRow">
                  <Database className="emptyIcon" />
                  <div>
                    <p className="emptyTitle">No billing records</p>
                    <p className="emptySubtitle">Connect billing data to see invoices and payments.</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      );
    }

    if (active === "appointments") {
      return (
        <div className="dashCard">
          <div className="cardHeader">
            <div>
              <h3>Appointments</h3>
              <p>Schedule overview</p>
            </div>
            <Badge variant="outline" className="glassBadge">
              <Calendar className="w-4 h-4 mr-1" />
              Upcoming
            </Badge>
          </div>
          <div className="emptyStateRow">
            <Inbox className="emptyIcon" />
            <div>
              <p className="emptyTitle">No appointments yet</p>
              <p className="emptySubtitle">Create or sync your calendar to see bookings.</p>
            </div>
          </div>
        </div>
      );
    }

    if (active === "lab") {
      return (
        <div className="dashCard">
          <div className="cardHeader">
            <div>
              <h3>Lab Results</h3>
              <p>Clinical data and lab outcomes</p>
            </div>
            <Badge variant="outline" className="glassBadge">
              <FlaskConical className="w-4 h-4 mr-1" />
              Labs
            </Badge>
          </div>
          <div className="emptyStateRow">
            <Database className="emptyIcon" />
            <div>
              <p className="emptyTitle">No lab data</p>
              <p className="emptySubtitle">Connect a lab source to view results.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="dashCard">
        <div className="cardHeader">
          <div>
            <h3>Billing</h3>
            <p>Invoices and payments</p>
          </div>
          <Badge variant="outline" className="glassBadge">
            <DollarSign className="w-4 h-4 mr-1" />
            Billing
          </Badge>
        </div>
        <div className="emptyStateRow">
          <Inbox className="emptyIcon" />
          <div>
            <p className="emptyTitle">No billing data</p>
            <p className="emptySubtitle">Connect your payment provider to see invoices.</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboardPage">
      <div className="dashBg" />
      <div className="dashboardLayout">
        <aside className="dashboardSidebar">
          <div className="sidebarHeader">
            <div className="avatarRing">SH</div>
            <div>
              <p className="sidebarTitle">SocialHub</p>
              <p className="sidebarSubtitle">Dashboard</p>
            </div>
          </div>
          <nav className="sidebarNav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  className={`navItem ${isActive ? "active" : ""}`}
                  onClick={() => setActive(item.key)}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="dashboardMain">
          <header className="mainHeader">
            <div>
              <p className="mainSubtitle">Updated {today}</p>
              <h1 className="mainTitle">Care Dashboard</h1>
            </div>
            <div className="mainActions">
              <Button variant="ghost" className="ghostBtn">
                <Clock3 className="w-4 h-4 mr-2" />
                Last 30 days
              </Button>
              <NotificationDropdown />
              <Button variant="ghost" size="sm" className="ghostBtn" onClick={onSettingsOpen}>
                Settings
              </Button>
              <Button variant="outline" size="sm" className="ghostBtn" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </header>

          {renderContent()}
        </main>
      </div>
    </div>
  );
}
