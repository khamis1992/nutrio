import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Crown, CreditCard, Loader2, RefreshCw, Utensils, Calendar, CheckCircle, XCircle } from "lucide-react";

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  plan_type: string | null;
  status: 'active' | 'pending' | 'cancelled' | 'expired';
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
  includes_gym: boolean | null;
  active: boolean | null;
  created_at: string;
}

interface UserSubscriptionManagerProps {
  userId: string;
  userName: string | null;
}

const AVAILABLE_TIERS = ['basic', 'standard', 'premium', 'vip'];
const AVAILABLE_PLANS = ['weekly', 'monthly'];

export function UserSubscriptionManager({ userId, userName }: UserSubscriptionManagerProps) {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [selectedPlan, setSelectedPlan] = useState<string>("weekly");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [selectedTier, setSelectedTier] = useState<string>("basic");
  const [mealsPerWeek, setMealsPerWeek] = useState<string>("5");
  const [mealsPerMonth, setMealsPerMonth] = useState<string>("20");
  const [mealsUsed, setMealsUsed] = useState<string>("0");
  const [price, setPrice] = useState<string>("99");
  const [endDate, setEndDate] = useState<string>("");
  const [includesGym, setIncludesGym] = useState<boolean>(false);

  useEffect(() => {
    fetchSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data as Subscription | null);
    } catch (err) {
      console.error("Error fetching subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    if (subscription) {
      setSelectedPlan(subscription.plan || "weekly");
      setSelectedStatus(subscription.status);
      setSelectedTier(subscription.tier || "basic");
      setMealsPerWeek((subscription.meals_per_week || 5).toString());
      setMealsPerMonth((subscription.meals_per_month || 20).toString());
      setMealsUsed((subscription.meals_used_this_month || 0).toString());
      setPrice((subscription.price || 99).toString());
      setEndDate(subscription.end_date ? subscription.end_date.split('T')[0] : "");
      setIncludesGym(subscription.includes_gym || false);
    } else {
      setSelectedPlan("weekly");
      setSelectedStatus("active");
      setSelectedTier("basic");
      setMealsPerWeek("5");
      setMealsPerMonth("20");
      setMealsUsed("0");
      setPrice("99");
      setEndDate("");
      setIncludesGym(false);
    }
    setIsEditDialogOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!subscription) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: selectedPlan,
          status: selectedStatus as 'active' | 'pending' | 'cancelled' | 'expired',
          tier: selectedTier,
          meals_per_week: parseInt(mealsPerWeek) || 5,
          meals_per_month: parseInt(mealsPerMonth) || 20,
          meals_used_this_month: parseInt(mealsUsed) || 0,
          price: parseFloat(price) || 99,
          end_date: endDate || null,
          includes_gym: includesGym,
          active: selectedStatus === 'active',
        })
        .eq("id", subscription.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subscription updated successfully",
      });
      
      setIsEditDialogOpen(false);
      fetchSubscription();
    } catch (err) {
      console.error("Error updating subscription:", err);
      toast({
        title: "Error",
        description: "Failed to update subscription",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubscription = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          plan: selectedPlan,
          plan_type: selectedPlan,
          status: selectedStatus as 'active' | 'pending' | 'cancelled' | 'expired',
          tier: selectedTier,
          meals_per_week: parseInt(mealsPerWeek) || 5,
          meals_per_month: parseInt(mealsPerMonth) || 20,
          meals_used_this_month: parseInt(mealsUsed) || 0,
          meals_used_this_week: 0,
          price: parseFloat(price) || 99,
          start_date: new Date().toISOString().split('T')[0],
          end_date: endDate || null,
          includes_gym: includesGym,
          active: selectedStatus === 'active',
          week_start_date: new Date().toISOString().split('T')[0],
          month_start_date: new Date().toISOString().split('T')[0],
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subscription created successfully",
      });
      
      setIsEditDialogOpen(false);
      fetchSubscription();
    } catch (err) {
      console.error("Error creating subscription:", err);
      toast({
        title: "Error",
        description: "Failed to create subscription",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ 
          status: 'cancelled',
          active: false 
        })
        .eq("id", subscription.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subscription cancelled successfully",
      });
      
      fetchSubscription();
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      toast({
        title: "Error",
        description: "Failed to cancel subscription",
        variant: "destructive",
      });
    }
  };

  const handleResetMeals = async () => {
    if (!subscription) return;
    
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ 
          meals_used_this_month: 0,
          meals_used_this_week: 0,
          month_start_date: new Date().toISOString().split('T')[0],
          week_start_date: new Date().toISOString().split('T')[0],
        })
        .eq("id", subscription.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Meal usage reset successfully",
      });
      
      fetchSubscription();
    } catch (err) {
      console.error("Error resetting meals:", err);
      toast({
        title: "Error",
        description: "Failed to reset meal usage",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "pending": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "cancelled": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "expired": return "bg-slate-500/10 text-slate-600 border-slate-500/20";
      default: return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    }
  };

  const getTierBadge = (tier: string | null) => {
    switch (tier) {
      case "vip": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "premium": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "standard": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      default: return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Subscription Management</span>
            <Button size="sm" onClick={handleEditClick}>
              {subscription ? "Edit Subscription" : "Create Subscription"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium capitalize">{subscription.plan}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={getStatusBadge(subscription.status)}>
                    {subscription.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tier</p>
                  <Badge className={getTierBadge(subscription.tier)}>
                    <Crown className="w-3 h-3 mr-1" />
                    {subscription.tier || 'basic'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-sm">QAR {subscription.price}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm">{format(new Date(subscription.start_date), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="text-sm">
                    {subscription.end_date 
                      ? format(new Date(subscription.end_date), "MMM d, yyyy")
                      : "No end date"
                    }
                  </p>
                </div>
              </div>

              {subscription.includes_gym && (
                <Badge variant="outline" className="bg-primary/10 text-primary">
                  Includes Gym Access
                </Badge>
              )}

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Monthly Meals</span>
                  </div>
                  <span className="text-sm">
                    {subscription.meals_used_this_month || 0} / {subscription.meals_per_month || "∞"}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ 
                      width: (subscription.meals_per_month || 0) > 0 
                        ? `${Math.min(((subscription.meals_used_this_month || 0) / (subscription.meals_per_month || 1)) * 100, 100)}%`
                        : "100%"
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Week: {subscription.meals_used_this_week || 0} / {subscription.meals_per_week || "∞"} meals used
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResetMeals}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Meals
                </Button>
                {subscription.status === 'active' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancelSubscription}
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Active Subscription</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This user doesn&apos;t have an active subscription.
              </p>
              <Button onClick={handleEditClick}>
                Create Subscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {subscription ? "Edit Subscription" : "Create Subscription"}
            </DialogTitle>
            <DialogDescription>
              {subscription 
                ? `Update subscription details for ${userName || "this user"}`
                : `Create a new subscription for ${userName || "this user"}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan Type</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan.charAt(0).toUpperCase() + plan.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={selectedTier} onValueChange={setSelectedTier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
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
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meals Per Week</Label>
                <Input
                  type="number"
                  value={mealsPerWeek}
                  onChange={(e) => setMealsPerWeek(e.target.value)}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Meals Per Month</Label>
                <Input
                  type="number"
                  value={mealsPerMonth}
                  onChange={(e) => setMealsPerMonth(e.target.value)}
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Meals Used This Month</Label>
              <Input
                type="number"
                value={mealsUsed}
                onChange={(e) => setMealsUsed(e.target.value)}
                min="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (QAR)</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="includes_gym"
                checked={includesGym}
                onChange={(e) => setIncludesGym(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="includes_gym" className="cursor-pointer">
                Includes Gym Access
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={subscription ? handleUpdateSubscription : handleCreateSubscription}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {subscription ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
