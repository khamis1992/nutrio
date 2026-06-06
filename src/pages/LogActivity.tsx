import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Search, ArrowLeft, Flame, Clock, Loader2, CheckCircle2,
  Dumbbell, Link, RefreshCw, X, Plus, History, Target,
} from "lucide-react";
import { NavChevronRight } from "@/components/ui/nav-chevron";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { isNative } from "@/lib/capacitor";

// ─── Activity Database ───────────────────────────────────────────────────────
interface Activity {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  met: number;
  emoji: string;
}

const ACTIVITIES: Activity[] = [
  { id: "walking_slow",     name: "Walking (slow)",       nameAr: "المشي (بطيء)",        category: "Cardio",      met: 2.5,  emoji: "🚶" },
  { id: "walking_moderate", name: "Walking (moderate)",   nameAr: "المشي (معتدل)",       category: "Cardio",      met: 3.5,  emoji: "🚶" },
  { id: "walking_fast",     name: "Walking (fast)",       nameAr: "المشي (سريع)",        category: "Cardio",      met: 4.5,  emoji: "🚶‍♂️" },
  { id: "running_5mph",     name: "Running (5 mph)",      nameAr: "الجري (8 ك/س)",       category: "Cardio",      met: 8.3,  emoji: "🏃" },
  { id: "running_6mph",     name: "Running (6 mph)",      nameAr: "الجري (10 ك/س)",      category: "Cardio",      met: 9.8,  emoji: "🏃" },
  { id: "running_7mph",     name: "Running (7+ mph)",     nameAr: "الجري (11+ ك/س)",     category: "Cardio",      met: 11.0, emoji: "🏃‍♂️" },
  { id: "cycling_light",    name: "Cycling (light)",      nameAr: "ركوب الدراجة (خفيف)", category: "Cardio",      met: 4.0,  emoji: "🚴" },
  { id: "cycling_moderate", name: "Cycling (moderate)",   nameAr: "ركوب الدراجة (معتدل)", category: "Cardio",      met: 8.0,  emoji: "🚴" },
  { id: "swimming",         name: "Swimming",             nameAr: "السباحة",             category: "Cardio",      met: 6.0,  emoji: "🏊" },
  { id: "jump_rope",        name: "Jump Rope",            nameAr: "تخطي الحبل",          category: "Cardio",      met: 10.0, emoji: "⚡" },
  { id: "elliptical",       name: "Elliptical",           nameAr: "جهاز الإليبتيكال",    category: "Cardio",      met: 5.0,  emoji: "🔄" },
  { id: "rowing",           name: "Rowing",               nameAr: "التجديف",             category: "Cardio",      met: 7.0,  emoji: "🚣" },
  { id: "stair_climbing",   name: "Stair Climbing",       nameAr: "تسلق الدرج",          category: "Cardio",      met: 8.0,  emoji: "🪜" },
  { id: "hiit",             name: "HIIT",                 nameAr: "تدريب متقطع عالي",    category: "Cardio",      met: 8.0,  emoji: "🔥" },
  { id: "weight_training",  name: "Weight Training",      nameAr: "تدريب بالأوزان",      category: "Strength",    met: 3.5,  emoji: "🏋️" },
  { id: "bodyweight",       name: "Bodyweight Training",  nameAr: "تدريب بوزن الجسم",    category: "Strength",    met: 3.8,  emoji: "💪" },
  { id: "crossfit",         name: "CrossFit",             nameAr: "كروس فت",             category: "Strength",    met: 5.0,  emoji: "🏋️‍♂️" },
  { id: "yoga",             name: "Yoga",                 nameAr: "يوغا",                category: "Flexibility", met: 2.5,  emoji: "🧘" },
  { id: "pilates",          name: "Pilates",              nameAr: "بيلاتيس",             category: "Flexibility", met: 3.0,  emoji: "🧘‍♀️" },
  { id: "stretching",       name: "Stretching",           nameAr: "تمارين الإطالة",      category: "Flexibility", met: 2.3,  emoji: "🤸" },
  { id: "basketball",       name: "Basketball",           nameAr: "كرة السلة",           category: "Sports",      met: 6.5,  emoji: "🏀" },
  { id: "soccer",           name: "Soccer",               nameAr: "كرة القدم",           category: "Sports",      met: 7.0,  emoji: "⚽" },
  { id: "tennis",           name: "Tennis",               nameAr: "التنس",               category: "Sports",      met: 7.3,  emoji: "🎾" },
  { id: "dancing",          name: "Dancing",              nameAr: "الرقص",               category: "Sports",      met: 4.5,  emoji: "💃" },
  { id: "martial_arts",     name: "Martial Arts",         nameAr: "فنون القتال",         category: "Sports",      met: 5.0,  emoji: "🥋" },
];

const CATEGORIES = ["All", "Cardio", "Strength", "Flexibility", "Sports"];

const CATEGORY_COLORS: Record<string, string> = {
  Cardio: "text-[#FF1717]",
  Strength: "text-[#189BFF]",
  Flexibility: "text-[#A54DF4]",
  Sports: "text-[#FF850F]",
};

const CATEGORY_COLORS_HEX: Record<string, string> = {
  Cardio: "#FF1717",
  Strength: "#189BFF",
  Flexibility: "#A54DF4",
  Sports: "#FF850F",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface LoggedSession {
  id: string;
  workout_type: string;
  duration_minutes: number;
  calories_burned: number;
}

// ─── Illustration (same as LogActivitySheet) ─────────────────────────────────
function ActivityIllustration({ activity }: { activity: Activity }) {
  const accent = CATEGORY_COLORS_HEX[activity.category] ?? "#10A86C";
  const dark = "#111827";
  const W = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#EAFBF4]">
      <svg className="h-10 w-10" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{children}</svg>
    </div>
  );

  if (activity.id === "walking_slow")       return (<W><circle cx="24" cy="10" r="3.5" fill={dark}/><path d="m22 14 4-2v6l-3 8 6 3 5-14-3 13-4 3v6" fill={dark}/><path d="M20 38h2M27 27l5 15M16 22l-2 8" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/></W>);
  if (activity.id === "walking_moderate")   return (<W><circle cx="25" cy="9" r="3.5" fill={dark}/><path d="m23 13 5-2v7l-5 12 7 2 5-15-4 12-5 4v6" fill={dark}/><path d="M18 32l-2 10M28 25l5 15" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/></W>);
  if (activity.id === "walking_fast")       return (<W><circle cx="27" cy="8" r="3.5" fill={dark}/><path d="m25 13 6-3v9l-6 13 7 2 4-16-5 13-5 4v6" fill={dark}/><path d="M17 35l-3 10M30 23l5 17M36 18l3-2" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/></W>);
  if (activity.id === "running_5mph")       return (<W><circle cx="28" cy="7" r="3.5" fill={dark}/><path d="m26 12 6-2-4 8-6 7-2 10h-3l-2-8 6-7 3-6 2-2Z" fill={dark}/><path d="M10 32l5-3M33 16l6-5" stroke={accent} strokeWidth="2" strokeLinecap="round"/></W>);
  if (activity.id === "running_6mph")       return (<W><circle cx="29" cy="6" r="3.5" fill={dark}/><path d="m26 11 7-3-4 7-7 8-2 12h-4l-1-9 7-8 3-5 1-2Z" fill={dark}/><path d="M8 30l6-4M35 14l7-6" stroke={accent} strokeWidth="2" strokeLinecap="round"/></W>);
  if (activity.id === "running_7mph")       return (<W><circle cx="30" cy="5" r="3.5" fill={dark}/><path d="m27 10 8-3-5 8-7 9-1 13h-5v-10l7-9 3-6v-2Z" fill={dark}/><path d="M6 28l7-5M37 11l8-7" stroke={accent} strokeWidth="2" strokeLinecap="round"/></W>);
  if (activity.id === "cycling_light")      return (<W><circle cx="13" cy="32" r="9" stroke={dark} strokeWidth="2.5"/><circle cx="35" cy="32" r="9" stroke={dark} strokeWidth="2.5"/><circle cx="13" cy="32" r="2" fill={accent}/><circle cx="35" cy="32" r="2" fill={accent}/><path d="M13 32 24 20l11 12M24 20l-4-6a3 3 0 0 1 0-4l2-2" fill={dark}/><circle cx="22" cy="8" r="4" fill={dark}/></W>);
  if (activity.id === "cycling_moderate")   return (<W><circle cx="13" cy="32" r="9" stroke={dark} strokeWidth="2.5"/><circle cx="35" cy="32" r="9" stroke={dark} strokeWidth="2.5"/><circle cx="13" cy="32" r="2" fill={accent}/><circle cx="35" cy="32" r="2" fill={accent}/><path d="M13 32 24 18l11 14M24 18l-5-5a3 3 0 0 1 1-5l2-1" fill={dark}/><circle cx="22" cy="7" r="4" fill={dark}/><path d="M8 29l-3 5M38 25l4 4" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/></W>);
  if (activity.id === "swimming")           return (<W><path d="M10 28c3-3 7-4 10-2s6 3 10 2 6-3 10-2" stroke={dark} strokeWidth="3" strokeLinecap="round"/><path d="M8 34c3-3 7-3 10-1s6 3 10 1 7-3 10-1" stroke={dark} strokeWidth="3" strokeLinecap="round"/><circle cx="18" cy="14" r="4" fill={dark}/><circle cx="22" cy="19" r="1.5" fill={dark}/><circle cx="28" cy="17" r="1.5" fill={dark}/><path d="M18 18v4M14 20l-2 4M32 16l3 3" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/></W>);
  if (activity.id === "jump_rope")          return (<W><circle cx="24" cy="13" r="4.5" fill={dark}/><path d="M24 17.5v3m-3 4-2 6 6 4 4-4-2-6" fill={dark}/><path d="M12 5v38M36 5v38" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/><path d="M12 18c3 3 6 4 9 4v1c-4 0-7 2-9 5" stroke={accent} strokeWidth="2" strokeLinecap="round" fill={accent} fillOpacity="0.12"/></W>);
  if (activity.id === "elliptical")         return (<W><rect x="4" y="10" width="3" height="30" rx="1.5" fill={dark}/><rect x="41" y="10" width="3" height="30" rx="1.5" fill={dark}/><path d="M5.5 16h8v2h-8M5.5 30h8v2h-8M34.5 16h8v2h-8M34.5 30h8v2h-8" fill={dark}/><circle cx="7" cy="40" r="4" fill={accent}/><circle cx="41" cy="40" r="4" fill={accent}/><path d="M13.5 17v9l21 6v-12" fill={dark}/></W>);
  if (activity.id === "rowing")             return (<W><path d="M8 40l8-6 8 6 10-14 6 14" fill={dark}/><path d="m16 32 14-16m14 16L30 16" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/><circle cx="26" cy="6" r="3.5" fill={dark}/></W>);
  if (activity.id === "stair_climbing")     return (<W><path d="M6 40h8v-8h8v-8h8v-8h12" fill={dark}/><circle cx="30" cy="14" r="4" fill={dark}/><path d="M30 18v4m-6 6v2m14-8v2" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/></W>);
  if (activity.id === "hiit")              return (<W><circle cx="24" cy="24" r="15" stroke={dark} strokeWidth="2"/><path d="m18 24 2-4 4 6-2 4-4-2M26 22l3 5-5 3M16 16l3-2M32 32l-3 2M30 16l-2-3" fill={accent}/><circle cx="24" cy="24" r="2" fill={dark}/></W>);
  if (activity.id === "weight_training")    return (<W><path d="M6 20h36" stroke={dark} strokeWidth="4" strokeLinecap="round"/><path d="M10 15v10a3 3 0 0 0 6 0v-8a3 3 0 0 1 6 0v6a3 3 0 0 0 6 0v-8a3 3 0 0 1 6 0v11" fill={accent}/></W>);
  if (activity.id === "bodyweight")         return (<W><circle cx="24" cy="9" r="4" fill={dark}/><path d="M24 13v8m-12 6v14l12 2 12-2V27" fill={dark}/><path d="M12 27h24" stroke={dark} strokeWidth="2.5" strokeLinecap="round"/><path d="M12 27h24" stroke={accent} strokeWidth="1" strokeLinecap="round" strokeDasharray="2 3"/></W>);
  if (activity.id === "crossfit")          return (<W><path d="m20 6 2 4-6 8h16l-6-8 2-4" fill={dark}/><path d="M14 18v8c0 3 4 5 10 5s10-2 10-5v-8" stroke={dark} strokeWidth="2" fill={accent} fillOpacity="0.3"/><line x1="18" y1="18" x2="16" y2="14" stroke={dark} strokeWidth="2.5" strokeLinecap="round"/><line x1="30" y1="18" x2="32" y2="14" stroke={dark} strokeWidth="2.5" strokeLinecap="round"/></W>);
  if (activity.id === "yoga")              return (<W><circle cx="24" cy="13" r="3.5" fill={dark}/><path d="M24 16.5v3m-10 8c0-2 4-4 10-4s10 2 10 4" stroke={dark} strokeWidth="2" strokeLinecap="round"/><path d="M14 27.5v12m20-12v12" stroke={dark} strokeWidth="2.5" strokeLinecap="round"/><path d="M24 19.5v8" stroke={accent} strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="39" r="1.5" fill={accent}/><circle cx="28" cy="39" r="1.5" fill={accent}/></W>);
  if (activity.id === "pilates")           return (<W><circle cx="24" cy="8" r="3.5" fill={dark}/><path d="M24 11.5v7m-10 6h20" stroke={dark} strokeWidth="2" strokeLinecap="round"/><path d="M14 24.5v12l10 2 10-2v-12" fill={dark} fillOpacity="0.15" stroke={dark} strokeWidth="2" strokeLinejoin="round"/><circle cx="24" cy="30" r="6" stroke={accent} strokeWidth="2" /></W>);
  if (activity.id === "stretching")        return (<W><circle cx="24" cy="7" r="3.5" fill={dark}/><path d="M24 10.5v8m-10 4 2-2 2 2-2 2zm20 0-2-2-2 2 2 2z" fill={dark}/><path d="M14 22.5v16l4 2m16-18-4 2v16" stroke={dark} strokeWidth="2.5" strokeLinecap="round"/><path d="M10 40h28" stroke={accent} strokeWidth="2" strokeLinecap="round"/></W>);
  if (activity.id === "basketball")        return (<W><circle cx="24" cy="22" r="10" stroke={dark} strokeWidth="2"/><path d="M24 12v6m0 8v6M14 22h6m8 0h6M24 12a10 10 0 0 0-10 10m20 0a10 10 0 0 0-10-10" stroke={dark} strokeWidth="1.8" strokeLinecap="round"/><circle cx="22" cy="20" r="7" fill={accent} fillOpacity="0.25"/></W>);
  if (activity.id === "soccer")            return (<W><circle cx="24" cy="24" r="11" stroke={dark} strokeWidth="2"/><path d="m24 17-4-4m4 4 4-4m-7 7-4-4m7 7 4-4m-7 7-4 4m7-7 4 4" stroke={dark} strokeWidth="1.5" strokeLinecap="round"/><circle cx="24" cy="24" r="4" fill={accent} fillOpacity="0.3"/></W>);
  if (activity.id === "tennis")            return (<W><circle cx="26" cy="12" r="5" fill={accent} fillOpacity="0.3" stroke={dark} strokeWidth="1.5"/><line x1="26" y1="17" x2="26" y2="42" stroke={dark} strokeWidth="2" strokeLinecap="round"/><path d="M26 37v-7h-8l2 7h-6l4-7" fill={dark}/><path d="M21 20 14 10M26 12l5 8" stroke={dark} strokeWidth="2" strokeLinecap="round"/></W>);
  if (activity.id === "dancing")           return (<W><circle cx="27" cy="7" r="3.5" fill={dark}/><path d="m25 12 6-2-4 6-4 8-8-2 2 6 8 2 5 8-3 6-12-6 4 8 14 6-16 6 6-8-18 4 10-10-4-8 14 4 4-8 4-6-4-8Z" fill={dark}/><circle cx="19" cy="22" r="1.5" fill={accent}/><circle cx="25" cy="36" r="1.5" fill={accent}/></W>);
  if (activity.id === "martial_arts")      return (<W><circle cx="30" cy="8" r="3.5" fill={dark}/><path d="M30 11.5 18 20m12-8.5v7" stroke={dark} strokeWidth="2" strokeLinecap="round"/><path d="M18 20v12m0-12 10 8v10l-6-2" fill={dark}/><circle cx="24" cy="26" r="2" fill={accent}/></W>);

  return (<div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#EAFBF4]"><span className="text-3xl">{activity.emoji}</span></div>);
}

// ─── Category Pill Icon ──────────────────────────────────────────────────────
function CategoryIcon({ category, active }: { category: string; active: boolean }) {
  if (category === "All") return null;
  const colorClass = active ? "text-white" : (CATEGORY_COLORS[category] ?? "text-[#7A869A]");
  if (category === "Cardio") return (<svg className={`h-6 w-6 ${colorClass}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19.4 5.6c-1.9-1.7-4.8-1.5-6.5.4l-.9 1-.9-1c-1.7-1.9-4.6-2.1-6.5-.4-2.1 1.9-2.2 5.2-.2 7.2l7.6 7.5 7.6-7.5c2-2 1.9-5.3-.2-7.2Z" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/></svg>);
  if (category === "Strength") return <Dumbbell className={`h-6 w-6 ${colorClass}`} strokeWidth={2.1} aria-hidden="true" />;
  if (category === "Flexibility") return (<svg className={`h-6 w-6 ${colorClass}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" stroke="currentColor" strokeWidth="2"/><path d="M12 7.75v6.5M7 10.25h10M8.25 19.25c1.1-2 2.35-3 3.75-3s2.65 1 3.75 3M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
  return (<svg className={`h-6 w-6 ${colorClass}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M7 5.8c2.4 1.6 3.8 3.7 4.1 6.2.3 2.4-.4 4.6-2.1 6.7M17 5.8c-2.4 1.6-3.8 3.7-4.1 6.2-.3 2.4.4 4.6 2.1 6.7M3.3 12h17.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
}

// ─── Main Page Component ─────────────────────────────────────────────────────
export default function LogActivity() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { t, isRTL } = useLanguage();
  const activityName = (a: Activity) => isRTL ? a.nameAr : a.name;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const weightKg = profile?.current_weight_kg ?? 70;

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      All: t("log_activity_filter_all"),
      Cardio: t("log_activity_cat_cardio"),
      Strength: t("log_activity_cat_strength"),
      Flexibility: t("log_activity_cat_flexibility"),
      Sports: t("log_activity_cat_sports"),
    };
    return map[cat] ?? cat;
  };

  const [tab, setTab] = useState<"log" | "sessions">("log");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sessions, setSessions] = useState<LoggedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [googleFitConnected, setGoogleFitConnected] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalBurned = sessions.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoadingSessions(true);
    const { data } = await supabase
      .from("workout_sessions")
      .select("id, workout_type, duration_minutes, calories_burned")
      .eq("user_id", user.id)
      .eq("session_date", todayStr)
      .order("created_at", { ascending: false });
    if (data) setSessions(data as LoggedSession[]);
    setLoadingSessions(false);
  }, [user, todayStr]);

  useEffect(() => {
    loadSessions();
    const storedToken = localStorage.getItem("google_fit_access_token");
    setGoogleFitConnected(!!storedToken);
  }, [loadSessions]);

  const filtered = ACTIVITIES.filter((a) => {
    const matchesCategory = category === "All" || a.category === category;
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedByCategory = CATEGORIES.filter((c) => c !== "All").reduce<Record<string, Activity[]>>((acc, cat) => {
    const items = filtered.filter((a) => a.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const quickLog = async (activity: Activity) => {
    if (!user) return;
    setSaving(true);
    try {
      const mins = 30;
      const cal = Math.round(activity.met * weightKg * (mins / 60));
      const { error } = await supabase.from("workout_sessions").insert({
        user_id: user.id,
        session_date: todayStr,
        workout_type: activity.name,
        duration_minutes: mins,
        calories_burned: cal,
      });
      if (error) throw error;
      toast.success(t("log_activity_success_title"), { description: t("log_activity_success_desc").replace("{name}", activity.name).replace("{cal}", String(cal)) });
      await loadSessions();
    } catch {
      toast.error(t("log_activity_failed_title"), { description: t("log_activity_failed_desc") });
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (id: string) => {
    if (!user) return;
    await supabase.from("workout_sessions").delete().eq("id", id).eq("user_id", user.id);
    await loadSessions();
  };

  return (
    <div className="min-h-screen bg-[#F8FFFB]">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1BD37F] to-[#14B869] px-5 pb-6 pt-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[32px] font-black tracking-[-0.03em] text-white">{t("log_activity")}</h1>
        <p className="mt-1 text-[15px] font-medium text-white/80">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
        {totalBurned > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold text-white">
            <Flame className="h-4 w-4" />
            <span>{t("log_activity_cal_burned_today").replace("{total}", String(totalBurned))}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="-mt-4 rounded-t-[28px] bg-[#F8FFFB] px-5 pt-6">
        <div className="flex gap-1 rounded-full bg-[#EAF5EF] p-1">
          <button
            onClick={() => setTab("log")}
            className={`flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-bold transition-all ${
              tab === "log" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7588]"
            }`}
          >
            <Target className="h-4 w-4" />
            Workout Log
          </button>
          <button
            onClick={() => setTab("sessions")}
            className={`flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-bold transition-all ${
              tab === "sessions" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7588]"
            }`}
          >
            <History className="h-4 w-4" />
            Sessions ({sessions.length})
          </button>
        </div>
      </div>

      {/* Workout Log Tab */}
      {tab === "log" && (
        <div className="bg-[#F8FFFB] px-5 pb-4">
          {/* Search */}
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-[#7A869A]" strokeWidth={2} />
            <Input
              placeholder={t("log_activity_search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-14 rounded-[22px] border-[#DDE5EC] bg-white pl-14 pr-5 text-[16px] font-medium text-[#111827] shadow-none placeholder:text-[#7A869A] focus-visible:ring-[#BFECDC]"
            />
          </div>

          {/* Category pills */}
          <div className="-mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex h-[48px] shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition-all ${
                    active
                      ? "bg-gradient-to-br from-[#20C997] to-[#12B981] text-white shadow-[0_8px_20px_rgba(16,185,129,0.2)]"
                      : "border border-[#E5EAF0] bg-white text-[#6B7588] shadow-[0_4px_12px_rgba(15,23,42,0.04)]"
                  }`}
                >
                  <CategoryIcon category={cat} active={active} />
                  {categoryLabel(cat)}
                </button>
              );
            })}
          </div>

          {/* Activity groups */}
          <div className="mt-5 space-y-6">
            {Object.entries(groupedByCategory).map(([cat, items]) => (
              <section key={cat}>
                <p className="mb-3 text-[13px] font-black uppercase tracking-[0.08em] text-[#7A869A]">{categoryLabel(cat)}</p>
                <div className="space-y-3">
                  {items.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => quickLog(a)}
                      disabled={saving}
                      className="flex min-h-[96px] w-full items-center gap-4 rounded-[22px] border border-[#E7ECF2] bg-white px-4 py-3 text-left shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-50"
                    >
                      <ActivityIllustration activity={a} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[18px] font-black leading-tight tracking-[-0.02em] text-[#111827]">{activityName(a)}</p>
                        <p className="mt-1.5 text-[15px] font-medium leading-none text-[#6B7588]">
                          {t("log_activity_cal_per_hour").replace("{cal}", String(Math.round(a.met * weightKg)))}
                        </p>
                      </div>
                      <div className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#20C978] to-[#059A5A] px-5 text-sm font-bold text-white shadow-[0_6px_14px_rgba(5,150,90,0.2)]">
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                        Log
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {tab === "sessions" && (
        <div className="bg-[#F8FFFB] px-5 pb-4">
          {/* Google Fit */}
          <div className="mt-5 rounded-[24px] border border-[#CDEBE0] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EAFBF4] text-[#10A86C]">
                <Dumbbell className="h-7 w-7" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-black text-[#111827]">Detected Workouts</h3>
                <p className="mt-0.5 text-[14px] font-medium text-[#7A869A]">
                  {sessions.length > 0
                    ? `${sessions.length} workout${sessions.length === 1 ? "" : "s"} logged today`
                    : "No workouts logged today"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              {!googleFitConnected && (
                <button
                  onClick={() => {
                    if (isNative) {
                      toast.info("Google Fit is not available on the mobile app. Please connect via the web browser.");
                      return;
                    }
                    const clientId = import.meta.env.VITE_GOOGLE_FIT_CLIENT_ID;
                    if (clientId) {
                      const redirectUri = `${window.location.origin}/auth/google-fit/callback`;
                      const params = new URLSearchParams({
                        client_id: clientId, redirect_uri: redirectUri,
                        response_type: "code",
                        scope: "https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read",
                        access_type: "offline", prompt: "consent",
                      });
                      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
                    }
                  }}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[16px] border border-[#CDEBE0] bg-white text-[14px] font-bold text-[#10A86C]"
                >
                  <Link className="h-4 w-4" strokeWidth={2.4} /> Connect Google Fit
                </button>
              )}
              <button
                onClick={loadSessions}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E1E7EE] bg-white text-[#53637A]"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${loadingSessions ? "animate-spin" : ""}`} strokeWidth={2} />
              </button>
            </div>

            {loadingSessions ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#10A86C]" /></div>
            ) : sessions.length > 0 ? (
              <div className="mt-4 space-y-2">
                {sessions.map((s) => {
                  const act = ACTIVITIES.find((a) => a.name === s.workout_type);
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-[18px] border border-[#DFF2EA] bg-white px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAFBF4] text-lg">
                          {act?.emoji ?? "🏋️"}
                        </div>
                        <div>
                          <p className="truncate text-sm font-black text-[#111827]">{act ? activityName(act) : s.workout_type}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-[#7A869A]">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration_minutes} min</span>
                            <span className="text-[#10A86C]">{s.calories_burned} cal</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F3F6] text-[#53637A]"
                        aria-label="Remove workout"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-[#7A869A]">No workouts logged yet. Go to the Workout Log tab to add one.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
