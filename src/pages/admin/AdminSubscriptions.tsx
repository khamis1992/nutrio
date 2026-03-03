import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Loader2,
  DollarSign,
  Calendar,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
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

const AdminSubscriptions = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlanEditOpen, setIsPlanEditOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form state
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

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_qar", { ascending: true });

      if (error) throw error;

      if (data) {
        const formattedPlans: SubscriptionPlan[] = data.map((p) => ({
          id: p.id,
          tier: p.tier,
          billing_interval: p.billing_interval,
          price_qar: p.price_qar,
          meals_per_week: (p as any).meals_per_week ?? null,
          meals_per_month: p.meals_per_month,
          discount_percent: p.discount_percent,
          features: p.features as string[] | null,
          is_active: p.is_active,
          created_at: p.created_at,
        }));
        setPlans(formattedPlans);
      }
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

  const addFeature = () => {
    if (featureInput.trim() && !planForm.features.includes(featureInput.trim())) {
      setPlanForm({
        ...planForm,
        features: [...planForm.features, featureInput.trim()],
      });
      setFeatureInput("");
    }
  };

  const removeFeature = (feature: string) => {
    setPlanForm({
      ...planForm,
      features: planForm.features.filter((f) => f !== feature),
    });
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

      toast({
        title: "Success",
        description: "Plan created successfully",
      });

      fetchPlans();
      setIsPlanEditOpen(false);
      resetPlanForm();
    } catch (error: any) {
      const isDuplicate = error?.message?.includes("unique") || error?.code === "23505";
      toast({
        title: "Error",
        description: isDuplicate
          ? `A ${planForm.tier} / ${planForm.billing_interval} plan already exists. Choose a different tier or billing interval.`
          : error?.message || "Failed to create plan",
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

      toast({
        title: "Success",
        description: "Plan updated successfully",
      });

      fetchPlans();
      setIsPlanEditOpen(false);
      setSelectedPlan(null);
      resetPlanForm();
    } catch (error) {
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
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    const confirmed = confirm(
      `Are you sure you want to permanently delete "${plan.tier}" plan? This cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      // First, try to delete the plan directly
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", planId);

      if (error) {
        // If delete fails due to foreign key, offer to deactivate instead
        const deactivateConfirm = confirm(
          `Cannot delete "${plan.tier}" plan because it has subscriptions using it.\n\nWould you like to deactivate it instead?`
        );
        
        if (deactivateConfirm) {
          const { error: deactivateError } = await supabase
            .from("subscription_plans")
            .update({ is_active: false })
            .eq("id", planId);

          if (deactivateError) throw deactivateError;

          toast({
            title: "Plan Deactivated",
            description: `"${plan.tier}" plan has been deactivated instead of deleted`,
          });
          fetchPlans();
          return;
        }
        return; // User cancelled
      }

      toast({
        title: "Success",
        description: `"${plan.tier}" plan has been deleted`,
      });

      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete plan",
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
        description: `${plan.tier} plan is now ${plan.is_active ? "inactive" : "active"}`,
      });

      fetchPlans();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update plan status",
        variant: "destructive",
      });
    }
  };

  // Calculate stats
  const stats = {
    totalPlans: plans.length,
    activePlans: plans.filter((p) => p.is_active).length,
    monthlyPlans: plans.filter((p) => p.billing_interval === "monthly").length,
    annualPlans: plans.filter((p) => p.billing_interval === "annual").length,
    avgPrice: plans.length > 0
      ? plans.reduce((acc, p) => acc + (p.price_qar || 0), 0) / plans.length
      : 0,
  };

  return (
    <AdminLayout
      title="Subscription Plans"
      subtitle={`${stats.activePlans} active plans`}
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalPlans}</p>
                  <p className="text-xs text-muted-foreground">Total Plans</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Check className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activePlans}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.monthlyPlans}</p>
                  <p className="text-xs text-muted-foreground">Monthly</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500/5 to-violet-500/10 border-violet-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.avgPrice)}</p>
                  <p className="text-xs text-muted-foreground">Avg Price</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">All Plans</CardTitle>
            <Button onClick={() => openPlanEdit()} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Plan
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">No plans yet</p>
                <p className="text-sm text-muted-foreground/70 mb-4">
                  Create your first subscription plan
                </p>
                <Button onClick={() => openPlanEdit()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Plan
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border-2 p-5 transition-all ${
                      plan.is_active
                        ? "border-primary/30 bg-card hover:border-primary/50"
                        : "border-muted bg-muted/30 opacity-70"
                    }`}
                  >
                    {/* Status Toggle */}
                    <button
                      onClick={() => handleToggleActive(plan)}
                      className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                      title={plan.is_active ? "Deactivate plan" : "Activate plan"}
                    >
                      {plan.is_active ? (
                        <ToggleRight className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="h-6 w-6" />
                      )}
                    </button>

                    {/* Plan Header */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`capitalize ${
                            plan.is_active
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {plan.tier.replace(/-/g, " ")}
                        </Badge>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {plan.billing_interval}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">
                          {formatCurrency(plan.price_qar || 0)}
                        </span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                      {plan.discount_percent && plan.discount_percent > 0 && (
                        <p className="text-xs text-emerald-600 font-medium mt-1">
                          {plan.discount_percent}% discount applied
                        </p>
                      )}
                    </div>

                    {/* Plan Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Meals/week</span>
                        <span className="font-medium">{plan.meals_per_week ?? Math.round((plan.meals_per_month || 0) / 4)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Meals/month</span>
                        <span className="font-medium">{plan.meals_per_month || 0}</span>
                      </div>
                      {plan.features && plan.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {plan.features.slice(0, 3).map((feature, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs bg-muted/50"
                            >
                              {feature}
                            </Badge>
                          ))}
                          {plan.features.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{plan.features.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openPlanEdit(plan)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeletePlan(plan.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Edit Sheet */}
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
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader className="pb-4">
              <SheetTitle>
                {selectedPlan ? "Edit Plan" : "Create New Plan"}
              </SheetTitle>
              <SheetDescription>
                {selectedPlan
                  ? "Update the subscription plan details"
                  : "Add a new subscription plan tier"}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 py-4">
              {/* Plan Name / Tier */}
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  value={planForm.tier}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      tier: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    })
                  }
                  placeholder="e.g. gold, silver, family, student"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters and hyphens only. Each plan name + billing interval must be unique.
                </p>
              </div>

              {/* Billing Interval */}
              <div className="space-y-2">
                <Label>Billing Interval</Label>
                <Select
                  value={planForm.billing_interval}
                  onValueChange={(v) =>
                    setPlanForm({ ...planForm, billing_interval: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label>Price (QAR)</Label>
                <Input
                  type="number"
                  value={planForm.price_qar}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      price_qar: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                />
              </div>

              {/* Meals per Week */}
              <div className="space-y-2">
                <Label>Meals per Week</Label>
                <Input
                  type="number"
                  min={0}
                  value={planForm.meals_per_week}
                  onChange={(e) => {
                    const weekly = parseInt(e.target.value) || 0;
                    setPlanForm({
                      ...planForm,
                      meals_per_week: weekly,
                      meals_per_month: weekly * 4,
                    });
                  }}
                  placeholder="e.g. 5"
                />
                {planForm.meals_per_week > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ≈ {planForm.meals_per_week * 4} meals / month
                  </p>
                )}
              </div>

              {/* Discount */}
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input
                  type="number"
                  value={planForm.discount_percent}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      discount_percent: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={planForm.is_active}
                  onCheckedChange={(checked) =>
                    setPlanForm({ ...planForm, is_active: checked })
                  }
                />
              </div>

              {/* Features */}
              <div className="space-y-2">
                <Label>Features</Label>
                <div className="flex gap-2">
                  <Input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    placeholder="Add a feature"
                    onKeyPress={(e) => e.key === "Enter" && addFeature()}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addFeature}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {planForm.features.map((feature) => (
                    <Badge
                      key={feature}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(feature)}
                        className="hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsPlanEditOpen(false);
                    setSelectedPlan(null);
                    resetPlanForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={selectedPlan ? handleUpdatePlan : handleAddPlan}
                  disabled={processing || !planForm.tier}
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {selectedPlan ? "Save Changes" : "Create Plan"}
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
