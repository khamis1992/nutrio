import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Droplets, Utensils, Target, Scale } from "lucide-react";

interface StreakDisplayProps {
  streaks: {
    logging: { currentStreak: number; bestStreak: number } | null;
    goals: { currentStreak: number; bestStreak: number } | null;
    weight: { currentStreak: number; bestStreak: number } | null;
    water: { currentStreak: number; bestStreak: number } | null;
  };
  loading?: boolean;
}

interface StreakItemProps {
  icon: React.ReactNode;
  current: number;
  best: number;
  color: string;
  bgColor: string;
}

function StreakItem({ icon, current, best, color, bgColor }: StreakItemProps) {
  const isOnFire = current >= 7;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
      <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-slate-900">{current}</span>
          <span className="text-xs text-slate-500">day streak</span>
        </div>
        <p className="text-xs text-slate-400">Best: {best} days</p>
      </div>
      {isOnFire && (
        <div className="px-2 py-1 rounded bg-orange-100 text-orange-600 text-xs font-medium">
          On fire!
        </div>
      )}
    </div>
  );
}

export function StreakDisplay({ streaks, loading }: StreakDisplayProps) {
  if (loading) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Your Streaks
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const streakItems = [
    {
      key: "logging",
      icon: <Utensils className="w-5 h-5" />,
      label: "Logging",
      current: streaks.logging?.currentStreak || 0,
      best: streaks.logging?.bestStreak || 0,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      key: "water",
      icon: <Droplets className="w-5 h-5" />,
      label: "Hydration",
      current: streaks.water?.currentStreak || 0,
      best: streaks.water?.bestStreak || 0,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100",
    },
    {
      key: "goals",
      icon: <Target className="w-5 h-5" />,
      label: "Goals",
      current: streaks.goals?.currentStreak || 0,
      best: streaks.goals?.bestStreak || 0,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      key: "weight",
      icon: <Scale className="w-5 h-5" />,
      label: "Weight Tracking",
      current: streaks.weight?.currentStreak || 0,
      best: streaks.weight?.bestStreak || 0,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
  ];

  const totalStreaks = streakItems.reduce((sum, item) => sum + item.current, 0);

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          Your Streaks
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Total Streak Summary */}
        {totalStreaks > 0 && (
          <div className="p-3 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100">
            <div className="flex items-center gap-2">
              <div className="text-2xl">🔥</div>
              <div>
                <p className="font-medium text-slate-900">
                  {totalStreaks} total active streak{totalStreaks === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-slate-500">
                  Keep it up! Consistency is key to reaching your goals.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Individual Streaks */}
        <div className="space-y-2">
          {streakItems.map((item) => (
            <StreakItem
              key={item.key}
              icon={item.icon}
              current={item.current}
              best={item.best}
              color={item.color}
              bgColor={item.bgColor}
            />
          ))}
        </div>

        {/* Empty State */}
        {totalStreaks === 0 && (
          <div className="text-center py-4 text-slate-400">
            <Flame className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">No active streaks yet</p>
            <p className="text-xs mt-1">Start logging to build your streaks!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
