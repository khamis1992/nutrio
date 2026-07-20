import type { DeepLinkRoute } from "@/hooks/usePushNotificationDeepLink";
import type { Database } from "@/integrations/supabase/types";
import { trackEvent } from "@/lib/analytics";

export type NotificationType = Database["public"]["Enums"]["notification_type"];

export type PhaseOneDomainEventType =
  | "order.delivered.v1"
  | "meal.consumption_recorded.v1"
  | "meal.consumption_prompt_due.v1"
  | "health.sync_failed.v1"
  | "health.weekly_report_ready.v1"
  | "goal.adjustment_recommended.v1"
  | "challenge.reward_granted.v1"
  | "subscription.expired.v1"
  | "subscription.recovery_due.v1"
  | "coach.message_received.v1"
  | "meal.response_checkin_due.v1"
  | "meal.response_insight_ready.v1";

export type NotificationChannel = "in_app" | "push" | "email" | "whatsapp";
export type NotificationUrgency = "low" | "normal" | "high" | "critical";
export type QuietHoursPolicy = "respect" | "bypass";
export type PrivacyClassification = "standard" | "sensitive" | "restricted";

export type NotificationTelemetryEvent =
  | "notification_created"
  | "notification_suppressed"
  | "notification_deferred"
  | "notification_delivery_attempted"
  | "notification_delivery_succeeded"
  | "notification_delivery_failed"
  | "notification_dead_lettered"
  | "notification_cta_opened"
  | "notification_action_tapped"
  | "notification_deep_link_rejected";

export interface NotificationTemplateContract {
  templateKey: string;
  eventType: PhaseOneDomainEventType;
  notificationType: NotificationType;
  preferenceKey: string;
  channels: NotificationChannel[];
  urgency: NotificationUrgency;
  quietHoursPolicy: QuietHoursPolicy;
  titleI18nKey: string;
  bodyI18nKey: string;
  deepLinkType: DeepLinkRoute;
  analyticsEvent: NotificationTelemetryEvent;
  privacyClassification: PrivacyClassification;
}

export interface NotificationTelemetryProperties {
  event_type?: PhaseOneDomainEventType;
  template_key?: string;
  notification_type?: string;
  channel?: NotificationChannel;
  preference_key?: string;
  quiet_hours_policy?: QuietHoursPolicy;
  deep_link_type?: DeepLinkRoute;
  outcome?: string;
  error_code?: string;
  attempt_count?: number;
  retryable?: boolean;
}

export const PHASE_ONE_NOTIFICATION_TEMPLATES = {
  orderDelivered: {
    templateKey: "order_delivered_prompt_consumption_v1",
    eventType: "order.delivered.v1",
    notificationType: "order_update",
    preferenceKey: "order_updates",
    channels: ["in_app", "push"],
    urgency: "high",
    quietHoursPolicy: "bypass",
    titleI18nKey: "notification_order_delivered_title",
    bodyI18nKey: "notification_order_delivered_body",
    deepLinkType: "order_detail",
    analyticsEvent: "notification_created",
    privacyClassification: "standard",
  },
  mealConsumptionRecorded: {
    templateKey: "meal_consumption_recorded_v1",
    eventType: "meal.consumption_recorded.v1",
    notificationType: "meal_reminder",
    preferenceKey: "meal_reminders",
    channels: ["in_app"],
    urgency: "normal",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_consumption_recorded_title",
    bodyI18nKey: "notification_consumption_recorded_body",
    deepLinkType: "progress",
    analyticsEvent: "notification_created",
    privacyClassification: "sensitive",
  },
  mealConsumptionPromptDue: {
    templateKey: "meal_consumption_prompt_due_v1",
    eventType: "meal.consumption_prompt_due.v1",
    notificationType: "meal_reminder",
    preferenceKey: "meal_reminders",
    channels: ["in_app", "push"],
    urgency: "normal",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_consumption_prompt_title",
    bodyI18nKey: "notification_consumption_prompt_body",
    deepLinkType: "schedule",
    analyticsEvent: "notification_created",
    privacyClassification: "sensitive",
  },
  healthSyncFailed: {
    templateKey: "health_sync_failed_v1",
    eventType: "health.sync_failed.v1",
    notificationType: "system_alert",
    preferenceKey: "health_insights",
    channels: ["in_app"],
    urgency: "normal",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_health_sync_failed_title",
    bodyI18nKey: "notification_health_sync_failed_body",
    deepLinkType: "settings",
    analyticsEvent: "notification_created",
    privacyClassification: "restricted",
  },
  healthWeeklyReportReady: {
    templateKey: "health_weekly_report_ready_v1",
    eventType: "health.weekly_report_ready.v1",
    notificationType: "health_insight",
    preferenceKey: "weekly_summary",
    channels: ["in_app", "push"],
    urgency: "low",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_weekly_report_title",
    bodyI18nKey: "notification_weekly_report_body",
    deepLinkType: "progress",
    analyticsEvent: "notification_created",
    privacyClassification: "sensitive",
  },
  goalAdjustmentRecommended: {
    templateKey: "goal_adjustment_recommended_v1",
    eventType: "goal.adjustment_recommended.v1",
    notificationType: "plan_update",
    preferenceKey: "plan_updates",
    channels: ["in_app"],
    urgency: "normal",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_goal_adjustment_title",
    bodyI18nKey: "notification_goal_adjustment_body",
    deepLinkType: "progress",
    analyticsEvent: "notification_created",
    privacyClassification: "sensitive",
  },
  challengeRewardGranted: {
    templateKey: "challenge_reward_granted_v1",
    eventType: "challenge.reward_granted.v1",
    notificationType: "achievement",
    preferenceKey: "achievements",
    channels: ["in_app", "push"],
    urgency: "normal",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_challenge_reward_title",
    bodyI18nKey: "notification_challenge_reward_body",
    deepLinkType: "notifications",
    analyticsEvent: "notification_created",
    privacyClassification: "standard",
  },
  subscriptionExpired: {
    templateKey: "subscription_expired_v1",
    eventType: "subscription.expired.v1",
    notificationType: "subscription",
    preferenceKey: "subscription_updates",
    channels: ["in_app", "push"],
    urgency: "high",
    quietHoursPolicy: "bypass",
    titleI18nKey: "notification_subscription_expired_title",
    bodyI18nKey: "notification_subscription_expired_body",
    deepLinkType: "subscription",
    analyticsEvent: "notification_created",
    privacyClassification: "standard",
  },
  subscriptionRecoveryDue: {
    templateKey: "subscription_recovery_due_v1",
    eventType: "subscription.recovery_due.v1",
    notificationType: "subscription",
    preferenceKey: "subscription_updates",
    channels: ["in_app", "push"],
    urgency: "normal",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_subscription_recovery_title",
    bodyI18nKey: "notification_subscription_recovery_body",
    deepLinkType: "subscription",
    analyticsEvent: "notification_created",
    privacyClassification: "standard",
  },
  coachMessageReceived: {
    templateKey: "coach_message_received_v1",
    eventType: "coach.message_received.v1",
    notificationType: "coach_message",
    preferenceKey: "support",
    channels: ["in_app", "push"],
    urgency: "normal",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_coach_message_title",
    bodyI18nKey: "notification_coach_message_body",
    deepLinkType: "notifications",
    analyticsEvent: "notification_created",
    privacyClassification: "restricted",
  },
  mealResponseCheckInDue: {
    templateKey: "meal_response_checkin_due_v1",
    eventType: "meal.response_checkin_due.v1",
    notificationType: "meal_reminder",
    preferenceKey: "meal_reminders",
    channels: ["in_app", "push"],
    urgency: "normal",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_meal_response_checkin_title",
    bodyI18nKey: "notification_meal_response_checkin_body",
    deepLinkType: "meal_response",
    analyticsEvent: "notification_created",
    privacyClassification: "sensitive",
  },
  mealResponseInsightReady: {
    templateKey: "meal_response_insight_ready_v1",
    eventType: "meal.response_insight_ready.v1",
    notificationType: "health_insight",
    preferenceKey: "health_insights",
    channels: ["in_app", "push"],
    urgency: "low",
    quietHoursPolicy: "respect",
    titleI18nKey: "notification_meal_response_insight_title",
    bodyI18nKey: "notification_meal_response_insight_body",
    deepLinkType: "meal_response",
    analyticsEvent: "notification_created",
    privacyClassification: "sensitive",
  },
} as const satisfies Record<string, NotificationTemplateContract>;

export const PHASE_ONE_NOTIFICATION_TEMPLATE_LIST = Object.values(PHASE_ONE_NOTIFICATION_TEMPLATES);

export function findNotificationTemplateByEvent(
  eventType: PhaseOneDomainEventType,
): NotificationTemplateContract | null {
  return PHASE_ONE_NOTIFICATION_TEMPLATE_LIST.find((template) => template.eventType === eventType) ?? null;
}

export function sanitizeNotificationTelemetry(
  properties: NotificationTelemetryProperties,
): NotificationTelemetryProperties {
  const rawError = properties.error_code?.toLowerCase() ?? "";
  const safeErrorCode = !rawError
    ? undefined
    : /timeout|timed out/.test(rawError)
      ? "provider_timeout"
      : /rate.?limit|too many/.test(rawError)
        ? "provider_rate_limited"
        : /unauthori[sz]ed|forbidden|401|403/.test(rawError)
          ? "provider_unauthorized"
          : /invalid.?token|expired.?token/.test(rawError)
            ? "provider_token_invalid"
            : /network|connection|dns|socket/.test(rawError)
              ? "provider_network_error"
              : /unavailable|503|502/.test(rawError)
                ? "provider_unavailable"
                : "provider_failure";

  return {
    event_type: properties.event_type,
    template_key: properties.template_key,
    notification_type: properties.notification_type,
    channel: properties.channel,
    preference_key: properties.preference_key,
    quiet_hours_policy: properties.quiet_hours_policy,
    deep_link_type: properties.deep_link_type,
    outcome: properties.outcome?.slice(0, 80),
    error_code: safeErrorCode,
    attempt_count: typeof properties.attempt_count === "number"
      ? Math.max(0, Math.min(99, Math.floor(properties.attempt_count)))
      : undefined,
    retryable: properties.retryable,
  };
}

export function trackNotificationTelemetry(
  eventName: NotificationTelemetryEvent,
  properties: NotificationTelemetryProperties,
) {
  trackEvent(eventName, { ...sanitizeNotificationTelemetry(properties) });
}
