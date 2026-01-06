import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, Check, Clock, X, Gift, TrendingUp, DollarSign } from "lucide-react";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { useToast } from "@/hooks/use-toast";

export function AffiliateApplicationCard() {
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
        title: "Application Submitted!",
        description: "We'll review your application and get back to you soon.",
      });
      setShowForm(false);
      setNote("");
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to submit application",
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
              <p className="font-semibold text-green-600">You're an Approved Affiliate!</p>
              <p className="text-sm text-muted-foreground">
                Access the Affiliate tab to view your earnings and referrals.
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
              <p className="font-semibold text-amber-600">Application Pending</p>
              <p className="text-sm text-muted-foreground">
                Your affiliate application is under review. We'll notify you once it's approved.
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
              <p className="font-semibold text-destructive">Application Not Approved</p>
              <p className="text-sm text-muted-foreground">
                Unfortunately, your affiliate application was not approved.
              </p>
              {application?.rejection_reason && (
                <p className="text-sm text-muted-foreground mt-1">
                  Reason: {application.rejection_reason}
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
          Join Our Affiliate Program
        </CardTitle>
        <CardDescription>
          Earn commissions by referring friends and family to our platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-muted rounded-lg text-center">
            <Gift className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">Earn Commissions</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">3-Tier Rewards</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-medium">Monthly Payouts</p>
          </div>
        </div>

        {showForm ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Tell us why you'd like to become an affiliate (optional)"
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
                Submit Application
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setShowForm(true)}>
            Apply Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
