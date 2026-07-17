import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { NavChevronLeft } from "@/components/ui/nav-chevron";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Star,
  Flame,
  Beef,
  Clock,
  Search,
  Utensils,
  MapPin,
  Phone,
  Crown,
  Heart,
  Share2,
  ChevronDown,
  Filter,
  Coffee,
  Sun,
  Moon,
  Apple,
  LayoutGrid,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";

import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import { hapticFeedback } from "@/lib/capacitor";
import { formatCurrency } from "@/lib/currency";
import { getMealImage, getRestaurantImage } from "@/lib/meal-images";
import {
  getAvailableMenuPeriods,
  getMenuPrice,
  type MenuOffering,
  type MenuPeriod,
} from "@/lib/menu-pricing";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  rating: number;
  total_orders: number;
  cuisine_type: string | null;
  opening_hours: string | null;
  delivery_time?: string;
  delivery_fee?: number;
}

interface Meal {
  id: string;
  name: string;
  image_url: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  rating: number;
  prep_time_minutes: number;
  diet_tags: string[];
  is_vip_exclusive: boolean;
  price: number;
  meal_type: string;
  description?: string;
  menu_offerings: MenuOffering[];
}

const RestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasActiveSubscription } = useSubscription();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeDietTags, setActiveDietTags] = useState<string[]>([]);
  const [activeCalorieRange, setActiveCalorieRange] = useState<string | null>(null);
  const [activeProteinRange, setActiveProteinRange] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  
  const headerOpacity = useTransform(scrollY, [0, 180], [0, 1]);
  const heroScale = useTransform(scrollY, [0, 300], [1, 1.15]);
  const heroOpacity = useTransform(scrollY, [0, 250], [1, 0.4]);
  const infoCardY = useTransform(scrollY, [0, 200], [0, -30]);
  
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const headerOpacitySpring = useSpring(headerOpacity, springConfig);
  const infoCardYSpring = useSpring(infoCardY, springConfig);

  const MEAL_CATEGORIES = useMemo(() => [
    { id: "all", label: t("category_all"), icon: LayoutGrid, color: "text-[#020617]" },
    { id: "breakfast", label: t("category_breakfast"), icon: Coffee, color: "text-amber-500" },
    { id: "lunch", label: t("category_lunch"), icon: Sun, color: "text-orange-500" },
    { id: "dinner", label: t("category_dinner"), icon: Moon, color: "text-indigo-500" },
    { id: "snack", label: t("category_snacks"), icon: Apple, color: "text-[#020617]" },
  ], [t]);

  const DIETARY_TAGS = useMemo(() => [
    t("diet_vegetarian"),
    t("diet_vegan"),
    t("diet_gluten_free"),
    t("diet_keto"),
    t("diet_high_protein"),
    t("diet_low_calorie"),
  ], [t]);

  const CALORIE_RANGES = useMemo(() => [
    t("calories_under_300"),
    t("calories_300_500"),
    t("calories_500_700"),
    t("calories_700_plus"),
  ], [t]);

  const PROTEIN_RANGES = useMemo(() => [
    t("protein_high"),
    t("protein_medium"),
    t("protein_low"),
  ], [t]);

  useEffect(() => {
    if (id) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    setLoading(true);
    
    try {
      // First, fetch the restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("public_restaurant_catalog" as "restaurants")
        .select("*")
        .eq("id", id)
        .single();

      if (restaurantError) {
        console.error("Restaurant query error:", restaurantError);
        toast({
          title: t("error"),
          description: "Failed to load restaurant details",
          variant: "destructive"
        });
        navigate("/meals");
        return;
      }

      setRestaurant({
        id: restaurantData.id,
        name: restaurantData.name,
        description: restaurantData.description,
        logo_url: restaurantData.logo_url,
        cover_url: (restaurantData as Record<string, unknown>).cover_url as string || restaurantData.logo_url,
        address: restaurantData.address,
        phone: restaurantData.phone,
        email: restaurantData.email,
        rating: parseFloat(String(restaurantData.rating)) || 4.5,
        total_orders: restaurantData.total_orders || 0,
        cuisine_type: restaurantData.cuisine_type || t("healthy_cuisine"),
        opening_hours: (restaurantData as Record<string, unknown>).opening_hours as string || t("open_now"),
        delivery_time: (restaurantData as Record<string, unknown>).delivery_time as string || undefined,
        delivery_fee: (restaurantData as Record<string, unknown>).delivery_fee as number || 0,
      });

      // Then fetch meals - don't fail if meals query has issues
      try {
        const { data: mealsData, error: mealsError } = await supabase
          .from("public_meal_catalog" as "meals")
          .select("*")
          .eq("restaurant_id", id)
          .eq("approval_status", "approved")
          .eq("is_available", true);

        if (!mealsError && mealsData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformedMeals: Meal[] = (mealsData || []).map((meal: any) => ({
            id: String(meal.id),
            name: String(meal.name),
            image_url: meal.image_url ? String(meal.image_url) : null,
            calories: Number(meal.calories) || 0,
            protein_g: parseFloat(String(meal.protein_g)) || 0,
            carbs_g: parseFloat(String(meal.carbs_g)) || 0,
            fat_g: parseFloat(String(meal.fat_g)) || 0,
            rating: meal.rating ? parseFloat(String(meal.rating)) : 4.5,
            prep_time_minutes: Number(meal.prep_time_minutes) || 15,
            diet_tags: Array.isArray(meal.diet_tags) ? meal.diet_tags.map(String) : [],
            is_vip_exclusive: Boolean(meal.is_vip_exclusive),
            price: parseFloat(String(meal.price)) || 0,
            meal_type: String(meal.meal_type || "lunch"),
            description: meal.description ? String(meal.description) : undefined,
            menu_offerings: Array.isArray(meal.menu_offerings)
              ? meal.menu_offerings.map((offering: Record<string, unknown>) => ({
                  meal_type: String(offering.meal_type) as MenuPeriod,
                  price: Number(offering.price) || 0,
                  is_available: offering.is_available !== false,
                }))
              : [],
          }));
          setMeals(transformedMeals);
        } else if (mealsError) {
          console.warn("Meals query warning (non-blocking):", mealsError);
        }
      } catch (mealsErr) {
        console.warn("Meals fetch failed (non-blocking):", mealsErr);
        // Continue with empty meals array
        setMeals([]);
      }
    } catch (err) {
      console.error("Error fetching restaurant data:", err);
      navigate("/meals");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = () => {
    if (!user) {
      promptLogin({
        title: t("save_favorites_title"),
        description: t("save_favorites_description"),
        actionLabel: t("sign_in"),
        signUpLabel: t("create_free_account")
      });
      return;
    }
    hapticFeedback.buttonPress();
    setIsFavorite(!isFavorite);
    toast({
      title: isFavorite ? t("removed_from_favorites") : t("added_to_favorites"),
      duration: 2000,
    });
  };

  const shareRestaurant = async () => {
    if (!restaurant) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: restaurant.name,
          text: t("share_restaurant_text", { name: restaurant.name }),
          url: window.location.href,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: t("link_copied") });
    }
  };

  const filteredMeals = useMemo(() => {
    return meals.filter(meal => {
      if (searchQuery && !meal.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (activeCategory !== "all" && !getAvailableMenuPeriods(meal.menu_offerings).includes(activeCategory as MenuPeriod)) {
        return false;
      }
      if (activeDietTags.length > 0 && !activeDietTags.some(tag => meal.diet_tags.includes(tag))) {
        return false;
      }
      if (activeCalorieRange) {
        const cal = meal.calories;
        if (activeCalorieRange === t("calories_under_300") && cal >= 300) return false;
        if (activeCalorieRange === t("calories_300_500") && (cal < 300 || cal > 500)) return false;
        if (activeCalorieRange === t("calories_500_700") && (cal < 500 || cal > 700)) return false;
        if (activeCalorieRange === t("calories_700_plus") && cal <= 700) return false;
      }
      if (activeProteinRange) {
        const p = meal.protein_g;
        if (activeProteinRange === t("protein_high") && p < 30) return false;
        if (activeProteinRange === t("protein_medium") && (p < 15 || p > 30)) return false;
        if (activeProteinRange === t("protein_low") && p > 15) return false;
      }
      return true;
    });
  }, [meals, searchQuery, activeCategory, activeDietTags, activeCalorieRange, activeProteinRange, t]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: meals.length };
    meals.forEach(meal => {
      getAvailableMenuPeriods(meal.menu_offerings).forEach((period) => {
        counts[period] = (counts[period] || 0) + 1;
      });
    });
    return counts;
  }, [meals]);

  // Skeleton Loader Component
  const RestaurantDetailSkeleton = () => (
    <div className="min-h-screen bg-[#F7FAF8]">
      <Skeleton className="h-[280px] w-full rounded-b-[34px]" />
      
      <div className="relative z-10 mx-auto -mt-16 max-w-[430px] space-y-5 px-4">
        <Skeleton className="h-40 w-full rounded-[30px] bg-white shadow-lg" />
        <div className="flex gap-2 overflow-hidden">
          {[1,2,3,4,5].map(i => (
            <Skeleton key={i} className="h-11 w-24 shrink-0 rounded-full bg-white" />
          ))}
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-36 w-full rounded-[26px] bg-white shadow-md" />
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <RestaurantDetailSkeleton />;
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div ref={scrollRef} className="min-h-screen overflow-y-auto bg-[#F8FAFC] pb-24">
      {/* Animated Header */}
      <motion.header
        style={{ opacity: headerOpacitySpring }}
        className="fixed left-0 right-0 top-0 z-50 bg-[#F8FAFC]/95 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-[78px] max-w-[430px] items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <motion.button
            whileTap={{ scale: 0.9 }}
            data-testid="restaurant-detail-back-btn"
            onClick={() => navigate("/meals")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-100"
          >
            <NavChevronLeft className="h-6 w-6" />
          </motion.button>
          
          <span className="max-w-[210px] truncate text-[17px] font-black text-slate-950">
            {restaurant.name}
          </span>
          
          <div className="flex items-center gap-2">
            <motion.button
            whileTap={{ scale: 0.9 }}
            data-testid="restaurant-detail-fav-btn"
            onClick={toggleFavorite}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-100"
            >
              <Heart 
                className={`h-5 w-5 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} 
              />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <div className="relative h-[310px] overflow-hidden rounded-b-[36px]">
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity }}
          className="absolute inset-0"
        >
          <img
            src={getRestaurantImage(restaurant.cover_url, restaurant.id)}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        </motion.div>
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-[#F8FAFC]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] via-transparent to-transparent" />
        
        {/* Floating Action Buttons */}
        <div className="absolute left-0 right-0 top-12 z-10 mx-auto flex max-w-[430px] items-center justify-between px-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            data-testid="restaurant-detail-back-float-btn"
            onClick={() => navigate("/meals")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl"
          >
            <NavChevronLeft className="h-6 w-6 text-slate-800" />
          </motion.button>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              data-testid="restaurant-detail-fav-float-btn"
              onClick={toggleFavorite}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl"
            >
              <AnimatePresence>
                {isFavorite && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute inset-0 bg-red-500 rounded-full"
                  />
                )}
              </AnimatePresence>
              <Heart 
                className={`relative z-10 h-5 w-5 transition-colors ${isFavorite ? 'fill-white text-white' : 'text-slate-800'}`} 
              />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              data-testid="restaurant-detail-share-btn"
              onClick={shareRestaurant}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl"
            >
              <Share2 className="h-5 w-5 text-slate-800" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Restaurant Info Card */}
      <motion.div
        style={{ y: infoCardYSpring }}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 mx-auto -mt-16 max-w-[430px] px-4"
      >
        <div className="rounded-[32px] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
          {/* Header Row */}
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 text-3xl shadow-sm ring-1 ring-slate-100">
              <img
                src={getRestaurantImage(restaurant.logo_url, restaurant.id)}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-[26px] font-black leading-tight text-slate-950">{restaurant.name}</h1>
              <p className="mt-1 text-[13px] font-bold text-slate-500">{restaurant.cuisine_type}</p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="flex h-11 items-center gap-2 rounded-full bg-amber-50 px-3.5 ring-1 ring-amber-100">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-amber-500">
                <Star className="h-3.5 w-3.5 fill-amber-500" />
              </span>
              <div className="leading-none">
                <p className="text-[14px] font-black text-slate-950">{restaurant.rating.toFixed(1)}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-amber-700">Rating</p>
              </div>
            </div>
            <div className="flex h-11 items-center gap-2 rounded-full bg-slate-50 px-3.5 ring-1 ring-slate-100">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-slate-500">
                <Clock className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 leading-none">
                <p className="max-w-[92px] truncate text-[13px] font-black text-slate-950">{restaurant.delivery_time || "Open"}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">Time</p>
              </div>
            </div>
            <div className="flex h-11 items-center gap-2 rounded-full bg-slate-50 px-3.5 ring-1 ring-slate-100">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white">
                <span className="h-2 w-2 rounded-full bg-[#020617]" />
              </span>
              <div className="min-w-0 leading-none">
                <p className="max-w-[112px] truncate text-[13px] font-black text-[#020617]">{restaurant.opening_hours}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">Status</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {restaurant.description && (
            <p className="mb-4 text-[13px] font-semibold leading-relaxed text-slate-500">
              {restaurant.description}
            </p>
          )}

          {/* Contact Info Toggle */}
          <button
            data-testid="restaurant-detail-contact-toggle"
            onClick={() => setShowContactInfo(!showContactInfo)}
            className="flex min-h-[50px] w-full items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-2.5 text-left active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#020617]">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="truncate text-[13px] font-black text-slate-700">{t("restaurant_contact_location")}</span>
            </div>
            <motion.div
              animate={{ rotate: showContactInfo ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0"
            >
              <ChevronDown className="h-5 w-5 text-slate-400" />
            </motion.div>
          </button>
          
          <AnimatePresence>
            {showContactInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  {restaurant.address && (
                    <div className="flex items-start gap-3 text-sm font-semibold text-slate-500">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 ring-1 ring-slate-100">
                        <MapPin className="w-4 h-4 text-[#020617]" />
                      </div>
                      <span className="pt-1.5">{restaurant.address}</span>
                    </div>
                  )}
                  {restaurant.phone && (
                    <a 
                      href={`tel:${restaurant.phone}`}
                      className="flex items-center gap-3 text-sm font-semibold text-slate-500 transition-colors hover:text-[#020617]"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 ring-1 ring-slate-100">
                        <Phone className="w-4 h-4 text-[#020617]" />
                      </div>
                      <span className="pt-1.5">{restaurant.phone}</span>
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Subscription Banner */}
      {!hasActiveSubscription && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mt-5 max-w-[430px] px-4"
        >
          <div className="relative overflow-hidden rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)] ring-1 ring-slate-100">
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-[#020617] ring-1 ring-slate-100">
                <Crown className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-black text-slate-950">{t("unlock_all_meals")}</p>
                <p className="text-[12px] font-semibold text-slate-500">{t("subscribe_to_order")}</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/subscription")}
                className="h-10 rounded-full bg-[#020617] px-4 text-[12px] font-black text-white shadow-[0_10px_20px_rgba(2,6,23,0.18)]"
              >
                {t("subscribe")}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mx-auto mt-5 max-w-[430px] px-4"
      >
        <div className="relative">
          <Search className="absolute left-8 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t("search_menu")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-14 w-full rounded-full border-slate-100 bg-white pl-12 pr-14 text-[15px] font-bold text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.055)] placeholder:text-slate-400 focus:border-[#020617] focus:ring-slate-200"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setFilterSheetOpen(true)}
            className="absolute right-6 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-50 text-slate-600"
          >
            <Filter className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>

      {/* Category Pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6"
      >
        <div className="mx-auto flex max-w-[430px] gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {MEAL_CATEGORIES.map((category, index) => {
            const isActive = activeCategory === category.id;
            const count = categoryCounts[category.id] || 0;
            const Icon = category.icon;
            return (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(category.id)}
                className={`
                  flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-black whitespace-nowrap transition-all
                  ${isActive
                    ? 'bg-[#020617] text-white shadow-[0_10px_18px_rgba(2,6,23,0.18)]'
                    : 'bg-white text-slate-500 shadow-sm ring-1 ring-slate-100'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : category.color}`} />
                <span>{category.label}</span>
                <span className={`
                  text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none
                  ${isActive ? 'bg-white/25 text-white' : 'bg-slate-50 text-slate-400'}
                `}>
                  {count}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Menu Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mx-auto mt-7 max-w-[430px] px-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[22px] font-black text-slate-950">{t("restaurant_menu")}</h3>
          <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-500 shadow-sm ring-1 ring-slate-100">{t("items_count", { count: filteredMeals.length })}</span>
        </div>
        
        {filteredMeals.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white flex items-center justify-center shadow-md">
              <Utensils className="h-10 w-10 text-[#020617]" />
            </div>
            <h3 className="font-bold text-[#020617] text-lg mb-2">{t("no_meals_found")}</h3>
            <p className="text-sm text-slate-500">
              {searchQuery ? t("try_different_search") : t("no_meals_category")}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredMeals.map((meal, index) => (
              <motion.div
                key={meal.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <Link to={`/meals/${meal.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    className="group relative cursor-pointer overflow-hidden rounded-[26px] border border-white/70 bg-white/85 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.055)] ring-1 ring-slate-100/80 backdrop-blur-xl transition-shadow"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-slate-50/0 to-white/0 transition-all duration-500 group-hover:via-slate-50/80" />
                    
                    <div className="relative z-10 flex gap-3">
                      {/* Meal Image */}
                      <div className="relative flex h-[112px] w-[112px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-slate-50 text-4xl">
                        <img
                          src={getMealImage(meal.image_url, meal.id, meal.meal_type)}
                          alt={meal.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />

                        {/* VIP Badge */}
                        {meal.is_vip_exclusive && (
                          <div className="absolute top-2 left-2">
                              <Badge className="border-0 bg-amber-500 px-2 py-0.5 text-[10px] text-white">
                              <Crown className="w-3 h-3 mr-1" />
                              {t("vip")}
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      {/* Meal Info */}
                      <div className="min-w-0 flex-1 py-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-[16px] font-black leading-tight text-slate-950 transition-colors group-hover:text-[#020617]">
                            {meal.name}
                          </h4>
                          <div className="shrink-0 text-right">
                            <p className="text-[13px] font-black text-[#22C7A1]">
                              {formatCurrency(getMenuPrice(meal.price, meal.menu_offerings, activeCategory))}
                            </p>
                            <p className="text-[8px] font-black uppercase text-[#94A3B8]">
                              {activeCategory === "all" && meal.menu_offerings.length > 1
                                ? "from"
                                : activeCategory === "all"
                                  ? "all day"
                                  : activeCategory}
                            </p>
                          </div>
                        </div>
                        
                        {meal.description && (
                          <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-relaxed text-slate-500">{meal.description}</p>
                        )}

                        {/* Nutrition Row */}
                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          <div className="min-w-0 rounded-[14px] bg-slate-50/80 px-2 py-2 ring-1 ring-slate-200/80 backdrop-blur">
                            <div className="flex min-w-0 items-center gap-1 text-orange-700">
                              <Flame className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate text-[11px] font-black leading-none">{meal.calories}</span>
                            </div>
                            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">kcal</p>
                          </div>
                          <div className="min-w-0 rounded-[14px] bg-slate-50/80 px-2 py-2 ring-1 ring-slate-200/80 backdrop-blur">
                            <div className="flex min-w-0 items-center gap-1 text-[#020617]">
                              <Beef className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate text-[11px] font-black leading-none">{meal.protein_g}g</span>
                            </div>
                            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">protein</p>
                          </div>
                          <div className="min-w-0 rounded-[14px] bg-slate-50/80 px-2 py-2 ring-1 ring-slate-200/80 backdrop-blur">
                            <div className="flex min-w-0 items-center gap-1 text-amber-600">
                              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />
                              <span className="truncate text-[11px] font-black leading-none">{meal.rating.toFixed(1)}</span>
                            </div>
                            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">rating</p>
                          </div>
                        </div>

                        {/* Tags */}
                        {meal.diet_tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {meal.diet_tags.slice(0, 2).map((tag) => (
                              <span 
                                key={tag} 
                                className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500"
                              >
                                {tag}
                              </span>
                            ))}
                            {meal.diet_tags.length > 2 && (
                              <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">
                                +{meal.diet_tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Bottom Spacing */}
      <div className="h-8" />

      {/* Filter Sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="h-[82vh] rounded-t-[34px] border-t border-slate-100 bg-white px-4">
          <div className="mx-auto mt-1 h-1.5 w-12 rounded-full bg-slate-200" />
          <SheetHeader className="pb-6 pt-3">
            <SheetTitle className="text-center text-[22px] font-black text-slate-950">{t("filters")}</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-8 overflow-y-auto pb-24">
            {/* Dietary Tags */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                {t("dietary_preferences")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((tag) => (
                  <motion.button
                    key={tag}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveDietTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={`min-h-[42px] rounded-full px-4 text-[13px] font-black ring-1 transition-colors ${
                      activeDietTags.includes(tag)
                        ? "bg-[#020617] text-white ring-[#020617]"
                        : "bg-slate-50 text-slate-600 ring-slate-100"
                    }`}
                  >
                    {tag}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Calorie Range */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                {t("calorie_range")}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {CALORIE_RANGES.map((range) => (
                  <motion.button
                    key={range}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveCalorieRange(prev => prev === range ? null : range)}
                    className={`min-h-[42px] rounded-full px-4 text-[13px] font-black ring-1 transition-colors ${
                      activeCalorieRange === range
                        ? "bg-[#020617] text-white ring-[#020617]"
                        : "bg-slate-50 text-slate-600 ring-slate-100"
                    }`}
                  >
                    {range}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Protein Range */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                {t("protein_content")}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {PROTEIN_RANGES.map((range) => (
                  <motion.button
                    key={range}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveProteinRange(prev => prev === range ? null : range)}
                    className={`min-h-[42px] rounded-full px-4 text-[13px] font-black ring-1 transition-colors ${
                      activeProteinRange === range
                        ? "bg-[#020617] text-white ring-[#020617]"
                        : "bg-slate-50 text-slate-600 ring-slate-100"
                    }`}
                  >
                    {range}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Apply Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterSheetOpen(false)}
              className="h-14 w-full rounded-full bg-[#020617] text-[15px] font-black text-white shadow-[0_16px_30px_rgba(2,6,23,0.22)]"
            >
              {t("apply_filters")}
            </motion.button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Guest Login Prompt */}
      <GuestLoginPrompt
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        title={loginPromptConfig.title}
        description={loginPromptConfig.description}
        actionLabel={loginPromptConfig.actionLabel}
        signUpLabel={loginPromptConfig.signUpLabel}
      />
    </div>
  );
};

export default RestaurantDetail;
