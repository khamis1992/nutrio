import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardList,
  Flame,
  LayoutDashboard,
  NotebookPen,
  Target,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type CoachClientView = "overview" | "plans" | "progress" | "notes";

const clientViews: Array<{
  id: CoachClientView;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "plans", label: "Plans", icon: ClipboardList },
  { id: "progress", label: "Progress", icon: Activity },
  { id: "notes", label: "Notes", icon: NotebookPen },
];

interface CoachClientHeroProps {
  name: string;
  avatarUrl: string | null;
  goal: string;
  streak: number;
  adherence: number;
  activeGoals: number;
  activePlans: number;
  onBack: () => void;
  onEditTargets: () => void;
  onExportReport: () => void;
}

export function CoachClientHero({
  name,
  avatarUrl,
  goal,
  streak,
  adherence,
  activeGoals,
  activePlans,
  onBack,
  onEditTargets,
  onExportReport,
}: CoachClientHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-white px-5 pb-5 pt-4 text-[#07152F] shadow-[0_16px_40px_rgba(15,23,42,0.08)] ring-1 ring-[#DDE5EF]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#20d3ad_0_34%,#56b8ff_34%_67%,#ff6f61_67%)]" />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to clients"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F4F7FA] text-[#07152F] ring-1 ring-[#DDE5EF] transition-colors hover:bg-[#ECF1F6] active:scale-95"
        >
          <span aria-hidden="true" className="text-[24px] leading-none">&#8249;</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEditTargets}
            className="h-11 rounded-full bg-[#F4F7FA] px-4 text-[12px] font-bold text-[#41506A] ring-1 ring-[#DDE5EF] transition-colors hover:bg-[#ECF1F6] active:scale-95"
          >
            Edit targets
          </button>
          <button
            type="button"
            onClick={onExportReport}
            aria-label="Export client report"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#22C7A1] text-white shadow-[0_8px_20px_rgba(34,199,161,0.22)] transition-colors hover:bg-[#18B894] active:scale-95"
          >
            <ClipboardList className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div className="relative h-[76px] w-[76px] shrink-0 rounded-[24px] bg-[#E9FBF7] p-1.5 ring-1 ring-[#BCECDF]">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${name} profile`} className="h-full w-full rounded-[19px] object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-[19px] bg-[#22C7A1] text-[26px] font-extrabold text-white">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-white bg-[#22C7A1]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#16A98A]">Athlete profile</p>
          <h1 className="mt-1 truncate text-[23px] font-extrabold leading-tight text-[#07152F]">{name}</h1>
          <p className="mt-1 truncate text-[12px] font-medium text-[#71809C]">{goal}</p>
          {streak > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FFF3E8] px-2.5 py-1 text-[10px] font-bold text-[#D86B22] ring-1 ring-[#FAD8BD]">
              <Flame className="h-3 w-3" /> {streak}-day logging streak
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x divide-[#DDE5EF] rounded-[20px] bg-[#F6F8FB] py-3 ring-1 ring-[#E1E7EF]">
        <HeroMetric value={`${adherence}%`} label="Adherence" accent="text-[#16A98A]" />
        <HeroMetric value={activePlans.toString()} label="Active plans" accent="text-[#338DCE]" />
        <HeroMetric value={activeGoals.toString()} label="Live goals" accent="text-[#F06B65]" />
      </div>
    </section>
  );
}

function HeroMetric({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="px-2 text-center">
      <p className={cn("text-[20px] font-extrabold leading-none", accent)}>{value}</p>
      <p className="mt-1.5 whitespace-nowrap text-[9px] font-bold text-[#8A98AF]">{label}</p>
    </div>
  );
}

interface CoachClientSectionNavProps {
  value: CoachClientView;
  onChange: (view: CoachClientView) => void;
}

export function CoachClientSectionNav({ value, onChange }: CoachClientSectionNavProps) {
  return (
    <nav aria-label="Client workspace" className="sticky top-0 z-20 -mx-1 overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="grid min-w-[356px] grid-cols-4 rounded-[20px] border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        {clientViews.map(({ id, label, icon: Icon }) => {
          const selected = id === value;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-[15px] px-2 text-[10px] font-bold transition-all",
                selected
                  ? "bg-[#E9FBF7] text-[#087B67] ring-1 ring-[#BCECDF]"
                  : "text-slate-500 hover:bg-slate-50",
              )}
            >
              <Icon className={cn("h-[17px] w-[17px]", selected && "text-[#16A98A]")} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function CoachClientViewIntro({ view }: { view: CoachClientView }) {
  const content: Record<CoachClientView, { eyebrow: string; title: string; copy: string; icon: LucideIcon }> = {
    overview: { eyebrow: "Today", title: "Coaching snapshot", copy: "The signals that need your attention now.", icon: Target },
    plans: { eyebrow: "Programming", title: "Plans & assignments", copy: "Build meals and workouts without leaving the client flow.", icon: ClipboardList },
    progress: { eyebrow: "Performance", title: "Progress intelligence", copy: "Measurements, consistency and training response in one view.", icon: Activity },
    notes: { eyebrow: "Coach only", title: "Private workspace", copy: "Capture observations and decisions while context is fresh.", icon: NotebookPen },
  };
  const item = content[view];
  const Icon = item.icon;

  return (
    <header className="flex items-start gap-3 px-1 pb-1 pt-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#20d3ad]/10 text-[#0b9d82]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-extrabold uppercase text-[#0b9d82]">{item.eyebrow}</p>
        <h2 className="mt-0.5 text-[18px] font-extrabold text-slate-950">{item.title}</h2>
        <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-500">{item.copy}</p>
      </div>
    </header>
  );
}
