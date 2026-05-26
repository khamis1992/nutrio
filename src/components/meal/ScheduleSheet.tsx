import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  ChevronLeft,
  Flame,
  Utensils,
  Calendar as CalendarIcon,
  Check,
  Home,
  Briefcase,
  MapPin,
  ShoppingCart,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { hapticFeedback } from "@/lib/capacitor";
import { formatCurrency } from "@/lib/currency";
import { MEAL_TYPES, generateDateOptions } from "./scheduleUtils";

interface ScheduleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  selectedMealType: string;
  setSelectedMealType: (type: string) => void;
  selectedTimeSlot: string | null;
  setSelectedTimeSlot: (slot: string | null) => void;
  onSchedule: () => void;
  loading: boolean;
  hasActiveSubscription: boolean;
  remainingMeals: number;
  isUnlimited: boolean;
  meal: { id: string; name: string; calories?: number; image_url?: string | null } | null;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  setSelectedAddressLabel: (label: string) => void;
  userId: string | undefined;
  groupedAddons: Record<string, { id: string; name: string; description?: string | null; price: number }[]>;
  selectedAddons: Map<string, number>;
  toggleAddon: (id: string) => void;
  addonsTotal: number;
  walletBalance: number;
  hasAddons: boolean;
}

const TIME_SLOTS = [
  "7:00 AM", "8:00 AM", "9:00 AM",
  "11:00 AM", "12:00 PM", "1:00 PM",
  "5:00 PM", "6:00 PM", "7:00 PM",
];

export const ScheduleSheet = ({
  isOpen,
  onClose,
  selectedDate,
  setSelectedDate,
  selectedMealType,
  setSelectedMealType,
  selectedTimeSlot,
  setSelectedTimeSlot,
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
}: ScheduleSheetProps) => {
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
          if (selectedAddressId === null) {
            const def = data.find(a => a.is_default) || data[0];
            setSelectedAddressId(def.id);
            setSelectedAddressLabel(`${def.label} \u2013 ${def.address_line1}, ${def.city}`);
          }
        }
      });
  }, [isOpen, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
              loading="lazy"
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
                  <Flame className="w-3 h-3 text-primary" />
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

          {/* — Delivery time slot — */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delivery time</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <motion.button
                    key={slot}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setSelectedTimeSlot(isSelected ? null : slot)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/50 bg-card text-foreground"
                    }`}
                  >
                    {slot}
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
                        setSelectedAddressLabel(`${addr.label} \u2013 ${addr.address_line1}, ${addr.city}`);
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
                    <span className="normal-case text-primary font-bold">\u00b7 {formatCurrency(addonsTotal)}</span>
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
              {selectedType.label} \u00b7 {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {selectedTimeSlot && ` \u00b7 ${selectedTimeSlot}`}
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
                Scheduling...
              </>
            ) : !selectedDate ? (
              <>
                <CalendarIcon className="w-5 h-5" />
                Pick a date to continue
              </>
            ) : addonsTotal > 0 ? (
              <>
                Confirm \u00b7 {formatCurrency(addonsTotal)}
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
