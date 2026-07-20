import { describe, expect, it } from "vitest";
import {
  PHASE_ONE_NOTIFICATION_TEMPLATE_LIST,
  findNotificationTemplateByEvent,
  sanitizeNotificationTelemetry,
} from "@/lib/notification-contracts";

describe("notification contracts", () => {
  it("maps every phase-one event to one unique template", () => {
    const eventTypes = PHASE_ONE_NOTIFICATION_TEMPLATE_LIST.map((template) => template.eventType);
    const templateKeys = PHASE_ONE_NOTIFICATION_TEMPLATE_LIST.map((template) => template.templateKey);

    expect(new Set(eventTypes).size).toBe(eventTypes.length);
    expect(new Set(templateKeys).size).toBe(templateKeys.length);
    expect(findNotificationTemplateByEvent("health.sync_failed.v1")?.preferenceKey).toBe("health_insights");
    expect(findNotificationTemplateByEvent("meal.response_checkin_due.v1")).toMatchObject({
      preferenceKey: "meal_reminders",
      quietHoursPolicy: "respect",
      deepLinkType: "meal_response",
      privacyClassification: "sensitive",
    });
    expect(findNotificationTemplateByEvent("meal.response_insight_ready.v1")).toMatchObject({
      preferenceKey: "health_insights",
      channels: ["in_app", "push"],
      deepLinkType: "meal_response",
    });
  });

  it("keeps meal-response notification contracts free of sensitive presentation data", () => {
    const templates = PHASE_ONE_NOTIFICATION_TEMPLATE_LIST.filter((template) =>
      template.eventType.startsWith("meal.response_"),
    );

    expect(templates).toHaveLength(2);
    for (const template of templates) {
      expect(template.deepLinkType).toBe("meal_response");
      expect(template.quietHoursPolicy).toBe("respect");
      expect(Object.keys(template)).not.toContain("payload");
    }
  });

  it("keeps telemetry allowlisted and bounded", () => {
    const sanitized = sanitizeNotificationTelemetry({
      event_type: "coach.message_received.v1",
      template_key: "coach_message_received_v1",
      notification_type: "coach_message",
      channel: "push",
      preference_key: "support",
      quiet_hours_policy: "respect",
      deep_link_type: "notifications",
      outcome: "opened".repeat(40),
      error_code: "Provider Failed: phone=123 token=secret",
      attempt_count: 999,
      retryable: true,
    });

    expect(sanitized.outcome?.length).toBeLessThanOrEqual(80);
    expect(sanitized.error_code).toBe("provider_failure");
    expect(sanitized.error_code).not.toContain("123");
    expect(sanitized.error_code).not.toContain("secret");
    expect(sanitized.attempt_count).toBe(99);
    expect(Object.keys(sanitized)).not.toContain("message");
  });

  it("maps provider errors to a bounded allowlist without retaining raw details", () => {
    expect(sanitizeNotificationTelemetry({ error_code: "request timed out for user@example.com" }).error_code).toBe("provider_timeout");
    expect(sanitizeNotificationTelemetry({ error_code: "401 token=super-secret" }).error_code).toBe("provider_unauthorized");
    expect(sanitizeNotificationTelemetry({ error_code: "socket failed phone=5551234" }).error_code).toBe("provider_network_error");
  });
});
