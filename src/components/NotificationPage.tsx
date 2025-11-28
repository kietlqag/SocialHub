import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Bell,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  Users,
  Package,
  Calendar,
  MessageSquare,
  Settings as SettingsIcon,
  Search,
  CheckCheck,
  Trash2,
  Mail,
  MailOpen,
  Archive,
  Star,
  Clock,
} from "lucide-react";
import { toast } from "sonner@2.0.3";

type NotificationType = "info" | "success" | "warning" | "alert";

interface NotificationItem {
  id: string;
  type: NotificationType;
  category?: string;
  title: string;
  message: string;
  time?: string; // human readable
  timestamp: string; // iso string
  read: boolean;
  starred?: boolean;
}

export function NotificationPage({ onBack }: { onBack?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    api
      .get<{ data: any[] }>("/notifications")
      .then((res) => {
        const rows = res?.data || [];
        // Map server rows to the UI-friendly structure
        const mapped = rows.map((r: any) => ({
          id: r.id,
          type: r.type || "info",
          category: r.category || "updates",
          title: r.title || r.message || "Notification",
          message: r.message || r.body || "",
          time: r.time || new Date(r.created_at || r.updated_at || Date.now()).toLocaleString(),
          timestamp: r.created_at || r.updated_at || new Date().toISOString(),
          read: !!r.read,
          starred: !!r.starred,
        })) as NotificationItem[];
        setNotifications(mapped);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Failed to fetch notifications");
      })
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const starredCount = useMemo(() => notifications.filter((n) => !!n.starred).length, [notifications]);

  // Local helper: update a notification in state
  const updateLocal = (id: string, patch: Partial<NotificationItem>) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  // Actions
  const markAsRead = async (id: string) => {
    updateLocal(id, { read: true });
    try {
      await api.patch(`/notifications/${id}`, { read: true });
      toast.success("Marked as read");
    } catch (err) {
      console.error(err);
      toast.error("Could not mark read");
    }
  };

  const markAsUnread = async (id: string) => {
    updateLocal(id, { read: false });
    try {
      await api.patch(`/notifications/${id}`, { read: false });
      toast.success("Marked as unread");
    } catch (err) {
      console.error(err);
      toast.error("Could not mark unread");
    }
  };

  const toggleStar = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;
    updateLocal(id, { starred: !target.starred });
    // If backend supports starred, can call patch here. For now we optimistically update.
  };

  const markAllAsRead = async () => {
    const toMark = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!toMark.length) return toast.info("No unread notifications");
    // Optimistic UI
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await Promise.all(toMark.map((id) => api.patch(`/notifications/${id}`, { read: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error(err);
      toast.error("Some notifications failed to mark read");
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/notifications/${id}`);
      toast.success("Notification deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete notification");
    }
  };

  const archiveNotification = async (id: string) => {
    // Archive isn't supported by API by default (if so, adjust accordingly)
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notification archived");
  };

  // Bulk actions
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedNotifications(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) setSelectedNotifications(new Set());
    else setSelectedNotifications(new Set(filteredNotifications.map((n) => n.id)));
  };

  const bulkMarkAsRead = async () => {
    const ids = Array.from(selectedNotifications);
    if (!ids.length) return;
    setNotifications((prev) => prev.map((n) => (selectedNotifications.has(n.id) ? { ...n, read: true } : n)));
    setSelectedNotifications(new Set());
    try {
      await Promise.all(ids.map((id) => api.patch(`/notifications/${id}`, { read: true })));
      toast.success(`${ids.length} notifications marked as read`);
    } catch (err) {
      console.error(err);
      toast.error("Bulk update failed");
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedNotifications);
    if (!ids.length) return;
    setNotifications((prev) => prev.filter((n) => !selectedNotifications.has(n.id)));
    setSelectedNotifications(new Set());
    try {
      await Promise.all(ids.map((id) => api.delete(`/notifications/${id}`)));
      toast.success(`${ids.length} notifications deleted`);
    } catch (err) {
      console.error(err);
      toast.error("Bulk delete failed");
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "bg-green-100 text-green-600";
      case "warning":
        return "bg-yellow-100 text-yellow-600";
      case "alert":
        return "bg-red-100 text-red-600";
      default:
        return "bg-blue-100 text-blue-600";
    }
  };

  const getCategoryBadgeColor = (category: string | undefined) => {
    switch (category) {
      case "orders":
        return "bg-purple-100 text-purple-700";
      case "updates":
        return "bg-blue-100 text-blue-700";
      case "team":
        return "bg-green-100 text-green-700";
      case "alerts":
        return "bg-red-100 text-red-700";
      case "messages":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Derived list for UI
  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];

    if (selectedTab === "unread") filtered = filtered.filter((n) => !n.read);
    else if (selectedTab === "starred") filtered = filtered.filter((n) => !!n.starred);
    else if (selectedTab !== "all") filtered = filtered.filter((n) => n.category === selectedTab);

    if (searchQuery) {
      filtered = filtered.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.message.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (sortBy === "newest") filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    else if (sortBy === "oldest") filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    else if (sortBy === "unread") filtered.sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1));

    return filtered;
  }, [notifications, searchQuery, selectedTab, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bell className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl text-gray-900">Notifications</h1>
                <p className="text-sm text-gray-600">{unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button onClick={markAllAsRead} variant="outline" size="sm">
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark all as read
                </Button>
              )}
              <Button variant="outline" size="sm">
                <SettingsIcon className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Filters and Search */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input type="text" placeholder="Search notifications..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <Clock className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="unread">Unread first</SelectItem>
                </SelectContent>
              </Select>
              {selectedNotifications.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">{selectedNotifications.size} selected</Badge>
                  <Button variant="outline" size="sm" onClick={bulkMarkAsRead}>
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={bulkDelete} className="text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              All
              <Badge className="ml-2 bg-gray-200 text-gray-700">{notifications.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && <Badge className="ml-2 bg-red-500 text-white">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="starred">
              Starred
              {starredCount > 0 && <Badge className="ml-2 bg-yellow-500 text-white">{starredCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-0">
            {/* Notifications List */}
            <div className="space-y-3">
              {filteredNotifications.length === 0 ? (
                <Card className="p-12">
                  <div className="text-center">
                    <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-gray-900 mb-2">No notifications</h3>
                    <p className="text-sm text-gray-600">{searchQuery ? "No notifications match your search" : "You're all caught up!"}</p>
                  </div>
                </Card>
              ) : (
                <>
                  {/* Select All */}
                  {filteredNotifications.length > 0 && (
                    <Card className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={selectedNotifications.size === filteredNotifications.length && filteredNotifications.length > 0} onCheckedChange={toggleSelectAll} />
                        <span className="text-sm text-gray-600">Select all ({filteredNotifications.length})</span>
                      </div>
                    </Card>
                  )}

                  {/* Notification Cards */}
                  {filteredNotifications.map((notification) => {
                    return (
                      <Card key={notification.id} className={`p-4 transition-all hover:shadow-md ${!notification.read ? "bg-blue-50/50 border-blue-200" : ""} ${selectedNotifications.has(notification.id) ? "ring-2 ring-primary" : ""}`}>
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <Checkbox checked={selectedNotifications.has(notification.id)} onCheckedChange={() => toggleSelection(notification.id)} />

                          {/* Icon */}
                          <div className={`p-3 rounded-lg flex-shrink-0 ${getNotificationColor(notification.type)}`}>
                            {/* simple icon mapping */}
                            {notification.type === "success" ? <Package className="w-5 h-5" /> : notification.type === "alert" ? <AlertCircle className="w-5 h-5" /> : notification.type === "warning" ? <Calendar className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-gray-900">{notification.title}</h3>
                                  {!notification.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={getCategoryBadgeColor(notification.category)}>{notification.category}</Badge>
                                  <span className="text-xs text-gray-500">{notification.time}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStar(notification.id)}>
                              <Star className={`w-4 h-4 ${notification.starred ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                            </Button>
                            {notification.read ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markAsUnread(notification.id)} title="Mark as unread">
                                <MailOpen className="w-4 h-4 text-gray-600" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markAsRead(notification.id)} title="Mark as read">
                                <Mail className="w-4 h-4 text-blue-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => archiveNotification(notification.id)} title="Archive">
                              <Archive className="w-4 h-4 text-gray-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600" onClick={() => deleteNotification(notification.id)} title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Stats Footer */}
        {filteredNotifications.length > 0 && (
          <Card className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
            <div className="text-center">
              <p className="text-sm text-gray-700">Showing {filteredNotifications.length} of {notifications.length} notifications</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
