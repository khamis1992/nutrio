import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Utensils, Clock, Mail, Smartphone, Tag, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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

interface DietTag {
  id: string;
  name: string;
  description: string | null;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
  const [dietTags, setDietTags] = useState<DietTag[]>([]);
  const [userDietPreferences, setUserDietPreferences] = useState<string[]>([]);

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

      // Fetch diet tags
      const { data: tagsData, error: tagsError } = await supabase
        .from("diet_tags")
        .select("*")
        .order("name");

      if (tagsError) throw tagsError;
      setDietTags(tagsData || []);

      // Fetch user's dietary preferences
      const { data: userPrefsData, error: userPrefsError } = await supabase
        .from("user_dietary_preferences")
        .select("diet_tag_id")
        .eq("user_id", user.id);

      if (userPrefsError) throw userPrefsError;
      setUserDietPreferences(userPrefsData?.map(p => p.diet_tag_id) || []);

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

  const toggleDietPreference = async (tagId: string) => {
    if (!user) return;

    try {
      const isSelected = userDietPreferences.includes(tagId);

      if (isSelected) {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("diet_tag_id", tagId);

        if (error) throw error;
        setUserDietPreferences(prev => prev.filter(id => id !== tagId));
      } else {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .insert({
            user_id: user.id,
            diet_tag_id: tagId
          });

        if (error) throw error;
        setUserDietPreferences(prev => [...prev, tagId]);
      }

      toast({
        title: isSelected ? "Removed" : "Added",
        description: `Dietary preference ${isSelected ? "removed" : "added"}`
      });
    } catch (error) {
      console.error("Error toggling diet preference:", error);
      toast({
        title: "Error",
        description: "Failed to update dietary preference",
        variant: "destructive"
      });
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="push">Push Notifications</Label>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="email">Email Notifications</Label>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Utensils className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="reminders">Meal Reminders</Label>
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
              <div className="flex items-center justify-between pl-7">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Reminder Time</Label>
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
                  <SelectTrigger className="w-32">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="orders">Order Updates</Label>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="weekly">Weekly Summary</Label>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="promo">Promotional Emails</Label>
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

        {/* Dietary Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              Dietary Preferences
            </CardTitle>
            <CardDescription>
              Select your dietary restrictions and preferences to filter meals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dietTags.map(tag => {
                const isSelected = userDietPreferences.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer transition-all px-3 py-1.5 text-sm ${
                      isSelected 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "hover:bg-muted"
                    }`}
                    onClick={() => toggleDietPreference(tag.id)}
                  >
                    {isSelected ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : null}
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
            {dietTags.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No dietary tags available
              </p>
            )}
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
