import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Flame, Search, Plus, Beef, Wheat, Droplets, Camera, X, Check, History, RotateCcw, Upload, Pencil } from "lucide-react";
import { getMealImage } from "@/lib/meal-images";

interface Meal {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
  restaurant_id: string;
  restaurant_name?: string;
}

interface DetectedFood {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  selected: boolean;
}

interface MealHistoryItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
}

interface LogMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onMealLogged: () => void;
}

export function LogMealDialog({ open, onOpenChange, userId, onMealLogged }: LogMealDialogProps) {
  const { toast } = useToast();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [logging, setLogging] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "recent" | "manual">("search");
  
  // Manual entry state
  const [manualEntry, setManualEntry] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  // AI Scan state
  const [scanMode, setScanMode] = useState<"idle" | "scanning" | "results">("idle");
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [detectedFoods, setDetectedFoods] = useState<DetectedFood[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Meal history state
  const [mealHistory, setMealHistory] = useState<MealHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch recent meal history
  useEffect(() => {
    if (open && userId) {
      fetchMealHistory();
      setShowManualEntry(false);
      setSearchQuery("");
      setMeals([]);
      resetScan();
    }
  }, [open, userId]);

  const fetchMealHistory = async () => {
    if (!userId) return;

    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("meal_history")
        .select("id, name, calories, protein_g, carbs_g, fat_g, logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setMealHistory(data || []);
    } catch (err) {
      console.error("Error fetching meal history:", err);
      toast({
        title: "Couldn't load recent meals",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const saveMealToHistory = async (
    name: string,
    calories: number,
    protein: number,
    carbs: number,
    fat: number
  ) => {
    if (!userId) return;

    try {
      const { error } = await supabase.from("meal_history").insert({
        user_id: userId,
        name: name || `Meal (${calories} cal)`,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      });

      if (error) {
        console.error("Error saving to meal history:", error);
        toast({
          title: "Couldn't save to Recent Meals",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      await fetchMealHistory();
    } catch (err) {
      console.error("Error saving to meal history:", err);
      toast({
        title: "Couldn't save to Recent Meals",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const searchMeals = async (query: string) => {
    if (!query.trim()) {
      setMeals([]);
      return;
    }
    
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("meals")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url, restaurant_id, restaurants(name)")
        .eq("is_available", true)
        .ilike("name", `%${query}%`)
        .limit(10);

      if (error) throw error;
      
      // Transform data to include restaurant_name
      const mealsWithRestaurant = (data || []).map((meal: any) => ({
        ...meal,
        restaurant_name: meal.restaurants?.name || "Unknown Restaurant",
      }));
      
      setMeals(mealsWithRestaurant);
    } catch (err) {
      console.error("Error searching meals:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    searchMeals(value);
  };

  const logMeal = async (params: {
    name?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    saveToHistory?: boolean;
  }) => {
    const { name, calories, protein, carbs, fat, saveToHistory = true } = params;

    setLogging(true);
    const today = new Date().toISOString().split("T")[0];

    try {
      const { data: existingLog, error: fetchError } = await supabase
        .from("progress_logs")
        .select("id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingLog) {
        const { error: updateError } = await supabase
          .from("progress_logs")
          .update({
            calories_consumed: (existingLog.calories_consumed || 0) + calories,
            protein_consumed_g: (existingLog.protein_consumed_g || 0) + protein,
            carbs_consumed_g: (existingLog.carbs_consumed_g || 0) + carbs,
            fat_consumed_g: (existingLog.fat_consumed_g || 0) + fat,
          })
          .eq("id", existingLog.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("progress_logs").insert({
          user_id: userId,
          log_date: today,
          calories_consumed: calories,
          protein_consumed_g: protein,
          carbs_consumed_g: carbs,
          fat_consumed_g: fat,
        });

        if (insertError) throw insertError;
      }

      if (saveToHistory) {
        await saveMealToHistory(name || "", calories, protein, carbs, fat);
      }

      toast({
        title: "Meal logged!",
        description: `Added ${calories} cal to today's progress.`,
      });

      onMealLogged();
      onOpenChange(false);

      setSearchQuery("");
      setMeals([]);
      setManualEntry({ name: "", calories: "", protein: "", carbs: "", fat: "" });
      resetScan();
    } catch (err) {
      console.error("Error logging meal:", err);
      toast({
        title: "Error",
        description: "Failed to log meal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLogging(false);
    }
  };

  const handleMealSelect = (meal: Meal) => {
    logMeal({
      name: meal.name,
      calories: meal.calories,
      protein: Math.round(meal.protein_g),
      carbs: Math.round(meal.carbs_g),
      fat: Math.round(meal.fat_g),
    });
  };

  const handleHistorySelect = (item: MealHistoryItem) => {
    logMeal({
      name: item.name,
      calories: item.calories,
      protein: item.protein_g,
      carbs: item.carbs_g,
      fat: item.fat_g,
      saveToHistory: false,
    });
  };

  const handleManualLog = () => {
    const calories = parseInt(manualEntry.calories) || 0;
    const protein = parseInt(manualEntry.protein) || 0;
    const carbs = parseInt(manualEntry.carbs) || 0;
    const fat = parseInt(manualEntry.fat) || 0;

    if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
      toast({
        title: "Invalid entry",
        description: "Please enter at least one nutritional value.",
        variant: "destructive",
      });
      return;
    }

    logMeal({ name: manualEntry.name, calories, protein, carbs, fat });
  };

  const resetScan = () => {
    setScanMode("idle");
    setScanImage(null);
    setDetectedFoods([]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setScanImage(base64);
      setScanMode("scanning");
      
      try {
        // Get current session for authorization
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          throw new Error("Authentication required. Please sign in again.");
        }
        
        const { data, error } = await supabase.functions.invoke("analyze-meal-image", {
          body: { 
            imageUrl: base64,
            mode: "quick_scan" 
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (error) {
          // Handle auth errors specifically
          if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            toast({
              title: "Session Expired",
              description: "Your session has expired. Please sign in again.",
              variant: "destructive",
            });
            setScanMode("upload");
            return;
          }
          throw error;
        }

        if (data?.success && data?.detectedItems && data.detectedItems.length > 0) {
          const detected: DetectedFood[] = data.detectedItems.map((item: any) => ({
            name: item.name,
            calories: item.calories,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
            selected: true,
          }));
          setDetectedFoods(detected);
          setScanMode("results");
          setShowManualEntry(true);
          
          // Auto-fill manual entry fields with detected totals
          const totals = detected.reduce(
            (acc: { calories: number; protein: number; carbs: number; fat: number }, food: DetectedFood) => ({
              calories: acc.calories + food.calories,
              protein: acc.protein + food.protein_g,
              carbs: acc.carbs + food.carbs_g,
              fat: acc.fat + food.fat_g,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );
          
          const mealName = detected.length === 1 
            ? detected[0].name 
            : `${detected.length} items detected`;
          
          setManualEntry({
            name: mealName,
            calories: totals.calories.toString(),
            protein: Math.round(totals.protein).toString(),
            carbs: Math.round(totals.carbs).toString(),
            fat: Math.round(totals.fat).toString(),
          });
        } else if (data?.error) {
          throw new Error(data.error);
        } else {
          throw new Error("No food items detected");
        }
      } catch (err) {
        console.error("Error scanning meal:", err);
        toast({
          title: "Scan failed",
          description: "Could not analyze the image. Try again or enter manually.",
          variant: "destructive",
        });
        resetScan();
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFoodSelection = (index: number) => {
    setDetectedFoods(prev => {
      const updated = prev.map((food, i) => 
        i === index ? { ...food, selected: !food.selected } : food
      );
      
      // Update manual entry fields with new totals
      const selectedFoods = updated.filter(f => f.selected);
      if (selectedFoods.length > 0) {
        const totals = selectedFoods.reduce(
          (acc, food) => ({
            calories: acc.calories + food.calories,
            protein: acc.protein + food.protein_g,
            carbs: acc.carbs + food.carbs_g,
            fat: acc.fat + food.fat_g,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        
        const mealName = selectedFoods.length === 1 
          ? selectedFoods[0].name 
          : `${selectedFoods.length} items detected`;
        
        setManualEntry({
          name: mealName,
          calories: totals.calories.toString(),
          protein: Math.round(totals.protein).toString(),
          carbs: Math.round(totals.carbs).toString(),
          fat: Math.round(totals.fat).toString(),
        });
      }
      
      return updated;
    });
  };

  const handleConfirmFoods = () => {
    const selectedFoods = detectedFoods.filter((f) => f.selected);
    if (selectedFoods.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one food item.",
        variant: "destructive",
      });
      return;
    }

    // Clear scan results and keep manual entry form populated for user review
    setScanMode("idle");
    setScanImage(null);
    setDetectedFoods([]);
    
    toast({
      title: "Values filled",
      description: "Review and edit the detected values, then click 'Log Meal'.",
    });
  };

  const tabs = [
    { id: "search" as const, label: "Search", icon: Search },
    { id: "recent" as const, label: "Recent", icon: History },
    { id: "manual" as const, label: "Manual", icon: Pencil },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-3xl max-h-[92vh] flex flex-col gap-0 border-0 outline-none focus:outline-none [&>button:last-of-type]:hidden bg-background"
      >
        {/* Hidden SheetTitle for accessibility */}
        <SheetTitle className="sr-only">Log a Meal</SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="gradient-primary px-5 pt-4 pb-5 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">Log a Meal</h2>
                <p className="text-white/65 text-xs mt-0.5">Track your daily nutrition</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* AI Scan buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all rounded-2xl py-3 text-white text-sm font-semibold border border-white/20"
            >
              <Camera className="w-4 h-4" />
              Camera
            </button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all rounded-2xl py-3 text-white text-sm font-semibold border border-white/20"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>

        {/* iOS-style Segment Tabs */}
        <div className="px-4 py-3 flex-shrink-0 bg-background border-b border-border/60">
          <div className="flex gap-1 bg-muted rounded-2xl p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* AI Scan: scanning state */}
          {scanMode === "scanning" && (
            <div className="relative mx-4 mt-4 rounded-3xl overflow-hidden border border-border/70 shadow-md">
              {scanImage && <img src={scanImage} alt="Scanning" className="w-full h-36 object-cover" />}
              <div className="absolute inset-0 bg-background/75 backdrop-blur-md flex flex-col items-center justify-center gap-2.5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">Analysing food…</span>
                <span className="text-xs text-muted-foreground">AI is reading your meal</span>
              </div>
            </div>
          )}

          {/* AI Scan: results state */}
          {scanMode === "results" && (
            <div className="mx-4 mt-4 bg-card/95 backdrop-blur-sm border border-border/70 rounded-3xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-bold text-foreground">AI Detected</span>
                </div>
                <button onClick={resetScan} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
              <div className="space-y-2.5 mb-4">
                {detectedFoods.map((food, index) => (
                  <div
                    key={index}
                    onClick={() => toggleFoodSelection(index)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all ${
                      food.selected
                        ? "bg-primary/5 border-2 border-primary/30 shadow-sm"
                        : "bg-muted/30 border-2 border-transparent opacity-50"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                      food.selected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    }`}>
                      {food.selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    </div>
                    <span className="flex-1 text-sm font-semibold truncate">{food.name}</span>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">{food.calories} cal</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleConfirmFoods}
                disabled={logging || detectedFoods.filter(f => f.selected).length === 0}
                className="w-full rounded-2xl h-12 font-semibold shadow-md shadow-primary/20"
              >
                {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Use {detectedFoods.filter(f => f.selected).length} item(s) · {detectedFoods.filter(f => f.selected).reduce((s, f) => s + f.calories, 0)} cal
                  </>
                )}
              </Button>
            </div>
          )}

          {/* ── SEARCH TAB ── */}
          {activeTab === "search" && (
            <div className="px-4 py-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search meals from our menu…"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-12 rounded-2xl bg-card/95 border border-border/70 shadow-sm focus-visible:ring-2 focus-visible:ring-primary text-base"
                />
              </div>

              {searching ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Searching…</p>
                </div>
              ) : meals.length === 0 && searchQuery ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-3xl bg-muted mx-auto flex items-center justify-center mb-3 shadow-sm">
                    <Search className="w-7 h-7 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No meals found</p>
                  <p className="text-xs text-muted-foreground mt-1">Switch to Manual to enter details</p>
                </div>
              ) : meals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-3xl bg-muted mx-auto flex items-center justify-center mb-3 shadow-sm">
                    <Search className="w-7 h-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">Type to search meals</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {meals.map((meal) => (
                    <button
                      key={meal.id}
                      onClick={() => !logging && handleMealSelect(meal)}
                      disabled={logging}
                      className="w-full flex items-center gap-4 p-4 rounded-3xl bg-card/95 backdrop-blur-sm border border-border/70 shadow-md hover:shadow-lg active:scale-[0.98] transition-all text-left"
                    >
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-accent/15 shrink-0 shadow-sm">
                        <img src={getMealImage(meal.image_url, meal.id)} alt={meal.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate text-foreground mb-1">{meal.name}</p>
                        <p className="text-xs text-muted-foreground/80 truncate mb-2">{meal.restaurant_name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-0.5 text-xs text-orange-500 font-bold bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded-full">
                            <Flame className="w-3 h-3" />{meal.calories}
                          </span>
                          <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-full">P {Math.round(meal.protein_g)}g</span>
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">C {Math.round(meal.carbs_g)}g</span>
                          <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-full">F {Math.round(meal.fat_g)}g</span>
                        </div>
                      </div>
                      {logging ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/25">
                          <Plus className="w-5 h-5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── RECENT TAB ── */}
          {activeTab === "recent" && (
            <div className="px-4 py-4">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Loading history…</p>
                </div>
              ) : mealHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-3xl bg-muted mx-auto flex items-center justify-center mb-3 shadow-sm">
                    <History className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No recent meals</p>
                  <p className="text-xs text-muted-foreground mt-1">Meals you log will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mealHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => !logging && handleHistorySelect(item)}
                      disabled={logging}
                      className="w-full flex items-center gap-4 p-4 rounded-3xl bg-card/95 backdrop-blur-sm border border-border/70 shadow-md hover:shadow-lg active:scale-[0.98] transition-all text-left"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/15 flex items-center justify-center shrink-0 shadow-sm">
                        <RotateCcw className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate text-foreground mb-2">{item.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-0.5 text-xs text-orange-500 font-bold bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded-full">
                            <Flame className="w-3 h-3" />{item.calories}
                          </span>
                          <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-full">P {item.protein_g}g</span>
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">C {item.carbs_g}g</span>
                          <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-full">F {item.fat_g}g</span>
                        </div>
                      </div>
                      {logging ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/25">
                          <Plus className="w-5 h-5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MANUAL TAB ── */}
          {activeTab === "manual" && (
            <div className="px-4 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="meal-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meal Name</Label>
                <Input
                  id="meal-name"
                  placeholder="e.g., Homemade Salad"
                  value={manualEntry.name}
                  onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                  className="rounded-2xl h-12 bg-card/95 border border-border/70 shadow-sm focus-visible:ring-2 focus-visible:ring-primary text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "calories", label: "Calories", key: "calories", icon: Flame,    color: "text-orange-500", bg: "bg-orange-50",  border: "border-orange-100", unit: "kcal" },
                  { id: "protein",  label: "Protein",  key: "protein",  icon: Beef,     color: "text-red-500",    bg: "bg-red-50",     border: "border-red-100",    unit: "g" },
                  { id: "carbs",    label: "Carbs",    key: "carbs",    icon: Wheat,    color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100",  unit: "g" },
                  { id: "fat",      label: "Fat",      key: "fat",      icon: Droplets, color: "text-blue-500",   bg: "bg-blue-50",    border: "border-blue-100",   unit: "g" },
                ].map(({ id, label, key, icon: Icon, color, bg, border, unit }) => (
                  <div key={id} className={`${bg} ${border} border rounded-3xl p-4 space-y-2 shadow-sm`}>
                    <div className={`flex items-center gap-1.5 ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <input
                        type="number"
                        placeholder="0"
                        value={manualEntry[key as keyof typeof manualEntry]}
                        onChange={(e) => setManualEntry({ ...manualEntry, [key]: e.target.value })}
                        className="w-full bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-muted-foreground shrink-0 font-medium">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleManualLog}
                disabled={logging}
                className="w-full rounded-2xl h-13 text-base font-semibold shadow-md shadow-primary/20"
              >
                {logging ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging…</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />Log Meal</>
                )}
              </Button>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
