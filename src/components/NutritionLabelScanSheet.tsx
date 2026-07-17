import { useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import {
  Camera as CameraIcon,
  Check,
  FileScan,
  GalleryHorizontal,
  Loader2,
  RotateCcw,
  ScanText,
} from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/capacitor";
import { logMealItems } from "@/lib/meal-log-service";

interface NutritionLabelScanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogComplete?: () => void;
}

interface NutritionLabelData {
  is_nutrition_label: boolean;
  product_name: string;
  serving_size: string;
  servings_per_container: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  confidence: number;
  notes?: string[];
  note?: string;
}

interface NutritionLabelResponse {
  success?: boolean;
  label?: NutritionLabelData;
  error?: string;
}

type ViewState = "capture" | "scanning" | "review" | "logging";

const emptyLabel: NutritionLabelData = {
  is_nutrition_label: true,
  product_name: "Packaged food",
  serving_size: "1 serving",
  servings_per_container: null,
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  sugar_g: 0,
  sodium_mg: 0,
  confidence: 0,
  notes: [],
};

const numberValue = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

export function NutritionLabelScanSheet({
  open,
  onOpenChange,
  onLogComplete,
}: NutritionLabelScanSheetProps) {
  const { user } = useAuth();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ViewState>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [label, setLabel] = useState<NutritionLabelData>(emptyLabel);
  const [servings, setServings] = useState(1);

  const close = () => {
    setView("capture");
    setPreviewUrl(null);
    setLabel(emptyLabel);
    setServings(1);
    onOpenChange(false);
  };

  const runAnalysis = async (dataUrl: string) => {
    setPreviewUrl(dataUrl);
    setView("scanning");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke("analyze-meal-image", {
        body: { imageUrl: dataUrl, mode: "nutrition_label" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;

      const response = data as NutritionLabelResponse;
      if (!response.success || !response.label?.is_nutrition_label) {
        toast.error("No nutrition label detected", {
          description: response.label?.note || "Try a clearer photo of the Nutrition Facts panel.",
        });
        setView("capture");
        return;
      }

      setLabel({ ...emptyLabel, ...response.label });
      setView("review");
    } catch (error) {
      console.error("Nutrition label scan failed:", error);
      toast.error("Label scan failed", {
        description: "Please try again with a sharper, well-lit label photo.",
      });
      setView("capture");
    }
  };

  const handleTakePhoto = async () => {
    if (!isNative) {
      cameraInputRef.current?.click();
      return;
    }

    try {
      const perms = await Camera.requestPermissions({ permissions: ["camera"] });
      if (perms.camera === "denied") {
        toast.error("Camera permission required");
        return;
      }
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 85,
      });
      if (photo.dataUrl) void runAnalysis(photo.dataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("cancel") && !message.includes("dismiss")) {
        toast.error("Camera unavailable");
      }
    }
  };

  const handlePickFromGallery = async () => {
    if (!isNative) {
      galleryInputRef.current?.click();
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 85,
      });
      if (photo.dataUrl) void runAnalysis(photo.dataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("cancel") && !message.includes("dismiss")) {
        toast.error("Gallery unavailable");
      }
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    const reader = new FileReader();
    reader.onloadend = () => void runAnalysis(reader.result as string);
    reader.readAsDataURL(file);
  };

  const setField = <Key extends keyof NutritionLabelData>(
    key: Key,
    value: NutritionLabelData[Key],
  ) => {
    setLabel((current) => ({ ...current, [key]: value }));
  };

  const totalCalories = Math.round(label.calories * servings);
  const totalProtein = Math.round(label.protein_g * servings);
  const totalCarbs = Math.round(label.carbs_g * servings);
  const totalFat = Math.round(label.fat_g * servings);

  const canLog =
    Boolean(user?.id) &&
    label.product_name.trim().length > 0 &&
    servings > 0 &&
    totalCalories + totalProtein + totalCarbs + totalFat > 0;

  const logLabel = async () => {
    if (!user?.id || !canLog) return;
    setView("logging");
    try {
      await logMealItems({
        userId: user.id,
        source: "nutrition_label_ocr",
        items: [{
          name: label.product_name.trim() || "Packaged food",
          calories: label.calories,
          protein_g: label.protein_g,
          carbs_g: label.carbs_g,
          fat_g: label.fat_g,
          fiber_g: label.fiber_g,
          sugar_g: label.sugar_g,
          sodium_mg: label.sodium_mg,
          quantity: servings,
        }],
      });

      toast.success("Nutrition label logged", {
        description: `${totalCalories} cal from ${servings} serving${servings === 1 ? "" : "s"}`,
      });
      onLogComplete?.();
      close();
    } catch (error) {
      console.error("Failed to log nutrition label:", error);
      toast.error("Failed to save label", { description: "Please review the values and try again." });
      setView("review");
    }
  };

  const nutrientInput = (
    labelText: string,
    value: number,
    key: keyof Pick<
      NutritionLabelData,
      "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_g" | "sodium_mg"
    >,
    suffix: string,
  ) => (
    <label className="space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{labelText}</span>
      <div className="flex h-12 items-center rounded-2xl bg-white px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-slate-950">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={value}
          onChange={(event) => setField(key, numberValue(event.target.value) as never)}
          className="min-w-0 flex-1 bg-transparent text-sm font-extrabold text-slate-950 outline-none"
        />
        <span className="text-[11px] font-bold text-slate-400">{suffix}</span>
      </div>
    </label>
  );

  return (
    <>
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

      <Sheet open={open} onOpenChange={close}>
        <SheetContent
          side="bottom"
          className="h-[92dvh] overflow-hidden rounded-t-3xl bg-white p-0 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Scan nutrition label</SheetTitle>

          {view === "capture" && (
            <div className="flex h-full flex-col items-center justify-center gap-6 px-6 pb-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 ring-1 ring-emerald-100">
                <ScanText className="h-10 w-10 text-[#22C7A1]" />
              </div>
              <div className="max-w-xs text-center">
                <h2 className="text-xl font-extrabold text-slate-950">Scan nutrition label</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Capture the Nutrition Facts panel and Nutrio will read calories, macros, sugar, fiber, and sodium per serving.
                </p>
              </div>
              <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-[#020617] text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(2,6,23,0.16)]"
                >
                  <CameraIcon className="h-7 w-7" />
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={handlePickFromGallery}
                  className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-slate-50 text-sm font-extrabold text-slate-800 ring-1 ring-slate-200"
                >
                  <GalleryHorizontal className="h-7 w-7" />
                  Gallery
                </button>
              </div>
            </div>
          )}

          {view === "scanning" && (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-6">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Nutrition label preview"
                  className="h-52 w-52 rounded-3xl object-cover shadow-lg ring-1 ring-slate-200"
                />
              ) : null}
              <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                <FileScan className="h-5 w-5 text-[#22C7A1]" />
                Reading nutrition facts
                <Loader2 className="h-5 w-5 animate-spin text-slate-950" />
              </div>
            </div>
          )}

          {view === "review" && (
            <div className="flex h-full flex-col">
              <div className="shrink-0 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Scanned label"
                      className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-extrabold text-slate-950">
                      Review label values
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                      Confidence {Math.round((label.confidence || 0) * 100)}% - edit anything before logging.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-5 py-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">Product name</span>
                  <input
                    value={label.product_name}
                    onChange={(event) => setField("product_name", event.target.value)}
                    className="h-12 w-full rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-950"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Serving size</span>
                    <input
                      value={label.serving_size}
                      onChange={(event) => setField("serving_size", event.target.value)}
                      className="h-12 w-full rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-950"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Servings eaten</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.25"
                      step="0.25"
                      value={servings}
                      onChange={(event) => setServings(Math.max(0.25, numberValue(event.target.value)))}
                      className="h-12 w-full rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-950"
                    />
                  </label>
                </div>

                <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      Total to log
                    </span>
                    <span className="text-xl font-black text-slate-950">{totalCalories} cal</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-base font-black text-slate-950">{totalProtein}g</p>
                      <p className="text-[10px] font-bold text-slate-400">Protein</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-base font-black text-slate-950">{totalCarbs}g</p>
                      <p className="text-[10px] font-bold text-slate-400">Carbs</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-base font-black text-slate-950">{totalFat}g</p>
                      <p className="text-[10px] font-bold text-slate-400">Fat</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {nutrientInput("Calories", label.calories, "calories", "cal")}
                  {nutrientInput("Protein", label.protein_g, "protein_g", "g")}
                  {nutrientInput("Carbs", label.carbs_g, "carbs_g", "g")}
                  {nutrientInput("Fat", label.fat_g, "fat_g", "g")}
                  {nutrientInput("Fiber", label.fiber_g, "fiber_g", "g")}
                  {nutrientInput("Sugar", label.sugar_g, "sugar_g", "g")}
                  {nutrientInput("Sodium", label.sodium_mg, "sodium_mg", "mg")}
                </div>

                {label.notes?.length ? (
                  <div className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-700 ring-1 ring-amber-100">
                    {label.notes.join(" ")}
                  </div>
                ) : null}
              </div>

              <div className="grid shrink-0 grid-cols-[0.9fr_1.1fr] gap-3 border-t border-slate-100 bg-white px-5 pb-6 pt-4">
                <button
                  type="button"
                  onClick={() => setView("capture")}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-slate-100 text-sm font-extrabold text-slate-600"
                >
                  <RotateCcw className="h-4 w-4" />
                  Rescan
                </button>
                <button
                  type="button"
                  onClick={logLabel}
                  disabled={!canLog}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#020617] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(2,6,23,0.16)] disabled:bg-slate-300"
                >
                  <Check className="h-4 w-4" />
                  Log label
                </button>
              </div>
            </div>
          )}

          {view === "logging" && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Loader2 className="h-9 w-9 animate-spin text-slate-950" />
              <p className="text-sm font-bold text-slate-500">Saving label...</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default NutritionLabelScanSheet;
