import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Target, Gift, CheckCircle2, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Mission } from "@/hooks/useDailyMissions";

interface DailyMissionsCardProps {
  missions: Mission[];
  bonusXp: number;
  bonusClaimed: boolean;
  allComplete: boolean;
  onClaimBonus: () => void;
}

export function DailyMissionsCard({
  missions,
  bonusXp,
  bonusClaimed,
  allComplete,
  onClaimBonus,
}: DailyMissionsCardProps) {
  const { t } = useLanguage();
  if (missions.length === 0) return null;

  const allDone = allComplete;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 26 }}
      className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden"
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <Target className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-[13px] font-extrabold text-slate-900">{t("daily_missions")}</h3>
            <p className="text-[10px] text-slate-500">{t("daily_missions_desc")}</p>
          </div>
        </div>
        {allDone && !bonusClaimed && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.94 }}
            onClick={onClaimBonus}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Gift className="w-3.5 h-3.5" />
            +{bonusXp} XP
          </motion.button>
        )}
        {allDone && bonusClaimed && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            Done!
          </div>
        )}
      </div>

      <div className="px-4 pb-4 space-y-1.5">
        {missions.map((mission) => {
          const pct = Math.min(Math.round((mission.current / mission.target) * 100), 100);
          return (
            <div
              key={mission.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                mission.completed
                  ? "bg-gradient-to-r from-emerald-50 to-teal-50 ring-1 ring-emerald-100/60"
                  : "bg-slate-50/80"
              )}
            >
              <span className="text-lg">{mission.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[11px] font-semibold",
                  mission.completed ? "text-emerald-800" : "text-slate-700"
                )}>
                  {mission.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        mission.completed ? "bg-emerald-500" : mission.id === "new_restaurant" || mission.id === "walk_steps" ? "bg-violet-400" : "bg-amber-400"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold",
                    mission.completed ? "text-emerald-600" : "text-slate-400"
                  )}>
                    {pct}%
                  </span>
                </div>
              </div>
              {mission.completed && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
