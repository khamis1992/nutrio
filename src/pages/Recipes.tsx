import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, ChefHat, Flame, Beef, Wheat, Droplets, Users, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecipes, deleteRecipe, type Recipe } from "@/lib/recipeStore";
import { useAuth } from "@/contexts/AuthContext";

export default function Recipes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>(() => getRecipes(user?.id));

  useEffect(() => {
    setRecipes(getRecipes(user?.id));
  }, [user?.id]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    deleteRecipe(user.id, id);
    setRecipes(getRecipes(user.id));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8F9FA] pb-4 mx-auto max-w-[430px]">
      <div className="bg-white px-4 pt-safe pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <ChefHat className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">My Recipes</h1>
            <p className="text-sm text-gray-500">Cook and track your own meals</p>
          </div>
          <Button onClick={() => navigate("/recipes/new")} size="sm"
            className="rounded-full bg-emerald-500 hover:bg-emerald-600 h-10 px-4 gap-1.5">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <AnimatePresence>
          {recipes.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center">
              <ChefHat className="h-16 w-16 text-slate-200 mb-4" />
              <h2 className="text-lg font-bold text-slate-700">No recipes yet</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-[250px]">
                Create your first recipe and get automatic macro calculations
              </p>
              <Button onClick={() => navigate("/recipes/new")}
                className="mt-6 rounded-full bg-emerald-500 hover:bg-emerald-600 gap-2">
                <Plus className="h-4 w-4" /> Create Recipe
              </Button>
            </motion.div>
          ) : (
            recipes.map((recipe) => (
              <motion.div key={recipe.id} layout
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-amber-50 text-4xl">
                    {recipe.image_emoji || "🍽️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate">{recipe.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{recipe.description}</p>
                      </div>
                      <button onClick={(e) => handleDelete(recipe.id, e)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 hover:bg-red-100">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" />{recipe.calories_per_serving} cal</span>
                      <span className="flex items-center gap-1"><Beef className="h-3 w-3 text-rose-500" />{recipe.protein_per_serving}g</span>
                      <span className="flex items-center gap-1"><Wheat className="h-3 w-3 text-amber-500" />{recipe.carbs_per_serving}g</span>
                      <span className="flex items-center gap-1"><Droplets className="h-3 w-3 text-purple-500" />{recipe.fat_per_serving}g</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Users className="h-3 w-3" />{recipe.servings} servings
                      </span>
                      <span className="text-[12px] font-semibold text-emerald-600 flex items-center gap-1">
                        View <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
