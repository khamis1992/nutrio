# Notification System

<cite>
**Referenced Files in This Document**
- [notifications.ts](file://src/lib/notifications.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [email-templates.ts](file://src/lib/email-templates.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [NotificationPreferences.tsx](file://src/components/NotificationPreferences.tsx)
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)
- [Capacitor Push Notifications Plugin](file://node_modules/@capacitor/push-notifications/README.md)
- [Capacitor Local Notifications Plugin](file://node_modules/@capacitor/local-notifications/README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document describes Nutrio's multi-channel notification system covering push notifications, email templating and sending, WhatsApp message automation, and in-app notification handling. It explains notification triggers, template management, personalization strategies, and delivery confirmation. It also documents integrations with Firebase Cloud Messaging, email service providers, and the WhatsApp Business API, along with scheduling mechanisms, fallback strategies, analytics, opt-out handling, compliance considerations, rate limiting, retry mechanisms, and monitoring delivery success rates.

## Project Structure
The notification system spans three primary areas:
- Frontend libraries for generating notifications and sending channels
- Supabase Edge Functions orchestrating backend delivery
- Capacitor plugins enabling native push and local notifications on mobile

```mermaid
graph TB
subgraph "Frontend"
FE_LIBS["Notification Libraries<br/>notifications.ts<br/>email-service.ts<br/>email-templates.ts<br/>whatsapp.ts"]
UI_PREF["Notification Preferences UI<br/>NotificationPreferences.tsx"]
end
subgraph "Edge Functions"
PUSH_FN["send-push-notification/index.ts"]
EMAIL_FN["send-email/index.ts"]
WHATSAPP_FN["process-whatsapp-notifications/index.ts"]
end
subgraph "Mobile Plugins"
CAP_PUSH["@capacitor/push-notifications"]
CAP_LOCAL["@capacitor/local-notifications"]
end
FE_LIBS --> PUSH_FN
FE_LIBS --> EMAIL_FN
FE_LIBS --> WHATSAPP_FN
UI_PREF --> FE_LIBS
PUSH_FN --> CAP_PUSH
PUSH_FN --> CAP_LOCAL
```

**Diagram sources**
- [notifications.ts](file://src/lib/notifications.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [email-templates.ts](file://src/lib/email-templates.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [NotificationPreferences.tsx](file://src/components/NotificationPreferences.tsx)
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [Capacitor Push Notifications Plugin](file://node_modules/@capacitor/push-notifications/README.md)
- [Capacitor Local Notifications Plugin](file://node_modules/@capacitor/local-notifications/README.md)

**Section sources**
- [notifications.ts](file://src/lib/notifications.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [email-templates.ts](file://src/lib/email-templates.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [NotificationPreferences.tsx](file://src/components/NotificationPreferences.tsx)
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [Capacitor Push Notifications Plugin](file://node_modules/@capacitor/push-notifications/README.md)
- [Capacitor Local Notifications Plugin](file://node_modules/@capacitor/local-notifications/README.md)

## Core Components
- In-app notification creation and helpers for order/delivery events
- Email service with templating and provider integration
- WhatsApp messaging via Ultramsg API with role-specific templates
- Push notification orchestration via Supabase Edge Functions and Firebase Cloud Messaging
- User preference management for channel opt-in/out
- Mobile push and local notification plugins for native capabilities

**Section sources**
- [notifications.ts](file://src/lib/notifications.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [email-templates.ts](file://src/lib/email-templates.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [NotificationPreferences.tsx](file://src/components/NotificationPreferences.tsx)
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [Capacitor Push Notifications Plugin](file://node_modules/@capacitor/push-notifications/README.md)
- [Capacitor Local Notifications Plugin](file://node_modules/@capacitor/local-notifications/README.md)

## Architecture Overview
The system integrates frontend libraries with Supabase Edge Functions and external APIs to deliver notifications across channels. The flow varies by channel but generally follows:
- Trigger event in the application
- Create in-app notification record
- Select channels based on user preferences
- Invoke appropriate Edge Function or external API
- Update delivery status and handle failures

```mermaid
sequenceDiagram
participant App as "App Logic"
participant InApp as "In-App Notifications<br/>notifications.ts"
participant Pref as "User Preferences<br/>NotificationPreferences.tsx"
participant PushFn as "Edge Function<br/>send-push-notification"
participant EmailFn as "Edge Function<br/>send-email"
participant WppFn as "Edge Function<br/>process-whatsapp-notifications"
participant FCM as "Firebase Cloud Messaging"
participant EmailProv as "Email Provider (Resend)"
participant WppApi as "WhatsApp API (Ultramsg)"
App->>InApp : "Create notification record"
App->>Pref : "Check user preferences"
Pref-->>App : "Enabled channels"
App->>PushFn : "Send push (if enabled)"
PushFn->>FCM : "Send FCM message"
FCM-->>PushFn : "Delivery result"
App->>EmailFn : "Send email (if enabled)"
EmailFn->>EmailProv : "Send via provider"
EmailProv-->>EmailFn : "Message ID"
App->>WppFn : "Queue WhatsApp (if enabled)"
WppFn->>WppApi : "Send via Ultramsg"
WppApi-->>WppFn : "Success/Failure"
PushFn-->>App : "Stats and results"
EmailFn-->>App : "Message ID"
WppFn-->>App : "Processed/Failed counts"
```

**Diagram sources**
- [notifications.ts](file://src/lib/notifications.ts)
- [NotificationPreferences.tsx](file://src/components/NotificationPreferences.tsx)
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)

## Detailed Component Analysis

### In-App Notifications
- Purpose: Persist notification records for later retrieval and display within the app.
- Triggers: Order status changes, driver assignments, and delivery availability.
- Data model: Stores user_id, type, title, message, optional metadata, read/unread status.
- Helpers: Predefined functions for common scenarios (order updates, driver assignment, new delivery).

```mermaid
flowchart TD
Start(["Trigger Event"]) --> Create["Create notification record"]
Create --> TypeSel{"Select type"}
TypeSel --> |Order update| OrderMsg["Build order update message"]
TypeSel --> |Driver assigned| DriverMsg["Build driver assigned message"]
TypeSel --> |New delivery| DeliveryMsg["Build delivery available message"]
OrderMsg --> Save["Save to notifications table"]
DriverMsg --> Save
DeliveryMsg --> Save
Save --> End(["Done"])
```

**Diagram sources**
- [notifications.ts](file://src/lib/notifications.ts)

**Section sources**
- [notifications.ts](file://src/lib/notifications.ts)

### Email Service and Templating
- Purpose: Send transactional and promotional emails using a templating system and a provider.
- Templates: Centralized HTML templates with subject generation and personalization.
- Providers: Resend integration via Supabase Edge Function.
- Personalization: Template data injection with dynamic content and links.
- Delivery confirmation: Returns message identifiers for tracking.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant ESvc as "Email Service<br/>email-service.ts"
participant Tmpl as "Templates<br/>email-templates.ts"
participant EF as "Edge Function<br/>send-email"
participant Prov as "Email Provider"
FE->>ESvc : "sendTemplatedEmail(data)"
ESvc->>Tmpl : "getEmailTemplate(template, data)"
Tmpl-->>ESvc : "subject + html"
ESvc->>EF : "POST send-email with payload"
EF->>Prov : "Send via provider"
Prov-->>EF : "Message ID"
EF-->>ESvc : "Success with messageId"
ESvc-->>FE : "Result"
```

**Diagram sources**
- [email-service.ts](file://src/lib/email-service.ts)
- [email-templates.ts](file://src/lib/email-templates.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)

**Section sources**
- [email-service.ts](file://src/lib/email-service.ts)
- [email-templates.ts](file://src/lib/email-templates.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)

### WhatsApp Message Automation
- Purpose: Automate customer/partner/driver/admin notifications via Ultramsg API.
- Channels: Role-specific message builders for customers, partners, drivers, and admins.
- Queueing: Edge Function processes queued messages with status tracking.
- Validation: Phone number formatting and validation before sending.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant WSvc as "WhatsApp Service<br/>whatsapp.ts"
participant WF as "Edge Function<br/>process-whatsapp-notifications"
participant API as "Ultramsg API"
FE->>WSvc : "notifyCustomerOrderDelivered(phone, ...)"
WSvc->>WF : "Queue message (via app logic)"
WF->>WF : "Fetch pending notifications"
WF->>API : "POST chat message"
API-->>WF : "Success/Failure"
WF->>WF : "Update status (sent/failed)"
```

**Diagram sources**
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)

**Section sources**
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)

### Push Notifications (FCM)
- Purpose: Deliver real-time push notifications to mobile devices via Firebase Cloud Messaging.
- Orchestration: Edge Function retrieves user tokens, authenticates with Firebase, sends messages, handles deactivation of invalid tokens, and persists notification records.
- Multi-platform: Supports Android and iOS APNs payload variants.
- Delivery confirmation: Aggregates sent/failed counts and updates DB.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant PF as "Edge Function<br/>send-push-notification"
participant DB as "Supabase DB"
participant FCM as "Firebase Cloud Messaging"
FE->>PF : "Send push payload"
PF->>DB : "Fetch active tokens for user"
DB-->>PF : "Tokens list"
PF->>FCM : "Authenticate and send messages"
FCM-->>PF : "Results per token"
PF->>DB : "Deactivate invalid tokens"
PF->>DB : "Insert notification record"
PF-->>FE : "Sent/failed totals"
```

**Diagram sources**
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)

**Section sources**
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)

### User Notification Preferences
- Purpose: Allow users to opt-in/out of push, email, and WhatsApp notifications for different categories.
- Storage: Persists preferences in user profiles.
- UI: Provides toggles for order updates, delivery updates, promotions, and reminders.

```mermaid
flowchart TD
Load["Load user preferences"] --> Show["Render preference toggles"]
Show --> Toggle{"User toggles a channel"}
Toggle --> Update["Update in Supabase profiles"]
Update --> Toast["Show success/error feedback"]
Toast --> Done["Persisted"]
```

**Diagram sources**
- [NotificationPreferences.tsx](file://src/components/NotificationPreferences.tsx)

**Section sources**
- [NotificationPreferences.tsx](file://src/components/NotificationPreferences.tsx)

### Mobile Push and Local Notifications
- Push Notifications Plugin: Enables receiving and handling push notifications on native platforms.
- Local Notifications Plugin: Schedules and displays device-local notifications when the app is not active.

**Section sources**
- [Capacitor Push Notifications Plugin](file://node_modules/@capacitor/push-notifications/README.md)
- [Capacitor Local Notifications Plugin](file://node_modules/@capacitor/local-notifications/README.md)

## Dependency Analysis
- Frontend libraries depend on Supabase client for in-app storage and on Edge Function endpoints for channel delivery.
- Edge Functions depend on external providers (Resend, Ultramsg, Firebase) and Supabase for token and queue management.
- Mobile plugins integrate with native OS notification systems.

```mermaid
graph LR
FE["Frontend Libraries"] --> SUP["Supabase"]
FE --> FNS["Edge Functions"]
FNS --> RES["Resend API"]
FNS --> ULTRA["Ultramsg API"]
FNS --> FCM["Firebase Cloud Messaging"]
FE --> CAP["Capacitor Plugins"]
```

**Diagram sources**
- [email-service.ts](file://src/lib/email-service.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [Capacitor Push Notifications Plugin](file://node_modules/@capacitor/push-notifications/README.md)
- [Capacitor Local Notifications Plugin](file://node_modules/@capacitor/local-notifications/README.md)

**Section sources**
- [email-service.ts](file://src/lib/email-service.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [Capacitor Push Notifications Plugin](file://node_modules/@capacitor/push-notifications/README.md)
- [Capacitor Local Notifications Plugin](file://node_modules/@capacitor/local-notifications/README.md)

## Performance Considerations
- Asynchronous processing: Edge Functions process notifications asynchronously to avoid blocking the main application flow.
- Token batching: Push notifications are sent concurrently to multiple tokens with aggregated results.
- Rate limiting: External providers (Resend, Ultramsg, FCM) enforce rate limits; implement backoff and retry strategies at the application level if needed.
- Queueing: WhatsApp notifications are queued and processed in batches to manage throughput.
- Caching: Consider caching frequently used templates and avoiding repeated network calls for identical messages.

## Troubleshooting Guide
Common issues and resolutions:
- Missing credentials
  - Symptom: Email/WA/FCM functions fail with configuration errors.
  - Resolution: Ensure environment variables are set in Supabase secrets and environment.
- Invalid phone numbers
  - Symptom: WA delivery fails with validation errors.
  - Resolution: Normalize phone numbers to E.164 format before queuing.
- Unregistered tokens
  - Symptom: Push delivery failures indicating device token invalid.
  - Resolution: Edge Function automatically deactivates invalid tokens; re-register tokens when devices reconnect.
- Email validation errors
  - Symptom: Email function rejects malformed addresses.
  - Resolution: Validate email addresses on the client and handle errors gracefully.
- Template rendering errors
  - Symptom: Missing or incorrect personalization data.
  - Resolution: Ensure template data is provided and sanitized; verify template keys match expected placeholders.

**Section sources**
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [send-email/index.ts](file://supabase/functions/send-email/index.ts)
- [process-whatsapp-notifications/index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [email-templates.ts](file://src/lib/email-templates.ts)

## Conclusion
Nutrio’s notification system provides a robust, multi-channel communication framework integrating in-app, email, WhatsApp, and push notifications. It leverages Supabase Edge Functions for reliable delivery orchestration, external APIs for provider-specific features, and Capacitor plugins for native mobile capabilities. The system supports user preferences, delivery confirmation, and operational resilience through token deactivation and queue processing. Extending the system involves adding new templates, channel-specific helpers, and expanding Edge Functions for additional providers while maintaining consistent data models and error handling.