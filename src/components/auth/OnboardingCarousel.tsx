import { getNavArrows } from "@/lib/rtl";
import { useCallback, useState, type ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  HeartPulse,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { assetPath } from "@/lib/asset-path";

const C = {
  ink: "#020617",
  bg: "#F6F8FB",
  border: "#E5EAF1",
  muted: "#94A3B8",
  textMuted: "#64748B",
  progress: "#22C7A1",
  progressSoft: "#EFFFFA",
  protein: "#7C83F6",
  proteinSoft: "#F3F4FF",
  water: "#38BDF8",
  waterSoft: "#EFF9FF",
  fat: "#FB6B7A",
  fatSoft: "#FFF0F2",
  calorie: "#F97316",
  calorieSoft: "#FFF7ED",
};

interface CarouselSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  soft: string;
  preview: ReactNode;
}

interface OnboardingCarouselProps {
  onFinish: () => void;
}

const visualMotion = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

const onboardingImages = {
  dashboard: assetPath("/onboarding/hero-dashboard-generated.png"),
  meals: assetPath("/onboarding/hero-meals-generated.png"),
  schedule: assetPath("/onboarding/hero-schedule-generated.png"),
};

const CustomerScreenVisual = ({
  image,
  label,
  accent,
  soft,
}: {
  image: string;
  label: string;
  accent: string;
  soft: string;
}) => (
  <motion.div {...visualMotion} className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-3">
    <div className="absolute left-1/2 top-1/2 h-[min(58dvh,430px)] w-[min(76vw,300px)] -translate-x-1/2 -translate-y-1/2 rounded-[36px] bg-[#020617] opacity-[0.04]" />
    <div className="relative aspect-[941/1672] h-[min(56dvh,412px)] min-h-[304px] overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_18px_38px_rgba(2,6,23,0.12)] max-[380px]:min-h-[270px]">
      <img src={image} alt="" className="h-full w-full object-cover" />
    </div>
    <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#E5EAF1] bg-white px-3 py-2 shadow-[0_10px_24px_rgba(2,6,23,0.08)] max-[380px]:bottom-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: soft, color: accent }}>
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="whitespace-nowrap text-[12px] font-black text-[#020617]">{label}</span>
    </div>
  </motion.div>
);

export function OnboardingCarousel({ onFinish }: OnboardingCarouselProps) {
  const { t, isRTL } = useLanguage();
  const { PrevIcon, ArrowNext } = getNavArrows(isRTL);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exiting, setExiting] = useState(false);
  const reduceMotion = useReducedMotion();

  const slides: CarouselSlide[] = [
    {
      id: "meals",
      eyebrow: "Fresh daily plans",
      title: t("onboarding_carousel_title_1"),
      subtitle: t("onboarding_carousel_subtitle_1"),
      accent: C.progress,
      soft: C.progressSoft,
      preview: <CustomerScreenVisual image={onboardingImages.dashboard} label="Customer dashboard" accent={C.progress} soft={C.progressSoft} />,
    },
    {
      id: "track",
      eyebrow: "Smart nutrition",
      title: t("onboarding_carousel_title_2"),
      subtitle: t("onboarding_carousel_subtitle_2"),
      accent: C.protein,
      soft: C.proteinSoft,
      preview: <CustomerScreenVisual image={onboardingImages.meals} label="Browse meals" accent={C.protein} soft={C.proteinSoft} />,
    },
    {
      id: "community",
      eyebrow: "Built for Qatar",
      title: t("onboarding_carousel_title_3"),
      subtitle: t("onboarding_carousel_subtitle_3"),
      accent: C.water,
      soft: C.waterSoft,
      preview: <CustomerScreenVisual image={onboardingImages.schedule} label="Plan your week" accent={C.water} soft={C.waterSoft} />,
    },
  ];

  const finish = useCallback(() => {
    setExiting(true);
    window.setTimeout(onFinish, 280);
  }, [onFinish]);

  const goNext = useCallback(() => {
    if (activeIndex < slides.length - 1) {
      setActiveIndex((i) => i + 1);
      return;
    }

    finish();
  }, [activeIndex, finish, slides.length]);

  const current = slides[activeIndex];
  const isLast = activeIndex === slides.length - 1;

  return (
    <AnimatePresence mode="wait">
      {!exiting && (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="fixed inset-0 z-50 mx-auto flex h-[100dvh] max-w-[430px] flex-col overflow-hidden bg-[#F6F8FB] text-[#020617]"
        >
          <header className="relative z-10 flex h-[calc(74px+env(safe-area-inset-top))] shrink-0 items-center justify-between px-5 pt-[env(safe-area-inset-top)]">
            <Logo size="xl" className="!h-16 max-[380px]:!h-14" />
            <button
              type="button"
              onClick={finish}
              className="h-10 rounded-full border border-[#E5EAF1] bg-white px-4 text-[13px] font-black text-[#64748B] active:scale-95"
            >
              Skip
            </button>
          </header>

          <main className="relative z-10 flex min-h-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              <motion.section
                key={current.id}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex min-h-0 flex-1 px-6">{current.preview}</div>

                <div className="shrink-0 rounded-t-[34px] border-t border-[#E5EAF1] bg-white px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_30px_rgba(2,6,23,0.06)]">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="inline-flex h-9 items-center gap-2 rounded-full bg-[#020617] px-3 text-[11px] font-black uppercase tracking-[0.14em] text-white">
                      <Sparkles className="h-3.5 w-3.5" style={{ color: current.accent }} />
                      {current.eyebrow}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: current.soft, color: current.accent }}>
                      {activeIndex === 0 && <UtensilsCrossed className="h-4 w-4" />}
                      {activeIndex === 1 && <HeartPulse className="h-4 w-4" />}
                      {activeIndex === 2 && <ShieldCheck className="h-4 w-4" />}
                    </span>
                  </div>

                  <h1 className="text-[31px] font-black leading-[1.02] text-[#020617] max-[380px]:text-[28px]">
                    {current.title}
                  </h1>
                  <p className="mt-3 text-[14px] font-semibold leading-relaxed text-[#64748B]">
                    {current.subtitle}
                  </p>

                  <div className="mt-5 flex items-center gap-2">
                    {slides.map((slide, index) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className="h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: index === activeIndex ? 30 : 10,
                          backgroundColor: index === activeIndex ? current.accent : C.border,
                        }}
                        aria-label={t("onboarding_goto_page", { index: String(index + 1) })}
                      />
                    ))}
                  </div>

                  <div className="mt-5 flex gap-3">
                    {activeIndex > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveIndex((i) => i - 1)}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-[#E5EAF1] bg-white text-[#020617] active:scale-95"
                        aria-label={t("onboarding_previous_page")}
                      >
                        <PrevIcon className="h-6 w-6" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={goNext}
                      className="flex h-14 flex-1 items-center justify-center gap-3 rounded-[22px] bg-[#020617] text-[16px] font-black text-white active:scale-[0.98]"
                    >
                      {isLast ? t("onboarding_get_started") : t("onboarding_next")}
                      <ArrowNext className="h-5 w-5" strokeWidth={2.8} />
                    </button>
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
