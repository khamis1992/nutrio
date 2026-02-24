import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Flame, Search, Plus, Beef, Wheat, Droplets, Camera, X, Check, Sparkles, History, RotateCcw, ChevronDown, ChevronUp, Upload } from "lucide-react";

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
        const { data, error } = await supabase.functions.invoke("analyze-meal-image", {
          body: { 
            imageUrl: base64,
            mode: "quick_scan" 
          },
        });

        if (error) throw error;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            Log Meal
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-5 mt-2">
          {/* Search Section */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search meals from our menu..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-20 h-11"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                    title="Scan with AI"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => uploadInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Image
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* AI Scan Results */}
          {scanMode === "scanning" && (
            <div className="relative rounded-xl overflow-hidden">
              {scanImage && (
                <img 
                  src={scanImage} 
                  alt="Scanning" 
                  className="w-full h-32 object-cover"
                />
              )}
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center gap-3">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <span className="text-sm font-medium">Scanning food...</span>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}

          {scanMode === "results" && (
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-sm font-medium">AI Detected Items</span>
                </div>
                <Button variant="ghost" size="sm" onClick={resetScan} className="h-7 text-xs">
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="space-y-2 mb-3">
                {detectedFoods.map((food, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                      food.selected 
                        ? "bg-background ring-1 ring-primary/30" 
                        : "bg-background/50 opacity-60"
                    }`}
                    onClick={() => toggleFoodSelection(index)}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      food.selected ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {food.selected ? <Check className="w-3 h-3" /> : null}
                    </div>
                    <span className="flex-1 text-sm font-medium truncate">{food.name}</span>
                    <span className="text-xs text-primary font-semibold">{food.calories} cal</span>
                  </div>
                ))}
              </div>
              <Button 
                onClick={handleConfirmFoods}
                disabled={logging || detectedFoods.filter(f => f.selected).length === 0}
                className="w-full"
                size="sm"
              >
                {logging ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Log {detectedFoods.filter(f => f.selected).length} Item(s) ({detectedFoods.filter(f => f.selected).reduce((sum, f) => sum + f.calories, 0)} cal)
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Camera Input - captures live photo */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageUpload}
          />
          
          {/* Upload Input - selects from gallery */}
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* Recent Meals */}
          {!searchQuery && mealHistory.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History className="w-4 h-4" />
                Recent Meals
              </div>
              <div className="space-y-2">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                ) : (
                  mealHistory.slice(0, 3).map((item) => (
                    <Card
                      key={item.id}
                      variant="interactive"
                      className="cursor-pointer"
                      onClick={() => !logging && handleHistorySelect(item)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                            <RotateCcw className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{item.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Flame className="w-3 h-3 text-orange-500" />
                                {item.calories} cal
                              </span>
                              <span className="text-emerald-600">P: {item.protein_g}g</span>
                            </div>
                          </div>
                          {logging ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          ) : (
                            <Plus className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Search Results */}
          {(searchQuery || meals.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Search className="w-4 h-4" />
                {searchQuery ? "Search Results" : "Browse Menu"}
              </div>
              <div className="space-y-2">
                {searching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : meals.length === 0 && searchQuery ? (
                  <div className="text-center py-6 bg-muted/30 rounded-xl">
                    <p className="text-muted-foreground text-sm">No meals found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try a different search or add manually</p>
                  </div>
                ) : (
                  meals.map((meal) => (
                    <Card
                      key={meal.id}
                      variant="interactive"
                      className="cursor-pointer"
                      onClick={() => !logging && handleMealSelect(meal)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl overflow-hidden">
                            {meal.image_url ? (
                              <img
                                src={meal.image_url}
                                alt={meal.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              "🍽️"
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{meal.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{meal.restaurant_name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Flame className="w-3 h-3 text-orange-500" />
                                {meal.calories} cal
                              </span>
                              <span className="text-emerald-600">P: {Math.round(meal.protein_g)}g</span>
                            </div>
                          </div>
                          {logging ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          ) : (
                            <Plus className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Manual Entry Toggle */}
          <div className="pt-2 border-t">
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Manual Entry</p>
                  <p className="text-xs text-muted-foreground">Add custom meal details</p>
                </div>
              </div>
              {showManualEntry ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </button>

            {/* Manual Entry Form */}
            {showManualEntry && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <Label htmlFor="meal-name" className="text-sm">Meal Name</Label>
                  <Input
                    id="meal-name"
                    placeholder="e.g., Homemade Salad"
                    value={manualEntry.name}
                    onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="calories" className="flex items-center gap-1.5 text-sm">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      Calories
                    </Label>
                    <Input
                      id="calories"
                      type="number"
                      placeholder="0"
                      value={manualEntry.calories}
                      onChange={(e) => setManualEntry({ ...manualEntry, calories: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protein" className="flex items-center gap-1.5 text-sm">
                      <Beef className="w-3.5 h-3.5 text-emerald-600" />
                      Protein (g)
                    </Label>
                    <Input
                      id="protein"
                      type="number"
                      placeholder="0"
                      value={manualEntry.protein}
                      onChange={(e) => setManualEntry({ ...manualEntry, protein: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carbs" className="flex items-center gap-1.5 text-sm">
                      <Wheat className="w-3.5 h-3.5 text-amber-500" />
                      Carbs (g)
                    </Label>
                    <Input
                      id="carbs"
                      type="number"
                      placeholder="0"
                      value={manualEntry.carbs}
                      onChange={(e) => setManualEntry({ ...manualEntry, carbs: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fat" className="flex items-center gap-1.5 text-sm">
                      <Droplets className="w-3.5 h-3.5 text-blue-500" />
                      Fat (g)
                    </Label>
                    <Input
                      id="fat"
                      type="number"
                      placeholder="0"
                      value={manualEntry.fat}
                      onChange={(e) => setManualEntry({ ...manualEntry, fat: e.target.value })}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleManualLog}
                  disabled={logging}
                  className="w-full"
                >
                  {logging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Log Meal
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
