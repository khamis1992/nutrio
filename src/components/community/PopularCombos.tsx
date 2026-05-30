import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, MessageSquare, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePopularCombos } from "@/hooks/usePopularCombos";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PopularCombos() {
  const { combos, loading } = usePopularCombos();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardWidth = 134;

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const newPos = direction === "right" ? scrollPos + cardWidth : Math.max(0, scrollPos - cardWidth);
    scrollRef.current.scrollTo({ left: newPos, behavior: "smooth" });
    setScrollPos(newPos);
  };

  const maxScroll = scrollRef.current
    ? scrollRef.current.scrollWidth - scrollRef.current.clientWidth
    : 0;
  const canScrollLeft = scrollPos > 0;
  const canScrollRight = scrollPos < maxScroll - 8;

  const handleLike = async (comboId: string) => {
    if (!user) {
      toast.error("Sign in to save favorites");
      return;
    }
    if (likingId) return;
    setLikingId(comboId);
    try {
      if (likedIds.has(comboId)) {
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("meal_id", comboId.replace("combo-", ""));
        setLikedIds((prev) => { const next = new Set(prev); next.delete(comboId); return next; });
        toast.success("Removed from favorites");
      } else {
        await supabase.from("favorites").upsert({ user_id: user.id, meal_id: comboId.replace("combo-", "") }, { onConflict: "user_id,meal_id" });
        setLikedIds((prev) => new Set(prev).add(comboId));
        toast.success("Added to favorites");
      }
    } catch {
      toast.error("Couldn't update favorites");
    } finally {
      setLikingId(null);
    }
  };

  const handleTryCombo = (combo: typeof combos[0]) => {
    if (!user) {
      toast.error("Sign in to try combos");
      return;
    }
    // Navigate to schedule with combo meals pre-selected
    const mealIds = combo.comboMeals.map((m) => m.meal_id).join(",");
    navigate(`/schedule?combo=${mealIds}`);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-foreground">Popular Combos</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto px-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[126px] shrink-0 animate-pulse rounded-[17px] border border-gray-100 bg-white p-3">
              <div className="h-[105px] w-full rounded-xl bg-slate-200" />
              <div className="mt-2 h-3 w-3/4 rounded bg-slate-200" />
              <div className="mt-1.5 h-2 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (combos.length === 0) return null;

  const items = combos;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-foreground">Popular Combos</h2>
        <button
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          onClick={() => navigate("/meals")}
        >
          View All <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="-mx-8 overflow-x-auto px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => setScrollPos(e.currentTarget.scrollLeft)}
        >
          <div className="flex gap-3 pr-8">
            {items.map((combo) => (
            <motion.div
              key={combo.id}
              whileTap={{ scale: 0.98 }}
              className="w-[126px] shrink-0 overflow-hidden rounded-[17px] border border-gray-100 bg-white shadow-[0_7px_20px_rgba(15,23,42,0.08)]"
            >
              <div className="relative h-[105px] w-full overflow-hidden">
                {combo.image ? (
                  <img
                    src={combo.image}
                    alt={combo.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
                    <span className="text-emerald-600 text-[11px] font-bold">{combo.title.charAt(0)}</span>
                  </div>
                )}
                <button
                  className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full shadow transition-colors ${
                    likedIds.has(combo.id) ? "bg-red-500 text-white" : "bg-white/95 text-slate-700"
                  }`}
                  aria-label={likedIds.has(combo.id) ? "Unlike" : "Like"}
                  onClick={() => handleLike(combo.id)}
                  disabled={likingId === combo.id}
                >
                  {likingId === combo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className={`h-4 w-4 ${likedIds.has(combo.id) ? "fill-white" : ""}`} />
                  )}
                </button>
              </div>

              <div className="space-y-2 p-3">
                <div>
                  <h3 className="line-clamp-2 min-h-[32px] text-[13px] font-extrabold leading-4 text-foreground">
                    {combo.title}
                  </h3>
                  <p className="truncate text-[11px] text-muted-foreground">by {combo.author}</p>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <div className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {combo.likes}
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> {combo.comments}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {combo.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[9px] font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <button
                  className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1 rounded-[11px] bg-emerald-50 text-[12px] font-extrabold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  onClick={() => handleTryCombo(combo)}
                >
                  Try Combo <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
          </div>
        </div>

        {canScrollLeft && (
          <button
            onClick={() => handleScroll("left")}
            className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(15,23,42,0.12)] ring-1 ring-slate-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => handleScroll("right")}
            className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(15,23,42,0.12)] ring-1 ring-slate-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        )}
      </div>
    </div>
  );
}

export default PopularCombos;
