import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Flame, Dumbbell, Wheat, Droplets, ArrowRightLeft, Heart, ChevronDown, ChevronUp, UtensilsCrossed, Zap, Search, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface Meal {
  id: string; name: string; description: string | null;
  restaurant_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number;
  image_url: string | null; meal_type: string | null; match_score: number; match_reasons: string[];
}
interface NutritionTargets { calories: number; protein: number; carbs: number; fats: number; }

export default function SmartMealRecommendations() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets | null>(null);
  const [calorieRange, setCalorieRange] = useState<[number, number]>([0, 1000]);
  const [proteinMin, setProteinMin] = useState(20);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const cuisineOptions = ["Italian", "Asian", "Mediterranean", "Arabic", "Indian", "Mexican"];
  const categoryOptions = ["High Protein", "Low Carb", "Balanced", "Vegetarian", "Keto-Friendly"];

  const calculateMatchScore = (meal: { calories: number; protein_g: number; carbs_g: number; fat_g: number }, targets: NutritionTargets) => {
    let score = 0; const reasons: string[] = [];
    const idealCal = targets.calories / 3;
    const calScore = Math.max(0, 40 - (Math.abs(meal.calories - idealCal) / idealCal * 40));
    score += calScore; if (calScore > 30) reasons.push("Calorie match"); else if (calScore > 20) reasons.push("Good calorie range");
    const idealP = targets.protein / 3;
    const pScore = Math.max(0, 35 - (Math.abs(meal.protein_g - idealP) / idealP * 35));
    score += pScore; if (pScore > 25) reasons.push("High protein"); else if (pScore > 15) reasons.push("Good protein");
    const totalM = meal.protein_g + meal.carbs_g + meal.fat_g;
    if (totalM > 0) { const bScore = 25 - Math.abs(meal.protein_g / totalM - 0.3) * 100; score += Math.max(0, bScore); if (bScore > 20) reasons.push("Balanced macros"); }
    return { score: Math.round(score), reasons };
  };

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g").eq("user_id", user.id).single();
      const targets = { calories: profile?.daily_calorie_target || 2000, protein: profile?.protein_target_g || 150, carbs: profile?.carbs_target_g || 200, fats: profile?.fat_target_g || 65 };
      setNutritionTargets(targets);
      const { data: mealsData, error } = await supabase.from("meals").select("id, name, description, calories, protein_g, carbs_g, fat_g, image_url, meal_type, restaurants:restaurant_id(name)").eq("is_available", true).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const scoredMeals = (mealsData || []).map((meal: any) => {
        const { score, reasons } = calculateMatchScore(meal, targets);
        return { ...meal, restaurant_name: meal.restaurants?.name || "Unknown", match_score: score, match_reasons: reasons };
      }).sort((a: any, b: any) => (b.match_score || 0) - (a.match_score || 0));
      setMeals(scoredMeals);
    } catch (error) { toast.error("Failed to load recommendations"); console.error(error); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchRecommendations(); }, [fetchRecommendations]);

  const filteredMeals = (meals || []).filter(meal => meal.calories >= calorieRange[0] && meal.calories <= calorieRange[1] && meal.protein_g >= proteinMin && (!selectedCuisines.length || selectedCuisines.includes(meal.meal_type || "")) && (!selectedCategories.length || selectedCategories.includes(meal.meal_type || "")));

  if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" /></div>;
  if (!meals) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ═══════ HEADER ═══════ */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100" aria-label="Back">
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-[38px] h-[38px] rounded-full bg-emerald-50 flex items-center justify-center">
              <Zap className="w-[18px] h-[18px] text-emerald-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-extrabold text-slate-900">{t("smart_recommendations")}</h1>
              <p className="text-[12px] font-medium text-slate-500">AI-matched to your goals</p>
            </div>
          </div>
        </div>
        {/* Nutrition targets inline strip */}
        {nutritionTargets && (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {[
              { v: nutritionTargets.calories, l: "cal", c: "bg-emerald-50 text-emerald-700" },
              { v: `${nutritionTargets.protein}g`, l: "protein", c: "bg-blue-50 text-blue-700" },
              { v: `${nutritionTargets.carbs}g`, l: "carbs", c: "bg-amber-50 text-amber-700" },
              { v: `${nutritionTargets.fats}g`, l: "fats", c: "bg-rose-50 text-rose-700" },
            ].map((s, i) => (
              <div key={i} className={`shrink-0 rounded-full px-3 py-1.5 flex items-center gap-1.5 ${s.c}`}>
                <span className="text-[13px] font-extrabold">{s.v}</span>
                <span className="text-[10px] font-semibold opacity-70">{s.l}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-5 space-y-4">

        {/* ═══════ FILTERS ═══════ */}
        <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 p-5">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-between w-full text-left">
            <span className="font-extrabold text-slate-800 text-[15px] flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-slate-400" />Filter & Sort</span>
            {showFilters ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-5">
              <div>
                <div className="flex justify-between text-[13px] font-semibold text-slate-600 mb-2"><span>Calories</span><span className="text-emerald-600">{calorieRange[0]}–{calorieRange[1]}</span></div>
                <Slider value={calorieRange} onValueChange={(v) => setCalorieRange(v as [number, number])} max={1200} step={50} />
              </div>
              <div>
                <div className="flex justify-between text-[13px] font-semibold text-slate-600 mb-2"><span>Min Protein</span><span className="text-emerald-600">{proteinMin}g</span></div>
                <Slider value={[proteinMin]} onValueChange={(v) => setProteinMin(v[0])} max={100} step={5} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-600 mb-2">Cuisine</p>
                <div className="flex flex-wrap gap-1.5">
                  {cuisineOptions.map(c => {
                    const active = selectedCuisines.includes(c);
                    return <button key={c} onClick={() => setSelectedCuisines(p => active ? p.filter(x => x !== c) : [...p, c])} className={cn("rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all", active ? "bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.2)]" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>{c}</button>;
                  })}
                </div>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-600 mb-2">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  {categoryOptions.map(c => {
                    const active = selectedCategories.includes(c);
                    return <button key={c} onClick={() => setSelectedCategories(p => active ? p.filter(x => x !== c) : [...p, c])} className={cn("rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all", active ? "bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.2)]" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>{c}</button>;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════ RESULTS ═══════ */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-500">Showing <span className="text-slate-800">{filteredMeals.length}</span> meals</p>
          <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 rounded-full px-3 py-1">AI Ranked</span>
        </div>

        {/* ═══════ MEAL GRID ═══════ */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeals.map((meal) => (
            <Card key={meal.id} className={cn("overflow-hidden transition-all duration-300 group cursor-pointer shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]", selectedMeal === meal.id && "ring-2 ring-emerald-400")} onClick={() => setSelectedMeal(meal.id)}>

              {/* Image */}
              <div className="relative h-44 bg-slate-100 overflow-hidden">
                {meal.image_url ? <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                : <div className="absolute inset-0 flex items-center justify-center"><UtensilsCrossed className="w-12 h-12 text-slate-300" /></div>}
                <div className="absolute top-3 left-3">
                  <Badge className={cn("text-white font-bold text-[11px]", meal.match_score >= 80 ? "bg-emerald-500" : meal.match_score >= 60 ? "bg-amber-500" : "bg-slate-500")}>
                    <Zap className="w-3 h-3 mr-1" />{meal.match_score}%
                  </Badge>
                </div>
                <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm" onClick={(e) => { e.stopPropagation(); toast.success("Added to favorites"); }}>
                  <Heart className="w-4 h-4 text-rose-500" />
                </button>
                {meal.meal_type && <div className="absolute bottom-3 left-3"><Badge className="bg-black/40 text-white text-[10px] backdrop-blur-sm">{meal.meal_type}</Badge></div>}
              </div>

              <CardContent className="p-4">
                <p className="text-[12px] font-semibold text-emerald-600 mb-1">{meal.restaurant_name}</p>
                <h3 className="font-extrabold text-slate-900 text-[15px] mb-1.5 line-clamp-2">{meal.name}</h3>
                {meal.description && <p className="text-[12px] text-slate-500 mb-3 line-clamp-2">{meal.description}</p>}

                <div className="flex items-center gap-3 text-[12px] font-semibold text-slate-500 mb-3">
                  <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-400" />{meal.calories}</span>
                  <span className="flex items-center gap-1"><Dumbbell className="w-3.5 h-3.5 text-blue-400" />{meal.protein_g}g</span>
                  <span className="flex items-center gap-1"><Wheat className="w-3.5 h-3.5 text-amber-400" />{meal.carbs_g}g</span>
                </div>

                {meal.match_reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {meal.match_reasons.slice(0, 2).map((r, i) => <span key={i} className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">{r}</span>)}
                  </div>
                )}

                <Button className="w-full rounded-full h-10 bg-emerald-500 hover:bg-emerald-600 text-[13px] font-extrabold shadow-[0_3px_10px_rgba(16,185,129,0.2)]" onClick={(e) => { e.stopPropagation(); toast.success("Added to cart"); }}>
                  Order Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ═══════ EMPTY ═══════ */}
        {filteredMeals.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center"><Search className="w-8 h-8 text-slate-400" /></div>
            <h3 className="text-[16px] font-extrabold text-slate-800 mb-1">No meals match your filters</h3>
            <p className="text-[13px] text-slate-500">Try adjusting your criteria to see more options</p>
          </div>
        )}
      </div>
    </div>
  );
}
