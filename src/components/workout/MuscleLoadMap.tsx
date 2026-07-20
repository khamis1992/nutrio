import { Accessibility, Target } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import type { MuscleVolume } from "@/lib/strength-training";
import { cn } from "@/lib/utils";

interface MuscleLoadMapProps {
  volumes: MuscleVolume[];
  compact?: boolean;
}

const musclePosition = (muscle: string) => {
  const value = muscle.toLowerCase();
  if (/shoulder|delt|trap|neck/.test(value)) return { top: "20%", left: "50%" };
  if (/chest|pectoral/.test(value)) return { top: "31%", left: "50%" };
  if (/back|lat|rhomboid/.test(value)) return { top: "38%", left: "50%" };
  if (/arm|bicep|tricep|forearm/.test(value)) return { top: "39%", left: "28%" };
  if (/ab|core|oblique/.test(value)) return { top: "49%", left: "50%" };
  if (/glute|hip/.test(value)) return { top: "58%", left: "50%" };
  if (/leg|quad|hamstring|calf|adductor/.test(value)) return { top: "72%", left: "50%" };
  return { top: "50%", left: "50%" };
};

export function MuscleLoadMap({ volumes, compact = false }: MuscleLoadMapProps) {
  const { isRTL } = useLanguage();
  const copy = isRTL
    ? { workingSets: "مجموعات العمل", weeklyVolume: "الحجم الأسبوعي", of: "من", sets: "مجموعات" }
    : { workingSets: "Working sets", weeklyVolume: "Weekly volume", of: "of", sets: "sets" };
  const visible = volumes.slice(0, compact ? 4 : 7);
  const totalCompleted = volumes.reduce((sum, item) => sum + item.completedSets, 0);
  const totalPrescribed = volumes.reduce((sum, item) => sum + item.prescribedSets, 0);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={cn("grid gap-4", compact ? "grid-cols-[100px_1fr]" : "grid-cols-[120px_1fr]") }>
      <div className="relative min-h-[190px] overflow-hidden rounded-[22px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
        <Accessibility className="absolute left-1/2 top-1/2 h-[150px] w-[82px] -translate-x-1/2 -translate-y-1/2 stroke-[1.25] text-[#CBD5E1]" />
        {visible.map((item, index) => {
          const position = musclePosition(item.muscle);
          return (
            <span
              key={item.muscle}
              className="absolute flex h-5 min-w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#7C83F6] px-1 text-[8px] font-black text-white shadow-[0_4px_12px_rgba(124,131,246,0.3)] ring-2 ring-white"
              style={{ ...position, marginLeft: index % 2 === 0 ? "-9px" : "9px" }}
              title={`${item.muscle}: ${item.completedSets}/${item.prescribedSets} ${copy.sets}`}
            >
              {item.completedSets}
            </span>
          );
        })}
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{copy.workingSets}</span>
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#7C83F6]">{copy.weeklyVolume}</p>
            <p className="mt-1 text-[14px] font-black text-[#020617]">{totalCompleted} {copy.of} {totalPrescribed} {copy.sets}</p>
          </div>
          <Target className="h-4 w-4 shrink-0 text-[#22C7A1]" />
        </div>
        <div className="mt-3 space-y-2.5">
          {visible.map((item) => (
            <div key={item.muscle}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-extrabold text-[#475569]">{item.muscle}</span>
                <span className="shrink-0 text-[9px] font-black text-[#94A3B8]">{item.completedSets}/{item.prescribedSets}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#E5EAF1]">
                <span className="block h-full rounded-full bg-[#7C83F6] transition-all" style={{ width: `${item.completionPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
