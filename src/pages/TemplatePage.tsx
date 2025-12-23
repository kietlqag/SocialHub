import React, { useState } from "react";
import {
  LayoutDashboard,
  Search,
  Filter,
  Download,
  Star,
  TrendingUp,
  Clock,
  Users,
  Package,
  ShoppingCart,
  Store,
  BarChart3,
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

interface TemplatePageProps {
  onBack?: () => void;
  onCloneTemplate?: (templateId: string) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  author: string;
  authorAvatar: string;
  category: string;
  icon: any;
  color: string;
  downloads: number;
  rating: number;
  reviews: number;
  price: "free" | "premium";
  isFeatured?: boolean;
  isNew?: boolean;
  tags: string[];
  preview: {
    widgets: number;
    fields: number;
    integrations: string[];
  };
  lastUpdated: string;
}

export function TemplatePage({ onBack, onCloneTemplate }: TemplatePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [likedTemplates, setLikedTemplates] = useState<Set<string>>(new Set());

  const categories = [
    { id: "all", label: "All Templates", count: 24 },
    { id: "business", label: "Business", count: 8 },
    { id: "ecommerce", label: "E-Commerce", count: 6 },
    { id: "analytics", label: "Analytics", count: 5 },
    { id: "crm", label: "CRM", count: 3 },
    { id: "project", label: "Project Management", count: 2 },
  ];

  const templates: Template[] = [
    {
      id: "1",
      name: "E-Commerce Dashboard Pro",
      description: "Complete e-commerce solution with inventory, orders, and customer analytics",
      author: "Sarah Chen",
      authorAvatar: "SC",
      category: "ecommerce",
      icon: ShoppingCart,
      color: "bg-purple-500",
      downloads: 12543,
      rating: 4.9,
      reviews: 234,
      price: "premium",
      isFeatured: true,
      isNew: false,
      tags: ["Sales", "Inventory", "Analytics"],
      preview: {
        widgets: 15,
        fields: 45,
        integrations: ["Shopify", "WooCommerce", "Stripe"],
      },
      lastUpdated: "2 days ago",
    },
    {
      id: "2",
      name: "Sales Analytics Hub",
      description: "Track sales performance with real-time metrics and forecasting",
      author: "Michael Roberts",
      authorAvatar: "MR",
      category: "analytics",
      icon: TrendingUp,
      color: "bg-green-500",
      downloads: 8721,
      rating: 4.8,
      reviews: 156,
      price: "free",
      isFeatured: true,
      isNew: false,
      tags: ["Sales", "Reports", "KPIs"],
      preview: {
        widgets: 12,
        fields: 32,
        integrations: ["Salesforce", "HubSpot"],
      },
      lastUpdated: "1 week ago",
    },
    {
      id: "3",
      name: "Customer CRM System",
      description: "Manage customer relationships with contact tracking and pipeline management",
      author: "Emily Johnson",
      authorAvatar: "EJ",
      category: "crm",
      icon: Users,
      color: "bg-blue-500",
      downloads: 15234,
      rating: 4.7,
      reviews: 412,
      price: "free",
      isFeatured: false,
      isNew: true,
      tags: ["CRM", "Contacts", "Pipeline"],
      preview: {
        widgets: 10,
        fields: 28,
        integrations: ["Gmail", "Outlook", "Slack"],
      },
      lastUpdated: "3 days ago",
    },
    {
      id: "4",
      name: "Inventory Management",
      description: "Keep track of stock levels, suppliers, and warehouse operations",
      author: "David Kim",
      authorAvatar: "DK",
      category: "business",
      icon: Package,
      color: "bg-orange-500",
      downloads: 6543,
      rating: 4.6,
      reviews: 89,
      price: "free",
      isFeatured: false,
      isNew: true,
      tags: ["Inventory", "Stock", "Suppliers"],
      preview: {
        widgets: 8,
        fields: 24,
        integrations: ["QuickBooks", "Xero"],
      },
      lastUpdated: "5 days ago",
    },
    {
      id: "5",
      name: "Marketing Campaign Tracker",
      description: "Monitor marketing campaigns, ROI, and engagement metrics",
      author: "Lisa Anderson",
      authorAvatar: "LA",
      category: "analytics",
      icon: BarChart3,
      color: "bg-pink-500",
      downloads: 9876,
      rating: 4.9,
      reviews: 201,
      price: "premium",
      isFeatured: true,
      isNew: false,
      tags: ["Marketing", "ROI", "Campaigns"],
      preview: {
        widgets: 14,
        fields: 38,
        integrations: ["Google Ads", "Facebook", "LinkedIn"],
      },
      lastUpdated: "4 days ago",
    },
    {
      id: "6",
      name: "Project Task Manager",
      description: "Organize projects, tasks, and team collaboration in one place",
      author: "James Wilson",
      authorAvatar: "JW",
      category: "project",
      icon: LayoutDashboard,
      color: "bg-indigo-500",
      downloads: 11234,
      rating: 4.8,
      reviews: 178,
      price: "free",
      isFeatured: false,
      isNew: false,
      tags: ["Projects", "Tasks", "Team"],
      preview: {
        widgets: 11,
        fields: 30,
        integrations: ["Jira", "Trello", "Asana"],
      },
      lastUpdated: "1 week ago",
    },
    {
      id: "7",
      name: "Retail Store Manager",
      description: "Comprehensive retail solution with POS, inventory, and customer data",
      author: "Maria Garcia",
      authorAvatar: "MG",
      category: "ecommerce",
      icon: Store,
      color: "bg-cyan-500",
      downloads: 7654,
      rating: 4.7,
      reviews: 134,
      price: "premium",
      isFeatured: false,
      isNew: true,
      tags: ["Retail", "POS", "Sales"],
      preview: {
        widgets: 13,
        fields: 42,
        integrations: ["Square", "Shopify POS"],
      },
      lastUpdated: "2 days ago",
    },
    {
      id: "8",
      name: "Business Overview",
      description: "High-level business metrics and KPIs for executives",
      author: "Robert Taylor",
      authorAvatar: "RT",
      category: "business",
      icon: TrendingUp,
      color: "bg-emerald-500",
      downloads: 13456,
      rating: 4.9,
      reviews: 289,
      price: "free",
      isFeatured: true,
      isNew: false,
      tags: ["KPIs", "Executive", "Overview"],
      preview: {
        widgets: 9,
        fields: 22,
        integrations: ["Google Analytics", "Mixpanel"],
      },
      lastUpdated: "6 days ago",
    },
  ];

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredTemplates = templates.filter(t => t.isFeatured);
  const newTemplates = templates.filter(t => t.isNew);

  const handleLike = (templateId: string) => {
    setLikedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  const handleCloneTemplate = (template: Template) => {
    onCloneTemplate?.(template.id);
    // Show success message or redirect
  };

  const TemplateCard = ({ template }: { template: Template }) => {
    const Icon = template.icon;
    const isLiked = likedTemplates.has(template.id);

    return (
      <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/20">
        {/* Header with gradient */}
        <div className={`${template.color} p-6 relative`}>
          <div className="absolute top-3 right-3 flex gap-2">
            {template.price === "premium" && (
              <Badge className="bg-yellow-400 text-yellow-900 border-0">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
            {template.isNew && (
              <Badge className="bg-green-400 text-green-900 border-0">
                <Sparkles className="w-3 h-3 mr-1" />
                New
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-white">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Icon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{template.name}</h3>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                <span className="text-sm">{template.rating}</span>
                <span className="text-sm text-white/70 ml-1">({template.reviews})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {template.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-gray-500">Widgets</p>
              <p className="font-semibold text-sm">{template.preview.widgets}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Fields</p>
              <p className="font-semibold text-sm">{template.preview.fields}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Downloads</p>
              <p className="font-semibold text-sm">{template.downloads.toLocaleString()}</p>
            </div>
          </div>

          {/* Author */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {template.authorAvatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-gray-600">{template.author}</p>
                <p className="text-xs text-gray-400">{template.lastUpdated}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleLike(template.id);
              }}
              className="hover:bg-transparent"
            >
              <Heart
                className={`w-5 h-5 transition-all ${
                  isLiked ? "fill-red-500 text-red-500" : "text-gray-400"
                }`}
              />
            </Button>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                setSelectedTemplate(template);
                setIsPreviewDialogOpen(true);
              }}
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button
              className="w-full gap-2 bg-primary hover:bg-primary/90"
              onClick={() => handleCloneTemplate(template)}
            >
              <Download className="w-4 h-4" />
              Clone
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" onClick={onBack} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              <div>
                <h1 className="text-3xl text-gray-900">Template Marketplace</h1>
                <p className="text-gray-600 mt-1">
                  Browse and clone dashboard templates from the community
                </p>
              </div>
            </div>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={() => setIsUploadDialogOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Share Your Template
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search templates by name, description, or tags..."
                className="pl-10 h-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px] h-12">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              All Templates
            </TabsTrigger>
            <TabsTrigger value="featured" className="gap-2">
              <Star className="w-4 h-4" />
              Featured
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-2">
              <Sparkles className="w-4 h-4" />
              New Releases
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg text-gray-600 mb-2">No templates found</h3>
                <p className="text-gray-400">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="featured" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="new" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Template Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Share Your Template</DialogTitle>
            <DialogDescription>
              Share your dashboard template with the community and help others build faster
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Template Name</Label>
              <Input placeholder="e.g., Sales Analytics Dashboard" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what your template does and what problems it solves..."
                className="mt-1 min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="ecommerce">E-Commerce</SelectItem>
                    <SelectItem value="analytics">Analytics</SelectItem>
                    <SelectItem value="crm">CRM</SelectItem>
                    <SelectItem value="project">Project Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Template Type</Label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input placeholder="e.g., sales, analytics, reports" className="mt-1" />
            </div>
            <div>
              <Label>Select Dashboard to Share</Label>
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a dashboard" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main-business">Main Business Hub</SelectItem>
                  <SelectItem value="ecommerce-store">E-Commerce Store</SelectItem>
                  <SelectItem value="sales-analytics">Sales Analytics</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="gap-2" onClick={() => setIsUploadDialogOpen(false)}>
              <Share2 className="w-4 h-4" />
              Share Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl">{selectedTemplate.name}</DialogTitle>
                    <DialogDescription className="mt-2">
                      {selectedTemplate.description}
                    </DialogDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsPreviewDialogOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Author Info */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {selectedTemplate.authorAvatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedTemplate.author}</p>
                      <p className="text-sm text-gray-500">Updated {selectedTemplate.lastUpdated}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{selectedTemplate.rating}</span>
                      <span className="text-gray-400">({selectedTemplate.reviews} reviews)</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Download className="w-4 h-4" />
                      <span>{selectedTemplate.downloads.toLocaleString()} downloads</span>
                    </div>
                  </div>
                </div>

                {/* Preview Details */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <LayoutDashboard className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Widgets</p>
                        <p className="text-xl font-semibold">{selectedTemplate.preview.widgets}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Package className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Fields</p>
                        <p className="text-xl font-semibold">{selectedTemplate.preview.fields}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Zap className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Integrations</p>
                        <p className="text-xl font-semibold">{selectedTemplate.preview.integrations.length}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Integrations */}
                <div>
                  <h4 className="font-semibold mb-3">Integrations Included</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.preview.integrations.map((integration) => (
                      <Badge key={integration} className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {integration}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="font-semibold mb-3">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* What's Included */}
                <div>
                  <h4 className="font-semibold mb-3">What's Included</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Pre-configured dashboard structure</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Custom fields and data types</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Sample data for testing</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Documentation and setup guide</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                  Close
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => {
                    handleCloneTemplate(selectedTemplate);
                    setIsPreviewDialogOpen(false);
                  }}
                >
                  <Download className="w-4 h-4" />
                  Clone This Template
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
