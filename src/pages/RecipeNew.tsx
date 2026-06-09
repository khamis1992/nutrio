import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, X, Flame, Beef, Wheat, Droplets, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCatalog, type Ingredient } from "@/lib/ingredientCatalog";
import { createRecipe, type RecipeIngredient } from "@/lib/recipeStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "protein", label: "Protein" },
  { key: "vegetable", label: "Veggies" },
  { key: "grain", label: "Grains" },
  { key: "fruit", label: "Fruits" },
  { key: "oil", label: "Oils" },
  { key: "snack", label: "Snacks" },
  { key: "supplement", label: "Supps" },
] as const;

const EMOJIS = ["🍽️", "🥗", "🍲", "🥘", "🍝", "🍛", "🥩", "🍗", "🐟", "🥑", "🥦", "🍳", "🍜", "🌮", "🥙"];

export default function RecipeNew() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(2);
  const [instructions, setInstructions] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const [addedIngredients, setAddedIngredients] = useState<Array<RecipeIngredient & { amount_g: number }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);

  const catalog = useMemo(() => getCatalog(), []);

  const filteredCatalog = useMemo(() => {
    let items = catalog;
    if (activeCategory !== "all") items = items.filter((i) => i.category === activeCategory);
    if (searchQuery) items = items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  }, [catalog, activeCategory, searchQuery]);

  const addIngredient = (ing: Ingredient) => {
    setAddedIngredients((prev) => {
      if (prev.find((ai) => ai.ingredientId === ing.id)) return prev;
      return [...prev, {
        ingredientId: ing.id,
        ingredientName: ing.name,
        amount_g: 100,
        category: ing.category,
      }];
    });
    setShowIngredientPicker(false);
    setSearchQuery("");
  };

  const updateAmount = (ingredientId: string, amount: number) => {
    setAddedIngredients((prev) =>
      prev.map((ai) => ai.ingredientId === ingredientId ? { ...ai, amount_g: Math.max(0, amount) } : ai)
    );
  };

  const removeIngredient = (ingredientId: string) => {
    setAddedIngredients((prev) => prev.filter((ai) => ai.ingredientId !== ingredientId));
  };

  const nutrition = useMemo(() => {
    let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
    for (const ai of addedIngredients) {
      const ing = catalog.find((i) => i.id === ai.ingredientId);
      if (!ing) continue;
      const factor = ai.amount_g / 100;
      totalCal += ing.calories_per_100g * factor;
      totalPro += ing.protein_per_100g * factor;
      totalCarb += ing.carbs_per_100g * factor;
      totalFat += ing.fat_per_100g * factor;
    }
    const s = Math.max(1, servings);
    return {
      calories: Math.round(totalCal / s),
      protein: Math.round(totalPro / s),
      carbs: Math.round(totalCarb / s),
      fat: Math.round(totalFat / s),
    };
  }, [addedIngredients, servings, catalog]);

  const handleSave = () => {
    if (!name.trim()) { toast.error("Recipe name is required"); return; }
    if (addedIngredients.length === 0) { toast.error("Add at least one ingredient"); return; }

    createRecipe({
      name: name.trim(),
      description: description.trim() || "A custom Nutrio recipe",
      servings,
      instructions: instructions.trim() || "Cook all ingredients together. Season to taste.",
      image_emoji: emoji,
      ingredients: addedIngredients,
    });
    toast.success("Recipe created!");
    navigate("/recipes");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8F9FA] pb-20 mx-auto max-w-[430px]">
      <div className="bg-white px-4 pt-safe pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">New Recipe</h1>
          </div>
          <Button onClick={handleSave} size="sm"
            className="rounded-full bg-emerald-500 hover:bg-emerald-600 h-10 px-5">
            Save
          </Button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Name + Description */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 space-y-3">
          <Input placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)}
            className="border-0 bg-slate-50 rounded-xl h-12 text-[15px] font-semibold px-4" />
          <Input placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
            className="border-0 bg-slate-50 rounded-xl h-12 text-sm px-4" />
        </div>

        {/* Emoji picker */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-[12px] font-semibold text-slate-500 mb-2">Icon</p>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)}
                className={cn("text-2xl p-1.5 rounded-xl transition-all",
                  emoji === e ? "bg-amber-100 ring-2 ring-amber-300" : "hover:bg-slate-50")}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Servings */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-[12px] font-semibold text-slate-500 mb-2">Servings</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setServings(Math.max(1, servings - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-lg">−</button>
            <span className="text-xl font-extrabold tabular-nums w-12 text-center">{servings}</span>
            <button onClick={() => setServings(Math.min(20, servings + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-lg">+</button>
          </div>
        </div>

        {/* Ingredients */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold text-slate-500">
              Ingredients ({addedIngredients.length})
            </p>
            <Button onClick={() => setShowIngredientPicker(!showIngredientPicker)} variant="ghost" size="sm"
              className="h-8 rounded-full text-emerald-600 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          {showIngredientPicker && (
            <div className="mb-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search ingredients..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-0 bg-slate-50 rounded-xl h-10 text-sm" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                    className={cn("shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors",
                      activeCategory === cat.key ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {filteredCatalog.map((ing) => (
                  <button key={ing.id} onClick={() => addIngredient(ing)}
                    disabled={addedIngredients.some((ai) => ai.ingredientId === ing.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 disabled:opacity-30 text-left">
                    <span className="text-xl">{ing.image_url}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-700 truncate">{ing.name}</p>
                      <p className="text-[10px] text-slate-400">{ing.calories_per_100g} cal/100g · {ing.price_qar} QAR</p>
                    </div>
                    <Plus className="h-4 w-4 text-emerald-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {addedIngredients.map((ai) => (
              <div key={ai.ingredientId} className="flex items-center gap-2">
                <span className="text-lg">{catalog.find((i) => i.id === ai.ingredientId)?.image_url || "🍽️"}</span>
                <span className="flex-1 text-[13px] font-medium text-slate-700 truncate">{ai.ingredientName}</span>
                <div className="flex items-center gap-1">
                  <input type="number" value={ai.amount_g} min={0} max={5000}
                    onChange={(e) => updateAmount(ai.ingredientId, parseInt(e.target.value) || 0)}
                    className="w-14 h-8 text-center text-[13px] font-semibold rounded-lg border border-slate-200" />
                  <span className="text-[10px] text-slate-400">g</span>
                </div>
                <button onClick={() => removeIngredient(ai.ingredientId)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 hover:bg-red-100">
                  <X className="h-3 w-3 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live nutrition panel */}
        {addedIngredients.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-[12px] font-semibold text-slate-500 mb-3">Per Serving</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-orange-50 p-2">
                <Flame className="h-4 w-4 text-orange-500 mx-auto mb-1" />
                <p className="text-[15px] font-extrabold text-slate-900">{nutrition.calories}</p>
                <p className="text-[9px] text-slate-400">cal</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-2">
                <Beef className="h-4 w-4 text-rose-500 mx-auto mb-1" />
                <p className="text-[15px] font-extrabold text-slate-900">{nutrition.protein}g</p>
                <p className="text-[9px] text-slate-400">protein</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-2">
                <Wheat className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                <p className="text-[15px] font-extrabold text-slate-900">{nutrition.carbs}g</p>
                <p className="text-[9px] text-slate-400">carbs</p>
              </div>
              <div className="rounded-xl bg-purple-50 p-2">
                <Droplets className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                <p className="text-[15px] font-extrabold text-slate-900">{nutrition.fat}g</p>
                <p className="text-[9px] text-slate-400">fat</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-[12px] font-semibold text-slate-500 mb-2">Instructions</p>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
            placeholder="How to prepare this recipe..."
            rows={3}
            className="w-full border-0 bg-slate-50 rounded-xl text-sm px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200" />
        </div>
      </div>
    </motion.div>
  );
}
