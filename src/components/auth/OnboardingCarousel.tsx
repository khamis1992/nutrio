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

import { AnimatedNutrioLogo } from "@/components/motion/AnimatedNutrioLogo";
import { assetPath } from "@/lib/asset-path";

const C = {
  ink: "#020617",
  border: "#E5EAF1",
  orange: "#FF611D",
  orangeSoft: "#FFF1EA",
  green: "#2DAE78",
  greenSoft: "#EAF8F1",
  navySoft: "#EEF2F7",
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
  dashboard: assetPath("/onboarding/hero-dashboard.png"),
  meals: assetPath("/onboarding/hero-meals.png"),
  schedule: assetPath("/onboarding/hero-schedule.png"),
};

const AppScreenVisual = ({
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
  <motion.div {...visualMotion} className="relative flex min-h-0 flex-1 items-end justify-center px-1 pb-0 pt-1">
    <div className="relative mb-[-18px] flex h-full w-full max-w-[320px] flex-col justify-end">
      <div className="relative h-full min-h-0 overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_14px_32px_rgba(2,6,23,0.10)]">
        <img src={image} alt="" className="h-full w-full object-cover object-top" />
      </div>
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#E5EAF1] bg-white px-3 py-2 shadow-[0_10px_24px_rgba(2,6,23,0.08)]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: soft, color: accent }}>
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="whitespace-nowrap text-[12px] font-black text-[#020617]">{label}</span>
      </div>
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
      eyebrow: t("onboarding_carousel_eyebrow_1"),
      title: t("onboarding_carousel_title_1"),
      subtitle: t("onboarding_carousel_subtitle_1"),
      accent: C.green,
      soft: C.greenSoft,
      preview: (
        <AppScreenVisual
          image={onboardingImages.dashboard}
          label={t("onboarding_carousel_label_1")}
          accent={C.green}
          soft={C.greenSoft}
        />
      ),
    },
    {
      id: "track",
      eyebrow: t("onboarding_carousel_eyebrow_2"),
      title: t("onboarding_carousel_title_2"),
      subtitle: t("onboarding_carousel_subtitle_2"),
      accent: C.orange,
      soft: C.orangeSoft,
      preview: (
        <AppScreenVisual
          image={onboardingImages.meals}
          label={t("onboarding_carousel_label_2")}
          accent={C.orange}
          soft={C.orangeSoft}
        />
      ),
    },
    {
      id: "community",
      eyebrow: t("onboarding_carousel_eyebrow_3"),
      title: t("onboarding_carousel_title_3"),
      subtitle: t("onboarding_carousel_subtitle_3"),
      accent: C.ink,
      soft: C.navySoft,
      preview: (
        <AppScreenVisual
          image={onboardingImages.schedule}
          label={t("onboarding_carousel_label_3")}
          accent={C.green}
          soft={C.greenSoft}
        />
      ),
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
  const activeAccent = current.id === "community" ? C.green : current.accent;

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
            <AnimatedNutrioLogo className="h-16 w-16 max-[380px]:h-14 max-[380px]:w-14" />
            <button
              type="button"
              onClick={finish}
              className="h-10 rounded-full border border-[#E5EAF1] bg-white px-4 text-[13px] font-black text-[#64748B] active:scale-95"
            >
              {t("onboarding_skip")}
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
                <div className="flex min-h-0 flex-1 px-5">{current.preview}</div>

                <div className="relative z-20 shrink-0 rounded-t-[34px] border-t border-[#E5EAF1] bg-white px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_30px_rgba(2,6,23,0.06)]">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="inline-flex h-9 items-center gap-2 rounded-full bg-[#020617] px-3 text-[11px] font-black uppercase tracking-[0.14em] text-white">
                      <Sparkles className="h-3.5 w-3.5" style={{ color: activeAccent }} />
                      {current.eyebrow}
                    </span>
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: current.soft, color: activeAccent }}
                    >
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
                          backgroundColor: index === activeIndex ? activeAccent : C.border,
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
