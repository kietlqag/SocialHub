import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  ArrowLeft,
  User,
  Bell,
  Shield,
  CreditCard,
  Palette,
  Globe,
  AlertTriangle,
  Camera,
  Save,
  Mail,
  Building,
  MapPin,
  Phone,
  Check,
  Trash2,
  Plus,
} from "lucide-react";
// Logout handled by main App Header — no import needed here
import { getCurrentSession } from "../services/auth";
import { api } from "../services/api";
import { toast } from "sonner@2.0.3";

interface ProfileSettingsProps {
  onBack?: () => void;
  onLogout?: () => void;
}

interface NotificationsState {
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyReport: boolean;
  productUpdates: boolean;
  dashboardAlerts: boolean;
  teamActivity: boolean;
  monthlyNewsletter: boolean;
}

export function ProfileSettings({ onBack, onLogout }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState("notifications");
  const [isSaving, setIsSaving] = useState(false);


  const [notifications, setNotifications] = useState<NotificationsState>({
    emailNotifications: true,
    pushNotifications: true,
    weeklyReport: true,
    productUpdates: false,
    dashboardAlerts: true,
    teamActivity: true,
    monthlyNewsletter: false,
  });

  const [appearance, setAppearance] = useState({
    theme: "light",
    language: "en",
    timezone: "America/Los_Angeles",
    dateFormat: "MM/DD/YYYY",
  });

  const handleSave = async () => {
    // Save preferences only (notifications + appearance)
    setIsSaving(true);
    try {
      const payload: any = {
        preferences: {
          notifications,
          appearance,
        },
      };

      const session = getCurrentSession();
      const token = session?.token;
      if (!token) {
        toast.error("Bạn cần đăng nhập để lưu thay đổi");
        setIsSaving(false);
        return;
      }

      await api.patch("/profile", payload, token);
      toast.success("Cập nhật cài đặt thành công");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu thay đổi");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) return; // not logged in

    api.get<{ profile: any }>("/profile", token)
      .then((res) => {
        const p = res.profile || {};
        const prefs = p.preferences || {};
        if (prefs.notifications) setNotifications((prev) => ({ ...prev, ...prefs.notifications }));
        if (prefs.appearance) setAppearance((prev) => ({ ...prev, ...prefs.appearance }));
      })
      .catch((err) => console.error("Failed to load profile", err));
  }, []);

  const tabs = [
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "security", label: "Security", icon: Shield },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl text-gray-900">Settings</h1>
                <p className="text-sm text-gray-600">Manage your account settings and preferences</p>
              </div>
            </div>
            {/* logout removed from header to avoid duplicate actions; keep logout available via the main App Header */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-3">
            <Card className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-9">
            { /* profile tab removed — Profile is now a separate page */ }

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Email Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm text-gray-900">Email Notifications</label>
                        <p className="text-sm text-gray-600">Receive email about your account activity</p>
                      </div>
                      <Switch checked={notifications.emailNotifications} onCheckedChange={(isChecked: boolean) => setNotifications({ ...notifications, emailNotifications: isChecked })} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm text-gray-900">Weekly Report</label>
                        <p className="text-sm text-gray-600">Get a weekly summary of your dashboard activity</p>
                      </div>
                      <Switch checked={notifications.weeklyReport} onCheckedChange={(isChecked: boolean) => setNotifications({ ...notifications, weeklyReport: isChecked })} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm text-gray-900">Product Updates</label>
                        <p className="text-sm text-gray-600">News about product and feature updates</p>
                      </div>
                      <Switch checked={notifications.productUpdates} onCheckedChange={(isChecked: boolean) => setNotifications({ ...notifications, productUpdates: isChecked })} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm text-gray-900">Monthly Newsletter</label>
                        <p className="text-sm text-gray-600">Tips, tricks, and best practices</p>
                      </div>
                      <Switch checked={notifications.monthlyNewsletter} onCheckedChange={(isChecked: boolean) => setNotifications({ ...notifications, monthlyNewsletter: isChecked })} />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Push Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm text-gray-900">Push Notifications</label>
                        <p className="text-sm text-gray-600">Receive push notifications on your devices</p>
                      </div>
                      <Switch checked={notifications.pushNotifications} onCheckedChange={(isChecked: boolean) => setNotifications({ ...notifications, pushNotifications: isChecked })} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm text-gray-900">Dashboard Alerts</label>
                        <p className="text-sm text-gray-600">Get notified about important dashboard events</p>
                      </div>
                      <Switch checked={notifications.dashboardAlerts} onCheckedChange={(isChecked: boolean) => setNotifications({ ...notifications, dashboardAlerts: isChecked })} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-sm text-gray-900">Team Activity</label>
                        <p className="text-sm text-gray-600">Notifications about team member actions</p>
                      </div>
                      <Switch checked={notifications.teamActivity} onCheckedChange={(isChecked: boolean) => setNotifications({ ...notifications, teamActivity: isChecked })} />
                    </div>
                  </div>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? (
                      "Saving..."
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Preferences
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Display Settings</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select value={appearance.theme} onValueChange={(value: string) => setAppearance({ ...appearance, theme: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-600">Choose your preferred theme</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Localization</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select value={appearance.language} onValueChange={(value: string) => setAppearance({ ...appearance, language: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select value={appearance.timezone} onValueChange={(value: string) => setAppearance({ ...appearance, timezone: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                          <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                          <SelectItem value="Europe/London">London (GMT)</SelectItem>
                          <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date Format</Label>
                      <Select value={appearance.dateFormat} onValueChange={(value: string) => setAppearance({ ...appearance, dateFormat: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? (
                      "Saving..."
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Preferences
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Change Password</h3>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input id="currentPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input id="confirmPassword" type="password" />
                    </div>
                    <Button className="gap-2">
                      <Shield className="w-4 h-4" />
                      Update Password
                    </Button>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Two-Factor Authentication</h3>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-900">Two-factor authentication adds an extra layer of security</p>
                      <p className="text-sm text-gray-600">You'll need to enter a code from your phone in addition to your password</p>
                    </div>
                    <Button variant="outline">Enable 2FA</Button>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Active Sessions</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-900">MacBook Pro - San Francisco, CA</p>
                        <p className="text-xs text-gray-600">Current session • Last active: Now</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-900">iPhone 14 Pro - San Francisco, CA</p>
                        <p className="text-xs text-gray-600">Last active: 2 hours ago</p>
                      </div>
                      <Button variant="ghost" size="sm">Revoke</Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-lg text-gray-900 mb-1">Current Plan</h3>
                      <p className="text-sm text-gray-600">You are currently on the Pro plan</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">Pro Plan</Badge>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6 mb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl text-gray-900">$29</span>
                      <span className="text-gray-600">/month</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Billed monthly • Next billing date: Dec 24, 2024</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        Unlimited dashboards
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        Advanced analytics
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        Priority support
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        Custom branding
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline">Change Plan</Button>
                    <Button variant="outline">Cancel Subscription</Button>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Payment Method</h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-900">•••• •••• •••• 4242</p>
                        <p className="text-xs text-gray-600">Expires 12/2025</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Payment Method
                  </Button>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Billing History</h3>
                  <div className="space-y-3">
                    {[
                      { date: "Nov 24, 2024", amount: "$29.00", status: "Paid" },
                      { date: "Oct 24, 2024", amount: "$29.00", status: "Paid" },
                      { date: "Sep 24, 2024", amount: "$29.00", status: "Paid" },
                    ].map((invoice, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm text-gray-900">{invoice.date}</p>
                          <p className="text-xs text-gray-600">{invoice.amount}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-green-100 text-green-800">{invoice.status}</Badge>
                          <Button variant="ghost" size="sm">Download</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Danger Zone */}
                <Card className="border-red-200 bg-red-50/50 p-6 mt-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg text-red-900 mb-2">Danger Zone</h3>
                      <p className="text-sm text-red-800 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                      <Button variant="destructive" className="gap-2"><Trash2 className="w-4 h-4" />Delete Account</Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
