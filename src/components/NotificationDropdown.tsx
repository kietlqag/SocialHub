import { useState, useEffect, useRef } from "react";
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
  Settings as SettingsIcon,
} from "lucide-react";
import { api } from "../services/api";

interface NotificationItem {
  id: string;
  type: "info" | "success" | "warning" | "alert";
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: any;
}

interface NotificationDropdownProps {
  onViewAll?: () => void;
}

export function NotificationDropdown({ onViewAll }: NotificationDropdownProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // fetch notifications when dropdown opens (first time or subsequent opens)
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await api.get<{ data: any[] }>("/notifications");
        const items = Array.isArray(res?.data) ? res.data : [];
        const mapped = items.map((d) => ({
          id: String(d._id || d.id),
          type: d.type || "info",
          title: d.title || "(no title)",
          message: d.message || "",
          time: d.createdAt || d.time || d.updatedAt || new Date().toISOString(),
          read: !!d.read,
          icon: d.type === "success" ? Package : d.type === "alert" ? AlertCircle : d.type === "warning" ? Calendar : MessageSquare,
        } as NotificationItem));
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
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      const res = await api.patch<{ data: any }>(`/notifications/${id}`, { read: true });
      const updated = res?.data;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: !!updated.read } : n)));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    try {
      await Promise.all(unread.map((id) => api.patch(`/notifications/${id}`, { read: true })));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all as read", err);
    }
  };

  const removeNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const getNotificationColor = (type: NotificationItem["type"]) => {
    // Returns a set of Tailwind classes for different UI parts per notification type
    switch (type) {
      case "success":
        return {
          bg: "bg-gradient-to-r from-green-50 via-green-100 to-white",
          iconBg: "bg-green-50 text-green-600",
          accent: "border-l-4 border-green-300",
          dot: "bg-green-600"
        };
      case "warning":
        return {
          bg: "bg-gradient-to-r from-yellow-50 via-yellow-100 to-white",
          iconBg: "bg-yellow-50 text-yellow-600",
          accent: "border-l-4 border-yellow-300",
          dot: "bg-yellow-500"
        };
      case "alert":
        return {
          bg: "bg-gradient-to-r from-red-50 via-red-100 to-white",
          iconBg: "bg-red-50 text-red-600",
          accent: "border-l-4 border-red-300",
          dot: "bg-red-600"
        };
      default:
        return {
          bg: "bg-gradient-to-r from-sky-50 via-sky-100 to-white",
          iconBg: "bg-sky-50 text-sky-600",
          accent: "border-l-4 border-sky-300",
          dot: "bg-sky-600"
        };
    }
  };

  const handleOpenSettings = () => {
    if (onViewAll) return onViewAll();

    // fallback: update history + trigger popstate so App picks up the /settings path
    try {
      window.history.pushState({}, "", "/settings");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      // no-op
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setIsOpen(!isOpen)}>
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-96 max-w-md bg-white rounded-lg shadow-lg border border-gray-200 z-50 h-96 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg text-gray-900">Notifications</h3>
                {unreadCount > 0 && <Badge className="bg-red-500 text-white">{unreadCount}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-primary hover:text-primary">
                    Mark all as read
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="scroll-area flex-1 min-h-0 overflow-y-auto">
            <div className="divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 mb-1">No notifications</p>
                  <p className="text-sm text-gray-500">You're all caught up!</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <div key={notification.id} className={`p-4 transition-colors ${getNotificationColor(notification.type).bg} ${getNotificationColor(notification.type).accent} ${!notification.read ? "shadow-sm" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${getNotificationColor(notification.type).iconBg}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm text-gray-900">{notification.title}</p>
                            {!notification.read && <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${getNotificationColor(notification.type).dot}`} />}
                          </div>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{notification.message}</p>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs text-gray-500">{notification.time}</span>
                            <div className="flex items-center gap-1">
                              {!notification.read && (
                                <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)} className="h-7 px-2 text-xs">
                                  <Check className="w-3 h-3 mr-1" />
                                  Mark read
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => removeNotification(notification.id)} className="h-7 px-2 text-xs text-gray-500 hover:text-red-600">
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <Button variant="ghost" size="sm" className="w-full justify-center text-primary hover:text-primary mb-2" onClick={() => { setIsOpen(false); try { window.history.pushState({}, "", "/notifications"); window.dispatchEvent(new PopStateEvent("popstate")); } catch (e) {} }}>
                <Bell className="w-4 h-4 mr-2" />
                View all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
