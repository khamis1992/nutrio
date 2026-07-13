import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Users, Loader2, Check, Clock, X, Gift, TrendingUp, DollarSign } from "lucide-react";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export function AffiliateApplicationCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const {
    application,
    loading,
    isPending,
    isApprovedAffiliate,
    isRejected,
    applyForAffiliate,
  } = useAffiliateApplication();

  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleApply = async () => {
    setSubmitting(true);
    const result = await applyForAffiliate(note);
    setSubmitting(false);

    if (result.success) {
      toast({
        title: t("affiliateApplicationSubmitted"),
        description: t("affiliateApplicationSubmittedDescription"),
      });
      setShowForm(false);
      setNote("");
    } else {
      toast({
        title: t("error"),
        description: result.error || t("affiliateApplicationFailed"),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Already approved - show success state
  if (isApprovedAffiliate) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-green-600">{t("affiliateApproved")}</p>
              <p className="text-sm text-muted-foreground">
                {t("affiliateApprovedDescription")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending application
  if (isPending) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-amber-600">{t("affiliatePending")}</p>
              <p className="text-sm text-muted-foreground">
                {t("affiliatePendingDescription")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Rejected application
  if (isRejected) {
    return (
      <Card className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[#FFF0F2] text-[#FB6B7A]">
              <X className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-extrabold leading-tight text-[#020617]">{t("affiliateNotApproved")}</p>
                <span className="shrink-0 rounded-full bg-[#FFF0F2] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#FB6B7A]">
                  Review
                </span>
              </div>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-[#64748B]">
                {t("affiliateNotApprovedDescription")}
              </p>
              {application?.rejection_reason && (
                <p className="mt-3 rounded-[18px] bg-[#F6F8FB] px-3 py-2 text-[12px] font-semibold leading-5 text-[#64748B]">
                  {t("affiliateRejectionReason", { reason: application.rejection_reason })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not applied yet - show apply form
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {t("affiliateJoinProgram")}
        </CardTitle>
        <CardDescription>
          {t("affiliateJoinDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-muted rounded-lg text-center">
            <Gift className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">{t("affiliateEarnCommissions")}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">{t("affiliate3TierRewards")}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">{t("affiliateMonthlyPayouts")}</p>
          </div>
        </div>

        {showForm ? (
          <div className="space-y-3">
            <Textarea
              placeholder={t("affiliateNotePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleApply}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {t("submitApplication")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setShowForm(true)}>
            {t("applyNow")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
