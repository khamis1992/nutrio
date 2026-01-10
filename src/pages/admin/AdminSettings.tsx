import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, DollarSign, Bell, Zap, Save, Loader2, Sparkles, Truck, Crown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface CommissionRates {
  [key: string]: number;
  restaurant: number;
  delivery: number;
}

interface Features {
  [key: string]: boolean;
  referral_program: boolean;
  meal_scheduling: boolean;
  subscription_pause: boolean;
  delivery_tracking: boolean;
}

interface SubscriptionPlans {
  [key: string]: number;
  basic_price: number;
  premium_price: number;
  family_price: number;
}

interface NotificationSettings {
  [key: string]: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
}

interface FeaturedListingPrices {
  [key: string]: number;
  weekly: number;
  biweekly: number;
  monthly: number;
}

interface DeliveryFeeSettings {
  [key: string]: number | boolean;
  standard: number;
  express: number;
  free_threshold: number;
  enabled: boolean;
}

interface PremiumAnalyticsPrices {
  [key: string]: number;
  monthly: number;
  quarterly: number;
  yearly: number;
}

interface VipSettings {
  vip_price: number;
  vip_discount_percent: number;
  vip_benefits: {
    priority_delivery: boolean;
    exclusive_meals: boolean;
    personal_coaching: boolean;
    free_delivery: boolean;
    early_access: boolean;
    dedicated_support: boolean;
    meal_discounts: boolean;
  };
}

interface AffiliateSettings {
  enabled: boolean;
  tier1_commission: number;
  tier2_commission: number;
  tier3_commission: number;
  min_payout_threshold: number;
  bonus_first_referral: number;
  bonus_milestone_10: number;
  bonus_milestone_25: number;
  bonus_milestone_50: number;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [commissionRates, setCommissionRates] = useState<CommissionRates>({
    restaurant: 15,
    delivery: 5,
  });
  
  const [features, setFeatures] = useState<Features>({
    referral_program: true,
    meal_scheduling: true,
    subscription_pause: true,
    delivery_tracking: true,
  });
  
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlans>({
    basic_price: 49.99,
    premium_price: 99.99,
    family_price: 149.99,
  });
  
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
  });

  const [featuredPrices, setFeaturedPrices] = useState<FeaturedListingPrices>({
    weekly: 49,
    biweekly: 89,
    monthly: 149,
  });

  const [deliveryFees, setDeliveryFees] = useState<DeliveryFeeSettings>({
    standard: 3.99,
    express: 6.99,
    free_threshold: 50,
    enabled: true,
  });

  const [premiumAnalyticsPrices, setPremiumAnalyticsPrices] = useState<PremiumAnalyticsPrices>({
    monthly: 29.99,
    quarterly: 74.99,
    yearly: 249.99,
  });

  const [vipSettings, setVipSettings] = useState<VipSettings>({
    vip_price: 199.99,
    vip_discount_percent: 15,
    vip_benefits: {
      priority_delivery: true,
      exclusive_meals: true,
      personal_coaching: true,
      free_delivery: true,
      early_access: true,
      dedicated_support: true,
      meal_discounts: true,
    },
  });

  const [affiliateSettings, setAffiliateSettings] = useState<AffiliateSettings>({
    enabled: true,
    tier1_commission: 10,
    tier2_commission: 5,
    tier3_commission: 2,
    min_payout_threshold: 25,
    bonus_first_referral: 5,
    bonus_milestone_10: 20,
    bonus_milestone_25: 50,
    bonus_milestone_50: 100,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*");

      if (error) throw error;

      data?.forEach((setting) => {
        const value = setting.value as Record<string, unknown>;
        switch (setting.key) {
          case "commission_rates":
            setCommissionRates(value as unknown as CommissionRates);
            break;
          case "features":
            setFeatures(value as unknown as Features);
            break;
          case "subscription_plans":
            setSubscriptionPlans(value as unknown as SubscriptionPlans);
            break;
          case "notifications":
            setNotifications(value as unknown as NotificationSettings);
            break;
          case "featured_listing_prices":
            setFeaturedPrices(value as unknown as FeaturedListingPrices);
            break;
          case "delivery_fees":
            setDeliveryFees(value as unknown as DeliveryFeeSettings);
            break;
          case "premium_analytics_prices":
            setPremiumAnalyticsPrices(value as unknown as PremiumAnalyticsPrices);
            break;
          case "vip_settings":
            setVipSettings(value as unknown as VipSettings);
            break;
          case "affiliate_settings":
            setAffiliateSettings(value as unknown as AffiliateSettings);
            break;
        }
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "commission_rates", value: commissionRates as Json },
        { key: "features", value: features as Json },
        { key: "subscription_plans", value: subscriptionPlans as Json },
        { key: "notifications", value: notifications as Json },
        { key: "featured_listing_prices", value: featuredPrices as Json },
        { key: "delivery_fees", value: deliveryFees as Json },
        { key: "premium_analytics_prices", value: premiumAnalyticsPrices as Json },
        { key: "vip_settings", value: vipSettings as unknown as Json },
        { key: "affiliate_settings", value: affiliateSettings as unknown as Json },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("platform_settings")
          .update({ value: update.value })
          .eq("key", update.key);

        if (error) throw error;
      }

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Platform Settings</h1>
            <p className="text-muted-foreground">Configure platform-wide settings and features</p>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
          {/* Commission Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Commission Rates
              </CardTitle>
              <CardDescription>Set commission percentages for transactions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant-commission">Restaurant Commission (%)</Label>
                <Input
                  id="restaurant-commission"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  value={commissionRates.restaurant}
                  onChange={(e) =>
                    setCommissionRates({ ...commissionRates, restaurant: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery-commission">Delivery Commission (%)</Label>
                <Input
                  id="delivery-commission"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  value={commissionRates.delivery}
                  onChange={(e) =>
                    setCommissionRates({ ...commissionRates, delivery: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Subscription Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Subscription Pricing
              </CardTitle>
              <CardDescription>Configure subscription plan prices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="basic-price">Basic Plan Price ($)</Label>
                <Input
                  id="basic-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={subscriptionPlans.basic_price}
                  onChange={(e) =>
                    setSubscriptionPlans({ ...subscriptionPlans, basic_price: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-price">Premium Plan Price ($)</Label>
                <Input
                  id="premium-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={subscriptionPlans.premium_price}
                  onChange={(e) =>
                    setSubscriptionPlans({ ...subscriptionPlans, premium_price: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="family-price">Family Plan Price ($)</Label>
                <Input
                  id="family-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={subscriptionPlans.family_price}
                  onChange={(e) =>
                    setSubscriptionPlans({ ...subscriptionPlans, family_price: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* VIP Subscription Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-violet-500" />
                VIP Subscription Tier
              </CardTitle>
              <CardDescription>Configure VIP Elite subscription pricing and benefits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vip-price">VIP Elite Price ($/week)</Label>
                <Input
                  id="vip-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={vipSettings.vip_price}
                  onChange={(e) =>
                    setVipSettings({ ...vipSettings, vip_price: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vip-discount">VIP Meal Discount (%)</Label>
                <Input
                  id="vip-discount"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  step="1"
                  value={vipSettings.vip_discount_percent}
                  onChange={(e) =>
                    setVipSettings({ ...vipSettings, vip_discount_percent: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
                <p className="text-xs text-muted-foreground">Discount applied to all meals for VIP subscribers</p>
              </div>
              <Separator />
              <p className="text-sm font-medium">VIP Benefits</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(vipSettings.vip_benefits).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) =>
                        setVipSettings({
                          ...vipSettings,
                          vip_benefits: { ...vipSettings.vip_benefits, [key]: checked }
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Featured Listing Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Featured Listing Pricing
              </CardTitle>
              <CardDescription>Configure prices for restaurant boost packages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weekly-price">Weekly Boost ($)</Label>
                <Input
                  id="weekly-price"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={featuredPrices.weekly}
                  onChange={(e) =>
                    setFeaturedPrices({ ...featuredPrices, weekly: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biweekly-price">Bi-Weekly Boost ($)</Label>
                <Input
                  id="biweekly-price"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={featuredPrices.biweekly}
                  onChange={(e) =>
                    setFeaturedPrices({ ...featuredPrices, biweekly: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly-price">Monthly Boost ($)</Label>
                <Input
                  id="monthly-price"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={featuredPrices.monthly}
                  onChange={(e) =>
                    setFeaturedPrices({ ...featuredPrices, monthly: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Feature Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Feature Toggles
              </CardTitle>
              <CardDescription>Enable or disable platform features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Referral Program</Label>
                  <p className="text-sm text-muted-foreground">Allow users to refer friends</p>
                </div>
                <Switch
                  checked={features.referral_program}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, referral_program: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Meal Scheduling</Label>
                  <p className="text-sm text-muted-foreground">Enable advance meal scheduling</p>
                </div>
                <Switch
                  checked={features.meal_scheduling}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, meal_scheduling: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Subscription Pause</Label>
                  <p className="text-sm text-muted-foreground">Allow users to pause subscriptions</p>
                </div>
                <Switch
                  checked={features.subscription_pause}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, subscription_pause: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Delivery Tracking</Label>
                  <p className="text-sm text-muted-foreground">Enable real-time delivery tracking</p>
                </div>
                <Switch
                  checked={features.delivery_tracking}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, delivery_tracking: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Delivery Fee Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Delivery Fee Settings
              </CardTitle>
              <CardDescription>Configure delivery fees for customer orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Delivery Fees</Label>
                  <p className="text-sm text-muted-foreground">Charge customers for delivery</p>
                </div>
                <Switch
                  checked={deliveryFees.enabled}
                  onCheckedChange={(checked) =>
                    setDeliveryFees({ ...deliveryFees, enabled: checked })
                  }
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="standard-delivery">Standard Delivery ($)</Label>
                <Input
                  id="standard-delivery"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={deliveryFees.standard}
                  onChange={(e) =>
                    setDeliveryFees({ ...deliveryFees, standard: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="express-delivery">Express Delivery ($)</Label>
                <Input
                  id="express-delivery"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={deliveryFees.express}
                  onChange={(e) =>
                    setDeliveryFees({ ...deliveryFees, express: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="free-threshold">Free Delivery Threshold ($)</Label>
                <Input
                  id="free-threshold"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={deliveryFees.free_threshold}
                  onChange={(e) =>
                    setDeliveryFees({ ...deliveryFees, free_threshold: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
                <p className="text-xs text-muted-foreground">
                  Orders over this amount get free delivery
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Premium Analytics Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Premium Analytics Pricing
              </CardTitle>
              <CardDescription>Configure pricing for partner premium analytics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="analytics-monthly">Monthly Price ($)</Label>
                <Input
                  id="analytics-monthly"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={premiumAnalyticsPrices.monthly}
                  onChange={(e) =>
                    setPremiumAnalyticsPrices({ ...premiumAnalyticsPrices, monthly: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="analytics-quarterly">Quarterly Price ($)</Label>
                <Input
                  id="analytics-quarterly"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={premiumAnalyticsPrices.quarterly}
                  onChange={(e) =>
                    setPremiumAnalyticsPrices({ ...premiumAnalyticsPrices, quarterly: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="analytics-yearly">Yearly Price ($)</Label>
                <Input
                  id="analytics-yearly"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={premiumAnalyticsPrices.yearly}
                  onChange={(e) =>
                    setPremiumAnalyticsPrices({ ...premiumAnalyticsPrices, yearly: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Affiliate/MLM Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-500" />
                Affiliate Program Settings
              </CardTitle>
              <CardDescription>Configure multi-tier affiliate commissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Affiliate Program</Label>
                  <p className="text-sm text-muted-foreground">Allow users to earn commissions</p>
                </div>
                <Switch
                  checked={affiliateSettings.enabled}
                  onCheckedChange={(checked) =>
                    setAffiliateSettings({ ...affiliateSettings, enabled: checked })
                  }
                />
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tier 1 (%)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    value={affiliateSettings.tier1_commission}
                    onChange={(e) =>
                      setAffiliateSettings({ ...affiliateSettings, tier1_commission: Number(e.target.value) })
                    }
                    className="h-12 sm:h-10 min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tier 2 (%)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    value={affiliateSettings.tier2_commission}
                    onChange={(e) =>
                      setAffiliateSettings({ ...affiliateSettings, tier2_commission: Number(e.target.value) })
                    }
                    className="h-12 sm:h-10 min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tier 3 (%)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    value={affiliateSettings.tier3_commission}
                    onChange={(e) =>
                      setAffiliateSettings({ ...affiliateSettings, tier3_commission: Number(e.target.value) })
                    }
                    className="h-12 sm:h-10 min-h-[44px]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Min Payout Threshold ($)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={affiliateSettings.min_payout_threshold}
                  onChange={(e) =>
                    setAffiliateSettings({ ...affiliateSettings, min_payout_threshold: Number(e.target.value) })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Settings
              </CardTitle>
              <CardDescription>Configure notification channels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications via email</p>
                </div>
                <Switch
                  checked={notifications.email_enabled}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email_enabled: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send browser push notifications</p>
                </div>
                <Switch
                  checked={notifications.push_enabled}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, push_enabled: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications via SMS</p>
                </div>
                <Switch
                  checked={notifications.sms_enabled}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, sms_enabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
