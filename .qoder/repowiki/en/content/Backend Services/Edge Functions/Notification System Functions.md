# Notification System Functions

<cite>
**Referenced Files in This Document**
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [20260226_create_whatsapp_processor_trigger.sql](file://supabase/migrations/20260226_create_whatsapp_processor_trigger.sql)
- [email-templates.ts](file://src/lib/email-templates.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [resend.ts](file://src/lib/resend.ts)
- [notifications.ts](file://src/lib/notifications.ts)
- [config.toml](file://supabase/config.toml)
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
10. [Appendices](#appendices)

## Introduction
This document describes the Notification System edge functions and multi-channel communication infrastructure for the Nutrio platform. It covers push notifications, email delivery, WhatsApp messaging, and automated notification workflows. It explains notification triggers, template management, personalization logic, delivery tracking, provider integrations, examples of notification sequences, conditional triggering, user preference handling, deliverability optimization, retry mechanisms, compliance considerations, analytics, A/B testing, and performance monitoring.

## Project Structure
The notification system spans client-side libraries, Supabase edge functions, and database triggers/migrations:
- Edge functions: WhatsApp processing pipeline
- Database: notification queue and triggers for event-driven notifications
- Client libraries: email templating, email dispatch, WhatsApp messaging, and local push notifications
- Provider integrations: Ultramsg (WhatsApp), Resend (email), Supabase Edge Functions (transport)

```mermaid
graph TB
subgraph "Client"
ET["email-templates.ts"]
ES["email-service.ts"]
WS["whatsapp.ts"]
NS["notifications.ts"]
end
subgraph "Supabase"
CFG["config.toml"]
MIG["20240103_whatsapp_notifications.sql"]
SCHED["20260226_create_whatsapp_processor_trigger.sql"]
WF["process-whatsapp-notifications/index.ts"]
end
ET --> ES
ES --> WF
WS --> WF
NS --> WF
CFG --> WF
MIG --> WF
SCHED --> WF
```

**Diagram sources**
- [email-templates.ts](file://src/lib/email-templates.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [notifications.ts](file://src/lib/notifications.ts)
- [config.toml](file://supabase/config.toml)
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [20260226_create_whatsapp_processor_trigger.sql](file://supabase/migrations/20260226_create_whatsapp_processor_trigger.sql)
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)

**Section sources**
- [email-templates.ts](file://src/lib/email-templates.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [notifications.ts](file://src/lib/notifications.ts)
- [config.toml](file://supabase/config.toml)
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [20260226_create_whatsapp_processor_trigger.sql](file://supabase/migrations/20260226_create_whatsapp_processor_trigger.sql)
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)

## Core Components
- WhatsApp edge function: processes queued notifications via Ultramsg API, updates statuses, and returns statistics.
- Database triggers and queue: enqueue WhatsApp notifications on events (delivery status changes, new deliveries, cancellations).
- Email templating and dispatch: client-side email templates and dispatch via Supabase Edge Function.
- WhatsApp client library: convenience functions for common notifications and direct chat API calls.
- Local push notifications: client-side helpers to create and categorize in-app notifications.

**Section sources**
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [email-templates.ts](file://src/lib/email-templates.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)
- [notifications.ts](file://src/lib/notifications.ts)

## Architecture Overview
The system uses event-driven triggers to enqueue notifications, an edge function to process them asynchronously, and provider APIs for delivery. Email is dispatched via a Supabase Edge Function endpoint. Push notifications are created locally in the client.

```mermaid
sequenceDiagram
participant DB as "PostgreSQL Triggers<br/>20240103_whatsapp_notifications.sql"
participant Q as "notification_queue<br/>Table"
participant WF as "Edge Function<br/>process-whatsapp-notifications/index.ts"
participant UM as "Ultramsg API"
participant Sup as "Supabase Edge Function<br/>send-email"
DB->>Q : Insert pending notifications on events
WF->>Q : SELECT pending (LIMIT 50)
WF->>UM : POST chat messages
UM-->>WF : Delivery result
WF->>Q : UPDATE status (sent/failed)
Note over WF,Q : Stats returned (processed/succeeded/failed)
ES->>Sup : POST raw email payload
Sup-->>ES : Message ID or error
```

**Diagram sources**
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [email-service.ts](file://src/lib/email-service.ts)

## Detailed Component Analysis

### WhatsApp Edge Function Pipeline
The edge function handles:
- Environment validation for provider credentials
- Fetching pending notifications from the queue
- Sending via Ultramsg chat API with phone number normalization and validation
- Updating statuses and error tracking
- Returning summary statistics

```mermaid
flowchart TD
Start(["Edge Function Entry"]) --> CheckCreds["Check provider credentials"]
CheckCreds --> |Missing| ReturnErr["Return 500 error"]
CheckCreds --> |Present| FetchPending["Fetch pending notifications (LIMIT 50)"]
FetchPending --> HasItems{"Any items?"}
HasItems --> |No| ReturnStats["Return zero stats"]
HasItems --> |Yes| Loop["For each item"]
Loop --> SendMsg["Send via Ultramsg API"]
SendMsg --> UpdateStatus{"Success?"}
UpdateStatus --> |Yes| MarkSent["UPDATE status=sent"]
UpdateStatus --> |No| MarkFailed["UPDATE status=failed + error_message"]
MarkSent --> Next["Next item"]
MarkFailed --> Next
Next --> Loop
Loop --> Done["Return processed/succeeded/failed"]
```

**Diagram sources**
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)

**Section sources**
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)

### Database Triggers and Queue
Triggers enqueue WhatsApp notifications for:
- Delivery lifecycle events (created, driver assigned, picked up, on the way, delivered, cancelled)
- New delivery availability to drivers
- Partner notifications when a driver claims a delivery

The queue table stores phone, message, template, status, timestamps, and optional error messages. Policies restrict access to service role.

```mermaid
erDiagram
NOTIFICATION_QUEUE {
uuid id PK
text phone
text message
text template
text status
text error_message
timestamptz sent_at
timestamptz created_at
timestamptz updated_at
}
```

**Diagram sources**
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)

**Section sources**
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)

### Event-Driven Notification Sequences
Common sequences:
- Customer order lifecycle: created → driver assigned → picked up → on the way → delivered
- Driver availability: new delivery → driver receives notification
- Partner notifications: driver assigned → partner receives notification

```mermaid
sequenceDiagram
participant DB as "PostgreSQL"
participant TR as "Trigger Functions"
participant Q as "notification_queue"
participant WF as "process-whatsapp-notifications"
participant UM as "Ultramsg"
DB->>TR : INSERT/UPDATE on deliveries
TR->>Q : INSERT pending notification
WF->>Q : SELECT pending
WF->>UM : Send message
UM-->>WF : Ack
WF->>Q : UPDATE status
```

**Diagram sources**
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)

**Section sources**
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)

### Email Delivery Infrastructure
- Template management: centralized HTML templates with subject and HTML generators.
- Dispatch: client-side function posts to Supabase Edge Function endpoint with JWT authorization.
- Provider integration: Resend SDK supports attachments and templated HTML.

```mermaid
sequenceDiagram
participant UI as "Client"
participant ES as "email-service.ts"
participant SF as "Supabase Edge Function"
participant RS as "Resend API"
UI->>ES : sendTemplatedEmail(options)
ES->>ES : Build subject/html from templates
ES->>SF : POST /functions/v1/send-email
SF->>RS : Forward email (configured in backend)
RS-->>SF : Message ID
SF-->>ES : {messageId}
ES-->>UI : {success, messageId}
```

**Diagram sources**
- [email-templates.ts](file://src/lib/email-templates.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [resend.ts](file://src/lib/resend.ts)

**Section sources**
- [email-templates.ts](file://src/lib/email-templates.ts)
- [email-service.ts](file://src/lib/email-service.ts)
- [resend.ts](file://src/lib/resend.ts)

### WhatsApp Messaging Library
- Direct chat API: convenience function to send text messages via Ultramsg.
- Scenario-specific helpers: customer, partner, driver, and admin notifications with preformatted messages.

```mermaid
flowchart TD
A["Caller"] --> B["sendWhatsAppMessage(message)"]
B --> C{"Credentials configured?"}
C --> |No| D["Log and return false"]
C --> |Yes| E["Normalize phone number"]
E --> F{"Valid length?"}
F --> |No| D
F --> |Yes| G["POST to Ultramsg chat API"]
G --> H{"HTTP OK?"}
H --> |Yes| I["Return true"]
H --> |No| J["Log error and return false"]
```

**Diagram sources**
- [whatsapp.ts](file://src/lib/whatsapp.ts)

**Section sources**
- [whatsapp.ts](file://src/lib/whatsapp.ts)

### Local Push Notifications
- Client-side helpers create structured notifications with type, title, message, and metadata.
- Stored in a local notifications table for retrieval and read/unread state.

```mermaid
classDiagram
class NotificationData {
+string user_id
+string type
+string title
+string message
+Record~string,any~ metadata
}
class NotificationsService {
+createNotification(data)
+notifyOrderStatusChange(userId, orderId, status, mealName)
+notifyDriverAssigned(userId, orderId, driverName)
+notifyNewDelivery(driverUserId, deliveryId, restaurantName)
}
NotificationsService --> NotificationData : "creates"
```

**Diagram sources**
- [notifications.ts](file://src/lib/notifications.ts)

**Section sources**
- [notifications.ts](file://src/lib/notifications.ts)

### Conditional Triggering and Scheduling
- Triggers fire on delivery status changes and new deliveries.
- A scheduling helper table supports periodic invocation of the WhatsApp processor when external cron is unavailable.

```mermaid
flowchart TD
T["Delivery Status Change"] --> TRG["Trigger fires"]
TRG --> QUEUE["Insert into notification_queue"]
QUEUE --> CRON["Scheduler (pg_cron or schedule table)"]
CRON --> WF["Invoke process-whatsapp-notifications"]
```

**Diagram sources**
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [20260226_create_whatsapp_processor_trigger.sql](file://supabase/migrations/20260226_create_whatsapp_processor_trigger.sql)

**Section sources**
- [20260226_create_whatsapp_processor_trigger.sql](file://supabase/migrations/20260226_create_whatsapp_processor_trigger.sql)

## Dependency Analysis
- Edge function depends on Supabase client and environment variables for provider credentials.
- Triggers depend on database relations (profiles, restaurants, drivers, meal_schedules) to construct messages.
- Client libraries depend on environment variables for provider keys and Supabase endpoints.

```mermaid
graph LR
WF["process-whatsapp-notifications/index.ts"] --> ENV["Environment Variables"]
WF --> SB["Supabase Client"]
WF --> UM["Ultramsg API"]
TR["Triggers (20240103_whatsapp_notifications.sql)"] --> DB["PostgreSQL"]
TR --> Q["notification_queue"]
ES["email-service.ts"] --> SF["Supabase Edge Function"]
ES --> RS["Resend API"]
WS["whatsapp.ts"] --> UM
```

**Diagram sources**
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [email-service.ts](file://src/lib/email-service.ts)
- [resend.ts](file://src/lib/resend.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)

**Section sources**
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [email-service.ts](file://src/lib/email-service.ts)
- [resend.ts](file://src/lib/resend.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)

## Performance Considerations
- Batch processing: the edge function limits batch size to reduce latency and resource usage.
- Indexing: pending notifications are indexed to optimize selection queries.
- Asynchronous delivery: triggers enqueue work for later processing to keep transaction times low.
- Retry and backoff: implement exponential backoff at the provider level and consider reprocessing failed items periodically.
- Rate limiting: adhere to provider rate limits; consider jitter and throttling in client libraries.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Missing provider credentials: the edge function returns a 500 error when provider tokens are not configured.
- Invalid phone numbers: normalized and validated before sending; ensure E.164 format.
- Database permission errors: queue table enforces RLS for service role; verify policies and roles.
- Email dispatch failures: check Supabase Edge Function logs and provider error responses.
- Delivery tracking: inspect queue status updates and error messages for failed items.

**Section sources**
- [index.ts](file://supabase/functions/process-whatsapp-notifications/index.ts)
- [20240103_whatsapp_notifications.sql](file://supabase/migrations/20240103_whatsapp_notifications.sql)
- [email-service.ts](file://src/lib/email-service.ts)

## Conclusion
The Notification System combines database triggers, an edge function pipeline, and provider integrations to deliver reliable, scalable, and event-driven communications across WhatsApp, email, and in-app push channels. The modular design enables maintainable templates, robust delivery tracking, and extensibility for additional channels.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Template Management and Personalization
- Email templates define subject and HTML content builders; personalization data is injected at render time.
- WhatsApp messages are constructed from scenario-specific helpers with placeholders for names, IDs, and locations.

**Section sources**
- [email-templates.ts](file://src/lib/email-templates.ts)
- [whatsapp.ts](file://src/lib/whatsapp.ts)

### Compliance and Deliverability
- Validate phone numbers and sanitize inputs.
- Respect opt-out preferences and implement unsubscribe mechanisms.
- Monitor provider deliverability and abuse signals; implement retry and suppression lists.
- Store minimal PII and ensure encryption at rest and in transit.

[No sources needed since this section provides general guidance]

### Analytics, A/B Testing, and Monitoring
- Track delivery metrics: processed, succeeded, failed counts per run.
- Attribute events to templates and channels for funnel analysis.
- A/B test message copy, timing, and channel preferences.
- Monitor error rates, latency, and provider SLAs; alert on anomalies.

[No sources needed since this section provides general guidance]