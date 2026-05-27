import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CalendarCheck,
  Check,
  ChevronRight,
  Droplet,
  Dumbbell,
  Flame,
  Leaf,
  Lock,
  Scale,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  UserRound,
  Wheat,
  Zap,
} from "lucide-react";

import goalWoman from "@/assets/goal-woman-reference.png";

type GoalFocusItem = {
  label: string;
  Icon: LucideIcon;
  accent: string;
  bg: string;
  active?: boolean;
};

type RingMetric = {
  label: string;
  value: number;
  status: string;
  Icon: LucideIcon;
  color: string;
  track: string;
};

const goalFocusItems: GoalFocusItem[] = [
  { label: "Weight Loss", Icon: Scale, accent: "#10B981", bg: "from-emerald-50 to-white", active: true },
  { label: "Muscle Gain", Icon: Dumbbell, accent: "#3B82F6", bg: "from-blue-50 to-white" },
  { label: "Healthy Lifestyle", Icon: Leaf, accent: "#16C784", bg: "from-emerald-50 to-white" },
  { label: "Keto", Icon: Flame, accent: "#F05252", bg: "from-rose-50 to-white" },
  { label: "Balance", Icon: Sparkles, accent: "#8B5CF6", bg: "from-violet-50 to-white" },
  { label: "Energy", Icon: Zap, accent: "#F59E0B", bg: "from-amber-50 to-white" },
];

const weeklyMetrics: RingMetric[] = [
  { label: "Calories", value: 72, status: "On Track", Icon: Flame, color: "#F97316", track: "#FFEDD5" },
  { label: "Protein", value: 58, status: "Improve", Icon: Target, color: "#3B82F6", track: "#DBEAFE" },
  { label: "Carbs", value: 61, status: "Stable", Icon: Wheat, color: "#F7B731", track: "#FEF3C7" },
  { label: "Fat", value: 81, status: "Excellent", Icon: Droplet, color: "#10B981", track: "#D1FAE5" },
];

const weeklyChecklist = [
  { label: "Calories On Track", Icon: Droplet, color: "#10B981", done: true },
  { label: "5 Day Streak", Icon: CalendarCheck, color: "#10B981", done: true },
  { label: "Water Improved", Icon: Droplet, color: "#60A5FA", done: true },
  { label: "Late Night Snacking", Icon: AlertCircle, color: "#FB923C", done: false },
];

const achievements = [
  { label: "First Week Complete", Icon: Trophy, unlocked: true },
  { label: "Protein Pro", Icon: Dumbbell, unlocked: true },
  { label: "Hydration Hero", Icon: Lock, unlocked: false },
  { label: "30-Day Streak", Icon: Lock, unlocked: false },
];

function ProgressRing({ value, size = 112, stroke = 8, color = "#51F3A0", label }: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="text-center text-white drop-shadow-sm">
        <div className="text-[34px] font-black leading-none tracking-[-0.08em]">{value}<span className="text-[18px] tracking-normal">%</span></div>
        {label ? <div className="mt-1 text-[11px] font-semibold text-white/85">{label}</div> : null}
      </div>
    </div>
  );
}

function MetricRing({ metric }: { metric: RingMetric }) {
  const size = 86;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (metric.value / 100) * circumference;
  const Icon = metric.Icon;

  return (
    <article className="rounded-[18px] border border-slate-100 bg-white px-2.5 py-3 text-center shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
      <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }}>
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF2F7" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={metric.color}
            strokeLinecap="round"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <div className="flex flex-col items-center">
          <Icon className="h-5 w-5" style={{ color: metric.color }} strokeWidth={2.4} />
          <span className="mt-1 text-[11px] font-semibold text-slate-700">{metric.label}</span>
          <span className="text-[22px] font-black leading-none tracking-[-0.06em] text-[#111827]">{metric.value}%</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-medium text-slate-500">{metric.status}</p>
      <div className="mx-auto mt-2 h-1 w-11 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${metric.value}%`, backgroundColor: metric.color }} />
      </div>
    </article>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-black tracking-[-0.04em] text-[#111827]">{title}</h2>
      {action ? (
        <button className="flex items-center gap-1 text-[13px] font-extrabold text-[#00A86B]" type="button">
          {action}
          <ChevronRight className="h-4 w-4" strokeWidth={3} />
        </button>
      ) : null}
    </div>
  );
}

function GoalFocusCard({ item }: { item: GoalFocusItem }) {
  const Icon = item.Icon;

  return (
    <button
      type="button"
      className={`flex h-[74px] min-w-[68px] flex-col items-center justify-center rounded-[18px] border bg-gradient-to-b ${item.bg} text-center shadow-[0_12px_22px_rgba(15,23,42,0.04)] ${
        item.active ? "border-[#15C78D] ring-1 ring-[#15C78D]/20" : "border-slate-100"
      }`}
    >
      <div className="mb-1.5 grid h-8 w-8 place-items-center rounded-[10px] text-white shadow-[0_8px_16px_rgba(16,185,129,0.22)]" style={{ backgroundColor: item.accent }}>
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </div>
      <span className={`max-w-[60px] text-[10px] font-extrabold leading-[1.15] ${item.active ? "text-[#00A86B]" : "text-slate-700"}`}>{item.label}</span>
    </button>
  );
}

function HumanSilhouette() {
  return (
    <div className="relative mx-auto h-[92px] w-[50px] opacity-70">
      <div className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full bg-emerald-200" />
      <div className="absolute left-1/2 top-[19px] h-[48px] w-[24px] -translate-x-1/2 rounded-t-full rounded-b-[18px] bg-emerald-100" />
      <div className="absolute left-[7px] top-[24px] h-[48px] w-2 rotate-12 rounded-full bg-emerald-100" />
      <div className="absolute right-[7px] top-[24px] h-[48px] w-2 -rotate-12 rounded-full bg-emerald-100" />
      <div className="absolute left-[17px] top-[62px] h-[30px] w-2 rotate-6 rounded-full bg-emerald-100" />
      <div className="absolute right-[17px] top-[62px] h-[30px] w-2 -rotate-6 rounded-full bg-emerald-100" />
    </div>
  );
}

export default function ProgressRedesigned() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#FAFBFC] text-[#101827]">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-8 pt-[calc(env(safe-area-inset-top,0px)+20px)] shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
        <header className="mb-6 flex items-center justify-between px-0.5">
          <button
            aria-label="Go back"
            className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] active:bg-slate-100"
            onClick={() => navigate(-1)}
            type="button"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={2.6} />
          </button>
          <h1 className="text-[23px] font-black tracking-[-0.06em] text-[#111827]">Goals</h1>
          <button aria-label="Open calendar" className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] active:bg-slate-100" type="button">
            <CalendarCheck className="h-[26px] w-[26px]" strokeWidth={2.4} />
          </button>
        </header>

        <div className="mb-6 grid h-[58px] grid-cols-3 rounded-full bg-[#F3F6FA] p-1 shadow-inner shadow-slate-200/60">
          {['Today', 'Week', 'Goals'].map((tab) => (
            <button
              key={tab}
              className={`rounded-full text-[14px] font-extrabold ${tab === 'Goals' ? 'bg-white text-[#00A86B] shadow-[0_10px_22px_rgba(15,23,42,0.10)]' : 'text-slate-500'}`}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <section className="relative mb-7 h-[196px] overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_62%_35%,rgba(81,243,160,0.22),transparent_33%),linear-gradient(135deg,#06966E_0%,#007D67_46%,#006754_100%)] p-5 text-white shadow-[0_18px_40px_rgba(0,128,96,0.24)]">
          <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_12%_22%,white_1px,transparent_1px),radial-gradient(circle_at_74%_20%,white_1.5px,transparent_2px),radial-gradient(circle_at_44%_44%,white_1.5px,transparent_2px),radial-gradient(circle_at_92%_12%,white_1.5px,transparent_2px),radial-gradient(circle_at_70%_82%,white_1px,transparent_1px)]" />
          <div className="absolute -bottom-20 left-[37%] h-48 w-48 rounded-full border-[14px] border-white/12" />
          <img alt="Weight loss progress" className="absolute bottom-0 right-[-17px] h-[194px] w-[148px] object-contain object-bottom drop-shadow-[0_22px_30px_rgba(0,0,0,0.22)]" src={goalWoman} />

          <div className="relative z-10 flex h-full">
            <div className="w-[47%]">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase backdrop-blur-md">
                <Flame className="h-5 w-5 fill-orange-400 text-orange-400" />
                Active Goal
              </div>
              <h2 className="text-[25px] font-black leading-none tracking-[-0.06em]">Weight Loss</h2>
              <p className="mt-2 text-[13px] font-medium text-white/90">Your transformation progress</p>

              <div className="mt-4 flex items-center gap-2">
                <div className="rounded-[12px] bg-white/12 px-3 py-2 text-center shadow-inner shadow-white/5 backdrop-blur-md">
                  <div className="text-[22px] font-black leading-none">75<span className="ml-1 text-[11px]">kg</span></div>
                  <div className="mt-1 text-[10px] text-white/75">Current</div>
                </div>
                <ArrowLeft className="h-5 w-5 rotate-180 text-white" />
                <div className="rounded-[12px] bg-white/12 px-3 py-2 text-center shadow-inner shadow-white/5 backdrop-blur-md">
                  <div className="text-[22px] font-black leading-none">63<span className="ml-1 text-[11px]">kg</span></div>
                  <div className="mt-1 text-[10px] text-white/75">Goal</div>
                </div>
              </div>
            </div>

            <div className="absolute left-[42%] top-[55px] z-20">
              <ProgressRing value={72} label="Progress" />
              <div className="mt-4 flex justify-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white" />
                <span className="h-2 w-2 rounded-full bg-white/25" />
                <span className="h-2 w-2 rounded-full bg-white/25" />
                <span className="h-2 w-2 rounded-full bg-white/25" />
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-5 z-20">
            <div className="mb-3 flex items-center gap-3 text-[12px] font-extrabold text-white/90">
              <span>−12 kg target</span>
              <span className="h-1 w-1 rounded-full bg-white/70" />
              <span>82% consistency</span>
            </div>
            <div className="flex w-[150px] items-center gap-2 rounded-[10px] bg-white/12 px-3 py-2 backdrop-blur-md">
              <TrendingUp className="h-6 w-6 text-[#5CF0A7]" strokeWidth={2.6} />
              <p className="text-[10px] font-bold leading-tight text-white/90">You're ahead of last month!</p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <SectionHeader action="View All" title="Goal Focus" />
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {goalFocusItems.map((item) => <GoalFocusCard key={item.label} item={item} />)}
          </div>
        </section>

        <section className="mb-5">
          <SectionHeader action="View Details" title="Weekly Performance" />
          <div className="grid grid-cols-4 gap-2.5">
            {weeklyMetrics.map((metric) => <MetricRing key={metric.label} metric={metric} />)}
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3">
          <article className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <UserRound className="h-4 w-4" />
              </div>
              <h3 className="text-[15px] font-black tracking-[-0.04em]">Body Metrics</h3>
            </div>
            <div className="grid grid-cols-[1fr_54px_1fr] items-center gap-2">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-semibold text-slate-500">Current Weight</p>
                  <p className="mt-1 text-[21px] font-black tracking-[-0.06em]">75<span className="ml-1 text-[11px] font-bold">kg</span></p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500">Height</p>
                  <p className="mt-1 text-[19px] font-black tracking-[-0.05em]">175<span className="ml-1 text-[11px] font-bold">cm</span></p>
                </div>
              </div>
              <HumanSilhouette />
              <div className="space-y-5 text-right">
                <div>
                  <p className="text-[10px] font-semibold text-slate-500">Goal Weight</p>
                  <p className="mt-1 text-[21px] font-black tracking-[-0.06em]">63<span className="ml-1 text-[11px] font-bold">kg</span></p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500">BMI</p>
                  <p className="mt-1 text-[21px] font-black tracking-[-0.06em]">24.5</p>
                  <p className="text-[10px] font-extrabold text-[#00A86B]">Healthy</p>
                </div>
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-slate-100">
              <div className="relative h-full w-[52%] rounded-full bg-gradient-to-r from-emerald-200 to-emerald-500">
                <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-500 shadow" />
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[20px] border border-violet-50 bg-[radial-gradient(circle_at_7%_18%,rgba(139,92,246,0.22),transparent_22%),linear-gradient(135deg,#FFFFFF_0%,#F5F0FF_55%,#FFFFFF_100%)] p-4 shadow-[0_16px_34px_rgba(76,29,149,0.10)]">
            <Sparkles className="absolute right-4 top-5 h-4 w-4 text-white" />
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-violet-600 shadow-[0_8px_20px_rgba(139,92,246,0.22)]">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-[17px] font-black tracking-[-0.05em]">AI Coach</h3>
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-600">NEW</span>
            </div>
            <div className="flex gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-b from-blue-100 to-violet-100 shadow-[0_10px_24px_rgba(59,130,246,0.22)]">
                <Bot className="h-9 w-9 text-blue-600" />
              </div>
              <p className="text-[13px] font-medium leading-5 text-slate-600">Increase protein intake by 18g daily to improve fat burning and muscle retention.</p>
            </div>
            <button className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#10B981] to-[#009B72] text-[13px] font-black text-white shadow-[0_12px_20px_rgba(16,185,129,0.24)]" type="button">
              <Sparkles className="h-5 w-5" />
              Apply Suggestion
            </button>
          </article>
        </section>

        <section className="mb-5 grid grid-cols-[0.9fr_1.35fr] gap-3">
          <article className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <h3 className="mb-4 text-[16px] font-black tracking-[-0.05em]">This Week</h3>
            <div className="space-y-3">
              {weeklyChecklist.map((item) => {
                const Icon = item.Icon;
                return (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-full" style={{ backgroundColor: `${item.color}1A`, color: item.color }}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="min-w-0 flex-1 text-[12px] font-semibold text-slate-600">{item.label}</span>
                    <div className={`grid h-6 w-6 place-items-center rounded-full ${item.done ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-500"}`}>
                      {item.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-sm font-black">!</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-black tracking-[-0.05em]">Achievements</h3>
              <button className="text-[12px] font-black text-[#00A86B]" type="button">View All</button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {achievements.map((achievement) => {
                const Icon = achievement.Icon;
                return (
                  <div key={achievement.label} className="flex flex-col items-center">
                    <div className={`grid h-12 w-12 place-items-center rounded-[16px] border shadow-inner ${achievement.unlocked ? "border-amber-200 bg-gradient-to-br from-amber-200 to-amber-500 text-amber-800" : "border-slate-300 bg-gradient-to-br from-slate-100 to-slate-300 text-slate-500"}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="mt-2 text-[10px] font-semibold leading-tight text-slate-600">{achievement.label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/2 rounded-full bg-[#10B981]" />
              </div>
              <p className="text-[12px] font-black text-[#00A86B]">2 <span className="font-semibold text-slate-500">/ 4 Unlocked</span></p>
              <div className="h-1.5 flex-1 rounded-full bg-slate-100" />
            </div>
          </article>
        </section>

        <section className="mb-4 flex items-center gap-4 rounded-[18px] border border-emerald-100 bg-[linear-gradient(100deg,#ECFDF5_0%,#F7FFFB_54%,#F4F8FF_100%)] p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-emerald-100 text-[34px] shadow-inner">🏆</div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[18px] font-black tracking-[-0.05em]">Keep going, Adam! 💪</h3>
            <p className="mt-1 text-[13px] font-medium leading-5 text-slate-600">Only 3 kg left to unlock your first transformation milestone.</p>
          </div>
          <div className="hidden min-w-[126px] rounded-[14px] bg-white/80 p-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)] min-[390px]:block">
            <TrendingUp className="mb-1 h-7 w-7 text-[#00A86B]" strokeWidth={2.8} />
            <p className="text-[12px] font-semibold leading-4 text-slate-600">You're doing better than <span className="font-black text-[#00A86B]">68%</span> of users this week!</p>
          </div>
        </section>
      </div>
    </main>
  );
}
