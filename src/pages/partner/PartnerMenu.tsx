import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  LayoutGrid,
  List,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { PartnerLayout } from "@/components/PartnerLayout";
import { MealAddonsManager } from "@/components/MealAddonsManager";
import { formatCurrency } from "@/lib/currency";

const CATEGORIES = ["All", "Main Course", "Appetizer", "Soup", "Drink", "Dessert"] as const;
type Category = (typeof CATEGORIES)[number];

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name A–Z" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "calories_asc", label: "Calories: Low to High" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

interface MealAddon {
  name: string;
  price: number;
}

interface Meal {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  approval_status: "pending" | "approved" | "rejected" | null;
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
  category: string;
}

interface DietTag {
  id: string;
  name: string;
  description: string | null;
}

interface AIMealDetails {
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  prep_time_minutes: number;
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
  price: z.number().min(0, "Price must be a positive number"),
  calories: z.number().min(1, "Calories required"),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
  fiber_g: z.number().min(0).optional(),
  prep_time_minutes: z.number().min(1).optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  is_available: z.boolean(),
  is_vip_exclusive: z.boolean(),
  category: z.string().min(1),
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
  category: "Main Course",
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
  const [mealAddons, setMealAddons] = useState<Record<string, MealAddon[]>>({});
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
  const [libraryAddons, setLibraryAddons] = useState<{ id: string; name: string; price: number; category: string }[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // View/filter/sort state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");

  useEffect(() => {
    if (user) {
      fetchMeals();
      fetchDietTags();
    }
  }, [user]);

  // Real-time subscription: sync approval_status changes made by admin
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`partner-meals-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meals",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const updated = payload.new as Meal;
          setMeals((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
          // Notify partner when admin approves or rejects their meal
          if (updated.approval_status === "approved") {
            toast({
              title: "Meal Approved",
              description: `"${updated.name}" has been approved and is now live.`,
            });
          } else if (updated.approval_status === "rejected") {
            toast({
              title: "Meal Rejected",
              description: `"${updated.name}" was rejected by the admin.`,
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [restaurantId]);

  const fetchDietTags = async () => {
    const { data, error } = await supabase.from("diet_tags").select("*").order("name");
    if (!error && data) setDietTags(data);
  };

  const fetchMeals = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      if (!restaurant) { navigate("/partner"); return; }

      setRestaurantId(restaurant.id);

      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("name");

      if (mealsError) throw mealsError;
      const fetchedMeals = mealsData || [];
      setMeals(fetchedMeals);

      // Batch fetch add-ons for all meals in one query
      if (fetchedMeals.length > 0) {
        const mealIds = fetchedMeals.map((m) => m.id);
        const { data: addonsData } = await supabase
          .from("meal_addons")
          .select("meal_id, restaurant_addons(name, price)")
          .in("meal_id", mealIds);

        if (addonsData) {
          const grouped: Record<string, MealAddon[]> = {};
          for (const row of addonsData) {
            const addon = row.restaurant_addons as unknown as { name: string; price: number } | null;
            if (!addon) continue;
            if (!grouped[row.meal_id]) grouped[row.meal_id] = [];
            grouped[row.meal_id].push({ name: addon.name, price: addon.price });
          }
          setMealAddons(grouped);
        }
      }
    } catch (error) {
      console.error("Error fetching meals:", error);
      toast({ title: "Error", description: "Failed to load menu", variant: "destructive" });
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

  // Filtered + sorted meals
  const displayedMeals = useMemo(() => {
    let list = activeCategory === "All" ? meals : meals.filter((m) => m.category === activeCategory);

    list = [...list].sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "price_asc") return (a.price ?? 0) - (b.price ?? 0);
      if (sortBy === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
      if (sortBy === "calories_asc") return a.calories - b.calories;
      return 0;
    });

    return list;
  }, [meals, activeCategory, sortBy]);

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
      price: meal.price || 0,
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      fiber_g: meal.fiber_g || 0,
      prep_time_minutes: meal.prep_time_minutes || 15,
      image_url: meal.image_url || "",
      is_available: meal.is_available,
      is_vip_exclusive: meal.is_vip_exclusive,
      category: meal.category || "Main Course",
    });
    setFormErrors({});

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

  const handleInputChange = (field: keyof MealFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Authentication required. Please sign in again.");

      const { data, error } = await supabase.functions.invoke("analyze-meal-image", {
        body: { imageUrl, availableTags: availableTagNames },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
          toast({ title: "Session Expired", description: "Your session has expired. Please sign in again.", variant: "destructive" });
          navigate("/partner/auth");
          return;
        }
        throw error;
      }

      if (data?.rateLimit?.remaining === 0) {
        toast({ title: "Rate Limit Reached", description: "You have reached the limit of 50 AI analyses per hour.", variant: "destructive" });
      }

      const response = data as AIAnalysisResponse;
      if (response?.mealDetails) {
        const details = response.mealDetails;
        const hasMeaningfulData = details.name || details.calories > 0 || details.description;
        if (!hasMeaningfulData) {
          toast({ title: "AI Analysis", description: response.note || "Could not analyze image. Please fill in details manually." });
          return;
        }
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
        if (details.diet_tags && Array.isArray(details.diet_tags)) {
          const matchedTagIds = dietTags
            .filter((tag) => details.diet_tags.some((aiTag: string) => aiTag.toLowerCase() === tag.name.toLowerCase()))
            .map((tag) => tag.id);
          setSelectedTags(matchedTagIds);
        }
        setAnalysisComplete(true);
        setTimeout(() => setAnalysisComplete(false), 2000);
        toast({ title: "AI has auto-filled the meal details", description: "Review and adjust the values before saving." });
      }
    } catch (error: unknown) {
      console.error("Error analyzing meal image:", error);
      const msg = error instanceof Error ? error.message : "Could not analyze image. Please fill in details manually.";
      toast({ title: "Analysis failed", description: msg, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const validateForm = (): boolean => {
    const result = mealSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => { errors[err.path[0] as string] = err.message; });
      setFormErrors(errors);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !restaurantId) return;
    setSaving(true);
    try {
      const needsApproval = (formData.price || 0) > 50;
      const mealData = {
        restaurant_id: restaurantId,
        name: formData.name,
        description: formData.description || null,
        price: formData.price,
        approval_status: needsApproval ? "pending" : "approved",
        calories: formData.calories,
        protein_g: formData.protein_g,
        carbs_g: formData.carbs_g,
        fat_g: formData.fat_g,
        fiber_g: formData.fiber_g || null,
        prep_time_minutes: formData.prep_time_minutes || null,
        image_url: formData.image_url || null,
        is_available: needsApproval ? false : formData.is_available,
        is_vip_exclusive: formData.is_vip_exclusive,
        category: formData.category,
      };

      if (editingMeal) {
        const { error } = await supabase.from("meals").update(mealData).eq("id", editingMeal.id);
        if (error) throw error;

        await supabase.from("meal_diet_tags").delete().eq("meal_id", editingMeal.id);
        if (selectedTags.length > 0) {
          await supabase.from("meal_diet_tags").insert(selectedTags.map((tagId) => ({ meal_id: editingMeal.id, diet_tag_id: tagId })));
        }
        toast({
          title: needsApproval ? "Meal submitted for approval" : "Meal updated successfully",
          description: needsApproval ? "Price exceeds 50 QAR. The meal will be reviewed by admin before going live." : undefined,
        });
      } else {
        const { data, error } = await supabase.from("meals").insert(mealData).select().single();
        if (error) throw error;

        if (selectedTags.length > 0 && data) {
          await supabase.from("meal_diet_tags").insert(selectedTags.map((tagId) => ({ meal_id: data.id, diet_tag_id: tagId })));
        }
        if (selectedAddons.length > 0 && data) {
          await supabase.from("meal_addons").insert(selectedAddons.map((addonId) => ({ meal_id: data.id, restaurant_addon_id: addonId })));
          for (const addonId of selectedAddons) {
            await supabase.rpc("increment_addon_usage", { addon_id: addonId });
          }
        }
        toast({
          title: needsApproval ? "Meal submitted for approval" : "Meal created successfully",
          description: needsApproval ? "Price exceeds 50 QAR. The meal will be reviewed by admin before going live." : undefined,
        });
        setDialogOpen(false);
        fetchMeals();
      }
    } catch (error: unknown) {
      console.error("Error saving meal:", error);
      const msg = error instanceof Error ? error.message : "Failed to save meal";
      toast({ title: "Error", description: msg, variant: "destructive" });
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
    } catch (error: unknown) {
      console.error("Error deleting meal:", error);
      const msg = error instanceof Error ? error.message : "Failed to delete meal";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const toggleAvailability = async (meal: Meal) => {
    try {
      const { error } = await supabase
        .from("meals")
        .update({ is_available: !meal.is_available })
        .eq("id", meal.id);
      if (error) throw error;
      setMeals((prev) => prev.map((m) => m.id === meal.id ? { ...m, is_available: !m.is_available } : m));
    } catch (error) {
      console.error("Error toggling availability:", error);
      toast({ title: "Error", description: "Failed to update availability", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <PartnerLayout title="Menu">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Menu" subtitle="Manage your restaurant's menu items">
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Menu</h2>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-muted" : "hover:bg-muted/50"}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openAddDialog} className="gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              Add new
            </Button>
          </div>
        </div>

        {/* Category tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
          <TabsList className="bg-transparent border-b w-full justify-start rounded-none h-auto p-0 gap-1">
            {CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent pb-2 px-3 text-sm"
              >
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Meal grid / list */}
        {displayedMeals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {activeCategory === "All" ? "No meals added yet" : `No meals in "${activeCategory}"`}
              </p>
              <Button onClick={openAddDialog} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Meal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}>
            {displayedMeals.map((meal) => {
              const addons = mealAddons[meal.id] || [];
              const basePrice = meal.price ?? 0;
              const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
              const total = basePrice + addonsTotal;

              return (
                <Card
                  key={meal.id}
                  className={`overflow-hidden transition-opacity ${!meal.is_available ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Top: image + name + category + price */}
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {meal.image_url ? (
                          <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-7 w-7 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-semibold text-sm leading-tight truncate">{meal.name}</h3>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {meal.approval_status === "pending" && (
                              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                                Pending
                              </span>
                            )}
                            {meal.approval_status === "rejected" && (
                              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                Rejected
                              </span>
                            )}
                            {meal.is_vip_exclusive && <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{meal.category}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-base font-bold text-green-600">
                            {meal.price != null && meal.price > 0 ? formatCurrency(meal.price) : "—"}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Flame className="h-3 w-3" />
                            {meal.calories} cal
                            {meal.prep_time_minutes && (
                              <>
                                <Clock className="h-3 w-3 ml-1" />
                                {meal.prep_time_minutes}m
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Extras section */}
                    {addons.length > 0 && (
                      <div className="border-t pt-3 space-y-1.5">
                        <div className="grid grid-cols-3 text-xs text-muted-foreground font-medium pb-1">
                          <span>Extras</span>
                          <span className="text-center">Add</span>
                          <span className="text-right">Price</span>
                        </div>
                        {addons.map((addon, idx) => (
                          <div key={idx} className="grid grid-cols-3 text-xs items-center">
                            <span className="truncate">{addon.name}</span>
                            <div className="flex justify-center">
                              <div className="w-4 h-4 rounded border border-green-500 flex items-center justify-center bg-green-50">
                                <svg className="w-2.5 h-2.5 text-green-600" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            </div>
                            <span className="text-right">{formatCurrency(addon.price)}</span>
                          </div>
                        ))}
                        <div className="grid grid-cols-2 text-xs font-semibold pt-1 border-t">
                          <span>Total <span className="text-muted-foreground font-normal">(before tax)</span></span>
                          <span className="text-right">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    )}

                    {/* Footer: availability + actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={meal.is_available}
                          onCheckedChange={() => toggleAvailability(meal)}
                          disabled={meal.approval_status === "pending"}
                        />
                        <span className="text-xs text-muted-foreground">
                          {meal.approval_status === "pending" ? "Awaiting approval" : meal.is_available ? "Available" : "Unavailable"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setSelectedMealForAddons(meal); setAddonsDialogOpen(true); }}
                          title="Manage Add-ons"
                        >
                          <Package className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(meal)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(meal)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingMeal ? "Edit Meal" : "Add New Meal"}
              {analysisComplete && <CheckCircle2 className="h-5 w-5 text-green-500 animate-in fade-in zoom-in" />}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <MealImageUpload
              currentImageUrl={formData.image_url}
              onImageChange={handleImageChange}
              mealId={editingMeal?.id}
              onImageUploaded={handleImageUploaded}
              isAnalyzing={analyzing}
            />

            <div className="space-y-2">
              <Label htmlFor="name">Meal Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Grilled Salmon Salad"
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
              <Select value={formData.category} onValueChange={(v) => handleInputChange("category", v)}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="price">Price (QAR) <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price || ""}
                  onChange={(e) => handleInputChange("price", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={`pl-9 ${formErrors.price ? "border-destructive" : ""}`}
                />
              </div>
              {formErrors.price && <p className="text-sm text-destructive">{formErrors.price}</p>}
              <p className="text-xs text-muted-foreground">
                Platform fee (18%) will be deducted. Your payout per meal:{" "}
                <span className="font-medium">{formatCurrency((formData.price || 0) * 0.82)}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calories">Calories <span className="text-destructive">*</span></Label>
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
              {formErrors.calories && <p className="text-sm text-destructive">{formErrors.calories}</p>}
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="protein">Protein (g)</Label>
                <Input id="protein" type="number" min="0" step="0.1" value={formData.protein_g || ""}
                  onChange={(e) => handleInputChange("protein_g", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input id="carbs" type="number" min="0" step="0.1" value={formData.carbs_g || ""}
                  onChange={(e) => handleInputChange("carbs_g", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fat">Fat (g)</Label>
                <Input id="fat" type="number" min="0" step="0.1" value={formData.fat_g || ""}
                  onChange={(e) => handleInputChange("fat_g", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiber">Fiber (g)</Label>
                <Input id="fiber" type="number" min="0" step="0.1" value={formData.fiber_g || ""}
                  onChange={(e) => handleInputChange("fiber_g", parseFloat(e.target.value) || 0)} />
              </div>
            </div>

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
                      selectedTags.includes(tag.id) ? "bg-primary/10 border-primary" : "bg-muted/50 border-border hover:bg-muted"
                    }`}
                  >
                    <Checkbox checked={selectedTags.includes(tag.id)} onCheckedChange={() => handleTagToggle(tag.id)} className="sr-only" />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {libraryAddons.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Add-ons
                  <span className="text-xs text-muted-foreground font-normal">(Select from your library)</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {libraryAddons.map((addon) => (
                    <label
                      key={addon.id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                        selectedAddons.includes(addon.id) ? "bg-primary/10 border-primary" : "bg-muted/50 border-border hover:bg-muted"
                      }`}
                    >
                      <Checkbox
                        checked={selectedAddons.includes(addon.id)}
                        onCheckedChange={() => setSelectedAddons((prev) =>
                          prev.includes(addon.id) ? prev.filter((id) => id !== addon.id) : [...prev, addon.id]
                        )}
                        className="sr-only"
                      />
                      <span className="text-sm">{addon.name}</span>
                      <span className="text-xs text-muted-foreground">+{addon.price} QAR</span>
                    </label>
                  ))}
                </div>
                {selectedAddons.length === 0 && (
                  <p className="text-xs text-muted-foreground">No add-ons selected. You can add them later from the menu.</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_available} onCheckedChange={(checked) => handleInputChange("is_available", checked)} />
                <Label>Available</Label>
              </div>
            </div>

            {editingMeal && (
              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => { setSelectedMealForAddons(editingMeal); setAddonsDialogOpen(true); }}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Manage Add-ons
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
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
              This will permanently delete "{mealToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
