import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Dumbbell, ChevronRight, ChefHat, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeaturedMeal {
  id: string;
  name: string;
  calories: number | null;
  image_url: string | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  meal_type: string | null;
  restaurant_name: string;
  restaurant_rating: number;
  is_featured: boolean | null;
  featured_priority: number | null;
}

interface FeaturedHeroStripProps {
  meals: FeaturedMeal[];
}

const calorieColor = (cal: number): string => {
  if (cal >= 600) return "bg-red-100 text-red-700";
  if (cal >= 400) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
};

export function FeaturedHeroStrip({ meals }: FeaturedHeroStripProps) {
  if (meals.length === 0) return null;

  const sorted = [...meals].sort((a, b) => (b.featured_priority ?? 0) - (a.featured_priority ?? 0));

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ChefHat className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div>
            <h2 className="text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-[#151D2B]">{t("featured_this_week")}</h2>
            <p className="mt-0.5 text-[15px] font-medium leading-tight text-[#748096]">{t("chefs_top_recommendations")}</p>
          </div>
        </div>
      </div>

      <div className="-mx-5 overflow-x-auto px-5 pb-2 scrollbar-hide snap-x snap-mandatory">
        <div className="flex gap-4 pb-1">
          {sorted.map((meal, i) => (
            <motion.div
              key={meal.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start"
            >
              <Link to={`/meals/${meal.id}`} className="block group">
                <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)] ring-1 ring-slate-100 transition hover:shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                  <div className="relative h-[180px] sm:h-[200px] overflow-hidden">
                    <img
                      src={meal.image_url ?? ""}
                      alt={meal.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-400"
                      loading="lazy"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                    <div className="absolute top-3 left-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-amber-500/95 px-3 py-1 text-[12px] font-extrabold text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)] backdrop-blur-sm">
                        Featured
                      </span>
                      {meal.meal_type && (
                        <span className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-bold text-white backdrop-blur-sm">
                          {meal.meal_type}
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-[18px] sm:text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-white drop-shadow-lg">
                        {meal.name}
                      </h3>
                      <p className="mt-1 text-[13px] font-semibold text-white/80">
                        {meal.restaurant_name}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 pb-4 pt-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {meal.calories != null && (
                        <span className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-extrabold", calorieColor(meal.calories))}>
                          <Flame className="h-3.5 w-3.5" strokeWidth={2.4} />
                          {meal.calories} kcal
                        </span>
                      )}
                      {meal.protein_g != null && (
                        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-blue-100 px-2.5 text-[13px] font-extrabold text-blue-700">
                          <Dumbbell className="h-3.5 w-3.5" strokeWidth={2.4} />
                          P {Math.round(meal.protein_g)}g
                        </span>
                      )}
                      {meal.carbs_g != null && (
                        <span className="text-[12px] font-semibold text-slate-500">
                          C {Math.round(meal.carbs_g)}g
                        </span>
                      )}
                      {meal.fat_g != null && (
                        <span className="text-[12px] font-semibold text-slate-500">
                          F {Math.round(meal.fat_g)}g
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center gap-1 text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                      <span className="text-[12px] font-bold">
                        {meal.restaurant_rating.toFixed(1)}
                      </span>
                      <ChevronRight className="ml-auto h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
