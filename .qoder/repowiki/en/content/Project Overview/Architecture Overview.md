# Architecture Overview

<cite>
**Referenced Files in This Document**
- [App.tsx](file://src/App.tsx)
- [main.tsx](file://src/main.tsx)
- [AuthContext.tsx](file://src/contexts/AuthContext.tsx)
- [ProtectedRoute.tsx](file://src/components/ProtectedRoute.tsx)
- [client.ts](file://src/integrations/supabase/client.ts)
- [delivery.ts](file://src/integrations/supabase/delivery.ts)
- [notifications.ts](file://src/lib/notifications.ts)
- [capacitor.config.ts](file://capacitor.config.ts)
- [package.json](file://package.json)
- [config.toml](file://supabase/config.toml)
- [send-meal-reminders/index.ts](file://supabase/functions/send-meal-reminders/index.ts)
- [routes.tsx](file://src/fleet/routes.tsx)
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
This document describes the Nutrio platform architecture with a focus on the multi-portal system design and component interactions. The platform comprises:
- A React single-page application with multi-tenant routing across customer, partner, admin, driver, and fleet portals
- A Supabase backend providing authentication, relational data, and edge functions
- Native mobile applications powered by Capacitor for Android and iOS
- Real-time data synchronization via Supabase Realtime and WebSocket connections
- Role-based access control (RBAC) spanning all user portals
- Microservices implemented as Supabase edge functions

## Project Structure
The repository is organized around a frontend monorepo with shared components, contexts, integrations, and hooks, plus a Supabase backend with edge functions and configuration. Native mobile builds are integrated via Capacitor.

```mermaid
graph TB
subgraph "Frontend Layer"
A_App["App.tsx"]
A_Main["main.tsx"]
A_Contexts["AuthContext.tsx<br/>ProtectedRoute.tsx"]
A_SupabaseClient["integrations/supabase/client.ts"]
A_DeliveryLib["integrations/supabase/delivery.ts"]
A_NotificationsLib["lib/notifications.ts"]
A_FleetRoutes["fleet/routes.tsx"]
end
subgraph "Backend Layer"
B_Supabase["Supabase Backend"]
B_Edge["Edge Functions<br/>config.toml"]
end
subgraph "Mobile Layer"
M_Capacitor["Capacitor Config<br/>capacitor.config.ts"]
M_Native["Native Plugins<br/>(Push, Biometric, etc.)"]
end
A_App --> A_Contexts
A_App --> A_SupabaseClient
A_App --> A_FleetRoutes
A_Contexts --> A_SupabaseClient
A_SupabaseClient --> B_Supabase
A_DeliveryLib --> B_Supabase
A_NotificationsLib --> B_Supabase
B_Edge --> B_Supabase
M_Capacitor --> A_App
M_Native --> A_App
```

**Diagram sources**
- [App.tsx:139-739](file://src/App.tsx#L139-L739)
- [main.tsx:20-50](file://src/main.tsx#L20-L50)
- [AuthContext.tsx:31-131](file://src/contexts/AuthContext.tsx#L31-L131)
- [ProtectedRoute.tsx:139-230](file://src/components/ProtectedRoute.tsx#L139-L230)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)
- [delivery.ts:695-734](file://src/integrations/supabase/delivery.ts#L695-L734)
- [notifications.ts:18-35](file://src/lib/notifications.ts#L18-L35)
- [routes.tsx:20-42](file://src/fleet/routes.tsx#L20-L42)
- [capacitor.config.ts:3-45](file://capacitor.config.ts#L3-L45)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)

**Section sources**
- [App.tsx:139-739](file://src/App.tsx#L139-L739)
- [main.tsx:20-50](file://src/main.tsx#L20-L50)
- [capacitor.config.ts:3-45](file://capacitor.config.ts#L3-L45)
- [package.json:44-127](file://package.json#L44-L127)

## Core Components
- App shell and routing: Defines portal-specific routes and wraps protected content with layout providers and guards.
- Authentication and RBAC: Centralized provider manages session state and role resolution with caching and approval checks.
- Supabase integration: Typed client with Capacitor-native storage and Realtime subscriptions.
- Edge functions: Serverless microservices for notifications, analytics, and operational tasks.
- Native mobile integration: Capacitor configuration and plugin wrappers for push, biometrics, and device APIs.

**Section sources**
- [App.tsx:139-739](file://src/App.tsx#L139-L739)
- [AuthContext.tsx:31-131](file://src/contexts/AuthContext.tsx#L31-L131)
- [ProtectedRoute.tsx:139-230](file://src/components/ProtectedRoute.tsx#L139-L230)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)
- [capacitor.config.ts:3-45](file://capacitor.config.ts#L3-L45)

## Architecture Overview
The system follows a layered architecture:
- Frontend layer: React SPA with React Router, TanStack Query for caching, and Supabase client for auth/data/realtime.
- Backend layer: Supabase providing Postgres, Auth, Storage, and Edge Functions (Deno runtime).
- Mobile layer: Capacitor-powered native apps with device plugins and secure storage.

```mermaid
graph TB
subgraph "User Portals"
U_Customer["Customer Portal"]
U_Partner["Partner Portal"]
U_Admin["Admin Portal"]
U_Driver["Driver Portal"]
U_Fleet["Fleet Portal"]
end
subgraph "Frontend"
F_Router["React Router"]
F_Query["TanStack Query"]
F_Supabase["Supabase Client"]
F_Auth["AuthContext"]
F_RBAC["ProtectedRoute"]
end
subgraph "Backend"
B_Postgres["Postgres DB"]
B_Auth["Supabase Auth"]
B_Realtime["Realtime Subscriptions"]
B_Edge["Edge Functions (Deno)"]
end
subgraph "Mobile"
M_Cap["Capacitor Runtime"]
M_Plugins["Push/Biometric/Keyboard/etc."]
end
U_Customer --> F_Router
U_Partner --> F_Router
U_Admin --> F_Router
U_Driver --> F_Router
U_Fleet --> F_Router
F_Router --> F_Auth
F_Router --> F_RBAC
F_Auth --> F_Supabase
F_RBAC --> F_Supabase
F_Supabase --> B_Postgres
F_Supabase --> B_Auth
F_Supabase --> B_Realtime
B_Edge --> B_Postgres
B_Edge --> B_Auth
M_Cap --> F_Router
M_Plugins --> F_Auth
M_Plugins --> F_Supabase
```

**Diagram sources**
- [App.tsx:139-739](file://src/App.tsx#L139-L739)
- [AuthContext.tsx:31-131](file://src/contexts/AuthContext.tsx#L31-L131)
- [ProtectedRoute.tsx:139-230](file://src/components/ProtectedRoute.tsx#L139-L230)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)
- [capacitor.config.ts:3-45](file://capacitor.config.ts#L3-L45)

## Detailed Component Analysis

### Multi-Portal Routing and Layouts
- The App defines routes per portal, with lazy-loaded pages and protected routes. Customer routes are wrapped in a layout container, while admin, partner, driver, and fleet routes use dedicated layouts and nested routes.
- ProtectedRoute enforces role-based access and optional approval checks for partner routes, with role caching to reduce repeated database queries.

```mermaid
flowchart TD
Start(["Route Change"]) --> CheckAuth["Check Auth State"]
CheckAuth --> |Not Authenticated| RedirectAuth["Redirect to /auth"]
CheckAuth --> |Authenticated| CheckRole["Resolve Roles"]
CheckRole --> HasRole{"Has Required Role?"}
HasRole --> |No| RedirectByRole["Redirect to user's portal"]
HasRole --> |Yes| CheckApproval{"Require Approval?"}
CheckApproval --> |Yes & Not Approved| RedirectPending["Redirect to /partner/pending-approval"]
CheckApproval --> |No or Approved| Render["Render Protected Page"]
RedirectAuth --> End(["End"])
RedirectByRole --> End
RedirectPending --> End
Render --> End
```

**Diagram sources**
- [ProtectedRoute.tsx:139-230](file://src/components/ProtectedRoute.tsx#L139-L230)
- [App.tsx:174-724](file://src/App.tsx#L174-L724)

**Section sources**
- [App.tsx:174-724](file://src/App.tsx#L174-L724)
- [ProtectedRoute.tsx:139-230](file://src/components/ProtectedRoute.tsx#L139-L230)

### Authentication and Authorization Flow
- AuthContext initializes Supabase auth listeners and session persistence. It supports sign-up/sign-in and integrates IP location checks before login.
- ProtectedRoute resolves user roles from multiple sources (roles table, ownership of restaurants, driver records) and caches results. It redirects unauthorized users to appropriate dashboards.

```mermaid
sequenceDiagram
participant Browser as "Browser/Web"
participant App as "App Shell"
participant Auth as "AuthContext"
participant Supabase as "Supabase Auth"
participant DB as "Postgres"
Browser->>App : Load page
App->>Auth : Initialize Auth Provider
Auth->>Supabase : onAuthStateChange()
Supabase-->>Auth : Session event
Auth->>Supabase : getSession()
Supabase-->>Auth : Stored session
Auth-->>App : user/session/loading
App->>App : Render ProtectedRoute
App->>DB : Resolve roles (user_roles, restaurants, drivers)
DB-->>App : Roles list
App-->>Browser : Render portal content
```

**Diagram sources**
- [AuthContext.tsx:36-61](file://src/contexts/AuthContext.tsx#L36-L61)
- [AuthContext.tsx:63-118](file://src/contexts/AuthContext.tsx#L63-L118)
- [ProtectedRoute.tsx:40-98](file://src/components/ProtectedRoute.tsx#L40-L98)

**Section sources**
- [AuthContext.tsx:31-131](file://src/contexts/AuthContext.tsx#L31-L131)
- [ProtectedRoute.tsx:139-230](file://src/components/ProtectedRoute.tsx#L139-L230)

### Real-Time Data Synchronization
- Supabase Realtime enables live updates for delivery jobs and driver locations. The frontend subscribes to channels and reacts to row-level changes.
- Notifications are persisted to the database and can trigger push notifications via edge functions.

```mermaid
sequenceDiagram
participant Client as "Frontend Component"
participant Supabase as "Supabase Client"
participant Realtime as "Realtime Channel"
participant DB as "Postgres"
Client->>Supabase : subscribeToDeliveryUpdates(scheduleId, callback)
Supabase->>Realtime : join channel "delivery-{scheduleId}"
DB->>Realtime : UPDATE on delivery_jobs
Realtime-->>Client : payload (row change)
Client->>Client : Update UI state
Client->>Supabase : subscribeToDriverLocation(driverId, callback)
DB->>Realtime : INSERT on driver_locations
Realtime-->>Client : payload (location update)
Client->>Client : Update map/markers
```

**Diagram sources**
- [delivery.ts:695-734](file://src/integrations/supabase/delivery.ts#L695-L734)
- [notifications.ts:18-35](file://src/lib/notifications.ts#L18-L35)

**Section sources**
- [delivery.ts:695-734](file://src/integrations/supabase/delivery.ts#L695-L734)
- [notifications.ts:18-35](file://src/lib/notifications.ts#L18-L35)

### Supabase Edge Functions and Microservices
- Edge functions are Deno-based and deployed under Supabase Functions. They encapsulate domain logic such as sending meal reminders, processing subscriptions, and managing notifications.
- The configuration file controls JWT verification flags per function.

```mermaid
flowchart TD
Trigger["Scheduled Event / Webhook"] --> EdgeFn["Edge Function (Deno)"]
EdgeFn --> Supabase["Supabase Client (Service Role)"]
Supabase --> DB["Postgres"]
DB --> EdgeFn
EdgeFn --> EdgeFn["Business Logic<br/>Notifications / Calculations"]
EdgeFn --> Supabase
Supabase --> DB
DB --> EdgeFn
EdgeFn --> Response["HTTP Response / Logs"]
```

**Diagram sources**
- [send-meal-reminders/index.ts:29-228](file://supabase/functions/send-meal-reminders/index.ts#L29-L228)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)

**Section sources**
- [send-meal-reminders/index.ts:29-228](file://supabase/functions/send-meal-reminders/index.ts#L29-L228)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)

### Native Mobile Applications
- Capacitor configuration allows the web app to run natively on Android and iOS, with secure storage for sessions and device plugin integrations for push notifications, biometrics, and keyboard behavior.
- The main entry initializes monitoring, native app setup, and language provider before rendering the App shell.

```mermaid
sequenceDiagram
participant Capacitor as "Capacitor Runtime"
participant Main as "main.tsx"
participant App as "App Shell"
participant Supabase as "Supabase Client"
participant Plugins as "Device Plugins"
Capacitor->>Main : Launch app
Main->>Main : initSentry(), initPostHog(), initializeNativeApp()
Main->>App : Render Root wrapper
App->>Supabase : Create client with Capacitor storage
App->>Plugins : Initialize push/biometric/native features
App-->>Capacitor : Render UI
```

**Diagram sources**
- [main.tsx:13-50](file://src/main.tsx#L13-L50)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)
- [capacitor.config.ts:3-45](file://capacitor.config.ts#L3-L45)

**Section sources**
- [main.tsx:13-50](file://src/main.tsx#L13-L50)
- [capacitor.config.ts:3-45](file://capacitor.config.ts#L3-L45)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)

## Dependency Analysis
- Frontend depends on Supabase JS SDK, React Router, TanStack Query, and Capacitor plugins.
- Supabase provides the backend primitives: Auth, Postgres, Realtime, and Functions.
- Edge functions depend on Supabase service role keys and environment variables.

```mermaid
graph LR
Frontend["Frontend (React)"] --> SupabaseJS["@supabase/supabase-js"]
Frontend --> Router["react-router-dom"]
Frontend --> Query["@tanstack/react-query"]
Frontend --> Capacitor["@capacitor/*"]
SupabaseJS --> SupabaseBackend["Supabase Backend"]
SupabaseBackend --> Postgres["Postgres"]
SupabaseBackend --> Auth["Auth"]
SupabaseBackend --> Realtime["Realtime"]
SupabaseBackend --> Functions["Edge Functions"]
EdgeFunctions["Edge Functions"] --> SupabaseBackend
```

**Diagram sources**
- [package.json:93, 120, 122:93-122](file://package.json#L93-L122)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)

**Section sources**
- [package.json:44-127](file://package.json#L44-L127)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)

## Performance Considerations
- Role caching: ProtectedRoute caches resolved roles to minimize repeated database queries.
- Lazy loading: Routes use lazy-loaded components to reduce initial bundle size.
- TanStack Query: Centralized caching and background refetching improve perceived performance.
- Capacitor storage: Uses native preferences to avoid web storage limitations on mobile devices.
- Edge functions: Serverless compute reduces cold starts by keeping functions warm and leveraging Supabase’s infrastructure.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication failures: Verify Supabase URL and publishable key are present in the build environment; check AuthContext initialization and session persistence.
- Role resolution issues: Confirm user_roles, restaurants, and drivers tables contain expected data; review ProtectedRoute role cache TTL and invalidation.
- Realtime connectivity: Ensure channels are joined after authentication; verify filters and schema/table names in subscriptions.
- Edge function errors: Inspect logs for function-specific errors; validate environment variables and JWT verification settings.
- Native app issues: Confirm Capacitor configuration allows navigation to Supabase domains and plugins are initialized before use.

**Section sources**
- [client.ts:10-16](file://src/integrations/supabase/client.ts#L10-L16)
- [AuthContext.tsx:36-61](file://src/contexts/AuthContext.tsx#L36-L61)
- [ProtectedRoute.tsx:40-98](file://src/components/ProtectedRoute.tsx#L40-L98)
- [delivery.ts:695-734](file://src/integrations/supabase/delivery.ts#L695-L734)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)
- [capacitor.config.ts:7-17](file://capacitor.config.ts#L7-L17)

## Conclusion
Nutrio’s architecture leverages a React frontend with multi-portal routing, Supabase as the unified backend, and Capacitor for native experiences. Role-based access control is enforced centrally, while Supabase Realtime and edge functions enable responsive, scalable data flows. This design balances developer productivity with strong separation of concerns across frontend, backend, and mobile layers.