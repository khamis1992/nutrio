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
      "#f97316", "#ef4444", "#3b82f6", "#84cc16",
      "#a855f7", "#f59e0b", "#ec4899",
    ][Math.floor(Math.random() * 7)],
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
    { label: "Carbs", value: carbs, max: Math.round((calories * (carbsPct / 100)) / 4) || carbs, color: "#ef4444", gradientId: "gradCarbs" },
    { label: "Protein", value: protein, max: Math.round((calories * (proteinPct / 100)) / 4) || protein, color: "#f97316", gradientId: "gradProtein" },
    { label: "Fat", value: fat, max: Math.round((calories * (fatPct / 100)) / 9) || fat, color: "#3b82f6", gradientId: "gradFat" },
  ];

  const mainOffset = CIRC * (1 - ringProgress);

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden" style={{ maxWidth: 430, margin: "0 auto" }}>
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

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        <h1 className="text-[26px] font-extrabold text-foreground leading-tight text-center mb-10">
          Your personalized plan is ready!
        </h1>

        <div className="relative mb-8" style={{ width: 240, height: 240 }}>
          <svg width="240" height="240" viewBox="0 0 240 240">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <circle
              cx="120" cy="120" r={R}
              fill="none"
              className="stroke-muted/40"
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
              style={{ filter: "drop-shadow(0 0 8px rgba(249,115,22,0.3))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {phase === "filling" ? (
                <motion.span
                  key="pct"
                  className="text-[40px] font-extrabold text-foreground leading-none"
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
                  <span className="text-[36px] font-extrabold text-foreground leading-none">{calories.toLocaleString()}</span>
                  <span className="text-sm font-medium text-muted-foreground mt-1">kcal / day</span>
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
              <div className="flex items-center gap-3 justify-center">
                {rings.map((ring) => (
                  <motion.div
                    key={ring.label}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...springBouncy, delay: 0.4 }}
                    className="flex items-center gap-1.5"
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ring.color }} />
                    <span className="text-xs font-semibold text-foreground">{ring.label}</span>
                    <span className="text-xs text-muted-foreground">{ring.value}g</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
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
            className="px-6 pb-10 pt-4 flex-shrink-0"
          >
            <Button
              variant="gradient"
              size="xl"
              className="w-full rounded-2xl font-bold shadow-lg shadow-primary/20"
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
