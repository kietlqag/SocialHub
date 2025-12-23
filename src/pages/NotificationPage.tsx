import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { clearSession, getCurrentSession } from "../services/auth";
import { Header } from "../components/Header";
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
  metadata?: Record<string, any>;
}

export function NotificationPage({ onBack }: { onBack?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"all" | "unread" | "starred">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "unread">("newest");
  const [counts, setCounts] = useState<{ all: number; unread: number; starred: number }>({ all: 0, unread: 0, starred: 0 });
  const [total, setTotal] = useState(0);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [savingPref, setSavingPref] = useState(false);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadedRef = useRef(false);
  const lastToastRef = useRef(0);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const fetchPrefs = useCallback(async () => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) return;
    try {
      const res = await api.get<{ popupEnabled: boolean }>("/api/notifications/preferences", token);
      setPopupEnabled(res?.popupEnabled !== false);
    } catch (err) {
      console.warn("[NotificationPage] Failed to load notification prefs", err);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const fetchNotifications = useCallback(async () => {
    const session = getCurrentSession();
    const token = session?.token;
    const currentUserId = session?.user?.id;
    if (!token || !currentUserId) {
      console.warn("[NotificationPage] Missing auth session; skip loading notifications");
      setNotifications([]);
      setCounts({ all: 0, unread: 0, starred: 0 });
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab: selectedTab,
        category: "all",
        sort: sortBy,
        limit: "50",
        offset: "0",
      });
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await api.get<{ items: any[]; total: number; counts: { all: number; unread: number; starred: number } }>(
        `/api/notifications?${params.toString()}`,
        token,
      );
      const rows = res?.items || [];
      const filtered = rows.filter((r: any) => {
        const matches = !r.user_id || String(r.user_id) === String(currentUserId);
        if (!matches) console.warn("[NotificationPage] Dropped notification for different user", { notificationUser: r.user_id, currentUserId });
        return matches;
      });
      const mapped = filtered.map((r: any) => {
        const isRead = typeof r.read !== "undefined" ? r.read : typeof r.is_read !== "undefined" ? r.is_read : false;
        const isStarred = typeof r.starred !== "undefined" ? r.starred : r.is_starred;
        return {
          id: r.id,
          type: r.type || "info",
          category: "",
          title: r.title || r.message || "Notification",
          message: r.message || r.body || "",
          time: r.time || new Date(r.created_at || r.updated_at || Date.now()).toLocaleString(),
          timestamp: r.created_at || r.updated_at || new Date().toISOString(),
          read: !!isRead,
          starred: !!isStarred,
          metadata: r.metadata || {},
        } as NotificationItem;
      });
      setNotifications(mapped);
      setSelectedNotifications(new Set());
      setTotal(res?.total ?? mapped.length);
      if (res?.counts) setCounts(res.counts);

      const seen = seenIdsRef.current;
      if (!initialLoadedRef.current) {
        mapped.forEach((n) => seen.add(n.id));
        initialLoadedRef.current = true;
        return;
      }
      const newOnes = mapped.filter((n) => !seen.has(n.id));
      newOnes.forEach((n) => seen.add(n.id));
      if (popupEnabled && newOnes.length) {
        const now = Date.now();
        if (now - lastToastRef.current > 2000) {
          lastToastRef.current = now;
          if (newOnes.length > 3) {
            toast(`${newOnes.length} new notifications`, { description: newOnes[0].title || "You have new notifications" });
          } else {
            newOnes.slice(0, 3).forEach((n) => {
              toast(n.title || "New notification", { description: n.message || "" });
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  }, [selectedTab, sortBy, debouncedQuery]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(() => counts.unread, [counts]);
  const starredCount = useMemo(() => counts.starred, [counts]);

  const updateLocal = (id: string, patch: Partial<NotificationItem>) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const markAsRead = async (id: string) => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    updateLocal(id, { read: true });
    try {
      await api.patch(`/api/notifications/${id}`, { read: true }, token);
      fetchNotifications();
      toast.success("Marked as read");
    } catch (err) {
      console.error(err);
      toast.error("Could not mark read");
    }
  };

  const markAsUnread = async (id: string) => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    updateLocal(id, { read: false });
    try {
      await api.patch(`/api/notifications/${id}`, { read: false }, token);
      fetchNotifications();
      toast.success("Marked as unread");
    } catch (err) {
      console.error(err);
      toast.error("Could not mark unread");
    }
  };

  const toggleStar = async (id: string, next: boolean) => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    updateLocal(id, { starred: next });
    try {
      await api.patch(`/api/notifications/${id}`, { is_starred: next, starred: next }, token);
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error("Could not update star");
    }
  };

  const markManyAsRead = async (ids: string[]) => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    try {
      await Promise.all(ids.map((id) => api.patch(`/api/notifications/${id}`, { read: true }, token)));
      fetchNotifications();
      toast.success("Marked as read");
    } catch (err) {
      console.error(err);
      toast.error("Could not mark selected as read");
    }
  };

  const deleteMany = async (ids: string[]) => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    try {
      await Promise.all(ids.map((id) => api.delete(`/api/notifications/${id}`, token)));
      setSelectedNotifications(new Set());
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error("Could not delete selected");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedNotifications(new Set());
      return;
    }
    setSelectedNotifications(new Set(filteredNotifications.map((n) => n.id)));
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedNotifications((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    const meta = notification.metadata || {};
    const dashboardId = meta.dashboardId || meta.dashboard_id;
    if (dashboardId) {
      navigate(`/managedash/${dashboardId}`);
    }
  };

  const filteredNotifications = useMemo(() => {
    // Server already filters by tab/category/sort/q; return as-is for rendering
    return notifications;
  }, [notifications]);

  const handleMarkAllRead = () => {
    const targets = filteredNotifications.filter((n) => !n.read).map((n) => n.id);
    if (targets.length) {
      markManyAsRead(targets);
    }
  };

  const handleTogglePopup = async () => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    const next = !popupEnabled;
    const prev = popupEnabled;
    setPopupEnabled(next);
    setSavingPref(true);
    try {
      await api.put("/api/notifications/preferences", { popupEnabled: next }, token);
    } catch (err) {
      console.error(err);
      setPopupEnabled(prev);
      toast.error("Failed to update preference");
    } finally {
      setSavingPref(false);
    }
  };

  return (
    <div className="notificationsPage">
      <Header
        currentUser={getCurrentSession()?.user || null}
        onLogout={() => {
          clearSession();
          navigate("/login");
        }}
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        onManageDash={() => navigate("/managedash")}
      />
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
            <Badge className="headerBadge">{counts.all}</Badge>
          </div>
          <div className="headerActions">
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllRead} variant="outline" size="sm" className="ghostBtn">
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all as read
              </Button>
            )}
            <Button variant="outline" size="sm" className="ghostBtn" onClick={() => setSettingsOpen(true)}>
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
            <div className="sortBox flex gap-3 items-center">
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as "newest" | "oldest" | "unread")}>
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
        <Tabs value={selectedTab} onValueChange={(val) => setSelectedTab(val as "all" | "unread" | "starred")}>
          <TabsList className="pillTabs">
            <TabsTrigger value="all">
              All
              <Badge className="pillBadge">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && <Badge className="pillBadge accent">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="starred">
              Starred
              {starredCount > 0 && <Badge className="pillBadge warning">{starredCount}</Badge>}
            </TabsTrigger>
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
                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  />
                  <span className="selectAllText">Select all ({filteredNotifications.length})</span>
                </div>
              )}

              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notificationCard ${!notification.read ? "notificationUnread" : ""}`}
                  onClick={() => handleOpenNotification(notification)}
                >
                  <div className="notificationLeft">
                    <Checkbox
                      checked={selectedNotifications.has(notification.id)}
                      onCheckedChange={(checked) => handleSelectOne(notification.id, Boolean(checked))}
                      onClick={(e) => e.stopPropagation()}
                    />
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
                        <Badge className="metaBadge">{notification.type}</Badge>
                        <span className="notificationTime">{notification.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="notificationActions">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`actionBtn ${notification.starred ? "text-amber-500" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(notification.id, !notification.starred);
                      }}
                    >
                      <Star
                        className="w-4 h-4"
                        strokeWidth={notification.starred ? 2 : 2}
                        color={notification.starred ? "#f59e0b" : "currentColor"}
                        fill={notification.starred ? "#f59e0b" : "none"}
                      />
                    </Button>
                    {notification.read ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="actionBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsUnread(notification.id);
                        }}
                        title="Mark as unread"
                      >
                        <MailOpen className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="actionBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
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
            <Button
              variant="outline"
              size="sm"
              className="dangerOutline"
              onClick={() => {
                const targets = selectedNotifications.size ? Array.from(selectedNotifications) : filteredNotifications.map((n) => n.id);
                if (targets.length) deleteMany(targets);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete selected
            </Button>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="acModalOverlay" onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}>
          <div className="acModal" role="dialog" aria-modal="true">
            <div className="acModalHeader">
              <div>
                <p className="mdMainSubtitle">Notification settings</p>
                <h3 className="acCardTitle">Popup notifications</h3>
                <p className="mdMainSubtitle">Show a toast when a new notification arrives.</p>
              </div>
              <button className="acIconBtn" onClick={() => setSettingsOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="acModalBody">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-semibold text-slate-800">Show popup notifications</p>
                  <p className="text-sm text-slate-500">Show a toast when a new notification arrives.</p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={popupEnabled}
                    disabled={savingPref}
                    onChange={handleTogglePopup}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400"
                  />
                  <span className="text-sm text-slate-700">{popupEnabled ? "On" : "Off"}</span>
                </label>
              </div>
            </div>
            <div className="acModalFooter">
              <button className="acGhostBtn" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


