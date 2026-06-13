import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bell, Users, ChevronRight, ArrowLeft } from "lucide-react";
import { CommunityChallengeCard } from "@/components/community/CommunityChallengeCard";
import { GamificationWidget } from "@/components/GamificationWidget";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { pageVariants } from "@/lib/animations";
import { useLanguage } from "@/contexts/LanguageContext";
import { PopularCombos } from "@/components/community/PopularCombos";
import { ReferralMilestonesWidget } from "@/components/dashboard/ReferralMilestonesWidget";

/* ═══════════════════════════════════════════════
   DESIGN SYSTEM — Inspired by Airbnb + Linear + Stripe
   Single accent (emerald), surface ladder, pill geometry
   Canvas: white | Surfaces: off-white → tinted → dark
   ═══════════════════════════════════════════════ */

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

export default function Community() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <motion.div
      variants={pageVariants} initial="hidden" animate="visible"
      className="min-h-screen bg-[#F8FAFC] pb-20"
      style={{ overscrollBehaviorY: "contain" }}
    >
      <div className="mx-auto min-h-screen max-w-[430px] bg-white px-5 pt-10 pb-20 shadow-[0_0_0_1px_rgba(15,23,42,0.04),0_18px_50px_rgba(15,23,42,0.06)]">

        {/* ═══════ HEADER ═══════ */}
        <div className="flex items-start justify-between pb-6">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate(-1)} className="mt-0.5 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition hover:bg-slate-50 hover:text-slate-600" aria-label="Go back">
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            <div className="space-y-0.5 min-w-0">
              <h1 className="text-[26px] leading-[1.05] font-extrabold text-slate-900 tracking-[-0.03em]">{t("community") || "Community"}</h1>
              <p className="text-[13px] font-medium text-slate-500">{t("community_subtitle") || "Connect, challenge, and grow together"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100" onClick={() => navigate("/notifications")} aria-label="Notifications">
              <Bell className="h-[18px] w-[18px] text-slate-500" strokeWidth={1.8} />
              <div className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_4px_10px_rgba(16,185,129,0.25)] active:scale-95 transition-transform" onClick={() => navigate("/coaches")} aria-label="Coaches">
              <Users className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* ═══════ FIND COACH — Surface 1 ═══════ */}
        <motion.div whileTap={{ scale: 0.988 }} onClick={() => navigate("/coaches")}
          className="group mb-6 w-full cursor-pointer rounded-2xl bg-[#F8FAFC] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              <img alt="coach-1" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop" className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm" />
              <img alt="coach-2" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop" className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-extrabold text-slate-900">Need guidance?</p>
              <p className="mt-0.5 text-[13px] text-slate-500">Match with a certified nutrition coach.</p>
            </div>
            <span className="inline-flex h-[42px] items-center gap-2 rounded-full bg-emerald-500 px-5 text-[13px] font-extrabold text-white shadow-[0_4px_10px_rgba(16,185,129,0.2)] transition group-hover:shadow-[0_6px_14px_rgba(16,185,129,0.28)]">
              Find Coach <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </motion.div>

        {/* ═══════ YOUR JOURNEY ═══════ */}
        <SectionLabel label="Your Journey" />
        <div className="mb-6">
          <DashboardErrorBoundary name="community gamification"><GamificationWidget /></DashboardErrorBoundary>
        </div>

        {/* ═══════ ACTIVE EVENTS ═══════ */}
        <SectionLabel label="Active Events" />
        <div className="mb-6">
          <DashboardErrorBoundary name="community challenges"><CommunityChallengeCard /></DashboardErrorBoundary>
        </div>

        {/* ═══════ DISCOVER ═══════ */}
        <SectionLabel label="Discover" />
        <div className="mb-6">
          <DashboardErrorBoundary name="popular combos"><PopularCombos /></DashboardErrorBoundary>
        </div>

        {/* ═══════ GROWTH ═══════ */}
        <SectionLabel label="Growth" />
        <DashboardErrorBoundary name="referral milestones"><ReferralMilestonesWidget /></DashboardErrorBoundary>

      </div>
    </motion.div>
  );
}
