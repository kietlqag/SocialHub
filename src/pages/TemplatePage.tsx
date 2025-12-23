import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  Filter,
  Download,
  Star,
  Clock,
  Heart,
  Share2,
  Eye,
  Plus,
  X,
  ArrowLeft,
  Sparkles,
  Crown,
  Zap,
  CheckCircle2,
  Upload,
  HeartPulse,
  GraduationCap,
  BarChart3,
  ShoppingCart,
  Store,
  Package,
  Users,
  TrendingUp,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { api } from "../services/api";
import { Header } from "../components/Header";
import { clearSession, getCurrentSession, type AuthUser } from "../services/auth";

export interface Template {
  id: string;
  name: string;
  description: string;
  author?: string;
  authorAvatar?: string;
  category: string;
  icon: any;
  color: string;
  downloads?: number;
  rating?: number;
  reviews?: number;
  price?: "free" | "premium";
  isFeatured?: boolean;
  isNew?: boolean;
  tags?: string[];
  preview: {
    widgets?: number;
    fields?: number;
    integrations?: string[];
  };
  lastUpdated?: string;
}

interface TemplatePageProps {
  onBack?: () => void;
  onCloneTemplate?: (templateId: string) => void;
  templates?: Template[];
  currentUser?: AuthUser | null;
}

export function TemplatePage({ onBack, onCloneTemplate, templates = [], currentUser }: TemplatePageProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [likedTemplates, setLikedTemplates] = useState<Set<string>>(new Set());
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<Template[]>(templates);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerUser, setHeaderUser] = useState<AuthUser | null>(currentUser || null);

  useEffect(() => {
    if (currentUser) {
      setHeaderUser(currentUser);
      return;
    }
    const session = getCurrentSession();
    if (session?.user) setHeaderUser(session.user);
  }, [currentUser]);

  useEffect(() => {
    if (templates.length) {
      setTemplateData(templates);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .get<{ dashboards: any[] }>("/api/templates/public/dashboards")
      .then((res) => {
        if (!active) return;
        const mapped: Template[] = (res.dashboards || []).map((d, idx) => {
          const domain = (d.type || "general").toLowerCase();
          const iconByDomain: Record<string, any> = {
            commerce: ShoppingCart,
            analytics: BarChart3,
            education: GraduationCap,
            healthcare: HeartPulse,
            general: LayoutDashboard,
          };
          const colorByDomain: Record<string, string> = {
            commerce: "bg-emerald-500",
            analytics: "bg-indigo-500",
            education: "bg-amber-500",
            healthcare: "bg-rose-500",
            general: "bg-slate-500",
          };
          return {
            id: d.id || `template-${idx}`,
            name: d.name || "Template",
            description: d.description || "Shared dashboard template",
            category: domain,
            icon: iconByDomain[domain] || LayoutDashboard,
            color: colorByDomain[domain] || "bg-slate-500",
            downloads: d.records || 0,
            rating: 4.8,
            reviews: 0,
            price: "free",
            isFeatured: idx < 2,
            isNew: idx < 3,
            tags: [d.type || domain],
            preview: { widgets: d.widgets || 0, fields: d.fields || d.tables || 0, integrations: [] },
            lastUpdated: d.updatedAt || d.createdAt || "",
          };
        });
        setTemplateData(mapped);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || "Failed to load templates");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [templates]);

  const categories = useMemo(() => {
    const entries = templateData.reduce((acc, t) => {
      const id = t.category || "general";
      const count = (acc.get(id)?.count || 0) + 1;
      acc.set(id, { id, label: id, count });
      return acc;
    }, new Map<string, { id: string; label: string; count: number }>());
    return [
      { id: "all", label: `All Templates${templateData.length ? ` (${templateData.length})` : ""}`, count: templateData.length },
      ...Array.from(entries.values()),
    ];
  }, [templateData]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return templateData.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        (template.tags || []).some((tag) => tag.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const featuredTemplates = filteredTemplates.filter((t) => t.isFeatured);
  const newTemplates = filteredTemplates.filter((t) => t.isNew);
  const templatesToUse = filteredTemplates;

  const handleLike = (templateId: string) => {
    setLikedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  };

  const handleCloneTemplate = (template: Template) => {
    onCloneTemplate?.(template.id);
  };

  const handleShareTemplate = async (template: Template) => {
    const url = `${window.location.origin}/template?id=${template.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTemplateId(template.id);
      setTimeout(() => setCopiedTemplateId((current) => (current === template.id ? null : current)), 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const TemplateCard = ({ template }: { template: Template }) => {
    const Icon = template.icon || LayoutDashboard;
    const isLiked = likedTemplates.has(template.id);

    return (
      <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border border-slate-200">
        <div className={`${template.color} p-5 relative h-28 flex items-center`}>
          <div className="absolute top-3 right-3 flex gap-2">
            {template.price === "premium" && (
              <Badge className="bg-yellow-400 text-yellow-900 border-0">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
            {template.isNew && <Badge className="bg-white/80 text-slate-700 border-0">New</Badge>}
          </div>
          <div className="bg-white/15 rounded-2xl p-3 w-12 h-12 flex items-center justify-center shadow-inner">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="ml-4 text-white">
            <p className="text-sm uppercase tracking-wide opacity-80">{template.category}</p>
            <h3 className="text-xl font-semibold">{template.name}</h3>
            <p className="text-sm opacity-80 line-clamp-1">{template.description}</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{template.preview.widgets ?? 0} widgets</span>
            <span>•</span>
            <span>{template.preview.fields ?? 0} fields</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{(template.authorAvatar || template.author || "T").slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{template.author || "Team"}</p>
                <p className="text-xs text-slate-500">{template.lastUpdated || "Recently updated"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleLike(template.id)}>
                <Heart className={`w-4 h-4 ${isLiked ? "text-red-500 fill-red-100" : "text-slate-500"}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleShareTemplate(template)}>
                <Share2 className="w-4 h-4 text-slate-500" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-500" />
                <span>{template.rating ?? "—"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Download className="w-4 h-4 text-emerald-500" />
                <span>{template.downloads ?? 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{template.lastUpdated || "—"}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setSelectedTemplate(template); setIsPreviewDialogOpen(true); }}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button size="sm" onClick={() => handleCloneTemplate(template)}>
                <Plus className="w-4 h-4 mr-2" />
                Use template
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        currentUser={headerUser}
        onManageDash={() => navigate("/managedash")}
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        onTemplateOpen={() => navigate("/template")}
        onLogout={() => {
          clearSession();
          setHeaderUser(null);
          navigate("/login");
        }}
      />
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <p className="text-sm text-slate-500">Public templates</p>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-indigo-500" />
                Template library
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="default" size="sm">
              <Sparkles className="w-4 h-4 mr-2" />
              Submit template
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {loading && <div className="text-center text-slate-500 py-10">Loading templates...</div>}
        {error && <div className="text-center text-red-600 text-sm">{error}</div>}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload template
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="ghost" size="sm">
                <Star className="h-4 w-4 mr-2" />
                Popular
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
            <TabsList className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="text-sm"
                >
                  {category.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="space-y-4">
              {filteredTemplates.length === 0 ? (
                <div className="border border-dashed rounded-lg p-10 text-center text-slate-500">
                  No templates yet. Toggle public or add one to get started.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map((template) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {featuredTemplates.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold">Featured</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </section>
          )}

          {newTemplates.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold">New</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {newTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit your template</DialogTitle>
            <DialogDescription>Upload a dashboard template to share publicly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Template name" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What does this template include?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input placeholder="analytics / commerce / crm ..." />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Select defaultValue="free">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewDialogOpen && !!selectedTemplate} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge>{selectedTemplate.category}</Badge>
                {selectedTemplate.price && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    {selectedTemplate.price === "premium" ? <Crown className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {selectedTemplate.price}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <p className="text-sm text-slate-500">Widgets</p>
                  <p className="text-xl font-semibold">{selectedTemplate.preview.widgets ?? 0}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-sm text-slate-500">Fields</p>
                  <p className="text-xl font-semibold">{selectedTemplate.preview.fields ?? 0}</p>
                </Card>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleCloneTemplate(selectedTemplate)}>Use template</Button>
                <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!copiedTemplateId} onOpenChange={() => setCopiedTemplateId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link copied</DialogTitle>
            <DialogDescription>Share this template link with your team.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
