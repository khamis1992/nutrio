import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Search, ArrowLeft, Activity, Flame, Heart, Clock, Loader2, CheckCircle2, Dumbbell, Link, RefreshCw, Trophy, X, Plus } from "lucide-react";
import { Basketball, SoccerBall, TennisBall, HandFist, PersonSimpleRun, PersonSimpleWalk, PersonSimpleBike, Lightning, Stairs, MusicNotes, Barbell, PersonSimpleTaiChi, Crosshair } from "@phosphor-icons/react";
import { NavChevronRight } from "@/components/ui/nav-chevron";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { isNative } from "@/lib/capacitor";

interface Activity {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  met: number;
  emoji: string;
  icon?: React.ElementType;
}

const ACTIVITIES: Activity[] = [
  { id: "walking_slow",     name: "Walking (slow)",       nameAr: "المشي (بطيء)",        category: "Cardio",       met: 2.5,  emoji: "🚶", icon: PersonSimpleWalk },
  { id: "walking_moderate", name: "Walking (moderate)",   nameAr: "المشي (معتدل)",       category: "Cardio",       met: 3.5,  emoji: "🚶", icon: PersonSimpleWalk },
  { id: "walking_fast",     name: "Walking (fast)",       nameAr: "المشي (سريع)",        category: "Cardio",       met: 4.5,  emoji: "🚶‍♂️", icon: PersonSimpleWalk },
  { id: "running_5mph",     name: "Running (5 mph)",      nameAr: "الجري (8 ك/س)",       category: "Cardio",       met: 8.3,  emoji: "🏃", icon: PersonSimpleRun },
  { id: "running_6mph",     name: "Running (6 mph)",      nameAr: "الجري (10 ك/س)",      category: "Cardio",       met: 9.8,  emoji: "🏃", icon: PersonSimpleRun },
  { id: "running_7mph",     name: "Running (7+ mph)",     nameAr: "الجري (11+ ك/س)",     category: "Cardio",       met: 11.0, emoji: "🏃‍♂️", icon: PersonSimpleRun },
  { id: "cycling_light",    name: "Cycling (light)",      nameAr: "ركوب الدراجة (خفيف)", category: "Cardio",      met: 4.0,  emoji: "🚴", icon: PersonSimpleBike },
  { id: "cycling_moderate", name: "Cycling (moderate)",   nameAr: "ركوب الدراجة (معتدل)", category: "Cardio",      met: 8.0,  emoji: "🚴", icon: PersonSimpleBike },
  { id: "swimming",         name: "Swimming",             nameAr: "السباحة",             category: "Cardio",       met: 6.0,  emoji: "🏊", icon: Activity },
  { id: "jump_rope",        name: "Jump Rope",            nameAr: "تخطي الحبل",          category: "Cardio",       met: 10.0, emoji: "⚡", icon: Lightning },
  { id: "elliptical",       name: "Elliptical",           nameAr: "جهاز الإليبتيكال",    category: "Cardio",       met: 5.0,  emoji: "🔄", icon: Crosshair },
  { id: "rowing",           name: "Rowing",               nameAr: "التجديف",             category: "Cardio",       met: 7.0,  emoji: "🚣", icon: Activity },
  { id: "stair_climbing",   name: "Stair Climbing",       nameAr: "تسلق الدرج",          category: "Cardio",       met: 8.0,  emoji: "🪜", icon: Stairs },
  { id: "hiit",             name: "HIIT",                 nameAr: "تدريب متقطع عالي",    category: "Cardio",       met: 8.0,  emoji: "🔥" },
  { id: "weight_training",  name: "Weight Training",      nameAr: "تدريب بالأوزان",      category: "Strength",     met: 3.5,  emoji: "🏋️" },
  { id: "bodyweight",       name: "Bodyweight Training",  nameAr: "تدريب بوزن الجسم",    category: "Strength",     met: 3.8,  emoji: "💪" },
  { id: "crossfit",         name: "CrossFit",             nameAr: "كروس فت",             category: "Strength",     met: 5.0,  emoji: "🏋️‍♂️", icon: HandFist },
  { id: "yoga",             name: "Yoga",                 nameAr: "يوغا",                category: "Flexibility",  met: 2.5,  emoji: "🧘", icon: PersonSimpleTaiChi },
  { id: "pilates",          name: "Pilates",              nameAr: "بيلاتيس",             category: "Flexibility",  met: 3.0,  emoji: "🧘‍♀️" },
  { id: "stretching",       name: "Stretching",           nameAr: "تمارين الإطالة",      category: "Flexibility",  met: 2.3,  emoji: "🤸" },
  { id: "basketball",       name: "Basketball",           nameAr: "كرة السلة",           category: "Sports",       met: 6.5,  emoji: "🏀", icon: Basketball },
  { id: "soccer",           name: "Soccer",               nameAr: "كرة القدم",           category: "Sports",       met: 7.0,  emoji: "⚽", icon: SoccerBall },
  { id: "tennis",           name: "Tennis",               nameAr: "التنس",               category: "Sports",       met: 7.3,  emoji: "🎾", icon: TennisBall },
  { id: "dancing",          name: "Dancing",              nameAr: "الرقص",               category: "Sports",       met: 4.5,  emoji: "💃", icon: MusicNotes },
  { id: "martial_arts",     name: "Martial Arts",         nameAr: "فنون القتال",         category: "Sports",       met: 5.0,  emoji: "🥋", icon: HandFist },
];

const CATEGORIES = ["All", "Cardio", "Strength", "Flexibility", "Sports"];

const CATEGORY_VISUALS: Record<string, { color: string }> = {
  Cardio:      { color: "#FF1717" },
  Strength:    { color: "#189BFF" },
  Flexibility: { color: "#A54DF4" },
  Sports:      { color: "#FF850F" },
};

function CategoryIcon({ category, active }: { category: string; active: boolean }) {
  if (category === "All") return null;
  const c = active ? "#fff" : CATEGORY_VISUALS[category]?.color ?? "#7A869A";

  const iconMap: Record<string, React.ReactNode> = {
    Cardio:       <Heart className="h-5 w-5" strokeWidth={2.1} stroke={c} />,
    Strength:     <Dumbbell className="h-5 w-5" strokeWidth={2.1} stroke={c} />,
    Flexibility:  <Activity className="h-5 w-5" strokeWidth={2.1} stroke={c} />,
    Sports:       <Trophy className="h-5 w-5" strokeWidth={2.1} stroke={c} />,
  };

  return <>{iconMap[category]}</>;
}

const CATEGORY_GRADIENTS: Record<string, { from: string; to: string; shadow: string; Icon: React.ElementType }> = {
  Cardio:      { from: "#20C978", to: "#059A5A", shadow: "rgba(16,185,129,0.18)",     Icon: Heart },
  Strength:    { from: "#FF5C7A", to: "#E0364F", shadow: "rgba(224,54,79,0.2)",       Icon: Dumbbell },
  Flexibility: { from: "#8B5CF6", to: "#6D28D9", shadow: "rgba(109,40,217,0.2)",      Icon: Activity },
  Sports:      { from: "#FF8A2A", to: "#F97316", shadow: "rgba(249,115,22,0.2)",       Icon: Trophy },
};

function ActivityIllustration({ activity, size }: { activity: Activity; size?: number }) {
  const s = size ?? 60;
  const imgSrc = `/activities/${activity.id}.png`;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-slate-50"
      style={{ width: s, height: s, boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}
    >
      <img
        src={imgSrc}
        alt={activity.name}
        className="w-full h-full object-cover"
        onError={(e) => {
          // fallback to gradient icon if image missing
          const el = e.currentTarget.parentElement;
          if (el) {
            const g = CATEGORY_GRADIENTS[activity.category] ?? CATEGORY_GRADIENTS.Sports;
            el.style.backgroundImage = `linear-gradient(135deg, ${g.from}, ${g.to})`;
            el.style.boxShadow = `0 8px 18px ${g.shadow}`;
          }
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
}

interface LoggedSession {
  id: string;
  workout_type: string;
  duration_minutes: number;
  calories_burned: number;
}

interface LogActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBurnedUpdate: (total: number) => void;
}

function calcCalories(met: number, weightKg: number, durationMinutes: number): number {
  return Math.round(met * weightKg * (durationMinutes / 60));
}

export function LogActivitySheet({ open, onOpenChange, onBurnedUpdate }: LogActivitySheetProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { t, isRTL } = useLanguage();
  const activityName = (a: Activity) => isRTL ? a.nameAr : a.name;

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      All:          t("log_activity_filter_all"),
      Cardio:       t("log_activity_cat_cardio"),
      Strength:     t("log_activity_cat_strength"),
      Flexibility:  t("log_activity_cat_flexibility"),
      Sports:       t("log_activity_cat_sports"),
    };
    return map[cat] ?? cat;
  };

  const weightKg = profile?.current_weight_kg ?? 70;
  const durationInputRef = useRef<HTMLInputElement>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [view, setView] = useState<"list" | "detail">("list");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Activity | null>(null);
  const [duration, setDuration] = useState("");
  const [customCal, setCustomCal] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<LoggedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [googleFitConnected, setGoogleFitConnected] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);

  const estimatedCal = selected && duration
    ? calcCalories(selected.met, weightKg, parseInt(duration) || 0)
    : 0;

  const prevDurationRef = useRef("");
  useEffect(() => {
    if (duration !== prevDurationRef.current) {
      prevDurationRef.current = duration;
      setCustomCal(estimatedCal > 0 ? String(estimatedCal) : "");
    }
  }, [estimatedCal, duration]);

  const loadSessions = async () => {
    if (!user) return;
    setLoadingSessions(true);
    const { data } = await supabase
      .from("workout_sessions")
      .select("id, workout_type, duration_minutes, calories_burned")
      .eq("user_id", user.id)
      .eq("session_date", todayStr)
      .order("created_at", { ascending: false });

    if (data) {
      setSessions(data as LoggedSession[]);
      const total = data.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0);
      onBurnedUpdate(total);
    }
    setLoadingSessions(false);
  };

  useEffect(() => {
    if (open) {
      setView("list");
      setSearch("");
      setCategory("All");
      setShowActivityPicker(true);
      loadSessions();
      const storedToken = localStorage.getItem("google_fit_access_token");
      setGoogleFitConnected(!!storedToken);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickActivity = (a: Activity) => {
    setSelected(a);
    setDuration("");
    setCustomCal("");
    setView("detail");
  };

  const saveSession = async () => {
    if (!user || !selected || !duration) return;
    const mins = parseInt(duration);
    if (!mins || mins <= 0) return;

    setSaving(true);
    try {
      const cal = customCal && parseInt(customCal) > 0
        ? parseInt(customCal)
        : calcCalories(selected.met, weightKg, mins);
      const { error } = await supabase.from("workout_sessions").insert({
        user_id: user.id,
        session_date: todayStr,
        workout_type: selected.name,
        duration_minutes: mins,
        calories_burned: cal,
      });
      if (error) throw error;

      toast.success(t("log_activity_success_title"), { description: t("log_activity_success_desc").replace("{name}", selected.name).replace("{cal}", String(cal)) });
      setView("list");
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

  const totalBurned = sessions.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="inset-x-2 bottom-2 mx-auto flex h-[calc(100dvh-16px)] w-auto max-w-[430px] flex-col overflow-hidden rounded-[34px] border border-[#E2ECE8] bg-[#FFFEFC] p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        closeButtonClassName="right-5 top-6 flex h-14 w-14 items-center justify-center rounded-full border-0 bg-[#F1F3F6] text-[#52627A] opacity-100 shadow-none ring-offset-0 hover:opacity-100 hover:bg-[#ECEFF3] focus:ring-2 focus:ring-[#D8E1EA] [&>svg]:h-7 [&>svg]:w-7"
      >

        {view === "list" && (
          <>
            <div className="shrink-0 bg-[#FFFEFC] px-5 pb-6 pt-8">
              <SheetHeader className="space-y-0 text-left">
                <div className="flex items-start gap-4 pr-16">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#20C978] to-[#059A5A] text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)]">
                    <Activity className="h-8 w-8" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 pt-1">
                    <SheetTitle className="text-left text-[34px] font-black leading-[1.05] tracking-[-0.04em] text-[#111827]">
                      {t("log_activity")}
                    </SheetTitle>
                    <p className="mt-3 text-[18px] font-medium leading-tight text-[#6B7588]">{t("log_activity_subtitle")}</p>
                  </div>
                </div>
              </SheetHeader>
              {totalBurned > 0 && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#FFF5EC] px-4 py-2 text-sm font-bold text-[#E97818]">
                  <Flame className="h-4 w-4" />
                  <span>{t("log_activity_cal_burned_today").replace("{total}", String(totalBurned))}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8">
              <section className="rounded-[28px] border border-[#CDEBE0] bg-[#FCFFFD] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5C7A] to-[#E0364F] text-white shadow-[0_8px_18px_rgba(224,54,79,0.2)]">
                    <Dumbbell className="h-8 w-8" strokeWidth={2.2} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-[21px] font-black tracking-[-0.03em] text-[#111827]">
                        {t("detected_workouts") || "Detected Workouts"}
                      </h2>
                      {googleFitConnected && (
                        <span className="shrink-0 rounded-full bg-[#EAFBF4] px-2 py-0.5 text-[10px] font-bold text-[#10A86C]">Fit</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[16px] font-medium text-[#7A869A]">
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
                            client_id: clientId,
                            redirect_uri: redirectUri,
                            response_type: "code",
                            scope: "https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read",
                            access_type: "offline",
                            prompt: "consent",
                          });
                          window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
                        }
                      }}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[20px] border border-[#CDEBE0] bg-white px-4 text-[15px] font-black text-[#10A86C] transition-colors hover:bg-[#F5FFFA]"
                    >
                      <Link className="h-5 w-5" strokeWidth={2.4} />
                      Connect Google Fit
                    </button>
                  )}
                  <button
                    onClick={loadSessions}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#E1E7EE] bg-white text-[#53637A] transition-colors hover:bg-[#F7FAFC]"
                    aria-label="Refresh workouts"
                  >
                    <RefreshCw className={`h-6 w-6 ${loadingSessions ? "animate-spin" : ""}`} strokeWidth={2} />
                  </button>
                </div>

                {loadingSessions ? (
                  <div className="flex justify-center py-5"><Loader2 className="h-6 w-6 animate-spin text-[#10A86C]" /></div>
                ) : sessions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {sessions.map((s) => {
                      const act = ACTIVITIES.find((a) => a.name === s.workout_type);
                      return (
                        <div key={s.id} className="flex items-center justify-between rounded-[20px] border border-[#DFF2EA] bg-white px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {(() => {
                              const g = act ? CATEGORY_GRADIENTS[act.category] ?? CATEGORY_GRADIENTS.Sports : CATEGORY_GRADIENTS.Sports;
                              const SI = act?.icon ?? g.Icon;
                              return (
                                <div
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                                  style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})`, boxShadow: `0 4px 12px ${g.shadow}` }}
                                >
                                  <SI weight="bold" width={18} height={18} />
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#111827]">{act ? activityName(act) : s.workout_type}</p>
                              <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-[#7A869A]">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration_minutes} {t("min_label")}</span>
                                <span className="text-[#10A86C]">{s.calories_burned} cal</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteSession(s.id)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F3F6] text-[#53637A] transition-colors hover:bg-[#E6EAF0]"
                            aria-label="Remove workout"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 rounded-[24px] border border-[#EEF2F4] bg-white p-4 shadow-inner shadow-slate-100/70">
                  <button
                    onClick={() => setShowActivityPicker(true)}
                    className="flex h-[76px] w-full items-center justify-center gap-3 rounded-[18px] border-2 border-dashed border-[#19C987] text-[17px] font-black text-[#10A86C] transition-colors hover:bg-[#F3FFF9]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-current">
                      <Plus className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                    Add Manual Workout
                  </button>
                </div>
              </section>

              {showActivityPicker && (
                <>
                  <div className="relative mt-6">
                    <Search className="pointer-events-none absolute left-5 top-1/2 h-7 w-7 -translate-y-1/2 text-[#53637A]" strokeWidth={2} />
                    <Input
                      placeholder={t("log_activity_search_placeholder")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-16 rounded-[26px] border-[#DDE5EC] bg-white pl-16 pr-5 text-[18px] font-medium text-[#111827] shadow-none placeholder:text-[#7A869A] focus-visible:ring-[#BFECDC]"
                    />
                  </div>

                  <div className="-mx-5 mt-5 flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
                    {CATEGORIES.map((cat) => {
                      const active = category === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat)}
                          className={`flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-full px-6 text-[17px] font-bold transition-all ${
                            active
                              ? "bg-gradient-to-br from-[#20C997] to-[#12B981] text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)]"
                              : "border border-[#E5EAF0] bg-white text-[#6B7588] shadow-[0_8px_22px_rgba(15,23,42,0.05)]"
                          }`}
                        >
                          <CategoryIcon category={cat} active={active} />
                          {categoryLabel(cat)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 space-y-7 pb-8">
                    {Object.entries(groupedByCategory).map(([cat, items]) => (
                      <section key={cat}>
                        <p className="mb-4 text-[15px] font-black uppercase tracking-[0.08em] text-[#7A869A]">{categoryLabel(cat)}</p>
                        <div className="space-y-4">
                          {items.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => pickActivity(a)}
                              className="flex min-h-[104px] w-full items-center gap-4 rounded-[26px] border border-[#E7ECF2] bg-white px-5 py-4 text-left shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] active:scale-[0.99]"
                            >
                              <ActivityIllustration activity={a} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[20px] font-black leading-tight tracking-[-0.03em] text-[#111827]">{activityName(a)}</p>
                                <p className="mt-2 text-[17px] font-medium leading-none text-[#6B7588]">
                                  {t("log_activity_cal_per_hour").replace("{cal}", String(Math.round(a.met * weightKg)))}
                                </p>
                              </div>
                              <NavChevronRight className="h-8 w-8 shrink-0 text-[#53637A]" />
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {view === "detail" && selected && (
          <>
            <div className="bg-white px-5 pt-5 pb-4 border-b border-gray-100">
              <button
                onClick={() => setView("list")}
                className="flex items-center gap-1.5 text-sm mb-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> {t("back")}
              </button>
              <div className="flex items-center gap-3">
                <ActivityIllustration activity={selected} size={56} />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{activityName(selected)}</h2>
                  <p className="text-sm text-gray-500">{categoryLabel(selected.category)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8 space-y-6">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">
                  {t("log_activity_duration_label")}
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Input
                      ref={durationInputRef}
                      type="number"
                      min="1"
                      max="480"
                      placeholder="0"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="text-4xl font-black text-gray-900 border-0 bg-gray-50 rounded-2xl h-16 text-center focus-visible:ring-1"
                      style={{ fontSize: 36 }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-gray-400">{t("min_label")}</span>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  {[15, 30, 45, 60].map((min) => (
                    <button
                      key={min}
                      onClick={() => setDuration(String(min))}
                      className={`flex-1 min-w-0 py-2 rounded-xl text-sm font-semibold transition-all ${
                        duration === String(min) ? "gradient-primary text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                  <button
                    onClick={() => { durationInputRef.current?.focus(); }}
                    className={`flex-1 min-w-0 py-2 rounded-xl text-sm font-semibold transition-all ${
                      ![15, 30, 45, 60].includes(parseInt(duration) || 0) ? "gradient-primary text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t("log_activity_custom")}
                  </button>
                </div>
              </div>

              {estimatedCal > 0 && (
                <div className="bg-orange-50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Flame className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-orange-400 font-medium mb-1">{t("log_activity_estimated_burn")}</p>
                    <div className="flex items-baseline gap-2">
                      <input
                        type="number"
                        min="1"
                        value={customCal}
                        onChange={(e) => setCustomCal(e.target.value)}
                        className="w-24 text-3xl font-black text-orange-600 bg-transparent border-b-2 border-orange-300 focus:border-orange-500 outline-none text-center"
                      />
                      <span className="text-base font-semibold text-orange-600">{t("cal")}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t("log_activity_how_calculated")}</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {t("log_activity_formula_desc").replace("{met}", String(selected.met)).replace("{weight}", String(weightKg))}
                </p>
              </div>

              <Button
                onClick={saveSession}
                disabled={saving || !duration || parseInt(duration) <= 0}
                className="w-full h-14 rounded-2xl font-bold text-white text-base gradient-primary shadow-lg shadow-primary/20"
              >
                {saving
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><CheckCircle2 className="w-5 h-5 mr-2" /> {customCal || estimatedCal > 0 ? t("log_activity_log_button").replace("{cal}", customCal || String(estimatedCal)) : t("log_activity")}</>
                }
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
