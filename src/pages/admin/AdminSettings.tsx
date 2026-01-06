import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, DollarSign, Bell, Zap, Save, Loader2, Sparkles } from "lucide-react";
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

        <div className="grid gap-6 md:grid-cols-2">
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
                  min="0"
                  max="100"
                  value={commissionRates.restaurant}
                  onChange={(e) =>
                    setCommissionRates({ ...commissionRates, restaurant: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery-commission">Delivery Commission (%)</Label>
                <Input
                  id="delivery-commission"
                  type="number"
                  min="0"
                  max="100"
                  value={commissionRates.delivery}
                  onChange={(e) =>
                    setCommissionRates({ ...commissionRates, delivery: Number(e.target.value) })
                  }
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
                  min="0"
                  step="0.01"
                  value={subscriptionPlans.basic_price}
                  onChange={(e) =>
                    setSubscriptionPlans({ ...subscriptionPlans, basic_price: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-price">Premium Plan Price ($)</Label>
                <Input
                  id="premium-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={subscriptionPlans.premium_price}
                  onChange={(e) =>
                    setSubscriptionPlans({ ...subscriptionPlans, premium_price: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="family-price">Family Plan Price ($)</Label>
                <Input
                  id="family-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={subscriptionPlans.family_price}
                  onChange={(e) =>
                    setSubscriptionPlans({ ...subscriptionPlans, family_price: Number(e.target.value) })
                  }
                />
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
                  min="0"
                  step="1"
                  value={featuredPrices.weekly}
                  onChange={(e) =>
                    setFeaturedPrices({ ...featuredPrices, weekly: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biweekly-price">Bi-Weekly Boost ($)</Label>
                <Input
                  id="biweekly-price"
                  type="number"
                  min="0"
                  step="1"
                  value={featuredPrices.biweekly}
                  onChange={(e) =>
                    setFeaturedPrices({ ...featuredPrices, biweekly: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly-price">Monthly Boost ($)</Label>
                <Input
                  id="monthly-price"
                  type="number"
                  min="0"
                  step="1"
                  value={featuredPrices.monthly}
                  onChange={(e) =>
                    setFeaturedPrices({ ...featuredPrices, monthly: Number(e.target.value) })
                  }
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

          {/* Notification Settings */}
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
