import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Edit2, Trash2, Loader2, DollarSign, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

interface MealAddon {
  id: string;
  meal_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
}

interface MealAddonsManagerProps {
  mealId: string;
  mealName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ADDON_CATEGORIES = [
  { value: "premium_ingredients", label: "Premium Ingredients" },
  { value: "sides", label: "Sides" },
  { value: "extras", label: "Extras" },
  { value: "drinks", label: "Drinks" },
];

export function MealAddonsManager({ mealId, mealName, open, onOpenChange }: MealAddonsManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addons, setAddons] = useState<MealAddon[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<MealAddon | null>(null);
  const [addonToDelete, setAddonToDelete] = useState<MealAddon | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    category: "extras",
    is_available: true,
  });

  useEffect(() => {
    if (open && mealId) {
      fetchAddons();
    }
  }, [open, mealId]);

  const fetchAddons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meal_addons")
        .select("*")
        .eq("meal_id", mealId)
        .order("category")
        .order("name");

      if (error) throw error;
      setAddons(data || []);
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

  const openEditDialog = (addon: MealAddon) => {
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
        meal_id: mealId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price,
        category: formData.category,
        is_available: formData.is_available,
      };

      if (editingAddon) {
        const { error } = await supabase
          .from("meal_addons")
          .update(addonData)
          .eq("id", editingAddon.id);

        if (error) throw error;
        toast({ title: "Add-on updated" });
      } else {
        const { error } = await supabase
          .from("meal_addons")
          .insert(addonData);

        if (error) throw error;
        toast({ title: "Add-on added" });
      }

      setEditDialogOpen(false);
      fetchAddons();
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

  const confirmDelete = (addon: MealAddon) => {
    setAddonToDelete(addon);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!addonToDelete) return;

    try {
      const { error } = await supabase
        .from("meal_addons")
        .delete()
        .eq("id", addonToDelete.id);

      if (error) throw error;

      toast({ title: "Add-on deleted" });
      setDeleteDialogOpen(false);
      setAddonToDelete(null);
      fetchAddons();
    } catch (err) {
      console.error("Error deleting addon:", err);
      toast({
        title: "Error",
        description: "Failed to delete add-on",
        variant: "destructive",
      });
    }
  };

  const toggleAvailability = async (addon: MealAddon) => {
    try {
      const { error } = await supabase
        .from("meal_addons")
        .update({ is_available: !addon.is_available })
        .eq("id", addon.id);

      if (error) throw error;

      setAddons((prev) =>
        prev.map((a) =>
          a.id === addon.id ? { ...a, is_available: !a.is_available } : a
        )
      );
    } catch (err) {
      console.error("Error toggling availability:", err);
    }
  };

  const getCategoryLabel = (category: string) => {
    return ADDON_CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const groupedAddons = addons.reduce((acc, addon) => {
    if (!acc[addon.category]) {
      acc[addon.category] = [];
    }
    acc[addon.category].push(addon);
    return acc;
  }, {} as Record<string, MealAddon[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Manage Add-ons: {mealName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-end">
              <Button onClick={openAddDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : addons.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-3">No add-ons yet</p>
                  <Button onClick={openAddDialog} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Add-on
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedAddons).map(([category, categoryAddons]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      {getCategoryLabel(category)}
                    </h4>
                    <div className="space-y-2">
                      {categoryAddons.map((addon) => (
                        <div
                          key={addon.id}
                          className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 ${
                            !addon.is_available ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{addon.name}</p>
                              {!addon.is_available && (
                                <Badge variant="secondary" className="text-xs">Hidden</Badge>
                              )}
                            </div>
                            {addon.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {addon.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary">
                              +{formatCurrency(addon.price)}
                            </span>
                            <Switch
                              checked={addon.is_available}
                              onCheckedChange={() => toggleAvailability(addon)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(addon)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => confirmDelete(addon)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Add-on Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddon ? "Edit Add-on" : "Add New Add-on"}</DialogTitle>
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
              {editingAddon ? "Update" : "Add"}
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
              This will permanently delete "{addonToDelete?.name}". This action cannot be undone.
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
