import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, ChevronRight } from "lucide-react";
import { CommunityChallengeCard } from "@/components/community/CommunityChallengeCard";
import { RecipeShareCard } from "@/components/community/RecipeShareCard";
import { GamificationWidget } from "@/components/GamificationWidget";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { pageVariants, staggerContainer } from "@/lib/animations";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Community() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-background pb-28"
      style={{ overscrollBehaviorY: "contain" }}
    >
      <div className="px-5 pt-12 pb-4 bg-background">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("community") || "Community"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("community_subtitle") || "Challenges, combos, and achievements"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[480px] md:max-w-lg mx-auto px-5 space-y-4">
        {/* Find a Coach */}
        <motion.button
          onClick={() => navigate("/coaches")}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-500/20">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-extrabold text-violet-900">Find a Coach</h3>
            <p className="text-xs text-violet-600/70 mt-0.5">
              Connect with certified nutrition coaches for personalized guidance
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-violet-400" />
        </motion.button>

        <DashboardErrorBoundary name="community challenges">
          <CommunityChallengeCard />
        </DashboardErrorBoundary>

        <DashboardErrorBoundary name="community recipes">
          <RecipeShareCard />
        </DashboardErrorBoundary>

        <DashboardErrorBoundary name="community gamification">
          <GamificationWidget />
        </DashboardErrorBoundary>
      </div>
    </motion.div>
  );
}
