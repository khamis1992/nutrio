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
      console.log("Push notifications only available on native platforms");
      return;
    }

    if (this.initialized) {
      console.log("Push notification service already initialized");
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
      console.log("FCM token registered:", token.value.substring(0, 20) + "...");
      this.fcmToken = token.value;
      this.saveTokenToDatabase(token.value);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push received in foreground:", notification.title);
      // Handle foreground notification display if needed
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Push notification tapped:", action.actionId);
      this.handleNotificationTap(action.notification.data as PushNotificationData);
    });

    this.initialized = true;
    console.log("Push notification service initialized successfully");
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
      } else {
        console.log("Push token saved to database successfully");
      }
    } catch (err) {
      console.error("Unexpected error saving push token:", err);
    }
  }

  private handleNotificationTap(data: PushNotificationData): void {
    switch (data.type) {
      case "order_update":
      case "delivery_update":
        if (data.orderId) {
          window.location.href = `/tracking?id=${data.orderId}`;
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

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
