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
        closeButtonClassName="hidden"
        className="mx-auto flex w-full max-w-[480px] flex-col overflow-hidden rounded-t-[32px] border-0 bg-[#F6F8FB] p-0 shadow-[0_-24px_70px_rgba(2,6,23,0.22)] sm:!left-1/2 sm:!right-auto sm:-translate-x-1/2"
        style={{
          bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
          height: "calc(100dvh - 80px - env(safe-area-inset-bottom, 0px))",
          maxHeight: "calc(100dvh - 80px - env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#CBD5E1]" />
        </div>

        {/* Meal preview header */}
        <div className="mx-4 mb-3 flex shrink-0 items-center gap-3 rounded-[24px] border border-[#E5EAF1] bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          {meal?.image_url ? (
            <img
              src={meal.image_url}
              alt={meal.name}
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-[20px] object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[#EEF2FF]">
              <Utensils className="h-6 w-6 text-[#7C83F6]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black leading-tight text-[#020617]">{meal?.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {meal?.calories && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4ED] px-2 py-1 text-[11px] font-extrabold text-[#FB6B7A]">
                  <Flame className="h-3 w-3" />
                  {meal.calories} kcal
                </span>
              )}
              {hasActiveSubscription && (
                <Badge className="rounded-full bg-[#E6FBF5] px-2 py-1 text-[11px] font-extrabold text-[#0F9F83] hover:bg-[#E6FBF5]">
                  {isUnlimited ? "Unlimited" : `${remainingMeals} left`}
                </Badge>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]"
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6 [-webkit-overflow-scrolling:touch]">

          {/* — Date — */}
          <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">When</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
              {dateOptions.map((date, i) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isToday = new Date().toDateString() === date.toDateString();
                return (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => { setSelectedDate(date); hapticFeedback.buttonPress(); }}
                    className={`flex min-w-[56px] flex-shrink-0 flex-col items-center rounded-[18px] border px-3 py-2.5 transition-all ${
                      isSelected
                        ? "border-[#020617] bg-[#020617] text-white shadow-[0_10px_20px_rgba(2,6,23,0.18)]"
                        : "border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"
                    }`}
                  >
                    <span className={`text-[10px] font-extrabold uppercase ${isSelected ? "text-white/70" : "text-[#94A3B8]"}`}>
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className="text-lg font-black leading-tight">
                      {date.getDate()}
                    </span>
                    {isToday && (
                      <div className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-white/60" : "bg-[#22C7A1]"}`} />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* — Meal type — */}
          <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Meal type</p>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedMealType === type.id;
                return (
                  <motion.button
                    key={type.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setSelectedMealType(type.id); hapticFeedback.buttonPress(); }}
                    className={`flex items-center gap-2.5 rounded-[18px] border p-3 text-left transition-all ${
                      isSelected
                        ? "border-[#020617] bg-[#F8FAFC] text-[#020617]"
                        : "border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${
                        isSelected ? "bg-[#020617] text-white" : "bg-white text-[#94A3B8]"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black leading-tight">{type.label}</p>
                      <p className="text-[10px] font-bold leading-tight text-[#94A3B8]">{type.time}</p>
                    </div>
                    {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-[#22C7A1]" />}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* — Delivery time slot — */}
          <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Delivery time</p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <motion.button
                    key={slot}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setSelectedTimeSlot(isSelected ? null : slot)}
                    className={`min-h-[44px] rounded-[16px] border px-3 py-2 text-xs font-black transition-all ${
                      isSelected
                        ? "border-[#020617] bg-[#020617] text-white shadow-[0_10px_20px_rgba(2,6,23,0.18)]"
                        : "border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"
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
            <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Deliver to</p>
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
                      className={`flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-all ${
                        isSelected
                          ? "border-[#020617] bg-[#F8FAFC]"
                          : "border-[#E5EAF1] bg-[#F6F8FB]"
                      }`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${isSelected ? "bg-[#020617]" : "bg-white"}`}>
                        {addr.label.toLowerCase() === "home" ? (
                          <Home className={`h-4 w-4 ${isSelected ? "text-white" : "text-[#94A3B8]"}`} />
                        ) : addr.label.toLowerCase() === "work" || addr.label.toLowerCase() === "office" ? (
                          <Briefcase className={`h-4 w-4 ${isSelected ? "text-white" : "text-[#94A3B8]"}`} />
                        ) : (
                          <MapPin className={`h-4 w-4 ${isSelected ? "text-white" : "text-[#94A3B8]"}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-black text-[#020617]">{addr.label}</p>
                          {addr.is_default && (
                            <span className="rounded-full bg-[#E6FBF5] px-1.5 py-0.5 text-[10px] font-black text-[#0F9F83]">Default</span>
                          )}
                        </div>
                        <p className="truncate text-xs font-semibold text-[#94A3B8]">{addr.address_line1}, {addr.city}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-[#22C7A1]" />}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* — Add-ons (collapsible) — */}
          {hasAddons && (
            <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <button
                onClick={() => setAddonsOpen(v => !v)}
                className="flex w-full items-center justify-between"
              >
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  <ShoppingCart className="h-3.5 w-3.5 text-[#38BDF8]" />
                  Add-ons
                  {addonsTotal > 0 && (
                    <span className="normal-case tracking-normal text-[#22C7A1]">\u00b7 {formatCurrency(addonsTotal)}</span>
                  )}
                </p>
                <ChevronLeft className={`h-4 w-4 text-[#94A3B8] transition-transform ${addonsOpen ? "-rotate-90" : "rotate-90"}`} />
              </button>

              <AnimatePresence>
                {addonsOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 space-y-3 overflow-hidden"
                  >
                    {Object.entries(groupedAddons).map(([category, items]) => (
                      <div key={category} className="space-y-1.5">
                        <p className="text-xs font-black capitalize text-[#64748B]">{category}</p>
                        {items.map((addon) => {
                          const isSel = selectedAddons.has(addon.id);
                          return (
                            <button
                              key={addon.id}
                              onClick={() => toggleAddon(addon.id)}
                              className={`flex w-full items-center justify-between rounded-[16px] border px-3 py-2.5 text-left transition-all ${
                                isSel ? "border-[#22C7A1] bg-[#E6FBF5]" : "border-[#E5EAF1] bg-[#F6F8FB]"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-[#020617]">{addon.name}</p>
                                {addon.description && <p className="truncate text-xs font-semibold text-[#94A3B8]">{addon.description}</p>}
                              </div>
                              <div className="ml-3 flex shrink-0 items-center gap-2">
                                <span className="text-sm font-black text-[#020617]">{formatCurrency(addon.price)}</span>
                                <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                                  isSel ? "border-[#22C7A1] bg-[#22C7A1]" : "border-[#CBD5E1]"
                                }`}>
                                  {isSel && <Check className="h-3 w-3 text-white" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    {addonsTotal > 0 && (
                      <div className="flex items-center gap-2 rounded-[16px] bg-[#F6F8FB] px-3 py-2 text-xs font-bold text-[#64748B]">
                        <Wallet className="h-3.5 w-3.5 shrink-0 text-[#7C83F6]" />
                        Wallet: <span className="font-black text-[#020617]">{formatCurrency(walletBalance)}</span>
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
        <div className="shrink-0 border-t border-[#E5EAF1] bg-white px-4 pb-4 pt-3">
          {selectedDate && selectedType && (
            <p className="mb-2 text-center text-xs font-bold text-[#64748B]">
              {selectedType.label} \u00b7 {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {selectedTimeSlot && ` \u00b7 ${selectedTimeSlot}`}
            </p>
          )}
          <motion.button
            whileTap={{ scale: loading ? 1 : 0.97 }}
            onClick={onSchedule}
            disabled={loading || !selectedDate}
            className={`h-13 flex w-full items-center justify-center gap-2 rounded-[18px] text-base font-black transition-all ${
              !selectedDate
                ? "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]"
                : "bg-[#020617] text-white shadow-[0_16px_32px_rgba(2,6,23,0.24)] active:shadow-none"
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
