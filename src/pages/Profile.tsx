import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  Pencil,
  Save,
  X,
  MapPin,
  Globe,
  Camera,
} from "lucide-react";
import { getCurrentSession } from "../services/auth";
import { api } from "../services/api";
import { toast } from "sonner";
import "../styles/profile.css";

type ProfilePayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  jobTitle?: string;
  location?: string;
  bio?: string;
  website?: string;
  createdAt?: string;
  userId?: string;
  avatar_url?: string;
  avatarUrl?: string;
};

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePayload>({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    job_title: "",
    location: "",
    bio: "",
    website: "",
  });
  const [originalProfile, setOriginalProfile] = useState<ProfilePayload>(profile);

  useEffect(() => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) return;

    api
      .get<{ profile: ProfilePayload }>("/profile", token)
      .then((res) => {
        const p = res.profile || {};
        setProfile((prev) => ({ ...prev, ...p }));
        setOriginalProfile((prev) => ({ ...prev, ...p }));
      })
      .catch((err) => console.error("Failed to load profile", err));
  }, []);

  const isUnchanged = () => {
    const keys: (keyof ProfilePayload)[] = ["fullName", "email", "phone", "company", "job_title", "jobTitle", "location", "bio", "website", "avatarUrl", "avatar_url"];
    return keys.every((k) => (profile?.[k] || "") === (originalProfile?.[k] || ""));
  };

  const validateProfile = () => {
    if (!profile.fullName?.trim()) return "Full name is required";
    if (!profile.email?.trim()) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (profile.email && !emailRegex.test(profile.email)) return "Email is not valid";
    return null;
  };

  const handleSave = async () => {
    const validationError = validateProfile();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (isUnchanged()) {
      toast.info("No changes to save");
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      const session = getCurrentSession();
      const token = session?.token;
      if (!token) {
        toast.error("You need to sign in to save changes");
        setIsSaving(false);
        return;
      }

    const payload = {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      company: profile.company,
      job_title: profile.job_title || profile.jobTitle,
      jobTitle: profile.job_title || profile.jobTitle,
      location: profile.location,
      bio: profile.bio,
      website: profile.website,
      avatarUrl: profile.avatarUrl || profile.avatar_url || avatarPreview || null,
    };

      await api.patch("/profile", payload, token);
      setOriginalProfile(profile);
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile(originalProfile);
    setIsEditing(false);
    setAvatarPreview(null);
  };

  const handleBack = () => {
    const target = "/home";
    if (window.location.pathname !== target) {
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const infoItem = (label: string, value?: string) => (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  );

  const inputClass = (extra = "") =>
    `${!isEditing ? "pointer-events-none select-none bg-white/40 border-slate-200/60 text-slate-700" : "bg-white border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"} transition-all ${extra}`;

  const primaryBtn =
    "rounded-full px-4 sm:px-5 py-2.5 bg-gradient-to-r from-indigo-50 via-white to-purple-50 text-slate-900 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-70 border border-indigo-200/60 ring-1 ring-indigo-100/60";
  const secondaryBtn =
    "rounded-full px-4 py-2.5 bg-white/70 border border-slate-200 text-slate-700 hover:bg-white transition-all";

  return (
    <div className="profile-page relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:22px_22px] opacity-60" />
      <div className="absolute -top-20 -left-10 h-72 w-72 rounded-full bg-indigo-400/30 blur-3xl" />
      <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-purple-400/25 blur-3xl" />

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className={`${secondaryBtn} px-4 py-2`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <p className="text-xs text-slate-500">Account</p>
              <p className="text-lg font-semibold text-slate-900">Profile</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} className={`${primaryBtn} px-4 py-2 relative z-20`}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit profile
              </Button>
            )}
            {isEditing && (
              <>
                <Button variant="ghost" onClick={handleCancel} className={secondaryBtn}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className={primaryBtn}>
                  {isSaving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save changes
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {/* Header card */}
        <Card className="relative overflow-hidden border border-white/60 bg-white/60 backdrop-blur-md shadow-lg rounded-2xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-50 via-white/20 to-purple-50 z-0" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.12),transparent_30%)] z-0" />
          <div className="relative z-10 p-6 sm:p-7 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-3">
                <Avatar className="w-20 h-20 ring-4 ring-white shadow-md bg-gradient-to-br from-indigo-500 to-purple-500">
                  <AvatarImage src={avatarPreview || profile.avatar_url || profile.avatarUrl || ""} />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xl">
                    {getInitials(profile.fullName)}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <div>
                    <label
                      className={`${secondaryBtn} cursor-pointer flex items-center justify-center gap-2 text-xs font-medium px-3 py-1.5 shadow-sm`}
                      htmlFor="avatar-upload"
                      aria-label="Change photo"
                    >
                      <Camera className="h-4 w-4" />
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const dataUrl = typeof reader.result === "string" ? reader.result : null;
                            if (dataUrl) {
                              setAvatarPreview(dataUrl);
                              setProfile((prev) => ({ ...prev, avatarUrl: dataUrl, avatar_url: dataUrl }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-col gap-1">
                  <p className="text-xl font-semibold text-slate-900">{profile.fullName || "Your name"}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    {profile.job_title || "Your role"}
                    {profile.company ? ` • ${profile.company}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {profile.email && (
                    <Badge className="rounded-full bg-white/70 border border-slate-200 text-slate-700 gap-2">
                      <Mail className="h-3.5 w-3.5 text-indigo-500" />
                      {profile.email}
                    </Badge>
                  )}
                  {profile.phone && (
                    <Badge className="rounded-full bg-white/70 border border-slate-200 text-slate-700 gap-2">
                      <Phone className="h-3.5 w-3.5 text-indigo-500" />
                      {profile.phone}
                    </Badge>
                  )}
                  {profile.location && (
                    <Badge className="rounded-full bg-white/70 border border-slate-200 text-slate-700 gap-2">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                      {profile.location}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {profile.bio || "Add a short bio to introduce yourself"}
                </p>
              </div>

            </div>
          </div>
        </Card>

        {/* Body grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 sm:p-7 border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition bg-white/70 backdrop-blur">
            <div className="mb-4">
              <p className="text-xs font-semibold text-indigo-600">Personal</p>
              <h3 className="text-lg font-semibold text-slate-900">Personal information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Full name</Label>
                <Input
                  disabled={!isEditing}
                  className={inputClass()}
                  value={profile.fullName || ""}
                  onChange={(e) => setProfile({ ...profile, fullName: (e.target as HTMLInputElement).value })}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Job title</Label>
                <Input
                  disabled={!isEditing}
                  className={inputClass()}
                  value={profile.job_title || ""}
                  onChange={(e) => setProfile({ ...profile, job_title: (e.target as HTMLInputElement).value })}
                  placeholder="Product Manager"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Company</Label>
                <Input
                  disabled={!isEditing}
                  className={inputClass()}
                  value={profile.company || ""}
                  onChange={(e) => setProfile({ ...profile, company: (e.target as HTMLInputElement).value })}
                  placeholder="Công ty của bạn"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Location</Label>
                <Input
                  disabled={!isEditing}
                  className={inputClass()}
                  value={profile.location || ""}
                  onChange={(e) => setProfile({ ...profile, location: (e.target as HTMLInputElement).value })}
                  placeholder="Ho Chi Minh City"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 sm:p-7 border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition bg-white/70 backdrop-blur">
            <div className="mb-4">
              <p className="text-xs font-semibold text-indigo-600">Contact</p>
              <h3 className="text-lg font-semibold text-slate-900">Contact details</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    disabled
                    readOnly
                    className={inputClass("pl-10 bg-white/60")}
                    type="email"
                    value={profile.email || ""}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    disabled={!isEditing}
                    className={inputClass("pl-10")}
                    value={profile.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: (e.target as HTMLInputElement).value })}
                    placeholder="+84 ..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    disabled={!isEditing}
                    className={inputClass("pl-10")}
                    value={profile.website || ""}
                    onChange={(e) => setProfile({ ...profile, website: (e.target as HTMLInputElement).value })}
                    placeholder="https://your-site.com"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 sm:p-7 border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition bg-white/70 backdrop-blur md:col-span-2">
            <div className="mb-4">
              <p className="text-xs font-semibold text-indigo-600">About</p>
              <h3 className="text-lg font-semibold text-slate-900">About you</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-xs font-medium text-slate-600">Bio</Label>
                <Textarea
                  disabled={!isEditing}
                  className={inputClass()}
                  rows={6}
                  value={profile.bio || ""}
                  onChange={(e) => setProfile({ ...profile, bio: (e.target as HTMLTextAreaElement).value })}
                  placeholder="Tell us about yourself, your focus, what you love to work on."
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {infoItem("User ID", profile.userId)}
                {infoItem("Created", profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : undefined)}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
