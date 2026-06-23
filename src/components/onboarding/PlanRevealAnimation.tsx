import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { spring, springBouncy } from "@/lib/animations";

interface MacroRing {
  label: string;
  value: number;
  max: number;
  color: string;
  gradientId: string;
}

interface PlanRevealAnimationProps {
  calories: number;
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
  carbs: number;
  protein: number;
  fat: number;
  onViewDashboard: () => void;
}

const R = 100;
const CIRC = 2 * Math.PI * R;
const NUM_PARTICLES = 30;

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: randomBetween(0, 100),
    y: randomBetween(-10, 30),
    size: randomBetween(3, 8),
    color: [
      "#22C7A1", "#7C83F6", "#38BDF8", "#FB6B7A", "#F97316",
    ][Math.floor(Math.random() * 5)],
    duration: randomBetween(1.5, 4),
    delay: randomBetween(0, 1.5),
  }));
}

export function PlanRevealAnimation({
  calories,
  carbsPct,
  proteinPct,
  fatPct,
  carbs,
  protein,
  fat,
  onViewDashboard,
}: PlanRevealAnimationProps) {
  const [phase, setPhase] = useState<"filling" | "revealed">("filling");
  const [ringProgress, setRingProgress] = useState(0);

  const particles = useMemo(() => generateParticles(NUM_PARTICLES), []);

  useEffect(() => {
    if (phase !== "filling") return;
    const start = Date.now();
    const duration = 1800;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setRingProgress(eased);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setRingProgress(1);
        setTimeout(() => setPhase("revealed"), 400);
      }
    };
    requestAnimationFrame(tick);
  }, [phase]);

  const rings: MacroRing[] = [
    { label: "Carbs", value: carbs, max: Math.round((calories * (carbsPct / 100)) / 4) || carbs, color: "#F97316", gradientId: "gradCarbs" },
    { label: "Protein", value: protein, max: Math.round((calories * (proteinPct / 100)) / 4) || protein, color: "#7C83F6", gradientId: "gradProtein" },
    { label: "Fat", value: fat, max: Math.round((calories * (fatPct / 100)) / 9) || fat, color: "#FB6B7A", gradientId: "gradFat" },
  ];

  const mainOffset = CIRC * (1 - ringProgress);

  return (
    <div className="fixed inset-0 mx-auto flex max-w-[430px] flex-col overflow-hidden bg-[#F6F8FB] text-[#020617]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
            }}
            animate={{
              y: [0, -window.innerHeight * 0.9],
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0.5],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8">
        <h1 className="mb-10 text-center text-[26px] font-extrabold leading-tight text-[#020617]">
          Your personalized plan is ready!
        </h1>

        <div className="relative mb-8" style={{ width: 240, height: 240 }}>
          <svg width="240" height="240" viewBox="0 0 240 240">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22C7A1" />
                <stop offset="50%" stopColor="#7C83F6" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
            </defs>
            <circle
              cx="120" cy="120" r={R}
              fill="none"
              stroke="#E5EAF1"
              strokeWidth="16"
            />
            <motion.circle
              cx="120" cy="120" r={R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: mainOffset }}
              transition={{ duration: 0 }}
              transform="rotate(-90 120 120)"
              style={{ filter: "drop-shadow(0 10px 18px rgba(34,199,161,0.18))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {phase === "filling" ? (
                <motion.span
                  key="pct"
                  className="text-[40px] font-extrabold leading-none text-[#020617]"
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  {Math.round(ringProgress * 100)}%
                </motion.span>
              ) : (
                <motion.div
                  key="cal"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={spring}
                  className="flex flex-col items-center"
                >
                  <span className="text-[36px] font-extrabold leading-none text-[#020617]">{calories.toLocaleString()}</span>
                  <span className="mt-1 text-sm font-bold text-[#64748B]">kcal / day</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {phase === "revealed" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.2 }}
              className="w-full max-w-xs space-y-3"
            >
              <div className="flex items-center justify-center gap-3">
                {rings.map((ring) => (
                  <motion.div
                    key={ring.label}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...springBouncy, delay: 0.4 }}
                    className="flex items-center gap-1.5"
                  >
                    <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: ring.color }} />
                    <span className="text-xs font-extrabold text-[#020617]">{ring.label}</span>
                    <span className="text-xs text-[#64748B]">{ring.value}g</span>
                  </motion.div>
                ))}
              </div>

              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-[#64748B]">
                <span>{carbsPct}% carbs</span>
                <span className="text-border">·</span>
                <span>{proteinPct}% protein</span>
                <span className="text-border">·</span>
                <span>{fatPct}% fat</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === "revealed" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.6 }}
            className="flex-shrink-0 px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4"
          >
            <Button
              size="xl"
              className="h-14 w-full rounded-[20px] bg-[#020617] font-extrabold text-white shadow-none hover:bg-[#020617]/90"
              onClick={onViewDashboard}
            >
              View Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
