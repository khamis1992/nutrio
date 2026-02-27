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

    const permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      const requestStatus = await PushNotifications.requestPermissions();
      if (requestStatus.receive !== "granted") {
        console.warn("Push notification permission denied");
        return;
      }
    }

    await PushNotifications.register();

    PushNotifications.addListener("registration", (token) => {
      this.fcmToken = token.value;
      this.saveTokenToDatabase(token.value);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push received:", notification);
      // Handle foreground notification
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Push action:", action);
      this.handleNotificationTap(action.notification.data as PushNotificationData);
    });
  }

  private async saveTokenToDatabase(token: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("push_tokens").upsert(
      {
        user_id: user.id,
        token,
        platform: Capacitor.getPlatform(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
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
}

export const pushNotificationService = PushNotificationService.getInstance();
