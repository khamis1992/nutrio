import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Clock, Mail, Smartphone, Check, X, Crown, Pause, Play, AlertTriangle, Loader2, HelpCircle, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { AdaptiveGoalsSettings } from "@/components/AdaptiveGoalsSettings";
import { supabase } from "@/integrations/supabase/client";

interface NotificationPreferences {
  id: string;
  user_id: string;
  push_notifications: boolean;
  email_notifications: boolean;
  meal_reminders: boolean;
  order_updates: boolean;
  promotional_emails: boolean;
  weekly_summary: boolean;
  reminder_time: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { subscription, hasActiveSubscription, isPaused, pauseSubscription, resumeSubscription, refetch: refetchSubscription } = useSubscription();
  const { settings: platformSettings, loading: settingsLoading } = usePlatformSettings();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pausingSubscription, setPausingSubscription] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch notification preferences
      const { data: notifData, error: notifError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (notifError) throw notifError;

      if (notifData) {
        setNotificationPrefs(notifData);
      } else {
        // Create default preferences
        const { data: newPrefs, error: createError } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
            push_notifications: true,
            email_notifications: true,
            meal_reminders: true,
            order_updates: true,
            promotional_emails: false,
            weekly_summary: true,
            reminder_time: "08:00:00"
          })
          .select()
          .single();

        if (createError) throw createError;
        setNotificationPrefs(newPrefs);
      }

    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationPref = async (key: keyof NotificationPreferences, value: boolean | string) => {
    if (!user || !notificationPrefs) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("notification_preferences")
        .update({ [key]: value })
        .eq("user_id", user.id);

      if (error) throw error;

      setNotificationPrefs(prev => prev ? { ...prev, [key]: value } : null);
      
      toast({
        title: "Saved",
        description: "Notification preferences updated"
      });
    } catch (error) {
      console.error("Error updating notification pref:", error);
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const reminderTimeOptions = [
    { value: "06:00:00", label: "6:00 AM" },
    { value: "07:00:00", label: "7:00 AM" },
    { value: "08:00:00", label: "8:00 AM" },
    { value: "09:00:00", label: "9:00 AM" },
    { value: "10:00:00", label: "10:00 AM" },
    { value: "12:00:00", label: "12:00 PM" },
    { value: "18:00:00", label: "6:00 PM" },
    { value: "20:00:00", label: "8:00 PM" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Subscription Management */}
        {(subscription && platformSettings.features.subscription_pause) && (
          <Card className={isPaused ? "border-amber-500/30 bg-amber-500/5" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Subscription
              </CardTitle>
              <CardDescription>
                Manage your subscription settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">{subscription.plan} Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {isPaused ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Pause className="h-3 w-3" />
                        Subscription paused
                      </span>
                    ) : (
                      `Renews on ${new Date(subscription.end_date).toLocaleDateString()}`
                    )}
                  </p>
                </div>
                <Badge variant={isPaused ? "outline" : "default"} className={isPaused ? "border-amber-500 text-amber-600" : ""}>
                  {isPaused ? "Paused" : "Active"}
                </Badge>
              </div>

              {isPaused ? (
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-600">Subscription Paused</p>
                      <p className="text-sm text-muted-foreground">
                        You won't be charged and can't order meals while paused. Resume anytime to continue.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2">
                {isPaused ? (
                  <Button 
                    onClick={async () => {
                      setPausingSubscription(true);
                      const success = await resumeSubscription();
                      setPausingSubscription(false);
                      if (success) {
                        toast({
                          title: "Subscription Resumed",
                          description: "Your subscription is now active again.",
                        });
                      } else {
                        toast({
                          title: "Error",
                          description: "Failed to resume subscription. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={pausingSubscription}
                    className="flex-1"
                  >
                    {pausingSubscription ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Resume Subscription
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Pause className="h-4 w-4 mr-2" />
                        Pause Subscription
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Pause your subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                          While paused, you won't be charged and won't be able to order meals.
                          You can resume your subscription at any time.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            setPausingSubscription(true);
                            const success = await pauseSubscription();
                            setPausingSubscription(false);
                            if (success) {
                              toast({
                                title: "Subscription Paused",
                                description: "Your subscription has been paused. Resume anytime.",
                              });
                            } else {
                              toast({
                                title: "Error",
                                description: "Failed to pause subscription. Please try again.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Pause Subscription
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button variant="ghost" onClick={() => navigate("/subscription")}>
                  Change Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Adaptive Goals Settings */}
        <AdaptiveGoalsSettings />

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Manage how and when you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Push Notifications */}
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-3 flex-1">
                <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label htmlFor="push" className="cursor-pointer">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications on your device
                  </p>
                </div>
              </div>
              <Switch
                id="push"
                checked={notificationPrefs?.push_notifications ?? true}
                onCheckedChange={(checked) => updateNotificationPref("push_notifications", checked)}
                disabled={saving}
              />
            </div>

            {/* Email Notifications */}
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-3 flex-1">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label htmlFor="email" className="cursor-pointer">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive important updates via email
                  </p>
                </div>
              </div>
              <Switch
                id="email"
                checked={notificationPrefs?.email_notifications ?? true}
                onCheckedChange={(checked) => updateNotificationPref("email_notifications", checked)}
                disabled={saving}
              />
            </div>

            {/* Meal Reminders */}
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-3 flex-1">
                <Utensils className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label htmlFor="reminders" className="cursor-pointer">Meal Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get reminded about scheduled meals
                  </p>
                </div>
              </div>
              <Switch
                id="reminders"
                checked={notificationPrefs?.meal_reminders ?? true}
                onCheckedChange={(checked) => updateNotificationPref("meal_reminders", checked)}
                disabled={saving}
              />
            </div>

            {/* Reminder Time */}
            {notificationPrefs?.meal_reminders && (
              <div className="flex items-center justify-between pl-7 min-h-[44px]">
                <div className="flex items-center gap-3 flex-1">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <Label htmlFor="reminder-time" className="cursor-pointer">Reminder Time</Label>
                    <p className="text-sm text-muted-foreground">
                      When to send meal reminders
                    </p>
                  </div>
                </div>
                <Select
                  value={notificationPrefs?.reminder_time || "08:00:00"}
                  onValueChange={(value) => updateNotificationPref("reminder_time", value)}
                  disabled={saving}
                >
                  <SelectTrigger className="w-32 min-h-[44px]" id="reminder-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderTimeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Order Updates */}
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-3 flex-1">
                <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label htmlFor="orders" className="cursor-pointer">Order Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Updates about your order status
                  </p>
                </div>
              </div>
              <Switch
                id="orders"
                checked={notificationPrefs?.order_updates ?? true}
                onCheckedChange={(checked) => updateNotificationPref("order_updates", checked)}
                disabled={saving}
              />
            </div>

            {/* Weekly Summary */}
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-3 flex-1">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label htmlFor="weekly" className="cursor-pointer">Weekly Summary</Label>
                  <p className="text-sm text-muted-foreground">
                    Weekly progress and nutrition report
                  </p>
                </div>
              </div>
              <Switch
                id="weekly"
                checked={notificationPrefs?.weekly_summary ?? true}
                onCheckedChange={(checked) => updateNotificationPref("weekly_summary", checked)}
                disabled={saving}
              />
            </div>

            {/* Promotional Emails */}
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-3 flex-1">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label htmlFor="promo" className="cursor-pointer">Promotional Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Deals, offers, and new features
                  </p>
                </div>
              </div>
              <Switch
                id="promo"
                checked={notificationPrefs?.promotional_emails ?? false}
                onCheckedChange={(checked) => updateNotificationPref("promotional_emails", checked)}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/support")}
        >
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Help & Support</p>
                <p className="text-sm text-muted-foreground">Get help or submit a support ticket</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/faq")}
        >
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">View FAQ</p>
                <p className="text-sm text-muted-foreground">Frequently asked questions</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex justify-around py-2">
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/dashboard")}>
              <Utensils className="h-5 w-5" />
              <span className="text-xs mt-1">Home</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/meals")}>
              <Utensils className="h-5 w-5" />
              <span className="text-xs mt-1">Meals</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/schedule")}>
              <Clock className="h-5 w-5" />
              <span className="text-xs mt-1">Schedule</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2 text-primary" onClick={() => navigate("/settings")}>
              <Bell className="h-5 w-5" />
              <span className="text-xs mt-1">Settings</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Settings;
