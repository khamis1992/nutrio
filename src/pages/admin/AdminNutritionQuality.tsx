import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AdminFilterBar,
  AdminKpiStrip,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { cn } from "@/lib/utils";
import { NutritionVerificationOperations } from "@/components/admin/NutritionVerificationOperations";
import { SupplierQualityOperations } from "@/components/admin/SupplierQualityOperations";

type QueueFilter = "all" | "missing" | "invalid";

interface NutritionQueueItem {
  approval_status: string | null;
  is_available: boolean | null;
  meal_id: string;
  meal_name: string;
  nutrient_completeness_score: number;
  nutrient_invalid_codes: string[];
  nutrient_missing_codes: string[];
  nutrition_version: number;
  restaurant_id: string | null;
  restaurant_name: string;
  correction_status: "requested" | "submitted" | null;
}

function formatNutrientCode(code: string) {
  return code
    .replace(/_(g|mg|mcg)$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminNutritionCorrectionButton({
  isRTL,
  pending,
  requested,
  submitted = false,
  onClick,
}: {
  isRTL: boolean;
  pending: boolean;
  requested: boolean;
  submitted?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      dir={isRTL ? "rtl" : "ltr"}
      type="button"
      onClick={onClick}
      disabled={pending || requested}
      className="min-h-11 rounded-full bg-[#020617] px-4 text-xs font-black text-white"
    >
      {pending ? (
        <Loader2 className="me-2 h-4 w-4 animate-spin" />
      ) : (
        <AlertTriangle className="me-2 h-4 w-4" />
      )}
      {submitted
        ? isRTL
          ? "اعتماد التصحيح"
          : "Approve correction"
        : requested
        ? isRTL
          ? "تم طلب التصحيح"
          : "Correction requested"
        : isRTL
          ? "طلب تصحيح"
          : "Request correction"}
    </Button>
  );
}

export default function AdminNutritionQuality() {
  const { isRTL } = useLanguage();
  const featureEnabled = isPhaseOneFeatureEnabled("micronutrients");
  const [items, setItems] = useState<NutritionQueueItem[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { data: queueData, error: queueError } = await supabase
        .from("partner_meal_nutrition_missing_queue")
        .select("*")
        .order("nutrient_completeness_score", { ascending: true });
      if (queueError) throw queueError;

      const restaurantIds = Array.from(
        new Set(
          (queueData ?? [])
            .map((item) => item.restaurant_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const restaurantNames = new Map<string, string>();

      if (restaurantIds.length > 0) {
        const { data: restaurants, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id, name")
          .in("id", restaurantIds);
        if (restaurantError) throw restaurantError;
        for (const restaurant of restaurants ?? []) {
          restaurantNames.set(restaurant.id, restaurant.name);
        }
      }

      setItems(
        (queueData ?? [])
          .filter(
            (item): item is typeof item & { meal_id: string; meal_name: string } =>
              Boolean(item.meal_id && item.meal_name),
          )
          .map((item) => {
            const extended = item as unknown as Record<string, unknown>;
            return ({
            approval_status: item.approval_status,
            is_available: item.is_available,
            meal_id: item.meal_id,
            meal_name: item.meal_name,
            nutrient_completeness_score: item.nutrient_completeness_score ?? 0,
            nutrient_invalid_codes: item.nutrient_invalid_codes ?? [],
            nutrient_missing_codes: item.nutrient_missing_codes ?? [],
            nutrition_version: item.nutrition_version ?? 1,
            restaurant_id: item.restaurant_id,
            restaurant_name: item.restaurant_id
              ? restaurantNames.get(item.restaurant_id) ?? "Unknown restaurant"
              : "Unknown restaurant",
            correction_status:
              (extended.correction_status as NutritionQueueItem["correction_status"]) ?? null,
            });
          }),
      );
    } catch (error) {
      console.error("Failed to load nutrition quality queue:", error);
      toast.error("Failed to load nutrition quality queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (featureEnabled) void fetchQueue();
    else setLoading(false);
  }, [featureEnabled, fetchQueue]);

  const stats = useMemo(
    () => ({
      total: items.length,
      invalid: items.filter((item) => item.nutrient_invalid_codes.length > 0).length,
      unavailable: items.filter((item) => !item.is_available).length,
      average: items.length
        ? Math.round(
            items.reduce(
              (sum, item) => sum + item.nutrient_completeness_score,
              0,
            ) / items.length,
          )
        : 100,
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "invalid" && item.nutrient_invalid_codes.length > 0) ||
        (filter === "missing" && item.nutrient_missing_codes.length > 0);
      const matchesSearch =
        !query ||
        `${item.meal_name} ${item.restaurant_name}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, items, search]);

  const requestCorrection = async (item: NutritionQueueItem) => {
    setProcessingId(item.meal_id);
    try {
      const submitted = item.correction_status === "submitted";
      const { error } = await (supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message?: string } | null }>)(
        submitted
          ? "resolve_meal_nutrition_correction"
          : "request_meal_nutrition_correction",
        submitted
          ? { p_meal_id: item.meal_id }
          : {
              p_meal_id: item.meal_id,
              p_reason: "Complete or correct every missing or invalid measured nutrient.",
            },
      );
      if (error) throw error;

      setItems((current) =>
        submitted
          ? current.filter((entry) => entry.meal_id !== item.meal_id)
          : current.map((entry) =>
              entry.meal_id === item.meal_id
                ? {
                    ...entry,
                    approval_status: "pending",
                    is_available: false,
                    correction_status: "requested",
                  }
                : entry,
            ),
      );
      toast.success(
        submitted
          ? "Nutrition correction approved"
          : "Correction requested and meal hidden from ordering",
      );
    } catch (error) {
      console.error("Failed to request nutrition correction:", error);
      toast.error("Could not request correction");
    } finally {
      setProcessingId(null);
    }
  };

  if (!featureEnabled) {
    return (
      <AdminLayout title="Nutrition Quality" subtitle="Phase-one nutrition review">
        <div className="rounded-lg border bg-white p-6 text-sm font-semibold text-muted-foreground">
          Nutrition quality review is not enabled for this rollout.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Nutrition Quality"
      subtitle="Review missing and invalid meal nutrition data"
    >
      <div dir={isRTL ? "rtl" : "ltr"} className="space-y-5 bg-[#F6F8FB] p-3 text-[#020617] sm:p-5">
        <AdminWorkbenchHeader
          eyebrow="Catalog integrity"
          title="Nutrition quality queue"
          description="Keep unmeasured nutrients missing, identify invalid values, and return incomplete meals to partners for correction."
          icon={FlaskConical}
          accent="#7C83F6"
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => void fetchQueue()}
              disabled={loading}
              className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617]"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        <AdminKpiStrip
          items={[
            { label: "Needs review", value: stats.total, helper: "Incomplete meals", icon: FlaskConical, accent: "#7C83F6" },
            { label: "Invalid", value: stats.invalid, helper: "Values below zero or malformed", icon: ShieldAlert, accent: "#FB6B7A" },
            { label: "Unavailable", value: stats.unavailable, helper: "Hidden from ordering", icon: AlertTriangle, accent: "#38BDF8" },
            { label: "Average score", value: `${stats.average}%`, helper: "Queue completeness", icon: CheckCircle2, accent: "#22C7A1" },
          ]}
        />

        <NutritionVerificationOperations />

        <SupplierQualityOperations />

        <AdminFilterBar title="Nutrition review">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex rounded-[18px] bg-[#F6F8FB] p-1">
              {(["all", "missing", "invalid"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={cn(
                    "min-h-11 rounded-[14px] px-4 text-sm font-black capitalize",
                    filter === option
                      ? "bg-[#020617] text-white"
                      : "text-[#64748B] hover:bg-white",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search meal or restaurant"
                className="h-11 rounded-full border-[#E5EAF1] bg-[#F6F8FB] pl-11"
              />
            </div>
          </div>
        </AdminFilterBar>

        {loading ? (
          <div className="grid min-h-64 place-items-center rounded-[20px] border border-[#E5EAF1] bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-[#7C83F6]" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#22C7A1]" />
            <h3 className="mt-3 text-lg font-black">Queue is clear</h3>
            <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
              No meals match this review filter.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {filteredItems.map((item) => (
              <article
                key={item.meal_id}
                className="rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(2,6,23,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{item.meal_name}</p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-bold text-[#94A3B8]">
                      <Store className="h-3.5 w-3.5 text-[#38BDF8]" />
                      {item.restaurant_name}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#F6F8FB] px-3 py-1.5 text-xs font-black">
                    {item.nutrient_completeness_score}%
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F6F8FB]">
                  <div
                    className="h-full rounded-full bg-[#7C83F6]"
                    style={{ width: `${item.nutrient_completeness_score}%` }}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  {item.nutrient_missing_codes.length > 0 && (
                    <div className="rounded-[14px] bg-[#FFF8ED] px-3 py-2">
                      <p className="text-[10px] font-black uppercase text-[#F97316]">Missing</p>
                      <p className="mt-1 text-xs font-bold text-[#64748B]">
                        {item.nutrient_missing_codes.map(formatNutrientCode).join(", ")}
                      </p>
                    </div>
                  )}
                  {item.nutrient_invalid_codes.length > 0 && (
                    <div className="rounded-[14px] bg-[#FFF1F3] px-3 py-2">
                      <p className="text-[10px] font-black uppercase text-[#FB6B7A]">Invalid</p>
                      <p className="mt-1 text-xs font-bold text-[#64748B]">
                        {item.nutrient_invalid_codes.map(formatNutrientCode).join(", ")}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E5EAF1] pt-3">
                  <p className="text-[11px] font-bold text-[#94A3B8]">
                    Version {item.nutrition_version} · {item.is_available ? "Live" : "Hidden"}
                  </p>
                  <AdminNutritionCorrectionButton
                    isRTL={isRTL}
                    pending={processingId === item.meal_id}
                    requested={item.correction_status === "requested"}
                    submitted={item.correction_status === "submitted"}
                    onClick={() => void requestCorrection(item)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
