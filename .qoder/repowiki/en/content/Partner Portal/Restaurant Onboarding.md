# Restaurant Onboarding

<cite>
**Referenced Files in This Document**
- [PartnerOnboarding.tsx](file://src/pages/partner/PartnerOnboarding.tsx)
- [PendingApproval.tsx](file://src/pages/partner/PendingApproval.tsx)
- [client.ts](file://src/integrations/supabase/client.ts)
- [types.ts](file://supabase/types.ts)
- [20260221150000_comprehensive_business_model_fix.sql](file://supabase/migrations/20260221150000_comprehensive_business_model_fix.sql)
- [20250219000006_sync_restaurant_columns.sql](file://supabase/migrations/20250219000006_sync_restaurant_columns.sql)
- [20260221000002_fix_restaurants_columns.sql](file://supabase/migrations/20260221000002_fix_restaurants_columns.sql)
- [partner-onboarding.spec.ts](file://e2e/cross-portal/partner-onboarding.spec.ts)
- [onboarding.spec.ts](file://e2e/partner/onboarding.spec.ts)
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
This document describes the restaurant onboarding system in the partner portal. It covers the multi-step wizard process for collecting restaurant information, branding assets, operational details, and banking information. It explains validation requirements, progress saving, the pending approval status system, and communication workflows. It also documents the integration with Supabase authentication and database operations for storing restaurant information.

## Project Structure
The restaurant onboarding is implemented as a five-step wizard within the partner portal. The frontend components coordinate with Supabase for authentication and data persistence, while database migrations define the schema and policies.

```mermaid
graph TB
subgraph "Frontend"
PO["PartnerOnboarding.tsx<br/>Step 1-5 Wizard"]
PA["PendingApproval.tsx<br/>Status Display"]
SC["Supabase Client<br/>Auth + Storage"]
end
subgraph "Database"
RT["restaurants<br/>approval_status, owner_id"]
RD["restaurant_details<br/>extended info + banking"]
UR["user_roles<br/>restaurant role"]
end
PO --> SC
PA --> SC
SC --> RT
SC --> RD
SC --> UR
```

**Diagram sources**
- [PartnerOnboarding.tsx:125-927](file://src/pages/partner/PartnerOnboarding.tsx#L125-L927)
- [PendingApproval.tsx:23-80](file://src/pages/partner/PendingApproval.tsx#L23-L80)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)
- [20260221150000_comprehensive_business_model_fix.sql:46-129](file://supabase/migrations/20260221150000_comprehensive_business_model_fix.sql#L46-L129)

**Section sources**
- [PartnerOnboarding.tsx:107-113](file://src/pages/partner/PartnerOnboarding.tsx#L107-L113)
- [PendingApproval.tsx:23-80](file://src/pages/partner/PendingApproval.tsx#L23-L80)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)

## Core Components
- PartnerOnboarding wizard: Collects restaurant information, branding, operations, and banking details; validates inputs; uploads media; submits application.
- PendingApproval page: Shows current approval status, timeline, and next steps.
- Supabase integration: Provides authentication, session persistence, and database/storage operations.
- Database schema: Defines restaurants and restaurant_details tables with approval lifecycle and RLS policies.

Key responsibilities:
- Step 1: Restaurant Info (name, description, cuisine types, dietary tags)
- Step 2: Contact & Hours (address, phone, email, website, operating hours)
- Step 3: Branding (logo upload, photo gallery)
- Step 4: Operations & Banking (prep time, capacity, bank details)
- Step 5: Terms & Submit (review and acceptance)

Validation highlights:
- Step 1: Name and description length, cuisine types required
- Step 2: Address and phone minimum lengths
- Step 4: Numeric fields > 0, bank details required
- Step 5: Terms acceptance required

Progress saving:
- Local storage persists current step and data during the wizard
- Auto-save draft with debounced updates
- Recovery dialog appears if a recent draft exists

Approval workflow:
- Submission sets approval_status to "pending"
- PendingApproval displays status and guidance
- Admin approval transitions to "approved"

**Section sources**
- [PartnerOnboarding.tsx:236-261](file://src/pages/partner/PartnerOnboarding.tsx#L236-L261)
- [PartnerOnboarding.tsx:263-385](file://src/pages/partner/PartnerOnboarding.tsx#L263-L385)
- [PendingApproval.tsx:36-80](file://src/pages/partner/PendingApproval.tsx#L36-L80)
- [20260221150000_comprehensive_business_model_fix.sql:46-129](file://supabase/migrations/20260221150000_comprehensive_business_model_fix.sql#L46-L129)

## Architecture Overview
The onboarding flow integrates frontend components with Supabase for authentication, storage, and database operations. The backend schema supports approval lifecycle and extended restaurant details.

```mermaid
sequenceDiagram
participant U as "Partner User"
participant W as "PartnerOnboarding.tsx"
participant SB as "Supabase Client"
participant ST as "Storage (restaurant-logos/photos)"
participant DB as "Database (restaurants, restaurant_details)"
U->>W : Open /partner/onboarding
W->>SB : Read user session
loop Step progression
U->>W : Fill step data
W->>W : Validate step inputs
W->>SB : Save draft to local storage
end
U->>W : Submit
W->>ST : Upload logo (optional)
W->>ST : Upload photos (optional)
W->>DB : Insert restaurants (approval_status=pending)
W->>DB : Insert restaurant_details
W->>DB : Upsert user_roles (restaurant)
W-->>U : Show pending approval status
```

**Diagram sources**
- [PartnerOnboarding.tsx:263-385](file://src/pages/partner/PartnerOnboarding.tsx#L263-L385)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)
- [20260221150000_comprehensive_business_model_fix.sql:46-129](file://supabase/migrations/20260221150000_comprehensive_business_model_fix.sql#L46-L129)

## Detailed Component Analysis

### PartnerOnboarding Wizard
The wizard is a five-step form with validation and media upload capabilities. It manages state for all onboarding fields and coordinates submission.

```mermaid
flowchart TD
Start(["Open /partner/onboarding"]) --> Step1["Step 1: Restaurant Info<br/>Name, Description, Cuisine Types, Dietary Tags"]
Step1 --> Validate1{"Inputs valid?"}
Validate1 --> |No| Step1
Validate1 --> |Yes| Step2["Step 2: Contact & Hours<br/>Address, Phone, Email, Website, Hours"]
Step2 --> Validate2{"Inputs valid?"}
Validate2 --> |No| Step2
Validate2 --> |Yes| Step3["Step 3: Branding<br/>Logo Upload, Photos Gallery"]
Step3 --> Step4["Step 4: Operations & Banking<br/>Prep Time, Capacity, Bank Details"]
Step4 --> Validate4{"Inputs valid?"}
Validate4 --> |No| Step4
Validate4 --> |Yes| Step5["Step 5: Terms & Submit<br/>Review + Accept Terms"]
Step5 --> Submit{"Terms accepted?"}
Submit --> |No| Step5
Submit --> |Yes| Save["Upload Assets (if any)"]
Save --> CreateRest["Insert restaurants (pending)"]
CreateRest --> CreateDetails["Insert restaurant_details"]
CreateDetails --> Role["Upsert user_roles (restaurant)"]
Role --> Pending["Navigate to Pending Approval"]
```

**Diagram sources**
- [PartnerOnboarding.tsx:236-261](file://src/pages/partner/PartnerOnboarding.tsx#L236-L261)
- [PartnerOnboarding.tsx:263-385](file://src/pages/partner/PartnerOnboarding.tsx#L263-L385)
- [PartnerOnboarding.tsx:874-927](file://src/pages/partner/PartnerOnboarding.tsx#L874-L927)

Key implementation details:
- Step validation functions enforce required fields and numeric constraints
- Media upload handles file size limits and generates previews
- Submission writes to restaurants and restaurant_details tables
- Adds restaurant role to user_roles

**Section sources**
- [PartnerOnboarding.tsx:236-261](file://src/pages/partner/PartnerOnboarding.tsx#L236-L261)
- [PartnerOnboarding.tsx:263-385](file://src/pages/partner/PartnerOnboarding.tsx#L263-L385)
- [PartnerOnboarding.tsx:874-927](file://src/pages/partner/PartnerOnboarding.tsx#L874-L927)

### Pending Approval Page
Displays the current approval status, timeline, and next steps. Handles navigation and sign-out.

```mermaid
flowchart TD
PA_Start(["Open /partner/pending-approval"]) --> Fetch["Fetch restaurant by owner_id"]
Fetch --> Found{"Restaurant found?"}
Found --> |No| Redirect["Redirect to /partner/onboarding"]
Found --> |Yes| CheckStatus{"approval_status"}
CheckStatus --> |approved| Dash["Redirect to /partner dashboard"]
CheckStatus --> |pending| ShowPending["Show pending status + timeline"]
CheckStatus --> |rejected| ShowRejected["Show rejection reason + actions"]
ShowPending --> Actions["Contact support, wait for review"]
ShowRejected --> Actions
```

**Diagram sources**
- [PendingApproval.tsx:36-80](file://src/pages/partner/PendingApproval.tsx#L36-L80)

**Section sources**
- [PendingApproval.tsx:36-80](file://src/pages/partner/PendingApproval.tsx#L36-L80)

### Supabase Integration
Authentication and session persistence are configured with a custom storage adapter for native environments. Database types and migrations define the schema and policies.

```mermaid
classDiagram
class SupabaseClient {
+createClient()
+auth.storage
+from(table)
+storage.from(bucket)
}
class RestaurantsTable {
+uuid id
+uuid owner_id
+text name
+text description
+text approval_status
+jsonb operating_hours
+text logo_url
+numeric payout_rate
+jsonb bank_info
+timestamp created_at
}
class RestaurantDetailsTable {
+uuid id
+uuid restaurant_id
+text[] cuisine_type
+text[] dietary_tags
+text website_url
+jsonb operating_hours
+integer avg_prep_time_minutes
+integer max_meals_per_day
+text bank_name
+text bank_account_name
+text bank_account_number
+text bank_iban
+boolean onboarding_completed
+boolean terms_accepted
+timestamp terms_accepted_at
}
class UserRolesTable {
+uuid id
+uuid user_id
+text role
}
SupabaseClient --> RestaurantsTable : "insert/select/update"
SupabaseClient --> RestaurantDetailsTable : "insert/select/update"
SupabaseClient --> UserRolesTable : "insert/select"
```

**Diagram sources**
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)
- [types.ts:1-3331](file://supabase/types.ts#L1-L3331)
- [20260221150000_comprehensive_business_model_fix.sql:46-129](file://supabase/migrations/20260221150000_comprehensive_business_model_fix.sql#L46-L129)

**Section sources**
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)
- [types.ts:1-3331](file://supabase/types.ts#L1-L3331)
- [20260221150000_comprehensive_business_model_fix.sql:46-129](file://supabase/migrations/20260221150000_comprehensive_business_model_fix.sql#L46-L129)

## Dependency Analysis
The onboarding wizard depends on Supabase for authentication, storage, and database operations. The database schema defines the approval lifecycle and extended restaurant details.

```mermaid
graph LR
PO["PartnerOnboarding.tsx"] --> SB["Supabase Client"]
SB --> AUTH["Auth (localStorage/Capacitor)"]
SB --> STORE["Storage (restaurant-logos, restaurant-photos)"]
SB --> DB["Database (restaurants, restaurant_details, user_roles)"]
PA["PendingApproval.tsx"] --> SB
SB --> DB
```

**Diagram sources**
- [PartnerOnboarding.tsx:263-385](file://src/pages/partner/PartnerOnboarding.tsx#L263-L385)
- [PendingApproval.tsx:36-80](file://src/pages/partner/PendingApproval.tsx#L36-L80)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)

**Section sources**
- [PartnerOnboarding.tsx:263-385](file://src/pages/partner/PartnerOnboarding.tsx#L263-L385)
- [PendingApproval.tsx:36-80](file://src/pages/partner/PendingApproval.tsx#L36-L80)
- [client.ts:47-57](file://src/integrations/supabase/client.ts#L47-L57)

## Performance Considerations
- Debounced auto-save reduces write frequency to local storage during onboarding.
- File uploads use small, validated previews to minimize network overhead.
- Database writes are batched per step to avoid unnecessary transactions.
- RLS policies ensure efficient row filtering for restaurant details.

## Troubleshooting Guide
Common issues and resolutions:
- Missing environment variables: Ensure Supabase URL and publishable key are configured; otherwise, initialization logs an error.
- File size exceeded: Logo and photo uploads reject files larger than the configured limit; reduce file size or resolution.
- Validation failures: Steps require specific minimum lengths and numeric ranges; correct inputs before proceeding.
- Approval status not updating: Confirm restaurants table has approval_status column and user_roles includes restaurant role after submission.
- Pending status page shows error: Verify the restaurant record exists for the current user and approval_status is populated.

Practical examples:
- Successful onboarding: After submission, approval_status transitions to "pending" and user receives a toast notification.
- Rejected application: PendingApproval displays rejection reason and provides contact support options.
- Resuming onboarding: Auto-saved drafts appear in a recovery dialog if a recent draft exists.

**Section sources**
- [client.ts:10-16](file://src/integrations/supabase/client.ts#L10-L16)
- [PartnerOnboarding.tsx:190-234](file://src/pages/partner/PartnerOnboarding.tsx#L190-L234)
- [PartnerOnboarding.tsx:369-385](file://src/pages/partner/PartnerOnboarding.tsx#L369-L385)
- [PendingApproval.tsx:70-80](file://src/pages/partner/PendingApproval.tsx#L70-L80)
- [20250219000006_sync_restaurant_columns.sql:1-83](file://supabase/migrations/20250219000006_sync_restaurant_columns.sql#L1-L83)
- [20260221000002_fix_restaurants_columns.sql:1-36](file://supabase/migrations/20260221000002_fix_restaurants_columns.sql#L1-L36)

## Conclusion
The restaurant onboarding system provides a structured, validated, and resilient five-step wizard integrated with Supabase authentication and database operations. It supports progress saving, media uploads, and a clear pending approval workflow with status communication. The schema and policies ensure secure and scalable data management for restaurant profiles and extended details.