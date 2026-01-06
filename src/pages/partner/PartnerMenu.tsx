import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { MealImageUpload } from "@/components/MealImageUpload";
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
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Flame,
  Clock,
  DollarSign,
  ImageIcon,
  Tag,
  Sparkles,
  CheckCircle2,
  Package,
  Crown,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { PartnerLayout } from "@/components/PartnerLayout";
import { MealAddonsManager } from "@/components/MealAddonsManager";

interface Meal {
  id: string;
  name: string;
  description: string | null;
  price: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  image_url: string | null;
  prep_time_minutes: number | null;
  is_available: boolean;
  is_vip_exclusive: boolean;
  rating: number;
  order_count: number;
  diet_tags?: string[];
}

interface DietTag {
  id: string;
  name: string;
  description: string | null;
}

const mealSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0.01, "Price must be greater than 0"),
  calories: z.number().min(1, "Calories required"),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
  fiber_g: z.number().min(0).optional(),
  prep_time_minutes: z.number().min(1).optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  is_available: z.boolean(),
  is_vip_exclusive: z.boolean(),
});

type MealFormData = z.infer<typeof mealSchema>;

const emptyMeal: MealFormData = {
  name: "",
  description: "",
  price: 0,
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  prep_time_minutes: 15,
  image_url: "",
  is_available: true,
  is_vip_exclusive: false,
};

const PartnerMenu = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dietTags, setDietTags] = useState<DietTag[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [mealToDelete, setMealToDelete] = useState<Meal | null>(null);
  const [formData, setFormData] = useState<MealFormData>(emptyMeal);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [addonsDialogOpen, setAddonsDialogOpen] = useState(false);
  const [selectedMealForAddons, setSelectedMealForAddons] = useState<Meal | null>(null);

  useEffect(() => {
    if (user) {
      fetchMeals();
      fetchDietTags();
    }
  }, [user]);

  const fetchDietTags = async () => {
    const { data, error } = await supabase
      .from("diet_tags")
      .select("*")
      .order("name");

    if (!error && data) {
      setDietTags(data);
    }
  };

  const fetchMeals = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get partner's restaurant
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

      // Fetch meals
      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("name");

      if (mealsError) throw mealsError;
      setMeals(mealsData || []);
    } catch (error) {
      console.error("Error fetching meals:", error);
      toast({
        title: "Error",
        description: "Failed to load menu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingMeal(null);
    setFormData(emptyMeal);
    setFormErrors({});
    setSelectedTags([]);
    setDialogOpen(true);
  };

  const openEditDialog = async (meal: Meal) => {
    setEditingMeal(meal);
    setFormData({
      name: meal.name,
      description: meal.description || "",
      price: parseFloat(meal.price.toString()),
      calories: meal.calories,
      protein_g: parseFloat(meal.protein_g.toString()),
      carbs_g: parseFloat(meal.carbs_g.toString()),
      fat_g: parseFloat(meal.fat_g.toString()),
      fiber_g: meal.fiber_g ? parseFloat(meal.fiber_g.toString()) : 0,
      prep_time_minutes: meal.prep_time_minutes || 15,
      image_url: meal.image_url || "",
      is_available: meal.is_available,
      is_vip_exclusive: meal.is_vip_exclusive,
    });
    setFormErrors({});

    // Fetch existing diet tags for this meal
    const { data: mealTags } = await supabase
      .from("meal_diet_tags")
      .select("diet_tag_id")
      .eq("meal_id", meal.id);

    setSelectedTags(mealTags?.map((t) => t.diet_tag_id) || []);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!restaurantId) return;

    const result = mealSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);

      const mealData = {
        restaurant_id: restaurantId,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        price: formData.price,
        calories: formData.calories,
        protein_g: formData.protein_g,
        carbs_g: formData.carbs_g,
        fat_g: formData.fat_g,
        fiber_g: formData.fiber_g || null,
        prep_time_minutes: formData.prep_time_minutes || 15,
        image_url: formData.image_url?.trim() || null,
        is_available: formData.is_available,
        is_vip_exclusive: formData.is_vip_exclusive,
      };

      let mealId = editingMeal?.id;

      if (editingMeal) {
        const { error } = await supabase
          .from("meals")
          .update(mealData)
          .eq("id", editingMeal.id);

        if (error) throw error;
      } else {
        const { data: newMeal, error } = await supabase
          .from("meals")
          .insert(mealData)
          .select("id")
          .single();

        if (error) throw error;
        mealId = newMeal.id;
      }

      // Update diet tags
      if (mealId) {
        // Remove existing tags
        await supabase
          .from("meal_diet_tags")
          .delete()
          .eq("meal_id", mealId);

        // Add new tags
        if (selectedTags.length > 0) {
          const tagInserts = selectedTags.map((tagId) => ({
            meal_id: mealId!,
            diet_tag_id: tagId,
          }));

          await supabase.from("meal_diet_tags").insert(tagInserts);
        }
      }

      toast({ title: editingMeal ? "Meal updated" : "Meal added" });

      setDialogOpen(false);
      fetchMeals();
    } catch (error) {
      console.error("Error saving meal:", error);
      toast({
        title: "Error",
        description: "Failed to save meal",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (meal: Meal) => {
    setMealToDelete(meal);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!mealToDelete) return;

    try {
      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", mealToDelete.id);

      if (error) throw error;

      toast({ title: "Meal deleted" });
      setDeleteDialogOpen(false);
      setMealToDelete(null);
      fetchMeals();
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast({
        title: "Error",
        description: "Failed to delete meal",
        variant: "destructive",
      });
    }
  };

  const toggleAvailability = async (meal: Meal) => {
    try {
      const { error } = await supabase
        .from("meals")
        .update({ is_available: !meal.is_available })
        .eq("id", meal.id);

      if (error) throw error;

      setMeals((prev) =>
        prev.map((m) =>
          m.id === meal.id ? { ...m, is_available: !m.is_available } : m
        )
      );

      toast({
        title: meal.is_available ? "Meal hidden" : "Meal visible",
        description: `${meal.name} is now ${meal.is_available ? "unavailable" : "available"}`,
      });
    } catch (error) {
      console.error("Error toggling availability:", error);
    }
  };

  const handleImageUploaded = async (imageUrl: string) => {
    if (!imageUrl) return;

    setAnalyzing(true);
    try {
      const availableTagNames = dietTags.map((t) => t.name);
      
      const { data, error } = await supabase.functions.invoke("analyze-meal-image", {
        body: { imageUrl, availableTags: availableTagNames },
      });

      if (error) throw error;

      if (data?.mealDetails) {
        const details = data.mealDetails;
        
        // Update form data with AI suggestions
        setFormData((prev) => ({
          ...prev,
          name: details.name || prev.name,
          description: details.description || prev.description,
          price: details.suggested_price || prev.price,
          calories: details.calories || prev.calories,
          protein_g: details.protein_g || prev.protein_g,
          carbs_g: details.carbs_g || prev.carbs_g,
          fat_g: details.fat_g || prev.fat_g,
          fiber_g: details.fiber_g || prev.fiber_g,
          prep_time_minutes: details.prep_time_minutes || prev.prep_time_minutes,
        }));

        // Map diet tag names to IDs
        if (details.diet_tags && Array.isArray(details.diet_tags)) {
          const matchedTagIds = dietTags
            .filter((tag) =>
              details.diet_tags.some(
                (aiTag: string) => aiTag.toLowerCase() === tag.name.toLowerCase()
              )
            )
            .map((tag) => tag.id);
          setSelectedTags(matchedTagIds);
        }

        // Trigger success animation
        setAnalysisComplete(true);
        setTimeout(() => setAnalysisComplete(false), 2000);

        toast({
          title: "AI has auto-filled the meal details",
          description: "Review and adjust the values before saving.",
        });
      }
    } catch (error: any) {
      console.error("Error analyzing meal image:", error);
      const errorMessage = error?.message || "Could not analyze image. Please fill in details manually.";
      toast({
        title: "Analysis failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <PartnerLayout title="Menu">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Menu" subtitle="Manage your restaurant's menu items">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Menu Items ({meals.length})</h2>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Meal
          </Button>
        </div>

        {meals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">No meals in your menu yet</p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Meal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {meals.map((meal) => (
              <Card key={meal.id} className={!meal.is_available ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {meal.image_url && (
                      <img
                        src={meal.image_url}
                        alt={meal.name}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            {meal.name}
                            {meal.is_vip_exclusive && (
                              <Badge variant="outline" className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/50 text-amber-600">
                                <Crown className="h-3 w-3 mr-1" />
                                VIP
                              </Badge>
                            )}
                          </h3>
                          {meal.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {meal.description}
                            </p>
                          )}
                        </div>
                        <Badge variant={meal.is_available ? "default" : "secondary"}>
                          {meal.is_available ? "Available" : "Hidden"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${meal.price.toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3" />
                          {meal.calories} kcal
                        </span>
                        {meal.prep_time_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {meal.prep_time_minutes} min
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(meal)}>
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMealForAddons(meal);
                            setAddonsDialogOpen(true);
                          }}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Add-ons
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleAvailability(meal)}
                        >
                          {meal.is_available ? "Hide" : "Show"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => confirmDelete(meal)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Meal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeal ? "Edit Meal" : "Add New Meal"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Meal Image
              </Label>
              <MealImageUpload
                currentImageUrl={formData.image_url || null}
                onImageChange={(url) => setFormData({ ...formData, image_url: url || "" })}
                onImageUploaded={(url) => handleImageUploaded(url)}
                isAnalyzing={analyzing}
              />
              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                  <Sparkles className="h-4 w-4" />
                  AI is analyzing your image...
                </div>
              )}
              {analysisComplete && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Details auto-filled! Review below.
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Grilled Chicken Salad"
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A healthy and delicious meal..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price || ""}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
                {formErrors.price && <p className="text-xs text-destructive">{formErrors.price}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="prep_time">Prep Time (min)</Label>
                <Input
                  id="prep_time"
                  type="number"
                  value={formData.prep_time_minutes || ""}
                  onChange={(e) => setFormData({ ...formData, prep_time_minutes: parseInt(e.target.value) || 15 })}
                />
              </div>
            </div>

            {/* Nutrition */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                Nutrition Information
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Calories *</Label>
                  <Input
                    type="number"
                    value={formData.calories || ""}
                    onChange={(e) => setFormData({ ...formData, calories: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Protein (g)</Label>
                  <Input
                    type="number"
                    value={formData.protein_g || ""}
                    onChange={(e) => setFormData({ ...formData, protein_g: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Carbs (g)</Label>
                  <Input
                    type="number"
                    value={formData.carbs_g || ""}
                    onChange={(e) => setFormData({ ...formData, carbs_g: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fat (g)</Label>
                  <Input
                    type="number"
                    value={formData.fat_g || ""}
                    onChange={(e) => setFormData({ ...formData, fat_g: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Diet Tags */}
            {dietTags.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Diet Tags
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {dietTags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={tag.id}
                        checked={selectedTags.includes(tag.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTags([...selectedTags, tag.id]);
                          } else {
                            setSelectedTags(selectedTags.filter((t) => t !== tag.id));
                          }
                        }}
                      />
                      <label htmlFor={tag.id} className="text-sm cursor-pointer">
                        {tag.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIP Exclusive */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-yellow-500/5">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-amber-500" />
                <div>
                  <Label>VIP Exclusive</Label>
                  <p className="text-xs text-muted-foreground">Only VIP subscribers can order this meal</p>
                </div>
              </div>
              <Switch
                checked={formData.is_vip_exclusive}
                onCheckedChange={(checked) => setFormData({ ...formData, is_vip_exclusive: checked })}
              />
            </div>

            {/* Availability */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Available</Label>
                <p className="text-xs text-muted-foreground">Show this meal to customers</p>
              </div>
              <Switch
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingMeal ? "Update" : "Add Meal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{mealToDelete?.name}"? This action cannot be undone.
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

      {/* Add-ons Manager */}
      {selectedMealForAddons && (
        <MealAddonsManager
          mealId={selectedMealForAddons.id}
          mealName={selectedMealForAddons.name}
          open={addonsDialogOpen}
          onOpenChange={setAddonsDialogOpen}
        />
      )}
    </PartnerLayout>
  );
};

export default PartnerMenu;
