import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Search, Plus, Check, ChevronRight,
  X, Zap, Pencil, ScanLine, Flame, Wheat, Droplets, Beef, Trash2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: "meal" | "history";
  scheduleId?: string;
  image_url?: string;
  logged_at?: string;
}

interface SelectedItem extends FoodItem {
  quantity: number;
}

type Tab = "Recent" | "Scan";

function formatRecency(loggedAt: string | undefined): string {
  if (!loggedAt) return "";
  const d = new Date(loggedAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const logDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24 && logDate.getTime() === today.getTime()) return `${diffHours}h ago`;
  if (logDate.getTime() === today.getTime()) return "Today";
  if (logDate.getTime() === yesterday.getTime()) return "Yesterday";
  if (diffMs < 7 * 24 * 3600000) return `${Math.floor(diffMs / 86400000)}d ago`;
  return d.toLocaleDateString();
}

interface LogMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onMealLogged: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function LogMealDialog({ open, onOpenChange, userId, onMealLogged }: LogMealDialogProps) {
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("Recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [recentItems, setRecentItems] = useState<FoodItem[]>([]);
  const [scheduledItems, setScheduledItems] = useState<FoodItem[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [logging, setLogging] = useState(false);

  // Quick Log / Create Food view
  const [view, setView] = useState<"main" | "quicklog" | "createfood" | "detail">("main");
  const [quickEntry, setQuickEntry] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });

  // Food detail view
  const [detailItem, setDetailItem] = useState<FoodItem | null>(null);
  const [detailQty, setDetailQty] = useState(1);

  // AI scan
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [scanResults, setScanResults] = useState<FoodItem[]>([]);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);


  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setView("main");
      setSearchQuery("");
      setSearchResults([]);
      setSelected(new Map());
      setTab("Recent");
      setScanResults([]);
      setScanPreviewUrl(null);
      loadRecent();
      loadScheduled();
    }
  }, [open, userId]);

  // ── Load recent meals ──────────────────────────────────────────────────────
  const loadRecent = async () => {
    if (!userId) return;
    setLoadingRecent(true);
    try {
      const { data } = await supabase
        .from("meal_history")
        .select("id, name, calories, protein_g, carbs_g, fat_g, logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(20);

      setRecentItems(
        (data || [])
          .filter((d) => d.calories > 0 && d.name && !d.name.startsWith("Meal (0"))
          .map((d) => ({ ...d, source: "history" as const, logged_at: d.logged_at }))
      );
    } finally {
      setLoadingRecent(false);
    }
  };

  // ── Load today's scheduled meals ───────────────────────────────────────────
  const loadScheduled = async () => {
    if (!userId) return;
    setLoadingScheduled(true);
    const today = new Date().toISOString().split("T")[0];
    try {
      const { data } = await supabase
        .from("meal_schedules")
        .select("id, meal_type, meals(id, name, calories, protein_g, carbs_g, fat_g, image_url)")
        .eq("user_id", userId)
        .eq("scheduled_date", today)
        .not("is_completed", "eq", true)
        .order("meal_type");

      setScheduledItems(
        (data || [])
          .filter((s: any) => s.meals)
          .map((s: any) => ({
            id: s.meals.id,
            name: s.meals.name,
            calories: s.meals.calories,
            protein_g: s.meals.protein_g,
            carbs_g: s.meals.carbs_g,
            fat_g: s.meals.fat_g,
            image_url: s.meals.image_url ?? undefined,
            source: "meal" as const,
            scheduleId: s.id,
          }))
      );
    } finally {
      setLoadingScheduled(false);
    }
  };

  // ── Delete from recent history ────────────────────────────────────────────
  const deleteRecentItem = async (item: FoodItem) => {
    // Optimistically remove from UI
    setRecentItems((prev) => prev.filter((r) => r.id !== item.id));
    // Also remove from selection if selected
    setSelected((prev) => { const next = new Map(prev); next.delete(item.id); return next; });
    // Delete from DB (history entries use uuid id)
    if (item.source === "history") {
      await supabase.from("meal_history").delete().eq("id", item.id);
    }
  };

  // ── Search meals ───────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from("meals")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url")
        .eq("is_available", true)
        .ilike("name", `%${q}%`)
        .limit(15);

      setSearchResults(
        (data || []).map((d) => ({ ...d, source: "meal" as const }))
      );
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  // ── Select / deselect items ────────────────────────────────────────────────
  const toggleItem = (item: FoodItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        // If it was a scheduled item, bring it back
        if (item.scheduleId) {
          setScheduledItems((s) =>
            s.find((x) => x.id === item.id) ? s : [...s, item]
          );
        }
      } else {
        next.set(item.id, { ...item, quantity: 1 });
        // Immediately hide from schedule section (optimistic)
        if (item.scheduleId) {
          setScheduledItems((s) => s.filter((x) => x.id !== item.id));
        }
      }
      return next;
    });
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalCal = Array.from(selected.values()).reduce((s, i) => s + i.calories * i.quantity, 0);
  const totalProtein = Array.from(selected.values()).reduce((s, i) => s + i.protein_g * i.quantity, 0);
  const totalCarbs = Array.from(selected.values()).reduce((s, i) => s + i.carbs_g * i.quantity, 0);
  const totalFat = Array.from(selected.values()).reduce((s, i) => s + i.fat_g * i.quantity, 0);

  // ── Save to progress_logs + meal_history ───────────────────────────────────
  const logMeal = async (
    name: string, calories: number, protein: number, carbs: number, fat: number, saveToHistory = true
  ) => {
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("progress_logs")
      .select("id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
      .eq("user_id", userId)
      .eq("log_date", today)
      .maybeSingle();

    if (existing) {
      await supabase.from("progress_logs").update({
        calories_consumed: (existing.calories_consumed || 0) + calories,
        protein_consumed_g: (existing.protein_consumed_g || 0) + protein,
        carbs_consumed_g: (existing.carbs_consumed_g || 0) + carbs,
        fat_consumed_g: (existing.fat_consumed_g || 0) + fat,
      }).eq("id", existing.id);
    } else {
      await supabase.from("progress_logs").insert({
        user_id: userId, log_date: today,
        calories_consumed: calories,
        protein_consumed_g: protein,
        carbs_consumed_g: carbs,
        fat_consumed_g: fat,
      });
    }

    if (saveToHistory && calories > 0) {
      await supabase.from("meal_history").insert({
        user_id: userId,
        name: name || `Meal (${calories} cal)`,
        calories, protein_g: protein, carbs_g: carbs, fat_g: fat,
      });
    }
  };

  // ── Add selected items ─────────────────────────────────────────────────────
  const handleAddSelected = async () => {
    if (selected.size === 0) return;
    setLogging(true);
    try {
      const scheduleIdsToComplete: string[] = [];

      for (const item of selected.values()) {
        await logMeal(
          item.name,
          Math.round(item.calories * item.quantity),
          Math.round(item.protein_g * item.quantity),
          Math.round(item.carbs_g * item.quantity),
          Math.round(item.fat_g * item.quantity),
          item.source === "meal",
        );
        if (item.scheduleId) scheduleIdsToComplete.push(item.scheduleId);
      }

      // Mark scheduled meals as completed so they disappear from the list
      if (scheduleIdsToComplete.length > 0) {
        await supabase
          .from("meal_schedules")
          .update({ is_completed: true, completed_at: new Date().toISOString() })
          .in("id", scheduleIdsToComplete);

        // Remove them from local state immediately
        setScheduledItems((prev) =>
          prev.filter((s) => !scheduleIdsToComplete.includes(s.scheduleId ?? ""))
        );
      }

      toast({ title: "Meal logged!", description: `Added ${Math.round(totalCal)} cal to today.` });
      onMealLogged();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to log meal.", variant: "destructive" });
    } finally {
      setLogging(false);
    }
  };

  // ── Quick Log submit ───────────────────────────────────────────────────────
  const handleQuickLog = async () => {
    const cal = parseInt(quickEntry.calories) || 0;
    if (cal === 0) {
      toast({ title: "Enter calories", description: "At least calories are required.", variant: "destructive" });
      return;
    }
    setLogging(true);
    try {
      await logMeal(
        quickEntry.name || "Quick Log",
        cal,
        parseInt(quickEntry.protein) || 0,
        parseInt(quickEntry.carbs) || 0,
        parseInt(quickEntry.fat) || 0,
      );
      toast({ title: "Logged!", description: `Added ${cal} cal to today.` });
      onMealLogged();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to log.", variant: "destructive" });
    } finally {
      setLogging(false);
    }
  };

  // ── AI scan ────────────────────────────────────────────────────────────────
  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";
    const reader = new FileReader();
    reader.onloadend = async () => {
      setScanning(true);
      setScanResults([]);
      setScanPreviewUrl(reader.result as string);
      setTab("Scan");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const { data, error } = await supabase.functions.invoke("analyze-meal-image", {
          body: { imageUrl: reader.result, mode: "quick_scan" },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (error) throw error;
        if (data?.success && data?.detectedItems?.length > 0) {
          const items: FoodItem[] = data.detectedItems.map((item: any, i: number) => ({
            id: `scan-${Date.now()}-${i}`,
            name: item.name,
            calories: item.calories,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
            source: "meal" as const,
          }));
          setScanResults(items);
          // Auto-select all detected items
          const newSelected = new Map(selected);
          items.forEach((item) => newSelected.set(item.id, { ...item, quantity: 1 }));
          setSelected(newSelected);
        } else {
          toast({ title: "Nothing detected", description: "Try a clearer photo or log manually.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Scan failed", description: "Try again or enter manually.", variant: "destructive" });
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Items to show — deduplicate scheduled meals from recent list ───────────
  const scheduledIds = new Set(scheduledItems.map((s) => s.id));
  const listItems: FoodItem[] = searchQuery.trim()
    ? searchResults
    : tab === "Recent"
      ? recentItems.filter((r) => !scheduledIds.has(r.id))
      : [];

  const isLoading = searchQuery.trim() ? searching : (tab === "Recent" && loadingRecent);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const gramsDisplay = (item: FoodItem) =>
    Math.round(item.protein_g + item.carbs_g + item.fat_g);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[95vh] p-0 rounded-t-3xl overflow-hidden flex flex-col bg-white [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Log Meal</SheetTitle>

        {/* ── MAIN VIEW ── */}
        {view === "main" && (
          <>
            {/* ── Fixed top: header + search + tabs ── */}
            <div className="flex-shrink-0">
              {/* Header row */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-bold text-gray-900 text-base">Log Meal</span>
                <div className="w-8" />
              </div>

              {/* Camera inputs */}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanImage} />
              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleScanImage} />

              {/* Search */}
              <div className="px-5 pb-2">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search food..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 rounded-2xl h-11 bg-gray-50 border-0 focus-visible:ring-1 text-sm"
                  />
                </div>
              </div>

              {/* Tabs */}
              {!searchQuery.trim() && (
                <div className="px-5 pb-3">
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => setTab("Recent")}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        tab === "Recent" ? "gradient-primary text-white shadow-sm" : "text-gray-500"
                      }`}
                    >
                      Recent
                    </button>
                    <button
                      onClick={() => setTab("Scan")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        tab === "Scan" ? "gradient-primary text-white shadow-sm" : "text-gray-500"
                      }`}
                    >
                      <ScanLine className="w-3.5 h-3.5" /> Scan Food
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto px-5">

              {/* Scan Food tab content */}
              {tab === "Scan" && !searchQuery.trim() && (
                <>
                  {/* Scanning in progress */}
                  {scanning && (
                    <div className="flex flex-col items-center gap-4 py-10">
                      {scanPreviewUrl && (
                        <div className="w-full h-40 rounded-2xl overflow-hidden bg-gray-100">
                          <img src={scanPreviewUrl} alt="Scanning" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center">
                          <Loader2 className="w-7 h-7 text-white animate-spin" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-gray-900">Analyzing your food…</p>
                          <p className="text-sm text-gray-400 mt-1">AI is detecting ingredients and nutrients</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scan results */}
                  {!scanning && scanResults.length > 0 && (
                    <div className="flex flex-col gap-3 pb-4">
                      {/* Preview image */}
                      {scanPreviewUrl && (
                        <div className="w-full h-36 rounded-2xl overflow-hidden bg-gray-100 mb-1">
                          <img src={scanPreviewUrl} alt="Scanned food" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          {scanResults.length} item{scanResults.length > 1 ? "s" : ""} detected
                        </p>
                        <button
                          onClick={() => {
                            // Remove previously scanned items from selection
                            setSelected((prev) => {
                              const next = new Map(prev);
                              scanResults.forEach((item) => next.delete(item.id));
                              return next;
                            });
                            setScanResults([]);
                            setScanPreviewUrl(null);
                          }}
                          className="text-xs text-primary font-semibold"
                        >
                          Scan again
                        </button>
                      </div>
                      {scanResults.map((item) => {
                        const isSelected = selected.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border-2 p-4 transition-all ${
                              isSelected ? "border-primary/40 bg-primary/5" : "border-gray-200 bg-white"
                            }`}
                          >
                            {/* Name + toggle */}
                            <div className="flex items-center gap-3 mb-3">
                              <button
                                onClick={() => toggleItem(item)}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                  isSelected ? "gradient-primary border-transparent" : "border-gray-300"
                                }`}
                              >
                                {isSelected
                                  ? <Check className="w-3.5 h-3.5 text-white" />
                                  : <Plus className="w-3.5 h-3.5 text-gray-400" />}
                              </button>
                              <p className="font-bold text-gray-900 flex-1 text-sm">{item.name}</p>
                              <span className="font-black text-primary text-base">{item.calories}</span>
                              <span className="text-xs text-gray-400">cal</span>
                            </div>
                            {/* Macro breakdown */}
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: "Protein", value: item.protein_g, color: "bg-blue-50 text-blue-600" },
                                { label: "Carbs", value: item.carbs_g, color: "bg-amber-50 text-amber-600" },
                                { label: "Fat", value: item.fat_g, color: "bg-red-50 text-red-500" },
                              ].map(({ label, value, color }) => (
                                <div key={label} className={`rounded-xl px-3 py-2 text-center ${color}`}>
                                  <p className="font-bold text-sm">{Math.round(value)}g</p>
                                  <p className="text-[10px] font-medium opacity-70">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Idle — no scan yet */}
                  {!scanning && scanResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 gap-4">
                      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-1">
                        <ScanLine className="w-10 h-10 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-gray-900 text-base">Scan Your Food</p>
                        <p className="text-sm text-gray-400 mt-1">Take a photo or upload from your gallery to identify the food and log it instantly.</p>
                      </div>
                      <div className="flex flex-col gap-3 w-full mt-2">
                        <button
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                        >
                          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                            <ScanLine className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm text-gray-900">Take Photo</p>
                            <p className="text-xs text-gray-400 mt-0.5">Use your camera to capture food</p>
                          </div>
                        </button>
                        <button
                          onClick={() => galleryInputRef.current?.click()}
                          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Search className="w-5 h-5 text-gray-500" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm text-gray-900">Upload from Gallery</p>
                            <p className="text-xs text-gray-400 mt-0.5">Pick an existing photo</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Today's Schedule */}
              {tab !== "Scan" && !searchQuery.trim() && (loadingScheduled || scheduledItems.length > 0) && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    📅 Today's Schedule
                    {loadingScheduled && <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                  </p>
                  <div className="divide-y divide-primary/10 bg-primary/5 rounded-2xl px-3">
                    {scheduledItems.map((item) => {
                      const isSelected = selected.has(item.id);
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-2.5">
                          <button
                            onClick={() => toggleItem(item)}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isSelected ? "gradient-primary border-transparent" : "border-primary/40 hover:border-primary"
                            }`}
                          >
                            {isSelected ? <Check className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5 text-primary" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.calories} cal · {Math.round(item.protein_g + item.carbs_g + item.fat_g)}g</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent / Search results */}
              {tab !== "Scan" && isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : listItems.length === 0 && !searchQuery.trim() && tab === "Recent" ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No recent meals yet. Start logging!
                </div>
              ) : listItems.length === 0 && searchQuery.trim() ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No results for "{searchQuery}". Try Quick Log to add it manually.
                </div>
              ) : listItems.length > 0 ? (
                <>
                  {!searchQuery.trim() && (
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {tab === "Recent" ? "Recently Logged" : "Favorites"}
                    </p>
                  )}
                  <div className="divide-y divide-gray-100">
                    {listItems.map((item, index) => {
                      const isSelected = selected.has(item.id);
                      const isRecent = item.source === "history" && !searchQuery.trim();
                      const recency = isRecent ? formatRecency(item.logged_at) : "";
                      return (
                        <div
                          key={item.id}
                          onClick={() => { setDetailItem(item); setDetailQty(1); setView("detail"); }}
                          className={`flex items-center gap-3 py-3 cursor-pointer rounded-xl transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-[#e2e8ee]"}`}
                        >
                          <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm truncate ${isSelected ? "text-primary" : "text-gray-900"}`}>{item.name}</p>
                            <p className="text-xs text-gray-400">
                              {item.calories} cal · {gramsDisplay(item)}g
                              {recency && <span className="ml-1.5">· {recency}</span>}
                            </p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                          {isRecent ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteRecentItem(item); }}
                              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                              aria-label="Remove from history"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>

            {/* ── Bottom bar ── */}
            <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-white flex items-center gap-3">
              {selected.size > 0 ? (
                <div className="text-left">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">cal</p>
                  <p className="text-xl font-black text-gray-900 leading-none mt-0.5">{Math.round(totalCal)}</p>
                </div>
              ) : (
                <button
                  onClick={() => setView("quicklog")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-primary/30 bg-primary/5 text-xs font-bold text-primary whitespace-nowrap hover:bg-primary/10 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" /> Manual Log
                </button>
              )}
              <Button
                onClick={handleAddSelected}
                disabled={selected.size === 0 || logging}
                className="flex-1 rounded-full font-bold text-white gradient-primary shadow-md shadow-primary/20 disabled:opacity-40 disabled:shadow-none"
                style={{ height: 48 }}
              >
                {logging
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : selected.size > 0
                    ? <><Check className="w-4 h-4 mr-1.5" /> Add {selected.size} item{selected.size > 1 ? "s" : ""}</>
                    : "Select items to add"}
              </Button>
            </div>
          </>
        )}

        {/* ── FOOD DETAIL VIEW ── */}
        {view === "detail" && detailItem && (() => {
          const item = detailItem;
          const total = item.protein_g + item.carbs_g + item.fat_g || 1;
          const carbPct = item.carbs_g / total;
          const protPct = item.protein_g / total;
          const fatPct = item.fat_g / total;

          // SVG donut ring — segmented arc for carbs/protein/fat
          const R = 54, C = 2 * Math.PI * R;
          const gap = 0.015; // gap between segments as fraction
          const carbLen  = Math.max(0, (carbPct - gap) * C);
          const protLen  = Math.max(0, (protPct - gap) * C);
          const fatLen   = Math.max(0, (fatPct  - gap) * C);
          const carbOff  = 0;
          const protOff  = C - carbLen - gap * C;
          const fatOff   = C - carbLen - protLen - 2 * gap * C;

          const scaledCal = Math.round(item.calories * detailQty);
          const scaledCarb = Math.round(item.carbs_g * detailQty);
          const scaledProt = Math.round(item.protein_g * detailQty);
          const scaledFat  = Math.round(item.fat_g * detailQty);

          return (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
                <button
                  onClick={() => setView("main")}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
                <div className="w-8" />
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 pb-4">
                {/* Food image + name */}
                <div className="text-center mb-6">
                  {item.image_url ? (
                    <div className="w-28 h-28 rounded-3xl overflow-hidden mx-auto mb-3 shadow-md">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-28 h-28 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <span className="text-5xl">🍽️</span>
                    </div>
                  )}
                  <h2 className="text-xl font-extrabold text-gray-900">{item.name}</h2>
                </div>

                {/* Macro donut + legend */}
                <div className="flex items-center gap-6 bg-gray-50 rounded-3xl p-5 mb-5">
                  {/* Ring */}
                  <div className="relative flex-shrink-0" style={{ width: 128, height: 128 }}>
                    <svg width="128" height="128" viewBox="0 0 128 128">
                      {/* Background track */}
                      <circle cx="64" cy="64" r={R} fill="none" stroke="#f3f4f6" strokeWidth="12" />
                      {/* Carbs — red */}
                      <circle cx="64" cy="64" r={R} fill="none" stroke="#ef4444" strokeWidth="12"
                        strokeDasharray={`${carbLen} ${C - carbLen}`}
                        strokeDashoffset={C * 0.25 - carbOff * C}
                        strokeLinecap="round"
                        style={{ transform: "rotate(-90deg)", transformOrigin: "64px 64px" }}
                      />
                      {/* Protein — orange */}
                      <circle cx="64" cy="64" r={R} fill="none" stroke="#f97316" strokeWidth="12"
                        strokeDasharray={`${protLen} ${C - protLen}`}
                        strokeDashoffset={C * 0.25 - (carbLen + gap * C)}
                        strokeLinecap="round"
                        style={{ transform: "rotate(-90deg)", transformOrigin: "64px 64px" }}
                      />
                      {/* Fat — blue */}
                      <circle cx="64" cy="64" r={R} fill="none" stroke="#3b82f6" strokeWidth="12"
                        strokeDasharray={`${fatLen} ${C - fatLen}`}
                        strokeDashoffset={C * 0.25 - (carbLen + protLen + 2 * gap * C)}
                        strokeLinecap="round"
                        style={{ transform: "rotate(-90deg)", transformOrigin: "64px 64px" }}
                      />
                    </svg>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-gray-900">{scaledCal}</span>
                      <span className="text-[10px] text-gray-400 font-medium">cal</span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-col gap-3 flex-1">
                    {[
                      { label: "Carbs",   value: scaledCarb, pct: Math.round(carbPct * 100), color: "bg-red-500" },
                      { label: "Protein", value: scaledProt, pct: Math.round(protPct * 100), color: "bg-orange-500" },
                      { label: "Fat",     value: scaledFat,  pct: Math.round(fatPct  * 100), color: "bg-blue-500" },
                    ].map(({ label, value, pct, color }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                        <span className="text-sm text-gray-500 flex-1">{label}</span>
                        <span className="text-sm font-bold text-gray-900">{value}g</span>
                        <span className="text-xs text-gray-400">({pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nutrient rows */}
                <div className="divide-y divide-gray-100 mb-4">
                  {[
                    { label: "Calories",  value: `${scaledCal} kcal` },
                    { label: "Protein",   value: `${scaledProt} g` },
                    { label: "Carbs",     value: `${scaledCarb} g` },
                    { label: "Fat",       value: `${scaledFat} g` },
                    { label: "Total Weight", value: `${Math.round((item.protein_g + item.carbs_g + item.fat_g) * detailQty)} g` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-3">
                      <span className="text-sm text-gray-500">{label}</span>
                      <span className="text-sm font-semibold text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom: delete (recent) or add (search/favorites) */}
              <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
                {item.source === "history" ? (
                  <Button
                    onClick={() => {
                      deleteRecentItem(item);
                      setView("main");
                    }}
                    variant="destructive"
                    className="w-full h-12 rounded-full font-bold"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setSelected((prev) => {
                        const next = new Map(prev);
                        next.set(item.id, { ...item, quantity: detailQty });
                        return next;
                      });
                      setView("main");
                    }}
                    className="w-full h-12 rounded-full font-bold text-white gradient-primary shadow-lg shadow-primary/20"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Add
                  </Button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── QUICK LOG VIEW ── */}
        {(view === "quicklog" || view === "createfood") && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
              <button
                onClick={() => setView("main")}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <h2 className="font-bold text-lg text-gray-900">
                {view === "quicklog" ? "Quick Log" : "Create Food"}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Food name</Label>
                <Input
                  placeholder="e.g. Chicken salad"
                  value={quickEntry.name}
                  onChange={(e) => setQuickEntry((p) => ({ ...p, name: e.target.value }))}
                  className="rounded-2xl h-12 bg-gray-50 border-0 focus-visible:ring-1"
                />
              </div>

              {/* Calories — prominent */}
              <div className="bg-primary/5 rounded-2xl p-4">
                <Label className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <Flame className="w-3.5 h-3.5" /> Calories
                </Label>
                <div className="flex items-baseline gap-2">
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={quickEntry.calories}
                    onChange={(e) => setQuickEntry((p) => ({ ...p, calories: e.target.value }))}
                    className="border-0 bg-transparent p-0 h-auto text-4xl font-black text-gray-900 focus-visible:ring-0 w-32"
                    style={{ fontSize: 40 }}
                  />
                  <span className="text-lg text-gray-400 font-medium">cal</span>
                </div>
              </div>

              {/* Macros row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "protein", label: "Protein", icon: Beef, color: "text-orange-500", bg: "bg-orange-50" },
                  { key: "carbs",   label: "Carbs",   icon: Wheat, color: "text-yellow-500", bg: "bg-yellow-50" },
                  { key: "fat",     label: "Fat",     icon: Droplets, color: "text-blue-500", bg: "bg-blue-50" },
                ].map(({ key, label, icon: Icon, color, bg }) => (
                  <div key={key} className={`${bg} rounded-2xl p-3`}>
                    <Label className={`text-[10px] font-semibold ${color} uppercase tracking-wide flex items-center gap-1 mb-1`}>
                      <Icon className="w-3 h-3" /> {label}
                    </Label>
                    <div className="flex items-baseline gap-1">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={quickEntry[key as keyof typeof quickEntry]}
                        onChange={(e) => setQuickEntry((p) => ({ ...p, [key]: e.target.value }))}
                        className="border-0 bg-transparent p-0 h-auto text-xl font-bold text-gray-900 focus-visible:ring-0 w-14"
                      />
                      <span className="text-xs text-gray-400">g</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="px-5 py-4 border-t border-gray-100">
              <Button
                onClick={handleQuickLog}
                disabled={logging || !quickEntry.calories}
                className="w-full h-14 rounded-full font-bold text-white text-base gradient-primary shadow-lg shadow-primary/20"
              >
                {logging
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <>
                      <Pencil className="w-4 h-4 mr-2" />
                      Log {quickEntry.calories ? `${quickEntry.calories} cal` : "Meal"}
                    </>}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
