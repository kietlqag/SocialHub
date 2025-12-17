import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
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
        const mapped = rows.map((r: any) => ({ id: r.id, type: r.type || "info", category: r.category || "updates", title: r.title || r.message || "Notification", message: r.message || r.body || "", time: r.time || new Date(r.created_at || r.updated_at || Date.now()).toLocaleString(), timestamp: r.created_at || r.updated_at || new Date().toISOString(), read: !!r.read, starred: !!r.starred })) as NotificationItem[];
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
    updateLocal(id, { read: true });
    try {
      await api.patch(`/notifications/${id}`, { read: true });
      toast.success("Marked as read");
    } catch (err) {
      console.error(err);
      toast.error("Could not mark read");
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
              <Button onClick={() => {}} variant="outline" size="sm" className="ghostBtn">
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all as read
              </Button>
            )}
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
                    onCheckedChange={() => {}}
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
                    <Checkbox checked={false} onCheckedChange={() => {}} />
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


