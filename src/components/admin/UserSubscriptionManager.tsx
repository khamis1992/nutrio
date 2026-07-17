import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Calendar,
  Crown,
  CreditCard,
  Loader2,
  RefreshCw,
  Utensils,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  AdminDialogContent,
  AdminEmptyState,
  AdminPanel,
  AdminPanelHeader,
} from "@/components/admin/AdminPrimitives";
import {
  buildAdminSubscriptionWalletArgs,
  ensureActiveSubscriptionEndDate,
  getEditableSubscriptionStatus,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
  normalizeSubscriptionTier,
  parseSubscriptionNumberInput,
  type SubscriptionSaveOverrides,
  type SubscriptionStatus,
} from "@/components/admin/userSubscriptionPayload";

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  plan_type: string | null;
  status: "active" | "pending" | "cancelled" | "expired";
  start_date: string;
  end_date: string;
  price: number | null;
  tier: string | null;
  meals_per_week: number | null;
  meals_used_this_week: number | null;
  week_start_date: string | null;
  meals_per_month: number | null;
  meals_used_this_month: number | null;
  month_start_date: string | null;
  active: boolean | null;
  created_at: string;
}

interface CustomerWallet {
  id: string;
  user_id: string;
  balance: number | null;
  total_credits: number | null;
  total_debits: number | null;
  is_active: boolean | null;
  updated_at: string | null;
}

interface SubscriptionPlanOption {
  tier: string;
  billing_interval: string;
  meals_per_week: number | null;
  meals_per_month: number | null;
  price_qar: number | null;
  is_active: boolean | null;
}

interface UserSubscriptionManagerProps {
  userId: string;
  userName: string | null;
}

const AVAILABLE_TIERS = ["basic", "standard", "premium", "vip"];
const AVAILABLE_PLANS = ["weekly", "monthly"];

const FALLBACK_PLAN_MEALS: Record<
  string,
  { mealsPerWeek: number; mealsPerMonth: number; price: number }
> = {
  basic: { mealsPerWeek: 5, mealsPerMonth: 20, price: 299 },
  standard: { mealsPerWeek: 10, mealsPerMonth: 40, price: 499 },
  premium: { mealsPerWeek: 15, mealsPerMonth: 60, price: 699 },
  vip: { mealsPerWeek: 0, mealsPerMonth: 0, price: 999 },
  fresh: { mealsPerWeek: 5, mealsPerMonth: 20, price: 1800 },
  healthy: { mealsPerWeek: 10, mealsPerMonth: 40, price: 2800 },
  elite: { mealsPerWeek: 15, mealsPerMonth: 60, price: 3800 },
  weekly: { mealsPerWeek: 5, mealsPerMonth: 5, price: 450 },
};

export function UserSubscriptionManager({
  userId,
  userName,
}: UserSubscriptionManagerProps) {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [planOptions, setPlanOptions] = useState<SubscriptionPlanOption[]>([]);

  // Form state
  const [selectedPlan, setSelectedPlan] = useState<string>("weekly");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [selectedTier, setSelectedTier] = useState<string>("basic");
  const [mealsPerWeek, setMealsPerWeek] = useState<string>("5");
  const [mealsPerMonth, setMealsPerMonth] = useState<string>("20");
  const [mealsUsed, setMealsUsed] = useState<string>("0");
  const [mealsUsedWeek, setMealsUsedWeek] = useState<string>("0");
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [price, setPrice] = useState<string>("99");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    fetchSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const [{ data, error }, walletResult, plansResult] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("customer_wallets")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("subscription_plans")
          .select(
            "tier, billing_interval, meals_per_week, meals_per_month, price_qar, is_active",
          )
          .eq("is_active", true),
      ]);

      if (error) throw error;
      if (walletResult.error) throw walletResult.error;
      if (plansResult.error) {
        console.warn("Unable to load subscription plan defaults:", plansResult.error);
      }

      setSubscription(data as Subscription | null);
      setWallet(walletResult.data as CustomerWallet | null);
      setPlanOptions((plansResult.data || []) as SubscriptionPlanOption[]);
    } catch (err) {
      console.error("Error fetching subscription or wallet:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    if (subscription) {
      const editStatus = getEditableSubscriptionStatus(subscription.status);
      const editPlan = normalizeSubscriptionPlan(
        subscription.plan || subscription.plan_type,
      );
      setSelectedPlan(
        editPlan,
      );
      setSelectedStatus(editStatus);
      setSelectedTier(normalizeSubscriptionTier(subscription.tier));
      setMealsPerWeek((subscription.meals_per_week || 5).toString());
      setMealsPerMonth((subscription.meals_per_month || 20).toString());
      setMealsUsed((subscription.meals_used_this_month || 0).toString());
      setMealsUsedWeek((subscription.meals_used_this_week || 0).toString());
      setPrice((subscription.price || 99).toString());
      setEndDate(
        ensureActiveSubscriptionEndDate({
          status: editStatus,
          plan: editPlan,
          endDate: subscription.end_date
            ? subscription.end_date.split("T")[0]
            : "",
        }) || "",
      );
    } else {
      setSelectedPlan("weekly");
      setSelectedStatus("active");
      setSelectedTier("basic");
      setMealsPerWeek("5");
      setMealsPerMonth("20");
      setMealsUsed("0");
      setMealsUsedWeek("0");
      setPrice("99");
      setEndDate("");
    }
    setWalletBalance((wallet?.balance || 0).toString());
    setIsEditDialogOpen(true);
  };

  const getPlanDefaults = (plan: string, tier: string) => {
    const normalizedPlan = normalizeSubscriptionPlan(plan);
    const normalizedTier = normalizeSubscriptionTier(tier);
    const exactPlan = planOptions.find(
      (option) =>
        normalizeSubscriptionPlan(option.billing_interval) === normalizedPlan &&
        normalizeSubscriptionTier(option.tier) === normalizedTier,
    );
    const canonicalTier =
      normalizedPlan === "weekly"
        ? "weekly"
        : normalizedTier === "basic"
          ? "fresh"
          : normalizedTier === "standard"
            ? "healthy"
            : normalizedTier === "premium"
              ? "elite"
              : normalizedTier;
    const canonicalPlan = planOptions.find(
      (option) =>
        normalizeSubscriptionPlan(option.billing_interval) === normalizedPlan &&
        normalizeSubscriptionTier(option.tier) ===
          normalizeSubscriptionTier(canonicalTier),
    );
    const option = exactPlan || canonicalPlan;

    if (option) {
      return {
        mealsPerWeek: Number(option.meals_per_week || 0),
        mealsPerMonth: Number(option.meals_per_month || 0),
        price: Number(option.price_qar || 0),
      };
    }

    const fallback =
      normalizedPlan === "weekly"
        ? FALLBACK_PLAN_MEALS.weekly
        : FALLBACK_PLAN_MEALS[normalizedTier] || FALLBACK_PLAN_MEALS.basic;
    return fallback;
  };

  const applyPlanDefaults = (
    plan: string,
    tier: string,
    { reactivateInactive = false }: { reactivateInactive?: boolean } = {},
  ) => {
    const defaults = getPlanDefaults(plan, tier);
    const currentStatus = normalizeSubscriptionStatus(selectedStatus);
    const nextStatus =
      reactivateInactive &&
      (currentStatus === "expired" || currentStatus === "pending")
        ? "active"
        : currentStatus;

    setMealsPerWeek(defaults.mealsPerWeek.toString());
    setMealsPerMonth(defaults.mealsPerMonth.toString());
    setPrice(defaults.price.toString());
    if (nextStatus !== currentStatus) {
      setSelectedStatus(nextStatus);
    }
    if (nextStatus === "active") {
      setEndDate(
        ensureActiveSubscriptionEndDate({
          status: nextStatus,
          plan,
          endDate,
        }) || "",
      );
    }
  };

  const handlePlanChange = (value: string) => {
    const nextPlan = normalizeSubscriptionPlan(value);
    setSelectedPlan(nextPlan);
    applyPlanDefaults(nextPlan, selectedTier, { reactivateInactive: true });
  };

  const handleTierChange = (value: string) => {
    const nextTier = normalizeSubscriptionTier(value);
    setSelectedTier(nextTier);
    applyPlanDefaults(selectedPlan, nextTier, { reactivateInactive: true });
  };

  const handleStatusChange = (value: string) => {
    const nextStatus = normalizeSubscriptionStatus(value);
    setSelectedStatus(nextStatus);
    if (nextStatus === "active") {
      setEndDate(
        ensureActiveSubscriptionEndDate({
          status: nextStatus,
          plan: selectedPlan,
          endDate,
        }) || "",
      );
    }
  };

  const saveSubscriptionAndWallet = async (
    subscriptionId: string | null,
    overrides: SubscriptionSaveOverrides = {},
  ) => {
    const args = buildAdminSubscriptionWalletArgs({
      userId,
      subscriptionId,
      form: {
        selectedPlan,
        selectedStatus,
        selectedTier,
        mealsPerWeek,
        mealsPerMonth,
        mealsUsedWeek,
        mealsUsed,
        price,
        endDate,
        walletBalance,
      },
      overrides,
    });

    const { data, error } = await supabase.rpc(
      "admin_update_user_subscription_wallet",
      args,
    );

    if (error) throw error;

    const result = data as { subscription_id?: string } | null;
    const savedSubscriptionId = subscriptionId || result?.subscription_id;

    if (!savedSubscriptionId) {
      throw new Error("Subscription saved but no subscription id was returned");
    }

    await verifySavedSubscriptionAndWallet(savedSubscriptionId, args);
  };

  const verifySavedSubscriptionAndWallet = async (
    subscriptionId: string,
    expected: {
      p_plan: string;
      p_status: SubscriptionStatus;
      p_tier: string;
      p_meals_per_week: number;
      p_meals_per_month: number;
      p_meals_used_this_week: number;
      p_meals_used_this_month: number;
      p_price: number;
      p_end_date: string | null;
      p_wallet_balance: number;
    },
  ) => {
    const [{ data: savedSubscription, error: subscriptionError }, walletResult] =
      await Promise.all([
        supabase
          .from("subscriptions")
          .select(
            "id, user_id, plan, status, tier, meals_per_week, meals_per_month, meals_used_this_week, meals_used_this_month, price, end_date",
          )
          .eq("id", subscriptionId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("customer_wallets")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    if (subscriptionError) throw subscriptionError;
    if (walletResult.error) throw walletResult.error;
    if (!savedSubscription) {
      throw new Error("Subscription was not found after saving");
    }

    const savedEndDate = savedSubscription.end_date
      ? String(savedSubscription.end_date).slice(0, 10)
      : null;
    const expectedEndDate = expected.p_end_date
      ? expected.p_end_date.slice(0, 10)
      : null;
    const savedWalletBalance = Number(walletResult.data?.balance || 0);

    const checks = [
      savedSubscription.plan === expected.p_plan,
      savedSubscription.status === expected.p_status,
      (savedSubscription.tier || "basic") === expected.p_tier,
      Number(savedSubscription.meals_per_week || 0) ===
        expected.p_meals_per_week,
      Number(savedSubscription.meals_per_month || 0) ===
        expected.p_meals_per_month,
      Number(savedSubscription.meals_used_this_week || 0) ===
        expected.p_meals_used_this_week,
      Number(savedSubscription.meals_used_this_month || 0) ===
        expected.p_meals_used_this_month,
      Math.abs(Number(savedSubscription.price || 0) - expected.p_price) < 0.01,
      savedEndDate === expectedEndDate,
      Math.abs(savedWalletBalance - expected.p_wallet_balance) < 0.01,
    ];

    if (checks.some((passed) => !passed)) {
      throw new Error(
        "Save did not persist all subscription and wallet fields. Please refresh and try again.",
      );
    }
  };

  const getSubscriptionOverrides = (
    updates: SubscriptionSaveOverrides = {},
  ): SubscriptionSaveOverrides => {
    if (!subscription) return updates;

    return {
      plan: subscription.plan || "monthly",
      status: subscription.status,
      tier: subscription.tier || "basic",
      mealsPerWeek: subscription.meals_per_week || 0,
      mealsPerMonth: subscription.meals_per_month || 0,
      mealsUsedThisWeek: subscription.meals_used_this_week || 0,
      mealsUsedThisMonth: subscription.meals_used_this_month || 0,
      price: Number(subscription.price || 0),
      endDate: subscription.end_date
        ? subscription.end_date.split("T")[0]
        : null,
      walletBalance: Number(wallet?.balance || 0),
      ...updates,
    };
  };

  const handleUpdateSubscription = async () => {
    if (!subscription) return;

    setIsSubmitting(true);
    try {
      await saveSubscriptionAndWallet(subscription.id);

      toast({
        title: "Success",
        description:
          "Subscription, meal credits, and wallet balance updated successfully",
      });

      setIsEditDialogOpen(false);
      fetchSubscription();
    } catch (err) {
      console.error("Error updating subscription:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to update subscription",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubscription = async () => {
    setIsSubmitting(true);
    try {
      await saveSubscriptionAndWallet(null);

      toast({
        title: "Success",
        description:
          "Subscription created and wallet balance updated successfully",
      });

      setIsEditDialogOpen(false);
      fetchSubscription();
    } catch (err) {
      console.error("Error creating subscription:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create subscription",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    try {
      await saveSubscriptionAndWallet(
        subscription.id,
        getSubscriptionOverrides({ status: "cancelled" }),
      );

      toast({
        title: "Success",
        description: "Subscription cancelled successfully",
      });

      fetchSubscription();
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to cancel subscription",
        variant: "destructive",
      });
    }
  };

  const handleResetMeals = async () => {
    if (!subscription) return;

    try {
      await saveSubscriptionAndWallet(
        subscription.id,
        getSubscriptionOverrides({
          mealsUsedThisMonth: 0,
          mealsUsedThisWeek: 0,
        }),
      );

      toast({
        title: "Success",
        description: "Meal usage reset successfully",
      });

      fetchSubscription();
    } catch (err) {
      console.error("Error resetting meals:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to reset meal usage",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#22C7A1]";
      case "pending":
        return "border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#38BDF8]";
      case "cancelled":
        return "border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#FB6B7A]";
      case "expired":
        return "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]";
      default:
        return "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]";
    }
  };

  const getTierBadge = (tier: string | null) => {
    switch (tier) {
      case "vip":
        return "border-[#7C83F6]/25 bg-[#7C83F6]/10 text-[#7C83F6]";
      case "premium":
        return "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]";
      case "standard":
        return "border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#38BDF8]";
      default:
        return "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]";
    }
  };

  const currentMonthlyMeals = subscription?.meals_per_month || 0;
  const currentMealsUsed = subscription?.meals_used_this_month || 0;
  const currentWalletBalance = Number(wallet?.balance || 0);
  const formMonthlyMeals = parseSubscriptionNumberInput(
    mealsPerMonth,
    currentMonthlyMeals || 20,
  );
  const formMealsUsed = parseSubscriptionNumberInput(
    mealsUsed,
    currentMealsUsed,
  );
  const formRemainingMeals = Math.max(0, formMonthlyMeals - formMealsUsed);
  const formWalletBalance = parseSubscriptionNumberInput(
    walletBalance,
    currentWalletBalance,
  );
  const walletDelta = Number(
    (formWalletBalance - currentWalletBalance).toFixed(2),
  );
  const isInactiveEditStatus =
    normalizeSubscriptionStatus(selectedStatus) !== "active";

  if (loading) {
    return (
      <AdminPanel>
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#22C7A1]/10 text-[#22C7A1]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </span>
          <p className="text-sm font-bold text-[#94A3B8]">
            Loading subscription details...
          </p>
        </div>
      </AdminPanel>
    );
  }

  return (
    <>
      <AdminPanel>
        <AdminPanelHeader
          title="Customer access"
          eyebrow="Subscription & Credits"
          actions={
            <Button
              size="sm"
              onClick={handleEditClick}
              className="h-11 rounded-2xl bg-[#020617] px-4 text-xs font-black normal-case tracking-normal text-white shadow-[0_12px_24px_rgba(2,6,23,0.18)] hover:bg-[#020617]/90"
            >
              {subscription ? "Edit meals & credit" : "Create plan"}
            </Button>
          }
        />
        <div className="px-5 py-4">
          {subscription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">Plan</p>
                  <p className="text-sm font-black capitalize text-[#020617]">
                    {subscription.plan}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">Status</p>
                  <Badge className={getStatusBadge(subscription.status)}>
                    {subscription.status}
                  </Badge>
                </div>
                <div className="rounded-2xl bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">Tier</p>
                  <Badge className={getTierBadge(subscription.tier)}>
                    <Crown className="w-3 h-3 mr-1" />
                    {subscription.tier || "basic"}
                  </Badge>
                </div>
                <div className="rounded-2xl bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">
                    Wallet Credit
                  </p>
                  <p className="text-sm font-black text-[#22C7A1]">
                    QAR {Number(wallet?.balance || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">Start Date</p>
                  <p className="text-sm font-bold text-[#020617]">
                    {format(new Date(subscription.start_date), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">End Date</p>
                  <p className="text-sm font-bold text-[#020617]">
                    {subscription.end_date
                      ? format(new Date(subscription.end_date), "MMM d, yyyy")
                      : "No end date"}
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#020617]" />
                    <span className="text-sm font-black text-[#020617]">
                      Monthly Meals
                    </span>
                  </div>
                  <span className="text-sm font-black text-[#020617]">
                    {subscription.meals_used_this_month || 0} /{" "}
                    {subscription.meals_per_month || "Unlimited"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#E5EAF1]">
                  <div
                    className="h-2 rounded-full bg-[#22C7A1] transition-all"
                    style={{
                      width:
                        (subscription.meals_per_month || 0) > 0
                          ? `${Math.min(((subscription.meals_used_this_month || 0) / (subscription.meals_per_month || 1)) * 100, 100)}%`
                          : "100%",
                    }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-[#94A3B8]">
                  Week: {subscription.meals_used_this_week || 0} /{" "}
                  {subscription.meals_per_week || "Unlimited"} meals used
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#F6F8FB] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    Remaining meals
                  </p>
                  <p className="mt-1 text-lg font-black text-[#020617]">
                    {Math.max(
                      0,
                      (subscription.meals_per_month || 0) -
                        (subscription.meals_used_this_month || 0),
                    )}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F6F8FB] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    Wallet credit
                  </p>
                  <p className="mt-1 text-lg font-black text-[#22C7A1]">
                    QAR {Number(wallet?.balance || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetMeals}
                  className="h-11 flex-1 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Meals
                </Button>
                {subscription.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelSubscription}
                    className="h-11 flex-1 rounded-2xl border-[#FB6B7A]/30 text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <AdminEmptyState
                icon={CreditCard}
                title="No Active Subscription"
                description="This user doesn't have an active subscription."
                className="py-8"
              />
              <p className="mb-4 rounded-2xl bg-[#F6F8FB] px-4 py-3 text-sm font-bold text-[#020617]">
                Wallet credit: QAR {Number(wallet?.balance || 0).toFixed(2)}
              </p>
              <Button
                onClick={handleEditClick}
                className="min-h-[44px] rounded-2xl bg-[#020617] font-black text-white"
              >
                Create Subscription
              </Button>
            </div>
          )}
        </div>
      </AdminPanel>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <AdminDialogContent
          size="form"
          className="max-h-[92vh] overflow-hidden sm:max-w-[620px]"
        >
          <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
            <DialogTitle className="text-xl font-black text-[#020617]">
              {subscription
                ? "Edit meals, credit & subscription"
                : "Create subscription"}
            </DialogTitle>
            <DialogDescription className="font-semibold text-[#94A3B8]">
              {subscription
                ? `Update subscription details for ${userName || "this user"}`
                : `Create a new subscription for ${userName || "this user"}`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(92vh-152px)] space-y-4 overflow-y-auto bg-[#F6F8FB] px-5 py-4">
            <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-white p-3 ring-1 ring-[#E5EAF1]">
              <div className="rounded-2xl bg-[#F6F8FB] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                  Remaining
                </p>
                <p className="mt-1 text-lg font-black text-[#020617]">
                  {formRemainingMeals}
                </p>
              </div>
              <div className="rounded-2xl bg-[#F6F8FB] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                  Wallet
                </p>
                <p className="mt-1 text-lg font-black text-[#22C7A1]">
                  {formWalletBalance.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#F6F8FB] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                  Change
                </p>
                <p
                  className={`mt-1 text-lg font-black ${
                    walletDelta < 0 ? "text-[#FB6B7A]" : "text-[#22C7A1]"
                  }`}
                >
                  {walletDelta > 0 ? "+" : ""}
                  {walletDelta.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-black text-[#020617]">Plan Type</Label>
                <Select value={selectedPlan} onValueChange={handlePlanChange}>
                  <SelectTrigger className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent className="z-[1305] rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                    {AVAILABLE_PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan.charAt(0).toUpperCase() + plan.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[#020617]">Tier</Label>
                <Select value={selectedTier} onValueChange={handleTierChange}>
                  <SelectTrigger className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent className="z-[1305] rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                    {AVAILABLE_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-black text-[#020617]">Status</Label>
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="z-[1305] rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs font-semibold text-[#94A3B8]">
                Customer ordering and meal credits are usable only when the
                subscription is Active.
              </p>
              {isInactiveEditStatus ? (
                <div className="rounded-[18px] border border-[#F59E0B]/20 bg-[#FFFBEB] px-4 py-3 text-xs font-bold leading-relaxed text-[#92400E]">
                  This customer will still see the subscription as expired
                  until Status is changed to Active.
                </div>
              ) : (
                <div className="rounded-[18px] border border-[#22C7A1]/15 bg-[#22C7A1]/10 px-4 py-3 text-xs font-bold leading-relaxed text-[#047857]">
                  This subscription will appear as active in the customer app
                  after saving.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-black text-[#020617]">
                  Meals Per Week
                </Label>
                <Input
                  type="number"
                  value={mealsPerWeek}
                  onChange={(e) => setMealsPerWeek(e.target.value)}
                  min="0"
                  className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[#020617]">
                  Meals Per Month
                </Label>
                <Input
                  type="number"
                  value={mealsPerMonth}
                  onChange={(e) => setMealsPerMonth(e.target.value)}
                  min="0"
                  className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                />
              </div>
            </div>

            <div className="rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
              <div className="mb-3 flex items-center gap-2">
                <Utensils className="h-4 w-4 text-[#020617]" />
                <p className="text-sm font-black text-[#020617]">
                  Meal credits
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-black text-[#020617]">
                    Used This Week
                  </Label>
                  <Input
                    type="number"
                    value={mealsUsedWeek}
                    onChange={(e) => setMealsUsedWeek(e.target.value)}
                    min="0"
                    className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-[#020617]">
                    Used This Month
                  </Label>
                  <Input
                    type="number"
                    value={mealsUsed}
                    onChange={(e) => setMealsUsed(e.target.value)}
                    min="0"
                    className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#94A3B8]">
                Remaining meals are calculated from monthly meals minus monthly
                used.
              </p>
            </div>

            <div className="rounded-[22px] bg-[#22C7A1]/10 p-4 ring-1 ring-[#22C7A1]/15">
              <div className="mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#22C7A1]" />
                <p className="text-sm font-black text-[#020617]">
                  Wallet credit
                </p>
              </div>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label className="font-black text-[#020617]">
                    Final Balance (QAR)
                  </Label>
                  <Input
                    type="number"
                    value={walletBalance}
                    onChange={(e) => setWalletBalance(e.target.value)}
                    min="0"
                    step="0.01"
                    className="h-11 rounded-2xl bg-white text-base font-black text-[#020617]"
                  />
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    Current
                  </p>
                  <p className="text-sm font-black text-[#22C7A1]">
                    QAR {Number(wallet?.balance || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#22C7A1]">
                Saving will add or deduct only the difference and create a
                wallet transaction.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-black text-[#020617]">Price (QAR)</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min="0"
                  className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[#020617]">
                  End Date (Optional)
                </Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#94A3B8]" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617]"
                  />
                </div>
              </div>
            </div>

          </div>

          <DialogFooter className="sticky bottom-0 gap-2 border-t border-[#E5EAF1] bg-white px-5 py-4 shadow-[0_-12px_28px_rgba(2,6,23,0.06)] sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]"
            >
              Cancel
            </Button>
            <Button
              onClick={
                subscription
                  ? handleUpdateSubscription
                  : handleCreateSubscription
              }
              disabled={isSubmitting}
              className="h-11 min-w-[150px] rounded-2xl bg-[#020617] font-black text-white hover:bg-[#020617]/90"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {subscription ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </AdminDialogContent>
      </Dialog>
    </>
  );
}
