import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Heart, Star, Users, UtensilsCrossed, Sparkles } from "lucide-react";

interface CarouselSlide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  gradient: string;
  preview: React.ReactNode;
}

const SLIDES: CarouselSlide[] = [
  {
    id: "meals",
    emoji: "🥗",
    title: "Healthy meals, delivered",
    subtitle: "Fresh, chef-prepared meals tailored to your goals — delivered across Qatar",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    preview: (
      <div className="relative w-[240px] h-[180px] mx-auto">
        <div className="absolute top-2 left-2 w-[72px] h-[72px] rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm shadow-lg">
          <UtensilsCrossed className="w-8 h-8 text-white" />
        </div>
        <div className="absolute top-3 right-4 rounded-full bg-yellow-400/90 px-3 py-1 text-[11px] font-bold text-yellow-900">
          <span>⭐ 4.9 · 2,400+ orders</span>
        </div>
        <div className="absolute bottom-6 left-4 flex gap-2">
          {["Keto Bowl", "Protein Pack", "Med Wraps"].map((label) => (
            <span key={label} className="rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white">
              {label}
            </span>
          ))}
        </div>
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[100px] h-[100px] rounded-full bg-white/10 blur-2xl" />
      </div>
    ),
  },
  {
    id: "track",
    emoji: "📊",
    title: "Track every macro, automatically",
    subtitle: "Calories, protein, carbs, fat — logged and visualized in real time",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    preview: (
      <div className="relative w-[260px] h-[180px] mx-auto space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 rounded-2xl bg-white/15 backdrop-blur-sm p-3 text-center">
            <Flame className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-[20px] font-extrabold text-white leading-none">1,842</p>
            <p className="text-[10px] font-medium text-white/70">Calories</p>
          </div>
          <div className="flex-1 rounded-2xl bg-white/15 backdrop-blur-sm p-3 text-center">
            <Sparkles className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-[20px] font-extrabold text-white leading-none">142g</p>
            <p className="text-[10px] font-medium text-white/70">Protein</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 rounded-2xl bg-white/15 backdrop-blur-sm p-3 text-center">
            <Heart className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-[20px] font-extrabold text-white leading-none">181g</p>
            <p className="text-[10px] font-medium text-white/70">Carbs</p>
          </div>
          <div className="flex-1 rounded-2xl bg-white/15 backdrop-blur-sm p-3 text-center opacity-70">
            <Sparkles className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-[20px] font-extrabold text-white leading-none">69g</p>
            <p className="text-[10px] font-medium text-white/70">Fat</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "community",
    emoji: "🇶🇦",
    title: "10,000+ Qatar residents already eating smarter",
    subtitle: "Join the fastest-growing healthy eating community in Doha",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    preview: (
      <div className="relative w-[260px] h-[180px] mx-auto space-y-3">
        <div className="flex items-center gap-2 rounded-2xl bg-white/15 backdrop-blur-sm p-3">
          <div className="flex -space-x-2">
            {["E", "M", "S", "F", "+"].map((init, i) => (
              <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white border-2 border-white/20 ${i === 4 ? "bg-orange-400" : "bg-white/30"}`}>
                {i === 4 ? "12+" : init}
              </div>
            ))}
          </div>
          <span className="text-[12px] font-semibold text-white">Your friends are here</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-2.5">
            <Star className="w-4 h-4 text-yellow-300 mx-auto mb-1" />
            <p className="text-[14px] font-extrabold text-white leading-none">4.8</p>
            <p className="text-[9px] text-white/70">Rating</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-2.5">
            <Users className="w-4 h-4 text-white mx-auto mb-1" />
            <p className="text-[14px] font-extrabold text-white leading-none">12k+</p>
            <p className="text-[9px] text-white/70">Users</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-2.5">
            <Flame className="w-4 h-4 text-orange-300 mx-auto mb-1" />
            <p className="text-[14px] font-extrabold text-white leading-none">94%</p>
            <p className="text-[9px] text-white/70">Active</p>
          </div>
        </div>
      </div>
    ),
  },
];

interface OnboardingCarouselProps {
  onFinish: () => void;
}

export function OnboardingCarousel({ onFinish }: OnboardingCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  const goNext = useCallback(() => {
    if (activeIndex < SLIDES.length - 1) {
      setActiveIndex((i) => i + 1);
    } else {
      setExiting(true);
      setTimeout(onFinish, 400);
    }
  }, [activeIndex, onFinish]);

  const current = SLIDES[activeIndex];
  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <AnimatePresence mode="wait">
      {!exiting && (
        <motion.div
          key="carousel"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ maxWidth: 430, margin: "0 auto" }}
        >
          <div className={`relative flex flex-col items-center flex-1 bg-gradient-to-br ${current.gradient}`}>
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[160px] h-[160px] rounded-full bg-white/5 blur-3xl" />

            {/* Skip button */}
            <div className="w-full flex justify-end pt-14 px-5">
              <button
                type="button"
                onClick={() => { setExiting(true); setTimeout(onFinish, 400); }}
                className="rounded-full bg-white/15 backdrop-blur-md px-4 py-1.5 text-[13px] font-semibold text-white"
              >
                Skip
              </button>
            </div>

            {/* Emoji */}
            <motion.div
              key={`emoji-${activeIndex}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="mt-8 text-[64px]"
            >
              {current.emoji}
            </motion.div>

            {/* Title & Subtitle */}
            <motion.div
              key={`text-${activeIndex}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="mt-4 text-center px-6"
            >
              <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-white leading-tight">
                {current.title}
              </h1>
              <p className="mt-2 text-[14px] font-medium text-white/80 leading-relaxed">
                {current.subtitle}
              </p>
            </motion.div>

            {/* Preview */}
            <motion.div
              key={`preview-${activeIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4, type: "spring", stiffness: 260, damping: 24 }}
              className="mt-6 flex-1 flex items-center justify-center px-4"
            >
              {current.preview}
            </motion.div>

            {/* Dots */}
            <div className="flex items-center gap-2 mb-4">
              {SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-[20px] h-[6px] bg-white" : "w-[6px] h-[6px] bg-white/40"
                  }`}
                />
              ))}
            </div>

            {/* CTA */}
            <div className="w-full px-5 pb-10 flex gap-3">
              {activeIndex > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  type="button"
                  onClick={() => setActiveIndex((i) => i - 1)}
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-md text-white"
                >
                  <ChevronLeft className="w-6 h-6" />
                </motion.button>
              )}
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={goNext}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-white text-[16px] font-extrabold tracking-[-0.01em] text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
              >
                {isLast ? "Get Started" : "Next"}
                <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}