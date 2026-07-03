import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Clock, Mail, Moon, Smartphone, Sun, Tag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { HealthAppsSettings } from "@/components/settings/HealthAppsSettings";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

interface NotificationPreferences {
  id: string;
  user_id: string | null;
  push_notifications: boolean | null;
  email_notifications: boolean | null;
  meal_reminders: boolean | null;
  order_updates: boolean | null;
  promotional_emails: boolean | null;
  weekly_summary: boolean | null;
  reminder_time: string | null;
  achievements: boolean | null;
  delivery_updates: boolean | null;
  health_insights: boolean | null;
  plan_updates: boolean | null;
  subscription_updates: boolean | null;
  system_alerts: boolean | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  useEffect(() => { document.title = `${t("nav_settings")} - Nutrio`; }, [t]);
  const { toggleTheme, isDark } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
  const pendingChangesRef = useRef<Partial<Record<keyof NotificationPreferences, boolean | string>>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSettings = useCallback(async () => {
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
     
  }, [user, toast, t]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [user, fetchSettings]);

  const flushPendingChanges = useCallback(async () => {
    if (!user || !notificationPrefs || Object.keys(pendingChangesRef.current).length === 0) return;
    const changes = { ...pendingChangesRef.current };
    pendingChangesRef.current = {};

    try {
      setSaving(true);
      const { error } = await supabase
        .from("notification_preferences")
        .update(changes)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: t('settings_saved'),
        description: t('settings_preferences_updated'),
      });
    } catch (error) {
      console.error("Error updating notification pref:", error);
      toast({
        title: t('settings_error_updating'),
        description: t('settings_error_updating_desc'),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      debounceTimerRef.current = null;
    }
  }, [user, notificationPrefs, toast, t]);

  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flushPendingChanges, 600);
  }, [flushPendingChanges]);

  const updateNotificationPref = useCallback((key: keyof NotificationPreferences, value: boolean | string) => {
    if (!user || !notificationPrefs) return;

    setNotificationPrefs(prev => prev ? { ...prev, [key]: value } : null);
    pendingChangesRef.current[key] = value;
    scheduleFlush();
  }, [user, notificationPrefs, scheduleFlush]);

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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 rtl:flex-row-reverse">
            <Button
              variant="ghost"
              size="icon"
              data-testid="settings-back-btn"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">{t('settings_title')}</h1>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* App Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isDark ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-warning" />}
              {t("appearance")}
            </CardTitle>
            <CardDescription>
              {isDark ? t("dark_mode_on") : t("light_mode_on")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sun className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{isDark ? t("switch_to_light") : t("switch_to_dark")}</span>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={toggleTheme}
            />
          </CardContent>
        </Card>

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

        {/* Health Apps Integration */}
        <HealthAppsSettings />

      </div>

    </div>
  );
};

export default Settings;
