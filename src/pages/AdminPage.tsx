import React, { useEffect, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { ScrollArea } from "../components/ui/scroll-area";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import {
  ArrowLeft,
  Shield,
  Users,
  UserPlus,
  Search,
  Download,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  Eye,
  Mail,
  Calendar,
  Activity,
  UserCheck,
  Lock,
  Unlock,
  LayoutDashboard,
  Database,
  Bell,
  DollarSign,
  LifeBuoy,
  AlertTriangle,
  TrendingUp,
  Settings,
  Copy,
  RefreshCw,
  ExternalLink,
  FileText,
  Key,
  UserCog,
  Users2,
  FolderTree,
  BarChart3,
  Zap,
  Server,
  MessageSquare,
  CreditCard,
  Clock,
  Filter,
  MoreVertical,
  Send,
  Sparkles,
  GitBranch,
  Blocks,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { getCurrentSession } from "../services/auth";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer" | "user";
  status: "active" | "inactive" | "suspended" | "pending";
  plan: "free" | "starter" | "pro" | "enterprise";
  joinDate: string;
  lastActive: string;
  lastLogin: string;
  dashboards: number;
  storage: string;
  avatar: string;
  owner?: string;
  team?: string;
  loginHistory: Array<{ date: string; ip: string; device: string }>;
}

interface Group {
  id: string;
  name: string;
  members: number;
  dashboardAccess: string[];
  quota: {
    dashboards: number;
    tables: number;
    records: number;
  };
  usedQuota: {
    dashboards: number;
    tables: number;
    records: number;
  };
}

interface DashboardItem {
  id: string;
  name: string;
  owner: string;
  ownerId?: string | null;
  tables: number;
  records: number;
  lastModified: string;
  status: "active" | "locked" | "archived";
  size: string;
  description?: string;
  widgets?: number;
  insights?: number;
}

interface ActivityLog {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  details: string;
}

interface SystemHealth {
  id: string;
  organization: string;
  dbStatus: "connected" | "error" | "slow";
  apiErrors: number;
  queueStatus: "running" | "stopped" | "warning";
  lastCheck: string;
}

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  userName?: string | null;
}

interface AdminPageProps {
  onBack?: () => void;
}

export function AdminPage({ onBack }: AdminPageProps = {}) {
  const [activeTab, setActiveTab] = useState("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formUser, setFormUser] = useState<User | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  // Mock Data
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "Sarah Johnson",
      email: "sarah.johnson@company.com",
      role: "admin",
      status: "active",
      plan: "enterprise",
      joinDate: "2024-01-15",
      lastActive: "2 mins ago",
      lastLogin: "2024-12-20 09:30",
      dashboards: 12,
      storage: "4.2 GB",
      avatar: "SJ",
      owner: "John Admin",
      team: "Engineering",
      loginHistory: [
        { date: "2024-12-20 09:30", ip: "192.168.1.100", device: "Chrome / MacOS" },
        { date: "2024-12-19 14:20", ip: "192.168.1.100", device: "Chrome / MacOS" },
        { date: "2024-12-18 08:15", ip: "192.168.1.101", device: "Safari / iOS" },
      ],
    },
    {
      id: "2",
      name: "Michael Chen",
      email: "michael.chen@company.com",
      role: "editor",
      status: "active",
      plan: "pro",
      joinDate: "2024-02-20",
      lastActive: "15 mins ago",
      lastLogin: "2024-12-20 08:45",
      dashboards: 8,
      storage: "2.8 GB",
      avatar: "MC",
      owner: "John Admin",
      team: "Marketing",
      loginHistory: [
        { date: "2024-12-20 08:45", ip: "192.168.1.102", device: "Firefox / Windows" },
      ],
    },
    {
      id: "3",
      name: "Emma Williams",
      email: "emma.williams@company.com",
      role: "viewer",
      status: "active",
      plan: "starter",
      joinDate: "2024-03-10",
      lastActive: "1 hour ago",
      lastLogin: "2024-12-20 07:00",
      dashboards: 5,
      storage: "1.5 GB",
      avatar: "EW",
      owner: "Sarah Johnson",
      team: "Sales",
      loginHistory: [
        { date: "2024-12-20 07:00", ip: "192.168.1.103", device: "Edge / Windows" },
      ],
    },
  ]);

  const [groups, setGroups] = useState<Group[]>([
    {
      id: "1",
      name: "Engineering Team",
      members: 12,
      dashboardAccess: ["dashboard-1", "dashboard-2", "dashboard-3"],
      quota: { dashboards: 50, tables: 200, records: 100000 },
      usedQuota: { dashboards: 35, tables: 140, records: 75000 },
    },
    {
      id: "2",
      name: "Marketing Team",
      members: 8,
      dashboardAccess: ["dashboard-4", "dashboard-5"],
      quota: { dashboards: 30, tables: 100, records: 50000 },
      usedQuota: { dashboards: 18, tables: 65, records: 32000 },
    },
  ]);

  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [loadingDashboards, setLoadingDashboards] = useState(false);
  const [loadingDashboardDetail, setLoadingDashboardDetail] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState("");

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [newNotifTitle, setNewNotifTitle] = useState("");
  const [newNotifMessage, setNewNotifMessage] = useState("");
  const [newNotifType, setNewNotifType] = useState("info");
  const [systemHealth, setSystemHealth] = useState<SystemHealth[]>([
    {
      id: "1",
      organization: "Acme Corp",
      dbStatus: "connected",
      apiErrors: 0,
      queueStatus: "running",
      lastCheck: "2024-12-20 09:30",
    },
    {
      id: "2",
      organization: "TechStart Inc",
      dbStatus: "slow",
      apiErrors: 3,
      queueStatus: "warning",
      lastCheck: "2024-12-20 09:28",
    },
    {
      id: "3",
      organization: "Global Systems",
      dbStatus: "error",
      apiErrors: 15,
      queueStatus: "stopped",
      lastCheck: "2024-12-20 09:25",
    },
  ]);

  useEffect(() => {
    const session = getCurrentSession();
    if (!session?.token) return;
    setLoadingUsers(true);
    api
      .get<{ users: any[] }>("/admin/users", session.token)
      .then((res) => {
        const mapped = (res.users || []).map((u) => {
          const fullName = u.full_name || u.fullName || u.name || u.email || "User";
          const joinDate = u.joinDate || u.created_at || u.createdAt;
          const updated = u.updated_at || u.updatedAt;
          return {
            id: u.id,
            name: fullName,
            email: u.email,
            role: (u.role || "user") as User["role"],
            status: u.isVerified ? "active" : "pending",
            plan: "free",
            joinDate: joinDate ? new Date(joinDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            lastActive: updated ? new Date(updated).toLocaleString() : "—",
            lastLogin: updated ? new Date(updated).toLocaleString() : "—",
            dashboards: u.dashboards || 0,
            storage: "—",
            avatar: fullName.slice(0, 2).toUpperCase(),
            owner: u.owner || "",
            team: u.company || u.team || "—",
            loginHistory: Array.isArray(u.loginHistory) ? u.loginHistory : [],
          } as User;
        });
        if (mapped.length) setUsers(mapped);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err?.message || "Failed to load users");
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    const session = getCurrentSession();
    if (!session?.token) return;
    setLoadingDashboards(true);
    api
      .get<{ dashboards: any[] }>("/admin/dashboards", session.token)
      .then((res) => {
        const mapped: DashboardItem[] = (res.dashboards || []).map((d) => {
          const updated = d.updatedAt || d.updated_at || d.lastDashboardUpdate;
          const tables = Array.isArray(d.tables) ? d.tables : [];
          const recordCount = tables.reduce((sum: number, t: any) => {
            if (Array.isArray(t.sampleRows)) return sum + t.sampleRows.length;
            return sum;
          }, 0);
          return {
            id: d.id,
            name: d.name || "Untitled",
            description: d.description || "",
            owner: d.ownerName || d.owner || "—",
            ownerId: d.ownerId || null,
            tables: d.tableCount || tables.length,
            records: d.records || recordCount,
            lastModified: updated
              ? new Date(updated).toLocaleString()
              : d.createdAt
                ? new Date(d.createdAt).toLocaleString()
                : "—",
            status: "active",
            size: d.size || "—",
            widgets: d.widgetCount || 0,
            insights: d.insightCount || 0,
          };
        });
        setDashboards(mapped);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err?.message || "Failed to load dashboards");
      })
      .finally(() => setLoadingDashboards(false));
  }, []);

  useEffect(() => {
    const session = getCurrentSession();
    if (!session?.token) return;
    setLoadingActivity(true);
    api
      .get<{ logs: any[] }>("/admin/activity", session.token)
      .then((res) => {
        const mapped: ActivityLog[] = (res.logs || []).map((log) => ({
          id: log.id,
          user: log.userName || log.userEmail || "System",
          action: log.action || "event",
          target: log.targetName || log.targetType || "",
          timestamp: log.createdAt ? new Date(log.createdAt).toLocaleString() : "",
          details: log.metadata ? JSON.stringify(log.metadata) : "",
        }));
        setActivityLogs(mapped);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err?.message || "Failed to load activity logs");
      })
      .finally(() => setLoadingActivity(false));
  }, []);

  useEffect(() => {
    const session = getCurrentSession();
    if (!session?.token) return;
    setLoadingNotifications(true);
    api
      .get<{ notifications: any[] }>("/admin/notifications", session.token)
      .then((res) => {
        const mapped: AdminNotification[] = (res.notifications || []).map((n) => ({
          id: n.id,
          title: n.title || "Notification",
          message: n.message || "",
          type: n.type || "info",
          read: !!n.read,
          createdAt: n.created_at || n.createdAt || new Date().toISOString(),
          userName: n.userName || n.userEmail || null,
        }));
        setAdminNotifications(mapped);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err?.message || "Failed to load notifications");
      })
      .finally(() => setLoadingNotifications(false));
  }, []);

  const sendAdminNotification = async () => {
    const session = getCurrentSession();
    if (!session?.token) {
      toast.error("Please sign in");
      return;
    }
    if (!newNotifTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setLoadingNotifications(true);
    try {
      const res = await api.post<{ notification: any }>(
        "/admin/notifications",
        { title: newNotifTitle, message: newNotifMessage, type: newNotifType, read: false },
        session.token
      );
      const n = res.notification;
      const mapped: AdminNotification = {
        id: n.id,
        title: n.title || "Notification",
        message: n.message || "",
        type: n.type || "info",
        read: !!n.read,
        createdAt: n.created_at || n.createdAt || new Date().toISOString(),
        userName: n.userName || n.userEmail || null,
      };
      setAdminNotifications((prev) => [mapped, ...prev]);
      setNewNotifTitle("");
      setNewNotifMessage("");
      toast.success("Notification sent");
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Failed to send notification");
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleViewDashboard = (dashboard: DashboardItem) => {
    const session = getCurrentSession();
    if (!session?.token) {
      toast.error("Session expired. Please sign in again.");
      return;
    }
    setLoadingDashboardDetail(true);
    api
      .get<{ dashboard: any }>(`/admin/dashboards/${dashboard.id}`, session.token)
      .then((res) => {
        setSelectedItem(res.dashboard);
        setDialogType("dashboard-details");
        setIsDialogOpen(true);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err?.message || "Failed to load dashboard");
      })
      .finally(() => setLoadingDashboardDetail(false));
  };

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "connected":
      case "running":
        return "bg-green-100 text-green-800";
      case "inactive":
      case "locked":
      case "warning":
      case "slow":
        return "bg-yellow-100 text-yellow-800";
      case "suspended":
      case "error":
      case "stopped":
        return "bg-red-100 text-red-800";
      case "pending":
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "editor":
        return "bg-blue-100 text-blue-800";
      case "viewer":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const openDialog = (type: string, item?: any) => {
    setDialogType(type);
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleEditUser = (user?: User) => {
    const base: User = user || {
      id: "",
      name: "",
      email: "",
      role: "user",
      status: "pending",
      plan: "free",
      joinDate: new Date().toISOString().slice(0, 10),
      lastActive: "—",
      lastLogin: "—",
      dashboards: 0,
      storage: "—",
      avatar: "NA",
      owner: "",
      team: "",
      loginHistory: [],
    };
    setFormUser(base);
    setDialogType("edit-user");
    setIsDialogOpen(true);
  };

  const handleResetPassword = (user: User) => {
    toast.success(`Password reset link sent to ${user.email}`);
  };

  const handleSaveUser = async () => {
    if (!formUser) return;
    const session = getCurrentSession();
    if (!session?.token) {
      toast.error("Session expired. Please sign in again.");
      return;
    }
    setSavingUser(true);
    try {
      if (formUser.id) {
        const res = await api.patch<{ user: any }>(`/admin/users/${formUser.id}`, {
          fullName: formUser.name,
          company: formUser.team,
          role: formUser.role,
          isVerified: formUser.status === "active",
        }, session.token);
        setUsers((prev) => prev.map((u) => (u.id === formUser.id ? {
          ...u,
          ...res.user,
          name: res.user.name || res.user.fullName || u.name,
          status: res.user.isVerified ? "active" : "pending",
          avatar: (res.user.name || res.user.email || "").slice(0, 2).toUpperCase(),
        } : u)));
        toast.success("User updated");
      } else {
        const res = await api.post<{ user: any; tempPassword?: string }>("/admin/users", {
          email: formUser.email,
          fullName: formUser.name,
          company: formUser.team,
          role: formUser.role,
          isVerified: formUser.status === "active",
        }, session.token);
        const newUser: User = {
          id: res.user.id,
          name: res.user.name || res.user.fullName || res.user.email,
          email: res.user.email,
          role: res.user.role || "user",
          status: res.user.isVerified ? "active" : "pending",
          plan: "free",
          joinDate: res.user.joinDate || new Date().toISOString().slice(0, 10),
          lastActive: "—",
          lastLogin: "—",
          dashboards: 0,
          storage: "—",
          avatar: (res.user.name || res.user.email || "?").slice(0, 2).toUpperCase(),
          owner: "",
          team: res.user.company || "",
          loginHistory: [],
        };
        setUsers((prev) => [newUser, ...prev]);
        toast.success(res.tempPassword ? `User created. Temp password: ${res.tempPassword}` : "User created");
      }
      setIsDialogOpen(false);
      setFormUser(null);
      setDialogType("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleAssignOwner = (user: User, owner: string) => {
    setUsers(users.map((u) => (u.id === user.id ? { ...u, owner } : u)));
    toast.success(`Owner assigned to ${user.name}`);
  };

  const handleDeleteUser = async (user: User) => {
    const session = getCurrentSession();
    if (!session?.token) {
      toast.error("Session expired. Please sign in again.");
      return;
    }
    try {
      await api.delete(`/admin/users/${user.id}`, session.token);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("User deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user");
    }
  };

  const handleBulkAction = async (action: string) => {
    const session = getCurrentSession();
    if (!session?.token) {
      toast.error("Session expired. Please sign in again.");
      return;
    }
    const selectedCount = selectedUsers.size;
    const updates: Record<string, any> = {};
    if (action === "Activated") updates.isVerified = true;
    if (action === "Suspended") updates.isVerified = false;
    try {
      await Promise.all(
        Array.from(selectedUsers).map((id) =>
          api.patch(`/admin/users/${id}`, updates, session.token)
        )
      );
      setUsers((prev) =>
        prev.map((u) =>
          selectedUsers.has(u.id)
            ? { ...u, status: updates.isVerified ? "active" : "pending", isVerified: updates.isVerified }
            : u
        )
      );
      toast.success(`${action} applied to ${selectedCount} user(s)`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update users");
    } finally {
      setSelectedUsers(new Set());
    }
  };

  const handleExport = (type: string) => {
    toast.success(`${type} data exported successfully`);
  };

  const filteredDashboards = dashboards.filter((d) => {
    if (!dashboardSearch.trim()) return true;
    const q = dashboardSearch.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.owner || "").toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-2xl">System Administration</h1>
                  <p className="text-sm text-gray-600">
                    Comprehensive platform management and monitoring
                  </p>
                </div>
              </div>
            </div>
            <Button className="gap-2" onClick={() => handleEditUser()}>
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6 flex flex-nowrap overflow-x-auto gap-2 px-1">
            <TabsTrigger value="users" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <UserCog className="h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="dashboards" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <LayoutDashboard className="h-4 w-4" />
              Dashboards
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="widgets" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <Sparkles className="h-4 w-4" />
              Widgets
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <Server className="h-4 w-4" />
              Health
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <DollarSign className="h-4 w-4" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2 whitespace-nowrap flex-1 md:flex-none">
              <LifeBuoy className="h-4 w-4" />
              Support
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl mt-1">{users.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active</p>
                    <p className="text-2xl mt-1">
                      {users.filter((u) => u.status === "active").length}
                    </p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Suspended</p>
                    <p className="text-2xl mt-1">
                      {users.filter((u) => u.status === "suspended").length}
                    </p>
                  </div>
                  <Ban className="h-8 w-8 text-red-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl mt-1">
                      {users.filter((u) => u.status === "pending").length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      placeholder="Search by name, email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => handleExport("Users")}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>

                {selectedUsers.size > 0 && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm">
                      {selectedUsers.size} user(s) selected
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction("Activated")}
                      >
                        Activate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction("Suspended")}
                      >
                        Suspend
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog("bulk-assign-owner")}
                      >
                        Assign Owner
                      </Button>
                    </div>
                  </div>
                )}

                {/* USER TABLE */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.size === users.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users
                        .filter(
                          (user) =>
                            user.name
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase()) ||
                            user.email
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase())
                        )
                        .map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedUsers.has(user.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectUser(user.id, checked as boolean)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback>{user.avatar}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{user.name}</div>
                                  <div className="text-sm text-gray-500">
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getRoleColor(user.role)}>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(user.status)}>
                                {user.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {user.owner || "Unassigned"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {user.team || "-"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {user.lastLogin}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDialog("user-details", user)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleResetPassword(user)}
                                  title="Reset Password"
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDialog("login-history", user)}
                                  title="Login History"
                                >
                                  <Clock className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditUser(user)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUser(user)}
                                  title="Delete user"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Groups</p>
                    <p className="text-2xl mt-1">{groups.length}</p>
                  </div>
                  <Users2 className="h-8 w-8 text-purple-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Members</p>
                    <p className="text-2xl mt-1">
                      {groups.reduce((sum, g) => sum + g.members, 0)}
                    </p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Dashboard Access</p>
                    <p className="text-2xl mt-1">
                      {groups.reduce((sum, g) => sum + g.dashboardAccess.length, 0)}
                    </p>
                  </div>
                  <LayoutDashboard className="h-8 w-8 text-blue-600" />
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg">Groups & Permissions</h3>
                  <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Create Group
                  </Button>
                </div>

                <div className="space-y-4">
                  {groups.map((group) => (
                    <Card key={group.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Users2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium">{group.name}</h4>
                              <p className="text-sm text-gray-600">
                                {group.members} members
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-gray-600 mb-1">
                                Dashboards Quota
                              </p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600"
                                    style={{
                                      width: `${(group.usedQuota.dashboards / group.quota.dashboards) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm">
                                  {group.usedQuota.dashboards}/{group.quota.dashboards}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 mb-1">
                                Tables Quota
                              </p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-600"
                                    style={{
                                      width: `${(group.usedQuota.tables / group.quota.tables) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm">
                                  {group.usedQuota.tables}/{group.quota.tables}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 mb-1">
                                Records Quota
                              </p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-purple-600"
                                    style={{
                                      width: `${(group.usedQuota.records / group.quota.records) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm">
                                  {group.usedQuota.records.toLocaleString()}/
                                  {group.quota.records.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {group.dashboardAccess.length} Dashboard(s) Access
                            </Badge>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog("edit-group", group)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog("group-permissions", group)}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Dashboards Tab */}
          <TabsContent value="dashboards" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Dashboards</p>
                    <p className="text-2xl mt-1">{dashboards.length}</p>
                  </div>
                  <LayoutDashboard className="h-8 w-8 text-blue-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active</p>
                    <p className="text-2xl mt-1">
                      {dashboards.filter((d) => d.status === "active").length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Locked</p>
                    <p className="text-2xl mt-1">
                      {dashboards.filter((d) => d.status === "locked").length}
                    </p>
                  </div>
                  <Lock className="h-8 w-8 text-yellow-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Storage</p>
                    <p className="text-2xl mt-1">7.6 GB</p>
                  </div>
                  <Database className="h-8 w-8 text-purple-600" />
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex-1 relative mr-4">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      placeholder="Search dashboards..."
                      className="pl-10"
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={() => handleExport("Dashboards")}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
                
                {/* DASHBOARD TABLE */}
                <div className="border rounded-lg">
                  {loadingDashboards ? (
                    <div className="py-10 text-center text-gray-500">Loading dashboards...</div>
                  ) : filteredDashboards.length === 0 ? (
                    <div className="py-10 text-center text-gray-500">No dashboards found</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dashboard</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Tables</TableHead>
                          <TableHead>Records</TableHead>
                          <TableHead>Widgets</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Modified</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDashboards.map((dashboard) => (
                          <TableRow key={dashboard.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <LayoutDashboard className="h-5 w-5 text-gray-400" />
                                <div className="font-medium">{dashboard.name}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {dashboard.owner}
                            </TableCell>
                            <TableCell>{dashboard.tables}</TableCell>
                            <TableCell>{dashboard.records?.toLocaleString?.() || dashboard.records || 0}</TableCell>
                            <TableCell>{dashboard.widgets ?? 0}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(dashboard.status)}>
                                {dashboard.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {dashboard.lastModified}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDashboard(dashboard)}
                                  title="View tables"
                                >
                                  <FolderTree className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toast.success("Dashboard duplicated")}
                                  title="Duplicate"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    toast.success(
                                      dashboard.status === "locked"
                                        ? "Dashboard unlocked"
                                        : "Dashboard locked"
                                    )
                                  }
                                  title={dashboard.status === "locked" ? "Unlock" : "Lock"}
                                >
                                  {dashboard.status === "locked" ? (
                                    <Unlock className="h-4 w-4" />
                                  ) : (
                                    <Lock className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDialog("export-dashboard", dashboard)}
                                  title="Export Data"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Events</p>
                    <p className="text-2xl mt-1">{activityLogs.length}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Dashboard Views</p>
                    <p className="text-2xl mt-1">1,247</p>
                  </div>
                  <Eye className="h-8 w-8 text-green-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Alerts Today</p>
                    <p className="text-2xl mt-1">3</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Traffic Spike</p>
                    <p className="text-2xl mt-1">+45%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input placeholder="Search activity..." className="pl-10" />
                  </div>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="created">Created</SelectItem>
                      <SelectItem value="edited">Edited</SelectItem>
                      <SelectItem value="deleted">Deleted</SelectItem>
                      <SelectItem value="viewed">Viewed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>

                {loadingActivity ? (
                  <div className="py-10 text-center text-gray-500">Loading activity...</div>
                ) : activityLogs.length === 0 ? (
                  <div className="py-10 text-center text-gray-500">No activity logs</div>
                ) : (
                  <div className="space-y-3">
                    {activityLogs.map((log) => {
                      const action = (log.action || "").toLowerCase();
                      const tone =
                        action.includes("delete") || action === "alert"
                          ? "bg-red-100 text-red-600"
                          : action.includes("create")
                            ? "bg-green-100 text-green-600"
                            : action.includes("update")
                              ? "bg-blue-100 text-blue-600"
                              : "bg-gray-100 text-gray-600";
                      const [bgClass, textClass] = tone.split(" ");
                      return (
                        <Card key={log.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bgClass}`}>
                                <Activity className={`h-5 w-5 ${textClass}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{log.user}</span>
                                  <Badge variant="outline">{log.action}</Badge>
                                  {log.target && (
                                    <span className="text-sm text-gray-600">
                                      {log.target}
                                    </span>
                                  )}
                                </div>
                                {log.details && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {log.details}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  {log.timestamp}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <div className="p-6">
                <h3 className="text-lg mb-4">Notifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Input
                    placeholder="Title"
                    value={newNotifTitle}
                    onChange={(e) => setNewNotifTitle(e.target.value)}
                  />
                  <Input
                    placeholder="Message"
                    value={newNotifMessage}
                    onChange={(e) => setNewNotifMessage(e.target.value)}
                  />
                  <Select value={newNotifType} onValueChange={setNewNotifType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end mb-4">
                  <Button onClick={sendAdminNotification} disabled={loadingNotifications}>
                    Send Notification
                  </Button>
                </div>

                <div className="border rounded-lg">
                  {loadingNotifications ? (
                    <div className="py-6 text-center text-gray-500">Loading notifications...</div>
                  ) : adminNotifications.length === 0 ? (
                    <div className="py-6 text-center text-gray-500">No notifications</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminNotifications.map((n) => (
                          <TableRow key={n.id}>
                            <TableCell className="font-medium">{n.title}</TableCell>
                            <TableCell className="text-sm text-gray-600">{n.message}</TableCell>
                            <TableCell>
                              <Badge>{n.type}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {n.userName || "All"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {new Date(n.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Widgets Tab */}
          <TabsContent value="widgets" className="space-y-4">
            <Card>
              <div className="p-6">
                <h3 className="text-lg mb-4">Widget Management</h3>
                
                <div className="space-y-4">
                  {[
                    { id: 1, name: "Revenue Chart", dashboard: "Sales Dashboard", visible: true },
                    { id: 2, name: "User Analytics", dashboard: "Analytics Hub", visible: true },
                    { id: 3, name: "Traffic Report", dashboard: "Marketing", visible: false },
                  ].map((widget) => (
                    <Card key={widget.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <BarChart3 className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="font-medium">{widget.name}</div>
                            <div className="text-sm text-gray-600">
                              {widget.dashboard}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={widget.visible ? "default" : "outline"}>
                            {widget.visible ? "Visible" : "Hidden"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.success("Widget regenerated")}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Regenerate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog("edit-widget", widget)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Healthy Systems</p>
                    <p className="text-2xl mt-1">
                      {systemHealth.filter((s) => s.dbStatus === "connected").length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Warnings</p>
                    <p className="text-2xl mt-1">
                      {systemHealth.filter((s) => s.dbStatus === "slow").length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Critical Issues</p>
                    <p className="text-2xl mt-1">
                      {systemHealth.filter((s) => s.dbStatus === "error").length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <h3 className="text-lg mb-4">System Health by Organization</h3>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>DB Status</TableHead>
                        <TableHead>API Errors</TableHead>
                        <TableHead>Queue Status</TableHead>
                        <TableHead>Last Check</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systemHealth.map((health) => (
                        <TableRow key={health.id}>
                          <TableCell className="font-medium">
                            {health.organization}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(health.dbStatus)}>
                              {health.dbStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                health.apiErrors > 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }
                            >
                              {health.apiErrors}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(health.queueStatus)}>
                              {health.queueStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {health.lastCheck}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toast.success("Health check running...")}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Check Now
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDialog("health-details", health)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl mt-1">$24,580</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Subscriptions</p>
                    <p className="text-2xl mt-1">47</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-blue-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Near Limit</p>
                    <p className="text-2xl mt-1">5</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Overdue</p>
                    <p className="text-2xl mt-1">2</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <h3 className="text-lg mb-4">Usage & Billing Overview</h3>
                
                <div className="space-y-4">
                  {[
                    {
                      org: "Acme Corp",
                      plan: "Enterprise",
                      usage: { dashboards: 35, tables: 140, records: 75000 },
                      limit: { dashboards: 50, tables: 200, records: 100000 },
                      revenue: "$499/mo",
                      status: "active",
                    },
                    {
                      org: "TechStart Inc",
                      plan: "Pro",
                      usage: { dashboards: 18, tables: 65, records: 32000 },
                      limit: { dashboards: 20, tables: 80, records: 50000 },
                      revenue: "$99/mo",
                      status: "warning",
                    },
                  ].map((billing, idx) => (
                    <Card key={idx} className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="font-medium">{billing.org}</div>
                          <div className="text-sm text-gray-600">
                            Plan: {billing.plan} - {billing.revenue}
                          </div>
                        </div>
                        <Badge
                          className={
                            billing.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {billing.status === "active" ? "Active" : "Near Limit"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Dashboards</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600"
                                style={{
                                  width: `${(billing.usage.dashboards / billing.limit.dashboards) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm">
                              {billing.usage.dashboards}/{billing.limit.dashboards}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Tables</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-600"
                                style={{
                                  width: `${(billing.usage.tables / billing.limit.tables) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm">
                              {billing.usage.tables}/{billing.limit.tables}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Records</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-600"
                                style={{
                                  width: `${(billing.usage.records / billing.limit.records) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm">
                              {billing.usage.records.toLocaleString()}/
                              {billing.limit.records.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          View Invoice
                        </Button>
                        <Button variant="outline" size="sm">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Usage History
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Open Tickets</p>
                    <p className="text-2xl mt-1">12</p>
                  </div>
                  <LifeBuoy className="h-8 w-8 text-blue-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Resolved Today</p>
                    <p className="text-2xl mt-1">8</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Avg Response Time</p>
                    <p className="text-2xl mt-1">2.4h</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-600" />
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg">Support Tickets</h3>
                  <Button className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    New Ticket
                  </Button>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      id: "#1234",
                      customer: "Acme Corp",
                      subject: "Dashboard loading issue",
                      priority: "high",
                      status: "open",
                      created: "2024-12-20 09:00",
                    },
                    {
                      id: "#1233",
                      customer: "TechStart Inc",
                      subject: "Data export problem",
                      priority: "medium",
                      status: "in-progress",
                      created: "2024-12-20 08:30",
                    },
                    {
                      id: "#1232",
                      customer: "Global Systems",
                      subject: "User permissions question",
                      priority: "low",
                      status: "resolved",
                      created: "2024-12-19 16:00",
                    },
                  ].map((ticket) => (
                    <Card key={ticket.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{ticket.id}</span>
                            <Badge
                              variant={
                                ticket.priority === "high"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {ticket.priority}
                            </Badge>
                            <Badge
                              className={
                                ticket.status === "resolved"
                                  ? "bg-green-100 text-green-800"
                                  : ticket.status === "in-progress"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }
                            >
                              {ticket.status}
                            </Badge>
                          </div>
                          <div className="font-medium mb-1">{ticket.subject}</div>
                          <div className="text-sm text-gray-600">
                            {ticket.customer} • {ticket.created}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toast.success("Support email sent")
                            }
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog("ticket-logs", ticket)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Logs
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">Customer Notes</h4>
                  <Textarea
                    placeholder="Add internal notes about this customer..."
                    className="mb-3"
                  />
                  <Button size="sm">Save Note</Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogType === "user-details" && "User Details"}
              {dialogType === "login-history" && "Login History"}
              {dialogType === "edit-user" && "Edit User"}
              {dialogType === "dashboard-details" && "Dashboard Details"}
              {dialogType === "health-details" && "System Health Details"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "user-details" && "View detailed user information"}
              {dialogType === "login-history" && "Recent login activity"}
              {dialogType === "edit-user" && "Update user information"}
              {dialogType === "dashboard-details" && "Tables and fields configuration"}
              {dialogType === "health-details" && "Detailed system status"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {dialogType === "user-details" && selectedItem && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg">
                      {selectedItem.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg">{selectedItem.name}</h3>
                    <p className="text-sm text-gray-600">{selectedItem.email}</p>
                  </div>
                </div>
                
                {/* USER DETAIL DIALOG */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">Role</Label>
                    <p>{selectedItem.role}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Status</Label>
                    <p>{selectedItem.status}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Owner</Label>
                    <p>{selectedItem.owner || "Unassigned"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Team</Label>
                    <p>{selectedItem.team || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Dashboards</Label>
                    <p>{selectedItem.dashboards}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Storage</Label>
                    <p>{selectedItem.storage}</p>
                  </div>
                </div>
              </div>
            )}

            {dialogType === "login-history" && selectedItem && (
              <div className="space-y-3">
                {selectedItem.loginHistory?.map((login: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{login.date}</p>
                        <p className="text-sm text-gray-600">{login.device}</p>
                      </div>
                      <Badge variant="outline">{login.ip}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dialogType === "dashboard-details" && selectedItem && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-600">Dashboard Name</Label>
                  <p className="font-medium">{selectedItem.name}</p>
                </div>
                {selectedItem.ownerName && (
                  <div>
                    <Label className="text-sm text-gray-600">Owner</Label>
                    <p>{selectedItem.ownerName}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm text-gray-600 mb-2 block">
                    Tables ({selectedItem.tableCount || selectedItem.tables?.length || 0})
                  </Label>
                  <div className="space-y-2">
                    {(selectedItem.tables || []).map((table: any) => (
                      <div key={table.key || table.name} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{table.name || table.key}</span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {table.fields?.length || 0} fields
                            </p>
                          </div>
                          {Array.isArray(table.sampleRows) && table.sampleRows.length > 0 && (
                            <Badge variant="outline">Sample rows</Badge>
                          )}
                        </div>
                        {Array.isArray(table.fields) && table.fields.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {table.fields.map((f: any) => (
                              <Badge key={f.key || f.name} variant="secondary" className="text-xs">
                                {f.name || f.key} • {f.type}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {dialogType === "edit-user" && formUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formUser.name}
                    onChange={(e) => setFormUser({ ...formUser, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formUser.email}
                    onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
                    placeholder="user@example.com"
                    disabled={!!formUser.id}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={formUser.role}
                      onValueChange={(val) => setFormUser({ ...formUser, role: val as User["role"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formUser.status}
                      onValueChange={(val) =>
                        setFormUser({ ...formUser, status: val as User["status"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Company / Team</Label>
                  <Input
                    value={formUser.team || ""}
                    onChange={(e) => setFormUser({ ...formUser, team: e.target.value })}
                    placeholder="Company or team"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); setFormUser(null); }}>
              Close
            </Button>
            {dialogType === "edit-user" && (
              <Button onClick={handleSaveUser} disabled={savingUser}>
                {savingUser ? "Saving..." : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
