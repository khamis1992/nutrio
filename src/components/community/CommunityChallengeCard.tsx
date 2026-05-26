import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Users } from "lucide-react";
import { fadeInUp } from "@/lib/animations";

type Challenge = {
  id: string;
  title: string;
  description: string;
  participants: number;
  daysLeft: number;
};

const daysLeftInMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
};

const challenges: Challenge[] = [
  {
    id: "streak-challenge",
    title: "30-Day Streak Challenge",
    description: "Log your meals every day and build the longest streak!",
    participants: 128,
    daysLeft: daysLeftInMonth(),
  },
  {
    id: "meals-challenge",
    title: "Most Meals Logged",
    description: "Share your progress and climb the monthly leaderboard!",
    participants: 96,
    daysLeft: daysLeftInMonth(),
  },
];

const podiumAvatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=120&auto=format&fit=crop",
];

export function CommunityChallengeCard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const challenge = challenges[activeIndex];
  const isJoined = joined.has(challenge.id);

  const handleJoin = () => {
    setJoined((prev) => {
      const next = new Set(prev);
      if (next.has(challenge.id)) {
        next.delete(challenge.id);
      } else {
        next.add(challenge.id);
      }
      return next;
    });
  };

  const nextChallenge = () => {
    setActiveIndex((prev) => (prev === challenges.length - 1 ? 0 : prev + 1));
  };

  return (
    <motion.div variants={fadeInUp}>
      <div className="relative min-h-[306px] overflow-hidden rounded-[28px] border border-emerald-200 bg-[radial-gradient(circle_at_78%_35%,rgba(43,213,177,0.36),transparent_31%),linear-gradient(135deg,#009D72_0%,#00856B_47%,#007B82_100%)] p-4 text-white shadow-[0_14px_28px_rgba(0,113,98,0.22)]">
        <div className="absolute right-2 top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="absolute right-7 top-[72px] select-none text-[118px] leading-none drop-shadow-[0_12px_18px_rgba(0,0,0,0.22)]">🏆</div>
        <div className="absolute right-8 top-16 h-2 w-2 rotate-45 bg-amber-300" />
        <div className="absolute right-4 top-28 h-2 w-2 rotate-45 bg-orange-400" />
        <div className="absolute right-28 top-24 h-2 w-2 rotate-45 bg-sky-300" />
        <div className="absolute left-[46%] top-10 text-4xl leading-none text-white/20">✣</div>
        <div className="absolute left-[43%] top-20 text-5xl leading-none text-white/15">✣</div>

        <div className="relative flex items-center gap-2">
          <Badge className="h-8 rounded-full border-0 bg-white/20 px-3 text-[12px] text-white backdrop-blur-md">🔥 Active Challenge</Badge>
        </div>

        <div className="relative mt-5 max-w-[55%] space-y-2">
          <h3 className="text-[25px] font-extrabold leading-[1.13] tracking-[-0.02em]">{challenge.title}</h3>
          <p className="text-[14px] leading-5 text-white/95">{challenge.description}</p>
        </div>

        <div className="relative mt-5 flex items-center gap-2 text-sm">
          <div className="inline-flex min-w-[86px] items-center gap-2 rounded-[16px] bg-white/15 px-3 py-2.5 backdrop-blur-md">
            <Users className="h-5 w-5" />
            <div className="leading-tight">
              <div className="text-[19px] font-extrabold">{challenge.participants}</div>
              <div className="text-[11px] opacity-95">Participants</div>
            </div>
          </div>
          <div className="inline-flex min-w-[78px] items-center gap-2 rounded-[16px] bg-white/15 px-3 py-2.5 backdrop-blur-md">
            <CalendarDays className="h-5 w-5" />
            <div className="leading-tight">
              <div className="text-[19px] font-extrabold">{challenge.daysLeft}</div>
              <div className="text-[11px] opacity-95">Days Left</div>
            </div>
          </div>
        </div>

        <div className="relative mt-5 rounded-[19px] bg-white p-3 text-foreground shadow-[0_10px_22px_rgba(0,0,0,0.08)]">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">Top 3 Leaderboard</p>
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-1">
              {podiumAvatars.map((src, i) => (
                <div key={src} className="relative">
                  <img src={src} alt={`leader-${i + 1}`} className="h-9 w-9 rounded-full border border-white object-cover shadow" />
                  <div className={`absolute -bottom-2 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-400"}`}>
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
            <div className="h-10 w-px bg-border" />
            <p className="flex-1 text-center text-[13px] text-muted-foreground">No entries yet — be the first!</p>
            <div className="flex h-9 items-end gap-1">
              {[14, 22, 30, 21].map((height) => (
                <span key={height} className="w-2 rounded-t bg-emerald-200" style={{ height }} />
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex items-center gap-0">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleJoin}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-white text-sm font-extrabold text-emerald-700 shadow-[0_10px_18px_rgba(0,0,0,0.08)]"
          >
            {isJoined ? "Joined!" : "Join Challenge"}
          </motion.button>
          <button
            className="-ml-11 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg"
            onClick={nextChallenge}
            aria-label="Next challenge"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
