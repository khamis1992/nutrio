import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Droplets, Moon, Apple, Lightbulb, RefreshCw, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartRecommendation {
  id: string;
  category: "nutrition" | "hydration" | "activity" | "sleep" | "general";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action_text: string;
  action_link: string | null;
  progress?: { value: number; max: number; unit: string } | null;
}

interface SmartRecommendationsProps {
  recommendations: SmartRecommendation[];
  loading: boolean;
  onRefresh?: () => void;
}

const STORAGE_KEY = "smart_rec_done";

const categoryIcons: Record<string, typeof Zap> = {
  nutrition: Apple,
  hydration: Droplets,
  activity: Zap,
  sleep: Moon,
  general: Lightbulb,
};

const categoryColors: Record<string, { bg: string; text: string; ring: string }> = {
  nutrition: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400", ring: "ring-green-200 dark:ring-green-800" },
  hydration: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-200 dark:ring-blue-800" },
  activity: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400", ring: "ring-orange-200 dark:ring-orange-800" },
  sleep: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400", ring: "ring-purple-200 dark:ring-purple-800" },
  general: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", ring: "ring-slate-200 dark:ring-slate-700" },
};

const priorityConfig: Record<string, { label: string; labelBg: string; labelText: string; border: string; glow: boolean }> = {
  high: {
    label: "Urgent",
    labelBg: "bg-red-100 dark:bg-red-900/30",
    labelText: "text-red-600 dark:text-red-400",
    border: "border-l-4 border-l-red-500",
    glow: true,
  },
  medium: {
    label: "Recommended",
    labelBg: "bg-amber-100 dark:bg-amber-900/30",
    labelText: "text-amber-600 dark:text-amber-400",
    border: "border-l-4 border-l-amber-400",
    glow: false,
  },
  low: {
    label: "Tip",
    labelBg: "bg-slate-100 dark:bg-slate-800",
    labelText: "text-slate-500 dark:text-slate-400",
    border: "border-l-4 border-l-slate-300 dark:border-l-slate-600",
    glow: false,
  },
};

function ProgressBar({ value, max, unit, category }: { value: number; max: number; unit: string; category: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const over = value > max;
  const barColor =
    category === "hydration"
      ? "bg-gradient-to-r from-blue-400 to-cyan-500"
      : over
      ? "bg-gradient-to-r from-amber-400 to-orange-500"
      : pct >= 80
      ? "bg-gradient-to-r from-emerald-400 to-green-500"
      : "bg-gradient-to-r from-primary to-accent";

  return (
    <div className="mt-2.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] text-muted-foreground font-medium">
          {value}{unit} <span className="text-muted-foreground/50">/ {max}{unit}</span>
        </span>
        <span className={cn("text-[11px] font-bold", over ? "text-amber-500" : pct >= 80 ? "text-emerald-500" : "text-primary")}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SmartRecommendations({ recommendations, loading, onRefresh }: SmartRecommendationsProps) {
  const navigate = useNavigate();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Load dismissed IDs from localStorage (reset each week)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { ids: string[]; week: number };
        const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
        if (parsed.week === currentWeek) {
          setDone(new Set(parsed.ids));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const markDone = (id: string) => {
    const next = new Set([...done, id]);
    setDone(next);
    const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: [...next], week: currentWeek }));
  };

  const unmarkDone = (id: string) => {
    const next = new Set([...done]);
    next.delete(id);
    setDone(next);
    const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: [...next], week: currentWeek }));
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  const active = recommendations.filter((r) => !done.has(r.id));
  const completed = recommendations.filter((r) => done.has(r.id));

  if (loading) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Smart Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border-l-4 border-l-slate-200 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-full mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Smart Recommendations
            {active.length > 0 && (
              <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {active.length}
              </span>
            )}
          </CardTitle>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Refresh recommendations"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2.5">
        {active.length === 0 && completed.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground">Keep logging to get personalized recommendations</p>
          </div>
        ) : (
          <>
            {/* Active recommendations */}
            {active.slice(0, 4).map((rec, index) => {
              const Icon = categoryIcons[rec.category] || Lightbulb;
              const colors = categoryColors[rec.category] || categoryColors.general;
              const priority = priorityConfig[rec.priority] || priorityConfig.low;

              return (
                <div
                  key={rec.id}
                  className={cn(
                    "rounded-xl bg-card border border-border/60 transition-all duration-200",
                    priority.border,
                    priority.glow && "shadow-sm shadow-red-100 dark:shadow-red-900/20",
                  )}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1", colors.bg, colors.ring)}>
                        <Icon className={cn("w-4 h-4", colors.text)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Priority badge + actions row */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide", priority.labelBg, priority.labelText)}>
                            {priority.label}
                          </span>
                          <button
                            onClick={() => markDone(rec.id)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-2 py-0.5 rounded-full transition-all"
                          >
                            <Check className="w-3 h-3" />
                            Done
                          </button>
                        </div>

                        <p className="font-semibold text-sm text-foreground leading-tight">{rec.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.description}</p>

                        {/* Progress bar */}
                        {rec.progress && (
                          <ProgressBar
                            value={rec.progress.value}
                            max={rec.progress.max}
                            unit={rec.progress.unit}
                            category={rec.category}
                          />
                        )}

                        {/* Action link */}
                        {rec.action_link && (
                          <button
                            onClick={() => navigate(rec.action_link!)}
                            className={cn("mt-2 flex items-center gap-1 text-xs font-semibold transition-colors", colors.text, "hover:underline")}
                          >
                            {rec.action_text}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Completed section */}
            {completed.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-500" />
                  Completed this week ({completed.length})
                </p>
                <div className="space-y-1.5">
                  {completed.map((rec) => (
                    <div key={rec.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 opacity-60">
                      <p className="text-xs font-medium text-muted-foreground line-through">{rec.title}</p>
                      <button
                        onClick={() => unmarkDone(rec.id)}
                        className="text-muted-foreground hover:text-foreground ml-2"
                        title="Undo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
