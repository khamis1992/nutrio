import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, ChevronRight, ChefHat, Calendar, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { fadeInUp } from "@/lib/animations";

interface VIPExclusiveMeal {
  id: string;
  name: string;
  image_url: string | null;
  restaurant_name: string | null;
}

export function VIPExclusivesCard() {
  const { t } = useLanguage();
  const [exclusiveMeals, setExclusiveMeals] = useState<VIPExclusiveMeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchExclusives = async () => {
      try {
        const { data, error } = await supabase
          .from("public_meal_catalog" as "meals")
          .select("id, name, image_url, restaurant:restaurant_id(name)")
          .eq("is_vip_exclusive", true)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(4);

        if (error) throw error;

        if (!cancelled) {
          setExclusiveMeals(
            (data || []).map((m: Record<string, unknown>) => ({
              id: String(m.id),
              name: String(m.name),
              image_url: m.image_url as string | null,
              restaurant_name: m.restaurant && typeof m.restaurant === "object"
                ? String((m.restaurant as Record<string, unknown>).name || "")
                : null,
            }))
          );
        }
      } catch (err) {
        console.error("VIPExclusivesCard fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchExclusives();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-4 animate-pulse">
        <div className="h-5 w-40 bg-amber-200 rounded mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-amber-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={fadeInUp}>
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 border border-amber-200 overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900">
              {t("vip_exclusives_title") || "VIP Exclusives"}
            </h3>
            <p className="text-[10px] text-amber-600">
              {t("vip_exclusives_subtitle") || "Premium perks just for you"}
            </p>
          </div>
        </div>

        <div className="px-4 py-2 space-y-2">
          {exclusiveMeals.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ChefHat className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold text-amber-800">
                  {t("vip_meals_this_week") || "VIP Meals This Week"}
                </span>
              </div>
              <div className="space-y-1.5">
                {exclusiveMeals.slice(0, 3).map((meal) => (
                  <Link
                    key={meal.id}
                    to={`/meal/${meal.id}`}
                    className="flex items-center gap-3 p-2 rounded-xl bg-white/60 hover:bg-white/90 border border-amber-100 hover:border-amber-300 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-100 overflow-hidden shrink-0">
                      {meal.image_url ? (
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ChefHat className="w-5 h-5 text-amber-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {meal.name}
                      </p>
                      {meal.restaurant_name && (
                        <p className="text-[10px] text-slate-500 truncate">
                          {meal.restaurant_name}
                        </p>
                      )}
                    </div>
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Link
            to="/meals?vip=1"
            className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 hover:bg-white/90 border border-amber-100 hover:border-amber-300 transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <span className="text-xs font-semibold text-slate-700">
                {t("vip_view_all_exclusives") || "View All VIP Meals"}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </Link>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/60 border border-amber-100">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-700">
                {t("vip_coach_credit") || "Coach Session Credit"}
              </p>
              <p className="text-[10px] text-amber-600">
                {t("vip_coach_credit_desc") || "1 free session this month"}
              </p>
            </div>
            <BadgeCheck className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="flex items-center justify-center gap-1 py-1">
            <Crown className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-medium text-amber-600">
              {t("vip_early_access") || "Early access to new meals"}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
