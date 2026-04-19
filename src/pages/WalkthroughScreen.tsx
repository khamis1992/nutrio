import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/* ─── Circular macro ring ────────────────────────────────────────── */
const MacroRing = ({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) => {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value / max, 1));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ position: "relative", width: 52, height: 52 }}>
        <svg width="52" height="52" style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx="26" cy="26" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4.5" />
          <circle
            cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4.5"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: 7, color: "#9ca3af", lineHeight: 1.3 }}>/{max}g</span>
        </div>
      </div>
      <span style={{ fontSize: 8, color: "#6b7280" }}>{label}</span>
    </div>
  );
};

/* ─── Phone screens ──────────────────────────────────────────────── */
const DashboardScreen = () => (
  <div style={{ width: "100%", height: "100%", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
    {/* App bar */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px 5px", borderBottom: "1px solid #f3f4f6" }}>
      <img src="/nutrio/logo.png" alt="Nutrio" style={{ height: 20, width: "auto", objectFit: "contain" }} />
      <span style={{ fontSize: 10, fontWeight: 700 }}>Nutrio</span>
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>🔔</div>
    </div>
    {/* Date */}
    <div style={{ textAlign: "center", padding: "5px 0 3px", fontSize: 9, fontWeight: 600, color: "#374151" }}>
      Today, Dec 22 📅
    </div>
    {/* Calorie row */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px 6px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 7, color: "#9ca3af", display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#8DC63F" }} />Eaten
        </div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>1634</div>
        <div style={{ fontSize: 7, color: "#9ca3af" }}>kcal</div>
      </div>
      {/* Centre ring */}
      <div style={{ position: "relative", width: 62, height: 62 }}>
        <svg width="62" height="62" style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx="31" cy="31" r="24" fill="none" stroke="#f3f4f6" strokeWidth="4.5" />
          <circle cx="31" cy="31" r="24" fill="none" stroke="#8DC63F" strokeWidth="4.5"
            strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * 0.35}
            strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>1190</span>
          <span style={{ fontSize: 6.5, color: "#9ca3af" }}>kcal left</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 7, color: "#9ca3af" }}>🔥 Burned</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>265</div>
        <div style={{ fontSize: 7, color: "#9ca3af" }}>kcal</div>
      </div>
    </div>
    {/* Macro rings */}
    <div style={{ padding: "0 8px" }}>
      <div style={{ fontSize: 7, color: "#9ca3af", fontWeight: 600, marginBottom: 3 }}>Eaten</div>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        <MacroRing value={168} max={224} color="#EF4444" label="Carbs" />
        <MacroRing value={83} max={128} color="#F97316" label="Protein" />
        <MacroRing value={70} max={128} color="#3B82F6" label="Fat" />
      </div>
    </div>
    {/* Burned */}
    <div style={{ padding: "6px 10px 0" }}>
      <div style={{ fontSize: 7, color: "#9ca3af", fontWeight: 600, marginBottom: 3 }}>Burned</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div><div style={{ fontSize: 7, color: "#9ca3af" }}>👟 Walking</div><div style={{ fontSize: 13, fontWeight: 700 }}>100</div></div>
        <div><div style={{ fontSize: 7, color: "#9ca3af" }}>⚡ Activity</div><div style={{ fontSize: 13, fontWeight: 700 }}>165</div></div>
        <div style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: "50%", background: "#8DC63F", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 16, color: "white", lineHeight: 1 }}>+</span>
        </div>
      </div>
    </div>
  </div>
);

/** Slide 2 — Insights / Calorie Bar Chart (from Figma node 50429:120028) */
const InsightsScreen = () => {
  // Bar values in kcal for Dec 16–22
  const bars = [
    { day: "16", kcal: 2000, selected: false },
    { day: "17", kcal: 2600, selected: true },
    { day: "18", kcal: 2200, selected: false },
    { day: "19", kcal: 2050, selected: false },
    { day: "20", kcal: 2300, selected: false },
    { day: "21", kcal: 1900, selected: false },
    { day: "22", kcal: 2100, selected: false },
  ];
  const goal = 2100;
  const maxKcal = 3000;
  const chartH = 80;
  const chartW = 160;
  const barW = 16;
  const gap = (chartW - bars.length * barW) / (bars.length - 1);
  const yLabels = [3000, 2500, 2000, 1500, 1000, 500];
  const toY = (v: number) => chartH - (v / maxKcal) * chartH;
  const goalY = toY(goal);

  return (
    <div style={{ width: "100%", height: "100%", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* App bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px 5px", borderBottom: "1px solid #f3f4f6" }}>
        <img src="/nutrio/logo.png" alt="Nutrio" style={{ height: 18, width: "auto", objectFit: "contain" }} />
        <span style={{ fontSize: 10, fontWeight: 700 }}>Insights</span>
        <div style={{ display: "flex", gap: 2 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#9ca3af" }} />)}
        </div>
      </div>

      {/* Weekly / Monthly / Yearly tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px 4px" }}>
        {["Weekly", "Monthly", "Yearly"].map((tab) => (
          <div
            key={tab}
            style={{
              fontSize: 7.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
              background: tab === "Weekly" ? "#7DC200" : "transparent",
              color: tab === "Weekly" ? "#fff" : "#9ca3af",
              cursor: "pointer",
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Date range */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "2px 8px 4px" }}>
        <span style={{ fontSize: 8, color: "#9ca3af" }}>‹</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: "#374151" }}>Dec 16 – Dec 22, 2024</span>
        <span style={{ fontSize: 8, color: "#9ca3af" }}>›</span>
      </div>

      {/* Chart area */}
      <div style={{ padding: "0 8px", flex: 1 }}>
        {/* Chart header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 7.5, fontWeight: 700, color: "#374151" }}>Calorie (kcal)</span>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: "#7DC200", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, color: "#fff" }}>▦</span>
            </div>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8 }}>⚙</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7DC200" }} />
            <span style={{ fontSize: 6.5, color: "#6b7280" }}>Selected</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <div style={{ width: 10, borderTop: "1.5px dashed #9ca3af" }} />
            <span style={{ fontSize: 6.5, color: "#6b7280" }}>Calorie Intake Goal</span>
          </div>
        </div>

        {/* SVG bar chart */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
          {/* Y-axis labels */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: chartH, paddingRight: 2, flexShrink: 0 }}>
            {yLabels.map(l => (
              <span key={l} style={{ fontSize: 5.5, color: "#9ca3af", lineHeight: 1 }}>{l}</span>
            ))}
          </div>

          {/* Chart SVG */}
          <svg width={chartW} height={chartH} style={{ overflow: "visible", flexShrink: 0 }}>
            {/* Goal dotted line */}
            <line
              x1={0} y1={goalY} x2={chartW} y2={goalY}
              stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 2"
            />

            {/* Bars */}
            {bars.map((b, i) => {
              const x = i * (barW + gap);
              const bH = (b.kcal / maxKcal) * chartH;
              const y = chartH - bH;
              const fill = b.selected ? "#7DC200" : "#c5e68a";
              return (
                <g key={b.day}>
                  <rect x={x} y={y} width={barW} height={bH} rx={3} fill={fill} />
                  {b.selected && (
                    <g>
                      {/* Callout bubble */}
                      <rect x={x - 6} y={y - 18} width={28} height={13} rx={4} fill="#7DC200" />
                      <text x={x + 2} y={y - 9} fontSize="5.5" fontWeight="700" fill="#fff" textAnchor="middle">2100</text>
                      <text x={x + 2} y={y - 4} fontSize="4" fill="rgba(255,255,255,0.8)" textAnchor="middle">kcal</text>
                      {/* Callout arrow */}
                      <polygon points={`${x + 2},${y} ${x - 1},${y - 5} ${x + 5},${y - 5}`} fill="#7DC200" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* X-axis labels */}
            {bars.map((b, i) => (
              <text
                key={b.day} x={i * (barW + gap) + barW / 2} y={chartH + 8}
                fontSize="5.5" fill="#9ca3af" textAnchor="middle"
              >
                {b.day}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
};

const ProgressScreen = () => {
  const weights = [82, 81.5, 81, 80.2, 79.8, 79.2, 78.5];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const minW = 78, maxW = 83, range = maxW - minW;
  const W = 170, H = 52;
  const pts = weights.map((v, i) => `${(i / (weights.length - 1)) * W},${H - ((v - minW) / range) * H}`).join(" ");
  return (
    <div style={{ width: "100%", height: "100%", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px 5px", borderBottom: "1px solid #f3f4f6" }}>
        <img src="/nutrio/logo.png" alt="Nutrio" style={{ height: 20, width: "auto", objectFit: "contain" }} />
        <span style={{ fontSize: 10, fontWeight: 700 }}>Progress</span>
        <span style={{ fontSize: 14 }}>📅</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", padding: "6px 8px 4px" }}>
        {[{ l: "Current", v: "78.5 kg", c: "#8DC63F" }, { l: "Target", v: "75 kg", c: "#F97316" }, { l: "Lost", v: "3.5 kg", c: "#3B82F6" }].map((s) => (
          <div key={s.l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 7, color: "#9ca3af" }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 8px" }}>
        <p style={{ fontSize: 7.5, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>This Week</p>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8DC63F" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8DC63F" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#g1)" />
          <polyline points={pts} fill="none" stroke="#8DC63F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          {weights.map((v, i) => (
            <circle key={i} cx={(i / (weights.length - 1)) * W} cy={H - ((v - minW) / range) * H} r="2.5" fill="#8DC63F" />
          ))}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          {days.map((d) => <span key={d} style={{ fontSize: 7, color: "#9ca3af" }}>{d}</span>)}
        </div>
      </div>
      <div style={{ margin: "6px 8px 0", display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#8DC63F18,#8DC63F0a)", border: "1px solid #8DC63F30", borderRadius: 10, padding: "5px 8px" }}>
        <span style={{ fontSize: 18 }}>🔥</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#374151" }}>12-Day Streak!</div>
          <div style={{ fontSize: 7, color: "#6b7280" }}>Keep going, you're on fire!</div>
        </div>
      </div>
    </div>
  );
};

/* ─── Phone mockup frame ─────────────────────────────────────────── */
const PhoneMockup = ({ children, size }: { children: React.ReactNode; size: number }) => {
  const w = size;
  const h = size * 1.9;
  return (
    <div style={{
      width: w, height: h,
      background: "#111",
      borderRadius: w * 0.16,
      padding: w * 0.038,
      boxShadow: "0 24px 64px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.07)",
      position: "relative",
      flexShrink: 0,
    }}>
      {/* Dynamic Island */}
      <div style={{
        position: "absolute", top: w * 0.064, left: "50%",
        transform: "translateX(-50%)",
        width: w * 0.33, height: w * 0.095,
        background: "#111", borderRadius: w * 0.05, zIndex: 10,
      }} />
      {/* Screen */}
      <div style={{
        width: "100%", height: "100%",
        background: "white", borderRadius: w * 0.125,
        overflow: "hidden", paddingTop: w * 0.12,
      }}>
        {children}
      </div>
    </div>
  );
};

/* ─── Slides config ──────────────────────────────────────────────── */
const SLIDES = [
  {
    title: "Personalized Tracking\nMade Easy",
    description: "Log your meals, track activities, steps, weight, BMI, and monitor hydration with tailored insights just for you.",
    Screen: DashboardScreen,
  },
  {
    title: "Gain Clear Insights Into\nYour Progress",
    description: "See how your daily efforts stack up with detailed graphs and reports on calories, nutrition, and fitness.",
    Screen: InsightsScreen,
  },
  {
    title: "Watch Your\nProgress Soar",
    description: "Beautiful charts and streaks keep you motivated. Hit your daily targets and celebrate every milestone.",
    Screen: ProgressScreen,
  },
];

/* ─── Main component ─────────────────────────────────────────────── */
const WalkthroughScreen = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = (next: number) => {
    setDirection(next > current ? 1 : -1);
    setCurrent(next);
  };

  const handleSkip = () => navigate("/", { replace: true });
  const handleContinue = () => {
    if (current < SLIDES.length - 1) goTo(current + 1);
    else navigate("/auth", { replace: true });
  };

  const variants = {
    enter: (dir: number) => ({ x: dir * 50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir * -50, opacity: 0 }),
  };

  const slide = SLIDES[current];
  const { Screen } = slide;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-white"
      style={{ maxWidth: 430, margin: "0 auto" }}
    >
      {/* ── Green section: 58% of screen height ─────── */}
      <div
        className="relative flex items-end justify-center overflow-hidden"
        style={{
          height: "58%",
          background: "linear-gradient(150deg, #9DD63F 0%, #7DC200 100%)",
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.1)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 80, left: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" }} />

        {/* Phone — scales to 38% of viewport width, min 160 max 220 */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            style={{ position: "absolute", bottom: -28 }}
          >
            <PhoneMockup size={Math.min(Math.max(window.innerWidth * 0.4, 140), 180)}>
              <Screen />
            </PhoneMockup>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── White content card ───────────────────────── */}
      <div
        className="flex flex-col items-center flex-1 overflow-hidden"
        style={{
          background: "#fff",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -24,
          zIndex: 10,
          padding: `32px 24px max(28px, env(safe-area-inset-bottom))`,
        }}
      >
        {/* Slide text */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            style={{ width: "100%", textAlign: "center" }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.25, marginBottom: 10, whiteSpace: "pre-line" }}>
              {slide.title}
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
          {SLIDES.map((_, i) => {
            const isActive = i === current;
            const isPast = i < current;
            return (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                {/* Ring + inner fill */}
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: `2px solid ${isActive ? "#7DC200" : isPast ? "#7DC200" : "#d1d5db"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "border-color 0.3s ease",
                }}>
                  <motion.div
                    animate={{
                      width: isActive ? 7 : isPast ? 7 : 0,
                      height: isActive ? 7 : isPast ? 7 : 0,
                      opacity: isActive || isPast ? 1 : 0,
                    }}
                    transition={{ duration: 0.25 }}
                    style={{
                      borderRadius: "50%",
                      background: isActive ? "#7DC200" : "#a3d65a",
                    }}
                  />
                </div>
                {/* Connector line between dots */}
                {i < SLIDES.length - 1 && (
                  <div style={{ width: 24, height: 2, marginLeft: 8, borderRadius: 1, background: "#e5e7eb", overflow: "hidden" }}>
                    <motion.div
                      animate={{ width: isPast ? "100%" : "0%" }}
                      transition={{ duration: 0.3 }}
                      style={{ height: "100%", background: "#7DC200", borderRadius: 1 }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12, width: "100%", marginTop: "auto", paddingTop: 20 }}>
          <Button
            variant="gradient"
            onClick={handleContinue}
            style={{ flex: 1, height: 52, borderRadius: 999, fontSize: 15, fontWeight: 600 }}
          >
            {current < SLIDES.length - 1 ? "Continue" : "Get Started"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WalkthroughScreen;
