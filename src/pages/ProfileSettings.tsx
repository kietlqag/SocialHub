import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Bell,
  Shield,
  CreditCard,
  Palette,
  AlertTriangle,
  Check,
  Trash2,
  Plus,
  Save,
  ArrowLeft,
  KeyRound,
  Smartphone,
  Download,
  Pencil,
} from "lucide-react";
import { getCurrentSession } from "../services/auth";
import { api } from "../services/api";
import { toast } from "sonner";
import "../styles/settings.css";
import { ToggleSwitch } from "../components/ToggleSwitch";

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

export function ProfileSettings({ onBack }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<"notifications" | "appearance" | "security" | "billing">("notifications");
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
    setIsSaving(true);
    try {
      const session = getCurrentSession();
      const token = session?.token;
      if (!token) {
        toast.error("You need to sign in to save changes");
        setIsSaving(false);
        return;
      }

      const payload = { preferences: { notifications, appearance } };
      await api.patch("/profile", payload, token);
      toast.success("Preferences saved");
    } catch (err) {
      console.error(err);
      toast.error("Unable to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) return;

    api
      .get<{ profile: any }>("/profile", token)
      .then((res) => {
        const p = res.profile || {};
        const prefs = p.preferences || {};
        if (prefs.notifications) setNotifications((prev) => ({ ...prev, ...prefs.notifications }));
        if (prefs.appearance) setAppearance((prev) => ({ ...prev, ...prefs.appearance }));
      })
      .catch((err) => console.error("Failed to load profile", err));
  }, []);

  const tabs = [
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    { id: "security" as const, label: "Security", icon: Shield },
    { id: "billing" as const, label: "Billing", icon: CreditCard },
  ];

  const primaryBtn =
    "rounded-full px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-70";
  const secondaryBtn =
    "rounded-full px-5 py-2.5 bg-white/70 border border-slate-200 text-slate-700 hover:bg-white transition";

  const inputClass =
    "rounded-xl bg-white/70 border border-slate-200/60 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition";

  const sectionTitle = (title: string, subtitle?: string) => (
    <div className="settingsSectionHeader">
      <p className="settingsSectionSubtitle">{subtitle}</p>
      <h3 className="settingsSectionTitle">{title}</h3>
    </div>
  );

  return (
    <div className="settingsPage">
      <div className="settingsBgOverlay" />
      <div className="settingsBlob settingsBlob1" />
      <div className="settingsBlob settingsBlob2" />

      <div className="settingsContainer">
        <div className="settingsHeader">
          <div>
            <p className="settingsTitle">SocialHub Settings</p>
          </div>
        </div>

        <div className="settingsLayout">
          <aside className="settingsSidebar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`settingsTab ${isActive ? "settingsTabActive" : ""}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </aside>

          <div className="settingsContent">
            {activeTab === "notifications" && (
              <div className="settingsSection">
                <Card className="settingsCard">
                  {sectionTitle("Email Notifications", "Notifications")}
                  <div className="space-y-4">
                    {[
                      { key: "emailNotifications", title: "Email notifications", desc: "Receive email about your account activity" },
                      { key: "pushNotifications", title: "Push notifications", desc: "Get push updates about dashboards and alerts" },
                      { key: "weeklyReport", title: "Weekly report", desc: "Summary of your usage delivered weekly" },
                      { key: "productUpdates", title: "Product updates", desc: "Announcements about new features" },
                      { key: "dashboardAlerts", title: "Dashboard alerts", desc: "Alerts when thresholds are exceeded" },
                      { key: "teamActivity", title: "Team activity", desc: "Mentions, invites, and collaboration events" },
                      { key: "monthlyNewsletter", title: "Monthly newsletter", desc: "Curated tips and best practices" },
                    ].map((item) => (
                      <div key={item.key} className="settingsRow">
                        <div className="settingsRowText">
                          <p className="settingsRowTitle">{item.title}</p>
                          <p className="settingsRowDesc">{item.desc}</p>
                        </div>
                        <ToggleSwitch
                          checked={(notifications as any)[item.key]}
                          onChange={(isChecked: boolean) =>
                            setNotifications({ ...notifications, [item.key]: isChecked } as NotificationsState)
                          }
                          aria-label={item.title}
                        />
                      </div>
                    ))}
                    <Separator />
                    <div className="settingsActions">
                      <Button onClick={handleSave} disabled={isSaving} className={`${primaryBtn} gap-2 savePreferencesBtn`}>
                        {isSaving ? "Saving..." : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Preferences
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="settingsSection">
                <Card className="settingsCard">
                  {sectionTitle("Display Settings", "Appearance")}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select value={appearance.theme} onValueChange={(value: string) => setAppearance({ ...appearance, theme: value })}>
                        <SelectTrigger className={inputClass}>
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="settingsHelper">Choose your preferred theme</p>
                    </div>
                  </div>
                </Card>

                <Card className="settingsCard">
                  {sectionTitle("Localization", "Appearance")}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select value={appearance.language} onValueChange={(value: string) => setAppearance({ ...appearance, language: value })}>
                        <SelectTrigger className={inputClass}>
                          <SelectValue placeholder="Select language" />
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
                        <SelectTrigger className={inputClass}>
                          <SelectValue placeholder="Select timezone" />
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
                        <SelectTrigger className={inputClass}>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="settingsActions">
                    <Button onClick={handleSave} disabled={isSaving} className={`${primaryBtn} gap-2 savePreferencesBtn`}>
                      {isSaving ? "Saving..." : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Preferences
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "security" && (
              <div className="settingsSection space-y-6">
                <Card className="settingsCard">
                  {sectionTitle("Change Password", "Security")}
                  <div className="space-y-4 max-w-lg">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input id="currentPassword" type="password" className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" type="password" className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input id="confirmPassword" type="password" className={inputClass} />
                    </div>
                    <Button className={`${primaryBtn} gap-2 savePreferencesBtn`}>
                      <KeyRound className="w-4 h-4" />
                      Update Password
                    </Button>
                  </div>
                </Card>

                <Card className="settingsCard">
                  {sectionTitle("Two-Factor Authentication", "Security")}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-900">Add an extra layer of security to your account.</p>
                      <p className="text-sm text-slate-600">You'll enter a code from your phone in addition to your password.</p>
                    </div>
                    <Button variant="ghost" className={`${secondaryBtn} px-4 py-2 savePreferencesBtn`}>
                      <Smartphone className="w-4 h-4 mr-2" />
                      Enable 2FA
                    </Button>
                  </div>
                </Card>

                <Card className="settingsCard">
                  {sectionTitle("Active Sessions", "Security")}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white/70 border border-slate-200/60 rounded-xl">
                      <div className="flex items-start gap-2">
                        <span className="sessionStatusDot sessionStatusDot--active" aria-label="Active session" />
                        <div>
                          <p className="text-sm text-slate-900">MacBook Pro - San Francisco, CA</p>
                          <p className="text-xs text-slate-600">Current session - Last active: Now</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="sessionActionRevoke"
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/70 border border-slate-200/60 rounded-xl">
                      <div className="flex items-start gap-2">
                        <span className="sessionStatusDot sessionStatusDot--inactive" aria-label="Inactive session" />
                        <div>
                          <p className="text-sm text-slate-900">iPhone 14 Pro - San Francisco, CA</p>
                          <p className="text-xs text-slate-600">Last active: 2 hours ago</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="sessionActionRevoke"
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="settingsCard dangerCard">
                  <div className="flex items-start gap-4 justify-between">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-lg text-red-900 mb-2">Danger Zone</h3>
                        <p className="text-sm text-red-800">Once you delete your account, there is no going back. Please be certain.</p>
                      </div>
                    </div>
                    <Button className="dangerAction px-5 py-2.5 flex items-center gap-2 self-start">
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="settingsSection space-y-6">
                <Card className="settingsCard">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-lg text-slate-900 font-semibold">Current Plan</h3>
                      <p className="text-sm text-slate-600">You are currently on the Pro plan</p>
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-800">Pro Plan</Badge>
                  </div>
                  <div className="bg-white/70 border border-slate-200/60 rounded-xl p-6 mb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl text-slate-900">$29</span>
                      <span className="text-slate-600">/month</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">Billed monthly — Next billing date: Dec 24, 2024</p>
                    <div className="space-y-2">
                      {["Unlimited dashboards", "Advanced analytics", "Priority support", "Custom branding"].map((feat) => (
                        <div key={feat} className="flex items-center gap-2 text-sm text-slate-800">
                          <Check className="w-4 h-4 text-green-600" />
                          {feat}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button className={`${primaryBtn} from-emerald-500 to-teal-500 savePreferencesBtn`}>Change Plan</Button>
                    <Button className={`${secondaryBtn} savePreferencesBtn`}>Cancel Subscription</Button>
                  </div>
                </Card>

                <Card className="settingsCard">
                  {sectionTitle("Payment Method", "Billing")}
                  <div className="flex items-center justify-between p-4 bg-white/70 border border-slate-200/60 rounded-xl mb-4">
                    <div className="flex items-center gap-3">
                      <div className="paymentCardIcon">
                        <CreditCard className="w-6 h-6 text-black drop-shadow" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-900">•••• •••• •••• 4242</p>
                        <p className="text-xs text-slate-600">Expires 12/2025</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="rounded-full px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-white savePreferencesBtn">
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-4 py-2 border border-slate-200 text-slate-700 hover:bg-white savePreferencesBtn w-auto"
                    style={{ alignSelf: "flex-start" }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Payment Method
                  </Button>
                </Card>

                <Card className="settingsCard">
                  {sectionTitle("Billing History", "Billing")}
                  <div className="space-y-3">
                    {[
                      { date: "Nov 24, 2024", amount: "$29.00", status: "Paid" },
                      { date: "Oct 24, 2024", amount: "$29.00", status: "Paid" },
                      { date: "Sep 24, 2024", amount: "$29.00", status: "Paid" },
                    ].map((invoice, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white/70 border border-slate-200/60 rounded-xl">
                        <div>
                          <p className="text-sm text-slate-900">{invoice.date}</p>
                          <p className="text-xs text-slate-600">{invoice.amount}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-green-100 text-green-800">{invoice.status}</Badge>
                          <Button variant="ghost" size="sm" className="rounded-full px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-white">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
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
