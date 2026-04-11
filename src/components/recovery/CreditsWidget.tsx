import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryCredits } from "@/hooks/useRecovery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

export function CreditsWidget() {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { credits, loading } = useRecoveryCredits();

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-violet-500 to-purple-600 border-0">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-24 mb-2 bg-white/20" />
          <Skeleton className="h-8 w-16 bg-white/20" />
        </CardContent>
      </Card>
    );
  }

  const remaining = (credits?.total_credits ?? 0) - (credits?.used_credits ?? 0);
  const total = credits?.total_credits ?? 0;
  const used = credits?.used_credits ?? 0;

  return (
    <Card className="bg-gradient-to-br from-violet-500 to-purple-600 border-0 text-white overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-medium text-white/80">
              {isRTL ? t("recovery_credits_this_month_ar") : t("recovery_credits_this_month")}
            </span>
          </div>
          <span className="text-xs text-white/60">
            {used} {isRTL ? t("recovery_used_ar") : t("recovery_used")} / {total}
          </span>
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="text-3xl font-bold">{remaining}</span>
            <span className="text-sm ml-1 text-white/70">
              {isRTL ? t("recovery_credits_ar") : t("recovery_credits")}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/20 rounded-full h-1.5 mb-3">
          <div
            className="bg-white rounded-full h-1.5 transition-all"
            style={{ width: `${total > 0 ? (used / total) * 100 : 0}%` }}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 p-0 h-auto font-medium"
          onClick={() => navigate("/recovery")}
        >
          {isRTL ? t("recovery_browse_ar") : t("recovery_browse")}
          <ArrowRight className={`w-4 h-4 ml-1 ${isRTL ? "rotate-180" : ""}`} />
        </Button>
      </CardContent>
    </Card>
  );
}
