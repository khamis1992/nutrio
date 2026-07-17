import { getServiceClient, HttpError } from "./security.ts";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export interface NotificationRecipient {
  email: string | null;
  fullName: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  subscriptionUpdatesEnabled: boolean;
  healthInsightsEnabled: boolean;
}

export async function getNotificationRecipient(
  userId: string,
): Promise<NotificationRecipient> {
  const service = getServiceClient();
  const [authResult, profileResult, preferenceResult] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    service
      .from("notification_preferences")
      .select("email_notifications, push_notifications, subscription_updates, health_insights")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (authResult.error) {
    console.error("Notification auth recipient lookup failed", {
      status: authResult.error.status,
    });
    throw new HttpError(503, "notification_recipient_unavailable");
  }
  if (profileResult.error || preferenceResult.error) {
    console.error("Notification recipient metadata lookup failed", {
      profileCode: profileResult.error?.code,
      preferenceCode: preferenceResult.error?.code,
    });
    throw new HttpError(503, "notification_recipient_unavailable");
  }

  const authUser = authResult.data.user;
  const candidateEmail = String(authUser?.email ?? "").trim().toLowerCase();
  const email = authUser?.email_confirmed_at && EMAIL_PATTERN.test(candidateEmail)
    ? candidateEmail
    : null;
  const preferences = preferenceResult.data;

  return {
    email,
    fullName: String(profileResult.data?.full_name ?? "Customer").trim().slice(0, 100) || "Customer",
    emailEnabled: preferences?.email_notifications !== false,
    pushEnabled: preferences?.push_notifications !== false,
    subscriptionUpdatesEnabled: preferences?.subscription_updates !== false,
    healthInsightsEnabled: preferences?.health_insights !== false,
  };
}
