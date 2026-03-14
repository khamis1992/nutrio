import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Bell, Zap, Save, Loader2, Truck, Crown, Users, Bike, MapPin, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


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

interface DriverEarningsSettings {
  minimum_payout_threshold: number;
  default_base_earning: number;
  default_percentage: number;
  enable_distance_tiers: boolean;
  enable_city_multipliers: boolean;
  enable_restaurant_specific: boolean;
  enable_time_based_rates: boolean;
  distance_tiers: {
    short_min: number;
    short_max: number;
    short_base: number;
    medium_min: number;
    medium_max: number;
    medium_base: number;
    long_min: number;
    long_base: number;
  };
  city_rates: {
    doha_multiplier: number;
    al_wakrah_multiplier: number;
    al_khor_multiplier: number;
  };
  peak_hour_bonus: number;
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

  const [driverEarningsSettings, setDriverEarningsSettings] = useState<DriverEarningsSettings>({
    minimum_payout_threshold: 10,
    default_base_earning: 0,
    default_percentage: 80,
    enable_distance_tiers: false,
    enable_city_multipliers: false,
    enable_restaurant_specific: false,
    enable_time_based_rates: false,
    distance_tiers: {
      short_min: 0,
      short_max: 3,
      short_base: 3,
      medium_min: 3,
      medium_max: 7,
      medium_base: 5,
      long_min: 7,
      long_base: 8,
    },
    city_rates: {
      doha_multiplier: 1.0,
      al_wakrah_multiplier: 1.1,
      al_khor_multiplier: 1.2,
    },
    peak_hour_bonus: 0,
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
          case "affiliate_settings":
            setAffiliateSettings(value as unknown as AffiliateSettings);
            break;
          case "driver_settings":
            setDriverEarningsSettings(value as unknown as DriverEarningsSettings);
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
        { key: "commission_rates", value: commissionRates },
        { key: "features", value: features },
        { key: "notifications", value: notifications },
        { key: "featured_listing_prices", value: featuredPrices },
        { key: "delivery_fees", value: deliveryFees },
        { key: "premium_analytics_prices", value: premiumAnalyticsPrices },
        { key: "affiliate_settings", value: affiliateSettings },
        { key: "driver_settings", value: driverEarningsSettings },
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
                Default Commission Rates
              </CardTitle>
              <CardDescription>
                Default rates for new restaurants. You can override these per restaurant from the{" "}
                <Link to="/admin/restaurants" className="text-primary underline underline-offset-2 hover:text-primary/80">
                  Restaurant Management
                </Link>{" "}
                page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant-commission">Default Restaurant Commission (%)</Label>
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
                <p className="text-xs text-muted-foreground">Applied to new restaurants. Each restaurant can have its own rate.</p>
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

          {/* Featured Listing Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Featured Listing Pricing
              </CardTitle>
              <CardDescription>Configure prices for restaurant boost packages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weekly-price">Weekly Boost (QAR)</Label>
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
                <Label htmlFor="biweekly-price">Bi-Weekly Boost (QAR)</Label>
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
                <Label htmlFor="monthly-price">Monthly Boost (QAR)</Label>
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
                <Label htmlFor="standard-delivery">Standard Delivery (QAR)</Label>
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
                <Label htmlFor="express-delivery">Express Delivery (QAR)</Label>
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
                <Label htmlFor="free-threshold">Free Delivery Threshold (QAR)</Label>
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

          {/* Driver Earnings Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bike className="h-5 w-5 text-primary" />
                Driver Earnings Settings
              </CardTitle>
              <CardDescription>Configure how drivers earn per delivery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Global Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Global Default</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver-base-earning">Base Earning per Order (QAR)</Label>
                    <Input
                      id="driver-base-earning"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={driverEarningsSettings.default_base_earning}
                      onChange={(e) =>
                        setDriverEarningsSettings({ 
                          ...driverEarningsSettings, 
                          default_base_earning: Number(e.target.value) 
                        })
                      }
                      className="h-12 sm:h-10 min-h-[44px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Fixed amount added to every order
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-percentage">Percentage of Delivery Fee (%)</Label>
                    <Input
                      id="driver-percentage"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      value={driverEarningsSettings.default_percentage}
                      onChange={(e) =>
                        setDriverEarningsSettings({ 
                          ...driverEarningsSettings, 
                          default_percentage: Number(e.target.value) 
                        })
                      }
                      className="h-12 sm:h-10 min-h-[44px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Driver receives this % of delivery fee + 100% of tips
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Minimum Payout */}
              <div className="space-y-2">
                <Label htmlFor="min-payout">Minimum Payout Threshold (QAR)</Label>
                <Input
                  id="min-payout"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={driverEarningsSettings.minimum_payout_threshold}
                  onChange={(e) =>
                    setDriverEarningsSettings({ 
                      ...driverEarningsSettings, 
                      minimum_payout_threshold: Number(e.target.value) 
                    })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum balance required before driver can request payout
                </p>
              </div>

              <Separator />

              {/* Advanced Earnings Features */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Advanced Earnings Features</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Enable Distance Tiers
                    </Label>
                    <p className="text-sm text-muted-foreground">Pay different rates based on delivery distance</p>
                  </div>
                  <Switch
                    checked={driverEarningsSettings.enable_distance_tiers}
                    onCheckedChange={(checked) =>
                      setDriverEarningsSettings({ 
                        ...driverEarningsSettings, 
                        enable_distance_tiers: checked 
                      })
                    }
                  />
                </div>

                {driverEarningsSettings.enable_distance_tiers && (
                  <div className="pl-4 border-l-2 border-muted space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Short (0-3km)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={driverEarningsSettings.distance_tiers.short_base}
                          onChange={(e) =>
                            setDriverEarningsSettings({
                              ...driverEarningsSettings,
                              distance_tiers: {
                                ...driverEarningsSettings.distance_tiers,
                                short_base: Number(e.target.value),
                              },
                            })
                          }
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Medium (3-7km)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={driverEarningsSettings.distance_tiers.medium_base}
                          onChange={(e) =>
                            setDriverEarningsSettings({
                              ...driverEarningsSettings,
                              distance_tiers: {
                                ...driverEarningsSettings.distance_tiers,
                                medium_base: Number(e.target.value),
                              },
                            })
                          }
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Long (7km+)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={driverEarningsSettings.distance_tiers.long_base}
                          onChange={(e) =>
                            setDriverEarningsSettings({
                              ...driverEarningsSettings,
                              distance_tiers: {
                                ...driverEarningsSettings.distance_tiers,
                                long_base: Number(e.target.value),
                              },
                            })
                          }
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Enable City Multipliers
                    </Label>
                    <p className="text-sm text-muted-foreground">Different rates for different cities</p>
                  </div>
                  <Switch
                    checked={driverEarningsSettings.enable_city_multipliers}
                    onCheckedChange={(checked) =>
                      setDriverEarningsSettings({ 
                        ...driverEarningsSettings, 
                        enable_city_multipliers: checked 
                      })
                    }
                  />
                </div>

                {driverEarningsSettings.enable_city_multipliers && (
                  <div className="pl-4 border-l-2 border-muted space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Doha Multiplier</Label>
                        <Input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={driverEarningsSettings.city_rates.doha_multiplier}
                          onChange={(e) =>
                            setDriverEarningsSettings({
                              ...driverEarningsSettings,
                              city_rates: {
                                ...driverEarningsSettings.city_rates,
                                doha_multiplier: Number(e.target.value),
                              },
                            })
                          }
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Al Wakrah</Label>
                        <Input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={driverEarningsSettings.city_rates.al_wakrah_multiplier}
                          onChange={(e) =>
                            setDriverEarningsSettings({
                              ...driverEarningsSettings,
                              city_rates: {
                                ...driverEarningsSettings.city_rates,
                                al_wakrah_multiplier: Number(e.target.value),
                              },
                            })
                          }
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Al Khor</Label>
                        <Input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={driverEarningsSettings.city_rates.al_khor_multiplier}
                          onChange={(e) =>
                            setDriverEarningsSettings({
                              ...driverEarningsSettings,
                              city_rates: {
                                ...driverEarningsSettings.city_rates,
                                al_khor_multiplier: Number(e.target.value),
                              },
                            })
                          }
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Restaurant-Specific Rates
                    </Label>
                    <p className="text-sm text-muted-foreground">Allow custom rates per restaurant</p>
                  </div>
                  <Switch
                    checked={driverEarningsSettings.enable_restaurant_specific}
                    onCheckedChange={(checked) =>
                      setDriverEarningsSettings({ 
                        ...driverEarningsSettings, 
                        enable_restaurant_specific: checked 
                      })
                    }
                  />
                </div>

                {driverEarningsSettings.enable_restaurant_specific && (
                  <div className="pl-4 border-l-2 border-muted">
                    <p className="text-sm text-muted-foreground">
                      Restaurant-specific rates can be configured in the restaurant detail page.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Peak Hour Bonus */}
              <div className="space-y-2">
                <Label htmlFor="peak-bonus">Peak Hour Bonus (QAR)</Label>
                <Input
                  id="peak-bonus"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={driverEarningsSettings.peak_hour_bonus}
                  onChange={(e) =>
                    setDriverEarningsSettings({ 
                      ...driverEarningsSettings, 
                      peak_hour_bonus: Number(e.target.value) 
                    })
                  }
                  className="h-12 sm:h-10 min-h-[44px]"
                />
                <p className="text-xs text-muted-foreground">
                  Extra amount added during peak hours (lunch 11am-2pm, dinner 6pm-9pm)
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
                <Label htmlFor="analytics-monthly">Monthly Price (QAR)</Label>
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
                <Label htmlFor="analytics-quarterly">Quarterly Price (QAR)</Label>
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
                <Label htmlFor="analytics-yearly">Yearly Price (QAR)</Label>
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
                <Label>Min Payout Threshold (QAR)</Label>
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
