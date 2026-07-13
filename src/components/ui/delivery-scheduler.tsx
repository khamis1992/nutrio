import { useEffect, useState } from "react";
import { Briefcase, Check, Clock, Calendar, ChevronLeft, ChevronRight, Home, MapPin, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useLanguage } from "@/contexts/LanguageContext";

interface DeliverySchedulerProps {
  initialDate?: Date | string | null;
  timeSlots?: string[];
  timeZone?: string;
  requireAddress?: boolean;
  onSchedule: (result: { date: Date; time: string; deliveryAddressId: string | null; deliveryAddressLabel: string }) => void;
  onCancel?: () => void;
}

type DeliveryAddress = {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  is_default: boolean;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const DeliveryScheduler = ({
  initialDate,
  timeSlots = [
    "7:00 AM", "8:00 AM", "9:00 AM",
    "11:00 AM", "12:00 PM", "1:00 PM",
    "5:00 PM", "6:00 PM", "7:00 PM",
  ],
  timeZone = "Qatar (GMT +3)",
  requireAddress = true,
  onSchedule,
  onCancel,
}: DeliverySchedulerProps) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const formatDate = (date: Date) => formatLocaleDate(date, language, { weekday: "long", month: "long", day: "numeric" });
  const parseInitial = () => {
    if (!initialDate) return new Date();
    if (initialDate instanceof Date) return initialDate;
    const d = new Date(initialDate);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(parseInitial());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const initDate = parseInitial();
  const diffDays = Math.floor((initDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const initialWeekOffset = Math.floor(diffDays / 7);

  const [weekOffset, setWeekOffset] = useState<number>(initialWeekOffset);

  useEffect(() => {
    let cancelled = false;

    async function loadAddresses() {
      if (!user) return;

      setAddressesLoading(true);
      const { data, error } = await supabase
        .from("user_addresses")
        .select("id, label, address_line1, address_line2, city, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (cancelled) return;
      setAddressesLoading(false);

      if (error) {
        console.error("Error loading delivery addresses:", error);
        return;
      }

      const nextAddresses: DeliveryAddress[] = (data || []).map((address) => ({
        ...address,
        is_default: address.is_default ?? false,
      }));
      setAddresses(nextAddresses);
      if (nextAddresses.length > 0) {
        const defaultAddress = nextAddresses.find((address) => address.is_default) || nextAddresses[0];
        setSelectedAddressId((current) => current || defaultAddress.id);
      }
    }

    void loadAddresses();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Build 7-day week starting from today + weekOffset*7
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const handleConfirm = () => {
    if (!selectedTime) return;
    if (requireAddress && !selectedAddressId) return;

    const selectedAddress = addresses.find((address) => address.id === selectedAddressId);
    const addressLabel = selectedAddress
      ? `${selectedAddress.label} - ${selectedAddress.address_line1}, ${selectedAddress.city}`
      : "";

    onSchedule({ date: selectedDate, time: selectedTime, deliveryAddressId: selectedAddressId, deliveryAddressLabel: addressLabel });
  };

  const selectedAddress = addresses.find((address) => address.id === selectedAddressId);
  const canConfirm = Boolean(selectedTime) && (!requireAddress || Boolean(selectedAddressId));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F8FAFC]">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-3">
        <section className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Delivery</p>
              <h2 className="mt-0.5 text-[22px] font-black leading-tight text-slate-950">Choose time</h2>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-slate-500">{timeZone}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#E2F8EB] text-[#0B9B59]">
              <Calendar className="h-5 w-5" strokeWidth={2.4} />
            </div>
          </div>

          <div className="mt-3 rounded-[18px] bg-slate-50 p-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-black text-slate-950">Select date</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-35"
                  onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                  disabled={weekOffset === 0}
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  aria-label="Next week"
                >
                  <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-7 gap-1">
              {weekDays.map((day) => {
                const isPast = day < today;
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isPast}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "flex min-h-[46px] flex-col items-center justify-center rounded-[13px] text-center transition-all",
                      isPast && "cursor-not-allowed opacity-30",
                      isSelected && "bg-slate-950 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]",
                      !isSelected && !isPast && "bg-white text-slate-800 active:scale-95",
                      isToday && !isSelected && "ring-2 ring-emerald-200"
                    )}
                  >
                    <span className="text-[9px] font-extrabold uppercase leading-none opacity-70">
                      {formatLocaleDate(day, language, { weekday: "short" })}
                    </span>
                    <span className="mt-1 text-[14px] font-black leading-none">{day.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-2.5 text-center text-[12px] font-bold text-slate-500">
              {formatDate(selectedDate)}
            </p>
          </div>
        </section>

        <section className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-black text-slate-950">Select time</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-500">Available delivery windows</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <Clock className="h-5 w-5" strokeWidth={2.4} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTime(slot)}
                className={cn(
                  "flex min-h-[44px] items-center justify-center rounded-[15px] border px-2 text-[13px] font-black transition-all active:scale-95",
                  selectedTime === slot
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]"
                    : "border-slate-100 bg-slate-50 text-slate-700"
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        </section>

        {requireAddress && (
          <section className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-black text-slate-950">Delivery address</p>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  {addresses.length > 0 ? "Choose where we should deliver" : "Add an address before confirming"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/addresses")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95"
                aria-label="Add delivery address"
              >
                <Plus className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>

            {addressesLoading ? (
              <div className="mt-4 space-y-2">
                {[0, 1].map((item) => (
                  <div key={item} className="h-[68px] animate-pulse rounded-[18px] bg-slate-50" />
                ))}
              </div>
            ) : addresses.length > 0 ? (
              <div className="mt-4 space-y-2">
                {addresses.map((address) => {
                  const isSelected = selectedAddressId === address.id;
                  const label = address.label.toLowerCase();
                  const Icon = label === "home" ? Home : label === "work" || label === "office" ? Briefcase : MapPin;

                  return (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => setSelectedAddressId(address.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[18px] border p-3 text-left transition-all active:scale-[0.99]",
                        isSelected ? "border-slate-950 bg-slate-50" : "border-slate-100 bg-slate-50/70"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px]",
                          isSelected ? "bg-slate-950 text-white" : "bg-white text-slate-500"
                        )}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.4} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-black text-slate-950">{address.label}</p>
                          {address.is_default && (
                            <span className="rounded-full bg-[#E2F8EB] px-2 py-0.5 text-[9px] font-black text-[#0B9B59]">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[12px] font-semibold text-slate-500">
                          {[address.address_line1, address.address_line2, address.city].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-[#0B9B59]" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/addresses")}
                className="mt-4 flex min-h-[54px] w-full items-center justify-center rounded-[17px] border border-dashed border-slate-300 bg-slate-50 px-4 text-[13px] font-black text-slate-700 active:scale-[0.99]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add delivery address
              </button>
            )}
          </section>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white/95 px-4 pt-3 backdrop-blur-2xl"
        style={{ paddingBottom: "max(5.75rem, calc(env(safe-area-inset-bottom) + 5.25rem))" }}
      >
        <div className="mb-2.5 flex items-center justify-between rounded-[16px] bg-slate-50 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black text-slate-950">{formatDate(selectedDate)}</p>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
              {selectedTime || "Select a time"}
              {selectedAddress && ` - ${selectedAddress.label}`}
            </p>
          </div>
          {canConfirm && (
            <span className="rounded-full bg-[#E2F8EB] px-3 py-1.5 text-[11px] font-black text-[#0B9B59]">
              Ready
            </span>
          )}
        </div>

        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              className="flex min-h-[50px] flex-1 items-center justify-center rounded-[17px] bg-slate-100 px-4 text-[14px] font-black text-slate-600 active:scale-95"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="flex min-h-[50px] flex-[1.4] items-center justify-center rounded-[17px] bg-slate-950 px-4 text-[14px] font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition disabled:bg-slate-300 disabled:text-white disabled:shadow-none"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            Confirm time
          </button>
        </div>
      </div>
    </div>
  );
};
