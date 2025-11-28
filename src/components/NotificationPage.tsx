import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Bell, Check, X, AlertCircle, Package, MessageSquare, Calendar } from "lucide-react";

export function NotificationPage({ onBack }: { onBack?: () => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<{ data: any[] }>("/notifications")
      .then((res) => setNotifications(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}`, { read: true });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const iconFor = (type: string) => {
    return type === "success" ? Package : type === "alert" ? AlertCircle : type === "warning" ? Calendar : MessageSquare;
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success":
        return { bg: "bg-gradient-to-r from-green-50 via-green-100 to-white", iconBg: "bg-green-50 text-green-600", accent: "border-l-4 border-green-300", dot: "bg-green-600" };
      case "warning":
        return { bg: "bg-gradient-to-r from-yellow-50 via-yellow-100 to-white", iconBg: "bg-yellow-50 text-yellow-600", accent: "border-l-4 border-yellow-300", dot: "bg-yellow-500" };
      case "alert":
        return { bg: "bg-gradient-to-r from-red-50 via-red-100 to-white", iconBg: "bg-red-50 text-red-600", accent: "border-l-4 border-red-300", dot: "bg-red-600" };
      default:
        return { bg: "bg-gradient-to-r from-sky-50 via-sky-100 to-white", iconBg: "bg-sky-50 text-sky-600", accent: "border-l-4 border-sky-300", dot: "bg-sky-600" };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Notifications</h2>
        <div className="flex items-center gap-2">
          {onBack && <Button variant="ghost" onClick={onBack}>Back</Button>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5" />
              <p className="text-sm text-gray-600">All your notifications</p>
            </div>
            <div>
              <Badge className="bg-blue-100 text-blue-800">{notifications.length}</Badge>
            </div>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : notifications.length === 0 ? (
            <div className="text-center p-8 text-gray-500">No notifications</div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const Icon = iconFor(n.type || "info");
                const color = getNotificationColor(n.type || "info");
                return (
                  <div key={n.id} className={`p-3 border rounded-lg flex items-start gap-3 ${color.bg} ${color.accent} ${!n.read ? "shadow-sm" : ""}`}>
                    <div className={`p-2 rounded-lg flex-shrink-0 ${color.iconBg}`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.message}</p>
                        </div>
                        <div className="text-xs text-gray-400">{new Date(n.created_at || n.time || n.updated_at).toLocaleString()}</div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {!n.read && <Button variant="ghost" size="sm" onClick={() => markRead(n.id)} className="text-xs">Mark read</Button>}
                        {!n.read && <span className={`w-2 h-2 rounded-full ${color.dot}`} />}
                        <Button variant="ghost" size="sm" onClick={() => remove(n.id)} className="text-xs text-red-600">Delete</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
