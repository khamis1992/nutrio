import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { PartnerLayout } from "@/components/PartnerLayout";
import { MealAddonsManager } from "@/components/MealAddonsManager";
import { formatCurrency } from "@/lib/currency";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import {
  calculateNutrientCompleteness,
  type NutritionDataSource,
} from "@/lib/nutrition-quality";
import { PartnerAddonsContent } from "./PartnerAddons";
import {
  PartnerNutritionVerificationControl,
  usePartnerNutritionVerificationStatuses,
} from "@/components/partner/PartnerNutritionVerificationControl";

const CATEGORIES = [
  "All",
  "Main Course",
  "Appetizer",
  "Soup",
  "Drink",
  "Dessert",
] as const;
type Category = (typeof CATEGORIES)[number];

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name A-Z" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "calories_asc", label: "Calories: Low to High" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

interface MealAddon {
  name: string;
  price: number;
}

type MenuPeriod = "breakfast" | "lunch" | "dinner" | "snack";

interface MenuOffering {
  meal_type: MenuPeriod;
  price: number;
  is_available: boolean;
}

const MENU_PERIODS: Array<{ value: MenuPeriod; label: string; time: string }> = [
  { value: "breakfast", label: "Breakfast", time: "7-10 AM" },
  { value: "lunch", label: "Lunch", time: "12-2 PM" },
  { value: "dinner", label: "Dinner", time: "6-9 PM" },
  { value: "snack", label: "Snack", time: "Anytime" },
];

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
  sugar_g: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  vitamin_d_mcg: number | null;
  vitamin_b12_mcg: number | null;
  magnesium_mg: number | null;
  nutrition_version: number;
  nutrition_provenance: unknown;
  nutrient_completeness_score: number;
  nutrient_missing_codes: string[];
  nutrient_invalid_codes: string[];
  correction_status: "requested" | "submitted" | null;
  correction_reason: string | null;
  image_url: string | null;
  prep_time_minutes: number | null;
  is_available: boolean;
  is_vip_exclusive: boolean;
  rating: number;
  order_count: number;
  supports_large?: boolean | null;
  large_calories_increase?: number | null;
  large_protein_increase?: number | null;
  large_price_adjustment?: number | null;
  supports_high_protein?: boolean | null;
  high_protein_calories_increase?: number | null;
  high_protein_protein_increase?: number | null;
  high_protein_price_adjustment?: number | null;
  diet_tags?: string[];
  category: string;
  menu_offerings: MenuOffering[];
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
  fiber_g: z.number().min(0).nullable(),
  sugar_g: z.number().min(0).nullable(),
  sodium_mg: z.number().min(0).nullable(),
  potassium_mg: z.number().min(0).nullable(),
  calcium_mg: z.number().min(0).nullable(),
  iron_mg: z.number().min(0).nullable(),
  vitamin_d_mcg: z.number().min(0).nullable(),
  vitamin_b12_mcg: z.number().min(0).nullable(),
  magnesium_mg: z.number().min(0).nullable(),
  nutrition_source: z.enum([
    "partner_entered",
    "nutrition_label_ocr",
    "open_food_facts",
    "manual",
    "estimated",
    "backfilled",
  ]),
  nutrition_source_record_id: z.string().max(120).optional(),
  prep_time_minutes: z.number().min(1).optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  is_available: z.boolean(),
  is_vip_exclusive: z.boolean(),
  supports_large: z.boolean(),
  large_calories_increase: z.number().min(0),
  large_protein_increase: z.number().min(0),
  large_price_adjustment: z.number().min(0),
  supports_high_protein: z.boolean(),
  high_protein_calories_increase: z.number().min(0),
  high_protein_protein_increase: z.number().min(0),
  high_protein_price_adjustment: z.number().min(0),
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
  fiber_g: null,
  sugar_g: null,
  sodium_mg: null,
  potassium_mg: null,
  calcium_mg: null,
  iron_mg: null,
  vitamin_d_mcg: null,
  vitamin_b12_mcg: null,
  magnesium_mg: null,
  nutrition_source: "partner_entered",
  nutrition_source_record_id: "",
  prep_time_minutes: 15,
  image_url: "",
  is_available: true,
  is_vip_exclusive: false,
  supports_large: false,
  large_calories_increase: 0,
  large_protein_increase: 0,
  large_price_adjustment: 0,
  supports_high_protein: false,
  high_protein_calories_increase: 0,
  high_protein_protein_increase: 0,
  high_protein_price_adjustment: 0,
  category: "Main Course",
};

const NUTRITION_SOURCES: Array<{
  value: NutritionDataSource;
  label: string;
}> = [
  { value: "partner_entered", label: "Entered by restaurant" },
  { value: "nutrition_label_ocr", label: "Nutrition label / OCR" },
  { value: "open_food_facts", label: "Open Food Facts" },
  { value: "manual", label: "Manually verified" },
  { value: "estimated", label: "Recipe estimate" },
  { value: "backfilled", label: "System backfill" },
];

function readProvenanceValue(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : "";
}

export function PartnerNutritionQueueBanner({
  count,
  isRTL,
  queueOnly,
  onToggle,
}: {
  count: number;
  isRTL: boolean;
  queueOnly: boolean;
  onToggle: () => void;
}) {
  const copy = isRTL
    ? {
        title: "بيانات غذائية تحتاج تصحيحًا",
        body: `${count} وجبة تحتوي قياسات ناقصة أو غير صالحة. افتح الوجبة لإرسال التصحيح.`,
        show: "عرض قائمة التصحيح",
        all: "عرض كل الوجبات",
      }
    : {
        title: "Nutrition data needs correction",
        body: `${count} meals have missing or invalid measurements. Open a meal to submit corrections.`,
        show: "Show correction queue",
        all: "Show all meals",
      };

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      className="flex flex-col gap-3 rounded-lg border border-[#F59E0B]/30 bg-[#FFF8ED] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-black text-[#020617]">{copy.title}</p>
        <p className="mt-1 text-sm font-semibold text-[#64748B]">{copy.body}</p>
      </div>
      <Button type="button" variant="outline" onClick={onToggle} className="min-h-11 bg-white">
        <AlertTriangle className="me-2 h-4 w-4 text-[#F59E0B]" />
        {queueOnly ? copy.all : copy.show}
      </Button>
    </section>
  );
}

export default function PartnerMenu() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const micronutrientsEnabled = isPhaseOneFeatureEnabled("micronutrients");
  const { byMeal: verificationByMeal, refresh: refreshVerificationStatuses } =
    usePartnerNutritionVerificationStatuses(Boolean(user));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState(18);
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
  const [selectedMealForAddons, setSelectedMealForAddons] =
    useState<Meal | null>(null);
  const [libraryAddons, setLibraryAddons] = useState<
    { id: string; name: string; price: number; category: string }[]
  >([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [menuPricingEnabled, setMenuPricingEnabled] = useState(false);
  const [menuOfferings, setMenuOfferings] = useState<MenuOffering[]>(
    MENU_PERIODS.map((period) => ({
      meal_type: period.value,
      price: 0,
      is_available: true,
    })),
  );
  const formNutritionQuality = useMemo(
    () =>
      calculateNutrientCompleteness({
        calories: formData.calories,
        protein_g: formData.protein_g,
        carbs_g: formData.carbs_g,
        fat_g: formData.fat_g,
        fiber_g: formData.fiber_g,
        sugar_g: formData.sugar_g,
        sodium_mg: formData.sodium_mg,
        potassium_mg: formData.potassium_mg,
        calcium_mg: formData.calcium_mg,
        iron_mg: formData.iron_mg,
        vitamin_d_mcg: formData.vitamin_d_mcg,
        vitamin_b12_mcg: formData.vitamin_b12_mcg,
        magnesium_mg: formData.magnesium_mg,
      }),
    [
      formData.calories,
      formData.carbs_g,
      formData.fat_g,
      formData.fiber_g,
      formData.protein_g,
      formData.sodium_mg,
      formData.sugar_g,
      formData.potassium_mg,
      formData.calcium_mg,
      formData.iron_mg,
      formData.vitamin_d_mcg,
      formData.vitamin_b12_mcg,
      formData.magnesium_mg,
    ],
  );

  // View/filter/sort state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");
  const [nutritionQueueOnly, setNutritionQueueOnly] = useState(false);
  const activeMenuTab =
    searchParams.get("tab") === "addons" ? "addons" : "meals";

  const setActiveMenuTab = (tab: "meals" | "addons") => {
    setSearchParams(tab === "addons" ? { tab: "addons" } : {});
  };

  useEffect(() => {
    if (user) {
      fetchMeals();
      fetchDietTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const fetchDietTags = async () => {
    const { data, error } = await supabase
      .from("diet_tags")
      .select("*")
      .order("name");
    if (!error && data) setDietTags(data);
  };

  const fetchMeals = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, commission_rate")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      if (!restaurant) {
        navigate("/partner");
        return;
      }

      setRestaurantId(restaurant.id);
      setCommissionRate(restaurant.commission_rate ?? 18);

      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("name");

      if (mealsError) throw mealsError;
      const fetchedMeals: Meal[] = (mealsData || []).map((meal) => {
        const extended = meal as unknown as Record<string, unknown>;
        return {
          id: meal.id,
        name: meal.name,
        description: meal.description,
        price: meal.price,
        approval_status: meal.approval_status as Meal["approval_status"],
        calories: meal.calories || 0,
        protein_g: meal.protein_g || meal.protein || 0,
        carbs_g: meal.carbs_g || meal.carbs || 0,
        fat_g: meal.fat_g || meal.fats || 0,
        fiber_g: meal.fiber_g,
        sugar_g: meal.sugar_g,
        sodium_mg: meal.sodium_mg,
        potassium_mg: (extended.potassium_mg as number | null) ?? null,
        calcium_mg: (extended.calcium_mg as number | null) ?? null,
        iron_mg: (extended.iron_mg as number | null) ?? null,
        vitamin_d_mcg: (extended.vitamin_d_mcg as number | null) ?? null,
        vitamin_b12_mcg: (extended.vitamin_b12_mcg as number | null) ?? null,
        magnesium_mg: (extended.magnesium_mg as number | null) ?? null,
        nutrition_version: meal.nutrition_version,
        nutrition_provenance: meal.nutrition_provenance,
        nutrient_completeness_score: meal.nutrient_completeness_score,
        nutrient_missing_codes: meal.nutrient_missing_codes,
        nutrient_invalid_codes: meal.nutrient_invalid_codes,
        correction_status: null,
        correction_reason: null,
        image_url: meal.image_url,
        prep_time_minutes: meal.prep_time_minutes,
        is_available: meal.is_available ?? false,
        is_vip_exclusive: meal.is_vip_exclusive ?? false,
        rating: meal.rating || meal.avg_rating || 0,
        order_count: meal.order_count || 0,
        category: meal.category,
          menu_offerings: [],
        };
      });

      if (fetchedMeals.length > 0) {
        const { data: offeringData, error: offeringError } = await supabase
          .from("meal_menu_offerings" as "meals")
          .select("meal_id,meal_type,price,is_available")
          .in("meal_id", fetchedMeals.map((meal) => meal.id));

        if (!offeringError && offeringData) {
          const byMeal = new Map<string, MenuOffering[]>();
          for (const raw of offeringData as unknown as Array<{
            meal_id: string;
            meal_type: MenuPeriod;
            price: number;
            is_available: boolean;
          }>) {
            const current = byMeal.get(raw.meal_id) ?? [];
            current.push({
              meal_type: raw.meal_type,
              price: Number(raw.price),
              is_available: raw.is_available,
            });
            byMeal.set(raw.meal_id, current);
          }
          fetchedMeals.forEach((meal) => {
            meal.menu_offerings = byMeal.get(meal.id) ?? [];
          });
        }
      }
      if (micronutrientsEnabled && fetchedMeals.length > 0) {
        const { data: queueData, error: queueError } = await supabase
          .from("partner_meal_nutrition_missing_queue")
          .select("meal_id,correction_status,correction_reason")
          .eq("restaurant_id", restaurant.id);
        if (queueError) throw queueError;

        const queueByMeal = new Map(
          ((queueData ?? []) as unknown as Array<{
            meal_id: string;
            correction_status: Meal["correction_status"];
            correction_reason: string | null;
          }>).map((item) => [item.meal_id, item]),
        );
        for (const meal of fetchedMeals) {
          const queueItem = queueByMeal.get(meal.id);
          if (queueItem) {
            meal.correction_status = queueItem.correction_status;
            meal.correction_reason = queueItem.correction_reason;
          }
        }
      }

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
            const addon = row.restaurant_addons as unknown as {
              name: string;
              price: number;
            } | null;
            if (!addon) continue;
            if (!grouped[row.meal_id]) grouped[row.meal_id] = [];
            grouped[row.meal_id].push({ name: addon.name, price: addon.price });
          }
          setMealAddons(grouped);
        }
      }
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

  // Filtered + sorted meals
  const displayedMeals = useMemo(() => {
    let list =
      activeCategory === "All"
        ? meals
        : meals.filter((m) => m.category === activeCategory);

    list = [...list].sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "price_asc") return (a.price ?? 0) - (b.price ?? 0);
      if (sortBy === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
      if (sortBy === "calories_asc") return a.calories - b.calories;
      return 0;
    });

    if (micronutrientsEnabled && nutritionQueueOnly) {
      list = list.filter(
        (meal) =>
          meal.nutrient_missing_codes.length > 0 ||
          meal.nutrient_invalid_codes.length > 0,
      );
    }

    return list;
  }, [meals, activeCategory, sortBy, micronutrientsEnabled, nutritionQueueOnly]);

  const openAddDialog = () => {
    setEditingMeal(null);
    setFormData(emptyMeal);
    setFormErrors({});
    setSelectedTags([]);
    setSelectedAddons([]);
    setMenuPricingEnabled(false);
    setMenuOfferings(
      MENU_PERIODS.map((period) => ({
        meal_type: period.value,
        price: 0,
        is_available: true,
      })),
    );
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
      fiber_g: meal.fiber_g,
      sugar_g: meal.sugar_g,
      sodium_mg: meal.sodium_mg,
      potassium_mg: meal.potassium_mg,
      calcium_mg: meal.calcium_mg,
      iron_mg: meal.iron_mg,
      vitamin_d_mcg: meal.vitamin_d_mcg,
      vitamin_b12_mcg: meal.vitamin_b12_mcg,
      magnesium_mg: meal.magnesium_mg,
      nutrition_source: (readProvenanceValue(
        meal.nutrition_provenance,
        "source",
      ) || "partner_entered") as NutritionDataSource,
      nutrition_source_record_id: readProvenanceValue(
        meal.nutrition_provenance,
        "source_record_id",
      ),
      prep_time_minutes: meal.prep_time_minutes || 15,
      image_url: meal.image_url || "",
      is_available: meal.is_available,
      is_vip_exclusive: meal.is_vip_exclusive,
      supports_large: Boolean(meal.supports_large),
      large_calories_increase: Number(meal.large_calories_increase || 0),
      large_protein_increase: Number(meal.large_protein_increase || 0),
      large_price_adjustment: Number(meal.large_price_adjustment || 0),
      supports_high_protein: Boolean(meal.supports_high_protein),
      high_protein_calories_increase: Number(
        meal.high_protein_calories_increase || 0,
      ),
      high_protein_protein_increase: Number(
        meal.high_protein_protein_increase || 0,
      ),
      high_protein_price_adjustment: Number(
        meal.high_protein_price_adjustment || 0,
      ),
      category: meal.category || "Main Course",
    });
    setFormErrors({});
    setMenuPricingEnabled(meal.menu_offerings.length > 0);
    setMenuOfferings(
      MENU_PERIODS.map((period) => {
        const saved = meal.menu_offerings.find(
          (offering) => offering.meal_type === period.value,
        );
        return saved ?? {
          meal_type: period.value,
          price: meal.price || 0,
          is_available: false,
        };
      }),
    );

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
      setFormErrors((prev) => {
        const e = { ...prev };
        delete e[field];
        return e;
      });
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
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
      if (!accessToken)
        throw new Error("Authentication required. Please sign in again.");

      const { data, error } = await supabase.functions.invoke(
        "analyze-meal-image",
        {
          body: { imageUrl, availableTags: availableTagNames },
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (error) {
        if (
          error.message?.includes("401") ||
          error.message?.includes("Unauthorized")
        ) {
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please sign in again.",
            variant: "destructive",
          });
          navigate("/partner/auth");
          return;
        }
        throw error;
      }

      if (data?.rateLimit?.remaining === 0) {
        toast({
          title: "Rate Limit Reached",
          description: "You have reached the limit of 50 AI analyses per hour.",
          variant: "destructive",
        });
      }

      const response = data as AIAnalysisResponse;
      if (response?.mealDetails) {
        const details = response.mealDetails;
        const hasMeaningfulData =
          details.name || details.calories > 0 || details.description;
        if (!hasMeaningfulData) {
          toast({
            title: "AI Analysis",
            description:
              response.note ||
              "Could not analyze image. Please fill in details manually.",
          });
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
          prep_time_minutes:
            details.prep_time_minutes || prev.prep_time_minutes,
        }));
        if (details.diet_tags && Array.isArray(details.diet_tags)) {
          const matchedTagIds = dietTags
            .filter((tag) =>
              details.diet_tags.some(
                (aiTag: string) =>
                  aiTag.toLowerCase() === tag.name.toLowerCase(),
              ),
            )
            .map((tag) => tag.id);
          setSelectedTags(matchedTagIds);
        }
        setAnalysisComplete(true);
        setTimeout(() => setAnalysisComplete(false), 2000);
        toast({
          title: "AI has auto-filled the meal details",
          description: "Review and adjust the values before saving.",
        });
      }
    } catch (error: unknown) {
      console.error("Error analyzing meal image:", error);
      const msg =
        error instanceof Error
          ? error.message
          : "Could not analyze image. Please fill in details manually.";
      toast({
        title: "Analysis failed",
        description: msg,
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
        errors[err.path[0] as string] = err.message;
      });
      setFormErrors(errors);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !restaurantId) return;
    if (menuPricingEnabled && !menuOfferings.some((item) => item.is_available)) {
      toast({
        title: "Choose a menu period",
        description: "Enable at least one period for this meal.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const highestMenuPrice = menuPricingEnabled
        ? Math.max(
            0,
            ...menuOfferings
              .filter((item) => item.is_available)
              .map((item) => item.price),
          )
        : 0;
      const needsApproval = Math.max(formData.price || 0, highestMenuPrice) > 50;
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
        fiber_g: formData.fiber_g,
        ...(micronutrientsEnabled
          ? {
              sugar_g: formData.sugar_g,
              sodium_mg: formData.sodium_mg,
              potassium_mg: formData.potassium_mg,
              calcium_mg: formData.calcium_mg,
              iron_mg: formData.iron_mg,
              vitamin_d_mcg: formData.vitamin_d_mcg,
              vitamin_b12_mcg: formData.vitamin_b12_mcg,
              magnesium_mg: formData.magnesium_mg,
              nutrition_provenance: {
                source: formData.nutrition_source,
                source_record_id:
                  formData.nutrition_source_record_id?.trim() || null,
              },
            }
          : {}),
        prep_time_minutes: formData.prep_time_minutes || null,
        image_url: formData.image_url || null,
        is_available: needsApproval ? false : formData.is_available,
        is_vip_exclusive: formData.is_vip_exclusive,
        supports_large: formData.supports_large,
        large_calories_increase: formData.supports_large
          ? formData.large_calories_increase
          : 0,
        large_protein_increase: formData.supports_large
          ? formData.large_protein_increase
          : 0,
        large_price_adjustment: formData.supports_large
          ? formData.large_price_adjustment
          : 0,
        supports_high_protein: formData.supports_high_protein,
        high_protein_calories_increase: formData.supports_high_protein
          ? formData.high_protein_calories_increase
          : 0,
        high_protein_protein_increase: formData.supports_high_protein
          ? formData.high_protein_protein_increase
          : 0,
        high_protein_price_adjustment: formData.supports_high_protein
          ? formData.high_protein_price_adjustment
          : 0,
        category: formData.category,
      };

      if (editingMeal) {
        const { error } = await supabase
          .from("meals")
          .update(mealData)
          .eq("id", editingMeal.id);
        if (error) throw error;

        await supabase
          .from("meal_diet_tags")
          .delete()
          .eq("meal_id", editingMeal.id);
        if (selectedTags.length > 0) {
          await supabase.from("meal_diet_tags").insert(
            selectedTags.map((tagId) => ({
              meal_id: editingMeal.id,
              diet_tag_id: tagId,
            })),
          );
        }
        const { error: menuError } = await (supabase.rpc as unknown as (
          name: string,
          args: Record<string, unknown>,
        ) => Promise<{ error: { message?: string } | null }>)(
          "save_meal_menu_offerings",
          {
            p_meal_id: editingMeal.id,
            p_offerings: menuPricingEnabled
              ? menuOfferings.filter((item) => item.is_available)
              : [],
          },
        );
        if (menuError) throw menuError;
        toast({
          title: needsApproval
            ? "Meal submitted for approval"
            : "Meal updated successfully",
          description: needsApproval
            ? "Price exceeds 50 QAR. The meal will be reviewed by admin before going live."
            : undefined,
        });
      } else {
        const { data, error } = await supabase
          .from("meals")
          .insert(mealData)
          .select()
          .single();
        if (error) throw error;

        if (selectedTags.length > 0 && data) {
          await supabase.from("meal_diet_tags").insert(
            selectedTags.map((tagId) => ({
              meal_id: data.id,
              diet_tag_id: tagId,
            })),
          );
        }
        if (selectedAddons.length > 0 && data) {
          const selectedLibraryAddons = libraryAddons.filter((addon) =>
            selectedAddons.includes(addon.id),
          );
          await supabase.from("meal_addons").insert(
            selectedLibraryAddons.map((addon) => ({
              meal_id: data.id,
              restaurant_addon_id: addon.id,
              name: addon.name,
              price: addon.price,
              category: addon.category,
            })),
          );
          for (const addonId of selectedAddons) {
            await supabase.rpc("increment_addon_usage", { addon_id: addonId });
          }
        }
        if (data) {
          const { error: menuError } = await (supabase.rpc as unknown as (
            name: string,
            args: Record<string, unknown>,
          ) => Promise<{ error: { message?: string } | null }>)(
            "save_meal_menu_offerings",
            {
              p_meal_id: data.id,
              p_offerings: menuPricingEnabled
                ? menuOfferings.filter((item) => item.is_available)
                : [],
            },
          );
          if (menuError) throw menuError;
        }
        toast({
          title: needsApproval
            ? "Meal submitted for approval"
            : "Meal created successfully",
          description: needsApproval
            ? "Price exceeds 50 QAR. The meal will be reviewed by admin before going live."
            : undefined,
        });
        setDialogOpen(false);
        fetchMeals();
      }
    } catch (error: unknown) {
      console.error("Error saving meal:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to save meal";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!mealToDelete) return;
    try {
      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", mealToDelete.id);
      if (error) throw error;
      toast({ title: "Meal deleted successfully" });
      setDeleteDialogOpen(false);
      setMealToDelete(null);
      fetchMeals();
    } catch (error: unknown) {
      console.error("Error deleting meal:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to delete meal";
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
      setMeals((prev) =>
        prev.map((m) =>
          m.id === meal.id ? { ...m, is_available: !m.is_available } : m,
        ),
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

  const availableMeals = meals.filter((meal) => meal.is_available).length;
  const pendingMeals = meals.filter(
    (meal) => meal.approval_status === "pending",
  ).length;
  const rejectedMeals = meals.filter(
    (meal) => meal.approval_status === "rejected",
  ).length;
  const nutritionQueueCount = meals.filter(
    (meal) =>
      meal.nutrient_missing_codes.length > 0 ||
      meal.nutrient_invalid_codes.length > 0,
  ).length;
  const activeCategoryCount =
    activeCategory === "All"
      ? meals.length
      : meals.filter((meal) => meal.category === activeCategory).length;

  if (loading) {
    return (
      <PartnerLayout title="Menu">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Menu" subtitle="Manage your restaurant's menu items">
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_22px_70px_rgba(2,6,23,0.06)]">
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#020617] text-white">
                  {activeMenuTab === "addons" ? (
                    <Package className="h-6 w-6" />
                  ) : (
                    <UtensilsCrossed className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7C83F6]">
                    {activeMenuTab === "addons"
                      ? "Add-ons library"
                      : "Partner menu"}
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">
                    {activeMenuTab === "addons"
                      ? "Manage reusable extras"
                      : "Build and manage meals"}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-medium text-[#64748B]">
                    {activeMenuTab === "addons"
                      ? "Create sides, drinks, sauces, and premium ingredients that can be attached to meals."
                      : "Keep meals available, review approvals, and maintain nutrition data customers can trust."}
                  </p>
                </div>
              </div>
              {activeMenuTab === "meals" && (
                <Button
                  onClick={openAddDialog}
                  className="h-12 rounded-2xl bg-[#020617] px-5 text-white hover:bg-[#020617]/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add meal
                </Button>
              )}
            </div>
            {activeMenuTab === "meals" && (
              <div className="grid grid-cols-2 gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-4 lg:grid-cols-4">
                {[
                  {
                    label: "Total meals",
                    value: meals.length,
                    icon: Package,
                    color: "#7C83F6",
                    bg: "bg-[#7C83F6]/10",
                  },
                  {
                    label: "Available",
                    value: availableMeals,
                    icon: CheckCircle2,
                    color: "#22C7A1",
                    bg: "bg-[#22C7A1]/10",
                  },
                  {
                    label: "Pending",
                    value: pendingMeals,
                    icon: Clock,
                    color: "#F97316",
                    bg: "bg-[#F97316]/10",
                  },
                  {
                    label: "Rejected",
                    value: rejectedMeals,
                    icon: Trash2,
                    color: "#FB6B7A",
                    bg: "bg-[#FB6B7A]/10",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-3xl border border-[#E5EAF1] bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                          {stat.label}
                        </p>
                        <p className="mt-2 text-2xl font-black text-[#020617]">
                          {stat.value}
                        </p>
                      </div>
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.bg}`}
                      >
                        <stat.icon
                          className="h-5 w-5"
                          style={{ color: stat.color }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-2 rounded-[28px] border border-[#E5EAF1] bg-white p-2 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
            {[
              {
                value: "meals" as const,
                label: "Meals",
                helper: `${meals.length} menu items`,
                icon: UtensilsCrossed,
              },
              {
                value: "addons" as const,
                label: "Add-ons library",
                helper: "Reusable extras",
                icon: Package,
              },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveMenuTab(tab.value)}
                className={`flex min-h-16 items-center gap-3 rounded-3xl px-4 text-left transition ${
                  activeMenuTab === tab.value
                    ? "bg-[#020617] text-white shadow-[0_14px_28px_rgba(2,6,23,0.16)]"
                    : "bg-[#F6F8FB] text-[#020617] hover:bg-white"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    activeMenuTab === tab.value ? "bg-white/10" : "bg-white"
                  }`}
                >
                  <tab.icon
                    className={`h-5 w-5 ${
                      activeMenuTab === tab.value
                        ? "text-white"
                        : tab.value === "addons"
                          ? "text-[#7C83F6]"
                          : "text-[#22C7A1]"
                    }`}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">
                    {tab.label}
                  </span>
                  <span
                    className={`block truncate text-xs font-bold ${
                      activeMenuTab === tab.value
                        ? "text-white/55"
                        : "text-[#94A3B8]"
                    }`}
                  >
                    {tab.helper}
                  </span>
                </span>
              </button>
            ))}
          </section>

          {activeMenuTab === "addons" ? (
            <PartnerAddonsContent embedded />
          ) : (
            <>
              {micronutrientsEnabled && nutritionQueueCount > 0 && (
                <PartnerNutritionQueueBanner
                  count={nutritionQueueCount}
                  isRTL={isRTL}
                  queueOnly={nutritionQueueOnly}
                  onToggle={() => setNutritionQueueOnly((current) => !current)}
                />
              )}
              <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-3 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <Tabs
                    value={activeCategory}
                    onValueChange={(v) => setActiveCategory(v as Category)}
                    className="min-w-0 flex-1"
                  >
                    <TabsList className="flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-3xl bg-[#F6F8FB] p-1">
                      {CATEGORIES.map((cat) => (
                        <TabsTrigger
                          key={cat}
                          value={cat}
                          className="min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black text-[#64748B] data-[state=active]:bg-[#020617] data-[state=active]:text-white"
                        >
                          {cat}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <div className="flex items-center gap-2">
                    <Select
                      value={sortBy}
                      onValueChange={(v) => setSortBy(v as SortOption)}
                    >
                      <SelectTrigger className="h-11 w-[170px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-sm font-bold text-[#020617]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex h-11 items-center rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-1">
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${viewMode === "list" ? "bg-white text-[#020617] shadow-sm" : "text-[#94A3B8]"}`}
                        title="List view"
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${viewMode === "grid" ? "bg-white text-[#020617] shadow-sm" : "text-[#94A3B8]"}`}
                        title="Grid view"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-4 py-3">
                  <p className="text-sm font-black text-[#020617]">
                    {activeCategoryCount} meals in {activeCategory}
                  </p>
                  <p className="text-xs font-bold text-[#94A3B8]">
                    Sorted by{" "}
                    {SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label}
                  </p>
                </div>
              </section>

              {displayedMeals.length === 0 ? (
                <section className="rounded-[28px] border border-dashed border-[#E5EAF1] bg-white px-4 py-14 text-center shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#7C83F6]/10 text-[#7C83F6]">
                    <UtensilsCrossed className="h-7 w-7" />
                  </div>
                  <h2 className="mt-4 text-xl font-black text-[#020617]">
                    {activeCategory === "All"
                      ? "No meals added yet"
                      : `No meals in ${activeCategory}`}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm font-medium text-[#94A3B8]">
                    Add meals with clear nutrition values, prep time,
                    availability, and add-ons.
                  </p>
                  <Button
                    onClick={openAddDialog}
                    className="mt-5 h-11 rounded-2xl bg-[#020617] px-5 text-white hover:bg-[#020617]/90"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add first meal
                  </Button>
                </section>
              ) : (
                <section
                  className={
                    viewMode === "grid"
                      ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                      : "flex flex-col gap-3"
                  }
                >
                  {displayedMeals.map((meal) => {
                    const addons = mealAddons[meal.id] || [];
                    const basePrice = meal.price ?? 0;
                    const addonsTotal = addons.reduce(
                      (sum, addon) => sum + addon.price,
                      0,
                    );
                    const total = basePrice + addonsTotal;
                    return (
                      <article
                        key={meal.id}
                        className={`overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_14px_36px_rgba(2,6,23,0.04)] transition ${!meal.is_available ? "opacity-70" : "hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(2,6,23,0.08)]"}`}
                      >
                        <div
                          className={
                            viewMode === "list"
                              ? "grid gap-0 sm:grid-cols-[180px_1fr]"
                              : ""
                          }
                        >
                          <div
                            className={
                              viewMode === "list"
                                ? "h-full min-h-[170px] bg-[#F6F8FB]"
                                : "h-44 bg-[#F6F8FB]"
                            }
                          >
                            {meal.image_url ? (
                              <img
                                src={meal.image_url}
                                alt={meal.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <ImageIcon className="h-9 w-9 text-[#94A3B8]" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-4 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[#7C83F6]/10 px-3 py-1 text-xs font-black text-[#7C83F6]">
                                    {meal.category}
                                  </span>
                                  {meal.approval_status === "pending" && (
                                    <span className="rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-black text-[#F97316]">
                                      Pending
                                    </span>
                                  )}
                                  {meal.approval_status === "rejected" && (
                                    <span className="rounded-full bg-[#FB6B7A]/10 px-3 py-1 text-xs font-black text-[#FB6B7A]">
                                      Rejected
                                    </span>
                                  )}
                                  {meal.is_vip_exclusive && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#020617] px-3 py-1 text-xs font-black text-white">
                                      <Crown className="h-3 w-3" /> VIP
                                    </span>
                                  )}
                                  <PartnerNutritionVerificationControl
                                    mealId={meal.id}
                                    mealName={meal.name}
                                    nutritionVersion={meal.nutrition_version}
                                    completenessScore={meal.nutrient_completeness_score}
                                    sourceReference={readProvenanceValue(
                                      meal.nutrition_provenance,
                                      "source_record_id",
                                    )}
                                    status={verificationByMeal.get(meal.id)}
                                    onChanged={refreshVerificationStatuses}
                                  />
                                  {micronutrientsEnabled &&
                                    (meal.nutrient_missing_codes.length > 0 ||
                                      meal.nutrient_invalid_codes.length > 0) && (
                                      <button
                                        type="button"
                                        onClick={() => void openEditDialog(meal)}
                                        className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#FFF8ED] px-3 text-xs font-black text-[#B45309]"
                                        title={meal.correction_reason ?? undefined}
                                      >
                                        <AlertTriangle className="h-3 w-3" />
                                        {meal.correction_status === "requested"
                                          ? isRTL
                                            ? "تصحيح مطلوب"
                                            : "Correction requested"
                                          : isRTL
                                            ? "بيانات ناقصة"
                                            : "Nutrition incomplete"}
                                      </button>
                                    )}
                                </div>
                                <h3 className="mt-3 truncate text-lg font-black text-[#020617]">
                                  {meal.name}
                                </h3>
                                {meal.description && (
                                  <p className="mt-1 line-clamp-2 text-sm font-medium text-[#64748B]">
                                    {meal.description}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                                  Price
                                </p>
                                <p className="mt-1 text-lg font-black text-[#22C7A1]">
                                  {meal.price != null && meal.price > 0
                                    ? formatCurrency(meal.price)
                                    : "-"}
                                </p>
                              </div>
                            </div>
                            {meal.menu_offerings.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {meal.menu_offerings.map((offering) => (
                                  <span
                                    key={offering.meal_type}
                                    className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[10px] font-black capitalize text-[#64748B] ring-1 ring-[#E5EAF1]"
                                  >
                                    {offering.meal_type} {formatCurrency(offering.price)}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-4 gap-2">
                              <div className="rounded-2xl bg-[#22C7A1]/10 p-2 text-center">
                                <Flame className="mx-auto h-4 w-4 text-[#22C7A1]" />
                                <p className="mt-1 text-sm font-black text-[#020617]">
                                  {meal.calories}
                                </p>
                                <p className="text-[10px] font-bold uppercase text-[#94A3B8]">
                                  cal
                                </p>
                              </div>
                              <div className="rounded-2xl bg-[#7C83F6]/10 p-2 text-center">
                                <p className="text-sm font-black text-[#7C83F6]">
                                  P
                                </p>
                                <p className="mt-1 text-sm font-black text-[#020617]">
                                  {meal.protein_g}g
                                </p>
                                <p className="text-[10px] font-bold uppercase text-[#94A3B8]">
                                  protein
                                </p>
                              </div>
                              <div className="rounded-2xl bg-[#F97316]/10 p-2 text-center">
                                <p className="text-sm font-black text-[#F97316]">
                                  C
                                </p>
                                <p className="mt-1 text-sm font-black text-[#020617]">
                                  {meal.carbs_g}g
                                </p>
                                <p className="text-[10px] font-bold uppercase text-[#94A3B8]">
                                  carbs
                                </p>
                              </div>
                              <div className="rounded-2xl bg-[#FB6B7A]/10 p-2 text-center">
                                <p className="text-sm font-black text-[#FB6B7A]">
                                  F
                                </p>
                                <p className="mt-1 text-sm font-black text-[#020617]">
                                  {meal.fat_g}g
                                </p>
                                <p className="text-[10px] font-bold uppercase text-[#94A3B8]">
                                  fat
                                </p>
                              </div>
                            </div>
                            {addons.length > 0 && (
                              <div className="rounded-3xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                                    Add-ons
                                  </p>
                                  <p className="text-xs font-black text-[#020617]">
                                    Total {formatCurrency(total)}
                                  </p>
                                </div>
                                <div className="space-y-1.5">
                                  {addons.slice(0, 3).map((addon, index) => (
                                    <div
                                      key={`${addon.name}-${index}`}
                                      className="flex items-center justify-between text-xs font-bold"
                                    >
                                      <span className="truncate text-[#020617]">
                                        {addon.name}
                                      </span>
                                      <span className="text-[#64748B]">
                                        {formatCurrency(addon.price)}
                                      </span>
                                    </div>
                                  ))}
                                  {addons.length > 3 && (
                                    <p className="text-xs font-bold text-[#94A3B8]">
                                      +{addons.length - 3} more add-ons
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between border-t border-[#E5EAF1] pt-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={meal.is_available}
                                  onCheckedChange={() =>
                                    toggleAvailability(meal)
                                  }
                                  disabled={meal.approval_status === "pending"}
                                />
                                <span className="text-xs font-black text-[#64748B]">
                                  {meal.approval_status === "pending"
                                    ? "Awaiting approval"
                                    : meal.is_available
                                      ? "Available"
                                      : "Unavailable"}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-xl text-[#7C83F6] hover:bg-[#7C83F6]/10"
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
                                  className="h-9 w-9 rounded-xl text-[#020617] hover:bg-[#F6F8FB]"
                                  onClick={() => openEditDialog(meal)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-xl text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                                  onClick={() => openDeleteDialog(meal)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </div>
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
            <MealImageUpload
              currentImageUrl={formData.image_url}
              onImageChange={handleImageChange}
              mealId={editingMeal?.id}
              onImageUploaded={handleImageUploaded}
              isAnalyzing={analyzing}
            />

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

            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(v) => handleInputChange("category", v)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Describe the meal, ingredients, flavors..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">
                Default price (QAR) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price || ""}
                  onChange={(e) =>
                    handleInputChange("price", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className={`pl-9 ${formErrors.price ? "border-destructive" : ""}`}
                />
              </div>
              {formErrors.price && (
                <p className="text-sm text-destructive">{formErrors.price}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Used for every menu unless period pricing is enabled below.
              </p>
              <p className="text-xs text-muted-foreground">
                Platform fee ({commissionRate}%) will be deducted. Your payout per meal:{" "}
                <span className="font-medium">
                  {formatCurrency((formData.price || 0) * (1 - commissionRate / 100))}
                </span>
              </p>
            </div>

            <div className="rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="menu-pricing" className="text-sm font-black text-[#020617]">
                    Prices by menu
                  </Label>
                  <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                    Offer this meal in selected periods with different prices.
                  </p>
                </div>
                <Switch
                  id="menu-pricing"
                  checked={menuPricingEnabled}
                  onCheckedChange={(checked) => {
                    setMenuPricingEnabled(checked);
                    if (checked) {
                      setMenuOfferings((current) =>
                        current.map((item) => ({
                          ...item,
                          price: item.price || formData.price || 0,
                        })),
                      );
                    }
                  }}
                />
              </div>

              {menuPricingEnabled && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {MENU_PERIODS.map((period) => {
                    const offering = menuOfferings.find(
                      (item) => item.meal_type === period.value,
                    )!;
                    return (
                      <div
                        key={period.value}
                        className={`rounded-[18px] bg-white p-3 ring-1 transition ${
                          offering.is_available
                            ? "ring-[#7C83F6]/30"
                            : "ring-[#E5EAF1] opacity-65"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black text-[#020617]">
                              {period.label}
                            </p>
                            <p className="text-[10px] font-bold text-[#94A3B8]">
                              {period.time}
                            </p>
                          </div>
                          <Switch
                            aria-label={`Offer at ${period.label}`}
                            checked={offering.is_available}
                            onCheckedChange={(checked) =>
                              setMenuOfferings((current) =>
                                current.map((item) =>
                                  item.meal_type === period.value
                                    ? { ...item, is_available: checked }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                        {offering.is_available && (
                          <div className="relative mt-3">
                            <Input
                              aria-label={`${period.label} price`}
                              type="number"
                              min="0"
                              max="10000"
                              step="0.01"
                              value={offering.price || ""}
                              onChange={(event) =>
                                setMenuOfferings((current) =>
                                  current.map((item) =>
                                    item.meal_type === period.value
                                      ? { ...item, price: Number(event.target.value) || 0 }
                                      : item,
                                  ),
                                )
                              }
                              className="h-11 rounded-[14px] border-0 bg-[#F6F8FB] pr-12 font-black text-[#020617]"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#94A3B8]">
                              QAR
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
                  onChange={(e) =>
                    handleInputChange("calories", parseInt(e.target.value) || 0)
                  }
                  className={`pl-9 ${formErrors.calories ? "border-destructive" : ""}`}
                />
              </div>
              {formErrors.calories && (
                <p className="text-sm text-destructive">
                  {formErrors.calories}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="protein">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.protein_g || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "protein_g",
                      parseFloat(e.target.value) || 0,
                    )
                  }
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
                  onChange={(e) =>
                    handleInputChange(
                      "carbs_g",
                      parseFloat(e.target.value) || 0,
                    )
                  }
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
                  onChange={(e) =>
                    handleInputChange("fat_g", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiber">Fiber (g)</Label>
                <Input
                  id="fiber"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.fiber_g ?? ""}
                  onChange={(e) =>
                    handleInputChange(
                      "fiber_g",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>

            {micronutrientsEnabled && (
            <section className="space-y-4 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-base font-semibold text-[#020617]">
                    Nutrition quality
                  </Label>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Leave a field empty when it was not measured. Empty values
                    are never stored as zero.
                  </p>
                </div>
                <div className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                  {formNutritionQuality.score}% complete
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[#22C7A1] transition-[width]"
                  style={{ width: `${formNutritionQuality.score}%` }}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sugar">Sugar (g)</Label>
                  <Input
                    id="sugar"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Not measured"
                    value={formData.sugar_g ?? ""}
                    onChange={(event) =>
                      handleInputChange(
                        "sugar_g",
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sodium">Sodium (mg)</Label>
                  <Input
                    id="sodium"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Not measured"
                    value={formData.sodium_mg ?? ""}
                    onChange={(event) =>
                      handleInputChange(
                        "sodium_mg",
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                    className="bg-white"
                  />
                </div>
                {(
                  [
                    ["potassium_mg", "Potassium", "mg", 1],
                    ["calcium_mg", "Calcium", "mg", 1],
                    ["iron_mg", "Iron", "mg", 0.1],
                    ["vitamin_d_mcg", "Vitamin D", "mcg", 0.1],
                    ["vitamin_b12_mcg", "Vitamin B12", "mcg", 0.1],
                    ["magnesium_mg", "Magnesium", "mg", 1],
                  ] as const
                ).map(([field, label, unit, step]) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>{label} ({unit})</Label>
                    <Input
                      id={field}
                      type="number"
                      min="0"
                      step={step}
                      placeholder="Not measured"
                      value={formData[field] ?? ""}
                      onChange={(event) =>
                        handleInputChange(
                          field,
                          event.target.value === "" ? null : Number(event.target.value),
                        )
                      }
                      className="bg-white"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nutrition-source">Data source</Label>
                  <Select
                    value={formData.nutrition_source}
                    onValueChange={(value: NutritionDataSource) =>
                      handleInputChange("nutrition_source", value)
                    }
                  >
                    <SelectTrigger id="nutrition-source" className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NUTRITION_SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nutrition-source-id">Source reference</Label>
                  <Input
                    id="nutrition-source-id"
                    value={formData.nutrition_source_record_id || ""}
                    onChange={(event) =>
                      handleInputChange(
                        "nutrition_source_record_id",
                        event.target.value,
                      )
                    }
                    placeholder="Label, recipe, or record ID"
                    className="bg-white"
                  />
                </div>
              </div>

              {formNutritionQuality.missingCodes.length > 0 && (
                <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#64748B] ring-1 ring-[#E5EAF1]">
                  Missing: {formNutritionQuality.missingCodes.join(", ")}
                </p>
              )}
            </section>
            )}

            <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
              <div>
                <Label className="text-base font-semibold">
                  Customer customization
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable only the options this meal supports. Disabled options
                  are hidden from customers.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border bg-background p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="supports-large" className="font-semibold">
                      Large portion
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Let customers upgrade this meal size.
                    </p>
                  </div>
                  <Switch
                    id="supports-large"
                    checked={formData.supports_large}
                    onCheckedChange={(checked) =>
                      handleInputChange("supports_large", checked)
                    }
                  />
                </div>
                {formData.supports_large && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="large-calories">Extra calories</Label>
                      <Input
                        id="large-calories"
                        type="number"
                        min="0"
                        value={formData.large_calories_increase || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "large_calories_increase",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="large-protein">Extra protein (g)</Label>
                      <Input
                        id="large-protein"
                        type="number"
                        min="0"
                        step="0.1"
                        value={formData.large_protein_increase || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "large_protein_increase",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="large-price">Extra price (QAR)</Label>
                      <Input
                        id="large-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.large_price_adjustment || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "large_price_adjustment",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border bg-background p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="supports-hp" className="font-semibold">
                      High-Protein
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Let customers add extra protein to this meal.
                    </p>
                  </div>
                  <Switch
                    id="supports-hp"
                    checked={formData.supports_high_protein}
                    onCheckedChange={(checked) =>
                      handleInputChange("supports_high_protein", checked)
                    }
                  />
                </div>
                {formData.supports_high_protein && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="hp-calories">Extra calories</Label>
                      <Input
                        id="hp-calories"
                        type="number"
                        min="0"
                        value={formData.high_protein_calories_increase || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "high_protein_calories_increase",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hp-protein">Extra protein (g)</Label>
                      <Input
                        id="hp-protein"
                        type="number"
                        min="0"
                        step="0.1"
                        value={formData.high_protein_protein_increase || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "high_protein_protein_increase",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hp-price">Extra price (QAR)</Label>
                      <Input
                        id="hp-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.high_protein_price_adjustment || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "high_protein_price_adjustment",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                  </div>
                )}
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
                  onChange={(e) =>
                    handleInputChange(
                      "prep_time_minutes",
                      parseInt(e.target.value) || undefined,
                    )
                  }
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
                        onCheckedChange={() =>
                          setSelectedAddons((prev) =>
                            prev.includes(addon.id)
                              ? prev.filter((id) => id !== addon.id)
                              : [...prev, addon.id],
                          )
                        }
                        className="sr-only"
                      />
                      <span className="text-sm">{addon.name}</span>
                      <span className="text-xs text-muted-foreground">
                        +{addon.price} QAR
                      </span>
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

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_available}
                  onCheckedChange={(checked) =>
                    handleInputChange("is_available", checked)
                  }
                />
                <Label>Available</Label>
              </div>
            </div>

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
              This will permanently delete "{mealToDelete?.name}". This action
              cannot be undone.
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
            <DialogTitle>
              Manage Add-ons: {selectedMealForAddons?.name}
            </DialogTitle>
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
