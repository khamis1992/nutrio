import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Flame, Beef, Wheat, Droplets, Users, ShoppingCart, ChefHat, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecipe } from "@/lib/recipeStore";
import { getCatalog } from "@/lib/ingredientCatalog";
import { addRecipeIngredientsToCart } from "@/lib/cartStore";
import { toast } from "sonner";

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ordered, setOrdered] = useState(false);

  const recipe = useMemo(() => (id ? getRecipe(id) : undefined), [id]);
  const catalog = useMemo(() => getCatalog(), []);

  if (!recipe) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center mx-auto max-w-[430px]">
        <div className="text-center">
          <ChefHat className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-700">Recipe not found</h2>
          <Button onClick={() => navigate("/recipes")}
            className="mt-4 rounded-full bg-emerald-500 hover:bg-emerald-600">
            Back to Recipes
          </Button>
        </div>
      </div>
    );
  }

  const handleOrderIngredients = () => {
    const ingredientIds = recipe.ingredients.map((ri) => ({
      id: ri.ingredientId,
      name: ri.ingredientName,
    }));
    addRecipeIngredientsToCart(ingredientIds);
    setOrdered(true);
    toast.success(`Added ${recipe.name} ingredients to cart!`);
  };

  const handleGoToCart = () => {
    navigate("/marketplace");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8F9FA] pb-4 mx-auto max-w-[430px]">
      <div className="bg-white px-4 pt-safe pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/recipes")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-2xl">
            {recipe.image_emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{recipe.name}</h1>
            <p className="text-xs text-gray-400">{new Date(recipe.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Nutrition card */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-orange-500" />
            <p className="text-[13px] font-extrabold text-slate-900">Per Serving</p>
            <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1">
              <Users className="h-3 w-3" /> {recipe.servings} servings
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-orange-50 p-2.5">
              <p className="text-[18px] font-extrabold text-slate-900">{recipe.calories_per_serving}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">calories</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-2.5">
              <Beef className="h-4 w-4 text-rose-500 mx-auto mb-0.5" />
              <p className="text-[18px] font-extrabold text-slate-900">{recipe.protein_per_serving}g</p>
              <p className="text-[9px] text-slate-400 mt-0.5">protein</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5">
              <Wheat className="h-4 w-4 text-amber-500 mx-auto mb-0.5" />
              <p className="text-[18px] font-extrabold text-slate-900">{recipe.carbs_per_serving}g</p>
              <p className="text-[9px] text-slate-400 mt-0.5">carbs</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-2.5">
              <Droplets className="h-4 w-4 text-purple-500 mx-auto mb-0.5" />
              <p className="text-[18px] font-extrabold text-slate-900">{recipe.fat_per_serving}g</p>
              <p className="text-[9px] text-slate-400 mt-0.5">fat</p>
            </div>
          </div>
        </div>

        {/* Ingredients list */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-[12px] font-semibold text-slate-500 mb-3">
            Ingredients ({recipe.ingredients.length})
          </p>
          <div className="space-y-2">
            {recipe.ingredients.map((ri) => {
              const ing = catalog.find((i) => i.id === ri.ingredientId);
              const cal = ing ? Math.round(ing.calories_per_100g * (ri.amount_g / 100)) : 0;
              return (
                <div key={ri.ingredientId} className="flex items-center gap-3 py-1.5">
                  <span className="text-xl">{ing?.image_url || "🍽️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-700 truncate">{ri.ingredientName}</p>
                    <p className="text-[10px] text-slate-400">{ri.amount_g}g · ~{cal} cal{ing ? ` · ${ing.price_qar} QAR` : ""}</p>
                  </div>
                  {ing && <span className="text-[10px] text-emerald-600 font-semibold">{ing.price_qar} QAR</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        {recipe.instructions && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              <p className="text-[12px] font-semibold text-slate-500">Instructions</p>
            </div>
            <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{recipe.instructions}</p>
          </div>
        )}

        {/* Order button */}
        <div className="flex gap-2">
          {!ordered ? (
            <Button onClick={handleOrderIngredients}
              className="flex-1 h-[52px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-[15px] gap-2 shadow-lg shadow-emerald-500/20">
              <ShoppingCart className="h-5 w-5" />
              Order All Ingredients
            </Button>
          ) : (
            <Button onClick={handleGoToCart}
              className="flex-1 h-[52px] rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-extrabold text-[15px] gap-2 shadow-lg shadow-violet-500/20">
              <ShoppingCart className="h-5 w-5" />
              View Cart & Checkout
            </Button>
          )}
        </div>

        {recipe.description && (
          <p className="text-center text-[11px] text-slate-400 px-4">{recipe.description}</p>
        )}
      </div>
    </motion.div>
  );
}
