import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AnimatedNutrioLogo } from "@/components/motion/AnimatedNutrioLogo";
import { animate, motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Flame, HeartPulse, Lock, UtensilsCrossed, UserPlus } from "lucide-react";

/** Counts up from 0 to `target` over `duration` seconds. Honors reduced-motion. */
const AnimatedNumber = ({ target, duration = 1.4, delay = 0, className }: { target: number; duration?: number; delay?: number; className?: string }) => {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(0, target, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, duration, delay, reduceMotion]);

  return <span className={className}>{value.toLocaleString()}</span>;
};

interface WelcomeScreenProps { onSwitchView: (view: "signup" | "signin") => void; }

const cardItem = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.4 + i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/**
 * Nutrition Ring Dial — premium fitness aesthetic.
 * Three animated SVG arcs (protein violet, carbs orange, fat rose) draw in
 * sequence. Center shows total kcal with a flame. Three frosted macro cards
 * stagger in around the dial.
 */
const NutritionRingDial = () => {
  const reduceMotion = useReducedMotion();
  const R = 50;
  const macros = [
    { label: "Protein", value: "142g", pct: 0.72, color: "#7C83F6", track: "#F3F4FF", iconBg: "bg-[#F3F4FF] text-[#7C83F6]", delay: 0 },
    { label: "Carbs", value: "181g", pct: 0.58, color: "#F97316", track: "#FFF7ED", iconBg: "bg-orange-100 text-orange-500", delay: 0.15 },
    { label: "Fat", value: "64g", pct: 0.45, color: "#FB6B7A", track: "#FFF0F2", iconBg: "bg-[#FFF0F2] text-[#FB6B7A]", delay: 0.3 },
  ];

  return (
    <div className="relative h-[308px] w-[276px]">
      {/* Central ring dial card */}
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        className="absolute inset-x-4 top-2 rounded-[36px] border border-white/80 bg-white/90 p-4 shadow-[0_28px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">today</p>
            <p className="text-[20px] font-extrabold tracking-[-0.03em] text-[#020617]">
              <AnimatedNumber target={1892} className="tabular-nums" /> kcal
            </p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-orange-100 text-orange-500">
            <Flame className="h-5 w-5 fill-current" />
          </span>
        </div>

        {/* Triple-arc progress ring */}
        <div className="relative mx-auto mt-4 h-[154px] w-[154px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            {/* Track circles */}
            {macros.map((m, i) => (
              <circle
                key={`track-${m.label}`}
                cx="60"
                cy="60"
                r={R - i * 6}
                fill="none"
                stroke={m.track}
                strokeWidth="6"
              />
            ))}
            {/* Animated arcs */}
            {macros.map((m, i) => {
              const r = R - i * 6;
              const circ = 2 * Math.PI * r;
              return (
                <motion.circle
                  key={`arc-${m.label}`}
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: circ * (1 - m.pct) }}
                  transition={{ duration: 1.1, ease: "easeOut", delay: 0.5 + m.delay }}
                />
              );
            })}
          </svg>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.p
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.0, ease: [0.34, 1.56, 0.64, 1] }}
              className="text-[30px] font-black tracking-[-0.05em] text-[#020617] tabular-nums"
            >
              <AnimatedNumber target={72} duration={1.2} delay={1.0} />%
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.15 }}
              className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]"
            >
              goal hit
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Floating macro cards — stagger in from bottom */}
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-7 left-0 right-0 grid grid-cols-3 gap-2"
      >
        {macros.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.65 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[24px] border border-white/80 bg-white/90 p-3 text-center shadow-[0_18px_42px_rgba(15,23,42,0.1)] backdrop-blur-xl"
          >
            <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-2xl ${m.iconBg}`}>
              <HeartPulse className="h-4 w-4" />
            </div>
            <p className="text-[14px] font-extrabold leading-none text-[#020617]">{m.value}</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">{m.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Small floating spark card top-right */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: -10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        className="absolute right-0 -top-8 overflow-hidden rounded-[24px] border border-white/80 bg-white/85 px-3 py-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl"
      >
        <motion.div
          aria-hidden
          initial={reduceMotion ? false : { x: "-120%" }}
          animate={reduceMotion ? undefined : { x: "120%" }}
          transition={reduceMotion ? undefined : { duration: 1.2, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut", delay: 1.4 }}
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/55 to-transparent"
        />
        <div className="relative flex items-center gap-2.5">
          <div>
            <p className="text-[15px] font-extrabold leading-none text-[#020617]">7</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">day streak</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const WelcomeScreen = ({ onSwitchView }: WelcomeScreenProps) => {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col overflow-hidden bg-[#F6F8FB] text-[#020617]">
      {/* Background blobs — scale in from small */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute"
        >
          <motion.div
            animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], x: [0, 12, 0], y: [0, -10, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-24 -top-24 h-[300px] w-[300px] rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(34,199,161,0.16)" }}
          />
        </motion.div>
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="absolute"
        >
          <motion.div
            animate={reduceMotion ? undefined : { scale: [1, 1.1, 1], x: [0, -14, 0], y: [0, 10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            className="absolute -bottom-28 -left-20 h-[280px] w-[280px] rounded-full bg-[#F3F4FF] blur-3xl"
          />
        </motion.div>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(#020617 0.8px, transparent 0.8px)", backgroundSize: "18px 18px" }} />
      </div>

      {/* Header — drops in from top, logo on LEFT (same as onboarding) */}
      <motion.header
        initial={reduceMotion ? { opacity: 0 } : { y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex items-center justify-start px-6 pt-[max(1.25rem,env(safe-area-inset-top))]"
      >
        <div className="flex items-center justify-center">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex h-28 w-28 items-center justify-center max-[380px]:h-24 max-[380px]:w-24"
          >
            <AnimatedNutrioLogo className="h-28 w-28 max-[380px]:h-24 max-[380px]:w-24" />
          </motion.div>
        </div>
      </motion.header>

      <main className="relative z-10 flex flex-1 flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Preview illustration — identical to onboarding slide 1 */}
        <div className="flex flex-1 items-center justify-center py-1">
          <NutritionRingDial />
        </div>

        {/* Bottom info card — slides up, then children stagger in */}
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[34px] border border-[#E5EAF1] bg-white p-5 shadow-[0_16px_34px_rgba(2,6,23,0.06)]"
        >
          {/* Eyebrow pill row — dark pill + icon circle (same as onboarding) */}
          <motion.div
            custom={0}
            variants={cardItem}
            initial="hidden"
            animate="visible"
            className="mb-4 flex items-center justify-between"
          >
            <span className="inline-flex h-9 items-center rounded-full bg-[#020617] px-4 text-[11px] font-black uppercase tracking-[0.14em] text-white">
              {t("eat_smart")}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFFFFA] text-[#22C7A1]">
              <UtensilsCrossed className="h-4 w-4" />
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            custom={1}
            variants={cardItem}
            initial="hidden"
            animate="visible"
            className="text-[34px] font-black leading-[0.98] tracking-[-0.065em] text-[#020617]"
          >
            {t("live_better")}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            custom={2}
            variants={cardItem}
            initial="hidden"
            animate="visible"
            className="mt-4 text-[15px] font-semibold leading-relaxed text-[#64748B]"
          >
            {t("personalized_nutrition_tagline")}
          </motion.p>

          {/* Primary CTA — full-width gradient pill (same shape as onboarding Next button) */}
          <motion.div
            custom={3}
            variants={cardItem}
            initial="hidden"
            animate="visible"
            className="mt-6"
          >
            <Button
              type="button"
              variant="gradient"
              size="xl"
              data-testid="welcome-sign-up-btn"
              className="flex h-16 w-full items-center justify-center gap-3 rounded-[24px] bg-[#020617] text-[17px] font-black tracking-[-0.02em] text-white shadow-none hover:bg-[#111827]"
              onClick={() => onSwitchView("signup")}
            >
              <UserPlus className="h-5 w-5" strokeWidth={2.8} />
              {t("create_free_account")}
            </Button>
          </motion.div>

          {/* Secondary CTA — outline pill (same shape, different style) */}
          <motion.div
            custom={4}
            variants={cardItem}
            initial="hidden"
            animate="visible"
            className="mt-3"
          >
            <button
              type="button"
              data-testid="welcome-sign-in-btn"
              onClick={() => onSwitchView("signin")}
              className="flex h-16 w-full items-center justify-center gap-3 rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] text-[16px] font-extrabold text-[#020617] transition-all active:scale-[0.98]"
            >
              <Lock className="h-5 w-5 text-[#7C83F6]" strokeWidth={2.8} />
              {t("sign_in")}
            </button>
          </motion.div>

          {/* Terms */}
          <motion.p
            custom={5}
            variants={cardItem}
            initial="hidden"
            animate="visible"
            className="mt-5 text-center text-[12px] text-[#94A3B8]"
          >
            By continuing, you agree to our{" "}
            <Link to="/privacy" className="font-semibold text-[#020617] hover:underline">{t("privacy_policy")}</Link>
            <span className="mx-1.5 text-[#CBD5E1]">|</span>
            <Link to="/terms" className="font-semibold text-[#020617] hover:underline">{t("terms")}</Link>
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
};
