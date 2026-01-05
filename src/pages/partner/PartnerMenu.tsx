import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Store,
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Package,
  Settings,
  ArrowLeft,
  Flame,
  Clock,
  DollarSign,
  ImageIcon,
  Tag,
  Sparkles,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

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
};

const PartnerMenu = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
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
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/partner")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold">Menu Management</h1>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Meal
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
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
          meals.map((meal) => (
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
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{meal.name}</h3>
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
                        {parseFloat(meal.price.toString()).toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        {meal.calories} kcal
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {meal.prep_time_minutes || 15} min
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(meal)}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAvailability(meal)}
                      >
                        {meal.is_available ? "Hide" : "Show"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmDelete(meal)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeal ? "Edit Meal" : "Add New Meal"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Image Upload - First Step */}
            <div className="space-y-2">
              <MealImageUpload
                currentImageUrl={formData.image_url}
                onImageChange={(url) => setFormData({ ...formData, image_url: url || "" })}
                mealId={editingMeal?.id}
                onImageUploaded={handleImageUploaded}
                isAnalyzing={analyzing}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/50 p-2 rounded-md">
                <Sparkles className="h-3 w-3 text-primary" />
                Upload a photo and AI will auto-fill all meal details for you
              </p>
            </div>

            {analyzing ? (
              /* Skeleton Loading State */
              <div className="space-y-4 animate-pulse">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-sm text-primary font-medium">AI is analyzing your meal...</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Actual Form Fields */
              <>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Grilled Chicken Salad"
                    className={formErrors.name ? "border-destructive" : ""}
                  />
                  {formErrors.name && (
                    <p className="text-sm text-destructive">{formErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Fresh greens with grilled chicken..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price ($) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price || ""}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className={formErrors.price ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Calories *</Label>
                    <Input
                      type="number"
                      value={formData.calories || ""}
                      onChange={(e) => setFormData({ ...formData, calories: parseInt(e.target.value) || 0 })}
                      className={formErrors.calories ? "border-destructive" : ""}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Protein (g)</Label>
                    <Input
                      type="number"
                      value={formData.protein_g || ""}
                      onChange={(e) => setFormData({ ...formData, protein_g: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Carbs (g)</Label>
                    <Input
                      type="number"
                      value={formData.carbs_g || ""}
                      onChange={(e) => setFormData({ ...formData, carbs_g: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fat (g)</Label>
                    <Input
                      type="number"
                      value={formData.fat_g || ""}
                      onChange={(e) => setFormData({ ...formData, fat_g: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fiber (g)</Label>
                    <Input
                      type="number"
                      value={formData.fiber_g || ""}
                      onChange={(e) => setFormData({ ...formData, fiber_g: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prep Time (min)</Label>
                    <Input
                      type="number"
                      value={formData.prep_time_minutes || ""}
                      onChange={(e) => setFormData({ ...formData, prep_time_minutes: parseInt(e.target.value) || 15 })}
                    />
                  </div>
                </div>

                {/* Diet Tags */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Diet Tags
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {dietTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`tag-${tag.id}`}
                          checked={selectedTags.includes(tag.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTags([...selectedTags, tag.id]);
                            } else {
                              setSelectedTags(selectedTags.filter((t) => t !== tag.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`tag-${tag.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {tag.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Available for ordering</Label>
                  <Switch
                    checked={formData.is_available}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
                  />
                </div>
              </>
            )}
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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="flex justify-around py-2">
            <Link to="/partner" className="flex-col h-auto py-2 flex items-center text-muted-foreground hover:text-foreground">
              <Store className="h-5 w-5" />
              <span className="text-xs mt-1">Dashboard</span>
            </Link>
            <Link to="/partner/menu" className="flex-col h-auto py-2 flex items-center text-primary">
              <UtensilsCrossed className="h-5 w-5" />
              <span className="text-xs mt-1">Menu</span>
            </Link>
            <Link to="/partner/orders" className="flex-col h-auto py-2 flex items-center text-muted-foreground hover:text-foreground">
              <Package className="h-5 w-5" />
              <span className="text-xs mt-1">Orders</span>
            </Link>
            <Link to="/partner/settings" className="flex-col h-auto py-2 flex items-center text-muted-foreground hover:text-foreground">
              <Settings className="h-5 w-5" />
              <span className="text-xs mt-1">Settings</span>
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default PartnerMenu;
