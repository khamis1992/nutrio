import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ScanLine, Plus, Utensils, Camera, Barcode, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BarcodeScanner, type ScannedProduct } from "./BarcodeScanner";
import { FoodPhotoLogSheet } from "./FoodPhotoLogSheet";

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url?: string;
  logged_at?: string;
}

interface LogMealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMealLogged: () => void;
}

const LogMealModal = ({ open, onOpenChange, onMealLogged }: LogMealModalProps) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [recentItems, setRecentItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<FoodItem[]>([]);
  const [tab, setTab] = useState<"Recent">("Recent");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showScanChoice, setShowScanChoice] = useState(false);

  const handleBarcodeScanned = (product: ScannedProduct) => {
    const item: FoodItem = {
      id: `barcode-${product.barcode}-${Date.now()}`,
      name: product.name,
      calories: product.calories ?? 0,
      protein_g: product.protein_g ?? 0,
      carbs_g: product.carbs_g ?? 0,
      fat_g: product.fat_g ?? 0,
    };
    setSelectedItems((prev) => [...prev, item]);
    toast.success("Product found!", { description: product.name });
  };

  // Load recent meals
  const loadRecentMeals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("meal_history")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(20);

      setRecentItems(data || []);
    } catch (error) {
      console.error("Failed to load recent meals:", error);
      toast.error(t("failed_to_load_recent_meals"));
    } finally {
      setLoading(false);
    }
  }, [user?.id, t]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedItems([]);
      setShowScanChoice(false);
      loadRecentMeals();
    }
  }, [open, loadRecentMeals]);

  // Toggle item selection
  const toggleItem = (item: FoodItem) => {
    setSelectedItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  };

  // Handle "Select items to add"
  const handleAddSelected = async () => {
    if (selectedItems.length === 0) return;
    setLoading(true);
    try {
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      // Update progress_logs
      const { data: existingProgress } = await supabase
        .from("progress_logs")
        .select("id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
        .eq("user_id", user?.id)
        .eq("log_date", today)
        .maybeSingle();

      const totalCalories = selectedItems.reduce((sum, item) => sum + item.calories, 0);
      const totalProtein = selectedItems.reduce((sum, item) => sum + item.protein_g, 0);
      const totalCarbs = selectedItems.reduce((sum, item) => sum + item.carbs_g, 0);
      const totalFat = selectedItems.reduce((sum, item) => sum + item.fat_g, 0);

      if (existingProgress) {
        await supabase
          .from("progress_logs")
          .update({
            calories_consumed: existingProgress.calories_consumed + totalCalories,
            protein_consumed_g: existingProgress.protein_consumed_g + totalProtein,
            carbs_consumed_g: existingProgress.carbs_consumed_g + totalCarbs,
            fat_consumed_g: existingProgress.fat_consumed_g + totalFat,
          })
          .eq("id", existingProgress.id);
      } else {
        await supabase
          .from("progress_logs")
          .insert({
            user_id: user?.id,
            log_date: today,
            calories_consumed: totalCalories,
            protein_consumed_g: totalProtein,
            carbs_consumed_g: totalCarbs,
            fat_consumed_g: totalFat,
          });
      }

      // Add to meal_history
      await supabase.from("meal_history").insert(
        selectedItems.map((item) => ({
          user_id: user?.id,
          name: item.name,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          image_url: item.image_url,
        }))
      );

      toast.success(t("meal_logged"));
      onMealLogged();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to log meal:", error);
      toast.error(t("failed_to_log_meal"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent hideCloseButton className="w-full max-w-full max-h-[85dvh] rounded-3xl bg-white flex flex-col p-0 overflow-hidden">
          <DialogTitle className="sr-only">{t("log_meal_title")}</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0 ring-1 ring-slate-100">
                <Utensils className="w-5 h-5 text-[#020617]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{t("log_meal_title")}</h2>
                <p className="text-xs text-gray-500 leading-tight">{t("search_or_choose_food")}</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Search and scan bar */}
          <div className="flex items-center gap-2 px-4 pb-3 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search food..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-3 rounded-xl h-11 bg-gray-100 border-0 focus-visible:ring-1 focus-visible:ring-gray-300 text-sm"
              />
            </div>
            <button
              onClick={() => setShowScanChoice(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#020617] px-3 py-2.5 text-white shadow-[0_8px_18px_rgba(2,6,23,0.14)] transition-colors hover:bg-slate-800 text-sm font-semibold shrink-0"
              aria-label="Scan Food"
            >
              <ScanLine className="w-4 h-4" />
              Scan
            </button>
          </div>

          {/* Recent meals list */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900 text-sm">{t("recently_logged")}</p>
              <button className="text-xs font-semibold text-[#020617]">{t("view_all_small")}</button>
            </div>
            <div className="space-y-2">
              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-4 border-[#020617] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recentItems.length === 0 ? (
                <p className="text-center py-6 text-gray-400 text-sm">No recent meals found.</p>
              ) : (
                recentItems.map((item) => {
                  const isSelected = selectedItems.some((i) => i.id === item.id);
                  const loggedDate = item.logged_at
                    ? new Date(item.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "";
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border bg-white shadow-sm transition-colors cursor-pointer select-none ${
                        isSelected ? "border-slate-950 bg-slate-50" : "border-gray-200"
                      }`}
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xl">🍽️</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 leading-tight truncate text-sm">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.calories} cal · {Math.round(item.protein_g + item.carbs_g + item.fat_g)}g
                        </p>
                        <p className="text-xs text-gray-400">{loggedDate}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                          {item.calories}
                        </div>
                        {isSelected && <Plus className="w-4 h-4 text-[#020617]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Can't find your food section */}
            <div className="mt-4 mb-2 p-3 rounded-2xl bg-slate-50 flex items-center justify-between ring-1 ring-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#020617] flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xs">i</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-950 text-sm">{t("cant_find_food")}</p>
                  <p className="text-xs text-slate-500">{t("use_scan_food")}</p>
                </div>
              </div>
              <button onClick={() => setShowScanChoice(true)} className="text-[#020617] font-semibold text-sm">→</button>
            </div>
          </div>

          {/* Bottom button */}
          <div className="px-4 pb-4 pt-2 shrink-0 border-t border-gray-100">
            <Button
              className="w-full rounded-full bg-[#020617] text-white h-12 text-sm font-semibold shadow-[0_10px_22px_rgba(2,6,23,0.16)] hover:bg-slate-800 disabled:bg-slate-300 disabled:text-white disabled:shadow-none"
              onClick={handleAddSelected}
              disabled={selectedItems.length === 0 || loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Add {selectedItems.length > 0 ? `${selectedItems.length} item${selectedItems.length > 1 ? "s" : ""}` : "selected items"}
                </>
              )}
            </Button>
          </div>

          {/* Scan Food Choice Sheet */}
          {showScanChoice && (
            <div className="fixed inset-0 z-[9999] flex flex-col justify-end pointer-events-auto">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowScanChoice(false)}
                aria-label="Close scan method"
              />
              <div className="relative z-10 max-h-[78dvh] overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+96px)] shadow-[0_-18px_45px_rgba(15,23,42,0.16)] ring-1 ring-slate-100 space-y-3">
                <div className="flex justify-center mb-2">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>
                <h3 className="text-center text-base font-bold text-gray-900 mb-4">{t("choose_scan_method")}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowScanChoice(false);
                    setShowBarcodeScanner(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-left ring-1 ring-slate-100"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 ring-1 ring-slate-200">
                    <Barcode className="w-6 h-6 text-[#020617]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{t("scan_barcode")}</p>
                    <p className="text-sm text-gray-500">{t("scan_barcode_desc")}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowScanChoice(false);
                    setShowPhotoSheet(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-left ring-1 ring-slate-100"
                >
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0 ring-1 ring-orange-100">
                    <Camera className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{t("photo_analysis")}</p>
                    <p className="text-sm text-gray-500">{t("photo_analysis_desc")}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setShowScanChoice(false)}
                  className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
      />

      <FoodPhotoLogSheet
        open={showPhotoSheet}
        onOpenChange={setShowPhotoSheet}
        onLogComplete={() => {
          setShowPhotoSheet(false);
          onMealLogged();
          onOpenChange(false);
        }}
      />
    </>
  );
};

export default LogMealModal;
