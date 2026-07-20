import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MealConsumptionSheet } from "@/components/MealConsumptionSheet";

import { 
  ArrowLeft, 
  Clock,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Loader2,
  CheckCircle2,
  XCircle,
  Truck,
  ChefHat,
  MapPin,
  Store,
  UtensilsCrossed,
  Phone,
  Package,
  CheckCheck,
  X,
  Box,
  ChevronRight,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

interface ScheduleAddon {
  id: string;
  addon_id: string;
  quantity: number;
  unit_price: number;
  addon: {
    name: string;
    category: string;
  };
}

interface RawScheduleAddon {
  id: string;
  addon_id: string;
  quantity: number;
  unit_price: number;
  addon: {
    name: string;
    category: string;
  };
}

type OrderStatus = 
  | "pending" 
  | "confirmed" 
  | "preparing" 
  | "ready" 
  | "out_for_delivery" 
  | "delivered" 
  | "completed" 
  | "cancelled";

interface ScheduledMealDetail {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: OrderStatus;
  created_at: string;
  delivery_type: string | null;
  delivery_fee: number | null;
  addons_total: number | null;
  addons: ScheduleAddon[];
  meal: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number | null;
    prep_time_minutes: number | null;
    restaurant: {
      id: string;
      name: string;
      logo_url: string | null;
      address: string | null;
      phone: string | null;
    } | null;
    diet_tags: { name: string }[];
  } | null;
}


const statusOrder: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

const getStatusIndex = (status: OrderStatus) => {
  const index = statusOrder.indexOf(status);
  return index === -1 ? 0 : index;
};

const getEstimatedArrival = (status: OrderStatus, scheduledDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scheduleDate = new Date(scheduledDate);
  
  if (!isToday(scheduleDate) && !isTomorrow(scheduleDate)) {
    return format(scheduleDate, "MMM d");
  }
  
  const now = new Date();
  let estimatedTime: Date;
  
  switch (status) {
    case 'pending':
    case 'confirmed':
      estimatedTime = new Date(now.getTime() + 45 * 60000); // +45 min
      break;
    case 'preparing':
      estimatedTime = new Date(now.getTime() + 25 * 60000); // +25 min
      break;
    case 'ready':
      estimatedTime = new Date(now.getTime() + 15 * 60000); // +15 min
      break;
    case 'out_for_delivery':
      estimatedTime = new Date(now.getTime() + 10 * 60000); // +10 min
      break;
    case 'delivered':
    case 'completed':
      return "__delivered__";
    default:
      estimatedTime = new Date(now.getTime() + 45 * 60000);
  }
  
  return format(estimatedTime, "h:mm a");
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  useEffect(() => { document.title = `${t("order_detail_title")} — Nutrio`; }, [t]);

  const statusSteps: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
    { key: 'pending', label: t("order_status_placed"), icon: Package },
    { key: 'confirmed', label: t("order_status_confirmed"), icon: CheckCircle2 },
    { key: 'preparing', label: t("order_status_preparing"), icon: ChefHat },
    { key: 'ready', label: t("order_status_ready"), icon: Box },
    { key: 'out_for_delivery', label: t("order_status_on_the_way"), icon: Truck },
    { key: 'delivered', label: t("order_status_delivered"), icon: CheckCheck },
  ];

  const [order, setOrder] = useState<ScheduledMealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user && id) {
      fetchOrderDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-detail-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meal_schedules',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newStatus = (payload.new as { order_status: string }).order_status;
          const oldStatus = (payload.old as { order_status: string }).order_status;
          
          // Show toast notification when status changes
          if (newStatus !== oldStatus) {
            const statusMessages: Record<string, string> = {
              confirmed: t("order_toast_confirmed"),
              preparing: t("order_toast_preparing_msg"),
              ready: t("order_toast_ready_msg"),
              out_for_delivery: t("order_toast_on_way"),
              delivered: t("order_toast_delivered_msg"),
              completed: t("order_toast_completed_msg"),
              cancelled: t("order_cancelled_desc"),
            };
            
            if (statusMessages[newStatus]) {
              toast({ title: statusMessages[newStatus] });
            }
          }
          
          setOrder((prev) => prev ? {
            ...prev,
            order_status: payload.new.order_status,
            is_completed: payload.new.is_completed,
          } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, toast]);

  // Fetch driver info when the order is out for delivery
  useEffect(() => {
    if (!id || order?.order_status !== "out_for_delivery") return;

    const fetchDriver = async () => {
      try {
        // Fetch any delivery job for this schedule (regardless of job status)
        const { data } = await supabase
          .from("delivery_jobs")
          .select("drivers(full_name, phone_number)")
          .eq("schedule_id", id)
          .not("driver_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const driver = (data as { drivers?: { full_name: string; phone_number: string } | null })?.drivers;
        // Always set driver name; phone may be null (shown as disabled button)
        if (driver) {
          setDriverName(driver.full_name || null);
          setDriverPhone(driver.phone_number || null);
        }
      } catch {
        // best-effort — silently ignore
      }
    };

    fetchDriver();
  }, [id, order?.order_status]);

  const fetchOrderDetail = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          meal_type,
          is_completed,
          order_status,
          created_at,
          meal_id,
          delivery_type,
          delivery_fee,
          addons_total
        `)
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      const { data: mealData, error: mealError } = await supabase
        .from("public_meal_catalog" as "meals")
        .select(`
          id,
          name,
          description,
          image_url,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          fiber_g,
          prep_time_minutes,
          restaurant:restaurants (
            id,
            name,
            logo_url,
            address,
            phone
          ),
          meal_diet_tags (
            diet_tags (name)
          )
        `)
        .eq("id", data.meal_id)
        .single();

      if (mealError) throw mealError;

      const { data: addonsData } = await supabase
        .from("schedule_addons")
        .select(`
          id,
          addon_id,
          quantity,
          unit_price,
          addon:meal_addons (name, category)
        `)
        .eq("schedule_id", data.id);

      const transformed: ScheduledMealDetail = {
        id: data.id,
        scheduled_date: data.scheduled_date,
        meal_type: data.meal_type,
        is_completed: !!data.is_completed,
        order_status: (data.order_status || "pending") as OrderStatus,
        created_at: data.created_at || new Date(0).toISOString(),
        delivery_type: data.delivery_type,
        delivery_fee: data.delivery_fee,
        addons_total: data.addons_total || 0,
        addons: (addonsData || []).map((a: RawScheduleAddon) => ({
          id: a.id,
          addon_id: a.addon_id,
          quantity: a.quantity,
          unit_price: a.unit_price,
          addon: a.addon,
        })),
        meal: mealData ? {
          ...mealData,
          calories: mealData.calories ?? 0,
          protein_g: mealData.protein_g ?? 0,
          carbs_g: mealData.carbs_g ?? 0,
          fat_g: mealData.fat_g ?? 0,
          diet_tags: mealData.meal_diet_tags
            ?.map((mealTag) => mealTag.diet_tags)
            .filter((tag): tag is { name: string } => tag !== null) || [],
        } : null,
      };

      setOrder(transformed);
    } catch (error) {
      console.error("Error fetching order detail:", error);
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: OrderStatus) => {
    if (!order || !id) return;
    
    setUpdating(true);
    try {
      const { data, error } = await supabase.rpc("customer_confirm_order_received", {
        p_source: "meal_schedule",
        p_order_id: id,
      });

      if (error) throw error;
      if (!(data as { success?: boolean } | null)?.success) {
        throw new Error("Receipt confirmation failed.");
      }
      setOrder((prev) => prev ? { ...prev, order_status: newStatus } : null);
    } catch (error) {
      console.error("Error updating order:", error);
      alert(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !id) return;
    if (!confirm(t("order_cancel_confirm"))) return;
    setUpdating(true);
    try {
      const { data, error } = await supabase.rpc("cancel_meal_schedule", {
        p_schedule_id: id,
        p_reason: undefined,
      });
      
      // Handle specific error for "preparing" status
      if (error) {
        const errorMessage = error.message || "";
        if (errorMessage.includes('preparing')) {
          setUpdating(false);
          toast({
            title: t("order_cannot_cancel"),
            description: t("order_preparing_cancel_desc"),
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      
      if (!(data as { success?: boolean } | null)?.success) {
        throw new Error(t("order_cancel_fail"));
      }
      setOrder(prev => prev ? { ...prev, order_status: "cancelled" } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "";
      if (errorMessage.includes('preparing')) {
        toast({
          title: t("order_cannot_cancel"),
          description: t("order_preparing_cancel_desc"),
          variant: "destructive",
        });
      } else {
        alert(err instanceof Error ? err.message : t("order_cancel_fail"));
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#020617]" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const currentStep = getStatusIndex(order.order_status);
  const estimatedArrival = getEstimatedArrival(order.order_status, order.scheduled_date);
  const isCancelled = order.order_status === "cancelled";
  const isCompleted = order.order_status === "completed" || order.order_status === "delivered";
  const canCancel = order.order_status === "pending" || order.order_status === "confirmed";
  const isDelivered = order.order_status === "delivered";
  const isOutForDelivery = order.order_status === "out_for_delivery";
  const activeStatusStep = statusSteps[currentStep] || statusSteps[0];
  const ActiveStatusIcon = activeStatusStep.icon;
  const orderNumber = order.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3 px-4 py-3 rtl:flex-row-reverse">
          <button
            data-testid="order-detail-back-btn"
            onClick={() => navigate("/orders")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-slate-100 active:scale-95"
            aria-label="Back to orders"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{t("order_detail_title")}</p>
            <h1 className="truncate text-[18px] font-black leading-tight text-slate-950">#{orderNumber}</h1>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white shadow-[0_12px_24px_rgba(2,6,23,0.16)]">
            <Package className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[430px] space-y-4 px-4 py-4">
        {/* Status hero */}
        <section className="overflow-hidden rounded-[30px] bg-[#020617] p-5 text-white shadow-[0_18px_38px_rgba(2,6,23,0.20)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">{t("order_realtime_tracking")}</p>
              <h2 className="mt-2 text-[26px] font-black leading-tight tracking-[-0.03em]">
                {isCancelled ? t("order_cancelled_title") : isCompleted ? t("order_status_delivered") : activeStatusStep.label}
              </h2>
              <p className="mt-2 text-[13px] font-semibold leading-5 text-white/65">
                {order.meal?.restaurant?.name || t("order_scheduled_delivery")} · {format(new Date(order.scheduled_date), "MMM d")}
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-white/10 text-white ring-1 ring-white/10">
              {isCancelled ? <XCircle className="h-7 w-7" /> : <ActiveStatusIcon className="h-7 w-7" />}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] bg-white/10 px-3 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-black uppercase tracking-wide text-white/45">{t("order_arriving_soon")}</p>
              <p className="mt-1 text-[18px] font-black leading-none">
                {estimatedArrival === "__delivered__" ? t("order_status_delivered") : estimatedArrival}
              </p>
            </div>
            <div className="rounded-[18px] bg-white/10 px-3 py-3 ring-1 ring-white/10">
              <p className="text-[10px] font-black uppercase tracking-wide text-white/45">{t("order_delivery_type_label")}</p>
              <p className="mt-1 truncate text-[18px] font-black capitalize leading-none">
                {order.delivery_type === "free" ? t("order_free_delivery") : order.delivery_type || "Standard"}
              </p>
            </div>
          </div>
        </section>

        {/* Status Timeline */}
        {!isCancelled && (
          <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-black text-slate-950">{t("order_realtime_tracking")}</h3>
              <span className="rounded-full bg-[#020617]/5 px-3 py-1 text-[11px] font-black text-[#020617]">{currentStep + 1}/{statusSteps.length}</span>
            </div>
            <div className="flex items-start justify-between gap-1">
              {statusSteps.map((step, index) => {
                const stepDone = index <= currentStep;
                const isCurrent = index === currentStep;
                const StepIcon = step.icon;

                return (
                  <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
                    <div className={isCurrent ? "rounded-full bg-[#020617]/10 p-1" : "p-1"}>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        stepDone ? "bg-[#020617] text-white" : "bg-slate-100 text-slate-400"
                      }`}>
                        <StepIcon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className={`mt-1 max-w-[54px] truncate text-center text-[9px] font-black ${stepDone ? "text-slate-950" : "text-slate-400"}`}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-[18px] bg-slate-50 px-4 py-3">
              <p className="text-[12px] font-bold leading-5 text-slate-600">
                {currentStep === 0 && t("order_step_waiting")}
                {currentStep === 1 && t("order_step_accepted")}
                {currentStep === 2 && t("order_step_preparing_desc")}
                {currentStep === 3 && t("order_step_ready_desc")}
                {currentStep === 4 && t("order_step_on_way")}
                {currentStep >= 5 && t("order_step_enjoy")}
              </p>
            </div>
          </section>
        )}

        {/* Cancelled Order Message */}
        {isCancelled && (
          <section className="rounded-[28px] border border-red-100 bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-red-600 ring-1 ring-red-100">
                <XCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-red-700">{t("order_cancelled_title")}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-red-600/70">
                  {t("order_cancelled_message")}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Food Image Card */}
        {order.meal && (
          <section className="overflow-hidden rounded-[30px] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="relative aspect-[1.35]">
              {order.meal.image_url ? (
                <img 
                  src={order.meal.image_url} 
                  alt={order.meal.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100">
                  <UtensilsCrossed className="h-16 w-16 text-slate-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/65">{order.meal_type}</p>
                <h3 className="mt-1 text-[21px] font-black leading-tight">{order.meal.name}</h3>
                {order.meal.diet_tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {order.meal.diet_tags.slice(0, 3).map((tag) => (
                      <Badge key={tag.name} variant="secondary" className="border-0 bg-white/20 text-white">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              {/* Nutrition Info */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                  <Flame className="mx-auto mb-1 h-5 w-5 text-[#020617]" />
                  <p className="text-lg font-black text-slate-950">{order.meal.calories}</p>
                  <p className="text-xs font-bold text-slate-400">cal</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                  <Beef className="mx-auto mb-1 h-5 w-5 text-[#020617]" />
                  <p className="text-lg font-black text-slate-950">{order.meal.protein_g}g</p>
                  <p className="text-xs font-bold text-slate-400">{t("protein")}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                  <Wheat className="mx-auto mb-1 h-5 w-5 text-[#020617]" />
                  <p className="text-lg font-black text-slate-950">{order.meal.carbs_g}g</p>
                  <p className="text-xs font-bold text-slate-400">{t("carbs")}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                  <Droplets className="mx-auto mb-1 h-5 w-5 text-[#020617]" />
                  <p className="text-lg font-black text-slate-950">{order.meal.fat_g}g</p>
                  <p className="text-xs font-bold text-slate-400">{t("fat")}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Contact Section */}
        {order.meal?.restaurant && (
          <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-slate-50 ring-1 ring-slate-100">
                  {order.meal.restaurant.logo_url ? (
                    <img 
                      src={order.meal.restaurant.logo_url} 
                      alt={order.meal.restaurant.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-6 w-6 text-[#020617]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-950">{order.meal.restaurant.name}</p>
                  {order.meal.restaurant.address && (
                    <p className="mt-1 flex items-center gap-1 truncate text-sm font-semibold text-slate-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {order.meal.restaurant.address}
                    </p>
                  )}
                </div>
              </div>

              {isOutForDelivery ? (
                driverPhone ? (
                  <a
                    href={`tel:${driverPhone}`}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#020617] px-4 text-sm font-black text-white shadow-[0_10px_22px_rgba(2,6,23,0.16)] transition active:scale-[0.98]"
                  >
                    <Phone className="h-5 w-5" />
                    {t("order_call_driver")}{driverName ? ` · ${driverName}` : ""}
                  </a>
                ) : (
                  <button
                    data-testid="order-detail-call-driver-btn"
                    disabled
                    className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-slate-100 px-4 text-sm font-black text-slate-400 opacity-70"
                  >
                    <Phone className="h-5 w-5" />
                    {t("order_call_driver")}{driverName ? ` · ${driverName}` : ""}
                  </button>
                )
              ) : order.meal.restaurant.phone ? (
                <a
                  href={`tel:${order.meal.restaurant.phone}`}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 text-sm font-black text-slate-700 transition active:scale-[0.98]"
                >
                  <Phone className="h-5 w-5" />
                  {t("order_contact_restaurant")}
                </a>
              ) : null}
            </div>
          </section>
        )}

        {/* Delivery Info */}
        <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">{t("order_scheduled_delivery")}</p>
                <p className="text-sm font-semibold text-slate-500">
                  {format(new Date(order.scheduled_date), "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">{t("order_delivery_type_label")}</p>
                <p className="text-sm font-semibold capitalize text-slate-500">
                  {order.delivery_type === "free" ? t("order_free_delivery") : `${order.delivery_type || "Standard"} ${t("order_delivery_suffix")}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-950">{t("order_total_label")}</p>
                <p className="text-lg font-black text-slate-950">
                  {formatCurrency((order.addons_total || 0))}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        {(order.order_status === "delivered" || order.order_status === "completed") && order.meal && (
          <section className="rounded-lg border border-[#C7F1E6] bg-[#E8FBF6] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#22C7A1]">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold text-[#020617]">
                  {isRTL ? "سجّل ما تناولته فعلياً" : "Record what you actually ate"}
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748B]">
                  {isRTL
                    ? "اختر الوجبة كاملة أو جزءاً منها أو وجبة بديلة ليبقى تقدمك دقيقاً."
                    : "Choose the full meal, a partial portion, or a replacement to keep progress accurate."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConsumptionOpen(true)}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#020617] px-4 text-[14px] font-extrabold text-white"
            >
              <CheckCircle2 className="h-5 w-5" />
              {order.is_completed
                ? (isRTL ? "تعديل الاستهلاك" : "Edit consumption")
                : (isRTL ? "تأكيد ما تناولته" : "Confirm what you ate")}
            </button>
          </section>
        )}

        {canCancel && (
          <Button 
            variant="outline" 
            className="h-12 w-full rounded-full border-red-200 text-sm font-black text-red-600 hover:bg-red-50"
            onClick={handleCancelOrder}
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-2" />
            )}
            {t("order_cancel_order")}
          </Button>
        )}

        {isDelivered && (
          <Button 
            className="h-12 w-full rounded-full bg-[#020617] text-sm font-black text-white shadow-[0_10px_22px_rgba(2,6,23,0.16)] hover:bg-slate-800"
            onClick={() => updateOrderStatus("completed")}
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {t("order_mark_completed")}
          </Button>
        )}

        {order.meal && (
          <MealConsumptionSheet
            open={consumptionOpen}
            onOpenChange={setConsumptionOpen}
            sourceType="meal_schedule"
            sourceId={order.id}
            sourceMealId={order.meal.id}
            meal={{
              meal_id: order.meal.id,
              meal_name: order.meal.name,
              image_url: order.meal.image_url,
              calories: order.meal.calories,
              protein_g: order.meal.protein_g,
              carbs_g: order.meal.carbs_g,
              fat_g: order.meal.fat_g,
              fiber_g: order.meal.fiber_g || 0,
            }}
            onSaved={(result) => {
              setOrder((currentOrder) => currentOrder ? {
                ...currentOrder,
                is_completed: result.status === "full"
                  || result.status === "partial"
                  || result.status === "substituted",
              } : currentOrder);
            }}
          />
        )}

        {/* View Order History Link */}
        <Link to="/orders" className="block">
          <Button 
            variant="ghost" 
            className="h-12 w-full rounded-full text-sm font-black text-slate-500 hover:bg-slate-50"
          >
            {t("order_view_all")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

    </div>
  );
};

export default OrderDetail;
