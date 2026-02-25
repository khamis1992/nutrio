import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft, 
  Share2,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Clock,
  Star,
  MapPin,
  Check,
  Leaf,
  ArrowRight,
  MessageSquare
} from "lucide-react";
import { MealReviewsList } from "@/components/MealReviewsList";
import { MealReviewForm } from "@/components/MealReviewForm";
import { RatingDisplay } from "@/components/StarRating";
import { format, addDays } from "date-fns";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import { hapticFeedback } from "@/lib/capacitor";

interface MealDetail {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  rating: number;
  prep_time_minutes: number;
  is_vip_exclusive: boolean;
  price: number | null;
  restaurant: {
    id: string;
    name: string;
    address: string | null;
    logo_url: string | null;
  };
  diet_tags?: string[];
  ingredients?: string[];
}

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", icon: "🌅", time: "7-10 AM" },
  { id: "lunch", label: "Lunch", icon: "☀️", time: "12-2 PM" },
  { id: "dinner", label: "Dinner", icon: "🌙", time: "6-9 PM" },
  { id: "snack", label: "Snack", icon: "🍎", time: "Anytime" },
];

// Circular Progress Component
const CircularProgress = ({ 
  value, 
  max, 
  color, 
  icon: Icon, 
  label,
  delay = 0 
}: { 
  value: number; 
  max: number; 
  color: string; 
  icon: React.ElementType; 
  label: string;
  delay?: number;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, type: "spring" }}
      className="flex flex-col items-center"
    >
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          <motion.circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ delay: delay + 0.2, duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-5 h-5 mb-0.5" style={{ color }} />
          <span className="text-lg font-bold">{value}g</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground mt-2">{label}</span>
    </motion.div>
  );
};

// Fixed Bottom Action Bar (UberEats/DoorDash style)
const FixedBottomActionBar = ({
  meal,
  onClick,
  loading,
  disabled,
  isSuccess,
  hasActiveSubscription,
  isUnlimited,
  remainingMeals,
}: {
  meal: MealDetail;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  isSuccess: boolean;
  hasActiveSubscription: boolean;
  isUnlimited: boolean;
  remainingMeals: number;
}) => {
  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Meal Info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
              {meal.image_url ? (
                <img 
                  src={meal.image_url} 
                  alt={meal.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg">🍽️</span>
              )}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold line-clamp-1">{meal.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" />
                {meal.calories} kcal
              </p>
            </div>
          </div>

          {/* Right: Subscription Status + CTA */}
          <div className="flex items-center gap-3">
            {hasActiveSubscription && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Meals Left</p>
                <p className={`text-sm font-bold ${isUnlimited || remainingMeals > 0 ? 'text-primary' : 'text-destructive'}`}>
                  {isUnlimited ? '∞' : remainingMeals}
                </p>
              </div>
            )}
            
            <Button
              onClick={onClick}
              disabled={disabled || loading}
              className={`
                rounded-full px-6 h-12 font-semibold shadow-lg transition-all
                ${disabled 
                  ? 'bg-muted text-muted-foreground' 
                  : isSuccess 
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-primary hover:bg-primary/90'
                }
              `}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                    </svg>
                    Adding...
                  </motion.span>
                ) : isSuccess ? (
                  <motion.span
                    key="success"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Added!
                  </motion.span>
                ) : (
                  <motion.span
                    key="add"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    Add to Schedule
                    <ArrowRight className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Nutrition Bottom Sheet
const ScheduleSheet = ({
  isOpen,
  onClose,
  selectedDate,
  setSelectedDate,
  selectedMealType,
  setSelectedMealType,
  onSchedule,
  loading,
  hasActiveSubscription,
  remainingMeals,
  isUnlimited,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  selectedMealType: string;
  setSelectedMealType: (type: string) => void;
  onSchedule: () => void;
  loading: boolean;
  hasActiveSubscription: boolean;
  remainingMeals: number;
  isUnlimited: boolean;
}) => {
  const disabledDates = (date: Date) => {
    return date < new Date(new Date().setHours(0, 0, 0, 0));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl border-0 bg-background flex flex-col">
        <SheetHeader className="pb-4 shrink-0">
          <SheetTitle className="text-xl font-bold text-center">Schedule Meal</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 space-y-6 overflow-y-auto pb-4">
          {/* Date Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Select Date
            </h3>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={disabledDates}
              fromDate={new Date()}
              toDate={addDays(new Date(), 30)}
              className="rounded-2xl border bg-card p-4"
              classNames={{
                day_selected: "bg-primary text-primary-foreground rounded-full",
                day_today: "bg-accent text-accent-foreground rounded-full",
              }}
            />
          </div>

          {/* Meal Type Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Meal Type
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {MEAL_TYPES.map((type) => (
                <motion.button
                  key={type.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedMealType(type.id);
                    hapticFeedback.buttonPress();
                  }}
                  className={`
                    relative p-4 rounded-2xl border-2 transition-all text-left
                    ${selectedMealType === type.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-card hover:border-primary/30'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <p className="font-semibold">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.time}</p>
                    </div>
                  </div>
                  {selectedMealType === type.id && (
                    <motion.div
                      layoutId="selected-indicator"
                      className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Subscription Info */}
          {hasActiveSubscription && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Meals Remaining</span>
                <Badge variant={isUnlimited || remainingMeals > 0 ? "default" : "destructive"}>
                  {isUnlimited ? "Unlimited" : `${remainingMeals} left`}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Schedule Button - Fixed at bottom */}
        <div className="shrink-0 pt-4 pb-[env(safe-area-inset-bottom)]">
          <Button
            onClick={onSchedule}
            disabled={loading || !selectedDate}
            className="w-full h-14 text-lg font-semibold rounded-2xl"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4M2 12h4m12 0h4m-2.5-7.5l-2.8 2.8m-8.4 8.4l-2.8 2.8m0-14l2.8 2.8m8.4 8.4l2.8 2.8" />
                  </svg>
                </motion.div>
                Adding...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Add to Schedule
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Skeleton Loader
const MealDetailSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* Hero Skeleton */}
    <Skeleton className="w-full h-[50vh]" />
    
    {/* Content Skeleton */}
    <div className="px-4 -mt-20 relative z-10 space-y-4">
      <Skeleton className="w-full h-48 rounded-3xl" />
      <Skeleton className="w-full h-32 rounded-3xl" />
      <Skeleton className="w-full h-64 rounded-3xl" />
    </div>
  </div>
);

const MealDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    hasActiveSubscription, 
    remainingMeals, 
    isUnlimited, 
    canOrderMeal, 
    incrementMealUsage 
  } = useSubscription();

  const [meal, setMeal] = useState<MealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const navigationState = location.state as { scheduledDate?: Date; mealType?: string } | null;
    return navigationState?.scheduledDate;
  });
  const [selectedMealType, setSelectedMealType] = useState<string>(() => {
    const navigationState = location.state as { scheduledDate?: Date; mealType?: string } | null;
    return navigationState?.mealType || "lunch";
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  
  const headerOpacity = useTransform(scrollY, [0, 200], [0, 1]);
  const imageScale = useTransform(scrollY, [0, 300], [1, 1.1]);
  const imageOpacity = useTransform(scrollY, [0, 300], [1, 0.5]);
  
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const headerOpacitySpring = useSpring(headerOpacity, springConfig);

  useEffect(() => {
    if (id) {
      fetchMeal();
    }
  }, [id]);

  const fetchMeal = async () => {
    try {
      // Fetch meal first
      const { data: mealData, error: mealError } = await supabase
        .from("meals")
        .select("*")
        .eq("id", id!)
        .single();

      if (mealError) throw mealError;

      if (mealData) {
        // Fetch restaurant separately
        let restaurantData = null;
        if (mealData.restaurant_id) {
          const { data: restData } = await supabase
            .from("restaurants")
            .select("id, name, address, logo_url")
            .eq("id", mealData.restaurant_id)
            .single();
          restaurantData = restData;
        }

        setMeal({
          ...mealData,
          calories: Number(mealData.calories),
          protein_g: Number(mealData.protein_g),
          carbs_g: Number(mealData.carbs_g),
          fat_g: Number(mealData.fat_g),
          fiber_g: mealData.fiber_g ? Number(mealData.fiber_g) : null,
          rating: Number(mealData.rating),
          prep_time_minutes: Number(mealData.prep_time_minutes),
          price: mealData.price ? Number(mealData.price) : null,
          restaurant: restaurantData || {
            id: "",
            name: "Unknown Restaurant",
            address: null,
            logo_url: null
          }
        } as MealDetail);
      }
    } catch (error) {
      console.error("Error fetching meal:", error);
      toast({
        title: "Error",
        description: "Failed to load meal details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToSchedule = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to schedule meals",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!hasActiveSubscription) {
      toast({
        title: "Subscription required",
        description: "Please subscribe to schedule meals",
        variant: "destructive",
      });
      navigate("/subscription");
      return;
    }

    if (!canOrderMeal) {
      toast({
        title: "Meal limit reached",
        description: "You've reached your weekly meal limit",
        variant: "destructive",
      });
      return;
    }

    setSheetOpen(true);
  };

  const handleSchedule = async () => {
    if (!selectedDate || !meal) return;

    setScheduling(true);
    hapticFeedback.buttonPress();

    try {
      const quotaUpdated = await incrementMealUsage();
      if (!quotaUpdated) {
        throw new Error("Failed to update meal quota");
      }

      const { error } = await supabase.from("meal_schedules").insert({
        user_id: user!.id,
        meal_id: meal.id,
        scheduled_date: format(selectedDate, "yyyy-MM-dd"),
        meal_type: selectedMealType,
        is_completed: false,
      });

      if (error) throw error;

      setSuccess(true);
      setSheetOpen(false);
      hapticFeedback.success();

      // Show success toast notification
      toast({
        title: "Meal Scheduled! 🎉",
        description: `${meal.name} has been added to your schedule for ${format(selectedDate, "MMM d, yyyy")}.`,
      });

      // Create in-app notification
      try {
        await supabase.from("notifications").insert({
          user_id: user!.id,
          type: "meal_scheduled",
          title: "Meal Scheduled",
          message: `${meal.name} has been scheduled for ${format(selectedDate, "MMM d, yyyy")}`,
          data: {
            meal_id: meal.id,
            meal_name: meal.name,
            scheduled_date: format(selectedDate, "yyyy-MM-dd"),
            meal_type: selectedMealType,
            calories: meal.calories,
            action: "view_schedule"
          },
          status: "unread"
        });
      } catch (notifError) {
        console.error("Error creating notification:", notifError);
      }

      setTimeout(() => {
        navigate("/schedule");
      }, 1500);
    } catch (error) {
      console.error("Error scheduling meal:", error);
      toast({
        title: "Error",
        description: "Failed to schedule meal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const shareMeal = async () => {
    if (!meal) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: meal.name,
          text: `Check out ${meal.name} from ${meal.restaurant.name}!`,
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

  if (loading) {
    return <MealDetailSkeleton />;
  }

  if (!meal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-4xl">🍽️</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Meal not found</h2>
        <p className="text-muted-foreground text-center mb-6">
          The meal you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => navigate("/meals")} className="rounded-full px-8">
          Browse Meals
        </Button>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-screen bg-background overflow-y-auto pb-32">
      {/* Animated Header */}
      <motion.header
        style={{ opacity: headerOpacitySpring }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
      >
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-background/50 backdrop-blur"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <span className="font-semibold truncate max-w-[200px]">{meal.name}</span>
          <div className="w-10" />
        </div>
      </motion.header>

      {/* Hero Image Section */}
      <div className="relative h-[55vh] overflow-hidden">
        <motion.div
          style={{ scale: imageScale, opacity: imageOpacity }}
          className="absolute inset-0"
        >
          {meal.image_url ? (
            <img
              src={meal.image_url}
              alt={meal.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
              <span className="text-8xl">🍽️</span>
            </div>
          )}
        </motion.div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background" />
        
        {/* Floating Action Bar */}
        <div className="absolute top-12 left-4 right-4 flex items-center justify-between">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-background/80 backdrop-blur shadow-lg"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <div className="flex items-center gap-2">
            {/* Favorite button - disabled until favorite_meals table is available */}
            {/* <Button
              variant="secondary"
              size="icon"
              onClick={toggleFavorite}
              className="rounded-full bg-background/80 backdrop-blur shadow-lg"
            >
              <Heart className="w-5 h-5" />
            </Button> */}
            <Button
              variant="secondary"
              size="icon"
              onClick={shareMeal}
              className="rounded-full bg-background/80 backdrop-blur shadow-lg"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* VIP Badge */}
        {meal.is_vip_exclusive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-24 right-4"
          >
            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 px-3 py-1.5 text-sm font-bold shadow-lg">
              ⭐ VIP Exclusive
            </Badge>
          </motion.div>
        )}
      </div>

      {/* Content Container */}
      <div className="relative -mt-16 px-4 space-y-4">
        {/* Main Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card rounded-3xl shadow-xl border border-border/50 p-6"
        >
          {/* Restaurant Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {meal.restaurant.logo_url ? (
                <img src={meal.restaurant.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">🏪</span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{meal.restaurant.name}</p>
              {meal.restaurant.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {meal.restaurant.address}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-semibold text-sm">{meal.rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Meal Name */}
          <h1 className="text-2xl font-bold mb-2">{meal.name}</h1>
          
          {/* Description */}
          {meal.description && (
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              {meal.description}
            </p>
          )}

          {/* Quick Stats */}
          <div className="flex items-center gap-6 py-4 border-y border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Calories</p>
                <p className="font-semibold">{meal.calories}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prep Time</p>
                <p className="font-semibold">{meal.prep_time_minutes}m</p>
              </div>
            </div>
            {meal.fiber_g && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fiber</p>
                  <p className="font-semibold">{meal.fiber_g}g</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Nutrition Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card rounded-3xl shadow-lg border border-border/50 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Nutrition Facts</h2>
            <span className="text-sm text-muted-foreground">Per serving</span>
          </div>

          {/* Circular Macros */}
          <div className="flex justify-around">
            <CircularProgress
              value={meal.protein_g}
              max={50}
              color="#EF4444"
              icon={Beef}
              label="Protein"
              delay={0.2}
            />
            <CircularProgress
              value={meal.carbs_g}
              max={80}
              color="#F59E0B"
              icon={Wheat}
              label="Carbs"
              delay={0.3}
            />
            <CircularProgress
              value={meal.fat_g}
              max={40}
              color="#14B8A6"
              icon={Droplets}
              label="Fat"
              delay={0.4}
            />
          </div>
        </motion.div>

        {/* Dietary Tags */}
        {meal.diet_tags && meal.diet_tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap gap-2"
          >
            {meal.diet_tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full px-3 py-1">
                {tag}
              </Badge>
            ))}
          </motion.div>
        )}

        {/* Ingredients */}
        {meal.ingredients && meal.ingredients.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-card rounded-3xl shadow-lg border border-border/50 p-6"
          >
            <h2 className="text-lg font-bold mb-4">Ingredients</h2>
            <ul className="space-y-2">
              {meal.ingredients.map((ingredient, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {ingredient}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Reviews Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-card rounded-3xl shadow-lg border border-border/50 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Reviews</h2>
            </div>
            <RatingDisplay 
              rating={meal.rating || 0} 
              size="sm" 
              showCount={false}
            />
          </div>

          {showReviewForm ? (
            <MealReviewForm
              mealId={meal.id}
              mealName={meal.name}
              onSubmitted={() => setShowReviewForm(false)}
              onCancel={() => setShowReviewForm(false)}
            />
          ) : (
            <MealReviewsList
              mealId={meal.id}
              mealName={meal.name}
              showWriteReview={true}
              onWriteReview={() => setShowReviewForm(true)}
            />
          )}
        </motion.div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <FixedBottomActionBar
        meal={meal}
        onClick={handleAddToSchedule}
        loading={scheduling}
        disabled={!canOrderMeal && !isUnlimited}
        isSuccess={success}
        hasActiveSubscription={hasActiveSubscription}
        isUnlimited={isUnlimited}
        remainingMeals={remainingMeals}
      />

      {/* Schedule Bottom Sheet */}
      <ScheduleSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedMealType={selectedMealType}
        setSelectedMealType={setSelectedMealType}
        onSchedule={handleSchedule}
        loading={scheduling}
        hasActiveSubscription={hasActiveSubscription}
        remainingMeals={remainingMeals}
        isUnlimited={isUnlimited}
      />

      {/* Success Overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mb-6"
            >
              <Check className="w-12 h-12 text-white" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold mb-2"
            >
              Added to Schedule!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-muted-foreground"
            >
              Redirecting to your schedule...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MealDetail;
