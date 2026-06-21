import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronRight } from "lucide-react";
import { getNavArrows } from "@/lib/rtl";
import { CommunityChallengeCard } from "@/components/community/CommunityChallengeCard";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { pageVariants } from "@/lib/animations";
import { useLanguage } from "@/contexts/LanguageContext";
import { PopularCombos } from "@/components/community/PopularCombos";
import { ReferralMilestonesWidget } from "@/components/dashboard/ReferralMilestonesWidget";

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
    </div>
  );
}

export default function Community() {
  const { t, isRTL } = useLanguage();
  const { ArrowPrev } = getNavArrows(isRTL);
  const navigate = useNavigate();

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-white pb-24"
      style={{ overscrollBehaviorY: "contain" }}
    >
      <div className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[78px] max-w-[430px] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-slate-100"
            aria-label="Go back"
          >
            <ArrowPrev className="h-5 w-5" strokeWidth={1.9} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Nutrio
            </p>
            <h1 className="text-[24px] font-black leading-tight text-slate-950">
              {t("community")}
            </h1>
          </div>

          <button
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-slate-100"
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" strokeWidth={1.9} />
            <div className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[430px] px-4 py-4">
        <motion.div
          whileTap={{ scale: 0.988 }}
          onClick={() => navigate("/coaches")}
          className="mb-5 cursor-pointer overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100"
        >
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              <img
                alt="coach-1"
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop"
                className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm"
              />
              <img
                alt="coach-2"
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop"
                className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-black text-slate-950">
                {t("community_need_guidance")}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-slate-500">
                {t("community_match_coach")}
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white shadow-[0_10px_22px_rgba(2,6,23,0.14)]">
              <ChevronRight className="h-5 w-5" />
            </span>
          </div>
        </motion.div>

        <SectionLabel label={t("community_active_events")} />
        <div className="mb-5 overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <DashboardErrorBoundary name="community challenges">
            <CommunityChallengeCard />
          </DashboardErrorBoundary>
        </div>

        <SectionLabel label={t("community_discover")} />
        <div className="mb-5 overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <DashboardErrorBoundary name="popular combos">
            <PopularCombos />
          </DashboardErrorBoundary>
        </div>

        <SectionLabel label={t("community_growth")} />
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <DashboardErrorBoundary name="referral milestones">
            <ReferralMilestonesWidget />
          </DashboardErrorBoundary>
        </div>
      </div>
    </motion.div>
  );
}
