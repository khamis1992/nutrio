import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  DollarSign,
  Edit,
  Loader2,
  Plus,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";

import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";

interface SubscriptionPlan {
  id: string;
  tier: string;
  billing_interval: string;
  price_qar: number | null;
  meals_per_week: number | null;
  meals_per_month: number | null;
  discount_percent: number | null;
  features: string[] | null;
  is_active: boolean | null;
  created_at: string | null;
}

const C = {
  ink: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  protein: "#7C83F6",
  progress: "#22C7A1",
  water: "#38BDF8",
  fat: "#FB6B7A",
};

function planLabel(tier: string) {
  return tier.replace(/-/g, " ");
}

const AdminSubscriptions = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlanEditOpen, setIsPlanEditOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [processing, setProcessing] = useState(false);
  const [planForm, setPlanForm] = useState({
    tier: "",
    billing_interval: "monthly",
    price_qar: 0,
    meals_per_week: 0,
    meals_per_month: 0,
    discount_percent: 0,
    is_active: true,
    features: [] as string[],
  });
  const [featureInput, setFeatureInput] = useState("");

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_qar", { ascending: true });

      if (error) throw error;

      const formattedPlans: SubscriptionPlan[] = (data || []).map((plan) => ({
        id: plan.id,
        tier: plan.tier,
        billing_interval: plan.billing_interval,
        price_qar: plan.price_qar,
        meals_per_week: "meals_per_week" in plan ? (plan as Record<string, unknown>).meals_per_week as number | null : null,
        meals_per_month: plan.meals_per_month,
        discount_percent: plan.discount_percent,
        features: plan.features as string[] | null,
        is_active: plan.is_active,
        created_at: plan.created_at,
      }));

      setPlans(formattedPlans);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast({
        title: "Error",
        description: "Failed to load subscription plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const resetPlanForm = () => {
    setPlanForm({
      tier: "",
      billing_interval: "monthly",
      price_qar: 0,
      meals_per_week: 0,
      meals_per_month: 0,
      discount_percent: 0,
      is_active: true,
      features: [],
    });
    setFeatureInput("");
  };

  const openPlanEdit = (plan?: SubscriptionPlan) => {
    if (plan) {
      setSelectedPlan(plan);
      setPlanForm({
        tier: plan.tier,
        billing_interval: plan.billing_interval,
        price_qar: plan.price_qar ?? 0,
        meals_per_week: plan.meals_per_week ?? 0,
        meals_per_month: plan.meals_per_month ?? 0,
        discount_percent: plan.discount_percent ?? 0,
        features: plan.features ?? [],
        is_active: plan.is_active ?? true,
      });
    } else {
      setSelectedPlan(null);
      resetPlanForm();
    }
    setIsPlanEditOpen(true);
  };

  const addFeature = () => {
    const feature = featureInput.trim();
    if (feature && !planForm.features.includes(feature)) {
      setPlanForm((current) => ({
        ...current,
        features: [...current.features, feature],
      }));
      setFeatureInput("");
    }
  };

  const removeFeature = (feature: string) => {
    setPlanForm((current) => ({
      ...current,
      features: current.features.filter((item) => item !== feature),
    }));
  };

  const handleAddPlan = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.from("subscription_plans").insert({
        tier: planForm.tier.toLowerCase().replace(/\s+/g, "-"),
        billing_interval: planForm.billing_interval,
        price_qar: planForm.price_qar,
        meals_per_week: planForm.meals_per_week,
        meals_per_month: planForm.meals_per_week * 4,
        discount_percent: planForm.discount_percent,
        features: planForm.features,
        is_active: planForm.is_active,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Plan created successfully" });
      fetchPlans();
      setIsPlanEditOpen(false);
      resetPlanForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create plan";
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
      toast({
        title: "Error",
        description: message.includes("unique") || code === "23505"
          ? `A ${planForm.tier} / ${planForm.billing_interval} plan already exists.`
          : message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .update({
          tier: planForm.tier.toLowerCase().replace(/\s+/g, "-"),
          price_qar: planForm.price_qar,
          meals_per_week: planForm.meals_per_week,
          meals_per_month: planForm.meals_per_week * 4,
          discount_percent: planForm.discount_percent,
          features: planForm.features,
          is_active: planForm.is_active,
        })
        .eq("id", selectedPlan.id);

      if (error) throw error;

      toast({ title: "Success", description: "Plan updated successfully" });
      fetchPlans();
      setIsPlanEditOpen(false);
      setSelectedPlan(null);
      resetPlanForm();
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({
        title: "Error",
        description: "Failed to update plan",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;

    const confirmed = confirm(`Are you sure you want to permanently delete "${planLabel(plan.tier)}" plan? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", planId);

      if (error) {
        const deactivateConfirm = confirm(`Cannot delete "${planLabel(plan.tier)}" because subscriptions use it.\n\nDeactivate it instead?`);
        if (!deactivateConfirm) return;

        const { error: deactivateError } = await supabase
          .from("subscription_plans")
          .update({ is_active: false })
          .eq("id", planId);

        if (deactivateError) throw deactivateError;

        toast({
          title: "Plan Deactivated",
          description: `"${planLabel(plan.tier)}" plan has been deactivated.`,
        });
        fetchPlans();
        return;
      }

      toast({
        title: "Success",
        description: `"${planLabel(plan.tier)}" plan has been deleted.`,
      });
      fetchPlans();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete plan",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);

      if (error) throw error;

      toast({
        title: plan.is_active ? "Plan Deactivated" : "Plan Activated",
        description: `${planLabel(plan.tier)} is now ${plan.is_active ? "inactive" : "active"}.`,
      });
      fetchPlans();
    } catch (error) {
      console.error("Error toggling plan:", error);
      toast({
        title: "Error",
        description: "Failed to update plan status",
        variant: "destructive",
      });
    }
  };

  const stats = useMemo(() => ({
    totalPlans: plans.length,
    activePlans: plans.filter((plan) => plan.is_active).length,
    monthlyPlans: plans.filter((plan) => plan.billing_interval === "monthly").length,
    annualPlans: plans.filter((plan) => plan.billing_interval === "annual").length,
    avgPrice: plans.length > 0
      ? plans.reduce((acc, plan) => acc + (plan.price_qar || 0), 0) / plans.length
      : 0,
  }), [plans]);

  return (
    <AdminLayout title="Subscription Plans" subtitle={`${stats.activePlans} active plans`}>
      <div className="space-y-5 bg-[#F6F8FB] pb-8 text-[#020617]">
        <div className="overflow-hidden rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#7C83F6]">
                <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
                Plans
              </div>
              <h1 className="mt-3 text-[28px] font-black leading-tight text-[#020617]">Subscription plans</h1>
              <p className="mt-1 max-w-[42rem] text-sm font-semibold leading-6 text-[#64748B]">
                Manage customer subscription tiers, meal allowance, pricing, discounts, and plan availability.
              </p>
            </div>
            <Button
              onClick={() => openPlanEdit()}
              className="min-h-12 rounded-full bg-[#020617] px-5 font-black text-white shadow-none hover:bg-[#020617]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Plan
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Total Plans", value: stats.totalPlans, icon: Sparkles, color: C.protein },
            { label: "Active", value: stats.activePlans, icon: Check, color: C.progress },
            { label: "Monthly", value: stats.monthlyPlans, icon: Calendar, color: C.water },
            { label: "Avg Price", value: formatCurrency(stats.avgPrice), icon: DollarSign, color: C.fat },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-[24px] bg-white p-4 ring-1 ring-[#E5EAF1]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18`, color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black leading-none text-[#020617]">{value}</p>
                  <p className="mt-1 text-xs font-bold text-[#94A3B8]">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Card className="rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Catalog</p>
                <h2 className="text-xl font-black text-[#020617]">All plans</h2>
              </div>
              <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">
                {stats.activePlans} active
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#7C83F6]" />
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F6F8FB] px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-white text-[#7C83F6] ring-1 ring-[#E5EAF1]">
                  <Sparkles className="h-8 w-8" />
                </div>
                <p className="font-black text-[#020617]">No plans yet</p>
                <p className="mb-4 mt-1 text-sm font-semibold text-[#94A3B8]">Create your first subscription plan.</p>
                <Button onClick={() => openPlanEdit()} className="rounded-full bg-[#020617] font-black text-white shadow-none">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Plan
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((plan) => {
                  const weeklyMeals = plan.meals_per_week ?? Math.round((plan.meals_per_month || 0) / 4);
                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-[26px] bg-[#F6F8FB] p-4 ring-1 transition ${
                        plan.is_active ? "ring-[#22C7A1]/35" : "opacity-70 ring-[#E5EAF1]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleActive(plan)}
                        className="absolute right-4 top-4 rounded-full bg-white p-2 text-[#020617] ring-1 ring-[#E5EAF1]"
                        title={plan.is_active ? "Deactivate plan" : "Activate plan"}
                      >
                        {plan.is_active ? (
                          <ToggleRight className="h-6 w-6 text-[#22C7A1]" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-[#94A3B8]" />
                        )}
                      </button>

                      <div className="pr-12">
                        <Badge className={plan.is_active ? "border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]" : "border border-[#E5EAF1] bg-white text-[#94A3B8]"}>
                          {plan.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <h3 className="mt-3 text-xl font-black capitalize text-[#020617]">{planLabel(plan.tier)}</h3>
                        <p className="text-sm font-bold capitalize text-[#94A3B8]">{plan.billing_interval}</p>
                      </div>

                      <div className="mt-5 rounded-[22px] bg-white p-4 ring-1 ring-[#E5EAF1]">
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-black text-[#020617]">{formatCurrency(plan.price_qar || 0)}</span>
                          <span className="pb-1 text-xs font-bold text-[#94A3B8]">/month</span>
                        </div>
                        {plan.discount_percent && plan.discount_percent > 0 ? (
                          <p className="mt-1 text-xs font-black text-[#22C7A1]">{plan.discount_percent}% discount applied</p>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-white p-3 ring-1 ring-[#E5EAF1]">
                          <p className="text-lg font-black text-[#7C83F6]">{weeklyMeals}</p>
                          <p className="text-[10px] font-black uppercase text-[#94A3B8]">Meals/week</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3 ring-1 ring-[#E5EAF1]">
                          <p className="text-lg font-black text-[#38BDF8]">{plan.meals_per_month || 0}</p>
                          <p className="text-[10px] font-black uppercase text-[#94A3B8]">Meals/month</p>
                        </div>
                      </div>

                      {plan.features && plan.features.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {plan.features.slice(0, 4).map((feature) => (
                            <Badge key={feature} variant="outline" className="border-[#E5EAF1] bg-white text-xs font-bold text-[#64748B]">
                              {feature}
                            </Badge>
                          ))}
                          {plan.features.length > 4 && (
                            <Badge variant="outline" className="border-[#E5EAF1] bg-white text-xs font-bold text-[#94A3B8]">
                              +{plan.features.length - 4}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 border-t border-[#E5EAF1] pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none"
                          onClick={() => openPlanEdit(plan)}
                        >
                          <Edit className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 text-[#BE123C] shadow-none"
                          onClick={() => handleDeletePlan(plan.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Sheet
          open={isPlanEditOpen}
          onOpenChange={(open) => {
            setIsPlanEditOpen(open);
            if (!open) {
              setSelectedPlan(null);
              resetPlanForm();
            }
          }}
        >
          <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-md">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-2xl font-black text-[#020617]">
                {selectedPlan ? "Edit Plan" : "Create New Plan"}
              </SheetTitle>
              <SheetDescription className="font-semibold text-[#94A3B8]">
                {selectedPlan ? "Update the subscription plan details." : "Add a new subscription plan tier."}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="font-black text-[#020617]">Plan Name</Label>
                <Input
                  value={planForm.tier}
                  onChange={(event) =>
                    setPlanForm({
                      ...planForm,
                      tier: event.target.value.toLowerCase().replace(/\s+/g, "-"),
                    })
                  }
                  placeholder="e.g. gold, silver, family"
                  className="min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
                />
                <p className="text-xs font-semibold text-[#94A3B8]">
                  Each plan name + billing interval must be unique.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[#020617]">Billing Interval</Label>
                <Select
                  value={planForm.billing_interval}
                  onValueChange={(value) => setPlanForm({ ...planForm, billing_interval: value })}
                >
                  <SelectTrigger className="min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-black text-[#020617]">Price (QAR)</Label>
                  <Input
                    type="number"
                    value={planForm.price_qar}
                    onChange={(event) => setPlanForm({ ...planForm, price_qar: parseFloat(event.target.value) || 0 })}
                    className="min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-black text-[#020617]">Discount (%)</Label>
                  <Input
                    type="number"
                    value={planForm.discount_percent}
                    onChange={(event) => setPlanForm({ ...planForm, discount_percent: parseInt(event.target.value) || 0 })}
                    className="min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[#020617]">Meals per Week</Label>
                <Input
                  type="number"
                  min={0}
                  value={planForm.meals_per_week}
                  onChange={(event) => {
                    const weekly = parseInt(event.target.value) || 0;
                    setPlanForm({
                      ...planForm,
                      meals_per_week: weekly,
                      meals_per_month: weekly * 4,
                    });
                  }}
                  className="min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
                />
                {planForm.meals_per_week > 0 && (
                  <p className="text-xs font-semibold text-[#94A3B8]">
                    Around {planForm.meals_per_week * 4} meals / month
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] p-3">
                <Label className="font-black text-[#020617]">Active</Label>
                <Switch
                  checked={planForm.is_active}
                  onCheckedChange={(checked) => setPlanForm({ ...planForm, is_active: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[#020617]">Features</Label>
                <div className="flex gap-2">
                  <Input
                    value={featureInput}
                    onChange={(event) => setFeatureInput(event.target.value)}
                    placeholder="Add a feature"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addFeature();
                      }
                    }}
                    className="min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addFeature} className="h-11 w-11 rounded-full border-[#E5EAF1] bg-white shadow-none">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {planForm.features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="gap-1 rounded-full bg-[#F6F8FB] pr-1 font-bold text-[#020617]">
                      {feature}
                      <button type="button" onClick={() => removeFeature(feature)} className="rounded-full p-0.5 text-[#FB6B7A]">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-4">
                <Button
                  variant="outline"
                  className="min-h-11 rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none"
                  onClick={() => {
                    setIsPlanEditOpen(false);
                    setSelectedPlan(null);
                    resetPlanForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="min-h-11 rounded-full bg-[#020617] font-black text-white shadow-none hover:bg-[#020617]/90"
                  onClick={selectedPlan ? handleUpdatePlan : handleAddPlan}
                  disabled={processing || !planForm.tier}
                >
                  {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {selectedPlan ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;
