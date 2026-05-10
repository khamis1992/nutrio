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
  Plus,
  Check,
  ArrowUpRight,
  ShoppingBag,
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
import { getMealImage, getRestaurantImage } from "@/lib/meal-images";

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
  const [cartCount, setCartCount] = useState(0);

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
    { id: "all", label: t("category_all"), icon: LayoutGrid, color: "text-primary" },
    { id: "breakfast", label: t("category_breakfast"), icon: Coffee, color: "text-amber-500" },
    { id: "lunch", label: t("category_lunch"), icon: Sun, color: "text-orange-500" },
    { id: "dinner", label: t("category_dinner"), icon: Moon, color: "text-indigo-500" },
    { id: "snack", label: t("category_snacks"), icon: Apple, color: "text-emerald-500" },
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
        .from("restaurants")
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
        delivery_time: "25-40 min",
        delivery_fee: 0,
      });

      // Then fetch meals - don't fail if meals query has issues
      try {
        const { data: mealsData, error: mealsError } = await supabase
          .from("meals")
          .select("*")
          .eq("restaurant_id", id);

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

  const handleQuickAdd = (mealId: string) => {
    if (!user) {
      promptLogin({
        title: t("add_to_order_title"),
        description: t("add_to_order_description"),
        actionLabel: t("sign_in"),
        signUpLabel: t("create_free_account")
      });
      return;
    }
    setCartCount(prev => prev + 1);
    navigate(`/meals/${mealId}`, { state: { quickAdd: true } });
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
      if (activeCategory !== "all" && meal.meal_type !== activeCategory) {
        return false;
      }
      return true;
    });
  }, [meals, searchQuery, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: meals.length };
    meals.forEach(meal => {
      counts[meal.meal_type] = (counts[meal.meal_type] || 0) + 1;
    });
    return counts;
  }, [meals]);

  // Skeleton Loader Component
  const RestaurantDetailSkeleton = () => (
    <div className="min-h-screen bg-background">
      {/* Hero Skeleton */}
      <Skeleton className="w-full h-[50vh] rounded-b-[40px]" />
      
      {/* Content Skeleton */}
      <div className="px-5 -mt-20 relative z-10 space-y-6">
        <Skeleton className="w-full h-36 rounded-[32px] bg-white shadow-lg" />
        <div className="flex gap-3 overflow-hidden">
          {[1,2,3,4,5].map(i => (
            <Skeleton key={i} className="h-12 w-28 rounded-full shrink-0 bg-white" />
          ))}
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="w-full h-32 rounded-[24px] bg-white shadow-md" />
          ))}
        </div>
      </div>
    </div>
  );

  // Quick Add Button Component
  const QuickAddButton = ({ mealId, onAdd }: { mealId: string; onAdd: (id: string) => void }) => {
    const [isAdded, setIsAdded] = useState(false);

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      hapticFeedback.buttonPress();
      setIsAdded(true);
      onAdd(mealId);
      setTimeout(() => setIsAdded(false), 1500);
    };

    return (
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={handleClick}
        className={`
          w-12 h-12 rounded-full
          flex items-center justify-center
          shadow-lg
          transition-all duration-300
          ${isAdded 
            ? 'bg-emerald-500 text-white' 
            : 'bg-[hsl(142,71%,45%)] text-white'
          }
        `}
      >
        <AnimatePresence mode="wait">
          {isAdded ? (
            <motion.div
              key="check"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Check className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="plus"
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -180 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Plus className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };

  if (loading) {
    return <RestaurantDetailSkeleton />;
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div ref={scrollRef} className="min-h-screen bg-background overflow-y-auto pb-28">
      {/* Animated Header */}
      <motion.header
        style={{ opacity: headerOpacitySpring }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border shadow-sm"
      >
        <div className="flex items-center justify-between px-4 h-16">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/meals")}
            className="w-11 h-11 rounded-full bg-[hsl(120,15%,94%)] flex items-center justify-center"
          >
            <NavChevronLeft className="w-6 h-6 text-[hsl(150,25%,15%)]" />
          </motion.button>
          
          <span className="font-semibold text-[hsl(150,25%,10%)] truncate max-w-[180px] text-lg">
            {restaurant.name}
          </span>
          
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleFavorite}
              className="w-11 h-11 rounded-full bg-[hsl(120,15%,94%)] flex items-center justify-center"
            >
              <Heart 
                className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-[hsl(150,25%,15%)]'}`} 
              />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <div className="relative h-[55vh] overflow-hidden">
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
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(120,20%,98%)]/40 via-transparent to-[hsl(120,20%,98%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(120,20%,98%)] via-transparent to-transparent" />
        
        {/* Floating Action Buttons */}
        <div className="absolute top-12 left-4 right-4 flex items-center justify-between z-10">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/meals")}
            className="w-11 h-11 rounded-full bg-white/80 backdrop-blur-xl flex items-center justify-center shadow-lg"
          >
            <NavChevronLeft className="w-6 h-6 text-[hsl(150,25%,15%)]" />
          </motion.button>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleFavorite}
              className="w-11 h-11 rounded-full bg-white/80 backdrop-blur-xl flex items-center justify-center shadow-lg"
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
                className={`w-5 h-5 relative z-10 transition-colors ${isFavorite ? 'fill-white text-white' : 'text-[hsl(150,25%,15%)]'}`} 
              />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={shareRestaurant}
              className="w-11 h-11 rounded-full bg-white/80 backdrop-blur-xl flex items-center justify-center shadow-lg"
            >
              <Share2 className="w-5 h-5 text-[hsl(150,25%,15%)]" />
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
        className="relative -mt-28 mx-4 z-10"
      >
        <div className="bg-white rounded-[32px] p-6 border border-[hsl(120,15%,90%)] shadow-xl">
          {/* Header Row */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(142,71%,45%)] to-[hsl(168,76%,42%)] flex items-center justify-center text-3xl overflow-hidden shrink-0 shadow-lg">
              <img
                src={getRestaurantImage(restaurant.logo_url, restaurant.id)}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-[hsl(150,25%,10%)] leading-tight">{restaurant.name}</h1>
              <p className="text-[hsl(150,10%,45%)] text-sm mt-1">{restaurant.cuisine_type}</p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5 bg-amber-100 px-3 py-1.5 rounded-full">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span className="font-semibold text-amber-700 text-sm">{restaurant.rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[hsl(150,10%,45%)] text-sm">
              <Clock className="w-4 h-4" />
              <span>{restaurant.delivery_time}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{restaurant.opening_hours}</span>
            </div>
          </div>

          {/* Description */}
          {restaurant.description && (
            <p className="text-[hsl(150,10%,45%)] text-sm leading-relaxed mb-4">
              {restaurant.description}
            </p>
          )}

          {/* Contact Info Toggle */}
          <button
            onClick={() => setShowContactInfo(!showContactInfo)}
            className="flex items-center justify-between w-full py-3 border-t border-[hsl(120,15%,90%)]"
          >
            <span className="text-sm font-medium text-[hsl(150,25%,15%)]">{t("restaurant_contact_location")}</span>
            <motion.div
              animate={{ rotate: showContactInfo ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-[hsl(150,10%,45%)]" />
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
                    <div className="flex items-start gap-3 text-sm text-[hsl(150,10%,45%)]">
                      <div className="w-8 h-8 rounded-full bg-[hsl(120,15%,94%)] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-[hsl(142,71%,45%)]" />
                      </div>
                      <span className="pt-1.5">{restaurant.address}</span>
                    </div>
                  )}
                  {restaurant.phone && (
                    <a 
                      href={`tel:${restaurant.phone}`}
                      className="flex items-center gap-3 text-sm text-[hsl(150,10%,45%)] hover:text-[hsl(142,71%,45%)] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[hsl(120,15%,94%)] flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-[hsl(142,71%,45%)]" />
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
          className="mx-4 mt-6"
        >
          <div className="bg-gradient-to-r from-[hsl(142,71%,45%)]/10 via-[hsl(168,76%,42%)]/10 to-[hsl(142,71%,45%)]/10 border border-[hsl(142,71%,45%)]/30 rounded-[24px] p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(142,71%,45%)]/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(142,71%,45%)] to-[hsl(168,76%,42%)] flex items-center justify-center shadow-lg">
                <Crown className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[hsl(150,25%,10%)] text-lg">{t("unlock_all_meals")}</p>
                <p className="text-sm text-[hsl(150,10%,45%)]">{t("subscribe_to_order")}</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/subscription")}
                className="px-5 py-2.5 bg-[hsl(142,71%,45%)] text-white font-semibold rounded-full text-sm shadow-lg shadow-[hsl(142,71%,45%)]/30"
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
        className="mx-4 mt-6"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(150,10%,45%)]" />
          <Input
            placeholder={t("search_menu")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 pl-12 pr-12 bg-white border-[hsl(120,15%,90%)] rounded-2xl text-[hsl(150,25%,10%)] placeholder:text-[hsl(150,10%,45%)] text-base focus:border-[hsl(142,71%,45%)] focus:ring-[hsl(142,71%,45%)]/20 shadow-sm"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setFilterSheetOpen(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-[hsl(120,15%,94%)] flex items-center justify-center"
          >
            <Filter className="w-4 h-4 text-[hsl(150,10%,45%)]" />
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
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
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
                  flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all shrink-0
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : category.color}`} />
                <span>{category.label}</span>
                <span className={`
                  text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none
                  ${isActive ? 'bg-white/25 text-white' : 'bg-background text-muted-foreground'}
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
        className="px-4 mt-8"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[hsl(150,25%,10%)]">{t("restaurant_menu")}</h3>
          <span className="text-[hsl(150,10%,45%)] text-sm">{t("items_count", { count: filteredMeals.length })}</span>
        </div>
        
        {filteredMeals.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white flex items-center justify-center shadow-md">
              <Utensils className="h-10 w-10 text-[hsl(150,10%,45%)]" />
            </div>
            <h3 className="font-bold text-[hsl(150,25%,10%)] text-lg mb-2">{t("no_meals_found")}</h3>
            <p className="text-sm text-[hsl(150,10%,45%)]">
              {searchQuery ? t("try_different_search") : t("no_meals_category")}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
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
                    className="bg-white rounded-[24px] p-4 border border-[hsl(120,15%,90%)] group cursor-pointer overflow-hidden relative shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Background Gradient on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[hsl(142,71%,45%)]/0 via-[hsl(142,71%,45%)]/0 to-[hsl(168,76%,42%)]/0 group-hover:from-[hsl(142,71%,45%)]/5 group-hover:via-[hsl(142,60%,95%)]/50 group-hover:to-[hsl(168,76%,42%)]/5 transition-all duration-500" />
                    
                    <div className="flex gap-4 relative z-10">
                      {/* Meal Image */}
                      <div className="w-28 h-28 rounded-2xl bg-[hsl(120,20%,98%)] flex items-center justify-center text-4xl overflow-hidden shrink-0 relative">
                        <img
                          src={getMealImage(meal.image_url, meal.id, meal.meal_type)}
                          alt={meal.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />

                        {/* VIP Badge */}
                        {meal.is_vip_exclusive && (
                          <div className="absolute top-2 left-2">
                            <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 text-[10px] px-2 py-0.5">
                              <Crown className="w-3 h-3 mr-1" />
                              {t("vip")}
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      {/* Meal Info */}
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-[hsl(150,25%,10%)] text-lg leading-tight group-hover:text-[hsl(142,71%,45%)] transition-colors">
                            {meal.name}
                          </h4>
                          {hasActiveSubscription && (
                            <div className="mt-1">
                              <QuickAddButton mealId={meal.id} onAdd={handleQuickAdd} />
                            </div>
                          )}
                        </div>
                        
                        {meal.description && (
                          <p className="text-[hsl(150,10%,45%)] text-sm mt-1 line-clamp-2">{meal.description}</p>
                        )}

                        {/* Nutrition Row */}
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex items-center gap-1 text-[hsl(150,10%,45%)] text-xs">
                            <Flame className="w-3.5 h-3.5 text-orange-500" />
                            <span>{t("calories_short", { calories: meal.calories })}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[hsl(150,10%,45%)] text-xs">
                            <Beef className="w-3.5 h-3.5 text-[hsl(142,71%,45%)]" />
                            <span>{t("protein_short", { protein: meal.protein_g })}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[hsl(150,10%,45%)] text-xs">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{meal.rating.toFixed(1)}</span>
                          </div>
                        </div>

                        {/* Tags */}
                        {meal.diet_tags.length > 0 && (
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {meal.diet_tags.slice(0, 2).map((tag) => (
                              <span 
                                key={tag} 
                                className="text-[10px] px-2 py-1 rounded-full bg-[hsl(120,15%,94%)] text-[hsl(150,10%,45%)] border border-[hsl(120,15%,90%)]"
                              >
                                {tag}
                              </span>
                            ))}
                            {meal.diet_tags.length > 2 && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-[hsl(120,15%,94%)] text-[hsl(150,10%,45%)]">
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

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 100 }}
            whileTap={{ scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-[hsl(142,71%,45%)] text-white px-6 py-4 rounded-full font-bold shadow-xl shadow-[hsl(142,71%,45%)]/30 flex items-center gap-3"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>{t("items_in_cart", { count: cartCount })}</span>
            <ArrowUpRight className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Filter Sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-[32px] bg-white border-t border-[hsl(120,15%,90%)]">
          <SheetHeader className="pb-6">
            <SheetTitle className="text-2xl font-bold text-[hsl(150,25%,10%)] text-center">{t("filters")}</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-8 overflow-y-auto pb-24">
            {/* Dietary Tags */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[hsl(150,10%,45%)] uppercase tracking-wider">
                {t("dietary_preferences")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((tag) => (
                  <motion.button
                    key={tag}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2.5 rounded-full bg-[hsl(120,20%,98%)] text-[hsl(150,25%,15%)] text-sm border border-[hsl(120,15%,90%)] hover:bg-[hsl(142,71%,45%)] hover:text-white hover:border-[hsl(142,71%,45%)] transition-colors"
                  >
                    {tag}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Calorie Range */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[hsl(150,10%,45%)] uppercase tracking-wider">
                {t("calorie_range")}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {CALORIE_RANGES.map((range) => (
                  <motion.button
                    key={range}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2.5 rounded-full bg-[hsl(120,20%,98%)] text-[hsl(150,25%,15%)] text-sm border border-[hsl(120,15%,90%)] hover:bg-[hsl(142,71%,45%)] hover:text-white hover:border-[hsl(142,71%,45%)] transition-colors"
                  >
                    {range}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Protein Range */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[hsl(150,10%,45%)] uppercase tracking-wider">
                {t("protein_content")}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {PROTEIN_RANGES.map((range) => (
                  <motion.button
                    key={range}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2.5 rounded-full bg-[hsl(120,20%,98%)] text-[hsl(150,25%,15%)] text-sm border border-[hsl(120,15%,90%)] hover:bg-[hsl(142,71%,45%)] hover:text-white hover:border-[hsl(142,71%,45%)] transition-colors"
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
              className="w-full h-14 rounded-2xl bg-[hsl(142,71%,45%)] text-white font-bold text-lg shadow-lg shadow-[hsl(142,71%,45%)]/30"
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
