import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, CameraSource, CameraResultType } from "@capacitor/camera";
import { isNative } from "@/lib/capacitor";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { logMealItems } from "@/lib/meal-log-service";
import { calculateMealImpact, type MacroValues } from "@/lib/meal-impact-preview";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import {
  Camera as CameraIcon,
  GalleryHorizontal,
  Loader2,
  Check,
  Sparkles,
  X,
  Plus,
  Minus,
  ScanLine,
  Flame,
  Drumstick,
  Wheat,
  Droplets,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DetectedFoodItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  estimated_grams?: number;
  confidence?: number;
  source?: "ai_estimate" | "ai_usda_cross_checked" | "usda_fallback" | "gulf_db_verified";
  ranges?: {
    calories: NutritionEstimateRange;
    protein_g: NutritionEstimateRange;
    carbs_g: NutritionEstimateRange;
    fat_g: NutritionEstimateRange;
  };
  usda_cross_check?: {
    status: "matched" | "unavailable" | "no_match";
    fdc_id?: number;
    description?: string;
    data_type?: string;
    match_confidence?: number;
  };
  gulf_match?: {
    dish_id: string;
    name_en: string;
    name_ar: string;
    match_confidence: number;
    data_source: string;
  };
}

interface NutritionEstimateRange {
  min: number;
  max: number;
}

interface AnalyzeFoodResponse {
  success?: boolean;
  detectedItems?: DetectedFoodItem[];
  note?: string;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface FoodPhotoLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogComplete?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FoodPhotoLogSheet({ open, onOpenChange, onLogComplete }: FoodPhotoLogSheetProps) {
  const { user } = useAuth();
  const { toast: uiToast } = useToast();
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // States: idle → scanning → reviewing → logging → done
  type ViewState = "capture" | "scanning" | "review" | "logging";
  const [view, setView] = useState<ViewState>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedFoodItem[]>([]);
  const [quantities, setQuantities] = useState<Map<number, number>>(new Map());
  const shouldLoadDailyImpact = open && view === "review";
  const {
    todayProgress,
    loading: todayProgressLoading,
    error: todayProgressError,
  } = useTodayProgress(shouldLoadDailyImpact ? user?.id : undefined, new Date(), 0);
  const {
    data: dailyTargets,
    isLoading: dailyTargetsLoading,
    error: dailyTargetsError,
  } = useQuery<MacroValues | null>({
    queryKey: ["food-photo-daily-targets", user?.id],
    enabled: shouldLoadDailyImpact && !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: goal, error: goalError } = await supabase
        .from("nutrition_goals")
        .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (goalError) throw goalError;

      const { data: profile, error: profileError } = goal
        ? { data: null, error: null }
        : await supabase
            .from("profiles")
            .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g")
            .eq("user_id", user!.id)
            .maybeSingle();

      if (profileError) throw profileError;
      const source = goal || profile;
      if (!source) return null;

      const targets = {
        calories: Number(source.daily_calorie_target || 0),
        protein: Number(source.protein_target_g || 0),
        carbs: Number(source.carbs_target_g || 0),
        fat: Number(source.fat_target_g || 0),
      };

      return Object.values(targets).some((value) => value > 0) ? targets : null;
    },
  });

  // ── Reset state on open ─────────────────────────────────────────────────

  const handleClose = () => {
    setView("capture");
    setPreviewUrl(null);
    setDetectedItems([]);
    setQuantities(new Map());
    onOpenChange(false);
  };

  // ── Camera capture (native or web fallback) ─────────────────────────────

  const handleTakePhoto = async () => {
    if (isNative) {
      try {
        const perms = await Camera.requestPermissions({ permissions: ["camera"] });
        if (perms.camera === "denied") {
          toast.error("Camera permission required", {
            description: "Please allow camera access in your device settings.",
          });
          return;
        }
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          quality: 80,
        });
        if (photo.dataUrl) runAnalysis(photo.dataUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("dismiss")) {
          toast.error("Camera unavailable", { description: "Could not open camera. Please try again." });
        }
      }
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handlePickFromGallery = async () => {
    if (isNative) {
      try {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          quality: 80,
        });
        if (photo.dataUrl) runAnalysis(photo.dataUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("dismiss")) {
          toast.error("Gallery unavailable", { description: "Could not open photo library." });
        }
      }
    } else {
      galleryInputRef.current?.click();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onloadend = () => runAnalysis(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── AI Analysis ─────────────────────────────────────────────────────────

  const runAnalysis = async (dataUrl: string) => {
    setPreviewUrl(dataUrl);
    setView("scanning");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke("analyze-meal-image", {
        body: { imageUrl: dataUrl, mode: "quick_scan" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;

      const response = data as AnalyzeFoodResponse;
      if (response?.success && response?.detectedItems?.length) {
        setDetectedItems(response.detectedItems);
        setQuantities(new Map(response.detectedItems.map((_, i) => [i, 1])));
        setView("review");
      } else {
        toast.error("Nothing detected", {
          description: response?.note || "Try a clearer photo or log manually.",
        });
        setView("capture");
      }
    } catch {
      toast.error("Analysis failed", { description: "Please try again or enter manually." });
      setView("capture");
    }
  };

  // ── Quantity helpers ────────────────────────────────────────────────────

  const adjustQuantity = (idx: number, delta: number) => {
    setQuantities((prev) => {
      const next = new Map(prev);
      const current = next.get(idx) ?? 1;
      next.set(idx, Math.max(0.5, Number((current + delta).toFixed(1))));
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setDetectedItems((prev) => prev.filter((_, i) => i !== idx));
    setQuantities((prev) => {
      const next = new Map(prev);
      next.delete(idx);
      // Re-index remaining items
      const reindexed = new Map<number, number>();
      let newIdx = 0;
      for (const [, qty] of next) {
        reindexed.set(newIdx++, qty);
      }
      return reindexed;
    });
  };

  // ── Total macros ────────────────────────────────────────────────────────

  const totals = detectedItems.reduce(
    (acc, item, i) => {
      const qty = quantities.get(i) ?? 1;
      return {
        calories: acc.calories + Math.round(item.calories * qty),
        protein: acc.protein + Math.round(item.protein_g * qty),
        carbs: acc.carbs + Math.round(item.carbs_g * qty),
        fat: acc.fat + Math.round(item.fat_g * qty),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const dailyImpact = dailyTargets
    ? calculateMealImpact(
        {
          calories: todayProgress.calories,
          protein: todayProgress.protein,
          carbs: todayProgress.carbs,
          fat: todayProgress.fat,
        },
        totals,
        dailyTargets,
      )
    : null;

  const totalRanges = detectedItems.reduce(
    (acc, item, i) => {
      const qty = quantities.get(i) ?? 1;
      return {
        caloriesMin: acc.caloriesMin + (item.ranges?.calories.min ?? item.calories) * qty,
        caloriesMax: acc.caloriesMax + (item.ranges?.calories.max ?? item.calories) * qty,
      };
    },
    { caloriesMin: 0, caloriesMax: 0 },
  );

  const confidenceLabel = (confidence = 0) => {
    if (confidence >= 0.8) return "High confidence";
    if (confidence >= 0.6) return "Medium confidence";
    return "Low confidence";
  };

  const scaledRange = (
    range: NutritionEstimateRange | undefined,
    value: number,
    qty: number,
  ) => {
    const minimum = Math.round((range?.min ?? value) * qty);
    const maximum = Math.round((range?.max ?? value) * qty);
    return minimum === maximum ? `${minimum}` : `${minimum}–${maximum}`;
  };

  // ── Log to database ─────────────────────────────────────────────────────

  const handleLogMeals = async () => {
    if (!user) return;
    setView("logging");

    try {
      await logMealItems({
        userId: user.id,
        source: "food_photo",
        track: trackEvent,
        items: detectedItems.map((item, index) => ({
          name: item.name,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          quantity: quantities.get(index) ?? 1,
        })),
      });

      toast.success(`Logged ${detectedItems.length} food items!`, {
        description: `${totals.calories} cal • ${totals.protein}g protein`,
      });

      void queryClient.invalidateQueries({ queryKey: ["todayProgress", user.id] });
      onLogComplete?.();
      handleClose();
    } catch (err) {
      console.error("Failed to log meals:", err);
      uiToast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
      setView("review");
    }
  };

  // ── Macro color helpers ─────────────────────────────────────────────────

  const impactRows = (dailyImpact ? [
    { key: "calories" as const, label: "Calories", unit: "kcal", color: "#22C7A1", Icon: Flame },
    { key: "protein" as const, label: "Protein", unit: "g", color: "#7C83F6", Icon: Drumstick },
    { key: "carbs" as const, label: "Carbs", unit: "g", color: "#38BDF8", Icon: Wheat },
    { key: "fat" as const, label: "Fat", unit: "g", color: "#FB6B7A", Icon: Droplets },
  ] : []).filter(({ key }) => dailyImpact && dailyImpact[key].target > 0);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden file inputs for web fallback */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />

      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="bottom"
          className="h-[92vh] p-0 rounded-t-3xl overflow-hidden flex flex-col bg-white [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Snap & Log</SheetTitle>

          {/* ── Handle bar ── */}
          <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>

          {/* ── CAPTURE VIEW ── */}
          {view === "capture" && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 gap-6">
              <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center ring-1 ring-slate-100">
                <ScanLine className="w-10 h-10 text-[#020617]" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Snap & Log</h2>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                  Take a photo of your meal and we'll identify the food, estimate portions, and log macros instantly.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <button
                  onClick={handleTakePhoto}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-[#020617] text-white font-semibold shadow-[0_12px_26px_rgba(2,6,23,0.16)] active:scale-[0.98] transition-transform"
                >
                  <CameraIcon className="w-7 h-7" />
                  <span className="text-sm">Take Photo</span>
                </button>
                <button
                  onClick={handlePickFromGallery}
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-gray-50 border border-gray-100 text-gray-700 font-semibold active:scale-[0.98] transition-transform"
                >
                  <GalleryHorizontal className="w-7 h-7" />
                  <span className="text-sm">Gallery</span>
                </button>
              </div>
            </div>
          )}

          {/* ── SCANNING VIEW ── */}
          {view === "scanning" && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
              {previewUrl && (
                <div className="w-48 h-48 rounded-3xl overflow-hidden shadow-lg border-2 border-slate-100">
                  <img src={previewUrl} alt="Your meal" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#020617] animate-pulse" />
                <span className="text-gray-500 font-medium">Analyzing your meal...</span>
                <Loader2 className="w-5 h-5 text-[#020617] animate-spin" />
              </div>
              <p className="text-xs text-gray-300">Identifying food items and estimating macros</p>
            </div>
          )}

          {/* ── REVIEW VIEW ── */}
          {view === "review" && (
            <div className="flex-1 flex flex-col">
              {/* Preview + header */}
              <div className="flex-shrink-0 px-5 pt-2 pb-3">
                <div className="flex items-center gap-4">
                  {previewUrl && (
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                      <img src={previewUrl} alt="Meal" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {detectedItems.length} {detectedItems.length === 1 ? "item" : "items"} detected
                    </h3>
                    <p className="text-sm text-gray-400">Adjust quantities or remove items below</p>
                  </div>
                </div>
              </div>

              {/* Detected items list */}
              <div className="flex-1 overflow-y-auto px-5 space-y-2 pb-2">
                {detectedItems.map((item, i) => {
                  const qty = quantities.get(i) ?? 1;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      {/* Quantity control */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => adjustQuantity(i, -0.5)}
                          className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center active:bg-gray-100"
                        >
                          <Minus className="w-3 h-3 text-gray-500" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-gray-900">
                          {qty}x
                        </span>
                        <button
                          onClick={() => adjustQuantity(i, 0.5)}
                          className="w-7 h-7 rounded-full bg-[#020617] flex items-center justify-center active:bg-slate-800"
                        >
                          <Plus className="w-3 h-3 text-white" />
                        </button>
                      </div>

                      {/* Item details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                          {typeof item.confidence === "number" && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {confidenceLabel(item.confidence)} {Math.round(item.confidence * 100)}%
                            </span>
                          )}
                          {item.source === "gulf_db_verified" && item.gulf_match && (
                            <span
                              className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                              title={`Verified Gulf dish reference: ${item.gulf_match.name_en}`}
                            >
                              ✓ {item.gulf_match.name_ar} · Gulf verified
                            </span>
                          )}
                          {item.usda_cross_check?.status === "matched" && (
                            <span
                              className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                              title={item.usda_cross_check.description}
                            >
                              USDA FoodData Central {item.source === "usda_fallback" ? "fallback" : "checked"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {Math.round(item.calories * qty)} cal • {Math.round(item.protein_g * qty)}g P • {Math.round(item.carbs_g * qty)}g C • {Math.round(item.fat_g * qty)}g F
                        </p>
                        <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                          Estimated range: {scaledRange(item.ranges?.calories, item.calories, qty)} cal
                          {" • "}{scaledRange(item.ranges?.protein_g, item.protein_g, qty)}g P
                          {" • "}{scaledRange(item.ranges?.carbs_g, item.carbs_g, qty)}g C
                          {" • "}{scaledRange(item.ranges?.fat_g, item.fat_g, qty)}g F
                        </p>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeItem(i)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Bottom: totals + log button */}
              <div className="flex-shrink-0 px-5 pt-3 pb-6 space-y-3 border-t border-gray-50">
                {/* Macro totals */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Total</span>
                    <div className="text-right">
                      <span className="block text-lg font-extrabold text-[#020617]">{totals.calories} cal</span>
                      <span className="block text-[10px] font-medium text-gray-400">
                        estimated {Math.round(totalRanges.caloriesMin)}–{Math.round(totalRanges.caloriesMax)} cal
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-[#F6F8FB] p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                        <Sparkles className="h-4 w-4 text-[#22C7A1]" />
                      </span>
                      <div>
                        <p className="text-[13px] font-extrabold text-[#020617]">If you log this</p>
                        <p className="text-[10px] font-medium text-[#94A3B8]">Your projected daily totals</p>
                      </div>
                    </div>

                    {(todayProgressLoading || dailyTargetsLoading) && (
                      <div className="mt-3 flex h-20 items-center justify-center rounded-xl bg-white">
                        <Loader2 className="h-5 w-5 animate-spin text-[#22C7A1]" />
                        <span className="ml-2 text-xs font-semibold text-[#64748B]">Calculating your day...</span>
                      </div>
                    )}

                    {!todayProgressLoading && !dailyTargetsLoading && dailyImpact && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {impactRows.map(({ key, label, unit, color, Icon }) => {
                          const impact = dailyImpact[key];
                          const isOver = impact.exceededBy > 0;
                          return (
                            <div key={key} className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/80">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                                  <span className="text-[10px] font-bold text-[#64748B]">{label}</span>
                                </div>
                                <span className="text-[9px] font-extrabold" style={{ color }}>+{impact.addition}{unit}</span>
                              </div>
                              <p className="mt-1 text-[13px] font-black tabular-nums text-[#020617]">
                                {impact.projected.toLocaleString()}
                                <span className="text-[9px] font-bold text-[#94A3B8]"> / {impact.target.toLocaleString()}{unit}</span>
                              </p>
                              <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <span
                                  className="absolute inset-y-0 left-0 rounded-full opacity-35"
                                  style={{ width: `${impact.currentPercent}%`, backgroundColor: color }}
                                />
                                <span
                                  className="absolute inset-y-0 rounded-full transition-all duration-300"
                                  style={{ left: `${impact.currentPercent}%`, width: `${impact.additionPercent}%`, backgroundColor: color }}
                                />
                              </div>
                              <p className={`mt-1 text-[9px] font-bold ${isOver ? "text-[#FB6B7A]" : "text-[#64748B]"}`}>
                                {isOver ? `${impact.exceededBy}${unit} over` : `${impact.remaining}${unit} left`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!todayProgressLoading && !dailyTargetsLoading && !dailyImpact && (
                      <p className="mt-3 rounded-xl bg-white px-3 py-2.5 text-[11px] font-semibold leading-4 text-[#64748B] ring-1 ring-slate-200/80">
                        {todayProgressError || dailyTargetsError
                          ? "Daily totals are unavailable. You can still log this meal."
                          : "Set a nutrition goal to compare this meal with your daily targets."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setView("capture")}
                    className="flex-1 py-3 rounded-full border-2 border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Retake
                  </button>
                  <button
                    onClick={handleLogMeals}
                    disabled={detectedItems.length === 0}
                    className="flex-1 py-3 rounded-full bg-[#020617] text-white font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Log {detectedItems.length} items
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── LOGGING VIEW (brief) ── */}
          {view === "logging" && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center ring-1 ring-slate-100">
                <Loader2 className="w-8 h-8 text-[#020617] animate-spin" />
              </div>
              <p className="text-gray-500 font-medium">Saving to your log...</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default FoodPhotoLogSheet;
