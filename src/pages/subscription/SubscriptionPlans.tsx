import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SubscriptionPlan {
  id: string;
  name: string;
  price_qar: number;
  meal_credits: number;
  meal_value_qar: number;
  features: {
    ai_recommendations: boolean;
    priority_support: boolean;
    dietitian_access: boolean;
    weekly_planning: boolean;
  };
  popular?: boolean;
}

const plans: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "Basic",
    price_qar: 2900,
    meal_credits: 58,
    meal_value_qar: 50,
    features: {
      ai_recommendations: false,
      priority_support: false,
      dietitian_access: false,
      weekly_planning: false,
    },
  },
  {
    id: "standard",
    name: "Standard",
    price_qar: 3900,
    meal_credits: 78,
    meal_value_qar: 50,
    features: {
      ai_recommendations: true,
      priority_support: true,
      dietitian_access: false,
      weekly_planning: true,
    },
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    price_qar: 4900,
    meal_credits: 98,
    meal_value_qar: 50,
    features: {
      ai_recommendations: true,
      priority_support: true,
      dietitian_access: true,
      weekly_planning: true,
    },
  },
];

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (planId: string) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to subscribe");
        navigate("/auth");
        return;
      }

      // Navigate to checkout with selected plan
      navigate(`/subscription/checkout?plan=${planId}`);
    } catch (error) {
      toast.error("Failed to process subscription");
    } finally {
      setIsLoading(false);
    }
  };

  const getPricePerMeal = (plan: SubscriptionPlan) => {
    return (plan.price_qar / plan.meal_credits).toFixed(2);
  };

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
            <Sparkles className="w-3 h-3 mr-1" />
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
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden transition-all duration-300 cursor-pointer",
                "hover:shadow-2xl hover:-translate-y-1",
                selectedPlan === plan.id
                  ? "ring-2 ring-emerald-500 shadow-emerald-500/20"
                  : "shadow-lg",
                plan.popular && "md:-mt-4 md:mb-4"
              )}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-center py-2 text-sm font-medium">
                  Most Popular
                </div>
              )}

              <CardHeader className={cn("pt-8 pb-4", plan.popular && "pt-12")}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
                  {plan.id === "premium" && <Crown className="w-6 h-6 text-amber-500" />}
                  {plan.id === "standard" && <Zap className="w-6 h-6 text-emerald-500" />}
                </div>
                
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">
                    {plan.price_qar.toLocaleString()}
                  </span>
                  <span className="text-slate-500">QAR</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">per month</p>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Credits Display */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600">Meal Credits</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      {plan.meal_credits}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Price per meal</span>
                    <span className="font-medium text-slate-700">
                      {getPricePerMeal(plan)} QAR
                    </span>
                  </div>
                </div>

                {/* Features List */}
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      "bg-emerald-100 text-emerald-600"
                    )}>
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-slate-700">{plan.meal_credits} meals per month</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      plan.features.ai_recommendations ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                    )}>
                      <Check className="w-3 h-3" />
                    </div>
                    <span className={cn(
                      plan.features.ai_recommendations ? "text-slate-700" : "text-slate-400"
                    )}>
                      AI meal recommendations
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      plan.features.weekly_planning ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                    )}>
                      <Check className="w-3 h-3" />
                    </div>
                    <span className={cn(
                      plan.features.weekly_planning ? "text-slate-700" : "text-slate-400"
                    )}>
                      Weekly AI meal planning
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      plan.features.priority_support ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                    )}>
                      <Check className="w-3 h-3" />
                    </div>
                    <span className={cn(
                      plan.features.priority_support ? "text-slate-700" : "text-slate-400"
                    )}>
                      Priority support
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      plan.features.dietitian_access ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                    )}>
                      <Check className="w-3 h-3" />
                    </div>
                    <span className={cn(
                      plan.features.dietitian_access ? "text-slate-700" : "text-slate-400"
                    )}>
                      Dietitian consultations
                    </span>
                  </li>
                </ul>

                {/* CTA Button */}
                <Button
                  className={cn(
                    "w-full py-6 text-lg font-semibold transition-all duration-300",
                    plan.popular
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  )}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isLoading}
                >
                  {isLoading && selectedPlan === plan.id ? (
                    "Processing..."
                  ) : (
                    `Subscribe to ${plan.name}`
                  )}
                </Button>

                {/* Money-back guarantee */}
                <p className="text-center text-xs text-slate-400">
                  7-day money-back guarantee • Cancel anytime
                </p>
              </CardContent>
            </Card>
          ))}
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
