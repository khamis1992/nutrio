import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, MessageSquare, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePopularCombos } from "@/hooks/usePopularCombos";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PopularCombos() {
  const { combos, loading } = usePopularCombos();
  const { user } = useAuth(); const navigate = useNavigate();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardWidth = 138;

  const handleScroll = (dir: "left" | "right") => { if (!scrollRef.current) return; const n = dir === "right" ? scrollPos + cardWidth : Math.max(0, scrollPos - cardWidth); scrollRef.current.scrollTo({ left: n, behavior: "smooth" }); setScrollPos(n); };
  const maxScroll = scrollRef.current ? scrollRef.current.scrollWidth - scrollRef.current.clientWidth : 0;

  const handleLike = async (comboId: string) => { if (!user) { toast.error("Sign in"); return; } if (likingId) return; setLikingId(comboId); try { if (likedIds.has(comboId)) { await supabase.from("favorites").delete().eq("user_id", user.id).eq("meal_id", comboId.replace("combo-", "")); setLikedIds((p) => { const n = new Set(p); n.delete(comboId); return n; }); toast.success("Removed"); } else { await supabase.from("favorites").upsert({ user_id: user.id, meal_id: comboId.replace("combo-", "") }, { onConflict: "user_id,meal_id" }); setLikedIds((p) => new Set(p).add(comboId)); toast.success("Added"); } } catch { toast.error("Error"); } finally { setLikingId(null); } };
  const handleTryCombo = (combo: typeof combos[0]) => { if (!user) { toast.error("Sign in"); return; } navigate(`/schedule?combo=${combo.comboMeals.map((m) => m.meal_id).join(",")}`); };

  if (loading) return (<div className="space-y-3"><div className="flex items-center justify-between px-1"><h2 className="text-[16px] font-extrabold text-slate-900">Popular Combos</h2></div><div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"><div className="flex gap-3 pr-5">{[1,2,3,4].map((i)=>(<div key={i} className="w-[130px] shrink-0 animate-pulse rounded-xl bg-slate-50 p-3"><div className="h-[108px] w-full rounded-lg bg-slate-200" /><div className="mt-2 h-3 w-3/4 rounded bg-slate-200" /><div className="mt-1 h-2 w-1/2 rounded bg-slate-100" /></div>))}</div></div></div>);
  if (combos.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[16px] font-extrabold text-slate-900">Popular Combos</h2>
        <button className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1" onClick={() => navigate("/meals")}>View All <ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="relative">
        <div ref={scrollRef} className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onScroll={(e) => setScrollPos(e.currentTarget.scrollLeft)}>
          <div className="flex gap-3 pr-5">
            {combos.map((combo) => (
            <motion.div key={combo.id} whileTap={{ scale: 0.975 }} className="group w-[130px] shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-shadow">
              <div className="relative h-[108px] w-full overflow-hidden">
                {combo.image ? (<><img src={combo.image} alt={combo.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" /></>)
                : <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center"><span className="text-3xl">🥗</span></div>}
                <button className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-all ${likedIds.has(combo.id)?"bg-rose-500 text-white":"bg-white/90 text-slate-500 hover:bg-white"}`} aria-label="Like" onClick={(e)=>{e.stopPropagation();handleLike(combo.id);}} disabled={likingId===combo.id}>{likingId===combo.id?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Heart className={`h-3.5 w-3.5 ${likedIds.has(combo.id)?"fill-white":""}`}/>}</button>
                <div className="absolute bottom-2 left-2 rounded-full bg-black/30 px-2 py-0.5 backdrop-blur-sm"><span className="text-[10px] font-semibold text-white/90">by {combo.author}</span></div>
              </div>
              <div className="p-3 space-y-2">
                <h3 className="line-clamp-2 min-h-[34px] text-[13px] font-extrabold leading-[1.2] text-slate-900">{combo.title}</h3>
                <div className="flex items-center gap-3 text-[11px] text-slate-400"><span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {combo.likes}</span><span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {combo.comments}</span></div>
                <div className="flex flex-wrap gap-1.5">{combo.tags.slice(0,2).map((t)=>(<span key={t} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">{t}</span>))}{combo.tags.length>2&&<span className="text-[9px] text-slate-400">+{combo.tags.length-2}</span>}</div>
                <button className="w-full h-9 rounded-full bg-slate-50 text-[12px] font-extrabold text-slate-600 hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-1" onClick={()=>handleTryCombo(combo)}>Try Combo <ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </motion.div>
          ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
        {scrollPos>0&&<button onClick={()=>handleScroll("left")} className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.1)] ring-1 ring-slate-100" aria-label="Scroll left"><ChevronLeft className="h-4 w-4 text-slate-500" /></button>}
        {scrollPos<maxScroll-8&&<button onClick={()=>handleScroll("right")} className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.1)] ring-1 ring-slate-100" aria-label="Scroll right"><ChevronRight className="h-4 w-4 text-slate-500" /></button>}
      </div>
    </div>
  );
}
export default PopularCombos;
