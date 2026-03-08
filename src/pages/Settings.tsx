import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Clock, Mail, Smartphone, Check, X, Crown, Pause, Play, AlertTriangle, Loader2, HelpCircle, ChevronRight, BookOpen, Utensils, Tag } from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  
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
        title: t('settings_error_loading'),
        description: t('settings_error_loading_desc'),
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
        title: t('settings_saved'),
        description: t('settings_preferences_updated')
      });
    } catch (error) {
      console.error("Error updating notification pref:", error);
      toast({
        title: t('settings_error_updating'),
        description: t('settings_error_updating_desc'),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const reminderTimeOptions = [
    { value: "06:00:00", label: t('settings_time_6am') },
    { value: "07:00:00", label: t('settings_time_7am') },
    { value: "08:00:00", label: t('settings_time_8am') },
    { value: "09:00:00", label: t('settings_time_9am') },
    { value: "10:00:00", label: t('settings_time_10am') },
    { value: "12:00:00", label: t('settings_time_12pm') },
    { value: "18:00:00", label: t('settings_time_6pm') },
    { value: "20:00:00", label: t('settings_time_8pm') }
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
          <div className="flex items-center gap-4 rtl:flex-row-reverse">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">{t('settings_title')}</h1>
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
                {t('settings_subscription')}
              </CardTitle>
              <CardDescription>
                {t('settings_subscription_description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">{subscription.plan} {t('settings_plan')}</p>
                  <p className="text-sm text-muted-foreground">
                    {isPaused ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Pause className="h-3 w-3" />
                        {t('settings_subscription_paused_status')}
                      </span>
                    ) : (
                      `${t('settings_renews_on')} ${new Date(subscription.end_date).toLocaleDateString()}`
                    )}
                  </p>
                </div>
                <Badge variant={isPaused ? "outline" : "default"} className={isPaused ? "border-amber-500 text-amber-600" : ""}>
                  {isPaused ? t('settings_paused') : t('settings_active')}
                </Badge>
              </div>

              {isPaused ? (
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-600">{t('settings_subscription_paused_title')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('settings_subscription_paused_desc')}
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
                          title: t('settings_subscription_resumed'),
                          description: t('settings_subscription_resumed_desc'),
                        });
                      } else {
                        toast({
                          title: t('settings_error'),
                          description: t('settings_resume_error_desc'),
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
                    {t('settings_resume_subscription')}
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Pause className="h-4 w-4 mr-2" />
                        {t('settings_pause_subscription')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('settings_pause_dialog_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('settings_pause_dialog_desc')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('settings_cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            setPausingSubscription(true);
                            const success = await pauseSubscription();
                            setPausingSubscription(false);
                            if (success) {
                              toast({
                                title: t('settings_subscription_paused'),
                                description: t('settings_subscription_paused_toast_desc'),
                              });
                            } else {
                              toast({
                                title: t('settings_error'),
                                description: t('settings_pause_error_desc'),
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          {t('settings_pause_subscription')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button variant="ghost" onClick={() => navigate("/subscription")}>
                  {t('settings_change_plan')}
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
              {t('settings_notifications')}
            </CardTitle>
            <CardDescription>
              {t('settings_notifications_description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Push Notifications */}
            <div className="flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-3 flex-1">
                <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Label htmlFor="push" className="cursor-pointer">{t('settings_push_notifications')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings_push_notifications_desc')}
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
                  <Label htmlFor="email" className="cursor-pointer">{t('settings_email_notifications')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings_email_notifications_desc')}
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
                  <Label htmlFor="reminders" className="cursor-pointer">{t('settings_meal_reminders')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings_meal_reminders_desc')}
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
                    <Label htmlFor="reminder-time" className="cursor-pointer">{t('settings_reminder_time')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings_reminder_time_desc')}
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
                  <Label htmlFor="orders" className="cursor-pointer">{t('settings_order_updates')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings_order_updates_desc')}
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
                  <Label htmlFor="weekly" className="cursor-pointer">{t('settings_weekly_summary')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings_weekly_summary_desc')}
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
                  <Label htmlFor="promo" className="cursor-pointer">{t('settings_promotional_emails')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings_promotional_emails_desc')}
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
                <p className="font-medium">{t('settings_help')}</p>
                <p className="text-sm text-muted-foreground">{t('settings_help_desc')}</p>
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
                <p className="font-medium">{t('settings_about')}</p>
                <p className="text-sm text-muted-foreground">{t('settings_about_desc')}</p>
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
              <span className="text-xs mt-1">{t('nav_home')}</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/meals")}>
              <Utensils className="h-5 w-5" />
              <span className="text-xs mt-1">{t('nav_meals')}</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/schedule")}>
              <Clock className="h-5 w-5" />
              <span className="text-xs mt-1">{t('nav_schedule')}</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2 text-primary" onClick={() => navigate("/settings")}>
              <Bell className="h-5 w-5" />
              <span className="text-xs mt-1">{t('nav_settings')}</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Settings;
