import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft,
  Star,
  Flame,
  Beef,
  Clock,
  Search,
  Utensils,
  MapPin,
  Phone,
  Mail,
  Crown,
  LayoutGrid,
  List,
  Heart,
  Share2,
  ChevronDown,
  ChevronUp,
  Filter,
  Plus,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { MealsRemainingWidget } from "@/components/MealsRemainingWidget";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import { hapticFeedback } from "@/lib/capacitor";

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
}

const MEAL_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

// Skeleton Loader Component
const RestaurantDetailSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* Hero Skeleton */}
    <Skeleton className="w-full h-[40vh]" />
    
    {/* Content Skeleton */}
    <div className="px-4 -mt-16 relative z-10 space-y-4">
      <Skeleton className="w-full h-32 rounded-3xl" />
      <Skeleton className="w-full h-16 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
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
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      className={`
        absolute bottom-3 right-3 z-10
        w-10 h-10 rounded-full
        flex items-center justify-center
        shadow-lg
        transition-all duration-300
        ${isAdded 
          ? 'bg-emerald-500 text-white' 
          : 'bg-primary text-primary-foreground'
        }
      `}
    >
      <AnimatePresence mode="wait">
        {isAdded ? (
          <motion.div
            key="check"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Check className="w-5 h-5" />
          </motion.div>
        ) : (
          <motion.div
            key="plus"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Plus className="w-5 h-5" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

const RestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasActiveSubscription, subscription, remainingMeals, isUnlimited, isVip } = useSubscription();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "gallery">("gallery");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  
  const headerOpacity = useTransform(scrollY, [0, 150], [0, 1]);
  const heroScale = useTransform(scrollY, [0, 200], [1, 1.1]);
  const heroOpacity = useTransform(scrollY, [0, 200], [1, 0.6]);
  
  const springConfig = { stiffness: 100, damping: 30 };
  const headerOpacitySpring = useSpring(headerOpacity, springConfig);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    try {
      // Fetch restaurant details
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .single();

      if (restaurantError) throw restaurantError;

      setRestaurant({
        id: restaurantData.id,
        name: restaurantData.name,
        description: restaurantData.description,
        logo_url: restaurantData.logo_url,
        cover_url: null,
        address: restaurantData.address,
        phone: restaurantData.phone,
        email: restaurantData.email,
        rating: parseFloat(String(restaurantData.rating)) || 0,
        total_orders: restaurantData.total_orders || 0,
        cuisine_type: null,
        opening_hours: null,
      });

      // Fetch meals for this restaurant
      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("*")
        .eq("restaurant_id", id);

      if (mealsError) throw mealsError;

      const transformedMeals: Meal[] = (mealsData || []).map((meal: any) => ({
        id: meal.id,
        name: meal.name,
        image_url: meal.image_url,
        calories: meal.calories || 0,
        protein_g: parseFloat(meal.protein_g) || 0,
        carbs_g: parseFloat(meal.carbs_g) || 0,
        fat_g: parseFloat(meal.fat_g) || 0,
        rating: meal.rating ? parseFloat(meal.rating) : 0,
        prep_time_minutes: meal.prep_time_minutes || 15,
        diet_tags: meal.diet_tags || [],
        is_vip_exclusive: meal.is_vip_exclusive || false,
        price: parseFloat(meal.price) || 0,
        meal_type: meal.meal_type || "lunch",
      }));

      setMeals(transformedMeals);
    } catch (err) {
      console.error("Error fetching restaurant data:", err);
      navigate("/meals");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = (mealId: string) => {
    // Navigate to meal detail with quick schedule intent
    navigate(`/meals/${mealId}`, { state: { quickAdd: true } });
  };

  const toggleFavorite = () => {
    hapticFeedback.buttonPress();
    setIsFavorite(!isFavorite);
    toast({
      title: isFavorite ? "Removed from favorites" : "Added to favorites",
    });
  };

  const shareRestaurant = async () => {
    if (!restaurant) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: restaurant.name,
          text: `Check out ${restaurant.name}!`,
          url: window.location.href,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied to clipboard" });
    }
  };

  const filteredMeals = useMemo(() => {
    return meals.filter(meal => {
      // Search filter
      if (searchQuery && !meal.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
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

  if (loading) {
    return <RestaurantDetailSkeleton />;
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div ref={scrollRef} className="min-h-screen bg-background overflow-y-auto pb-24">
      {/* Animated Header */}
      <motion.header
        style={{ opacity: headerOpacitySpring }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
      >
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/meals")}
            className="rounded-full bg-background/50 backdrop-blur"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <span className="font-semibold truncate max-w-[200px]">{restaurant.name}</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={shareRestaurant}
              className="rounded-full"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section with Cover Image */}
      <div className="relative h-[45vh] overflow-hidden">
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity }}
          className="absolute inset-0"
        >
          {restaurant.cover_url ? (
            <img
              src={restaurant.cover_url}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center">
              {restaurant.logo_url ? (
                <img 
                  src={restaurant.logo_url} 
                  alt={restaurant.name}
                  className="w-32 h-32 rounded-3xl shadow-2xl"
                />
              ) : (
                <span className="text-8xl">🍽️</span>
              )}
            </div>
          )}
        </motion.div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background" />
        
        {/* Floating Action Bar */}
        <div className="absolute top-12 left-4 right-4 flex items-center justify-between">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => navigate("/meals")}
            className="rounded-full bg-background/80 backdrop-blur shadow-lg"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={toggleFavorite}
              className="rounded-full bg-background/80 backdrop-blur shadow-lg"
            >
              <motion.div
                animate={isFavorite ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Heart 
                  className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} 
                />
              </motion.div>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={shareRestaurant}
              className="rounded-full bg-background/80 backdrop-blur shadow-lg"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="relative -mt-20 px-4 space-y-4">
        {/* Restaurant Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card rounded-3xl shadow-xl border border-border/50 p-6"
        >
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center text-4xl overflow-hidden shadow-md shrink-0">
              {restaurant.logo_url ? (
                <img 
                  src={restaurant.logo_url} 
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                "🍽️"
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{restaurant.name}</h1>
              {restaurant.cuisine_type && (
                <p className="text-sm text-muted-foreground">{restaurant.cuisine_type}</p>
              )}
              
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-semibold">{restaurant.rating.toFixed(1)}</span>
                </div>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{restaurant.total_orders} orders</span>
                {restaurant.opening_hours && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-emerald-600 font-medium">{restaurant.opening_hours}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {restaurant.description && (
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              {restaurant.description}
            </p>
          )}

          {/* Contact Info - Collapsible */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <button
              onClick={() => setShowContactInfo(!showContactInfo)}
              className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground"
            >
              <span>Contact Information</span>
              {showContactInfo ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            <AnimatePresence>
              {showContactInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-2">
                    {restaurant.address && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{restaurant.address}</span>
                      </div>
                    )}
                    {restaurant.phone && (
                      <a 
                        href={`tel:${restaurant.phone}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                      >
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{restaurant.phone}</span>
                      </a>
                    )}
                    {restaurant.email && (
                      <a 
                        href={`mailto:${restaurant.email}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                      >
                        <Mail className="w-4 h-4 shrink-0" />
                        <span>{restaurant.email}</span>
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Subscription Status Banner */}
        {hasActiveSubscription ? (
          <MealsRemainingWidget
            remainingMeals={remainingMeals}
            totalMeals={subscription?.meals_per_week || 0}
            isUnlimited={isUnlimited}
            isVip={isVip}
            variant="banner"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Subscribe to order meals</p>
                <p className="text-xs text-muted-foreground">All meals included in your subscription</p>
              </div>
              <Button size="sm" onClick={() => navigate("/subscription")}>
                Subscribe
              </Button>
            </div>
          </motion.div>
        )}

        {/* Search and View Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search meals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setFilterSheetOpen(true)}
            className="rounded-xl shrink-0"
          >
            <Filter className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1 shrink-0">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "gallery" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setViewMode("gallery")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
        >
          {MEAL_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${activeCategory === category.id 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
            >
              {category.label}
              <span className={`
                px-1.5 py-0.5 rounded-full text-xs
                ${activeCategory === category.id 
                  ? 'bg-primary-foreground/20' 
                  : 'bg-background'
                }
              `}>
                {categoryCounts[category.id] || 0}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Meals Section */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Menu ({filteredMeals.length})</h3>
          </div>
          
          {filteredMeals.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Utensils className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold mb-2">No meals found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "Try a different search term" : "No meals in this category"}
              </p>
            </div>
          ) : viewMode === "gallery" ? (
            /* Gallery View */
            <div className="grid grid-cols-2 gap-4">
              {filteredMeals.map((meal, index) => (
                <motion.div
                  key={meal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/meals/${meal.id}`}>
                    <Card className="overflow-hidden group cursor-pointer">
                      <div className="aspect-square relative bg-muted">
                        {meal.image_url ? (
                          <img
                            src={meal.image_url}
                            alt={meal.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-muted to-muted-foreground/10">
                            🍽️
                          </div>
                        )}
                        
                        {/* Quick Add Button */}
                        {hasActiveSubscription && (
                          <QuickAddButton mealId={meal.id} onAdd={handleQuickAdd} />
                        )}
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                        
                        {/* VIP Badge */}
                        {meal.is_vip_exclusive ? (
                          <Badge className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0">
                            <Crown className="w-3 h-3 mr-1" />
                            VIP
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="absolute top-2 left-2 bg-primary/90 text-primary-foreground">
                            Included
                          </Badge>
                        )}
                        
                        {/* Info Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <h4 className="font-semibold text-sm line-clamp-2 mb-1">{meal.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              {meal.calories}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-warning text-warning" />
                              {meal.rating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="space-y-3">
              {filteredMeals.map((meal, index) => (
                <motion.div
                  key={meal.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/meals/${meal.id}`}>
                    <Card className="group cursor-pointer hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-3xl overflow-hidden shrink-0 relative">
                            {meal.image_url ? (
                              <img
                                src={meal.image_url}
                                alt={meal.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              "🍽️"
                            )}
                            
                            {/* Quick Add Button */}
                            {hasActiveSubscription && (
                              <QuickAddButton mealId={meal.id} onAdd={handleQuickAdd} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold truncate">{meal.name}</h4>
                              {meal.is_vip_exclusive ? (
                                <Badge variant="outline" className="bg-gradient-to-r from-amber-500 to-yellow-500 border-0 text-white shrink-0 text-xs">
                                  <Crown className="w-3 h-3 mr-1" />
                                  VIP
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0 text-xs">
                                  Included
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Flame className="w-3 h-3" />
                                {meal.calories} cal
                              </span>
                              <span className="flex items-center gap-1">
                                <Beef className="w-3 h-3" />
                                {meal.protein_g}g protein
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {meal.prep_time_minutes} min
                              </span>
                            </div>

                            {meal.diet_tags.length > 0 && (
                              <div className="flex gap-1 mt-2 flex-wrap">
                                {meal.diet_tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {meal.diet_tags.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{meal.diet_tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      <CustomerNavigation />

      {/* Filter Sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl font-bold text-center">Filters</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-6 overflow-y-auto pb-24">
            {/* Dietary Tags */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Dietary Preferences
              </h3>
              <div className="flex flex-wrap gap-2">
                {["Vegetarian", "Vegan", "Gluten-Free", "Keto", "High Protein", "Low Calorie"].map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-1"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Calorie Range */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Calorie Range
              </h3>
              <div className="flex gap-2">
                <Badge variant="secondary" className="cursor-pointer">Under 300</Badge>
                <Badge variant="secondary" className="cursor-pointer">300-500</Badge>
                <Badge variant="secondary" className="cursor-pointer">500-700</Badge>
                <Badge variant="secondary" className="cursor-pointer">700+</Badge>
              </div>
            </div>

            {/* Protein Range */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Protein Content
              </h3>
              <div className="flex gap-2">
                <Badge variant="secondary" className="cursor-pointer">High Protein (30g+)</Badge>
                <Badge variant="secondary" className="cursor-pointer">Medium (15-30g)</Badge>
                <Badge variant="secondary" className="cursor-pointer">Low (&lt;15g)</Badge>
              </div>
            </div>

            {/* Apply Button */}
            <Button 
              className="w-full h-12 rounded-2xl font-semibold"
              onClick={() => setFilterSheetOpen(false)}
            >
              Apply Filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default RestaurantDetail;
