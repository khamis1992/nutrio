import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, CameraSource, CameraResultType } from "@capacitor/camera";
import { isNative } from "@/lib/capacitor";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { getQatarNow } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import {
  Camera as CameraIcon,
  GalleryHorizontal,
  RefreshCw,
  Loader2,
  Check,
  Sparkles,
  X,
  Plus,
  Minus,
  ScanLine,
  Image as ImageIcon,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DetectedFoodItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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
  const { t } = useLanguage();
  const { toast: uiToast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // States: idle → scanning → reviewing → logging → done
  type ViewState = "capture" | "scanning" | "review" | "logging";
  const [view, setView] = useState<ViewState>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedFoodItem[]>([]);
  const [quantities, setQuantities] = useState<Map<number, number>>(new Map());

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

  // ── Log to database ─────────────────────────────────────────────────────

  const handleLogMeals = async () => {
    if (!user) return;
    setView("logging");

    try {
      const today = getQatarNow().toDate().toISOString().split("T")[0];

      // Log each detected item
      for (let i = 0; i < detectedItems.length; i++) {
        const item = detectedItems[i];
        const qty = quantities.get(i) ?? 1;
        const cals = Math.round(item.calories * qty);
        const prot = Math.round(item.protein_g * qty);
        const carb = Math.round(item.carbs_g * qty);
        const fat = Math.round(item.fat_g * qty);

        // Insert into meal_history
        await supabase.from("meal_history").insert({
          user_id: user.id,
          name: item.name,
          calories: cals,
          protein_g: prot,
          carbs_g: carb,
          fat_g: fat,
        });
      }

      // Upsert progress_logs (accumulate macros)
      const { data: existing } = await supabase
        .from("progress_logs")
        .select("id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
        .eq("user_id", user.id)
        .eq("log_date", today)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("progress_logs")
          .update({
            calories_consumed: (existing.calories_consumed ?? 0) + totals.calories,
            protein_consumed_g: (existing.protein_consumed_g ?? 0) + totals.protein,
            carbs_consumed_g: (existing.carbs_consumed_g ?? 0) + totals.carbs,
            fat_consumed_g: (existing.fat_consumed_g ?? 0) + totals.fat,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("progress_logs").insert({
          user_id: user.id,
          log_date: today,
          calories_consumed: totals.calories,
          protein_consumed_g: totals.protein,
          carbs_consumed_g: totals.carbs,
          fat_consumed_g: totals.fat,
        });
      }

      // Award XP and track analytics
      try {
        await supabase.rpc("award_xp_for_meal_log", {
          p_user_id: user.id,
          p_xp_amount: 10 * detectedItems.length,
        });
        trackEvent("xp_earned", { amount: 10 * detectedItems.length, source: "food_photo_log" });
      } catch (xpError) {
        console.warn("Failed to award XP:", xpError);
      }

      try {
        await supabase.rpc("increment_meals_logged", { p_user_id: user.id });
      } catch (counterError) {
        console.warn("Failed to increment meals logged:", counterError);
      }

      trackEvent("meal_logged", {
        source: "food_photo",
        items: detectedItems.length,
        total_calories: totals.calories,
      });

      toast.success(`Logged ${detectedItems.length} food items!`, {
        description: `${totals.calories} cal • ${totals.protein}g protein`,
      });

      onLogComplete?.();
      handleClose();
    } catch (err) {
      console.error("Failed to log meals:", err);
      uiToast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
      setView("review");
    }
  };

  // ── Macro color helpers ─────────────────────────────────────────────────

  const macroBar = (label: string, value: number, color: string) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-gray-400">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(100, (value / Math.max(1, totals.calories)) * 100)}%` }}
        />
      </div>
      <span className="w-10 text-right font-semibold text-gray-700">{value}g</span>
    </div>
  );

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
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <ScanLine className="w-10 h-10 text-emerald-500" />
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
                  className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-emerald-500 text-white font-semibold active:scale-[0.98] transition-transform"
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
                <div className="w-48 h-48 rounded-3xl overflow-hidden shadow-lg border-2 border-emerald-100">
                  <img src={previewUrl} alt="Your meal" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
                <span className="text-gray-500 font-medium">Analyzing your meal...</span>
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
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
                          className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center active:bg-emerald-600"
                        >
                          <Plus className="w-3 h-3 text-white" />
                        </button>
                      </div>

                      {/* Item details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">
                          {Math.round(item.calories * qty)} cal • {Math.round(item.protein_g * qty)}g P • {Math.round(item.carbs_g * qty)}g C • {Math.round(item.fat_g * qty)}g F
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
                    <span className="text-lg font-extrabold text-emerald-600">{totals.calories} cal</span>
                  </div>
                  {macroBar("Protein", totals.protein, "bg-emerald-500")}
                  {macroBar("Carbs", totals.carbs, "bg-amber-400")}
                  {macroBar("Fat", totals.fat, "bg-rose-400")}
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
                    className="flex-1 py-3 rounded-full bg-emerald-500 text-white font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
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
