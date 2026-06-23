import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Loader2, MessageSquare, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePopularCombos } from "@/hooks/usePopularCombos";
import { supabase } from "@/integrations/supabase/client";

export function PopularCombos() {
  const { t } = useLanguage();
  const { combos, loading } = usePopularCombos();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardWidth = 170;

  const handleScroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const nextPosition = dir === "right" ? scrollPos + cardWidth : Math.max(0, scrollPos - cardWidth);
    scrollRef.current.scrollTo({ left: nextPosition, behavior: "smooth" });
    setScrollPos(nextPosition);
  };

  const maxScroll = scrollRef.current ? scrollRef.current.scrollWidth - scrollRef.current.clientWidth : 0;

  useEffect(() => {
    if (!user || combos.length === 0) return;

    const mealIds = combos.map((combo) => combo.comboMeals[0]?.meal_id).filter(Boolean);
    if (!mealIds.length) return;

    supabase
      .from("favorites")
      .select("meal_id")
      .eq("user_id", user.id)
      .in("meal_id", mealIds)
      .then(({ data }) => {
        setLikedIds(new Set((data || []).map((row) => `combo-${row.meal_id}`)));
      });
  }, [combos, user]);

  const handleLike = async (comboId: string) => {
    if (!user) {
      toast.error("Sign in");
      return;
    }
    if (likingId) return;

    const mealId = comboId.replace("combo-", "");
    setLikingId(comboId);

    try {
      if (likedIds.has(comboId)) {
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("meal_id", mealId);
        setLikedIds((prev) => {
          const next = new Set(prev);
          next.delete(comboId);
          return next;
        });
        toast.success("Removed");
      } else {
        await supabase.from("favorites").upsert({ user_id: user.id, meal_id: mealId }, { onConflict: "user_id,meal_id" });
        setLikedIds((prev) => new Set(prev).add(comboId));
        toast.success("Added");
      }
    } catch {
      toast.error("Error");
    } finally {
      setLikingId(null);
    }
  };

  const handleSelectCombo = (combo: (typeof combos)[0]) => {
    if (!user) {
      toast.error("Sign in");
      return;
    }
    navigate(`/schedule?combo=${combo.comboMeals.map((meal) => meal.meal_id).join(",")}`);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[16px] font-extrabold text-slate-900">{t("community_popular_combos")}</h2>
        </div>
        <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 pr-5">
            {[1, 2, 3].map((item) => (
              <div key={item} className="w-[158px] shrink-0 animate-pulse rounded-[24px] bg-white p-3 ring-1 ring-slate-100">
                <div className="h-[108px] w-full rounded-[20px] bg-slate-200" />
                <div className="mt-3 h-3 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-2 w-1/2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (combos.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[16px] font-extrabold text-slate-900">{t("community_popular_combos")}</h2>
        <button
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-700 hover:text-slate-950"
          onClick={() => navigate("/meals")}
        >
          {t("community_view_all")} <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => setScrollPos(event.currentTarget.scrollLeft)}
        >
          <div className="flex gap-3 pr-5">
            {combos.map((combo) => {
              const isSelected = selectedComboId === combo.id;

              return (
                <motion.div
                  key={combo.id}
                  whileTap={{ scale: 0.975 }}
                  onClick={() => setSelectedComboId(combo.id)}
                  className={`group w-[158px] shrink-0 overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.07)] ring-1 transition-all ${
                    isSelected ? "ring-2 ring-[#020617]" : "ring-slate-100"
                  }`}
                >
                  <div className="relative h-[108px] w-full overflow-hidden">
                    {combo.image ? (
                      <>
                        <img
                          src={combo.image}
                          alt={combo.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                        <Utensils className="h-8 w-8 text-slate-400" />
                      </div>
                    )}

                    <button
                      className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all ${
                        likedIds.has(combo.id) ? "bg-rose-500 text-white" : "bg-white/90 text-slate-500 hover:bg-white"
                      }`}
                      aria-label="Like"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleLike(combo.id);
                      }}
                      disabled={likingId === combo.id}
                    >
                      {likingId === combo.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Heart className={`h-3.5 w-3.5 ${likedIds.has(combo.id) ? "fill-white" : ""}`} />
                      )}
                    </button>

                    <div className="absolute bottom-2 left-2 rounded-full bg-black/35 px-2 py-0.5 backdrop-blur-sm">
                      <span className="text-[10px] font-semibold text-white/90">by {combo.author}</span>
                    </div>
                  </div>

                  <div className="space-y-2 p-3">
                    <h3 className="line-clamp-2 min-h-[34px] text-[13px] font-extrabold leading-[1.2] text-slate-900">{combo.title}</h3>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {combo.likes}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {combo.comments}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {combo.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {isSelected && (
                      <div className="space-y-1 rounded-[16px] bg-slate-50 p-2">
                        {combo.comboMeals.slice(0, 3).map((meal) => (
                          <div key={meal.meal_id} className="flex items-center gap-2">
                            {meal.image_url ? (
                              <img src={meal.image_url} alt={meal.name} className="h-7 w-7 rounded-[10px] object-cover" />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-white text-slate-500">
                                <Utensils className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <p className="min-w-0 flex-1 truncate text-[10px] font-black text-slate-700">{meal.name}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-full bg-[#020617] text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(2,6,23,0.18)] transition active:scale-[0.98]"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSelectCombo(combo);
                      }}
                    >
                      Select combo <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
        {scrollPos > 0 && (
          <button
            onClick={() => handleScroll("left")}
            className="absolute -left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.1)] ring-1 ring-slate-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4 text-slate-500" />
          </button>
        )}
        {scrollPos < maxScroll - 8 && (
          <button
            onClick={() => handleScroll("right")}
            className="absolute -right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.1)] ring-1 ring-slate-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
}

export default PopularCombos;
