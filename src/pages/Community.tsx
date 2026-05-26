import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bell, Users, ChevronRight, ArrowLeft } from "lucide-react";
import { CommunityChallengeCard } from "@/components/community/CommunityChallengeCard";
import { GamificationWidget } from "@/components/GamificationWidget";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { pageVariants } from "@/lib/animations";
import { useLanguage } from "@/contexts/LanguageContext";
import { PopularCombos } from "@/components/community/PopularCombos";

export default function Community() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-[#F8FAFB] pb-28"
      style={{ overscrollBehaviorY: "contain" }}
    >
      <div className="mx-auto min-h-screen max-w-[430px] bg-white px-8 pb-28 pt-10 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between pb-6">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate(-1)}
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_4px_12px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition hover:bg-slate-50"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <div className="space-y-1">
              <h1 className="text-[32px] leading-8 font-extrabold text-foreground">
                {t("community") || "Community"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("community_subtitle") || "Connect, challenge, and grow together"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
              onClick={() => navigate("/notifications")}
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-foreground" />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.26)]"
              onClick={() => navigate("/coaches")}
              aria-label="Coaches"
            >
              <Users className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5">
        <motion.div
          whileTap={{ scale: 0.99 }}
          onClick={() => navigate("/coaches")}
          className="w-full rounded-[20px] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              <img alt="coach-1" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop" className="h-11 w-11 rounded-full border-2 border-white object-cover" />
              <img alt="coach-2" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop" className="h-11 w-11 rounded-full border-2 border-white object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-extrabold leading-tight text-foreground">Need guidance?</p>
              <p className="mt-1 text-[13px] leading-4 text-muted-foreground">Match with a certified nutrition coach.</p>
            </div>
            <div>
              <span className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 text-sm font-extrabold text-white shadow-[0_10px_18px_rgba(16,185,129,0.24)]">
                Find Coach
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </motion.div>

        <DashboardErrorBoundary name="community challenges">
          <CommunityChallengeCard />
        </DashboardErrorBoundary>

        <DashboardErrorBoundary name="popular combos">
          <PopularCombos />
        </DashboardErrorBoundary>

        <DashboardErrorBoundary name="community gamification">
          <GamificationWidget />
        </DashboardErrorBoundary>
        </div>
      </div>
    </motion.div>
  );
}
