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
  Loader2,
  ReceiptText,
  TrendingUp,
  UserRound,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { hapticFeedback } from "@/lib/capacitor";
import { formatCurrency } from "@/lib/currency";
import { MEAL_TYPES, generateDateOptions } from "./scheduleUtils";
import { quoteDeliveryFee, type DeliveryFeeQuote } from "@/lib/delivery-pricing";
import type { FamilyMember } from "@/hooks/useFamilyMembers";
import type { CorporateBenefit } from "@/hooks/useCorporateBenefit";
import { useLanguage } from "@/contexts/LanguageContext";

interface ScheduleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  selectedMealType: string;
  setSelectedMealType: (type: string) => void;
  selectedTimeSlot: string | null;
  setSelectedTimeSlot: (slot: string | null) => void;
  onSchedule: (deliveryQuoteId?: string | null) => void;
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
  menuOfferings?: Array<{
    meal_type: "breakfast" | "lunch" | "dinner" | "snack";
    price: number;
    is_available: boolean;
  }>;
  familyMembers?: FamilyMember[];
  selectedFamilyMemberId: string | null;
  setSelectedFamilyMemberId: (id: string | null) => void;
  corporateBenefit?: CorporateBenefit | null;
  useCorporateBenefit: boolean;
  setUseCorporateBenefit: (useBenefit: boolean) => void;
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
  menuOfferings = [],
  familyMembers = [],
  selectedFamilyMemberId,
  setSelectedFamilyMemberId,
  corporateBenefit,
  useCorporateBenefit,
  setUseCorporateBenefit,
}: ScheduleSheetProps) => {
  const { isRTL } = useLanguage();
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [addresses, setAddresses] = useState<{ id: string; label: string; address_line1: string; city: string; is_default: boolean }[]>([]);
  const [deliveryFeeQuote, setDeliveryFeeQuote] = useState<DeliveryFeeQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRefreshNonce, setQuoteRefreshNonce] = useState(0);

  useEffect(() => {
    if (!isOpen || !userId) return;
    supabase
      .from("user_addresses")
      .select("id, label, address_line1, city, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching delivery addresses:", error);
          return;
        }
        if (data && data.length > 0) {
          const normalized = data.map((address) => ({
            ...address,
            is_default: address.is_default ?? false,
          }));
          setAddresses(normalized);
          if (selectedAddressId === null) {
            const def = normalized.find(a => a.is_default) || normalized[0];
            setSelectedAddressId(def.id);
            setSelectedAddressLabel(`${def.label} \u2013 ${def.address_line1}, ${def.city}`);
          }
        }
      });
  }, [isOpen, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!isOpen || !selectedDate || !selectedTimeSlot || !selectedAddressId) {
        setDeliveryFeeQuote(null);
        setQuoteError(null);
        setQuoteLoading(false);
        return;
      }

      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const nextQuote = await quoteDeliveryFee({
          scheduledDate: `${year}-${month}-${day}`,
          timeSlot: selectedTimeSlot,
          deliveryAddressId: selectedAddressId,
          orderTotal: addonsTotal,
        });
        if (!cancelled) setDeliveryFeeQuote(nextQuote);
      } catch (error) {
        console.error("Error quoting delivery fee:", error);
        if (!cancelled) {
          setDeliveryFeeQuote(null);
          setQuoteError("Delivery fee could not be confirmed. Please retry.");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addonsTotal, isOpen, quoteRefreshNonce, selectedAddressId, selectedDate, selectedTimeSlot]);

  const dateOptions = generateDateOptions();
  const selectedType = MEAL_TYPES.find(t => t.id === selectedMealType);
  const beneficiaryCopy = isRTL ? {
    eyebrow: "لمن هذه الوجبة؟",
    title: "اختر المستفيد من الوجبة",
    safety: "تم فحص السلامة",
    myself: "لي",
    useBenefit: "استخدام منفعة",
    remaining: "وجبة مدعومة متبقية",
    exhausted: "تم استخدام الحصة الشهرية",
  } : {
    eyebrow: "For whom?",
    title: "Choose the meal beneficiary",
    safety: "Safety checked",
    myself: "Myself",
    useBenefit: "Use",
    remaining: "sponsored meals remaining",
    exhausted: "Monthly benefit used",
  };

  useEffect(() => {
    if ((corporateBenefit?.remaining_allowance ?? 0) <= 0 && useCorporateBenefit) {
      setUseCorporateBenefit(false);
    }
  }, [corporateBenefit?.remaining_allowance, setUseCorporateBenefit, useCorporateBenefit]);

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
                const offering = menuOfferings.find(
                  (item) => item.meal_type === type.id,
                );
                const isUnavailable =
                  menuOfferings.length > 0 && !offering?.is_available;
                return (
                  <motion.button
                    key={type.id}
                    whileTap={{ scale: 0.95 }}
                    disabled={isUnavailable}
                    onClick={() => {
                      if (isUnavailable) return;
                      setSelectedMealType(type.id);
                      hapticFeedback.buttonPress();
                    }}
                    className={`flex items-center gap-2.5 rounded-[18px] border p-3 text-left transition-all ${
                      isUnavailable
                        ? "cursor-not-allowed border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8] opacity-55"
                        : isSelected
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
                      <p className="text-[10px] font-bold leading-tight text-[#94A3B8]">
                        {isUnavailable
                          ? "Not offered"
                          : offering
                            ? `${type.time} / ${formatCurrency(offering.price)}`
                            : type.time}
                      </p>
                    </div>
                    {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-[#22C7A1]" />}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* — Delivery time slot — */}
          {(familyMembers.length > 0 || corporateBenefit?.status === "active") && (
            <section dir={isRTL ? "rtl" : "ltr"} className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{beneficiaryCopy.eyebrow}</p>
                  <p className="mt-1 text-sm font-black text-[#020617]">{beneficiaryCopy.title}</p>
                </div>
                {selectedFamilyMemberId && (
                  <span className="rounded-full bg-[#FFF1F3] px-2 py-1 text-[10px] font-black text-[#D94B63]">{beneficiaryCopy.safety}</span>
                )}
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
                <button
                  type="button"
                  onClick={() => { setSelectedFamilyMemberId(null); hapticFeedback.buttonPress(); }}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-black transition-all ${!selectedFamilyMemberId ? "border-[#020617] bg-[#020617] text-white" : "border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"}`}
                >
                  <UserRound className="h-4 w-4" /> {beneficiaryCopy.myself}
                </button>
                {familyMembers.map((member) => {
                  const selected = selectedFamilyMemberId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => { setSelectedFamilyMemberId(member.id); setUseCorporateBenefit(false); hapticFeedback.buttonPress(); }}
                      className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-black transition-all ${selected ? "border-[#7C83F6] bg-[#EEF0FF] text-[#4D55C8]" : "border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"}`}
                    >
                      <UserRound className="h-4 w-4" />
                      {member.name}
                      {member.allergies.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-[#FB6B7A]" />}
                    </button>
                  );
                })}
              </div>
              {corporateBenefit?.status === "active" && !selectedFamilyMemberId && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={useCorporateBenefit}
                  disabled={(corporateBenefit.remaining_allowance ?? 0) <= 0}
                  onClick={() => { setUseCorporateBenefit(!useCorporateBenefit); hapticFeedback.buttonPress(); }}
                  className={`mt-3 flex min-h-14 w-full items-center gap-3 rounded-[18px] border px-3 text-start transition-all disabled:opacity-60 ${useCorporateBenefit ? "border-[#22C7A1] bg-[#EAFBF6]" : "border-[#E5EAF1] bg-[#F6F8FB]"}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${useCorporateBenefit ? "bg-[#22C7A1] text-white" : "bg-white text-[#64748B]"}`}>
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-black text-[#020617]">{beneficiaryCopy.useBenefit} {corporateBenefit.organization_name}</span>
                    <span className="block text-[10px] font-bold text-[#64748B]">{(corporateBenefit.remaining_allowance ?? 0) > 0 ? `${corporateBenefit.remaining_allowance} ${beneficiaryCopy.remaining}` : beneficiaryCopy.exhausted}</span>
                  </span>
                  <span className={`relative h-6 w-11 rounded-full transition-colors ${useCorporateBenefit ? "bg-[#22C7A1]" : "bg-[#CBD5E1]"}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${useCorporateBenefit ? "translate-x-6" : "translate-x-1"}`} />
                  </span>
                </button>
              )}
            </section>
          )}

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

          {selectedDate && selectedTimeSlot && selectedAddressId && (
            <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] ${deliveryFeeQuote?.surgeFee ? "bg-[#FFF4ED] text-[#FB6B7A]" : "bg-[#EAF8FF] text-[#38BDF8]"}`}>
                  {deliveryFeeQuote?.surgeFee ? <TrendingUp className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#020617]">Delivery fee</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                        {quoteLoading ? "Checking this delivery window..." : quoteError || deliveryFeeQuote?.message}
                      </p>
                      {quoteError && (
                        <button
                          type="button"
                          onClick={() => setQuoteRefreshNonce((value) => value + 1)}
                          className="mt-2 min-h-9 rounded-full bg-[#020617] px-3 text-[11px] font-black text-white"
                        >
                          Retry fee
                        </button>
                      )}
                    </div>
                    {quoteLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#38BDF8]" />
                    ) : deliveryFeeQuote ? (
                      <p className="shrink-0 text-base font-black text-[#020617]">
                        {deliveryFeeQuote.totalFee === 0 ? "Free" : formatCurrency(deliveryFeeQuote.totalFee)}
                      </p>
                    ) : null}
                  </div>
                  {deliveryFeeQuote && deliveryFeeQuote.surgeFee > 0 && (
                    <div className="mt-3 flex justify-between rounded-[14px] bg-[#FFF4ED] px-3 py-2 text-[11px] font-black text-[#C2415D]">
                      <span>Base {formatCurrency(deliveryFeeQuote.baseFee)}</span>
                      <span>+{formatCurrency(deliveryFeeQuote.surgeFee)}</span>
                    </div>
                  )}
                </div>
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
            onClick={() => onSchedule(deliveryFeeQuote?.quoteId)}
            disabled={loading || quoteLoading || !selectedDate || !selectedTimeSlot || !selectedAddressId || !deliveryFeeQuote}
            className={`h-13 flex w-full items-center justify-center gap-2 rounded-[18px] text-base font-black transition-all ${
              !selectedDate || !selectedTimeSlot || !selectedAddressId || !deliveryFeeQuote
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
            ) : !selectedDate || !selectedTimeSlot || !selectedAddressId ? (
              <>
                <CalendarIcon className="w-5 h-5" />
                Select date, time, and address
              </>
            ) : quoteLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Confirming delivery fee
              </>
            ) : !deliveryFeeQuote ? (
              <>Delivery fee required</>
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
