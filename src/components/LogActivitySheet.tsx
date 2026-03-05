import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Search, ChevronRight, Trash2, ArrowLeft, Flame, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";

// ─── Activity Database ───────────────────────────────────────────────────────
interface Activity {
  id: string;
  name: string;
  category: string;
  met: number;
  emoji: string;
}

const ACTIVITIES: Activity[] = [
  // Cardio
  { id: "walking_slow",    name: "Walking (slow)",      category: "Cardio",    met: 2.5,  emoji: "🚶" },
  { id: "walking_moderate",name: "Walking (moderate)",  category: "Cardio",    met: 3.5,  emoji: "🚶" },
  { id: "walking_fast",    name: "Walking (fast)",      category: "Cardio",    met: 4.5,  emoji: "🚶‍♂️" },
  { id: "running_5mph",    name: "Running (5 mph)",     category: "Cardio",    met: 8.3,  emoji: "🏃" },
  { id: "running_6mph",    name: "Running (6 mph)",     category: "Cardio",    met: 9.8,  emoji: "🏃" },
  { id: "running_7mph",    name: "Running (7+ mph)",    category: "Cardio",    met: 11.0, emoji: "🏃‍♂️" },
  { id: "cycling_light",   name: "Cycling (light)",     category: "Cardio",    met: 4.0,  emoji: "🚴" },
  { id: "cycling_moderate",name: "Cycling (moderate)",  category: "Cardio",    met: 8.0,  emoji: "🚴" },
  { id: "swimming",        name: "Swimming",            category: "Cardio",    met: 6.0,  emoji: "🏊" },
  { id: "jump_rope",       name: "Jump Rope",           category: "Cardio",    met: 10.0, emoji: "⚡" },
  { id: "elliptical",      name: "Elliptical",          category: "Cardio",    met: 5.0,  emoji: "🔄" },
  { id: "rowing",          name: "Rowing",              category: "Cardio",    met: 7.0,  emoji: "🚣" },
  { id: "stair_climbing",  name: "Stair Climbing",      category: "Cardio",    met: 8.0,  emoji: "🪜" },
  { id: "hiit",            name: "HIIT",                category: "Cardio",    met: 8.0,  emoji: "🔥" },
  // Strength
  { id: "weight_training", name: "Weight Training",     category: "Strength",  met: 3.5,  emoji: "🏋️" },
  { id: "bodyweight",      name: "Bodyweight Training", category: "Strength",  met: 3.8,  emoji: "💪" },
  { id: "crossfit",        name: "CrossFit",            category: "Strength",  met: 5.0,  emoji: "🏋️‍♂️" },
  // Flexibility
  { id: "yoga",            name: "Yoga",                category: "Flexibility", met: 2.5, emoji: "🧘" },
  { id: "pilates",         name: "Pilates",             category: "Flexibility", met: 3.0, emoji: "🧘‍♀️" },
  { id: "stretching",      name: "Stretching",          category: "Flexibility", met: 2.3, emoji: "🤸" },
  // Sports
  { id: "basketball",      name: "Basketball",          category: "Sports",    met: 6.5,  emoji: "🏀" },
  { id: "soccer",          name: "Soccer",              category: "Sports",    met: 7.0,  emoji: "⚽" },
  { id: "tennis",          name: "Tennis",              category: "Sports",    met: 7.3,  emoji: "🎾" },
  { id: "dancing",         name: "Dancing",             category: "Sports",    met: 4.5,  emoji: "💃" },
  { id: "martial_arts",    name: "Martial Arts",        category: "Sports",    met: 5.0,  emoji: "🥋" },
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

  const weightKg = profile?.current_weight_kg ?? 70;
  const durationInputRef = useRef<HTMLInputElement>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [view, setView] = useState<"list" | "detail">("list");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Activity | null>(null);
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<LoggedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const estimatedCal = selected && duration
    ? calcCalories(selected.met, weightKg, parseInt(duration) || 0)
    : 0;

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
      loadSessions();
    }
  }, [open]);

  // Pick activity → go to detail
  const pickActivity = (a: Activity) => {
    setSelected(a);
    setDuration("");
    setView("detail");
  };

  // Save session
  const saveSession = async () => {
    if (!user || !selected || !duration) return;
    const mins = parseInt(duration);
    if (!mins || mins <= 0) return;

    setSaving(true);
    try {
      const cal = calcCalories(selected.met, weightKg, mins);
      const { error } = await supabase.from("workout_sessions").insert({
        user_id: user.id,
        session_date: todayStr,
        workout_type: selected.name,
        duration_minutes: mins,
        calories_burned: cal,
      });
      if (error) throw error;

      toast({ title: "Activity logged!", description: `${selected.name} — ${cal} cal burned.` });
      setView("list");
      await loadSessions();
    } catch {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
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
            <div className="gradient-primary px-5 pt-5 pb-4">
              <SheetHeader>
                <SheetTitle className="text-white text-xl font-bold text-left">Log Activity</SheetTitle>
                <p className="text-white/70 text-sm">Track your calories burned today</p>
              </SheetHeader>
              {totalBurned > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/20 rounded-2xl px-4 py-2">
                  <Flame className="w-4 h-4 text-orange-200" />
                  <span className="text-white font-semibold text-sm">{totalBurned} cal burned today</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Today's log */}
              {sessions.length > 0 && (
                <div className="px-5 pt-4 pb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Today's Activities</p>
                  <div className="space-y-2">
                    {sessions.map((s) => {
                      const act = ACTIVITIES.find((a) => a.name === s.workout_type);
                      return (
                        <div key={s.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                          <span className="text-xl">{act?.emoji ?? "🏃"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800 truncate">{s.workout_type}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Clock className="w-3 h-3" /> {s.duration_minutes} min
                              </span>
                              <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                                <Flame className="w-3 h-3" /> {s.calories_burned} cal
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteSession(s.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-gray-100 my-4" />
                </div>
              )}

              {/* Search */}
              <div className="px-5 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search activities..."
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
                    {cat}
                  </button>
                ))}
              </div>

              {/* Activity list */}
              <div className="px-5 pb-8 space-y-5">
                {loadingSessions ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                ) : Object.entries(groupedByCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat}</p>
                    <div className="space-y-1">
                      {items.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => pickActivity(a)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 transition-colors text-left border border-gray-100"
                        >
                          <span className="text-xl w-8 flex-shrink-0 text-center">{a.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800">{a.name}</p>
                            <p className="text-xs text-gray-400">~{Math.round(a.met * weightKg)} cal / hour</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Detail view ── */}
        {view === "detail" && selected && (
          <>
            {/* Header */}
            <div className="gradient-primary px-5 pt-5 pb-4">
              <button
                onClick={() => setView("list")}
                className="flex items-center gap-1.5 text-white/80 text-sm mb-3 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selected.emoji}</span>
                <div>
                  <h2 className="text-white text-xl font-bold">{selected.name}</h2>
                  <p className="text-white/70 text-sm">{selected.category}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8 space-y-6">
              {/* Duration input */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">
                  Duration
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
                  <span className="text-lg font-semibold text-gray-400">min</span>
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
                    Custom
                  </button>
                </div>
              </div>

              {/* Calorie preview */}
              {estimatedCal > 0 && (
                <div className="bg-orange-50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Flame className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-orange-400 font-medium">Estimated burn</p>
                    <p className="text-3xl font-black text-orange-600">{estimatedCal} <span className="text-base font-semibold">cal</span></p>
                  </div>
                </div>
              )}

              {/* Formula explanation */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">How it's calculated</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  MET ({selected.met}) × your weight ({weightKg} kg) × duration = calories burned.
                  This uses the standard metabolic equivalent formula used by MyFitnessPal and Cronometer.
                </p>
              </div>

              <Button
                onClick={saveSession}
                disabled={saving || !duration || parseInt(duration) <= 0}
                className="w-full h-14 rounded-2xl font-bold text-white text-base gradient-primary shadow-lg shadow-primary/20"
              >
                {saving
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><CheckCircle2 className="w-5 h-5 mr-2" /> Log {estimatedCal > 0 ? `${estimatedCal} cal` : "Activity"}</>
                }
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
