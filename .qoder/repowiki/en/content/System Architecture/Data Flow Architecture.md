# Data Flow Architecture

<cite>
**Referenced Files in This Document**
- [App.tsx](file://src/App.tsx)
- [main.tsx](file://src/main.tsx)
- [client.ts](file://src/integrations/supabase/client.ts)
- [delivery.ts](file://src/integrations/supabase/delivery.ts)
- [types.ts](file://src/integrations/supabase/types.ts)
- [PHASE2_EDGE_FUNCTIONS.md](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md)
- [config.toml](file://supabase/config.toml)
- [cache.ts](file://src/lib/cache.ts)
- [trackingSocket.ts](file://src/fleet/services/trackingSocket.ts)
- [package.json](file://websocket-server/package.json)
- [realtime.spec.ts](file://e2e/system/realtime.spec.ts)
- [SECURITY_REMEDIATION_REPORT.md](file://SECURITY_REMEDIATION_REPORT.md)
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
This document describes the data flow architecture of the Nutrio system, covering how user interactions propagate through frontend components, backend services, database operations, and real-time updates. It documents state management patterns, data synchronization strategies, caching mechanisms, Supabase Realtime for live updates, Supabase Edge Functions for serverless processing, and WebSocket connections for real-time features. It also explains validation, transformation, and security considerations across all stages.

## Project Structure
The system comprises:
- Frontend application bootstrapped in main.tsx, wrapped by providers for routing, authentication, analytics, and error boundaries.
- Supabase integration for authentication, database access, and real-time subscriptions.
- Supabase Edge Functions for automated workflows.
- Fleet WebSocket server for real-time driver tracking and fleet management.
- Caching layer for frequently accessed data.

```mermaid
graph TB
subgraph "Frontend"
A["main.tsx<br/>Bootstraps app"]
B["App.tsx<br/>Routing + Providers"]
C["Supabase Client<br/>client.ts"]
D["Realtime Subscriptions<br/>delivery.ts"]
E["Cache Layer<br/>cache.ts"]
end
subgraph "Backend"
F["Supabase Platform<br/>PostgreSQL + RLS"]
G["Edge Functions<br/>PHASE2_EDGE_FUNCTIONS.md"]
H["WebSocket Server<br/>trackingSocket.ts + package.json"]
end
A --> B
B --> C
C --> F
D --> F
E --> C
G --> F
H --> F
```

**Diagram sources**
- [main.tsx:1-50](file://src/main.tsx#L1-L50)
- [App.tsx:139-739](file://src/App.tsx#L139-L739)
- [client.ts:1-57](file://src/integrations/supabase/client.ts#L1-L57)
- [delivery.ts:1-735](file://src/integrations/supabase/delivery.ts#L1-L735)
- [cache.ts:1-199](file://src/lib/cache.ts#L1-L199)
- [PHASE2_EDGE_FUNCTIONS.md:1-411](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L1-L411)
- [trackingSocket.ts:36-214](file://src/fleet/services/trackingSocket.ts#L36-L214)
- [package.json:1-44](file://websocket-server/package.json#L1-L44)

**Section sources**
- [main.tsx:1-50](file://src/main.tsx#L1-L50)
- [App.tsx:139-739](file://src/App.tsx#L139-L739)

## Core Components
- Supabase client initialization with Capacitor-native storage for sessions and auto-refresh.
- Real-time subscriptions for delivery updates and driver locations.
- Edge Functions for automated workflows (driver assignment and invoice email).
- WebSocket server for fleet tracking with Redis adapter and scaling strategies.
- Caching layer for database reads with in-memory fallback.

**Section sources**
- [client.ts:18-57](file://src/integrations/supabase/client.ts#L18-L57)
- [delivery.ts:694-734](file://src/integrations/supabase/delivery.ts#L694-L734)
- [PHASE2_EDGE_FUNCTIONS.md:34-172](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L34-L172)
- [trackingSocket.ts:36-214](file://src/fleet/services/trackingSocket.ts#L36-L214)
- [cache.ts:16-107](file://src/lib/cache.ts#L16-L107)

## Architecture Overview
The data flow follows a layered pattern:
- User interactions trigger frontend components and hooks.
- Data access uses Supabase client for authenticated queries and mutations.
- Real-time updates are handled via Supabase Postgres changes and WebSocket connections.
- Edge Functions automate backend tasks triggered by database events or HTTP invocations.
- Caching reduces latency and load for repeated reads.

```mermaid
sequenceDiagram
participant U as "User"
participant FE as "Frontend Components"
participant SC as "Supabase Client"
participant DB as "Supabase DB"
participant RT as "Realtime Channels"
participant WF as "Edge Functions"
participant WS as "WebSocket Server"
U->>FE : Interact (e.g., view schedule)
FE->>SC : Query/Mutation (e.g., fetch schedule)
SC->>DB : PostgREST/Supabase Auth
DB-->>SC : Data
SC-->>FE : Response
FE->>RT : Subscribe to channel (delivery updates)
DB-->>RT : Postgres changes (UPDATE/INSERT)
RT-->>FE : Live update payload
WF-->>DB : Automated processing (e.g., assign driver)
WF-->>FE : Email notification (via email_logs)
WS-->>FE : Real-time driver status/location
```

**Diagram sources**
- [delivery.ts:694-734](file://src/integrations/supabase/delivery.ts#L694-L734)
- [PHASE2_EDGE_FUNCTIONS.md:258-322](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L258-L322)
- [trackingSocket.ts:36-121](file://src/fleet/services/trackingSocket.ts#L36-L121)

## Detailed Component Analysis

### Supabase Client and Authentication
- Initializes Supabase with environment variables and Capacitor-native storage for sessions.
- Enables persistent session and automatic token refresh.
- Guards against missing configuration during builds.

```mermaid
flowchart TD
Start(["Initialize Supabase"]) --> CheckEnv["Check VITE_SUPABASE_URL<br/>and VITE_SUPABASE_PUBLISHABLE_KEY"]
CheckEnv --> EnvOK{"Environment variables present?"}
EnvOK --> |No| LogError["Log configuration error"]
EnvOK --> |Yes| InitClient["Create Supabase client"]
InitClient --> Storage["Select storage adapter:<br/>Capacitor Preferences (native)<br/>localStorage (web)"]
Storage --> AuthConfig["Configure auth:<br/>persistSession=true<br/>autoRefreshToken=true"]
AuthConfig --> Ready(["Ready"])
```

**Diagram sources**
- [client.ts:7-57](file://src/integrations/supabase/client.ts#L7-L57)

**Section sources**
- [client.ts:7-57](file://src/integrations/supabase/client.ts#L7-L57)

### Real-Time Subscriptions (Supabase Postgres Changes)
- Delivery updates: subscribe to UPDATE events on delivery_jobs filtered by schedule_id.
- Driver location updates: subscribe to INSERT events on driver_locations filtered by driver_id.
- These subscriptions push live updates to the UI without polling.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant RT as "Supabase Channel"
participant DB as "Postgres"
FE->>RT : subscribeToDeliveryUpdates(scheduleId)
RT->>DB : Listen for UPDATE on delivery_jobs where schedule_id=?
DB-->>RT : Notify on row change
RT-->>FE : Callback(payload)
FE->>RT : subscribeToDriverLocation(driverId)
RT->>DB : Listen for INSERT on driver_locations where driver_id=?
DB-->>RT : Notify on new row
RT-->>FE : Callback(payload)
```

**Diagram sources**
- [delivery.ts:694-734](file://src/integrations/supabase/delivery.ts#L694-L734)

**Section sources**
- [delivery.ts:694-734](file://src/integrations/supabase/delivery.ts#L694-L734)

### Edge Functions (Serverless Workflows)
- auto-assign-driver: Scores and assigns nearest available driver to a delivery based on distance, capacity, rating, and experience.
- send-invoice-email: Generates and sends invoices upon payment completion, logs to email_logs.
- Both functions use Supabase service role for database operations and Resend for email delivery.
- Functions can be invoked via Supabase client or HTTP requests and can be triggered by database events.

```mermaid
flowchart TD
A["Trigger Event"] --> B{"Which function?"}
B --> |auto-assign-driver| C["Compute score:<br/>distance + capacity + rating + experience"]
B --> |send-invoice-email| D["Verify payment status<br/>Generate invoice<br/>Send via Resend"]
C --> E["Update delivery_jobs<br/>with driver assignment"]
D --> F["Insert email_log<br/>return success"]
E --> G["Notify via email_logs"]
F --> G
```

**Diagram sources**
- [PHASE2_EDGE_FUNCTIONS.md:34-172](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L34-L172)
- [PHASE2_EDGE_FUNCTIONS.md:258-322](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L258-L322)

**Section sources**
- [PHASE2_EDGE_FUNCTIONS.md:34-172](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L34-L172)
- [PHASE2_EDGE_FUNCTIONS.md:258-322](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L258-L322)
- [config.toml:1-59](file://supabase/config.toml#L1-L59)

### WebSocket Server (Fleet Real-Time Tracking)
- Socket.IO server with Redis adapter for horizontal scaling.
- Clients authenticate via token query parameter and subscribe to city-specific channels.
- Supports sticky sessions, pub/sub broadcasting, and exponential backoff reconnection.

```mermaid
sequenceDiagram
participant Client as "Fleet Client"
participant WS as "WebSocket Server"
participant Redis as "Redis Pub/Sub"
Client->>WS : Connect with token
WS-->>Client : onopen -> subscribe to city channels
WS->>Redis : Publish driver_location/status/stats
Redis-->>WS : Broadcast to subscribed servers
WS-->>Client : onmessage -> deliver updates
Client->>WS : disconnect()
WS-->>Client : onclose -> scheduleReconnect()
```

**Diagram sources**
- [trackingSocket.ts:36-121](file://src/fleet/services/trackingSocket.ts#L36-L121)
- [package.json:21-30](file://websocket-server/package.json#L21-L30)

**Section sources**
- [trackingSocket.ts:36-214](file://src/fleet/services/trackingSocket.ts#L36-L214)
- [package.json:1-44](file://websocket-server/package.json#L1-L44)

### Caching Layer
- Redis-backed cache with in-memory fallback when Redis is unavailable.
- TTL-based entries for restaurant, meal, and challenge data.
- Pattern-based invalidation for cache updates.

```mermaid
flowchart TD
Start(["getCachedRestaurant(id)"]) --> GetKey["Build cache key"]
GetKey --> TryRedis{"Redis available?"}
TryRedis --> |Yes| GetRedis["GET key"]
TryRedis --> |No| GetMem["Get from memory cache"]
GetRedis --> FoundRedis{"Found?"}
GetMem --> FoundMem{"Found and not expired?"}
FoundRedis --> |Yes| ReturnRedis["Return cached data"]
FoundRedis --> |No| FetchDB["Fetch from Supabase"]
FoundMem --> |Yes| ReturnMem["Return cached data"]
FoundMem --> |No| FetchDB
FetchDB --> SaveCache["Set TTL in cache"]
SaveCache --> ReturnDB["Return fresh data"]
```

**Diagram sources**
- [cache.ts:37-107](file://src/lib/cache.ts#L37-L107)
- [cache.ts:124-177](file://src/lib/cache.ts#L124-L177)

**Section sources**
- [cache.ts:16-107](file://src/lib/cache.ts#L16-L107)
- [cache.ts:124-177](file://src/lib/cache.ts#L124-L177)

### Data Models Overview
Supabase types define core tables and enums used across the system (e.g., deliveries, drivers, profiles, email_logs). These types drive type-safe client usage and real-time subscriptions.

```mermaid
erDiagram
DELIVERY_JOBS {
uuid id PK
uuid driver_id FK
uuid schedule_id FK
text status
timestamptz created_at
timestamptz updated_at
}
DRIVERS {
uuid id PK
uuid user_id FK
boolean is_online
numeric current_lat
numeric current_lng
timestamptz last_location_update
}
EMAIL_LOGS {
uuid id PK
uuid payment_id FK
text email_id
text status
timestamptz created_at
}
PROFILE {
uuid user_id PK
string full_name
json raw_user_meta_data
}
DELIVERY_JOBS }o--|| DRIVERS : "assigned_to"
DELIVERY_JOBS }o--|| PROFILE : "ordered_by"
EMAIL_LOGS }o--|| PROFILE : "recipient"
```

**Diagram sources**
- [types.ts:1-800](file://src/integrations/supabase/types.ts#L1-L800)

**Section sources**
- [types.ts:1-800](file://src/integrations/supabase/types.ts#L1-L800)

## Dependency Analysis
- Frontend depends on Supabase client for auth and data access, and on WebSocket client for fleet tracking.
- Supabase Edge Functions depend on Supabase service role keys and external services (Resend).
- WebSocket server depends on Redis for pub/sub and Postgres for driver data.
- Caching layer depends on Supabase client for data retrieval.

```mermaid
graph LR
FE["Frontend"] --> SC["Supabase Client"]
FE --> WS["WebSocket Client"]
SC --> DB["Supabase DB"]
WF["Edge Functions"] --> DB
WF --> Email["Resend"]
WS --> RS["Redis"]
WS --> DB
Cache["Cache Layer"] --> SC
```

**Diagram sources**
- [client.ts:1-57](file://src/integrations/supabase/client.ts#L1-L57)
- [PHASE2_EDGE_FUNCTIONS.md:14-21](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L14-L21)
- [trackingSocket.ts:36-121](file://src/fleet/services/trackingSocket.ts#L36-L121)
- [package.json:21-30](file://websocket-server/package.json#L21-L30)
- [cache.ts:6-6](file://src/lib/cache.ts#L6-L6)

**Section sources**
- [client.ts:1-57](file://src/integrations/supabase/client.ts#L1-L57)
- [PHASE2_EDGE_FUNCTIONS.md:14-21](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L14-L21)
- [trackingSocket.ts:36-121](file://src/fleet/services/trackingSocket.ts#L36-L121)
- [package.json:21-30](file://websocket-server/package.json#L21-L30)
- [cache.ts:6-6](file://src/lib/cache.ts#L6-L6)

## Performance Considerations
- Real-time subscriptions minimize polling overhead and reduce latency for delivery and driver updates.
- Edge Functions offload heavy work from the client and API, enabling scalable automation.
- Caching reduces database load for frequently accessed data (restaurants, meals, challenges).
- WebSocket server scalability via Redis pub/sub and sticky sessions ensures horizontal growth.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Supabase configuration errors: Verify VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set; otherwise, initialization logs an error.
- Edge Function deployment and invocation: Confirm environment variables are set and functions are deployed; use logs to diagnose failures.
- WebSocket connectivity: Check token authentication, origin validation, and reconnection logic; ensure Redis is reachable for pub/sub.
- Security hardening: Review encryption of banking data and API secret hashing; ensure proper RLS policies and audit logging.

**Section sources**
- [client.ts:10-16](file://src/integrations/supabase/client.ts#L10-L16)
- [PHASE2_EDGE_FUNCTIONS.md:380-402](file://supabase/functions/PHASE2_EDGE_FUNCTIONS.md#L380-L402)
- [trackingSocket.ts:76-94](file://src/fleet/services/trackingSocket.ts#L76-L94)
- [SECURITY_REMEDIATION_REPORT.md:13-47](file://SECURITY_REMEDIATION_REPORT.md#L13-L47)

## Conclusion
Nutrio’s data flow architecture integrates Supabase for authentication, database, and real-time capabilities, Edge Functions for serverless automation, and a WebSocket server for fleet tracking. The caching layer optimizes read performance, while robust security measures protect sensitive data. Together, these components enable responsive, scalable, and secure data pathways across the platform.