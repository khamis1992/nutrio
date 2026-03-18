import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { useMealAddons } from "@/hooks/useMealAddons";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";
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
  Wallet,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const noMealsLeft = hasActiveSubscription && !isUnlimited && remainingMeals <= 0;

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
            {noMealsLeft && (
              <p className="text-xs text-amber-600 font-medium mt-0.5">No meals left — buy with wallet</p>
            )}
          </div>

          {/* Right: Meals Left + FAB */}
          <div className="flex items-center gap-4">
            {hasActiveSubscription && (isUnlimited || remainingMeals > 0) && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Meals Left</p>
                <p className="text-sm font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
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
                    : noMealsLeft
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 hover:shadow-amber-500/40'
                      : 'bg-gradient-to-br from-green-500 to-teal-500 hover:shadow-green-500/40'
                }
              `}
              style={{
                boxShadow: !disabled && !isSuccess
                  ? noMealsLeft
                    ? '0 8px 32px rgba(245, 158, 11, 0.4)'
                    : '0 8px 32px rgba(34, 197, 94, 0.4)'
                  : undefined
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
                ) : noMealsLeft ? (
                  <motion.span
                    key="wallet"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="text-white"
                  >
                    <Wallet className="w-7 h-7" />
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
  groupedAddons,
  selectedAddons,
  toggleAddon,
  addonsTotal,
  walletBalance,
  hasAddons,
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
  groupedAddons: Record<string, import("@/hooks/useMealAddons").MealAddon[]>;
  selectedAddons: Map<string, number>;
  toggleAddon: (id: string) => void;
  addonsTotal: number;
  walletBalance: number;
  hasAddons: boolean;
}) => {
  const [addonsOpen, setAddonsOpen] = useState(false);
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
          if (!selectedAddressId) {
            const def = data.find(a => a.is_default) || data[0];
            setSelectedAddressId(def.id);
            setSelectedAddressLabel(`${def.label} – ${def.address_line1}, ${def.city}`);
          }
        }
      });
  }, [isOpen, userId]);

  const dateOptions = generateDateOptions();
  const selectedType = MEAL_TYPES.find(t => t.id === selectedMealType);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[92vh] rounded-t-3xl border-0 bg-background flex flex-col p-0 shadow-2xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Meal preview header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 shrink-0">
          {meal?.image_url ? (
            <img
              src={meal.image_url}
              alt={meal.name}
              className="w-14 h-14 rounded-2xl object-cover shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Utensils className="w-6 h-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-tight truncate">{meal?.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {meal?.calories && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-400" />
                  {meal.calories} kcal
                </span>
              )}
              {hasActiveSubscription && (
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  {isUnlimited ? "Unlimited" : `${remainingMeals} left`}
                </Badge>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">

          {/* — Date — */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">When</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {dateOptions.map((date, i) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isToday = new Date().toDateString() === date.toDateString();
                return (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => { setSelectedDate(date); hapticFeedback.buttonPress(); }}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-2xl min-w-[60px] border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/50 bg-card text-foreground"
                    }`}
                  >
                    <span className={`text-[10px] font-semibold uppercase ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className={`text-lg font-bold leading-tight ${isSelected ? "text-primary-foreground" : ""}`}>
                      {date.getDate()}
                    </span>
                    {isToday && (
                      <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-primary-foreground/60" : "bg-primary"}`} />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* — Meal type — */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meal type</p>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedMealType === type.id;
                return (
                  <motion.button
                    key={type.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setSelectedMealType(type.id); hapticFeedback.buttonPress(); }}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border/50 bg-card text-foreground"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary/15" : "bg-muted"
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${isSelected ? "text-primary" : ""}`}>{type.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{type.time}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* — Delivery address — */}
          {addresses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deliver to</p>
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
                        hapticFeedback.buttonPress();
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/8"
                          : "border-border/50 bg-card"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? "bg-primary/15" : "bg-muted"}`}>
                        {addr.label.toLowerCase() === "home" ? (
                          <Home className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        ) : addr.label.toLowerCase() === "work" || addr.label.toLowerCase() === "office" ? (
                          <Briefcase className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        ) : (
                          <MapPin className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-semibold ${isSelected ? "text-primary" : ""}`}>{addr.label}</p>
                          {addr.is_default && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Default</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{addr.address_line1}, {addr.city}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* — Add-ons (collapsible) — */}
          {hasAddons && (
            <div className="space-y-2">
              <button
                onClick={() => setAddonsOpen(v => !v)}
                className="w-full flex items-center justify-between py-1"
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Add-ons
                  {addonsTotal > 0 && (
                    <span className="normal-case text-primary font-bold">· {formatCurrency(addonsTotal)}</span>
                  )}
                </p>
                <ChevronLeft className={`w-4 h-4 text-muted-foreground transition-transform ${addonsOpen ? "-rotate-90" : "rotate-90"}`} />
              </button>

              <AnimatePresence>
                {addonsOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {Object.entries(groupedAddons).map(([category, items]) => (
                      <div key={category} className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-medium">{category}</p>
                        {items.map((addon) => {
                          const isSel = selectedAddons.has(addon.id);
                          return (
                            <button
                              key={addon.id}
                              onClick={() => toggleAddon(addon.id)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                                isSel ? "bg-primary/8 border-primary/40" : "bg-card border-border/50"
                              }`}
                            >
                              <div>
                                <p className={`text-sm font-medium ${isSel ? "text-primary" : ""}`}>{addon.name}</p>
                                {addon.description && <p className="text-xs text-muted-foreground">{addon.description}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <span className="text-sm font-semibold">{formatCurrency(addon.price)}</span>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSel ? "bg-primary border-primary" : "border-muted-foreground/30"
                                }`}>
                                  {isSel && <Check className="w-3 h-3 text-white" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    {addonsTotal > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        Wallet: <span className="font-semibold text-foreground">{formatCurrency(walletBalance)}</span>
                        {walletBalance < addonsTotal && (
                          <span className="text-destructive">— not enough</span>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Fixed confirm bar */}
        <div className="shrink-0 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] border-t border-border/40 bg-background">
          {selectedDate && selectedType && (
            <p className="text-center text-xs text-muted-foreground mb-2">
              {selectedType.label} · {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
          )}
          <motion.button
            whileTap={{ scale: loading ? 1 : 0.97 }}
            onClick={onSchedule}
            disabled={loading || !selectedDate}
            className={`w-full h-13 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
              !selectedDate
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:shadow-none"
            }`}
            style={{ height: 52 }}
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round" />
                  </svg>
                </motion.div>
                Scheduling…
              </>
            ) : !selectedDate ? (
              <>
                <CalendarIcon className="w-5 h-5" />
                Pick a date to continue
              </>
            ) : addonsTotal > 0 ? (
              <>
                Confirm · {formatCurrency(addonsTotal)}
                <ArrowRight className="w-5 h-5" />
              </>
            ) : (
              <>
                Confirm
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </motion.button>
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
    incrementMealUsage,
    subscription,
    refetch: refetchSubscription,
  } = useSubscription();

  const { wallet, refresh: refetchWallet } = useWallet();

  const pricePerMeal = 50; // Fixed extra meal price in QAR
  const [buyMealDialogOpen, setBuyMealDialogOpen] = useState(false);
  const [topupDialogOpen, setTopupDialogOpen] = useState(false);
  const [buyMealLoading, setBuyMealLoading] = useState(false);

  const [meal, setMeal] = useState<MealDetail | null>(null);
  // Add-ons (resolved once meal id is known)
  const {
    groupedAddons,
    selectedAddons,
    toggleAddon,
    getSelectedAddonsTotal,
    getSelectedAddonsList,
    clearSelectedAddons,
    hasAddons,
  } = useMealAddons(id);
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

    if (!isUnlimited && remainingMeals <= 0) {
      setBuyMealDialogOpen(true);
      return;
    }

    setSheetOpen(true);
  };

  // ── Buy 1 meal credit with wallet ──────────────────────────────────────
  const handleWalletMealPurchase = async () => {
    if (!user || !subscription) return;
    const balance = wallet?.balance || 0;
    if (balance < pricePerMeal) {
      setBuyMealDialogOpen(false);
      navigate("/wallet");
      return;
    }
    setBuyMealLoading(true);
    try {
      // Debit wallet
      const { error: debitErr } = await (supabase.rpc as any)("debit_wallet", {
        p_user_id: user.id,
        p_amount: pricePerMeal,
        p_reference_type: "order",
        p_description: "Extra meal credit purchase",
        p_metadata: { subscription_id: subscription.id },
      });
      if (debitErr) throw debitErr;

      // Add 1 meal to the subscription allowance
      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({ meals_per_month: subscription.meals_per_month + 1 })
        .eq("id", subscription.id);
      if (subErr) throw subErr;

      refetchWallet();
      await refetchSubscription();
      setBuyMealDialogOpen(false);
      hapticFeedback.success();
      toast({
        title: "Meal credit added! ✅",
        description: `1 meal added to your plan — ${formatCurrency(pricePerMeal)} deducted.`,
      });
      setSheetOpen(true);
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    } finally {
      setBuyMealLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedDate || !meal) return;

    setScheduling(true);
    hapticFeedback.buttonPress();

    try {
      const quotaUpdated = await incrementMealUsage();
      if (!quotaUpdated) {
        // No quota left — offer wallet purchase instead
        setScheduling(false);
        setSheetOpen(false);
        setBuyMealDialogOpen(true);
        return;
      }

      // Check if wallet has enough for add-ons before scheduling
      const addonsTotal = getSelectedAddonsTotal();
      if (addonsTotal > 0 && (wallet?.balance || 0) < addonsTotal) {
        setScheduling(false);
        setTopupDialogOpen(true);
        return;
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

      // Debit wallet for add-ons if any selected
      if (addonsTotal > 0) {
        const addonNames = getSelectedAddonsList().map(({ addon, quantity }) =>
          quantity > 1 ? `${addon.name} x${quantity}` : addon.name
        ).join(", ");
        await (supabase.rpc as any)("debit_wallet", {
          p_user_id: user!.id,
          p_amount: addonsTotal,
          p_reference_type: "order",
          p_description: `Add-ons for ${meal.name}: ${addonNames}`,
          p_metadata: { meal_id: meal.id, addons: addonNames },
        });
        refetchWallet();
        clearSelectedAddons();
      }

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
          disabled={!hasActiveSubscription}
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
        groupedAddons={groupedAddons}
        selectedAddons={selectedAddons}
        toggleAddon={toggleAddon}
        addonsTotal={getSelectedAddonsTotal()}
        walletBalance={wallet?.balance || 0}
        hasAddons={hasAddons}
      />

      {/* Buy 1 meal credit with wallet */}
      <Dialog open={buyMealDialogOpen} onOpenChange={setBuyMealDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-500" />
              Buy Extra Meal Credit
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-2 space-y-4">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Meal credit price</span>
                <span className="font-bold text-amber-600">{formatCurrency(pricePerMeal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your wallet balance</span>
                <span className={`font-semibold ${(wallet?.balance || 0) >= pricePerMeal ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(wallet?.balance || 0)}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              1 meal will be added to your plan. You can then schedule this meal normally.
            </p>
          </div>

          <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-border/50">
            <Button variant="outline" onClick={() => setBuyMealDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            {(wallet?.balance || 0) >= pricePerMeal ? (
              <Button
                onClick={handleWalletMealPurchase}
                disabled={buyMealLoading}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {buyMealLoading ? "Processing..." : `Pay ${formatCurrency(pricePerMeal)}`}
              </Button>
            ) : (
              <Button
                onClick={() => { setBuyMealDialogOpen(false); navigate("/wallet"); }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              >
                Top Up Wallet
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Insufficient Balance Top-up Dialog */}
      <Dialog open={topupDialogOpen} onOpenChange={setTopupDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Insufficient Balance
            </DialogTitle>
            <DialogDescription>
              Your wallet balance is too low to cover the add-ons you selected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
              <span className="text-sm text-muted-foreground">Add-ons total</span>
              <span className="font-bold">{formatCurrency(getSelectedAddonsTotal())}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
              <span className="text-sm text-muted-foreground">Your wallet balance</span>
              <span className="font-semibold text-destructive">{formatCurrency(wallet?.balance || 0)}</span>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setTopupDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => { setTopupDialogOpen(false); navigate("/wallet"); }}
              className="flex-1 bg-primary"
            >
              Top Up Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
