import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Trophy, Award } from "lucide-react";

interface Milestone {
  id: number;
  title: string;
  description: string;
  achieved: boolean;
  icon: string;
}

interface MilestonesListProps {
  milestones: Milestone[];
}

export const MilestonesList = ({ milestones }: MilestonesListProps) => {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200/50">
              <Trophy className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{t("milestones")}</h3>
              <p className="text-[11px] text-slate-400">
                {milestones.filter(m => m.achieved).length} / {milestones.length} {t("achieved")}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-500 bg-amber-50 px-2.5 py-1 rounded-full">
            {Math.round((milestones.filter(m => m.achieved).length / milestones.length) * 100)}%
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
            style={{ width: `${Math.round((milestones.filter(m => m.achieved).length / milestones.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Milestone rows */}
      <div className="divide-y divide-slate-50">
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            className={cn(
              "flex items-center gap-4 px-5 py-3.5 transition-colors",
              milestone.achieved ? "bg-amber-50/60" : "bg-white"
            )}
          >
            {/* Emoji badge */}
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0",
              milestone.achieved ? "bg-amber-100" : "bg-slate-100"
            )}>
              {milestone.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold text-sm truncate",
                milestone.achieved ? "text-slate-900" : "text-slate-500"
              )}>
                {milestone.title}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{milestone.description}</p>
            </div>

            {/* Status badge */}
            {milestone.achieved ? (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-200/60 shrink-0">
                <Award className="w-3.5 h-3.5 text-white" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <div className="w-3 h-3 rounded-full border-2 border-slate-300" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
