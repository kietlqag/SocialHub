import { useState } from "react";
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
import {
  ArrowLeft,
  Shield,
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Mail,
  Calendar,
  Activity,
  TrendingUp,
  UserCheck,
  UserX,
  Settings,
  Lock,
  Unlock,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "manager" | "viewer";
  status: "active" | "inactive" | "suspended" | "pending";
  plan: "free" | "starter" | "pro" | "enterprise";
  joinDate: string;
  lastActive: string;
  dashboards: number;
  storage: string;
  avatar: string;
}

interface AdminPageProps {
  onBack?: () => void;
}

export function AdminPage({ onBack }: AdminPageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      role: "admin",
      status: "active",
      plan: "enterprise",
      joinDate: "2024-01-15",
      lastActive: "2 mins ago",
      dashboards: 12,
      storage: "4.2 GB",
      avatar: "SJ",
    },
    {
      id: "2",
      name: "Michael Chen",
      email: "michael.chen@example.com",
      role: "manager",
      status: "active",
      plan: "pro",
      joinDate: "2024-02-20",
      lastActive: "15 mins ago",
      dashboards: 8,
      storage: "2.8 GB",
      avatar: "MC",
    },
    {
      id: "3",
      name: "Emma Williams",
      email: "emma.williams@example.com",
      role: "user",
      status: "active",
      plan: "starter",
      joinDate: "2024-03-10",
      lastActive: "1 hour ago",
      dashboards: 5,
      storage: "1.5 GB",
      avatar: "EW",
    },
    {
      id: "4",
      name: "James Anderson",
      email: "james.anderson@example.com",
      role: "user",
      status: "inactive",
      plan: "pro",
      joinDate: "2024-01-25",
      lastActive: "3 days ago",
      dashboards: 15,
      storage: "5.7 GB",
      avatar: "JA",
    },
    {
      id: "5",
      name: "Olivia Martinez",
      email: "olivia.martinez@example.com",
      role: "viewer",
      status: "active",
      plan: "free",
      joinDate: "2024-04-05",
      lastActive: "30 mins ago",
      dashboards: 2,
      storage: "0.5 GB",
      avatar: "OM",
    },
    {
      id: "6",
      name: "David Brown",
      email: "david.brown@example.com",
      role: "manager",
      status: "suspended",
      plan: "pro",
      joinDate: "2023-12-10",
      lastActive: "1 week ago",
      dashboards: 20,
      storage: "8.3 GB",
      avatar: "DB",
    },
    {
      id: "7",
      name: "Sophia Taylor",
      email: "sophia.taylor@example.com",
      role: "user",
      status: "pending",
      plan: "starter",
      joinDate: "2024-12-15",
      lastActive: "Never",
      dashboards: 0,
      storage: "0 GB",
      avatar: "ST",
    },
    {
      id: "8",
      name: "Robert Wilson",
      email: "robert.wilson@example.com",
      role: "user",
      status: "active",
      plan: "enterprise",
      joinDate: "2024-02-01",
      lastActive: "5 mins ago",
      dashboards: 18,
      storage: "6.9 GB",
      avatar: "RW",
    },
    {
      id: "9",
      name: "Isabella Davis",
      email: "isabella.davis@example.com",
      role: "admin",
      status: "active",
      plan: "enterprise",
      joinDate: "2023-11-20",
      lastActive: "10 mins ago",
      dashboards: 25,
      storage: "12.1 GB",
      avatar: "ID",
    },
    {
      id: "10",
      name: "William Garcia",
      email: "william.garcia@example.com",
      role: "user",
      status: "active",
      plan: "pro",
      joinDate: "2024-03-15",
      lastActive: "2 hours ago",
      dashboards: 9,
      storage: "3.4 GB",
      avatar: "WG",
    },
  ]);

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "manager":
        return "bg-blue-100 text-blue-800";
      case "user":
        return "bg-indigo-100 text-indigo-800";
      case "viewer":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return "bg-amber-100 text-amber-800";
      case "pro":
        return "bg-violet-100 text-violet-800";
      case "starter":
        return "bg-emerald-100 text-emerald-800";
      case "free":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      selectedTab === "all" ||
      (selectedTab === "active" && user.status === "active") ||
      (selectedTab === "inactive" && user.status === "inactive") ||
      (selectedTab === "suspended" && user.status === "suspended") ||
      (selectedTab === "pending" && user.status === "pending") ||
      (selectedTab === "admins" && user.role === "admin");

    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;

    return matchesSearch && matchesTab && matchesRole && matchesStatus;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
      case "oldest":
        return new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime();
      case "name":
        return a.name.localeCompare(b.name);
      case "lastActive":
        return a.lastActive.localeCompare(b.lastActive);
      default:
        return 0;
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(sortedUsers.map((u) => u.id)));
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

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setIsUserDetailOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser({ ...user });
    setIsEditUserOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (selectedUser) {
      setUsers(users.filter((u) => u.id !== selectedUser.id));
      toast.success(`User ${selectedUser.name} has been deleted`);
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleUpdateUserStatus = (userId: string, newStatus: User["status"]) => {
    setUsers(
      users.map((u) =>
        u.id === userId ? { ...u, status: newStatus } : u
      )
    );
    const statusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    toast.success(`User status updated to ${statusText}`);
  };

  const handleBulkAction = (action: string) => {
    const selectedCount = selectedUsers.size;
    switch (action) {
      case "activate":
        setUsers(
          users.map((u) =>
            selectedUsers.has(u.id) ? { ...u, status: "active" } : u
          )
        );
        toast.success(`${selectedCount} user(s) activated`);
        break;
      case "suspend":
        setUsers(
          users.map((u) =>
            selectedUsers.has(u.id) ? { ...u, status: "suspended" } : u
          )
        );
        toast.success(`${selectedCount} user(s) suspended`);
        break;
      case "delete":
        setUsers(users.filter((u) => !selectedUsers.has(u.id)));
        toast.success(`${selectedCount} user(s) deleted`);
        break;
    }
    setSelectedUsers(new Set());
  };

  const handleSaveEdit = () => {
    if (editingUser) {
      setUsers(
        users.map((u) => (u.id === editingUser.id ? editingUser : u))
      );
      toast.success("User updated successfully");
      setIsEditUserOpen(false);
      setEditingUser(null);
    }
  };

  const handleExportUsers = () => {
    toast.success("Users exported successfully");
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const suspendedUsers = users.filter((u) => u.status === "suspended").length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;

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
                    Manage users, roles, and permissions
                  </p>
                </div>
              </div>
            </div>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl mt-1">{totalUsers}</p>
                <p className="text-xs text-green-600 mt-1">+12% from last month</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-2xl mt-1">{activeUsers}</p>
                <p className="text-xs text-green-600 mt-1">
                  {((activeUsers / totalUsers) * 100).toFixed(0)}% of total
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Suspended</p>
                <p className="text-2xl mt-1">{suspendedUsers}</p>
                <p className="text-xs text-red-600 mt-1">Requires attention</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Ban className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-2xl mt-1">{pendingUsers}</p>
                <p className="text-xs text-yellow-600 mt-1">Awaiting review</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <div className="p-6">
            {/* Filters and Search */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="lastActive">Last Active</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={handleExportUsers}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6">
              <TabsList>
                <TabsTrigger value="all">
                  All ({users.length})
                </TabsTrigger>
                <TabsTrigger value="active">
                  Active ({users.filter((u) => u.status === "active").length})
                </TabsTrigger>
                <TabsTrigger value="inactive">
                  Inactive ({users.filter((u) => u.status === "inactive").length})
                </TabsTrigger>
                <TabsTrigger value="suspended">
                  Suspended ({users.filter((u) => u.status === "suspended").length})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({users.filter((u) => u.status === "pending").length})
                </TabsTrigger>
                <TabsTrigger value="admins">
                  Admins ({users.filter((u) => u.role === "admin").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Bulk Actions */}
            {selectedUsers.size > 0 && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
                <span className="text-sm">
                  {selectedUsers.size} user(s) selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("activate")}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Activate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("suspend")}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Suspend
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("delete")}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            )}

            {/* Users Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.size === sortedUsers.length && sortedUsers.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Dashboards</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedUsers.map((user) => (
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
                              <div className="text-sm text-gray-500">{user.email}</div>
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
                        <TableCell>
                          <Badge className={getPlanColor(user.plan)}>
                            {user.plan}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.dashboards}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {user.lastActive}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(user.joinDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewUser(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {user.status === "active" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUpdateUserStatus(user.id, "suspended")}
                              >
                                <Ban className="h-4 w-4 text-red-600" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUpdateUserStatus(user.id, "active")}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(user)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Info */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {sortedUsers.length} of {totalUsers} users
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={isUserDetailOpen} onOpenChange={setIsUserDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View detailed information about this user
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">{selectedUser.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl mb-1">{selectedUser.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{selectedUser.email}</p>
                  <div className="flex gap-2">
                    <Badge className={getRoleColor(selectedUser.role)}>
                      {selectedUser.role}
                    </Badge>
                    <Badge className={getStatusColor(selectedUser.status)}>
                      {selectedUser.status}
                    </Badge>
                    <Badge className={getPlanColor(selectedUser.plan)}>
                      {selectedUser.plan}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <LayoutDashboard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Dashboards</p>
                      <p className="text-xl">{selectedUser.dashboards}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Activity className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Storage Used</p>
                      <p className="text-xl">{selectedUser.storage}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Joined:</span>
                  <span>{new Date(selectedUser.joinDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Activity className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Last Active:</span>
                  <span>{selectedUser.lastActive}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Email:</span>
                  <span>{selectedUser.email}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-3">Recent Activity</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">Created new dashboard</span>
                    <span className="text-gray-400">2 hours ago</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">Updated profile settings</span>
                    <span className="text-gray-400">1 day ago</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">Exported data</span>
                    <span className="text-gray-400">3 days ago</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDetailOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              if (selectedUser) {
                handleEditUser(selectedUser);
                setIsUserDetailOpen(false);
              }
            }}>
              Edit User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editingUser.name}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value: User["role"]) =>
                    setEditingUser({ ...editingUser, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={editingUser.status}
                  onValueChange={(value: User["status"]) =>
                    setEditingUser({ ...editingUser, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <Select
                  value={editingUser.plan}
                  onValueChange={(value: User["plan"]) =>
                    setEditingUser({ ...editingUser, plan: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{selectedUser.avatar}</AvatarFallback>
                </Avatar>
                <div>
                  <p>{selectedUser.name}</p>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}