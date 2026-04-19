# Data Flow Patterns

<cite>
**Referenced Files in This Document**
- [client.ts](file://src/integrations/supabase/client.ts)
- [types.ts](file://src/integrations/supabase/types.ts)
- [cache.ts](file://src/lib/cache.ts)
- [useUserOrders.ts](file://src/hooks/useUserOrders.ts)
- [useSubscription.ts](file://src/hooks/useSubscription.ts)
- [useWallet.ts](file://src/hooks/useWallet.ts)
- [useAffiliateProgram.ts](file://src/hooks/useAffiliateProgram.ts)
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
This document explains the data flow patterns in the Nutrio application, focusing on:
- How Supabase serves as the backend for server state
- How Supabase real-time subscriptions keep the UI synchronized
- How local React hooks encapsulate data fetching and mutations
- How caching strategies improve performance and resilience
- How optimistic updates and cache invalidation maintain consistency

It synthesizes the Supabase client configuration, typed database definitions, caching utilities, and domain-specific hooks to show the end-to-end lifecycle of data from the database to the UI.

## Project Structure
The data flow spans three layers:
- Backend: Supabase (PostgreSQL, Edge Functions, Realtime)
- Data Access: Supabase client and typed database definitions
- Frontend: React hooks that fetch, mutate, and subscribe to data

```mermaid
graph TB
subgraph "Frontend"
Hooks["React Hooks<br/>useUserOrders, useSubscription,<br/>useWallet, useAffiliateProgram"]
UI["React Components"]
end
subgraph "Data Access"
Client["Supabase Client<br/>src/integrations/supabase/client.ts"]
Types["Typed Database Definitions<br/>src/integrations/supabase/types.ts"]
Cache["Caching Utilities<br/>src/lib/cache.ts"]
end
subgraph "Backend"
DB["PostgreSQL Tables<br/>Supabase"]
Realtime["Realtime Subscriptions"]
Edge["Edge Functions"]
end
UI --> Hooks
Hooks --> Client
Client --> Types
Hooks --> Cache
Client --> DB
Client --> Realtime
Client --> Edge
```

**Diagram sources**
- [client.ts](file://src/integrations/supabase/client.ts)
- [types.ts](file://src/integrations/supabase/types.ts)
- [cache.ts](file://src/lib/cache.ts)
- [useUserOrders.ts](file://src/hooks/useUserOrders.ts)
- [useSubscription.ts](file://src/hooks/useSubscription.ts)
- [useWallet.ts](file://src/hooks/useWallet.ts)
- [useAffiliateProgram.ts](file://src/hooks/useAffiliateProgram.ts)

**Section sources**
- [client.ts](file://src/integrations/supabase/client.ts)
- [types.ts](file://src/integrations/supabase/types.ts)
- [cache.ts](file://src/lib/cache.ts)

## Core Components
- Supabase client configured with Capacitor-compatible storage for sessions and persisted auth state
- Typed database definitions for strong typing across the stack
- Domain-specific hooks that encapsulate:
  - Data fetching and filtering
  - Real-time subscriptions
  - Mutations via Supabase SQL and Edge Functions
  - Local state management and derived computations
- A caching layer that supports Redis or in-memory fallback with TTL and pattern-based invalidation

Key responsibilities:
- useUserOrders: fetches user orders with filters, computes stats, and exposes refetch
- useSubscription: fetches active/pending/cancelled-but-valid subscriptions, exposes derived availability and usage, and subscribes to changes
- useWallet: manages wallet, transactions, top-up packages, initiates payments via Edge Functions, and subscribes to wallet and transaction updates
- useAffiliateProgram: loads platform settings, aggregates stats, and handles payouts
- cache.ts: provides get/set/delete/invalidatePattern with Redis or in-memory fallback

**Section sources**
- [client.ts](file://src/integrations/supabase/client.ts)
- [types.ts](file://src/integrations/supabase/types.ts)
- [cache.ts](file://src/lib/cache.ts)
- [useUserOrders.ts](file://src/hooks/useUserOrders.ts)
- [useSubscription.ts](file://src/hooks/useSubscription.ts)
- [useWallet.ts](file://src/hooks/useWallet.ts)
- [useAffiliateProgram.ts](file://src/hooks/useAffiliateProgram.ts)

## Architecture Overview
The data lifecycle follows a predictable flow:
- UI triggers a data operation (fetch, filter, mutate)
- Hook executes a Supabase query or RPC
- Optional caching layer checks and updates cache
- Real-time channels react to server changes and trigger refetches
- UI re-renders with fresh data

```mermaid
sequenceDiagram
participant UI as "React Component"
participant Hook as "Domain Hook"
participant Cache as "Cache Manager"
participant Supabase as "Supabase Client"
participant DB as "PostgreSQL"
participant RT as "Realtime"
UI->>Hook : "request data"
Hook->>Cache : "get(key)"
alt "cache hit"
Cache-->>Hook : "cached data"
else "cache miss"
Hook->>Supabase : "query/rpc"
Supabase->>DB : "SQL/Edge Function"
DB-->>Supabase : "rows"
Supabase-->>Hook : "data"
Hook->>Cache : "set(key, data, ttl)"
end
Note over Hook,RT : "Subscribe to postgres_changes"
RT-->>Hook : "notify on changes"
Hook->>Supabase : "refetch()"
Supabase->>DB : "query"
DB-->>Supabase : "updated rows"
Supabase-->>Hook : "fresh data"
Hook-->>UI : "updated props/state"
```

**Diagram sources**
- [client.ts](file://src/integrations/supabase/client.ts)
- [cache.ts](file://src/lib/cache.ts)
- [useSubscription.ts](file://src/hooks/useSubscription.ts)
- [useWallet.ts](file://src/hooks/useWallet.ts)

## Detailed Component Analysis

### Supabase Client and Typed Database
- The client initializes with environment variables and a Capacitor-compatible storage adapter for auth persistence
- The typed definitions enumerate tables, enums, and relationships, enabling compile-time safety for queries and mutations

```mermaid
classDiagram
class SupabaseClient {
+auth
+from(table)
+rpc(name, params)
+functions.invoke(name, options)
+channel(name)
}
class DatabaseTypes {
+Tables
+Enums
+Relationships
}
SupabaseClient --> DatabaseTypes : "typed via generics"
```

**Diagram sources**
- [client.ts](file://src/integrations/supabase/client.ts)
- [types.ts](file://src/integrations/supabase/types.ts)

**Section sources**
- [client.ts](file://src/integrations/supabase/client.ts)
- [types.ts](file://src/integrations/supabase/types.ts)

### Caching Layer
- Provides get/set/delete/invalidatePattern with Redis or in-memory fallback
- Generates cache keys per domain (e.g., restaurant, meal, challenges)
- Used by domain fetchers to reduce latency and server load

```mermaid
flowchart TD
Start(["Cache Request"]) --> GetKey["Generate Key"]
GetKey --> TryRedis["Try Redis"]
TryRedis --> |Found| ReturnRedis["Return Cached Value"]
TryRedis --> |Not Found| TryMemory["Fallback to Memory Cache"]
TryMemory --> MemHit{"Mem Not Expired?"}
MemHit --> |Yes| ReturnMem["Return Cached Value"]
MemHit --> |No| ExpireClean["Delete Expired Entry"]
ExpireClean --> Miss["Cache Miss"]
Miss --> Fetch["Fetch From Supabase"]
Fetch --> Store["Store in Cache"]
Store --> ReturnFresh["Return Fresh Data"]
```

**Diagram sources**
- [cache.ts](file://src/lib/cache.ts)

**Section sources**
- [cache.ts](file://src/lib/cache.ts)

### useUserOrders: Filtering, Stats, and Refetch
- Fetches from a materialized view with optional filters (meal type, status, date range)
- Computes derived stats client-side
- Exposes refetch to refresh after mutations

```mermaid
sequenceDiagram
participant Comp as "Component"
participant Hook as "useUserOrders"
participant Supabase as "Supabase"
participant DB as "DB View"
Comp->>Hook : "apply filters"
Hook->>Supabase : "select from view with filters"
Supabase->>DB : "execute"
DB-->>Supabase : "rows"
Supabase-->>Hook : "orders"
Hook->>Hook : "compute stats"
Hook-->>Comp : "orders + stats"
Comp->>Hook : "refetch"
Hook->>Supabase : "re-fetch"
Supabase->>DB : "execute"
DB-->>Supabase : "rows"
Supabase-->>Hook : "updated orders"
Hook-->>Comp : "updated props"
```

**Diagram sources**
- [useUserOrders.ts](file://src/hooks/useUserOrders.ts)

**Section sources**
- [useUserOrders.ts](file://src/hooks/useUserOrders.ts)

### useSubscription: Real-time Availability and Usage
- Fetches the most recent active/pending/cancelled-but-valid subscription
- Derives availability, weekly/monthly quotas, and whether a meal can be ordered
- Subscribes to postgres_changes on the subscriptions table for the user
- Uses RPCs for usage increments and rollover credit checks

```mermaid
sequenceDiagram
participant Comp as "Component"
participant Hook as "useSubscription"
participant Supabase as "Supabase"
participant DB as "PostgreSQL"
participant RT as "Realtime"
Comp->>Hook : "render"
Hook->>Supabase : "select latest subscription"
Supabase->>DB : "execute"
DB-->>Supabase : "subscription"
Supabase-->>Hook : "data"
Hook->>Hook : "derive availability"
Hook-->>Comp : "props"
RT-->>Hook : "postgres_changes"
Hook->>Supabase : "refetch"
Supabase->>DB : "execute"
DB-->>Supabase : "updated subscription"
Supabase-->>Hook : "fresh data"
Hook->>Hook : "recompute"
Hook-->>Comp : "updated props"
Comp->>Hook : "incrementMealUsage()"
Hook->>Supabase : "rpc increment_monthly_meal_usage"
Supabase->>DB : "execute"
DB-->>Supabase : "success"
Supabase-->>Hook : "result"
Hook->>Supabase : "refetch()"
Supabase->>DB : "execute"
DB-->>Supabase : "updated subscription"
Supabase-->>Hook : "fresh data"
Hook-->>Comp : "updated props"
```

**Diagram sources**
- [useSubscription.ts](file://src/hooks/useSubscription.ts)

**Section sources**
- [useSubscription.ts](file://src/hooks/useSubscription.ts)

### useWallet: Payments, Credits, and Real-time Updates
- Ensures a wallet exists for the user, otherwise inserts one
- Loads transactions and top-up packages
- Initiates payments via Edge Functions and credits wallet via RPC
- Subscribes to customer_wallets and wallet_transactions for live updates

```mermaid
sequenceDiagram
participant Comp as "Component"
participant Hook as "useWallet"
participant Supabase as "Supabase"
participant DB as "PostgreSQL"
participant RT as "Realtime"
Comp->>Hook : "render"
Hook->>Supabase : "get wallet"
Supabase->>DB : "select"
DB-->>Supabase : "wallet"
alt "no wallet"
Hook->>Supabase : "insert wallet"
Supabase->>DB : "insert"
DB-->>Supabase : "new wallet"
end
Hook->>Supabase : "get transactions"
Supabase->>DB : "select"
DB-->>Supabase : "transactions"
Hook-->>Comp : "props"
Comp->>Hook : "initiateTopUp(packageId, method)"
Hook->>Supabase : "functions.invoke('initiate-payment')"
Supabase-->>Hook : "paymentId + url"
Hook-->>Comp : "payment details"
Comp->>Hook : "creditWallet(amount, type, ...)"
Hook->>Supabase : "rpc credit_wallet"
Supabase->>DB : "execute"
DB-->>Supabase : "success"
Supabase-->>Hook : "result"
Hook->>Supabase : "refetch wallet + transactions"
Supabase->>DB : "select"
DB-->>Supabase : "updated data"
Supabase-->>Hook : "fresh data"
Hook-->>Comp : "updated props"
RT-->>Hook : "wallet/tx INSERT"
Hook->>Supabase : "refetch"
Supabase->>DB : "select"
DB-->>Supabase : "updated rows"
Supabase-->>Hook : "fresh data"
Hook-->>Comp : "updated props"
```

**Diagram sources**
- [useWallet.ts](file://src/hooks/useWallet.ts)

**Section sources**
- [useWallet.ts](file://src/hooks/useWallet.ts)

### useAffiliateProgram: Settings, Stats, and Payouts
- Loads platform settings from a settings table
- Aggregates stats (earnings, pending, available, referrals by tier)
- Uses RPC to fetch hierarchical referral networks
- Handles payout requests with validation against settings and balances

```mermaid
flowchart TD
Start(["Render"]) --> LoadSettings["Load Platform Settings"]
LoadSettings --> FetchProfile["Fetch Profile Stats"]
FetchProfile --> FetchCommissions["Fetch Commissions"]
FetchCommissions --> FetchPayouts["Fetch Payouts"]
FetchPayouts --> FetchNetwork["RPC get_affiliate_network"]
FetchNetwork --> Compute["Compute Stats"]
Compute --> Ready["Provide Data to UI"]
Payout["User Requests Payout"] --> Validate["Validate Amount vs Min Threshold & Balance"]
Validate --> |Valid| Submit["Insert Payout + Update Balance"]
Submit --> Refresh["Refetch Data"]
Validate --> |Invalid| Error["Return Error"]
```

**Diagram sources**
- [useAffiliateProgram.ts](file://src/hooks/useAffiliateProgram.ts)

**Section sources**
- [useAffiliateProgram.ts](file://src/hooks/useAffiliateProgram.ts)

## Dependency Analysis
- Hooks depend on the Supabase client for all data operations
- Real-time subscriptions are scoped per user/channel to minimize overhead
- Cache is orthogonal to hooks and can wrap repeated queries
- Typed database definitions underpin safe column and enum usage across the app

```mermaid
graph LR
Types["types.ts"] --> Client["client.ts"]
Client --> Hooks["Domain Hooks"]
Cache["cache.ts"] --> Hooks
Hooks --> UI["Components"]
Hooks --> Realtime["Supabase Realtime"]
```

**Diagram sources**
- [types.ts](file://src/integrations/supabase/types.ts)
- [client.ts](file://src/integrations/supabase/client.ts)
- [cache.ts](file://src/lib/cache.ts)
- [useUserOrders.ts](file://src/hooks/useUserOrders.ts)
- [useSubscription.ts](file://src/hooks/useSubscription.ts)
- [useWallet.ts](file://src/hooks/useWallet.ts)
- [useAffiliateProgram.ts](file://src/hooks/useAffiliateProgram.ts)

**Section sources**
- [client.ts](file://src/integrations/supabase/client.ts)
- [types.ts](file://src/integrations/supabase/types.ts)
- [cache.ts](file://src/lib/cache.ts)
- [useUserOrders.ts](file://src/hooks/useUserOrders.ts)
- [useSubscription.ts](file://src/hooks/useSubscription.ts)
- [useWallet.ts](file://src/hooks/useWallet.ts)
- [useAffiliateProgram.ts](file://src/hooks/useAffiliateProgram.ts)

## Performance Considerations
- Selective re-rendering
  - Hooks expose minimal state and computed values; components should consume only required fields
  - Keep derived computations inside hooks to avoid recomputation in consumers
- Data normalization
  - Prefer normalized entities and lookup maps for related data (e.g., restaurant and meal references)
  - Use memoization for expensive computations (e.g., stats) in hooks
- Offline and resilience
  - Use the caching layer to serve stale data while refreshing in the background
  - Implement retry with exponential backoff for transient failures
- Real-time efficiency
  - Subscribe only to relevant channels and filters (per user/table)
  - Debounce frequent updates when appropriate
- Pagination and filtering
  - Use server-side filters and pagination to limit payload sizes
  - Combine with caching for frequently accessed slices

## Troubleshooting Guide
Common issues and remedies:
- Missing Supabase configuration
  - Ensure environment variables are present during build; the client logs a guard message if missing
- Real-time not updating
  - Verify channel filters match the user ID and table
  - Confirm permissions and RLS policies allow the events to propagate
- Cache inconsistencies
  - Use targeted invalidation after mutations (e.g., invalidate restaurant/meals)
  - Monitor TTLs to avoid serving stale data beyond acceptable windows
- RPC or Edge Function errors
  - Inspect returned errors and surface user-friendly messages
  - Validate inputs and constraints before invoking RPCs/functions

**Section sources**
- [client.ts](file://src/integrations/supabase/client.ts)
- [cache.ts](file://src/lib/cache.ts)
- [useSubscription.ts](file://src/hooks/useSubscription.ts)
- [useWallet.ts](file://src/hooks/useWallet.ts)

## Conclusion
Nutrio’s data flow combines Supabase’s robust SQL, real-time, and edge capabilities with React hooks that encapsulate fetching, mutations, and subscriptions. The caching layer improves responsiveness and resilience, while typed database definitions enhance reliability. Together, these patterns deliver a scalable, consistent, and user-responsive data experience across domains like orders, subscriptions, wallets, and affiliate programs.