import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { NotificationDropdown } from "./NotificationDropdown";
import { useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  Activity,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Bell,
  Search,
  Plus,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DashboardProps {
  onLogout?: () => void;
  onSettingsOpen?: () => void;
}

export function Dashboard({ onLogout, onSettingsOpen }: DashboardProps) {
  // Mock data for revenue chart
  const revenueData = [
    { month: "Jan", revenue: 45000, target: 40000 },
    { month: "Feb", revenue: 52000, target: 45000 },
    { month: "Mar", revenue: 48000, target: 48000 },
    { month: "Apr", revenue: 61000, target: 52000 },
    { month: "May", revenue: 55000, target: 55000 },
    { month: "Jun", revenue: 67000, target: 58000 },
    { month: "Jul", revenue: 72000, target: 62000 },
  ];

  // Mock data for sales by category
  const salesByCategory = [
    { name: "Electronics", value: 35, color: "#4f46e5" },
    { name: "Clothing", value: 25, color: "#7c3aed" },
    { name: "Food", value: 20, color: "#2563eb" },
    { name: "Home", value: 15, color: "#0891b2" },
    { name: "Other", value: 5, color: "#64748b" },
  ];

  // Mock data for traffic sources
  const trafficData = [
    { source: "Organic", visitors: 4500 },
    { source: "Direct", visitors: 3200 },
    { source: "Social", visitors: 2800 },
    { source: "Referral", visitors: 2100 },
    { source: "Email", visitors: 1800 },
  ];

  // Mock data for recent orders
  const recentOrders = [
    { id: "ORD-001", customer: "Sarah Johnson", amount: "$1,234", status: "completed", date: "2 mins ago" },
    { id: "ORD-002", customer: "Michael Chen", amount: "$856", status: "pending", date: "15 mins ago" },
    { id: "ORD-003", customer: "Emma Davis", amount: "$2,100", status: "completed", date: "1 hour ago" },
    { id: "ORD-004", customer: "James Wilson", amount: "$432", status: "processing", date: "2 hours ago" },
    { id: "ORD-005", customer: "Lisa Anderson", amount: "$1,567", status: "completed", date: "3 hours ago" },
  ];

  // Mock data for top products
  const topProducts = [
    { name: "Wireless Headphones", sales: 234, revenue: "$23,400", trend: 12 },
    { name: "Smart Watch Pro", sales: 189, revenue: "$56,700", trend: 8 },
    { name: "Laptop Stand", sales: 167, revenue: "$8,350", trend: -3 },
    { name: "USB-C Hub", sales: 145, revenue: "$7,250", trend: 15 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-primary" />
              <span className="text-xl font-semibold text-primary">Syntha</span>
            </div>
          </div>

          <div className="flex-1 max-w-xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search dashboards, reports, data..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Widget
            </Button>
            <NotificationDropdown />
            <Button variant="ghost" size="icon" onClick={onSettingsOpen}>
              <Settings className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
              <Avatar>
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary text-primary-foreground">JD</AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={onLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Dashboard Header */}
        <div className="mb-6">
          <h1 className="text-3xl text-gray-900 mb-2">Dashboard Overview</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your business today.</p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Total Revenue */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-sm">+12.5%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl text-gray-900">$72,458</p>
              <p className="text-xs text-gray-500 mt-1">+$8,240 from last month</p>
            </div>
          </Card>

          {/* Total Orders */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-sm">+8.2%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-2xl text-gray-900">1,429</p>
              <p className="text-xs text-gray-500 mt-1">+108 from last month</p>
            </div>
          </Card>

          {/* Total Customers */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-sm">+18.7%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Customers</p>
              <p className="text-2xl text-gray-900">8,549</p>
              <p className="text-xs text-gray-500 mt-1">+1,353 new customers</p>
            </div>
          </Card>

          {/* Active Products */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex items-center gap-1 text-red-600">
                <ArrowDownRight className="w-4 h-4" />
                <span className="text-sm">-2.4%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Products</p>
              <p className="text-2xl text-gray-900">342</p>
              <p className="text-xs text-gray-500 mt-1">-8 from last month</p>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Revenue Overview - Takes 2 columns */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg text-gray-900 mb-1">Revenue Overview</h3>
                <p className="text-sm text-gray-600">Monthly revenue vs target</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Last 7 months
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Target"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Sales by Category */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg text-gray-900 mb-1">Sales Distribution</h3>
                <p className="text-sm text-gray-600">By category</p>
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={salesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {salesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {salesByCategory.map((category) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                    <span className="text-sm text-gray-700">{category.name}</span>
                  </div>
                  <span className="text-sm text-gray-900">{category.value}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Second Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Traffic Sources */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg text-gray-900 mb-1">Traffic Sources</h3>
                <p className="text-sm text-gray-600">Visitor analytics</p>
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trafficData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" />
                <YAxis dataKey="source" type="category" stroke="#6b7280" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="visitors" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Recent Orders - Takes 2 columns */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg text-gray-900 mb-1">Recent Orders</h3>
                <p className="text-sm text-gray-600">Latest transactions</p>
              </div>
              <Button variant="outline" size="sm">View All</Button>
            </div>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {order.customer.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-gray-900">{order.customer}</p>
                      <p className="text-xs text-gray-500">{order.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-gray-900">{order.amount}</p>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    <p className="text-xs text-gray-500 w-20 text-right">{order.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg text-gray-900 mb-1">Top Products</h3>
                <p className="text-sm text-gray-600">Product performance</p>
              </div>
              <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              {topProducts.map((p) => (
                <div key={p.name} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:shadow-sm transition-all">
                  <div>
                    <p className="text-sm text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.sales} sales • {p.revenue}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-sm ${p.trend >= 0 ? "text-green-600" : "text-red-600"}`}>{p.trend >= 0 ? `+${p.trend}%` : `${p.trend}%`}</div>
                    <div className="w-40">
                      <Progress value={Math.min(Math.abs(p.trend), 100)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg text-gray-900 mb-1">Activity Feed</h3>
                <p className="text-sm text-gray-600">Recent product and order activity</p>
              </div>
              <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="p-3 bg-gray-50 rounded-lg">New order ORD-006 for $420</div>
              <div className="p-3 bg-gray-50 rounded-lg">Stock alert: Product ID 123 has low inventory</div>
              <div className="p-3 bg-gray-50 rounded-lg">New customer registered: Alex Kim</div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
