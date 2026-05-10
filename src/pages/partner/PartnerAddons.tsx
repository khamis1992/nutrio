import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Package,
  DollarSign,
  BarChart3,
  Check,
} from "lucide-react";
import { PartnerLayout } from "@/components/PartnerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";

interface RestaurantAddon {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  usage_count: number;
  created_at: string;
}

const ADDON_CATEGORIES = [
  { value: "premium_ingredients", label: "Premium Ingredients", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "sides", label: "Sides", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  { value: "extras", label: "Extras", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "drinks", label: "Drinks", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
];

// Quick templates for common add-ons
const ADDON_TEMPLATES = [
  { name: "Extra Protein", description: "Double protein portion", price: 8, category: "premium_ingredients" },
  { name: "Grilled Chicken", description: "Extra grilled chicken breast", price: 10, category: "premium_ingredients" },
  { name: "Salmon Fillet", description: "Fresh salmon fillet", price: 15, category: "premium_ingredients" },
  { name: "Avocado", description: "Fresh sliced avocado", price: 4, category: "premium_ingredients" },
  { name: "Extra Cheese", description: "Additional cheese topping", price: 3, category: "extras" },
  { name: "Spicy Sauce", description: "Extra hot sauce", price: 1, category: "extras" },
  { name: "Garlic Bread", description: "Toasted garlic bread", price: 3, category: "sides" },
  { name: "Side Rice", description: "Steamed rice portion", price: 3, category: "sides" },
  { name: "Side Salad", description: "Fresh garden salad", price: 4, category: "sides" },
  { name: "French Fries", description: "Crispy french fries", price: 4, category: "sides" },
  { name: "Soft Drink", description: "Coke, Sprite, or Fanta", price: 2, category: "drinks" },
  { name: "Water Bottle", description: "500ml mineral water", price: 1, category: "drinks" },
  { name: "Fresh Juice", description: "Orange or apple juice", price: 4, category: "drinks" },
];

const PartnerAddons = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [addons, setAddons] = useState<RestaurantAddon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<RestaurantAddon | null>(null);
  const [addonToDelete, setAddonToDelete] = useState<RestaurantAddon | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    category: "extras",
    is_available: true,
  });

  useEffect(() => {
    if (user) {
      fetchRestaurantAndAddons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchRestaurantAndAddons = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      if (!restaurant) {
        navigate("/partner");
        return;
      }

      setRestaurantId(restaurant.id);
      await fetchAddons(restaurant.id);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load add-ons",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAddons = async (rid: string) => {
    const { data, error } = await supabase
      .from("restaurant_addons")
      .select("*")
      .eq("restaurant_id", rid)
      .order("category")
      .order("name");

    if (error) {
      console.error("Error fetching addons:", error);
      return;
    }

    setAddons(data || []);
  };

  const filteredAddons = addons.filter((addon) => {
    const matchesSearch = addon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         addon.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || addon.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedAddons = filteredAddons.reduce((acc, addon) => {
    if (!acc[addon.category]) {
      acc[addon.category] = [];
    }
    acc[addon.category].push(addon);
    return acc;
  }, {} as Record<string, RestaurantAddon[]>);

  const openAddDialog = () => {
    setEditingAddon(null);
    setFormData({
      name: "",
      description: "",
      price: 0,
      category: "extras",
      is_available: true,
    });
    setEditDialogOpen(true);
  };

  const openEditDialog = (addon: RestaurantAddon) => {
    setEditingAddon(addon);
    setFormData({
      name: addon.name,
      description: addon.description || "",
      price: addon.price,
      category: addon.category,
      is_available: addon.is_available,
    });
    setEditDialogOpen(true);
  };

  const applyTemplate = (template: typeof ADDON_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      description: template.description,
      price: template.price,
      category: template.category,
      is_available: true,
    });
    setTemplateDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !restaurantId) {
      toast({
        title: "Error",
        description: "Add-on name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const addonData = {
        restaurant_id: restaurantId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price,
        category: formData.category,
        is_available: formData.is_available,
      };

      if (editingAddon) {
        const { error } = await supabase
          .from("restaurant_addons")
          .update(addonData)
          .eq("id", editingAddon.id);

        if (error) throw error;

        // Also update any meal_addons that reference this
        await supabase
          .from("meal_addons")
          .update({
            name: addonData.name,
            description: addonData.description,
            price: addonData.price,
            category: addonData.category,
            is_available: addonData.is_available,
          })
          .eq("restaurant_addon_id", editingAddon.id);

        toast({ title: "Add-on updated successfully" });
      } else {
        const { error } = await supabase
          .from("restaurant_addons")
          .insert(addonData);

        if (error) {
          if (error.message.includes("duplicate")) {
            toast({
              title: "Error",
              description: "An add-on with this name already exists",
              variant: "destructive",
            });
            setSaving(false);
            return;
          }
          throw error;
        }
        toast({ title: "Add-on created successfully" });
      }

      setEditDialogOpen(false);
      fetchAddons(restaurantId);
    } catch (error: unknown) {
      console.error("Error saving addon:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save add-on",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (addon: RestaurantAddon) => {
    setAddonToDelete(addon);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!addonToDelete || !restaurantId) return;

    try {
      // First delete all meal_addons referencing this
      await supabase
        .from("meal_addons")
        .delete()
        .eq("restaurant_addon_id", addonToDelete.id);

      // Then delete from library
      const { error } = await supabase
        .from("restaurant_addons")
        .delete()
        .eq("id", addonToDelete.id);

      if (error) throw error;

      toast({ title: "Add-on deleted successfully" });
      setDeleteDialogOpen(false);
      setAddonToDelete(null);
      fetchAddons(restaurantId);
    } catch (error: unknown) {
      console.error("Error deleting addon:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete add-on",
        variant: "destructive",
      });
    }
  };

  const toggleAvailability = async (addon: RestaurantAddon) => {
    if (!restaurantId) return;

    try {
      const { error } = await supabase
        .from("restaurant_addons")
        .update({ is_available: !addon.is_available })
        .eq("id", addon.id);

      if (error) throw error;

      // Also update meal_addons
      await supabase
        .from("meal_addons")
        .update({ is_available: !addon.is_available })
        .eq("restaurant_addon_id", addon.id);

      setAddons((prev) =>
        prev.map((a) =>
          a.id === addon.id ? { ...a, is_available: !a.is_available } : a
        )
      );
    } catch (error) {
      console.error("Error toggling availability:", error);
      toast({
        title: "Error",
        description: "Failed to update availability",
        variant: "destructive",
      });
    }
  };

  const getCategoryLabel = (category: string) => {
    return ADDON_CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getCategoryColor = (category: string) => {
    return ADDON_CATEGORIES.find((c) => c.value === category)?.color || "bg-gray-500/10 text-gray-600 border-gray-500/20";
  };

  const stats = {
    total: addons.length,
    active: addons.filter((a) => a.is_available).length,
    hidden: addons.filter((a) => !a.is_available).length,
    totalUsage: addons.reduce((sum, a) => sum + a.usage_count, 0),
  };

  if (loading) {
    return (
      <PartnerLayout title="Add-ons">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Add-ons" subtitle="Manage your restaurant's add-on library">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Add-ons</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsage}</p>
                  <p className="text-xs text-muted-foreground">Total Usage</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {addons.length > 0
                      ? formatCurrency(addons.reduce((sum, a) => sum + a.price, 0) / addons.length)
                      : "QAR 0"}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. Price</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 w-full sm:w-auto">
            <Input
              placeholder="Search add-ons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ADDON_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
              Templates
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Add-on
            </Button>
          </div>
        </div>

        {/* Add-ons List */}
        {addons.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No add-ons in your library yet</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
                  Use Templates
                </Button>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Add-on
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : filteredAddons.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No add-ons match your search</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAddons).map(([category, categoryAddons]) => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getCategoryColor(category)}>
                        {getCategoryLabel(category)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {categoryAddons.length} items
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categoryAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        addon.is_available
                          ? "bg-background border-border"
                          : "bg-muted/50 border-transparent opacity-60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{addon.name}</p>
                          {!addon.is_available && (
                            <Badge variant="secondary">Hidden</Badge>
                          )}
                        </div>
                        {addon.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {addon.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Used in {addon.usage_count} meal{addon.usage_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">
                            +{formatCurrency(addon.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={addon.is_available}
                            onCheckedChange={() => toggleAvailability(addon)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(addon)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmDelete(addon)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Quick Add from Templates
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose from pre-made templates to quickly add common add-ons to your library
            </p>
            <div className="space-y-4">
              {ADDON_CATEGORIES.map((category) => {
                const templates = ADDON_TEMPLATES.filter((t) => t.category === category.value);
                if (templates.length === 0) return null;

                return (
                  <div key={category.value}>
                    <Badge className={`mb-2 ${category.color}`}>
                      {category.label}
                    </Badge>
                    <div className="grid gap-2">
                      {templates.map((template, index) => (
                        <button
                          key={index}
                          onClick={() => applyTemplate(template)}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                        >
                          <div>
                            <p className="font-medium">{template.name}</p>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">+{formatCurrency(template.price)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAddon ? "Edit Add-on" : "Create New Add-on"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Extra Avocado"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Price (QAR)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDON_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Available for customers</Label>
              <Switch
                checked={formData.is_available}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_available: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAddon ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Add-on?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{addonToDelete?.name}" from your library and remove it from all meals. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PartnerLayout>
  );
};

export default PartnerAddons;
