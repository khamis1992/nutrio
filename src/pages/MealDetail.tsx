import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  Sunrise,
  Sun,
  Moon,
  Apple,
  Calendar as CalendarIcon,
  Utensils,
  Home,
  Briefcase,
  Plus,
  ShieldAlert,
} from "lucide-react";

import { format } from "date-fns";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import { hapticFeedback } from "@/lib/capacitor";
import { getMealImage } from "@/lib/meal-images";
import { toast as sonnerToast } from "sonner";

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
  ingredients?: string[] | string | null;
}

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", icon: Sunrise, time: "7-10 AM", color: "#F59E0B", gradient: "from-amber-400 to-orange-500" },
  { id: "lunch", label: "Lunch", icon: Sun, time: "12-2 PM", color: "#F97316", gradient: "from-orange-400 to-red-500" },
  { id: "dinner", label: "Dinner", icon: Moon, time: "6-9 PM", color: "#6366F1", gradient: "from-indigo-400 to-purple-500" },
  { id: "snack", label: "Snack", icon: Apple, time: "Anytime", color: "#10B981", gradient: "from-emerald-400 to-teal-500" },
];

// Smart default meal type based on current time
const getSmartDefaultMealType = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 21) return "dinner";
  return "snack";
};

// Get date context label
const getDateContext = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0 && diffDays <= 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};


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

// Fixed Bottom Action Bar (Modern Native style with gradient)
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="bg-card rounded-3xl shadow-lg border border-border/50 p-6"
    >
      <div>
        <div className="flex items-center gap-4">
          {/* Left: Selection Info */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Selected</p>
            <p className="font-semibold text-foreground">{meal.name}</p>
          </div>

          {/* Right: Meals Left + FAB */}
          <div className="flex items-center gap-4">
            {hasActiveSubscription && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Meals Left</p>
                <p className={`text-sm font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent ${isUnlimited || remainingMeals > 0 ? '' : 'text-destructive'}`}>
                  {isUnlimited ? '∞' : remainingMeals}
                </p>
              </div>
            )}
            
            <motion.button
              onClick={onClick}
              disabled={disabled || loading}
              whileTap={{ scale: 0.95 }}
              className={`
                w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all
                ${disabled 
                  ? 'bg-muted text-muted-foreground' 
                  : isSuccess 
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-gradient-to-br from-green-500 to-teal-500 hover:shadow-green-500/40'
                }
              `}
              style={{
                boxShadow: !disabled && !isSuccess ? '0 8px 32px rgba(34, 197, 94, 0.4)' : undefined
              }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0, rotate: -180 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 180 }}
                    className="text-white"
                  >
                    <svg className="w-7 h-7 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                    </svg>
                  </motion.span>
                ) : isSuccess ? (
                  <motion.span
                    key="success"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="text-white"
                  >
                    <Check className="w-7 h-7" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="add"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="text-white"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">Tap + to add to your schedule</p>
      </div>
    </motion.div>
  );
};

// Generate next 14 days for horizontal scroller
const generateDateOptions = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }
  return dates;
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
  meal,
  selectedAddressId,
  setSelectedAddressId,
  setSelectedAddressLabel,
  userId,
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
  meal: MealDetail | null;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  setSelectedAddressLabel: (label: string) => void;
  userId: string | undefined;
}) => {
  // Fetch user addresses when sheet opens
  const [addresses, setAddresses] = useState<{ id: string; label: string; address_line1: string; city: string; is_default: boolean }[]>([]);
  useEffect(() => {
    if (!isOpen || !userId) return;
    supabase
      .from("user_addresses")
      .select("id, label, address_line1, city, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAddresses(data);
          // Pre-select default address if none chosen yet
          if (!selectedAddressId) {
            const def = data.find(a => a.is_default) || data[0];
            setSelectedAddressId(def.id);
            setSelectedAddressLabel(`${def.label} – ${def.address_line1}, ${def.city}`);
          }
        }
      });
  }, [isOpen, userId]);
  const dateOptions = generateDateOptions();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[92vh] sm:h-[85vh] rounded-t-[2.5rem] border-0 bg-gradient-to-b from-background via-background to-muted/20 flex flex-col shadow-2xl">
        {/* Decorative Top Bar */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-muted-foreground/20" />
        
        <SheetHeader className="pt-8 pb-4 shrink-0">
          <SheetTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            Schedule Your Meal
          </SheetTitle>
          <p className="text-center text-sm text-muted-foreground">
            Choose when you&apos;d like to enjoy {meal?.name}
          </p>
        </SheetHeader>
        
        <div className="flex-1 space-y-6 overflow-y-auto px-1 pb-4">
          {/* Selected Date Context Card */}
          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-green-50 via-teal-50 to-background border border-green-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <CalendarIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">{getDateContext(selectedDate)}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Horizontal Date Scroller */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                Select Date
              </h3>
              <span className="text-xs text-muted-foreground">Swipe →</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {dateOptions.map((date, index) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isToday = new Date().toDateString() === date.toDateString();
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = date.getDate();
                
                return (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDate(date)}
                    className={`
                      flex-shrink-0 p-3 rounded-2xl flex flex-col items-center min-w-[70px] transition-all
                      ${isSelected 
                        ? 'bg-gradient-to-br from-green-500 to-teal-500 text-white shadow-lg shadow-green-500/30 scale-110' 
                        : 'bg-white border border-green-100 hover:border-green-300'
                      }
                    `}
                  >
                    <span className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {dayName}
                    </span>
                    <span className={`text-lg font-bold mt-1 ${isSelected ? 'text-white' : 'text-foreground'}`}>
                      {dayNum}
                    </span>
                    {isToday && (
                      <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-orange-400'}`} />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Meal Type Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide px-1">
              Meal Type
            </h3>
            <div className="space-y-3">
              {MEAL_TYPES.map((type, index) => {
                const IconComponent = type.icon;
                const isSelected = selectedMealType === type.id;
                return (
                  <motion.button
                    key={type.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedMealType(type.id);
                      hapticFeedback.buttonPress();
                    }}
                    className={`
                      w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4
                      ${isSelected 
                        ? 'border-transparent bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg shadow-green-500/25' 
                        : 'border-green-100 bg-white hover:border-green-300'
                      }
                    `}
                  >
                    <div 
                      className={`
                        w-12 h-12 rounded-xl flex items-center justify-center transition-all
                        ${isSelected ? 'bg-white/20' : `bg-${type.color === '#F59E0B' ? 'orange' : type.color === '#F97316' ? 'orange' : type.color === '#6366F1' ? 'indigo' : 'green'}-100`}
                      `}
                      style={{ 
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : undefined,
                        color: isSelected ? 'white' : type.color 
                      }}
                    >
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-foreground'}`}>{type.label}</p>
                      <p className={`text-sm ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>{type.time}</p>
                    </div>
                    {isSelected && (
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Delivery Address Picker */}
          {addresses.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </h3>
              <div className="space-y-2">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <motion.button
                      key={addr.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedAddressId(addr.id);
                        setSelectedAddressLabel(`${addr.label} – ${addr.address_line1}, ${addr.city}`);
                      }}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-transparent bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg shadow-green-500/25"
                          : "border-green-100 bg-white hover:border-green-300"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? "bg-white/20" : "bg-green-50"}`}>
                        {addr.label.toLowerCase() === "home" ? (
                          <Home className={`w-5 h-5 ${isSelected ? "text-white" : "text-green-600"}`} />
                        ) : addr.label.toLowerCase() === "work" || addr.label.toLowerCase() === "office" ? (
                          <Briefcase className={`w-5 h-5 ${isSelected ? "text-white" : "text-green-600"}`} />
                        ) : (
                          <MapPin className={`w-5 h-5 ${isSelected ? "text-white" : "text-green-600"}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-sm ${isSelected ? "text-white" : "text-foreground"}`}>{addr.label}</p>
                          {addr.is_default && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isSelected ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}>
                              Default
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                          {addr.address_line1}, {addr.city}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.open("/addresses", "_blank")}
                  className="w-full flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-green-200 text-green-600 hover:border-green-400 hover:bg-green-50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-semibold">Add new address</span>
                </motion.button>
              </div>
            </div>
          )}

          {/* Subscription Info Card */}
          {hasActiveSubscription && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 rounded-2xl bg-gradient-to-br from-green-50 via-teal-50 to-background border border-green-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-md shadow-green-500/30">
                    <Utensils className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Meals Remaining</p>
                    <p className="text-xs text-muted-foreground">
                      {isUnlimited ? 'Enjoy unlimited meals' : 'Use them wisely!'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={isUnlimited || remainingMeals > 0 ? "default" : "destructive"}
                    className="text-sm px-3 py-1"
                  >
                    {isUnlimited ? (
                      <span className="flex items-center gap-1">
                        Unlimited
                      </span>
                    ) : (
                      `${remainingMeals} left`
                    )}
                  </Badge>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Schedule Button - Fixed at bottom */}
        <div className="shrink-0 pt-4 pb-[env(safe-area-inset-bottom)] bg-gradient-to-t from-background via-background to-transparent">
          <motion.div
            whileHover={selectedDate ? { scale: 1.02 } : {}}
            whileTap={selectedDate ? { scale: 0.98 } : {}}
          >
            <Button
              onClick={onSchedule}
              disabled={loading || !selectedDate}
              className={`
                w-full h-14 text-lg font-semibold rounded-2xl shadow-lg transition-all
                ${!selectedDate 
                  ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                  : 'bg-primary hover:bg-primary/90 hover:shadow-primary/30 hover:shadow-xl'
                }
              `}
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
                  Adding to Schedule...
                </span>
              ) : !selectedDate ? (
                <span className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Select a Date First
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Add to Schedule
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </motion.div>
          
          {selectedDate && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs text-muted-foreground mt-3"
            >
              Your meal will be delivered on {getDateContext(selectedDate)}
            </motion.p>
          )}
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
  const { t } = useLanguage();
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

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const navigationState = location.state as { scheduledDate?: Date; mealType?: string } | null;
    return navigationState?.scheduledDate;
  });
  const [selectedMealType, setSelectedMealType] = useState<string>(() => {
    const navigationState = location.state as { scheduledDate?: Date; mealType?: string } | null;
    return navigationState?.mealType || getSmartDefaultMealType();
  });
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedAddressLabel, setSelectedAddressLabel] = useState<string>("");

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
            name: t("unknown_restaurant"),
            address: null,
            logo_url: null
          }
        } as MealDetail);
      }
    } catch (error) {
      console.error("Error fetching meal:", error);
      toast({
        title: t("error"),
        description: t("failed_load_meal"),
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

    // ── Allergy check ──────────────────────────────────────────────────
    // Fetch the user's allergy tag IDs from their saved preferences
    if (meal) {
      try {
        const { data: userPrefs } = await supabase
          .from("user_dietary_preferences")
          .select("diet_tag_id, diet_tags(id, name)")
          .eq("user_id", user.id);

        if (userPrefs && userPrefs.length > 0) {
          // Determine which of their saved tags are allergen tags
          const allergenKeywords = ["nut", "dairy", "shellfish", "egg", "wheat", "soy", "fish", "gluten", "lactose"];
          const userAllergyNames = userPrefs
            .map((p: any) => p.diet_tags?.name as string | undefined)
            .filter((name): name is string =>
              !!name && allergenKeywords.some(k => name.toLowerCase().includes(k))
            );

          if (userAllergyNames.length > 0) {
            // Fetch the meal's diet tags from the join table
            const { data: mealTagRows } = await supabase
              .from("meal_diet_tags")
              .select("diet_tags(name)")
              .eq("meal_id", meal.id);

            const mealTagNames = (mealTagRows || [])
              .map((r: any) => r.diet_tags?.name as string | undefined)
              .filter((n): n is string => !!n);

            const conflicts = mealTagNames.filter(tagName =>
              userAllergyNames.some(allergen =>
                tagName.toLowerCase().includes(allergen.toLowerCase()) ||
                allergen.toLowerCase().includes(tagName.toLowerCase())
              )
            );

            if (conflicts.length > 0) {
              sonnerToast.warning(
                `Allergen alert: ${conflicts.join(", ")}`,
                {
                  description: "This meal contains ingredients that match your allergy settings. You can still proceed.",
                  icon: "⚠️",
                  duration: 6000,
                  action: {
                    label: "Proceed anyway",
                    onClick: () => setSheetOpen(true),
                  },
                }
              );
              return; // let the user decide via the toast action
            }
          }
        }
      } catch {
        // allergy check is best-effort — never block scheduling on a lookup failure
      }
    }
    // ──────────────────────────────────────────────────────────────────

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
        order_status: "pending",
        delivery_address_id: selectedAddressId,
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
            action: "view_schedule",
            delivery_address_id: selectedAddressId,
            delivery_address_label: selectedAddressLabel,
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
    <div ref={scrollRef} className="min-h-screen bg-background overflow-y-auto pb-24">
      {/* Animated Header */}
      <motion.header
        style={{ opacity: headerOpacitySpring }}
        className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50"
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
          <img
            src={getMealImage(meal.image_url, meal.id)}
            alt={meal.name}
            className="w-full h-full object-cover"
          />
        </motion.div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background" />
        
        {/* Floating Action Bar */}
        <div className="absolute top-12 left-4 right-4 flex items-center justify-end">
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

        {/* Action Bar - inline below Nutrition Facts */}
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
        {meal.ingredients && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-card rounded-3xl shadow-lg border border-border/50 p-6"
          >
            <h2 className="text-lg font-bold mb-4">Ingredients</h2>
            <ul className="space-y-2">
              {Array.isArray(meal.ingredients) ? (
                meal.ingredients.map((ingredient: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {ingredient}
                  </li>
                ))
              ) : typeof meal.ingredients === 'string' && meal.ingredients.length > 0 ? (
                meal.ingredients.split(',').map((ingredient: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {ingredient.trim()}
                  </li>
                ))
              ) : null}
            </ul>
          </motion.div>
        )}


      </div>

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
        meal={meal}
        selectedAddressId={selectedAddressId}
        setSelectedAddressId={setSelectedAddressId}
        setSelectedAddressLabel={setSelectedAddressLabel}
        userId={user?.id}
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
