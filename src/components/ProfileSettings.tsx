import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState("profile");
  const [isSaving, setIsSaving] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    company: "Acme Corporation",
    jobTitle: "Product Manager",
    location: "San Francisco, CA",
    bio: "Passionate about building great products and leading teams to success.",
    website: "https://johndoe.com",
  });

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
    await new Promise((res) => setTimeout(res, 800));
    setIsSaving(false);
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
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
            {activeTab === "profile" && (
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="flex items-start gap-6">
                    <div className="relative">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{profile.firstName[0]}{profile.lastName[0]}</AvatarFallback>
                      </Avatar>
                      <button className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl text-gray-900 mb-1">{profile.firstName} {profile.lastName}</h2>
                      <p className="text-gray-600 mb-3">{profile.email}</p>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" />Email Verified</Badge>
                        <Badge className="bg-blue-100 text-blue-800">Pro Plan</Badge>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input id="email" type="email" className="pl-10" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input id="phone" type="tel" className="pl-10" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                      </div>
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
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

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

            {/* appearance / security / billing left as-is from temp; not needed to change */}
          </div>
        </div>
      </div>
    </div>
  );
}
