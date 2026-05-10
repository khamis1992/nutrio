import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react";

interface NotificationPreferences {
  order_updates_push: boolean;
  order_updates_email: boolean;
  order_updates_whatsapp: boolean;
  delivery_updates_push: boolean;
  delivery_updates_email: boolean;
  delivery_updates_whatsapp: boolean;
  promotions_email: boolean;
  reminders_push: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  order_updates_push: true,
  order_updates_email: true,
  order_updates_whatsapp: true,
  delivery_updates_push: true,
  delivery_updates_email: false,
  delivery_updates_whatsapp: true,
  promotions_email: true,
  reminders_push: true,
};

export function NotificationPreferences() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", user?.id)
      .single();

    if (error) {
      console.error("Error fetching preferences:", error);
    }

    if (data?.notification_preferences) {
      setPreferences({ ...DEFAULT_PREFERENCES, ...(data.notification_preferences as NotificationPreferences) });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [fetchPreferences, user]);
    const { data, error } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", user?.id)
      .single();

    if (error) {
      console.error("Error fetching preferences:", error);
    }

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: newPreferences })
      .eq("id", user?.id);

    if (error) {
      toast.error(t("failed_update_preferences"));
      setPreferences(preferences); // Revert
    } else {
      toast.success(t("preferences_updated"));
    }
  };

  const categories = [
    {
      title: t("order_updates_title"),
      description: t("order_updates_desc"),
      icon: Bell,
      keys: {
        push: "order_updates_push" as const,
        email: "order_updates_email" as const,
        whatsapp: "order_updates_whatsapp" as const,
      },
    },
    {
      title: t("delivery_updates_title"),
      description: t("delivery_updates_desc"),
      icon: Bell,
      keys: {
        push: "delivery_updates_push" as const,
        email: "delivery_updates_email" as const,
        whatsapp: "delivery_updates_whatsapp" as const,
      },
    },
    {
      title: t("promotions_title"),
      description: t("promotions_desc"),
      icon: Bell,
      keys: {
        email: "promotions_email" as const,
      },
    },
    {
      title: t("meal_reminders_title"),
      description: t("meal_reminders_desc"),
      icon: Bell,
      keys: {
        push: "reminders_push" as const,
      },
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("notification_preferences")}</CardTitle>
          <CardDescription>{t("loading")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t("notification_preferences")}
        </CardTitle>
        <CardDescription>{t("choose_receive_updates")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.map((category) => (
          <div key={category.title} className="space-y-3">
            <div>
              <h4 className="font-medium">{category.title}</h4>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {("push" in category.keys) && (
                <div className="flex items-center justify-between">
                  <Label htmlFor={category.keys.push} className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    {t("push")}
                  </Label>
                  <Switch
                    id={category.keys.push}
                    checked={preferences[category.keys.push]}
                    onCheckedChange={(checked) => updatePreference(category.keys.push, checked)}
                  />
                </div>
              )}
              {("email" in category.keys) && (
                <div className="flex items-center justify-between">
                  <Label htmlFor={category.keys.email} className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t("email")}
                  </Label>
                  <Switch
                    id={category.keys.email}
                    checked={preferences[category.keys.email]}
                    onCheckedChange={(checked) => updatePreference(category.keys.email, checked)}
                  />
                </div>
              )}
              {("whatsapp" in category.keys) && (
                <div className="flex items-center justify-between">
                  <Label htmlFor={category.keys.whatsapp} className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {t("whatsapp")}
                  </Label>
                  <Switch
                    id={category.keys.whatsapp}
                    checked={preferences[category.keys.whatsapp]}
                    onCheckedChange={(checked) => updatePreference(category.keys.whatsapp, checked)}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
