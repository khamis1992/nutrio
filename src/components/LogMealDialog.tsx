import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Flame, Search, Plus, Beef, Wheat, Droplets, Camera, X, Check, Sparkles } from "lucide-react";

interface Meal {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
}

interface DetectedFood {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  selected: boolean;
}

interface LogMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onMealLogged: () => void;
}

export function LogMealDialog({ open, onOpenChange, userId, onMealLogged }: LogMealDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("browse");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [logging, setLogging] = useState(false);
  
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchMeals = async (query: string) => {
    if (!query.trim()) {
      setMeals([]);
      return;
    }
    
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("meals")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url")
        .eq("is_available", true)
        .ilike("name", `%${query}%`)
        .limit(10);

      if (error) throw error;
      setMeals(data || []);
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

  const logMeal = async (calories: number, protein: number, carbs: number, fat: number) => {
    setLogging(true);
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // First check if there's an existing log for today
      const { data: existingLog, error: fetchError } = await supabase
        .from("progress_logs")
        .select("id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingLog) {
        // Update existing log by adding the new values
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
        // Create new log for today
        const { error: insertError } = await supabase
          .from("progress_logs")
          .insert({
            user_id: userId,
            log_date: today,
            calories_consumed: calories,
            protein_consumed_g: protein,
            carbs_consumed_g: carbs,
            fat_consumed_g: fat,
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Meal logged!",
        description: `Added ${calories} kcal to today's progress.`,
      });
      
      onMealLogged();
      onOpenChange(false);
      
      // Reset form
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
    logMeal(
      meal.calories,
      Math.round(meal.protein_g),
      Math.round(meal.carbs_g),
      Math.round(meal.fat_g)
    );
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

    logMeal(calories, protein, carbs, fat);
  };

  const resetScan = () => {
    setScanMode("idle");
    setScanImage(null);
    setDetectedFoods([]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
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

        if (data?.success && data?.mealDetails) {
          // Create a single detected food item from the AI response
          const detected: DetectedFood = {
            name: data.mealDetails.name,
            calories: data.mealDetails.calories,
            protein_g: data.mealDetails.protein_g,
            carbs_g: data.mealDetails.carbs_g,
            fat_g: data.mealDetails.fat_g,
            selected: true,
          };
          setDetectedFoods([detected]);
          setScanMode("results");
        } else if (data?.error) {
          throw new Error(data.error);
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
    setDetectedFoods(prev => 
      prev.map((food, i) => 
        i === index ? { ...food, selected: !food.selected } : food
      )
    );
  };

  const handleConfirmFoods = () => {
    const selectedFoods = detectedFoods.filter(f => f.selected);
    if (selectedFoods.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one food item.",
        variant: "destructive",
      });
      return;
    }

    const totals = selectedFoods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.calories,
        protein: acc.protein + food.protein_g,
        carbs: acc.carbs + food.carbs_g,
        fat: acc.fat + food.fat_g,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    logMeal(totals.calories, Math.round(totals.protein), Math.round(totals.carbs), Math.round(totals.fat));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Log Meal
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="scan">AI Scan</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search meals..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : meals.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  {searchQuery ? "No meals found" : "Search for a meal to log"}
                </p>
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
                          <p className="font-medium truncate">{meal.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              {meal.calories} kcal
                            </span>
                            <span>P: {Math.round(meal.protein_g)}g</span>
                          </div>
                        </div>
                        {logging ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                          <Plus className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="scan" className="space-y-4 mt-4">
            {scanMode === "idle" && (
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="w-full aspect-square rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Tap to scan your meal</p>
                  <p className="text-xs text-muted-foreground mt-1">AI will detect food & calories</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            )}

            {scanMode === "scanning" && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden">
                  {scanImage && (
                    <img 
                      src={scanImage} 
                      alt="Scanning" 
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-3 animate-pulse">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Scanning food...</p>
                    <Loader2 className="w-5 h-5 animate-spin text-primary mt-2" />
                  </div>
                  {/* Scanning frame overlay */}
                  <div className="absolute inset-4 border-2 border-primary/50 rounded-xl pointer-events-none">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  </div>
                </div>
              </div>
            )}

            {scanMode === "results" && (
              <div className="flex flex-col gap-4">
                <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                  {scanImage && (
                    <img 
                      src={scanImage} 
                      alt="Meal" 
                      className="w-full h-full object-cover"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm h-8 w-8"
                    onClick={resetScan}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  Detected items - tap to select/deselect
                </p>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {detectedFoods.map((food, index) => (
                    <Card
                      key={index}
                      variant="interactive"
                      className={`cursor-pointer transition-all ${
                        food.selected 
                          ? "ring-2 ring-primary bg-primary/5" 
                          : "opacity-60"
                      }`}
                      onClick={() => toggleFoodSelection(index)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            food.selected ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            {food.selected ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <span className="text-lg">🍽️</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{food.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="text-primary font-semibold">{food.calories} kcal</span>
                              <span>P:{Math.round(food.protein_g)}g</span>
                              <span>C:{Math.round(food.carbs_g)}g</span>
                              <span>F:{Math.round(food.fat_g)}g</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  onClick={handleConfirmFoods}
                  disabled={logging || detectedFoods.filter(f => f.selected).length === 0}
                  className="w-full"
                >
                  {logging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Confirm Ingredients
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="meal-name">Meal Name (optional)</Label>
                <Input
                  id="meal-name"
                  placeholder="e.g., Chicken Salad"
                  value={manualEntry.name}
                  onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="calories" className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-primary" />
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
                  <Label htmlFor="protein" className="flex items-center gap-1.5">
                    <Beef className="w-3.5 h-3.5 text-destructive" />
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
                  <Label htmlFor="carbs" className="flex items-center gap-1.5">
                    <Wheat className="w-3.5 h-3.5 text-warning" />
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
                  <Label htmlFor="fat" className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-accent" />
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}