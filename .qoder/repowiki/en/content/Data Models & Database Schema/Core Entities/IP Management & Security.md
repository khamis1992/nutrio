# IP Management & Security

<cite>
**Referenced Files in This Document**
- [ipCheck.ts](file://src/lib/ipCheck.ts)
- [Auth.tsx](file://src/pages/Auth.tsx)
- [AuthContext.tsx](file://src/contexts/AuthContext.tsx)
- [AdminIPManagement.tsx](file://src/pages/admin/AdminIPManagement.tsx)
- [check-ip-location/index.ts](file://supabase/functions/check-ip-location/index.ts)
- [log-user-ip/index.ts](file://supabase/functions/log-user-ip/index.ts)
- [20250219000000_ip_management.sql](file://supabase/migrations/20250219000000_ip_management.sql)
- [20250220000000_create_essential_tables.sql](file://supabase/migrations/20250220000000_create_essential_tables.sql)
- [20250220000008_create_ip_logging_trigger.sql](file://supabase/migrations/20250220000008_create_ip_logging_trigger.sql)
- [IP_MANAGEMENT_STATUS.md](file://IP_MANAGEMENT_STATUS.md)
- [IP-BYPASS-STATUS.md](file://IP-BYPASS-STATUS.md)
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
This document describes the IP Management and Security system in Nutrio. It covers:
- The blocked_ips table for IP address blocking with fields for ip_address, reason, blocked_by, and is_active status
- The user_ip_logs table for tracking user login/signup activities with geolocation data (country_code, country_name, city) and user agent information
- The is_ip_blocked() security function for real-time IP validation
- Row Level Security (RLS) policies for IP management
- The automated IP logging trigger
- Examples of IP blocking scenarios, security policy enforcement, and integration with the authentication flow
- Performance optimizations through indexing strategies

## Project Structure
The IP Management system spans frontend and backend components:
- Frontend integration via a reusable IP checker utility
- Supabase Edge Functions for geolocation checks and user IP logging
- Supabase database tables and migration scripts
- Authentication flows that optionally integrate IP checks
- An administrative UI for managing blocked IPs

```mermaid
graph TB
subgraph "Frontend"
UI_Auth["Auth Page<br/>src/pages/Auth.tsx"]
UI_Context["Auth Context<br/>src/contexts/AuthContext.tsx"]
Util_IP["IP Check Utility<br/>src/lib/ipCheck.ts"]
Admin_UI["Admin IP Management<br/>src/pages/admin/AdminIPManagement.tsx"]
end
subgraph "Supabase Backend"
Func_Check["Edge Function: check-ip-location<br/>supabase/functions/check-ip-location/index.ts"]
Func_Log["Edge Function: log-user-ip<br/>supabase/functions/log-user-ip/index.ts"]
DB_Blocked["Table: blocked_ips<br/>supabase/migrations/*_ip_management.sql"]
DB_Logs["Table: user_ip_logs<br/>supabase/migrations/*_ip_management.sql"]
RLS_Policies["RLS Policies<br/>supabase/migrations/*_ip_management.sql"]
Trigger_Log["Trigger: on_auth_user_signin<br/>supabase/migrations/*_create_ip_logging_trigger.sql"]
end
UI_Auth --> Util_IP
UI_Context --> Util_IP
Util_IP --> Func_Check
Func_Check --> DB_Blocked
Func_Check --> Func_Log
Func_Log --> DB_Logs
UI_Context --> Func_Log
Admin_UI --> DB_Blocked
Admin_UI --> DB_Logs
RLS_Policies --> DB_Blocked
RLS_Policies --> DB_Logs
Trigger_Log --> DB_Logs
```

**Diagram sources**
- [Auth.tsx:15-203](file://src/pages/Auth.tsx#L15-L203)
- [AuthContext.tsx:87-112](file://src/contexts/AuthContext.tsx#L87-L112)
- [ipCheck.ts:19-107](file://src/lib/ipCheck.ts#L19-L107)
- [check-ip-location/index.ts:1-107](file://supabase/functions/check-ip-location/index.ts#L1-L107)
- [log-user-ip/index.ts:1-65](file://supabase/functions/log-user-ip/index.ts#L1-L65)
- [20250219000000_ip_management.sql:1-60](file://supabase/migrations/20250219000000_ip_management.sql#L1-L60)
- [20250220000008_create_ip_logging_trigger.sql:1-48](file://supabase/migrations/20250220000008_create_ip_logging_trigger.sql#L1-L48)

**Section sources**
- [Auth.tsx:15-203](file://src/pages/Auth.tsx#L15-L203)
- [AuthContext.tsx:87-112](file://src/contexts/AuthContext.tsx#L87-L112)
- [ipCheck.ts:19-107](file://src/lib/ipCheck.ts#L19-L107)
- [check-ip-location/index.ts:1-107](file://supabase/functions/check-ip-location/index.ts#L1-L107)
- [log-user-ip/index.ts:1-65](file://supabase/functions/log-user-ip/index.ts#L1-L65)
- [20250219000000_ip_management.sql:1-60](file://supabase/migrations/20250219000000_ip_management.sql#L1-L60)
- [20250220000008_create_ip_logging_trigger.sql:1-48](file://supabase/migrations/20250220000008_create_ip_logging_trigger.sql#L1-L48)

## Core Components
- blocked_ips table
  - Fields: id, ip_address (unique), reason, blocked_by (references auth.users), is_active (default true), timestamps
  - Purpose: Maintain a list of blocked IP addresses with optional reasons and active status
- user_ip_logs table
  - Fields: id, user_id (FK to auth.users), ip_address, country_code, country_name, city, action ('signup' or 'login'), user_agent, created_at
  - Purpose: Track user login/signup events with geolocation and user agent metadata
- is_ip_blocked() function
  - Validates whether a given IP is present in blocked_ips and currently active
- Edge Functions
  - check-ip-location: performs IP geolocation and blocks based on database lookup and geo-validation
  - log-user-ip: captures IP, geolocation, and user agent during user actions
- RLS Policies
  - Admin-only management of blocked_ips
  - Admin-only viewing of user_ip_logs
  - Users can insert their own IP logs
- Indexes
  - Optimizations for blocked_ips (ip_address, is_active) and user_ip_logs (user_id, ip_address, created_at DESC)

**Section sources**
- [20250219000000_ip_management.sql:1-60](file://supabase/migrations/20250219000000_ip_management.sql#L1-L60)
- [20250220000000_create_essential_tables.sql:204-232](file://supabase/migrations/20250220000000_create_essential_tables.sql#L204-L232)
- [check-ip-location/index.ts:52-60](file://supabase/functions/check-ip-location/index.ts#L52-L60)

## Architecture Overview
The system integrates frontend and backend components to enforce IP-based security and track user locations.

```mermaid
sequenceDiagram
participant Client as "Client Browser"
participant AuthPage as "Auth Page<br/>Auth.tsx"
participant AuthCtx as "Auth Context<br/>AuthContext.tsx"
participant IPUtil as "IP Check Utility<br/>ipCheck.ts"
participant EdgeCheck as "Edge Function<br/>check-ip-location"
participant DB_Block as "blocked_ips<br/>DB"
participant EdgeLog as "Edge Function<br/>log-user-ip"
participant DB_Log as "user_ip_logs<br/>DB"
Client->>AuthPage : "Submit signup"
AuthPage->>IPUtil : "checkIPLocation()"
IPUtil->>EdgeCheck : "POST /functions/v1/check-ip-location"
EdgeCheck->>DB_Block : "RPC is_ip_blocked(p_ip)"
DB_Block-->>EdgeCheck : "blocked? true/false"
EdgeCheck-->>IPUtil : "{allowed, blocked?, countryCode, country, city}"
IPUtil-->>AuthPage : "Result"
AuthPage->>AuthCtx : "Call signUp(...)"
AuthCtx->>EdgeLog : "POST /functions/v1/log-user-ip (signup)"
EdgeLog->>DB_Log : "Insert user_ip_logs row"
DB_Log-->>EdgeLog : "Success"
EdgeLog-->>AuthCtx : "{success}"
AuthCtx-->>AuthPage : "Signup result"
```

**Diagram sources**
- [Auth.tsx:169-203](file://src/pages/Auth.tsx#L169-L203)
- [AuthContext.tsx:87-112](file://src/contexts/AuthContext.tsx#L87-L112)
- [ipCheck.ts:49-80](file://src/lib/ipCheck.ts#L49-L80)
- [check-ip-location/index.ts:49-94](file://supabase/functions/check-ip-location/index.ts#L49-L94)
- [log-user-ip/index.ts:35-45](file://supabase/functions/log-user-ip/index.ts#L35-L45)

## Detailed Component Analysis

### blocked_ips Table
- Purpose: Central registry of blocked IP addresses
- Key fields:
  - ip_address: unique INET field for the IP
  - reason: optional text describing the reason
  - blocked_by: references the admin who added the block
  - is_active: boolean flag to activate/deactivate blocks
  - created_at/updated_at: timestamps
- RLS: Admins can manage blocked_ips; enforced via policy

```mermaid
erDiagram
BLOCKED_IPS {
uuid id PK
inet ip_address UK
text reason
uuid blocked_by FK
boolean is_active
timestamptz created_at
timestamptz updated_at
}
AUTH_USERS {
uuid id PK
}
BLOCKED_IPS }o--|| AUTH_USERS : "blocked_by"
```

**Diagram sources**
- [20250219000000_ip_management.sql:2-10](file://supabase/migrations/20250219000000_ip_management.sql#L2-L10)

**Section sources**
- [20250219000000_ip_management.sql:2-10](file://supabase/migrations/20250219000000_ip_management.sql#L2-L10)
- [20250219000000_ip_management.sql:37-39](file://supabase/migrations/20250219000000_ip_management.sql#L37-L39)

### user_ip_logs Table
- Purpose: Audit trail of user IP usage with geolocation and user agent
- Key fields:
  - user_id: references auth.users
  - ip_address: INET
  - country_code, country_name, city: geolocation
  - action: 'signup' or 'login'
  - user_agent: browser/device info
  - created_at: timestamp
- RLS: Admins can SELECT; users can INSERT their own logs

```mermaid
erDiagram
USER_IP_LOGS {
uuid id PK
uuid user_id FK
inet ip_address
text country_code
text country_name
text city
text action
text user_agent
timestamptz created_at
}
AUTH_USERS {
uuid id PK
}
USER_IP_LOGS }o--|| AUTH_USERS : "user_id"
```

**Diagram sources**
- [20250219000000_ip_management.sql:12-23](file://supabase/migrations/20250219000000_ip_management.sql#L12-L23)

**Section sources**
- [20250219000000_ip_management.sql:12-23](file://supabase/migrations/20250219000000_ip_management.sql#L12-L23)
- [20250219000000_ip_management.sql:41-49](file://supabase/migrations/20250219000000_ip_management.sql#L41-L49)

### is_ip_blocked() Security Function
- Validates if an IP is present in blocked_ips and currently active
- Used by the check-ip-location Edge Function to decide blocking

```mermaid
flowchart TD
Start(["Call is_ip_blocked(p_ip)"]) --> Query["SELECT EXISTS(SELECT 1 FROM blocked_ips WHERE ip_address = p_ip AND is_active = true)"]
Query --> Return["Return boolean result"]
```

**Diagram sources**
- [check-ip-location/index.ts:52-60](file://supabase/functions/check-ip-location/index.ts#L52-L60)
- [20250219000000_ip_management.sql:52-60](file://supabase/migrations/20250219000000_ip_management.sql#L52-L60)

**Section sources**
- [check-ip-location/index.ts:52-60](file://supabase/functions/check-ip-location/index.ts#L52-L60)
- [20250219000000_ip_management.sql:52-60](file://supabase/migrations/20250219000000_ip_management.sql#L52-L60)

### RLS Policies for IP Management
- blocked_ips
  - Policy: Admins can manage blocked IPs
- user_ip_logs
  - Policy: Admins can SELECT
  - Policy: Users can INSERT their own logs

```mermaid
flowchart TD
Access["User Action"] --> Table["Target Table"]
Table --> |"blocked_ips"| Policy1["Admins can manage blocked IPs"]
Table --> |"user_ip_logs"| Policy2["Admins can view IP logs"]
Table --> |"user_ip_logs"| Policy3["Users can log their IPs"]
```

**Diagram sources**
- [20250219000000_ip_management.sql:37-49](file://supabase/migrations/20250219000000_ip_management.sql#L37-L49)

**Section sources**
- [20250219000000_ip_management.sql:37-49](file://supabase/migrations/20250219000000_ip_management.sql#L37-L49)

### Automated IP Logging Trigger
- Trigger: on_auth_user_signin on auth.users
- Behavior: On first login per session, inserts a placeholder row into user_ip_logs
- Production note: The trigger inserts a placeholder IP; production uses Edge Functions to capture real IP and geolocation

```mermaid
sequenceDiagram
participant Supabase as "Supabase Auth"
participant Trigger as "on_auth_user_signin Trigger"
participant DB as "user_ip_logs"
Supabase->>Trigger : "UPDATE auth.users last_sign_in_at"
Trigger->>DB : "INSERT placeholder row (user_id, ip_address='0.0.0.0', action='login', user_agent)"
DB-->>Trigger : "OK"
```

**Diagram sources**
- [20250220000008_create_ip_logging_trigger.sql:6-35](file://supabase/migrations/20250220000008_create_ip_logging_trigger.sql#L6-L35)

**Section sources**
- [20250220000008_create_ip_logging_trigger.sql:6-35](file://supabase/migrations/20250220000008_create_ip_logging_trigger.sql#L6-L35)

### Frontend IP Check Utility and Authentication Integration
- checkIPLocation()
  - Returns a predefined result in current test mode (allows all IPs)
  - In normal operation, calls the Edge Function to check IP geolocation and block status
- Auth.tsx
  - Calls checkIPLocation() during signup and displays user-friendly messages based on allowed/blocked/reason
- AuthContext.tsx
  - Optionally checks IP during login; allows login on failure with a warning

```mermaid
sequenceDiagram
participant UI as "Auth.tsx"
participant Ctx as "AuthContext.tsx"
participant Util as "ipCheck.ts"
participant Edge as "check-ip-location"
UI->>Util : "checkIPLocation()"
Util->>Edge : "POST /functions/v1/check-ip-location"
Edge-->>Util : "{allowed, blocked?, reason}"
Util-->>UI : "Result"
UI->>Ctx : "signUp(...)"
Ctx->>Edge : "log-user-ip (signup)"
```

**Diagram sources**
- [Auth.tsx:169-203](file://src/pages/Auth.tsx#L169-L203)
- [AuthContext.tsx:87-112](file://src/contexts/AuthContext.tsx#L87-L112)
- [ipCheck.ts:49-80](file://src/lib/ipCheck.ts#L49-L80)
- [check-ip-location/index.ts:49-94](file://supabase/functions/check-ip-location/index.ts#L49-L94)

**Section sources**
- [ipCheck.ts:19-80](file://src/lib/ipCheck.ts#L19-L80)
- [Auth.tsx:169-203](file://src/pages/Auth.tsx#L169-L203)
- [AuthContext.tsx:87-112](file://src/contexts/AuthContext.tsx#L87-L112)

### Admin IP Management UI
- Provides controls to block/unblock IPs and view statistics
- Integrates with blocked_ips and user_ip_logs for display and updates

```mermaid
sequenceDiagram
participant Admin as "Admin UI<br/>AdminIPManagement.tsx"
participant Supabase as "Supabase"
Admin->>Supabase : "INSERT blocked_ips (ip_address, reason)"
Admin->>Supabase : "UPDATE blocked_ips SET is_active=false (unblock)"
Admin->>Supabase : "SELECT blocked_ips, user_ip_logs"
```

**Diagram sources**
- [AdminIPManagement.tsx:96-132](file://src/pages/admin/AdminIPManagement.tsx#L96-L132)
- [AdminIPManagement.tsx:134-139](file://src/pages/admin/AdminIPManagement.tsx#L134-L139)

**Section sources**
- [AdminIPManagement.tsx:96-132](file://src/pages/admin/AdminIPManagement.tsx#L96-L132)
- [AdminIPManagement.tsx:134-139](file://src/pages/admin/AdminIPManagement.tsx#L134-L139)

## Dependency Analysis
- Frontend depends on:
  - ipCheck.ts for IP validation
  - Auth.tsx and AuthContext.tsx for integration into signup/login flows
- Backend depends on:
  - Edge Functions for IP geolocation and logging
  - blocked_ips and user_ip_logs tables for storage
  - RLS policies for access control
  - Trigger for automatic logging on sign-in

```mermaid
graph LR
AuthTSX["Auth.tsx"] --> ipCheckTS["ipCheck.ts"]
AuthCtxTSX["AuthContext.tsx"] --> ipCheckTS
ipCheckTS --> CheckFunc["check-ip-location Edge Function"]
ipCheckTS --> LogFunc["log-user-ip Edge Function"]
CheckFunc --> BlockedTbl["blocked_ips"]
LogFunc --> LogsTbl["user_ip_logs"]
AdminUI["AdminIPManagement.tsx"] --> BlockedTbl
AdminUI --> LogsTbl
RLS["RLS Policies"] --> BlockedTbl
RLS --> LogsTbl
Trigger["on_auth_user_signin Trigger"] --> LogsTbl
```

**Diagram sources**
- [Auth.tsx:15-203](file://src/pages/Auth.tsx#L15-L203)
- [AuthContext.tsx:87-112](file://src/contexts/AuthContext.tsx#L87-L112)
- [ipCheck.ts:19-107](file://src/lib/ipCheck.ts#L19-L107)
- [check-ip-location/index.ts:1-107](file://supabase/functions/check-ip-location/index.ts#L1-L107)
- [log-user-ip/index.ts:1-65](file://supabase/functions/log-user-ip/index.ts#L1-L65)
- [20250219000000_ip_management.sql:32-49](file://supabase/migrations/20250219000000_ip_management.sql#L32-L49)
- [20250220000008_create_ip_logging_trigger.sql:6-35](file://supabase/migrations/20250220000008_create_ip_logging_trigger.sql#L6-L35)

**Section sources**
- [Auth.tsx:15-203](file://src/pages/Auth.tsx#L15-L203)
- [AuthContext.tsx:87-112](file://src/contexts/AuthContext.tsx#L87-L112)
- [ipCheck.ts:19-107](file://src/lib/ipCheck.ts#L19-L107)
- [check-ip-location/index.ts:1-107](file://supabase/functions/check-ip-location/index.ts#L1-L107)
- [log-user-ip/index.ts:1-65](file://supabase/functions/log-user-ip/index.ts#L1-L65)
- [20250219000000_ip_management.sql:32-49](file://supabase/migrations/20250219000000_ip_management.sql#L32-L49)
- [20250220000008_create_ip_logging_trigger.sql:6-35](file://supabase/migrations/20250220000008_create_ip_logging_trigger.sql#L6-L35)

## Performance Considerations
- Indexes
  - blocked_ips: ip_address, is_active
  - user_ip_logs: user_id, ip_address, created_at DESC
- Edge Function behavior
  - check-ip-location: RPC to is_ip_blocked() plus external geolocation API call
  - log-user-ip: inserts rows with geolocation data
- Fail-open/fail-closed strategies
  - check-ip-location: returns allowed=true on function errors; denies on geolocation API failures
  - ipCheck.ts: returns allowed=true on network failures
- Recommendations
  - Keep indexes aligned with frequent queries (blocked IP existence, recent logs)
  - Consider caching geolocation lookups for repeated IPs
  - Monitor Edge Function latency and error rates

**Section sources**
- [20250219000000_ip_management.sql:25-30](file://supabase/migrations/20250219000000_ip_management.sql#L25-L30)
- [check-ip-location/index.ts:68-78](file://supabase/functions/check-ip-location/index.ts#L68-L78)
- [ipCheck.ts:57-79](file://src/lib/ipCheck.ts#L57-L79)

## Troubleshooting Guide
- IP restriction is disabled for E2E testing
  - The frontend utility returns a predefined result that allows all IPs
  - To re-enable, remove the test bypass and restore original logic
- Edge Function errors
  - check-ip-location returns allowed=true on HTTP errors and function exceptions
  - log-user-ip returns success/failure; non-critical failures are logged
- Authentication flows
  - Signup: displays user-friendly messages based on IP check results
  - Login: attempts IP check; if it fails, logs a warning and proceeds
- Admin UI
  - Ensure admin role is properly set; RLS policies restrict access

**Section sources**
- [IP-BYPASS-STATUS.md:177-187](file://IP-BYPASS-STATUS.md#L177-L187)
- [ipCheck.ts:19-80](file://src/lib/ipCheck.ts#L19-L80)
- [check-ip-location/index.ts:96-106](file://supabase/functions/check-ip-location/index.ts#L96-L106)
- [log-user-ip/index.ts:56-64](file://supabase/functions/log-user-ip/index.ts#L56-L64)
- [Auth.tsx:185-189](file://src/pages/Auth.tsx#L185-L189)
- [AuthContext.tsx:93-100](file://src/contexts/AuthContext.tsx#L93-L100)

## Conclusion
The IP Management and Security system in Nutrio provides:
- A robust database schema for blocking and auditing IP addresses
- Real-time IP validation via Edge Functions with configurable fail-open/fail-closed behavior
- Administrative controls for managing blocked IPs and viewing logs
- Integration points in authentication flows for signup and login
- Performance optimizations through strategic indexing and RLS policies

Implementation status indicates that the database and Edge Functions are ready, while frontend integration and admin UI updates are ongoing. Administrators can manage blocks and review logs, and the system is designed to be resilient under network failures.