import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  ImageIcon,
  Tag,
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
// import { formatCurrency } from "@/lib/currency"; // REMOVED: Meals don't have prices in subscription model

interface Meal {
  id: string;
  name: string;
  description: string | null;
  price: number | null;  // DEPRECATED: Meals are included in subscription
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

// AI Meal Analysis Types
interface AIMealDetails {
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  prep_time_minutes: number;
  // suggested_price: REMOVED - Pricing is set by platform, not suggested by AI
  diet_tags: string[];
}

interface DetectedFoodItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface AIAnalysisResponse {
  success: boolean;
  mealDetails?: AIMealDetails;
  detectedItems?: DetectedFoodItem[];
  error?: string;
  note?: string;
  provider?: string;
}

const mealSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  // price: REMOVED - Meals are included in subscription, restaurants don't set prices
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
  // price: REMOVED - Meals are included in subscription
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

export default function PartnerMenu() {
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
  
  // Add-on selection state
  const [libraryAddons, setLibraryAddons] = useState<{id: string, name: string, price: number, category: string}[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

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

  const fetchLibraryAddons = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("restaurant_addons")
      .select("id, name, price, category")
      .eq("restaurant_id", restaurantId)
      .eq("is_available", true)
      .order("category")
      .order("name");
    setLibraryAddons(data || []);
  };

  const openAddDialog = () => {
    setEditingMeal(null);
    setFormData(emptyMeal);
    setFormErrors({});
    setSelectedTags([]);
    setSelectedAddons([]);
    fetchLibraryAddons();
    setDialogOpen(true);
  };

  const openEditDialog = async (meal: Meal) => {
    setEditingMeal(meal);
    setFormData({
      name: meal.name,
      description: meal.description || "",
      // price: REMOVED - Meals are included in subscription
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      fiber_g: meal.fiber_g || 0,
      prep_time_minutes: meal.prep_time_minutes || 15,
      image_url: meal.image_url || "",
      is_available: meal.is_available,
      is_vip_exclusive: meal.is_vip_exclusive,
    });
    setFormErrors({});

    // Fetch diet tags for this meal
    const { data } = await supabase
      .from("meal_diet_tags")
      .select("diet_tag_id")
      .eq("meal_id", meal.id);

    setSelectedTags(data?.map((t) => t.diet_tag_id) || []);
    setDialogOpen(true);
  };

  const openDeleteDialog = (meal: Meal) => {
    setMealToDelete(meal);
    setDeleteDialogOpen(true);
  };

  const handleInputChange = (field: keyof MealFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleImageChange = (url: string | null) => {
    setFormData((prev) => ({ ...prev, image_url: url || "" }));
  };

  const handleImageUploaded = async (imageUrl: string) => {
    if (!imageUrl) return;

    setAnalyzing(true);
    try {
      const availableTagNames = dietTags.map((t) => t.name);
      
      console.log("Calling analyze-meal-image with imageUrl:", imageUrl);
      
      const { data, error } = await supabase.functions.invoke("analyze-meal-image", {
        body: { imageUrl, availableTags: availableTagNames },
      });

      console.log("AI response:", data);

      if (error) {
        console.error("Function error:", error);
        throw error;
      }

      const response = data as AIAnalysisResponse;

      if (response?.mealDetails) {
        const details = response.mealDetails;
        
        // Check if we got meaningful data or just empty fallback
        const hasMeaningfulData = details.name || details.calories > 0 || details.description;
        
        if (!hasMeaningfulData) {
          toast({
            title: "AI Analysis",
            description: response.note || "Could not analyze image. Please fill in details manually.",
          });
          return;
        }
        
        // Update form data with AI suggestions
        setFormData((prev) => ({
          ...prev,
          name: details.name || prev.name,
          description: details.description || prev.description,
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
          title: "AI Analysis Complete",
          description: "Meal details have been auto-filled. Please review and adjust as needed.",
        });

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

  const validateForm = (): boolean => {
    const result = mealSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        errors[path] = err.message;
      });
      setFormErrors(errors);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !restaurantId) return;

    setSaving(true);
    try {
      const mealData = {
        restaurant_id: restaurantId,
        name: formData.name,
        description: formData.description || null,
        price: null, // DEPRECATED: Meals are included in subscription
        calories: formData.calories,
        protein_g: formData.protein_g,
        carbs_g: formData.carbs_g,
        fat_g: formData.fat_g,
        fiber_g: formData.fiber_g || null,
        prep_time_minutes: formData.prep_time_minutes || null,
        image_url: formData.image_url || null,
        is_available: formData.is_available,
        is_vip_exclusive: formData.is_vip_exclusive,
      };

      if (editingMeal) {
        // Update existing meal
        const { error } = await supabase
          .from("meals")
          .update(mealData)
          .eq("id", editingMeal.id);

        if (error) throw error;

        // Update diet tags
        await supabase.from("meal_diet_tags").delete().eq("meal_id", editingMeal.id);

        if (selectedTags.length > 0) {
          await supabase.from("meal_diet_tags").insert(
            selectedTags.map((tagId) => ({
              meal_id: editingMeal.id,
              diet_tag_id: tagId,
            }))
          );
        }

        toast({ title: "Meal updated successfully" });
      } else {
        // Create new meal
        const { data, error } = await supabase
          .from("meals")
          .insert(mealData)
          .select()
          .single();

        if (error) throw error;

        // Add diet tags
        if (selectedTags.length > 0 && data) {
          await supabase.from("meal_diet_tags").insert(
            selectedTags.map((tagId) => ({
              meal_id: data.id,
              diet_tag_id: tagId,
            }))
          );
        }

        // Add selected add-ons from library
        if (selectedAddons.length > 0 && data) {
          await supabase.from("meal_addons").insert(
            selectedAddons.map((addonId) => ({
              meal_id: data.id,
              restaurant_addon_id: addonId,
            }))
          );
          
          // Increment usage count for each addon
          for (const addonId of selectedAddons) {
            await supabase.rpc("increment_addon_usage", { addon_id: addonId });
          }
        }

        toast({ title: "Meal created successfully" });
        
        // Close dialog and refresh meal list
        setDialogOpen(false);
        fetchMeals();
      }
    } catch (error: any) {
      console.error("Error saving meal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save meal",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!mealToDelete) return;

    try {
      const { error } = await supabase.from("meals").delete().eq("id", mealToDelete.id);

      if (error) throw error;

      toast({ title: "Meal deleted successfully" });
      setDeleteDialogOpen(false);
      setMealToDelete(null);
      fetchMeals();
    } catch (error: any) {
      console.error("Error deleting meal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete meal",
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
    } catch (error) {
      console.error("Error toggling availability:", error);
      toast({
        title: "Error",
        description: "Failed to update availability",
        variant: "destructive",
      });
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
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Meal
          </Button>
        </div>

        {meals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No meals added yet</p>
              <Button onClick={openAddDialog} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Meal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {meals.map((meal) => (
              <Card key={meal.id} className={!meal.is_available ? "opacity-60" : undefined}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {meal.image_url ? (
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold truncate">{meal.name}</h3>
                        {meal.is_vip_exclusive && (
                          <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {meal.description || "No description"}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {/* Price REMOVED: Meals are included in subscription */}
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3" />
                          {meal.calories} cal
                        </span>
                        {meal.prep_time_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {meal.prep_time_minutes}m
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={meal.is_available}
                        onCheckedChange={() => toggleAvailability(meal)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {meal.is_available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedMealForAddons(meal);
                          setAddonsDialogOpen(true);
                        }}
                        title="Manage Add-ons"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(meal)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(meal)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingMeal ? "Edit Meal" : "Add New Meal"}
              {analysisComplete && (
                <CheckCircle2 className="h-5 w-5 text-green-500 animate-in fade-in zoom-in" />
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Image Upload */}
            <MealImageUpload
              currentImageUrl={formData.image_url}
              onImageChange={handleImageChange}
              mealId={editingMeal?.id}
              onImageUploaded={handleImageUploaded}
              isAnalyzing={analyzing}
            />

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Meal Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Grilled Salmon Salad"
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Describe the meal, ingredients, flavors..."
                rows={3}
              />
            </div>

            {/* Calories Row - Price REMOVED: Meals are included in subscription */}
            <div className="space-y-2">
              <Label htmlFor="calories">
                Calories <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Flame className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="calories"
                  type="number"
                  min="0"
                  value={formData.calories || ""}
                  onChange={(e) => handleInputChange("calories", parseInt(e.target.value) || 0)}
                  className={`pl-9 ${formErrors.calories ? "border-destructive" : ""}`}
                />
              </div>
              {formErrors.calories && (
                <p className="text-sm text-destructive">{formErrors.calories}</p>
              )}
            </div>

            {/* Macros Row */}
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="protein">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.protein_g || ""}
                  onChange={(e) => handleInputChange("protein_g", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.carbs_g || ""}
                  onChange={(e) => handleInputChange("carbs_g", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fat">Fat (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.fat_g || ""}
                  onChange={(e) => handleInputChange("fat_g", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiber">Fiber (g)</Label>
                <Input
                  id="fiber"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.fiber_g || ""}
                  onChange={(e) => handleInputChange("fiber_g", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Prep Time */}
            <div className="space-y-2">
              <Label htmlFor="prep_time">Preparation Time (minutes)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="prep_time"
                  type="number"
                  min="1"
                  value={formData.prep_time_minutes || ""}
                  onChange={(e) => handleInputChange("prep_time_minutes", parseInt(e.target.value) || undefined)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Diet Tags */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Diet Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {dietTags.map((tag) => (
                  <label
                    key={tag.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      selectedTags.includes(tag.id)
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/50 border-border hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      checked={selectedTags.includes(tag.id)}
                      onCheckedChange={() => handleTagToggle(tag.id)}
                      className="sr-only"
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Add-ons Selection */}
            {libraryAddons.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Add-ons
                  <span className="text-xs text-muted-foreground font-normal">
                    (Select from your library)
                  </span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {libraryAddons.map((addon) => (
                    <label
                      key={addon.id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                        selectedAddons.includes(addon.id)
                          ? "bg-primary/10 border-primary"
                          : "bg-muted/50 border-border hover:bg-muted"
                      }`}
                    >
                      <Checkbox
                        checked={selectedAddons.includes(addon.id)}
                        onCheckedChange={() => {
                          setSelectedAddons(prev => 
                            prev.includes(addon.id)
                              ? prev.filter(id => id !== addon.id)
                              : [...prev, addon.id]
                          );
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm">{addon.name}</span>
                      <span className="text-xs text-muted-foreground">+{addon.price} QAR</span>
                    </label>
                  ))}
                </div>
                {selectedAddons.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No add-ons selected. You can add them later from the menu.
                  </p>
                )}
              </div>
            )}

            {/* Availability & VIP */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_available}
                  onCheckedChange={(checked) => handleInputChange("is_available", checked)}
                />
                <Label>Available</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_vip_exclusive}
                  onCheckedChange={(checked) => handleInputChange("is_vip_exclusive", checked)}
                />
                <Label className="flex items-center gap-1">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  VIP Exclusive
                </Label>
              </div>
            </div>

            {/* Manage Add-ons Button (for editing existing meals) */}
            {editingMeal && (
              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedMealForAddons(editingMeal);
                    setAddonsDialogOpen(true);
                  }}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Manage Add-ons
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>{editingMeal ? "Update" : "Create"} Meal</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{mealToDelete?.name}". This action cannot be
              undone.
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

      {/* Add-ons Dialog */}
      <Dialog open={addonsDialogOpen} onOpenChange={setAddonsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Add-ons: {selectedMealForAddons?.name}</DialogTitle>
          </DialogHeader>
          {selectedMealForAddons && restaurantId && (
            <MealAddonsManager
              mealId={selectedMealForAddons.id}
              mealName={selectedMealForAddons.name}
              restaurantId={restaurantId}
              open={addonsDialogOpen}
              onOpenChange={setAddonsDialogOpen}
            />
          )}
        </DialogContent>
      </Dialog>
    </PartnerLayout>
  );
}
