import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { getCurrentSession } from "../services/auth";
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
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import "../styles/notifications.css";

type NotificationType = "info" | "success" | "warning" | "alert";

interface NotificationItem {
  id: string;
  type: NotificationType;
  category?: string;
  title: string;
  message: string;
  time?: string;
  timestamp: string;
  read: boolean;
  starred?: boolean;
}

export function NotificationPage({ onBack }: { onBack?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [processing, setProcessing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newType, setNewType] = useState<NotificationType>("info");

  useEffect(() => {
    setLoading(true);
    const session = getCurrentSession();
    const token = session?.token || null;
    api
      .get<{ notifications: any[] }>("/admin/notifications", token || undefined)
      .then((res) => {
        const rows = res?.notifications || [];
        const mapped = rows.map((r: any) => ({
          id: r.id,
          type: (r.type || "info") as NotificationType,
          category: r.metadata?.category || r.category || "updates",
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

  const updateLocal = (id: string, patch: Partial<NotificationItem>) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const markAsRead = async (id: string) => {
    const session = getCurrentSession();
    const token = session?.token || undefined;
    updateLocal(id, { read: true });
    try {
      await api.patch(`/admin/notifications/${id}`, { read: true }, token);
      toast.success("Marked as read");
    } catch (err) {
      console.error(err);
      toast.error("Could not mark read");
    }
  };

  const markAllAsRead = async () => {
    const session = getCurrentSession();
    const token = session?.token || undefined;
    if (!token) {
      toast.error("Please sign in");
      return;
    }
    setProcessing(true);
    try {
      await Promise.all(
        notifications.filter((n) => !n.read).map((n) => api.patch(`/admin/notifications/${n.id}`, { read: true }, token))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setSelectedNotifications(new Set());
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark all as read");
    } finally {
      setProcessing(false);
    }
  };

  const deleteNotification = async (id: string) => {
    const session = getCurrentSession();
    const token = session?.token || undefined;
    updateLocal(id, {}); // optimistic removal below
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/admin/notifications/${id}`, token);
      toast.success("Notification deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete notification");
    }
  };

  const deleteSelected = async () => {
    const session = getCurrentSession();
    const token = session?.token || undefined;
    if (!selectedNotifications.size) return;
    setProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedNotifications).map((id) => api.delete(`/admin/notifications/${id}`, token))
      );
      setNotifications((prev) => prev.filter((n) => !selectedNotifications.has(n.id)));
      setSelectedNotifications(new Set());
      toast.success("Deleted selected notifications");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete selected");
    } finally {
      setProcessing(false);
    }
  };

  const createNotification = async () => {
    const session = getCurrentSession();
    const token = session?.token || undefined;
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post<{ notification: any }>(
        "/admin/notifications",
        {
          title: newTitle,
          message: newMessage,
          type: newType,
          read: false,
        },
        token
      );
      const n = res.notification;
      const mapped: NotificationItem = {
        id: n.id,
        type: (n.type || "info") as NotificationType,
        category: n.metadata?.category || "updates",
        title: n.title || "Notification",
        message: n.message || "",
        time: new Date(n.created_at || Date.now()).toLocaleString(),
        timestamp: n.created_at || new Date().toISOString(),
        read: !!n.read,
        starred: false,
      };
      setNotifications((prev) => [mapped, ...prev]);
      setNewTitle("");
      setNewMessage("");
      setNewType("info");
      toast.success("Notification created");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create notification");
    } finally {
      setProcessing(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];
    if (selectedTab === "unread") filtered = filtered.filter((n) => !n.read);
    else if (selectedTab === "starred") filtered = filtered.filter((n) => !!n.starred);
    else if (selectedTab !== "all") filtered = filtered.filter((n) => n.category === selectedTab);

    if (searchQuery) filtered = filtered.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.message.toLowerCase().includes(searchQuery.toLowerCase()));

    if (sortBy === "newest") filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    else if (sortBy === "oldest") filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    else if (sortBy === "unread") filtered.sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1));

    return filtered;
  }, [notifications, searchQuery, selectedTab, sortBy]);

  return (
    <div className="notificationsPage">
      <div className="notificationsBg" />
      <div className="notificationsContainer">
            <div className="notificationsHeader">
              <div className="headerLeft">
                <div className="headerIcon">
                  <Bell className="w-6 h-6" />
                </div>
            <div>
              <h1 className="headerTitle">Notifications</h1>
              <p className="headerSubtitle">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            </div>
            <Badge className="headerBadge">{notifications.length}</Badge>
          </div>
              <div className="headerActions">
                {unreadCount > 0 && (
                  <Button onClick={markAllAsRead} variant="outline" size="sm" className="ghostBtn" disabled={processing}>
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Mark all as read
                  </Button>
                )}
                <Button variant="default" size="sm" className="ghostBtn" onClick={createNotification} disabled={processing}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Send Test
                </Button>
                <Button variant="outline" size="sm" className="ghostBtn">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
        </div>

              <div className="notificationsCard filtersCard">
                <div className="filtersRow">
                  <div className="searchBox">
                    <Search className="searchIcon" />
                    <Input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="searchInput"
              />
            </div>
                <div className="sortBox">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="sortTrigger">
                      <Clock className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                      <SelectItem value="unread">Unread first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedNotifications.size > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={processing}>
                      <Check className="w-4 h-4 mr-2" /> Mark selected read
                    </Button>
                    <Button variant="outline" size="sm" onClick={deleteSelected} disabled={processing}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete selected
                    </Button>
                  </div>
                )}
              </div>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="pillTabs">
              <TabsTrigger value="all">
                All
                <Badge className="pillBadge">{notifications.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="unread">
                Unread
                {unreadCount > 0 && <Badge className="pillBadge accent">{unreadCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="starred">
                Starred
                {starredCount > 0 && <Badge className="pillBadge warning">{starredCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="updates">Updates</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="notificationsCard">
          {filteredNotifications.length === 0 ? (
            <div className="emptyState">
              <Bell className="emptyIcon" />
              <h3>No notifications</h3>
              <p>{searchQuery ? "No notifications match your search" : "You're all caught up!"}</p>
            </div>
          ) : (
            <div className="notificationsList">
              {filteredNotifications.length > 0 && (
                <div className="selectAllRow">
                  <Checkbox
                    checked={selectedNotifications.size === filteredNotifications.length && filteredNotifications.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedNotifications(new Set(filteredNotifications.map((n) => n.id)));
                      } else {
                        setSelectedNotifications(new Set());
                      }
                    }}
                  />
                  <span className="selectAllText">Select all ({filteredNotifications.length})</span>
                </div>
              )}

              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notificationCard ${!notification.read ? "notificationUnread" : ""}`}
                >
                  <div className="notificationLeft">
                    <Checkbox checked={selectedNotifications.has(notification.id)} onCheckedChange={(checked) => {
                      const next = new Set(selectedNotifications);
                      if (checked) next.add(notification.id);
                      else next.delete(notification.id);
                      setSelectedNotifications(next);
                    }} />
                    <div
                      className={`iconCircle ${
                        notification.type === "success"
                          ? "iconSuccess"
                          : notification.type === "alert"
                            ? "iconAlert"
                            : notification.type === "warning"
                              ? "iconWarning"
                              : "iconInfo"
                      }`}
                    >
                      {notification.type === "success" ? (
                        <Package className="w-5 h-5" />
                      ) : notification.type === "alert" ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : notification.type === "warning" ? (
                        <Calendar className="w-5 h-5" />
                      ) : (
                        <MessageSquare className="w-5 h-5" />
                      )}
                    </div>
                    <div className="notificationBody">
                      <div className="notificationTitleRow">
                        <h3>{notification.title}</h3>
                        {!notification.read && <span className="unreadDot" />}
                      </div>
                      <p className="notificationMessage">{notification.message}</p>
                      <div className="notificationMeta">
                        <Badge className="metaBadge">{notification.category}</Badge>
                        <span className="notificationTime">{notification.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="notificationActions">
                    <Button variant="ghost" size="icon" className="actionBtn" onClick={() => {}}>
                      <Star className="w-4 h-4" />
                    </Button>
                    {notification.read ? (
                      <Button variant="ghost" size="icon" className="actionBtn" onClick={() => {}} title="Mark as unread">
                        <MailOpen className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="actionBtn"
                        onClick={() => markAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <Mail className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="text"
                      placeholder="New notification title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-48"
                    />
                    <Input
                      type="text"
                      placeholder="Message"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="w-64"
                    />
                    <Select value={newType} onValueChange={(v) => setNewType(v as NotificationType)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="alert">Alert</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={createNotification} disabled={processing}>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="footerActions">
            <Button variant="ghost" size="sm" className="ghostBtn">
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
            <Button variant="outline" size="sm" className="dangerOutline">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
