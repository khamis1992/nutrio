import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Loader2, ArrowLeft, Utensils, Apple, ShieldCheck, Sparkles, CalendarCheck, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscriptionPlans, type DbSubscriptionPlan } from "@/hooks/useSubscriptionPlans";

const TIER_DISPLAY: Record<string, { en: string; ar: string; icon: typeof Zap; badge: string; badgeClass: string }> = {
  elite:   { en: "Nutrio Elite",   ar: "نخبة نوتريو",   icon: Crown, badge: "Most Popular", badgeClass: "bg-amber-500" },
  healthy: { en: "Healthy Balance", ar: "توازن صحي",     icon: Zap,   badge: "Best Value",  badgeClass: "bg-emerald-500" },
  fresh:   { en: "Fresh Start",     ar: "بداية منعشة",   icon: Zap,   badge: "Starter",     badgeClass: "bg-blue-500" },
  weekly:  { en: "Weekly Boost",    ar: "دفعة أسبوعية",  icon: Zap,   badge: "Flexible",    badgeClass: "bg-violet-500" },
};

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { plans: dbPlans, loading, error } = useSubscriptionPlans();

  const getPlanDisplay = (plan: DbSubscriptionPlan) => {
    return TIER_DISPLAY[plan.tier] || {
      en: plan.tier,
      ar: plan.name_ar || plan.tier,
      icon: Zap,
      badge: "",
      badgeClass: "bg-slate-500",
    };
  };

  const handleSubscribe = async (planTier: string) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to subscribe");
        navigate("/auth");
        return;
      }
      navigate(`/subscription/checkout?plan=${planTier}`);
    } catch {
      toast.error("Failed to process subscription");
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4 font-medium">Failed to load subscription plans</p>
          <Button onClick={() => window.location.reload()} className="rounded-2xl">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 pt-[env(safe-area-inset-top)] h-14 flex items-center gap-3 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <h1 className="text-base font-bold tracking-tight">Choose Your Plan</h1>
        </div>
      </header>

      <div className="relative overflow-hidden bg-gradient-to-b from-primary to-emerald-700 text-white py-12 px-4">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-emerald-300 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative max-w-lg mx-auto text-center">
          <Badge className="mb-3 bg-white/15 text-white border-white/20 backdrop-blur-sm px-3 py-1">
            <Sparkles className="h-3 w-3 mr-1.5" />
            AI-Powered Nutrition
          </Badge>
          <h1 className="text-[26px] font-extrabold mb-3 tracking-tight leading-tight">
            Choose Your Health Journey
          </h1>
          <p className="text-sm text-white/75 leading-relaxed max-w-sm mx-auto">
            Subscribe to monthly meal credits and let our AI create personalized nutrition plans tailored to your goals.
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 -mt-6">
        <div className="space-y-4">
          {dbPlans.map((plan) => {
            const display = getPlanDisplay(plan);
            const Icon = display.icon;
            const isSelected = selectedPlan === plan.tier;
            const isPopular = plan.tier === "elite";
            const pricePerMeal = plan.meals_per_month > 0
              ? (plan.price_qar / plan.meals_per_month).toFixed(2)
              : "0";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative bg-card rounded-[24px] border-2 overflow-hidden transition-all duration-200",
                  "active:scale-[0.98] cursor-pointer",
                  isSelected
                    ? "border-primary shadow-md shadow-primary/10"
                    : isPopular
                    ? "border-amber-200 shadow-md"
                    : "border-border/60 shadow-sm hover:shadow-md"
                )}
                onClick={() => setSelectedPlan(plan.tier)}
              >
                {display.badge && (
                  <div className={cn("text-white text-[11px] font-bold text-center py-1.5 tracking-wide", display.badgeClass)}>
                    {display.badge}
                  </div>
                )}

                <div className={cn("p-5", display.badge && "pt-4")}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center",
                        isPopular ? "bg-amber-100" : "bg-primary/10"
                      )}>
                        <Icon className={cn("h-5 w-5", isPopular ? "text-amber-600" : "text-primary")} />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{display.en}</h3>
                        <p className="text-xs text-emerald-600 font-semibold">{display.ar}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-extrabold text-foreground">{plan.price_qar.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground font-medium">QAR / month</p>
                    </div>
                  </div>

                  {plan.short_description && (
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{plan.short_description}</p>
                  )}

                  <div className="bg-muted/60 rounded-2xl p-3 mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Utensils className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground font-semibold">
                          {plan.meals_per_month} meals/month
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        ~{pricePerMeal} QAR/meal
                      </span>
                    </div>
                    {plan.snacks_per_month > 0 && (
                      <div className="flex items-center gap-2 border-t border-border/30 pt-2">
                        <Apple className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-foreground font-semibold">
                          +{plan.snacks_per_month} snacks/month
                        </span>
                      </div>
                    )}
                  </div>

                  {plan.description_en && (
                    <p className="text-xs text-slate-600 bg-emerald-50 rounded-xl p-3 border border-emerald-100 mb-3 leading-relaxed">
                      {plan.description_en}
                    </p>
                  )}

                  {plan.features && plan.features.length > 0 && (
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="h-2.5 w-2.5 text-primary" />
                          </div>
                          <span className="text-xs text-foreground leading-snug">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    className={cn(
                      "w-full py-5 text-sm font-bold rounded-2xl transition-all duration-200",
                      isPopular
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20"
                        : "bg-foreground hover:bg-foreground/90 text-background"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubscribe(plan.tier);
                    }}
                    disabled={isLoading}
                  >
                    {isLoading && selectedPlan === plan.tier ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      `Subscribe to ${display.en}`
                    )}
                  </Button>

                  <p className="text-center text-[11px] text-muted-foreground mt-2 font-medium">
                    7-day money-back guarantee · Cancel anytime
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-muted-foreground">
          {[
            { icon: ShieldCheck, text: "No hidden fees" },
            { icon: ShieldCheck, text: "Secure payment" },
            { icon: CalendarCheck, text: "Instant activation" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">{text}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 mb-8">
          <h2 className="text-lg font-extrabold text-center mb-8 text-foreground">
            How Your Subscription Works
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { step: "01", title: "Subscribe", desc: "Choose your plan and get instant access to meal credits" },
              { step: "02", title: "AI Planning", desc: "Our AI creates personalized weekly meal plans" },
              { step: "03", title: "Order & Enjoy", desc: "Use credits to order meals from any restaurant" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-base font-extrabold">
                  {item.step}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">{item.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
