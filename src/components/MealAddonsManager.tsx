import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  DollarSign, 
  Package, 
  Library,
  Check,
  Copy
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

// Restaurant-level addon (library)
interface RestaurantAddon {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  usage_count: number;
  created_at: string;
}

// Meal-specific addon instance
interface MealAddon {
  id: string;
  meal_id: string;
  restaurant_addon_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
}

interface MealAddonsManagerProps {
  mealId: string;
  mealName: string;
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ADDON_CATEGORIES = [
  { value: "premium_ingredients", label: "Premium Ingredients", color: "bg-amber-500/10 text-amber-600" },
  { value: "sides", label: "Sides", color: "bg-green-500/10 text-green-600" },
  { value: "extras", label: "Extras", color: "bg-blue-500/10 text-blue-600" },
  { value: "drinks", label: "Drinks", color: "bg-purple-500/10 text-purple-600" },
];

// Quick templates for common add-ons
const ADDON_TEMPLATES = [
  { name: "Extra Protein", description: "Double protein portion", price: 8, category: "premium_ingredients" },
  { name: "Avocado", description: "Fresh sliced avocado", price: 4, category: "premium_ingredients" },
  { name: "Extra Cheese", description: "Additional cheese", price: 3, category: "extras" },
  { name: "Side Rice", description: "Steamed rice portion", price: 3, category: "sides" },
  { name: "Side Salad", description: "Fresh garden salad", price: 4, category: "sides" },
  { name: "Soft Drink", description: "Coke, Sprite, or Fanta", price: 2, category: "drinks" },
  { name: "Water Bottle", description: "500ml mineral water", price: 1, category: "drinks" },
  { name: "Spicy Sauce", description: "Extra hot sauce", price: 1, category: "extras" },
];

export function MealAddonsManager({ mealId, mealName, restaurantId, open, onOpenChange }: MealAddonsManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("library");
  
  // Library state
  const [libraryAddons, setLibraryAddons] = useState<RestaurantAddon[]>([]);
  const [mealAddons, setMealAddons] = useState<MealAddon[]>([]);
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
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
    if (open && restaurantId) {
      fetchData();
    }
  }, [open, restaurantId, mealId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch restaurant's addon library
      const { data: libraryData, error: libraryError } = await supabase
        .from("restaurant_addons")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("category")
        .order("name");

      if (libraryError) throw libraryError;
      setLibraryAddons(libraryData || []);

      // Fetch meal's assigned addons
      const { data: mealData, error: mealError } = await supabase
        .from("meal_addons")
        .select("*")
        .eq("meal_id", mealId);

      if (mealError) throw mealError;
      setMealAddons(mealData || []);
    } catch (err) {
      console.error("Error fetching addons:", err);
      toast({
        title: "Error",
        description: "Failed to load add-ons",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAddonAssignedToMeal = (libraryAddonId: string) => {
    return mealAddons.some(ma => ma.restaurant_addon_id === libraryAddonId);
  };

  const toggleAddonForMeal = async (libraryAddon: RestaurantAddon) => {
    const isAssigned = isAddonAssignedToMeal(libraryAddon.id);
    
    try {
      if (isAssigned) {
        // Remove from meal
        const mealAddon = mealAddons.find(ma => ma.restaurant_addon_id === libraryAddon.id);
        if (mealAddon) {
          await supabase.from("meal_addons").delete().eq("id", mealAddon.id);
          setMealAddons(prev => prev.filter(ma => ma.id !== mealAddon.id));
          
          // Decrement usage count
          await supabase.rpc("decrement_addon_usage", { addon_id: libraryAddon.id });
        }
      } else {
        // Add to meal (copy from library)
        const { data, error } = await supabase
          .from("meal_addons")
          .insert({
            meal_id: mealId,
            restaurant_addon_id: libraryAddon.id,
          })
          .select()
          .single();

        if (error) throw error;
        
        // The trigger will copy the data
        setMealAddons(prev => [...prev, data]);
        
        // Increment usage count
        await supabase.rpc("increment_addon_usage", { addon_id: libraryAddon.id });
      }
      
      // Refresh library to get updated usage counts
      const { data: updatedLibrary } = await supabase
        .from("restaurant_addons")
        .select("*")
        .eq("restaurant_id", restaurantId);
      setLibraryAddons(updatedLibrary || []);
      
    } catch (err) {
      console.error("Error toggling addon:", err);
      toast({
        title: "Error",
        description: "Failed to update add-on",
        variant: "destructive",
      });
    }
  };

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
    if (!formData.name.trim()) {
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
        toast({ title: "Add-on updated in library" });
        
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
      } else {
        const { error } = await supabase
          .from("restaurant_addons")
          .insert(addonData);

        if (error) {
          if (error.message.includes("duplicate")) {
            toast({ 
              title: "Error", 
              description: "An add-on with this name already exists in your library",
              variant: "destructive"
            });
            setSaving(false);
            return;
          }
          throw error;
        }
        toast({ title: "Add-on added to library" });
      }

      setEditDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving addon:", err);
      toast({
        title: "Error",
        description: "Failed to save add-on",
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
    if (!addonToDelete) return;

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

      toast({ title: "Add-on deleted from library" });
      setDeleteDialogOpen(false);
      setAddonToDelete(null);
      fetchData();
    } catch (err) {
      console.error("Error deleting addon:", err);
      toast({
        title: "Error",
        description: "Failed to delete add-on",
        variant: "destructive",
      });
    }
  };

  const getCategoryLabel = (category: string) => {
    return ADDON_CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getCategoryColor = (category: string) => {
    return ADDON_CATEGORIES.find((c) => c.value === category)?.color || "bg-gray-500/10 text-gray-600";
  };

  const groupedLibraryAddons = libraryAddons.reduce((acc, addon) => {
    if (!acc[addon.category]) {
      acc[addon.category] = [];
    }
    acc[addon.category].push(addon);
    return acc;
  }, {} as Record<string, RestaurantAddon[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Manage Add-ons: {mealName}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="library" className="flex items-center gap-2">
                <Library className="h-4 w-4" />
                Your Library
              </TabsTrigger>
              <TabsTrigger value="meal" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                This Meal
                {mealAddons.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{mealAddons.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="library" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-medium">Add-on Library</h3>
                  <p className="text-xs text-muted-foreground">
                    Create once, use on any meal. Click to toggle for this meal.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setTemplateDialogOpen(true)}
                  >
                    Templates
                  </Button>
                  <Button onClick={openAddDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : libraryAddons.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Library className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground mb-3">Your library is empty</p>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={() => setTemplateDialogOpen(true)} variant="outline" size="sm">
                        Use Template
                      </Button>
                      <Button onClick={openAddDialog} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Create First
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedLibraryAddons).map(([category, categoryAddons]) => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getCategoryColor(category)}>
                          {getCategoryLabel(category)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {categoryAddons.length} items
                        </span>
                      </div>
                      <div className="space-y-2">
                        {categoryAddons.map((addon) => {
                          const isAssigned = isAddonAssignedToMeal(addon.id);
                          return (
                            <div
                              key={addon.id}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                isAssigned 
                                  ? "bg-primary/5 border-primary/20" 
                                  : "bg-muted/50 border-transparent hover:bg-muted"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{addon.name}</p>
                                  {isAssigned && (
                                    <Badge variant="default" className="text-xs">
                                      <Check className="h-3 w-3 mr-1" />
                                      Active
                                    </Badge>
                                  )}
                                  {!addon.is_available && (
                                    <Badge variant="secondary" className="text-xs">Hidden</Badge>
                                  )}
                                </div>
                                {addon.description && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {addon.description}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  Used in {addon.usage_count} meal{addon.usage_count !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-primary">
                                  +{formatCurrency(addon.price)}
                                </span>
                                <Button
                                  variant={isAssigned ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => toggleAddonForMeal(addon)}
                                >
                                  {isAssigned ? (
                                    <>
                                      <Check className="h-4 w-4 mr-1" />
                                      Added
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(addon)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="meal" className="space-y-4 mt-4">
              <div>
                <h3 className="text-sm font-medium">Active Add-ons for This Meal</h3>
                <p className="text-xs text-muted-foreground">
                  These add-ons are available to customers for {mealName}
                </p>
              </div>

              {mealAddons.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground mb-3">No add-ons for this meal yet</p>
                    <Button onClick={() => setActiveTab("library")} variant="outline" size="sm">
                      <Library className="h-4 w-4 mr-2" />
                      Go to Library
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {mealAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{addon.name}</p>
                          <Badge className={getCategoryColor(addon.category)}>
                            {getCategoryLabel(addon.category)}
                          </Badge>
                        </div>
                        {addon.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {addon.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-primary">
                          +{formatCurrency(addon.price)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const libraryAddon = libraryAddons.find(la => la.id === addon.restaurant_addon_id);
                            if (libraryAddon) toggleAddonForMeal(libraryAddon);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Quick Add from Templates
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose a template to quickly add common add-ons to your library
            </p>
            <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
              {ADDON_TEMPLATES.map((template, index) => (
                <button
                  key={index}
                  onClick={() => applyTemplate(template)}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{template.name}</p>
                      <Badge className={getCategoryColor(template.category)}>
                        {getCategoryLabel(template.category)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">+{formatCurrency(template.price)}</p>
                    <Copy className="h-4 w-4 text-muted-foreground mt-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Add-on Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddon ? "Edit Library Add-on" : "Add to Library"}</DialogTitle>
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
                  Price
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
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAddon ? "Update Library" : "Add to Library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete from Library?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{addonToDelete?.name}" from your library and remove it from all meals. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
