import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export interface PushNotificationData {
  type: "order_update" | "delivery_update" | "promotion" | "reminder";
  orderId?: string;
  status?: string;
  title: string;
  body: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmToken: string | null = null;
  private initialized = false;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {

      return;
    }

    if (this.initialized) {

      return;
    }

    const permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      const requestStatus = await PushNotifications.requestPermissions();
      if (requestStatus.receive !== "granted") {
        console.warn("Push notification permission denied");
        return;
      }
    }

    if (permStatus.receive === "denied") {
      console.warn("Push notification permission denied");
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener("registration", (token) => {

      this.fcmToken = token.value;
      this.saveTokenToDatabase(token.value);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (_notification) => {

      // Handle foreground notification display if needed
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {

      this.handleNotificationTap(action.notification.data as PushNotificationData);
    });

    this.initialized = true;

  }

  private async saveTokenToDatabase(token: string): Promise<void> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.warn("No authenticated user — push token not saved");
        return;
      }

      const { error } = await supabase.from("push_tokens").upsert(
        {
          user_id: user.id,
          token,
          platform: Capacitor.getPlatform(),
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" }
      );

      if (error) {
        console.error("Error saving push token:", error.message);
      }
    } catch (err) {
      console.error("Unexpected error saving push token:", err);
    }
  }

  private handleNotificationTap(data: PushNotificationData): void {
    switch (data.type) {
      case "order_update":
      case "delivery_update":
        if (data.orderId && UUID_PATTERN.test(data.orderId)) {
          const basePath = window.location.pathname.startsWith("/nutrio")
            ? "/nutrio"
            : "";
          window.location.href = `${basePath}/live/${encodeURIComponent(data.orderId)}`;
        } else {
          console.warn("Rejected invalid order identifier from push notification");
        }
        break;
      case "promotion":
        window.location.href = "/meals";
        break;
      case "reminder":
        window.location.href = "/schedule";
        break;
    }
  }

  getToken(): string | null {
    return this.fcmToken;
  }

  async deactivateForUser(userId: string): Promise<void> {
    const token = this.fcmToken;
    if (!token || !UUID_PATTERN.test(userId)) return;
    try {
      const { error } = await supabase
        .from("push_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("token", token);
      if (error) console.warn("Could not deactivate this device push token");
    } catch {
      console.warn("Could not deactivate this device push token");
    } finally {
      this.fcmToken = null;
      this.initialized = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
