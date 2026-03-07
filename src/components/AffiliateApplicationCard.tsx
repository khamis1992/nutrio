import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    hasApplied,
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
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-destructive">{t("affiliateNotApproved")}</p>
              <p className="text-sm text-muted-foreground">
                {t("affiliateNotApprovedDescription")}
              </p>
              {application?.rejection_reason && (
                <p className="text-sm text-muted-foreground mt-1">
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
