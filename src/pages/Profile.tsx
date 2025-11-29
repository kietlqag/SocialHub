import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Save,
  Camera,
  Mail,
  Phone,
  Building,
  MapPin,
  Link as LinkIcon,
  ArrowLeft,
} from "lucide-react";
import { getCurrentSession } from "../services/auth";
import { api } from "../services/api";
import { toast } from "sonner";

export default function Profile() {
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<any>({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    job_title: "",
    location: "",
    bio: "",
    website: "",
  });

  useEffect(() => {
    const session = getCurrentSession();
    const token = session?.token;
    if (!token) return;

    api
      .get<{ profile: any }>("/profile", token)
      .then((res) => {
        const p = res.profile || {};
        setProfile((prev) => ({ ...prev, ...p }));
      })
      .catch((err) => console.error("Failed to load profile", err));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const session = getCurrentSession();
      const token = session?.token;
      if (!token) {
        toast.error("Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ lÆ°u thay Ä‘á»•i");
        setIsSaving(false);
        return;
      }

      const payload = {
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        company: profile.company,
        job_title: profile.job_title,
        location: profile.location,
        bio: profile.bio,
        website: profile.website,
      };

      await api.patch("/profile", payload, token);
      toast.success("Profile updated");
    } catch (err) {
      console.error(err);
      toast.error("Could not save profile");
    } finally {
      setIsSaving(false);
    }
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

  return (
    <div className="min-h-screen bg-slate-950/5">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">SH</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">SocialHub</p>
              <p className="text-xs text-slate-500">Your personal social workspace</p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleBack} className="gap-2 border-slate-200 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <Card className="p-6 sm:p-7 border-slate-200 shadow-sm">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="relative">
                <Avatar className="w-24 h-24 ring-4 ring-slate-100 shadow-md">
                  <AvatarImage src={profile.avatar_url || profile.avatarUrl || ""} />
                  <AvatarFallback className="bg-slate-900 text-slate-50 text-2xl">{getInitials(profile.fullName)}</AvatarFallback>
                </Avatar>
                <button type="button" className="absolute bottom-0 right-0 p-2 rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">{profile.fullName || "Your name"}</h2>
                <p className="text-sm text-slate-500">{profile.job_title || "Your role"}{profile.company ? ` â€¢ ${profile.company}` : ""}</p>
                {profile.location && <p className="text-xs text-slate-400 flex items-center justify-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</p>}
              </div>

              <div className="w-full pt-2 space-y-2 text-left text-sm">
                {profile.email && <div className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-slate-400" /><span className="truncate">{profile.email}</span></div>}
                {profile.phone && <div className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-slate-400" /><span>{profile.phone}</span></div>}
                {profile.website && <div className="flex items-center gap-2 text-slate-600"><LinkIcon className="h-4 w-4 text-slate-400" /><span className="truncate">{profile.website}</span></div>}
              </div>
            </div>
          </Card>

          <Card className="p-6 sm:p-7 border-slate-200 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Personal Information</h3>
                <p className="text-xs text-slate-500 mt-1">ThÃ nh pháº§n hiá»ƒn thá»‹ cho ngÆ°á»i dÃ¹ng khÃ¡c trong há»‡ thá»‘ng.</p>
              </div>
              <Button onClick={handleSave} disabled={isSaving} className="hidden sm:inline-flex gap-2">
                {isSaving ? "Saving..." : <><Save className="w-4 h-4" />Save</>}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Full Name</Label>
                <Input value={profile.fullName || ""} onChange={(e) => setProfile({ ...profile, fullName: (e.target as HTMLInputElement).value })} placeholder="Nguyá»…n VÄƒn A" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-10" type="email" value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: (e.target as HTMLInputElement).value })} placeholder="you@example.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-10" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: (e.target as HTMLInputElement).value })} placeholder="+84 ..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Company</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-10" value={profile.company || ""} onChange={(e) => setProfile({ ...profile, company: (e.target as HTMLInputElement).value })} placeholder="CÃ´ng ty cá»§a báº¡n" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Job Title</Label>
                <Input value={profile.job_title || ""} onChange={(e) => setProfile({ ...profile, job_title: (e.target as HTMLInputElement).value })} placeholder="Chá»©c vá»¥" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-medium text-slate-600">Bio</Label>
                <Textarea value={profile.bio || ""} onChange={(e) => setProfile({ ...profile, bio: (e.target as HTMLTextAreaElement).value })} placeholder="Something about you" />
              </div>

            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}




