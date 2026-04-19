# Push Notification System

<cite>
**Referenced Files in This Document**
- [push.ts](file://src/lib/notifications/push.ts)
- [push.test.ts](file://src/lib/notifications/push.test.ts)
- [notifications.ts](file://src/lib/notifications.ts)
- [NotificationPreferences.tsx](file://src/components/NotificationPreferences.tsx)
- [usePushNotificationDeepLink.ts](file://src/hooks/usePushNotificationDeepLink.ts)
- [send-push-notification/index.ts](file://supabase/functions/send-push-notification/index.ts)
- [send-meal-reminders/index.ts](file://supabase/functions/send-meal-reminders/index.ts)
- [add_notification_preferences.sql](file://supabase/migrations/20240101000000_add_notification_preferences.sql)
- [fix_homepage_errors.sql](file://supabase/migrations/20260223000005_fix_homepage_errors.sql)
- [fix_notifications_user_fk_to_auth.sql](file://supabase/migrations/20260303144000_fix_notifications_user_fk_to_auth.sql)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Firebase Cloud Messaging Integration](#firebase-cloud-messaging-integration)
5. [Notification Payload Structure](#notification-payload-structure)
6. [Notification Types and Handling](#notification-types-and-handling)
7. [Notification Preferences System](#notification-preferences-system)
8. [Deep Linking Implementation](#deep-linking-implementation)
9. [Local vs Push Notifications](#local-vs-push-notifications)
10. [Notification Scheduling](#notification-scheduling)
11. [Platform-Specific Features](#platform-specific-features)
12. [Analytics and Tracking](#analytics-and-tracking)
13. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
14. [Best Practices](#best-practices)
15. [Conclusion](#conclusion)

## Introduction

The Nutrio mobile application implements a comprehensive push notification system built on Firebase Cloud Messaging (FCM) for both iOS and Android platforms. This system provides real-time communication capabilities, personalized user experiences, and seamless integration with the application's core features including order management, meal scheduling, and user engagement.

The notification system consists of three main layers: client-side integration for mobile platforms, server-side functions for message delivery, and database infrastructure for user preferences and token management. The system supports both immediate push notifications and scheduled local notifications, with sophisticated preference management and deep linking capabilities.

## System Architecture

The push notification system follows a distributed architecture with clear separation of concerns across client, server, and database layers:

```mermaid
graph TB
subgraph "Client Layer"
A[Mobile App - Capacitor]
B[Push Notification Service]
C[Deep Link Handler]
D[Local Notification Manager]
end
subgraph "Server Layer"
E[Supabase Functions]
F[Send Push Notification]
G[Meal Reminder Scheduler]
H[Notification Processor]
end
subgraph "Database Layer"
I[PostgreSQL]
J[Push Tokens Table]
K[Notification Preferences]
L[Notifications Queue]
end
subgraph "External Services"
M[Firebase Cloud Messaging]
N[Apple APNs]
O[Google FCM]
end
A --> B
B --> C
B --> D
E --> F
E --> G
E --> H
F --> M
G --> M
H --> M
B --> J
C --> L
D --> L
F --> J
G --> K
H --> I
J --> I
K --> I
L --> I
```

**Diagram sources**
- [push.ts:13-75](file://src/lib/notifications/push.ts#L13-L75)
- [send-push-notification/index.ts:178-299](file://supabase/functions/send-push-notification/index.ts#L178-L299)
- [add_notification_preferences.sql:45-56](file://supabase/migrations/20240101000000_add_notification_preferences.sql#L45-L56)

## Core Components

### Push Notification Service

The core push notification service is implemented as a singleton class that manages FCM token registration, permission handling, and notification lifecycle on native platforms.

```mermaid
classDiagram
class PushNotificationService {
-static instance : PushNotificationService
-fcmToken : string
-initialized : boolean
+initialize() Promise~void~
+getToken() string
+isInitialized() boolean
-saveTokenToDatabase(token : string) Promise~void~
-handleNotificationTap(data : PushNotificationData) void
}
class PushNotificationData {
+type : string
+orderId : string
+status : string
+title : string
+body : string
}
PushNotificationService --> PushNotificationData : "processes"
```

**Diagram sources**
- [push.ts:13-134](file://src/lib/notifications/push.ts#L13-L134)

The service handles platform detection, permission requests, token registration, and event listeners for notification actions. It maintains a singleton pattern to ensure consistent state management across the application lifecycle.

**Section sources**
- [push.ts:13-134](file://src/lib/notifications/push.ts#L13-L134)
- [push.test.ts:50-232](file://src/lib/notifications/push.test.ts#L50-L232)

### Notification Preferences System

The notification preferences system allows users to control which types of notifications they receive across different channels (push, email, SMS, WhatsApp).

```mermaid
classDiagram
class NotificationPreferences {
+order_updates_push : boolean
+order_updates_email : boolean
+order_updates_whatsapp : boolean
+delivery_updates_push : boolean
+delivery_updates_email : boolean
+delivery_updates_whatsapp : boolean
+promotions_email : boolean
+reminders_push : boolean
}
class PreferenceCategories {
+title : string
+description : string
+keys : object
}
NotificationPreferences --> PreferenceCategories : "organized by"
```

**Diagram sources**
- [NotificationPreferences.tsx:17-37](file://src/components/NotificationPreferences.tsx#L17-L37)

**Section sources**
- [NotificationPreferences.tsx:39-197](file://src/components/NotificationPreferences.tsx#L39-L197)
- [add_notification_preferences.sql:9-35](file://supabase/migrations/20240101000000_add_notification_preferences.sql#L9-L35)

## Firebase Cloud Messaging Integration

### Platform Setup and Configuration

The system integrates with Firebase Cloud Messaging through Capacitor plugins, supporting both iOS and Android platforms with platform-specific configurations.

```mermaid
sequenceDiagram
participant App as Mobile App
participant Service as Push Service
participant Capacitor as Capacitor Plugin
participant FCM as Firebase Cloud Messaging
participant Server as Supabase Server
App->>Service : initialize()
Service->>Capacitor : checkPermissions()
Capacitor-->>Service : Permission Status
Service->>Capacitor : requestPermissions() (if needed)
Service->>Capacitor : register()
Capacitor->>FCM : Register Device
FCM-->>Capacitor : FCM Token
Capacitor-->>Service : Token Callback
Service->>Server : saveTokenToDatabase()
Server-->>Service : Confirmation
```

**Diagram sources**
- [push.ts:25-75](file://src/lib/notifications/push.ts#L25-L75)

### Token Management and Storage

The system maintains FCM tokens in a dedicated database table with platform-specific metadata and automatic deactivation of invalid tokens.

**Section sources**
- [push.ts:77-108](file://src/lib/notifications/push.ts#L77-L108)
- [add_notification_preferences.sql:45-56](file://supabase/migrations/20240101000000_add_notification_preferences.sql#L45-L56)

## Notification Payload Structure

### Standard Notification Payload

The notification system supports structured payloads with flexible data fields for deep linking and contextual information.

```mermaid
classDiagram
class NotificationPayload {
+user_id : string
+title : string
+message : string
+type : string
+data : object
+notification_id : string
}
class FCMMessage {
+message : object
+token : string
+notification : object
+android : object
+apns : object
+data : object
}
NotificationPayload --> FCMMessage : "transforms to"
```

**Diagram sources**
- [send-push-notification/index.ts:7-42](file://supabase/functions/send-push-notification/index.ts#L7-L42)

### Platform-Specific Configurations

The system implements platform-specific configurations for optimal delivery across iOS and Android devices.

**Section sources**
- [send-push-notification/index.ts:129-154](file://supabase/functions/send-push-notification/index.ts#L129-L154)

## Notification Types and Handling

### Supported Notification Types

The system supports multiple notification types tailored to different user journeys and business scenarios:

| Type | Description | Platform Support |
|------|-------------|------------------|
| `order_update` | Order status changes and updates | iOS, Android |
| `delivery_update` | Driver assignment and delivery progress | iOS, Android |
| `promotion` | Marketing offers and promotional content | iOS, Android |
| `reminder` | Meal scheduling and reminder notifications | iOS, Android |
| `meal_reminder` | Scheduled meal notifications | iOS, Android |

### Notification Processing Flow

```mermaid
flowchart TD
A[Notification Received] --> B{Type Check}
B --> |order_update| C[Order Tracking Deep Link]
B --> |delivery_update| D[Delivery Tracking Deep Link]
B --> |promotion| E[Meals Page Deep Link]
B --> |reminder| F[Schedule Page Deep Link]
B --> |other| G[Generic Handler]
C --> H[Update UI State]
D --> H
E --> H
F --> H
G --> H
H --> I[Show Toast Notification]
I --> J[Update Local Storage]
```

**Diagram sources**
- [push.ts:110-125](file://src/lib/notifications/push.ts#L110-L125)

**Section sources**
- [push.ts:5-11](file://src/lib/notifications/push.ts#L5-L11)
- [push.ts:110-125](file://src/lib/notifications/push.ts#L110-L125)

## Notification Preferences System

### Preference Categories and Defaults

The notification preferences system organizes user preferences into logical categories with sensible defaults:

```mermaid
graph LR
subgraph "Order Updates"
A1[Push: Enabled]
A2[Email: Enabled]
A3[WhatsApp: Enabled]
end
subgraph "Delivery Updates"
B1[Push: Enabled]
B2[Email: Disabled]
B3[WhatsApp: Enabled]
end
subgraph "Promotions"
C1[Email: Enabled]
end
subgraph "Reminders"
D1[Push: Enabled]
end
```

**Diagram sources**
- [NotificationPreferences.tsx:28-37](file://src/components/NotificationPreferences.tsx#L28-L37)

### Preference Persistence and Validation

The system ensures preference persistence through database transactions with automatic validation and error handling.

**Section sources**
- [NotificationPreferences.tsx:51-83](file://src/components/NotificationPreferences.tsx#L51-L83)
- [add_notification_preferences.sql:9-35](file://supabase/migrations/20240101000000_add_notification_preferences.sql#L9-L35)

## Deep Linking Implementation

### Deep Link Routes and Navigation

The deep linking system provides seamless navigation from notifications to relevant application screens:

```mermaid
classDiagram
class DeepLinkRoutes {
+order_detail : string
+order_history : string
+delivery_tracking : string
+subscription : string
+meals : string
+schedule : string
+progress : string
+profile : string
}
class PushNotificationData {
+type : DeepLinkRoute
+id : string
+params : object
+title : string
+body : string
}
class DeepLinkHandler {
+handleDeepLink(data : PushNotificationData) void
+storePendingDeepLink(data : PushNotificationData) void
+checkPendingDeepLink() void
}
DeepLinkRoutes --> PushNotificationData : "maps to"
DeepLinkHandler --> PushNotificationData : "processes"
```

**Diagram sources**
- [usePushNotificationDeepLink.ts:5-49](file://src/hooks/usePushNotificationDeepLink.ts#L5-L49)
- [usePushNotificationDeepLink.ts:51-127](file://src/hooks/usePushNotificationDeepLink.ts#L51-L127)

### Template-Based Notifications

The system provides template functions for common notification patterns:

**Section sources**
- [usePushNotificationDeepLink.ts:149-194](file://src/hooks/usePushNotificationDeepLink.ts#L149-L194)

## Local vs Push Notifications

### Local Notification Management

The system distinguishes between push notifications (server-delivered) and local notifications (device-stored):

```mermaid
flowchart TD
A[Notification Trigger] --> B{Type}
B --> |Push| C[Server-Side Processing]
B --> |Local| D[Device-Side Processing]
C --> E[Send to FCM]
E --> F[Store in Database]
F --> G[Deliver to Device]
D --> H[Schedule on Device]
H --> I[Store in Local Queue]
I --> J[Trigger at Scheduled Time]
```

**Diagram sources**
- [notifications.ts:18-35](file://src/lib/notifications.ts#L18-L35)

### Notification Creation Helpers

The system provides helper functions for creating notifications with appropriate metadata and status tracking.

**Section sources**
- [notifications.ts:18-114](file://src/lib/notifications.ts#L18-L114)

## Notification Scheduling

### Scheduled Notification System

The system implements a robust scheduling mechanism for recurring and time-based notifications:

```mermaid
sequenceDiagram
participant Scheduler as Meal Reminder Scheduler
participant Database as PostgreSQL
participant NotificationQueue as Notification Queue
participant Users as Users
Scheduler->>Database : Check Platform Settings
Scheduler->>Database : Fetch Today's Meal Schedules
Scheduler->>Database : Filter by User Preferences
Scheduler->>Database : Create Notification Records
Database-->>Scheduler : Confirm Insertion
Scheduler->>NotificationQueue : Queue for Delivery
NotificationQueue->>Users : Deliver Push Notifications
```

**Diagram sources**
- [send-meal-reminders/index.ts:29-228](file://supabase/functions/send-meal-reminders/index.ts#L29-L228)

### Platform Settings Integration

The scheduler respects global platform settings for notification delivery, allowing administrators to enable or disable push notifications system-wide.

**Section sources**
- [send-meal-reminders/index.ts:44-68](file://supabase/functions/send-meal-reminders/index.ts#L44-L68)

## Platform-Specific Features

### iOS Integration

iOS-specific configurations include APNs payload optimization and platform-specific notification channels.

### Android Integration

Android-specific features include notification channel management and FCM-specific configurations.

### Cross-Platform Considerations

The system maintains consistent behavior across platforms while leveraging platform-specific capabilities for optimal user experience.

## Analytics and Tracking

### Notification Analytics Infrastructure

The system tracks notification delivery, engagement, and user interaction through integrated analytics:

```mermaid
graph TB
A[Notification Sent] --> B[Delivery Tracking]
B --> C[User Engagement]
C --> D[Deep Link Clicks]
D --> E[Conversion Tracking]
F[Platform Metrics] --> G[Delivery Rates]
F --> H[Open Rates]
F --> I[Bounce Rates]
G --> J[Analytics Dashboard]
H --> J
I --> J
E --> J
```

## Common Issues and Troubleshooting

### Token Registration Problems

Common issues include permission denials, invalid tokens, and platform-specific registration failures. The system implements comprehensive error handling and fallback mechanisms.

### Delivery Failures

The system automatically deactivates invalid tokens and provides detailed error reporting for troubleshooting delivery issues.

### Performance Optimization

The system includes token cleanup functions and optimized query patterns to maintain performance at scale.

## Best Practices

### User Experience Guidelines

- Respect user preferences and provide clear opt-out mechanisms
- Use meaningful notification content with clear call-to-action
- Implement proper deep linking for seamless navigation
- Test across multiple platforms and devices
- Monitor delivery rates and user engagement metrics

### Technical Implementation Guidelines

- Maintain token validity through regular cleanup and deactivation
- Implement proper error handling and retry mechanisms
- Use structured logging for debugging and monitoring
- Follow platform-specific notification guidelines and restrictions
- Ensure data privacy and compliance with applicable regulations

### Monitoring and Maintenance

Regular monitoring of notification delivery rates, user engagement metrics, and system performance helps maintain optimal notification service quality.

## Conclusion

The Nutrio push notification system provides a comprehensive, scalable solution for real-time communication across iOS and Android platforms. Through careful architecture design, platform-specific optimizations, and robust preference management, the system delivers reliable, engaging user experiences while maintaining technical excellence and operational efficiency.

The integration of Firebase Cloud Messaging, Supabase backend services, and React-based frontend components creates a cohesive ecosystem that supports both immediate notifications and sophisticated scheduling capabilities. With comprehensive analytics, error handling, and platform-specific optimizations, the system is well-positioned to support Nutrio's growth and evolving user needs.