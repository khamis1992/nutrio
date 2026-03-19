import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Search, Trash2, ArrowLeft, Flame, Clock, Loader2, CheckCircle2, Dumbbell, Link, RefreshCw, X, Plus } from "lucide-react";
import { NavChevronRight } from "@/components/ui/nav-chevron";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

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
  // Cardio
  { id: "walking_slow",    name: "Walking (slow)",      nameAr: "المشي (بطيء)",       category: "Cardio",      met: 2.5,  emoji: "🚶" },
  { id: "walking_moderate",name: "Walking (moderate)",  nameAr: "المشي (معتدل)",      category: "Cardio",      met: 3.5,  emoji: "🚶" },
  { id: "walking_fast",    name: "Walking (fast)",      nameAr: "المشي (سريع)",       category: "Cardio",      met: 4.5,  emoji: "🚶‍♂️" },
  { id: "running_5mph",    name: "Running (5 mph)",     nameAr: "الجري (8 ك/س)",      category: "Cardio",      met: 8.3,  emoji: "🏃" },
  { id: "running_6mph",    name: "Running (6 mph)",     nameAr: "الجري (10 ك/س)",     category: "Cardio",      met: 9.8,  emoji: "🏃" },
  { id: "running_7mph",    name: "Running (7+ mph)",    nameAr: "الجري (11+ ك/س)",    category: "Cardio",      met: 11.0, emoji: "🏃‍♂️" },
  { id: "cycling_light",   name: "Cycling (light)",     nameAr: "ركوب الدراجة (خفيف)",category: "Cardio",      met: 4.0,  emoji: "🚴" },
  { id: "cycling_moderate",name: "Cycling (moderate)",  nameAr: "ركوب الدراجة (معتدل)",category: "Cardio",     met: 8.0,  emoji: "🚴" },
  { id: "swimming",        name: "Swimming",            nameAr: "السباحة",            category: "Cardio",      met: 6.0,  emoji: "🏊" },
  { id: "jump_rope",       name: "Jump Rope",           nameAr: "تخطي الحبل",         category: "Cardio",      met: 10.0, emoji: "⚡" },
  { id: "elliptical",      name: "Elliptical",          nameAr: "جهاز الإليبتيكال",   category: "Cardio",      met: 5.0,  emoji: "🔄" },
  { id: "rowing",          name: "Rowing",              nameAr: "التجديف",            category: "Cardio",      met: 7.0,  emoji: "🚣" },
  { id: "stair_climbing",  name: "Stair Climbing",      nameAr: "تسلق الدرج",         category: "Cardio",      met: 8.0,  emoji: "🪜" },
  { id: "hiit",            name: "HIIT",                nameAr: "تدريب متقطع عالي",   category: "Cardio",      met: 8.0,  emoji: "🔥" },
  // Strength
  { id: "weight_training", name: "Weight Training",     nameAr: "تدريب بالأوزان",     category: "Strength",    met: 3.5,  emoji: "🏋️" },
  { id: "bodyweight",      name: "Bodyweight Training", nameAr: "تدريب بوزن الجسم",   category: "Strength",    met: 3.8,  emoji: "💪" },
  { id: "crossfit",        name: "CrossFit",            nameAr: "كروس فت",            category: "Strength",    met: 5.0,  emoji: "🏋️‍♂️" },
  // Flexibility
  { id: "yoga",            name: "Yoga",                nameAr: "يوغا",               category: "Flexibility", met: 2.5,  emoji: "🧘" },
  { id: "pilates",         name: "Pilates",             nameAr: "بيلاتيس",            category: "Flexibility", met: 3.0,  emoji: "🧘‍♀️" },
  { id: "stretching",      name: "Stretching",          nameAr: "تمارين الإطالة",     category: "Flexibility", met: 2.3,  emoji: "🤸" },
  // Sports
  { id: "basketball",      name: "Basketball",          nameAr: "كرة السلة",          category: "Sports",      met: 6.5,  emoji: "🏀" },
  { id: "soccer",          name: "Soccer",              nameAr: "كرة القدم",          category: "Sports",      met: 7.0,  emoji: "⚽" },
  { id: "tennis",          name: "Tennis",              nameAr: "التنس",              category: "Sports",      met: 7.3,  emoji: "🎾" },
  { id: "dancing",         name: "Dancing",             nameAr: "الرقص",              category: "Sports",      met: 4.5,  emoji: "💃" },
  { id: "martial_arts",    name: "Martial Arts",        nameAr: "فنون القتال",        category: "Sports",      met: 5.0,  emoji: "🥋" },
];

const CATEGORIES = ["All", "Cardio", "Strength", "Flexibility", "Sports"];

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── MET Formula ─────────────────────────────────────────────────────────────
function calcCalories(met: number, weightKg: number, durationMinutes: number): number {
  return Math.round(met * weightKg * (durationMinutes / 60));
}

// ─── Component ───────────────────────────────────────────────────────────────
export function LogActivitySheet({ open, onOpenChange, onBurnedUpdate }: LogActivitySheetProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const activityName = (a: Activity) => isRTL ? a.nameAr : a.name;

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

  // Keep customCal in sync with the formula whenever duration/activity changes
  const prevDurationRef = useRef("");
  useEffect(() => {
    if (duration !== prevDurationRef.current) {
      prevDurationRef.current = duration;
      setCustomCal(estimatedCal > 0 ? String(estimatedCal) : "");
    }
  }, [estimatedCal, duration]);

  // Load today's sessions
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
      setShowActivityPicker(false);
      loadSessions();
      // Check Google Fit via stored token flag
      const storedToken = localStorage.getItem("google_fit_access_token");
      setGoogleFitConnected(!!storedToken);
    }
  }, [open]);

  // Pick activity → go to detail
  const pickActivity = (a: Activity) => {
    setSelected(a);
    setDuration("");
    setCustomCal("");
    setView("detail");
  };

  // Save session
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

      toast({ title: t("log_activity_success_title"), description: t("log_activity_success_desc").replace("{name}", selected.name).replace("{cal}", String(cal)) });
      setView("list");
      await loadSessions();
    } catch {
      toast({ title: t("log_activity_failed_title"), description: t("log_activity_failed_desc"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Delete session
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
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0 overflow-hidden flex flex-col">

        {/* ── List view ── */}
        {view === "list" && (
          <>
            {/* Header */}
            <div className="bg-white px-5 pt-5 pb-4 border-b border-gray-100">
              <SheetHeader>
                <SheetTitle className="text-gray-900 text-xl font-bold text-left">{t("log_activity")}</SheetTitle>
                <p className="text-gray-500 text-sm">{t("log_activity_subtitle")}</p>
              </SheetHeader>
              {totalBurned > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 rounded-2xl px-4 py-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-orange-600 font-semibold text-sm">{t("log_activity_cal_burned_today").replace("{total}", String(totalBurned))}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Detected Workouts */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-purple-500" />
                    {t('detected_workouts') || 'Detected Workouts'}
                    {googleFitConnected && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Google Fit</span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2">
                    {!googleFitConnected && (
                      <button
                        onClick={() => {
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
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                      >
                        <Link className="w-3 h-3" />
                        Connect Google Fit
                      </button>
                    )}
                    <button
                      onClick={loadSessions}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Refresh workouts"
                    >
                      <RefreshCw className={`w-4 h-4 text-gray-400 ${loadingSessions ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {loadingSessions ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-purple-400" /></div>
                ) : sessions.length > 0 ? (
                  <div className="space-y-2">
                    {sessions.map((s) => {
                      const act = ACTIVITIES.find((a) => a.name === s.workout_type);
                      return (
                        <div key={s.id} className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3 border border-purple-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                              <span className="text-lg">{act?.emoji ?? "🏋️"}</span>
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{act ? activityName(act) : s.workout_type}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" /> {s.duration_minutes} {t("min_label")}
                                </span>
                                <span className="text-xs font-bold text-purple-600">
                                  {s.calories_burned} cal
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteSession(s.id)}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                            aria-label="Remove workout"
                          >
                            <X className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">No workouts logged today</p>
                )}

                {/* Add Manual Workout */}
                <button
                  onClick={() => setShowActivityPicker((v) => !v)}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Manual Workout
                </button>
              </div>

              {showActivityPicker && (
              <>
              <div className="border-t border-gray-100 my-3" />

              {/* Search */}
              <div className="px-5 pb-3 pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder={t("log_activity_search_placeholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 rounded-xl h-11 bg-gray-50 border-0"
                  />
                </div>
              </div>

              {/* Category pills */}
              <div className="px-5 pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      category === cat ? "gradient-primary text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {categoryLabel(cat)}
                  </button>
                ))}
              </div>

              {/* Activity list */}
              <div className="px-5 pb-8 space-y-5">
                {Object.entries(groupedByCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{categoryLabel(cat)}</p>
                    <div className="space-y-1">
                      {items.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => pickActivity(a)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 transition-colors text-left border border-gray-100"
                        >
                          <span className="text-xl w-8 flex-shrink-0 text-center">{a.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800">{activityName(a)}</p>
                            <p className="text-xs text-gray-400">{t("log_activity_cal_per_hour").replace("{cal}", String(Math.round(a.met * weightKg)))}</p>
                          </div>
                          <NavChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </>
              )}
            </div>
          </>
        )}

        {/* ── Detail view ── */}
        {view === "detail" && selected && (
          <>
            {/* Header */}
            <div className="bg-white px-5 pt-5 pb-4 border-b border-gray-100">
              <button
                onClick={() => setView("list")}
                className="flex items-center gap-1.5 text-sm mb-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> {t("back")}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selected.emoji}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{activityName(selected)}</h2>
                  <p className="text-sm text-gray-500">{categoryLabel(selected.category)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8 space-y-6">
              {/* Duration input */}
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

                {/* Quick duration pills */}
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
                    onClick={() => {
                      durationInputRef.current?.focus();
                    }}
                    className={`flex-1 min-w-0 py-2 rounded-xl text-sm font-semibold transition-all ${
                      ![15, 30, 45, 60].includes(parseInt(duration) || 0)
                        ? "gradient-primary text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t("log_activity_custom")}
                  </button>
                </div>
              </div>

              {/* Calorie preview — editable */}
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

              {/* Formula explanation */}
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
