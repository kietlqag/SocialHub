import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Save, Camera, Mail, Phone, Building, MapPin, Link } from "lucide-react";
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

    api.get<{ profile: any }>("/profile", token)
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
        toast.error("Bạn cần đăng nhập để lưu thay đổi");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-6">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profile.avatar_url || profile.avatarUrl || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{profile.fullName ? profile.fullName.split(" ").map((p: string) => p[0]).slice(0,2).join("") : "U"}</AvatarFallback>
                </Avatar>
                <button className="absolute bottom-0 right-0 p-2:bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1">
                <h2 className="text-xl text-gray-900 mb-1">{profile.fullName}</h2>
                <p className="text-gray-600 mb-3">{profile.email}</p>
                <div className="flex items-center gap-2">
                  {/* badges are optional */}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={profile.fullName || ""} onChange={(e) => setProfile({ ...profile, fullName: (e.target as HTMLInputElement).value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-10" value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: (e.target as HTMLInputElement).value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-10" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: (e.target as HTMLInputElement).value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Company</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-10" value={profile.company || ""} onChange={(e) => setProfile({ ...profile, company: (e.target as HTMLInputElement).value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={profile.job_title || ""} onChange={(e) => setProfile({ ...profile, job_title: (e.target as HTMLInputElement).value })} />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-10" value={profile.location || ""} onChange={(e) => setProfile({ ...profile, location: (e.target as HTMLInputElement).value })} />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Bio</Label>
                <Textarea value={profile.bio || ""} onChange={(e) => setProfile({ ...profile, bio: (e.target as HTMLTextAreaElement).value })} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Website</Label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-10" value={profile.website || ""} onChange={(e) => setProfile({ ...profile, website: (e.target as HTMLInputElement).value })} />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
