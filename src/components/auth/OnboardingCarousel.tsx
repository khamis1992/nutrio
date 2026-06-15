import { getNavArrows } from "@/lib/rtl";
import { useState, useCallback, type ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  Clock3,
  Flame,
  HeartPulse,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { Logo } from "@/components/Logo";

interface CarouselSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  glow: string;
  preview: ReactNode;
}

const MealPreview = () => (
  <div className="relative h-[308px] w-[276px]">
    <motion.div
      animate={{ y: [0, -8, 0], rotate: [-2, 1.5, -2] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      className="absolute left-3 top-4 h-[226px] w-[226px] rounded-full bg-[conic-gradient(from_120deg,#D9F99D,#6EE7B7,#FDE68A,#D9F99D)] shadow-[0_30px_70px_rgba(15,118,110,0.22)]"
    >
      <div className="absolute inset-5 rounded-full bg-white shadow-inner" />
      <div className="absolute left-12 top-11 h-20 w-24 rounded-[34px] bg-emerald-300" />
      <div className="absolute right-10 top-12 h-16 w-16 rounded-full bg-orange-300" />
      <div className="absolute bottom-12 left-14 h-16 w-16 rounded-full bg-lime-200" />
      <div className="absolute bottom-11 right-12 h-20 w-12 rounded-full bg-teal-300" />
      <div className="absolute left-[84px] top-[82px] h-16 w-16 rounded-full bg-white shadow-[inset_0_0_0_10px_rgba(251,146,60,0.18)]" />
    </motion.div>

    <div className="absolute right-0 top-0 rounded-[24px] border border-white/80 bg-white/85 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <Star className="h-4 w-4 fill-current" />
        </span>
        <div>
          <p className="text-[18px] font-extrabold leading-none text-slate-950">4.9</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">rated meals</p>
        </div>
      </div>
    </div>

    <div className="absolute bottom-8 left-0 w-[244px] rounded-[30px] border border-white/80 bg-white/90 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-emerald-100 text-emerald-600">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-slate-950">Keto Green Bowl</p>
          <p className="text-[12px] font-semibold text-slate-400">Delivered by 12:30 PM</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["38g", "protein"],
          ["420", "kcal"],
          ["18g", "carbs"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-2xl bg-slate-50 px-2 py-2 text-center">
            <p className="text-[13px] font-extrabold text-slate-950">{value}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TrackerPreview = () => (
  <div className="relative h-[308px] w-[276px]">
    <div className="absolute inset-x-4 top-2 rounded-[36px] border border-white/80 bg-white/90 p-4 shadow-[0_28px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">today</p>
          <p className="text-[20px] font-extrabold tracking-[-0.03em] text-slate-950">1,892 kcal</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-orange-100 text-orange-500">
          <Flame className="h-5 w-5 fill-current" />
        </span>
      </div>
      <div className="relative mx-auto mt-4 h-[154px] w-[154px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#ECFDF5" strokeWidth="13" />
          <motion.circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="url(#trackerRing)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray="314"
            initial={{ strokeDashoffset: 314 }}
            animate={{ strokeDashoffset: 82 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="trackerRing" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#F97316" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[30px] font-black tracking-[-0.05em] text-slate-950">72%</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">goal hit</p>
        </div>
      </div>
    </div>

    <div className="absolute bottom-7 left-0 right-0 grid grid-cols-3 gap-2">
      {[
        ["Carbs", "181g", "bg-emerald-100 text-emerald-600"],
        ["Protein", "142g", "bg-orange-100 text-orange-500"],
        ["Fat", "64g", "bg-sky-100 text-sky-500"],
      ].map(([label, value, color]) => (
        <div key={label} className="rounded-[24px] border border-white/80 bg-white/90 p-3 text-center shadow-[0_18px_42px_rgba(15,23,42,0.1)] backdrop-blur-xl">
          <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-2xl ${color}`}>
            <HeartPulse className="h-4 w-4" />
          </div>
          <p className="text-[14px] font-extrabold leading-none text-slate-950">{value}</p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
        </div>
      ))}
    </div>
  </div>
);

const QatarPreview = () => (
  <div className="relative h-[308px] w-[276px]">
    <div className="absolute inset-x-1 top-5 h-[230px] rounded-[38px] border border-white/80 bg-white/90 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <div className="relative h-full overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#ECFDF5_0%,#F8FAFC_55%,#FFFBEB_100%)]">
        <div className="absolute left-5 top-8 h-28 w-44 rounded-full border-[14px] border-emerald-200/70" />
        <div className="absolute right-3 top-12 h-24 w-24 rounded-full border-[12px] border-orange-200/70" />
        <div className="absolute bottom-4 left-10 h-20 w-36 rounded-full border-[12px] border-teal-200/70" />
        <motion.div
          animate={{ x: [0, 18, 4, 26], y: [0, -16, 10, -2] }}
          transition={{ duration: 5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          className="absolute left-[88px] top-[82px] flex h-14 w-14 items-center justify-center rounded-[22px] bg-emerald-500 text-white shadow-[0_18px_35px_rgba(16,185,129,0.38)]"
        >
          <MapPin className="h-7 w-7 fill-current" />
        </motion.div>
      </div>
    </div>

    <div className="absolute right-0 top-2 rounded-[24px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_18px_44px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Clock3 className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[18px] font-extrabold leading-none text-slate-950">24m</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">delivery</p>
        </div>
      </div>
    </div>

    <div className="absolute bottom-8 left-2 right-2 rounded-[30px] border border-white/80 bg-white/90 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {[
            "bg-emerald-500",
            "bg-orange-400",
            "bg-sky-400",
            "bg-slate-900",
          ].map((color, index) => (
            <span key={color} className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white ${color} text-[11px] font-black text-white`}>
              {index === 3 ? "+" : index + 1}
            </span>
          ))}
        </div>
        <div>
          <p className="text-[15px] font-extrabold text-slate-950">Doha wellness club</p>
          <p className="text-[12px] font-semibold text-slate-400">10k+ members eating smarter</p>
        </div>
      </div>
    </div>
  </div>
);

interface OnboardingCarouselProps {
  onFinish: () => void;
}

export function OnboardingCarousel({ onFinish }: OnboardingCarouselProps) {
  const { t, isRTL } = useLanguage();
  const { PrevIcon, ArrowNext } = getNavArrows(isRTL);
  const SLIDES: CarouselSlide[] = [
    {
      id: "meals",
      eyebrow: "Fresh daily plans",
      title: t("onboarding_carousel_title_1"),
      subtitle: t("onboarding_carousel_subtitle_1"),
      accent: "#10B981",
      glow: "rgba(16,185,129,0.24)",
      preview: <MealPreview />,
    },
    {
      id: "track",
      eyebrow: "Smart nutrition",
      title: t("onboarding_carousel_title_2"),
      subtitle: t("onboarding_carousel_subtitle_2"),
      accent: "#F97316",
      glow: "rgba(249,115,22,0.22)",
      preview: <TrackerPreview />,
    },
    {
      id: "community",
      eyebrow: "Built for Qatar",
      title: t("onboarding_carousel_title_3"),
      subtitle: t("onboarding_carousel_subtitle_3"),
      accent: "#0EA5E9",
      glow: "rgba(14,165,233,0.2)",
      preview: <QatarPreview />,
    },
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const [exiting, setExiting] = useState(false);
  const reduceMotion = useReducedMotion();

  const finish = useCallback(() => {
    setExiting(true);
    window.setTimeout(onFinish, 360);
  }, [onFinish]);

  const goNext = useCallback(() => {
    if (activeIndex < SLIDES.length - 1) {
      setActiveIndex((i) => i + 1);
      return;
    }

    finish();
  }, [activeIndex, finish]);

  const current = SLIDES[activeIndex];
  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <AnimatePresence mode="wait">
      {!exiting && (
        <motion.div
          key="carousel"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -18 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col overflow-hidden bg-[#F7F8F3] text-slate-950"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <motion.div
              animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], x: [0, 12, 0], y: [0, -10, 0] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-24 -top-24 h-[300px] w-[300px] rounded-full blur-3xl"
              style={{ backgroundColor: current.glow }}
            />
            <motion.div
              animate={reduceMotion ? undefined : { scale: [1, 1.1, 1], x: [0, -14, 0], y: [0, 10, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="absolute -bottom-28 -left-20 h-[280px] w-[280px] rounded-full bg-emerald-200/30 blur-3xl"
            />
            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(#0f172a 0.8px, transparent 0.8px)", backgroundSize: "18px 18px" }} />
          </div>

          <header className="relative z-10 flex items-center justify-between px-6 pt-[max(3rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <Logo size="sm" />
              </div>
              <div>
                <p className="text-[16px] font-black tracking-[-0.04em] text-slate-950">NUTRIO</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Fuel better</p>
              </div>
            </div>
            <button
              type="button"
              onClick={finish}
              className="h-10 rounded-full border border-white/80 bg-white/80 px-4 text-[13px] font-extrabold text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl active:scale-95"
            >
              Skip
            </button>
          </header>

          <main className="relative z-10 flex flex-1 flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <AnimatePresence mode="wait">
              <motion.section
                key={current.id}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex flex-1 items-center justify-center py-4">
                  {current.preview}
                </div>

                <div className="rounded-[38px] border border-white/80 bg-white/90 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-950 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-white">
                      <Sparkles className="h-3.5 w-3.5" style={{ color: current.accent }} />
                      {current.eyebrow}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      {activeIndex === 0 && <Leaf className="h-4 w-4" />}
                      {activeIndex === 1 && <HeartPulse className="h-4 w-4" />}
                      {activeIndex === 2 && <ShieldCheck className="h-4 w-4" />}
                    </span>
                  </div>

                  <h1 className="text-[34px] font-black leading-[0.98] tracking-[-0.065em] text-slate-950">
                    {current.title}
                  </h1>
                  <p className="mt-4 text-[15px] font-semibold leading-relaxed text-slate-500">
                    {current.subtitle}
                  </p>

                  <div className="mt-6 flex items-center gap-2">
                    {SLIDES.map((slide, index) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className="h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: index === activeIndex ? 30 : 10,
                          backgroundColor: index === activeIndex ? current.accent : "#D1D5DB",
                        }}
                        aria-label={t("onboarding_goto_page", { index: String(index + 1) })}
                      />
                    ))}
                  </div>

                  <div className="mt-6 flex gap-3">
                    {activeIndex > 0 && (
                      <motion.button
                        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        type="button"
                        onClick={() => setActiveIndex((i) => i - 1)}
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-slate-200 bg-white text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.08)] active:scale-95"
                        aria-label={t("onboarding_previous_page")}
                      >
                        <PrevIcon className="h-6 w-6" />
                      </motion.button>
                    )}

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={goNext}
                      className="flex h-16 flex-1 items-center justify-center gap-3 rounded-[24px] text-[17px] font-black tracking-[-0.02em] text-white shadow-[0_18px_38px_rgba(15,23,42,0.18)]"
                      style={{
                        background:
                          activeIndex === 1
                            ? "linear-gradient(135deg, #F97316 0%, #EA580C 100%)"
                            : `linear-gradient(135deg, ${current.accent} 0%, #059669 100%)`,
                      }}
                    >
                      {isLast ? t("onboarding_get_started") : t("onboarding_next")}
                      <ArrowNext className="h-5 w-5" strokeWidth={2.8} />
                    </motion.button>
                  </div>
                </div>
              </motion.section>
            </AnimatePresence>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
