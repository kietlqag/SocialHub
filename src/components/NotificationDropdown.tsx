import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
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
} from "lucide-react";
import { api } from "../services/api";
import { getCurrentSession } from "../services/auth";

interface NotificationItem {
  id: string;
  type: "info" | "success" | "warning" | "alert";
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: any;
  userId?: string | null;
}

interface NotificationDropdownProps {
  onViewAll?: () => void;
}

export function NotificationDropdown({ onViewAll }: NotificationDropdownProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const selfId = useRef(`dropdown-${Math.random().toString(36).slice(2, 8)}`);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleCloseOthers = (event: Event) => {
      const detailId = (event as CustomEvent)?.detail;
      if (detailId !== selfId.current) setIsOpen(false);
    };
    window.addEventListener("close-all-dropdowns", handleCloseOthers as EventListener);
    return () => window.removeEventListener("close-all-dropdowns", handleCloseOthers as EventListener);
  }, []);

  useEffect(() => {
    const update = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const top = rect.bottom + 12 + window.scrollY;
      const right = Math.max(4, window.innerWidth + window.scrollX - rect.right);
      setCoords({ top, right });
    };
    if (isOpen) {
      update();
      window.addEventListener("scroll", update, true);
      window.addEventListener("resize", update);
    }
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen]);

  // fetch notifications when dropdown opens (first time or subsequent opens)
  useEffect(() => {
    async function load() {
      const session = getCurrentSession();
      const token = session?.token;
      const currentUserId = session?.user?.id;
      if (!token || !currentUserId) {
        console.warn("[NotificationDropdown] No session/token; skip loading notifications");
        setHasLoadedOnce(true);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await api.get<{ data: any[] }>("/notifications", token);
        const items = Array.isArray(res?.data) ? res.data : [];
        const filtered = items.filter((d) => {
          const matches = !d.user_id || String(d.user_id) === String(currentUserId);
          if (!matches) console.warn("[NotificationDropdown] Dropped notification for different user", { notificationUser: d.user_id, currentUserId });
          return matches;
        });
        const mapped = filtered.map(
          (d) =>
            ({
              id: String(d._id || d.id),
              type: d.type || "info",
              title: d.title || "(no title)",
              message: d.message || "",
              time: d.created_at || d.updated_at || d.createdAt || d.time || new Date().toISOString(),
              read: !!d.read,
              userId: d.user_id || d.userId || null,
              icon:
                d.type === "success"
                  ? Package
                  : d.type === "alert"
                    ? AlertCircle
                    : d.type === "warning"
                      ? Calendar
                      : MessageSquare,
            }) as NotificationItem,
        );
        setNotifications(mapped);
        setHasLoadedOnce(true);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen && (!hasLoadedOnce || notifications.length === 0)) {
      load();
    }
  }, [isOpen, hasLoadedOnce, notifications.length]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      const session = getCurrentSession();
      const token = session?.token;
      if (!token) throw new Error("Missing auth token");
      const res = await api.patch<{ data: any }>(`/notifications/${id}`, { read: true }, token);
      const updated = res?.data;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: !!updated?.read } : n)));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    try {
      const session = getCurrentSession();
      const token = session?.token;
      if (!token) throw new Error("Missing auth token");
      await Promise.all(unread.map((id) => api.patch(`/notifications/${id}`, { read: true }, token)));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all as read", err);
    }
  };

  const removeNotification = async (id: string) => {
    try {
      const session = getCurrentSession();
      const token = session?.token;
      if (!token) throw new Error("Missing auth token");
      await api.delete(`/notifications/${id}`, token);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const getNotificationColor = (type: NotificationItem["type"]) => {
    switch (type) {
      case "success":
        return { dot: "bg-green-500" };
      case "warning":
        return { dot: "bg-yellow-500" };
      case "alert":
        return { dot: "bg-red-500" };
      default:
        return { dot: "bg-sky-500" };
    }
  };

  const handleViewAll = () => {
    if (onViewAll) return onViewAll();
    try {
      window.history.pushState({}, "", "/notifications");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      // no-op
    }
  };

  const renderPanel = () => {
    if (!isOpen) return null;
    const panel = (
      <div
        className="dropdownPanel dropdownNotifications notificationDropdown flex flex-col"
        ref={panelRef}
        style={{ top: coords.top, right: coords.right, left: "auto", position: "absolute", zIndex: 9999 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && <Badge className="bg-red-500 text-white">{unreadCount}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button className="text-xs text-indigo-600 hover:text-indigo-700" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
            <button className="iconBtn" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="notificationList space-y-2 pr-1">
          {isLoading ? (
            <div className="p-6 text-sm text-slate-600 text-center">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-600">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              No notifications
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = notification.icon || MessageSquare;
              const typeClass =
                notification.type === "success"
                  ? "success"
                  : notification.type === "warning"
                    ? "warning"
                    : notification.type === "alert"
                      ? "alert"
                      : "info";
              return (
                <div key={notification.id} className={`notificationItem ${typeClass} ${notification.read ? "" : "unread"}`}>
                  <div className="flex items-start gap-3">
                    <div className="notifIconWrap">
                      <Icon className="w-4 h-4 text-indigo-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 notifTitle">{notification.title}</p>
                        {!notification.read && <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${getNotificationColor(notification.type).dot}`} />}
                      </div>
                      <p className="text-sm text-slate-700 mb-2 notifMessage">{notification.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="notificationTime notifTime">{notification.time}</span>
                        <div className="flex items-center gap-1">
                          {!notification.read && (
                            <button className="iconBtn" onClick={() => markAsRead(notification.id)}>
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                          <button className="iconBtn" onClick={() => removeNotification(notification.id)}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="dropdownFooter">
          <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => { setIsOpen(false); handleViewAll(); }}>
            <Bell className="w-4 h-4 mr-2" />
            View all
          </Button>
        </div>
      </div>
    );
    return createPortal(panel, document.body);
  };

  return (
    <div className="dropdownRoot notificationWrapper">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) window.dispatchEvent(new CustomEvent("close-all-dropdowns", { detail: selfId.current }));
        }}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
      </Button>
      {renderPanel()}
    </div>
  );
}
