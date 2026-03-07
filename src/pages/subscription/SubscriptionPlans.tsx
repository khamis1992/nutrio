import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscriptionPlans, type DbSubscriptionPlan } from "@/hooks/useSubscriptionPlans";

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { plans: dbPlans, loading, error } = useSubscriptionPlans();

  // Map database tier to display name
  const getPlanDisplayName = (plan: DbSubscriptionPlan) => {
    const names: Record<string, { en: string; ar: string }> = {
      elite: { en: "Nutrio Elite", ar: "نخبة نوتريو" },
      healthy: { en: "Healthy Balance", ar: "توازن صحي" },
      fresh: { en: "Fresh Start", ar: "بداية منعشة" },
      weekly: { en: "Weekly Boost", ar: "دفعة أسبوعية" },
    };
    return names[plan.tier] || { en: plan.tier, ar: plan.name_ar || plan.tier };
  };

  // Get tier badge info
  const getTierBadge = (tier: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      elite: { text: "Most Popular", color: "bg-gradient-to-r from-amber-500 to-orange-500" },
      healthy: { text: "Best Value", color: "bg-gradient-to-r from-emerald-500 to-teal-500" },
      fresh: { text: "Starter", color: "bg-gradient-to-r from-blue-500 to-cyan-500" },
      weekly: { text: "Flexible", color: "bg-gradient-to-r from-violet-500 to-purple-500" },
    };
    return badges[tier] || null;
  };

  const handleSubscribe = async (planId: string) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to subscribe");
        navigate("/auth");
        return;
      }

      navigate(`/subscription/checkout?plan=${planId}`);
    } catch (error) {
      toast.error("Failed to process subscription");
    } finally {
      setIsLoading(false);
    }
  };

  const getPricePerMeal = (plan: DbSubscriptionPlan) => {
    if (plan.meals_per_month > 0) {
      return (plan.price_qar / plan.meals_per_month).toFixed(2);
    }
    return "0";
  };

  const getDailyBreakdown = (plan: DbSubscriptionPlan) => {
    const meals = plan.daily_meals || Math.round((plan.meals_per_month || 0) / 30);
    const snacks = plan.daily_snacks || Math.round((plan.snacks_per_month || 0) / 30);
    return { meals, snacks };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load subscription plans</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-emerald-900 to-emerald-800 text-white py-20 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-400 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-white/10 text-white border-white/20 backdrop-blur-sm">
            AI-Powered Nutrition
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            Choose Your
            <span className="block text-emerald-300">Health Journey</span>
          </h1>
          <p className="text-lg md:text-xl text-emerald-100/80 max-w-2xl mx-auto leading-relaxed">
            Subscribe to monthly meal credits and let our AI create personalized nutrition plans 
            tailored to your goals. No per-meal payments, just healthy eating made simple.
          </p>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16 -mt-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {dbPlans.map((plan) => {
            const displayName = getPlanDisplayName(plan);
            const tierBadge = getTierBadge(plan.tier);
            const daily = getDailyBreakdown(plan);
            const isPopular = plan.tier === "elite";

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative overflow-hidden transition-all duration-300 cursor-pointer",
                  "hover:shadow-2xl hover:-translate-y-1",
                  selectedPlan === plan.tier
                    ? "ring-2 ring-emerald-500 shadow-emerald-500/20"
                    : "shadow-lg",
                  isPopular && "md:-mt-4 md:mb-4"
                )}
                onClick={() => setSelectedPlan(plan.tier)}
              >
                {tierBadge && (
                  <div className={cn("absolute top-0 left-0 right-0 text-white text-center py-2 text-sm font-medium z-10", tierBadge.color)}>
                    {tierBadge.text}
                  </div>
                )}

                <CardHeader className={cn("pt-8 pb-4", isPopular && "pt-12")}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-bold text-slate-900">{displayName.en}</h3>
                    {plan.tier === "elite" && <Crown className="w-5 h-5 text-amber-500" />}
                    {plan.tier === "healthy" && <Zap className="w-5 h-5 text-emerald-500" />}
                  </div>
                  <p className="text-sm text-emerald-600 font-medium mb-3">{displayName.ar}</p>
                  
                  {/* Short Description - الوصف القصير */}
                  {plan.short_description && (
                    <p className="text-sm text-slate-500 mb-3">{plan.short_description}</p>
                  )}
                  {plan.short_description_ar && (
                    <p className="text-sm text-slate-400 mb-3">{plan.short_description_ar}</p>
                  )}
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-900">
                      {plan.price_qar.toLocaleString()}
                    </span>
                    <span className="text-slate-500">QAR</span>
                  </div>
                  <p className="text-sm text-slate-500">per month</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Meal & Snack Summary */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-600">Meals</span>
                      <span className="text-2xl font-bold text-emerald-600">
                        {plan.meals_per_month}
                      </span>
                    </div>
                    {plan.snacks_per_month > 0 && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-600">Snacks</span>
                        <span className="text-2xl font-bold text-amber-600">
                          {plan.snacks_per_month}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Daily</span>
                        <span className="font-medium text-slate-700">
                          {daily.meals} meals + {daily.snacks} snacks
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price per meal */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Price per meal</span>
                    <span className="font-semibold text-emerald-600">
                      {getPricePerMeal(plan)} QAR
                    </span>
                  </div>

                  {/* Full Description - الوصف الكامل */}
                  {plan.description_en && (
                    <p className="text-sm text-slate-600 bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                      {plan.description_en}
                    </p>
                  )}
                  {plan.description && (
                    <p className="text-sm text-slate-500">{plan.description}</p>
                  )}

                  {/* Features from database */}
                  {plan.features && plan.features.length > 0 && (
                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* CTA Button */}
                  <Button
                    className={cn(
                      "w-full py-5 text-base font-semibold transition-all duration-300",
                      isPopular
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    )}
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={isLoading}
                  >
                    {isLoading && selectedPlan === plan.tier ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      `Subscribe to ${displayName.en}`
                    )}
                  </Button>

                  {/* Money-back guarantee */}
                  <p className="text-center text-xs text-slate-400">
                    7-day money-back guarantee • Cancel anytime
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-slate-400">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span className="text-sm">No hidden fees</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span className="text-sm">Secure payment</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span className="text-sm">Instant activation</span>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12 text-slate-900">
            How Your Subscription Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Subscribe",
                description: "Choose your plan and get instant access to meal credits",
              },
              {
                step: "02",
                title: "AI Planning",
                description: "Our AI creates personalized weekly meal plans based on your goals",
              },
              {
                step: "03",
                title: "Order & Enjoy",
                description: "Use your credits to order any meal from any restaurant",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
