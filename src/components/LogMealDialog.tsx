import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Flame, Search, Plus, Beef, Wheat, Droplets } from "lucide-react";

interface Meal {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse Meals</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
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
