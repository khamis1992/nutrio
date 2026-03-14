# Partner Portal

<cite>
**Referenced Files in This Document**
- [App.tsx](file://src/App.tsx)
- [PartnerDashboard.tsx](file://src/pages/partner/PartnerDashboard.tsx)
- [PartnerMenu.tsx](file://src/pages/partner/PartnerMenu.tsx)
- [PartnerOrders.tsx](file://src/pages/partner/PartnerOrders.tsx)
- [PartnerAnalytics.tsx](file://src/pages/partner/PartnerAnalytics.tsx)
- [PartnerOnboarding.tsx](file://src/pages/partner/PartnerOnboarding.tsx)
- [PartnerPayouts.tsx](file://src/pages/partner/PartnerPayouts.tsx)
- [PartnerSettings.tsx](file://src/pages/partner/PartnerSettings.tsx)
- [PartnerBranchOrders.tsx](file://src/components/partner/PartnerBranchOrders.tsx)
- [PartnerDeliveryHandoff.tsx](file://src/components/partner/PartnerDeliveryHandoff.tsx)
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
This document provides comprehensive documentation for the restaurant partner portal, covering restaurant setup and configuration, menu management, order processing workflows, and analytics dashboards. It also explains the branch management system, commission calculations, and payout processing. Additionally, it documents the partner onboarding process, restaurant approval workflows, performance analytics, integration with the fleet management system for delivery coordination, and premium analytics features for business insights.

## Project Structure
The partner portal is integrated into the main application routing and protected by role-based authentication. The portal exposes multiple dedicated pages for restaurant management, menu administration, order fulfillment, analytics, payouts, settings, and onboarding.

```mermaid
graph TB
subgraph "Application Routing"
APP["App.tsx"]
AUTH["PartnerAuth"]
DASHBOARD["PartnerDashboard"]
MENU["PartnerMenu"]
ORDERS["PartnerOrders"]
ANALYTICS["PartnerAnalytics"]
SETTINGS["PartnerSettings"]
PAYOUTS["PartnerPayouts"]
ONBOARDING["PartnerOnboarding"]
BRANCH_ORDERS["PartnerBranchOrders"]
DELIVERY_HANDOFF["PartnerDeliveryHandoff"]
end
APP --> AUTH
APP --> DASHBOARD
APP --> MENU
APP --> ORDERS
APP --> ANALYTICS
APP --> SETTINGS
APP --> PAYOUTS
APP --> ONBOARDING
DASHBOARD --> BRANCH_ORDERS
ORDERS --> DELIVERY_HANDOFF
```

**Diagram sources**
- [App.tsx:364-469](file://src/App.tsx#L364-L469)
- [PartnerDashboard.tsx:1-687](file://src/pages/partner/PartnerDashboard.tsx#L1-L687)
- [PartnerMenu.tsx:1-800](file://src/pages/partner/PartnerMenu.tsx#L1-L800)
- [PartnerOrders.tsx:1-800](file://src/pages/partner/PartnerOrders.tsx#L1-L800)
- [PartnerAnalytics.tsx:1-436](file://src/pages/partner/PartnerAnalytics.tsx#L1-L436)
- [PartnerSettings.tsx:1-357](file://src/pages/partner/PartnerSettings.tsx#L1-L357)
- [PartnerPayouts.tsx:1-985](file://src/pages/partner/PartnerPayouts.tsx#L1-L985)
- [PartnerOnboarding.tsx:1-927](file://src/pages/partner/PartnerOnboarding.tsx#L1-L927)
- [PartnerBranchOrders.tsx:1-369](file://src/components/partner/PartnerBranchOrders.tsx#L1-L369)
- [PartnerDeliveryHandoff.tsx:1-462](file://src/components/partner/PartnerDeliveryHandoff.tsx#L1-L462)

**Section sources**
- [App.tsx:60-74](file://src/App.tsx#L60-L74)
- [App.tsx:364-469](file://src/App.tsx#L364-L469)

## Core Components
This section outlines the primary components of the partner portal and their responsibilities:

- PartnerDashboard: Displays restaurant overview, performance metrics, recent orders, and quick actions. Integrates with Supabase for real-time updates and calculates revenue based on platform commission rates.
- PartnerMenu: Manages menu items, categories, sorting, approvals, and add-ons. Provides AI-powered meal analysis for quick setup.
- PartnerOrders: Handles order lifecycle from placement to completion, including status transitions, real-time notifications, and delivery handoff with QR code verification.
- PartnerAnalytics: Presents basic analytics charts and premium analytics access via a paywall component.
- PartnerOnboarding: Guides restaurant partners through multi-step registration, branding uploads, operational settings, and banking details.
- PartnerPayouts: Calculates earnings, displays payout history, and manages payout requests with configurable frequency and bank details.
- PartnerSettings: Allows restaurant profile updates, operating hours, visibility controls, and commission rate viewing.
- PartnerBranchOrders: Shows branch-specific orders for multi-location restaurants and supports filtering and refresh.
- PartnerDeliveryHandoff: Coordinates delivery handoff with QR code verification and driver information.

**Section sources**
- [PartnerDashboard.tsx:70-687](file://src/pages/partner/PartnerDashboard.tsx#L70-L687)
- [PartnerMenu.tsx:166-800](file://src/pages/partner/PartnerMenu.tsx#L166-L800)
- [PartnerOrders.tsx:185-800](file://src/pages/partner/PartnerOrders.tsx#L185-L800)
- [PartnerAnalytics.tsx:51-436](file://src/pages/partner/PartnerAnalytics.tsx#L51-L436)
- [PartnerOnboarding.tsx:125-927](file://src/pages/partner/PartnerOnboarding.tsx#L125-L927)
- [PartnerPayouts.tsx:227-985](file://src/pages/partner/PartnerPayouts.tsx#L227-L985)
- [PartnerSettings.tsx:43-357](file://src/pages/partner/PartnerSettings.tsx#L43-L357)
- [PartnerBranchOrders.tsx:55-369](file://src/components/partner/PartnerBranchOrders.tsx#L55-L369)
- [PartnerDeliveryHandoff.tsx:52-462](file://src/components/partner/PartnerDeliveryHandoff.tsx#L52-L462)

## Architecture Overview
The partner portal leverages Supabase for backend services, including real-time Postgres changes, storage, and edge functions. Authentication is role-based, requiring the "partner" role and optional approval checks. The frontend components communicate with Supabase using typed queries and real-time subscriptions.

```mermaid
graph TB
subgraph "Frontend"
LAYOUT["PartnerLayout"]
COMPONENTS["Partner Components"]
end
subgraph "Supabase Backend"
TABLES["PostgreSQL Tables<br/>restaurants, meals, orders,<br/>restaurant_details, partner_earnings,<br/>partner_payouts, delivery_jobs"]
REALTIME["Realtime Subscriptions"]
STORAGE["Storage Buckets<br/>restaurant-logos, restaurant-photos"]
FUNCTIONS["Edge Functions<br/>analyze-meal-image,<br/>update_order_status,<br/>refresh_verification_code"]
end
subgraph "External Systems"
FLEET["Fleet Management System"]
DRIVERS["Drivers"]
end
COMPONENTS --> TABLES
COMPONENTS --> REALTIME
COMPONENTS --> STORAGE
COMPONENTS --> FUNCTIONS
TABLES --> FLEET
FLEET --> DRIVERS
```

**Diagram sources**
- [PartnerDashboard.tsx:94-117](file://src/pages/partner/PartnerDashboard.tsx#L94-L117)
- [PartnerMenu.tsx:203-242](file://src/pages/partner/PartnerMenu.tsx#L203-L242)
- [PartnerOrders.tsx:249-308](file://src/pages/partner/PartnerOrders.tsx#L249-L308)
- [PartnerPayouts.tsx:314-361](file://src/pages/partner/PartnerPayouts.tsx#L314-L361)
- [PartnerDeliveryHandoff.tsx:63-134](file://src/components/partner/PartnerDeliveryHandoff.tsx#L63-L134)

## Detailed Component Analysis

### Restaurant Setup and Configuration
The onboarding process guides partners through five steps: restaurant information, contact and hours, branding, operations, and review. It validates inputs, handles media uploads, and creates restaurant records with approval status.

```mermaid
sequenceDiagram
participant Partner as "Partner"
participant Onboarding as "PartnerOnboarding"
participant Supabase as "Supabase"
participant Storage as "Storage Buckets"
Partner->>Onboarding : Start onboarding
Onboarding->>Onboarding : Collect step 1-5 data
Onboarding->>Storage : Upload logo and photos
Storage-->>Onboarding : Return URLs
Onboarding->>Supabase : Insert restaurant record
Onboarding->>Supabase : Upsert restaurant details
Onboarding->>Supabase : Add user role if missing
Supabase-->>Onboarding : Success
Onboarding-->>Partner : Redirect to dashboard
```

**Diagram sources**
- [PartnerOnboarding.tsx:263-385](file://src/pages/partner/PartnerOnboarding.tsx#L263-L385)

**Section sources**
- [PartnerOnboarding.tsx:125-927](file://src/pages/partner/PartnerOnboarding.tsx#L125-L927)

### Menu Management
Menu management supports CRUD operations, categorization, sorting, approval workflows, and add-ons. It integrates AI analysis for rapid meal creation and maintains real-time synchronization with admin approvals.

```mermaid
flowchart TD
Start(["Open Menu Page"]) --> Load["Load Restaurant & Meals"]
Load --> View["View & Filter by Category"]
View --> Sort["Sort Options"]
Sort --> Actions{"Action Selected"}
Actions --> |Add/Edit| Form["Open Add/Edit Dialog"]
Actions --> |Delete| Confirm["Confirm Deletion"]
Actions --> |Toggle Availability| Toggle["Update Availability"]
Form --> Validate["Validate Form"]
Validate --> |Valid| Save["Save to Supabase"]
Validate --> |Invalid| Errors["Show Validation Errors"]
Save --> Approval["Approval Workflow"]
Approval --> Sync["Real-time Sync"]
Confirm --> Delete["Delete from Supabase"]
Toggle --> Update["Update Availability"]
Delete --> Reload["Reload Menu"]
Update --> Reload
Reload --> View
Errors --> Form
```

**Diagram sources**
- [PartnerMenu.tsx:249-300](file://src/pages/partner/PartnerMenu.tsx#L249-L300)
- [PartnerMenu.tsx:465-527](file://src/pages/partner/PartnerMenu.tsx#L465-L527)
- [PartnerMenu.tsx:203-242](file://src/pages/partner/PartnerMenu.tsx#L203-L242)

**Section sources**
- [PartnerMenu.tsx:166-800](file://src/pages/partner/PartnerMenu.tsx#L166-L800)

### Order Processing Workflows
Order processing spans multiple statuses from pending to completed. The system provides real-time updates, status transitions, and delivery handoff with QR code verification and driver information.

```mermaid
sequenceDiagram
participant Customer as "Customer"
participant System as "System"
participant Partner as "Partner"
participant Delivery as "Delivery System"
participant Driver as "Driver"
Customer->>System : Place Order
System-->>Partner : Real-time Notification
Partner->>System : Accept Order
Partner->>System : Mark Preparing
Partner->>System : Mark Ready
System->>Delivery : Assign Driver
Delivery->>Driver : Dispatch
Driver->>Partner : Arrive at Restaurant
Partner->>Delivery : Handoff with QR/Code
Delivery-->>System : Update Status
System-->>Customer : Track Delivery
Driver->>System : Mark Picked Up/Delivered
System-->>Partner : Update Completion
```

**Diagram sources**
- [PartnerOrders.tsx:479-510](file://src/pages/partner/PartnerOrders.tsx#L479-L510)
- [PartnerDeliveryHandoff.tsx:136-180](file://src/components/partner/PartnerDeliveryHandoff.tsx#L136-L180)

**Section sources**
- [PartnerOrders.tsx:185-800](file://src/pages/partner/PartnerOrders.tsx#L185-L800)
- [PartnerDeliveryHandoff.tsx:52-462](file://src/components/partner/PartnerDeliveryHandoff.tsx#L52-L462)

### Analytics Dashboard
The analytics dashboard provides basic charts and summaries, with access to premium analytics via a paywall component. It computes revenue, orders, and customer metrics using platform commission rates.

```mermaid
flowchart TD
Load(["Load Analytics"]) --> Fetch["Fetch Restaurant & Meals"]
Fetch --> Compute["Compute Metrics<br/>Daily Revenue, Orders,<br/>Top Meals, Distribution"]
Compute --> Basic["Render Basic Charts"]
Basic --> Premium{"Premium Access?"}
Premium --> |Yes| PremiumDash["Show Premium Dashboard"]
Premium --> |No| Paywall["Show Premium Paywall"]
PremiumDash --> Export["Export Data"]
Paywall --> Purchase["Purchase Premium"]
```

**Diagram sources**
- [PartnerAnalytics.tsx:76-191](file://src/pages/partner/PartnerAnalytics.tsx#L76-L191)
- [PartnerAnalytics.tsx:404-430](file://src/pages/partner/PartnerAnalytics.tsx#L404-L430)

**Section sources**
- [PartnerAnalytics.tsx:51-436](file://src/pages/partner/PartnerAnalytics.tsx#L51-L436)

### Branch Management System
Branch management enables multi-location restaurants to view and filter orders by branch. It supports branch selection, filtering by status, and distance calculation for delivery estimation.

```mermaid
classDiagram
class RestaurantBranch {
+string id
+string restaurant_id
+string name
+string address
+number latitude
+number longitude
+string phone_number
+boolean is_active
}
class BranchOrder {
+string id
+string created_at
+string status
+number total_amount
+string delivery_address
+string customer_name
+string customer_phone
+string estimated_delivery_time
+Meal[] meals
}
RestaurantBranch "1" --> "*" BranchOrder : "has"
```

**Diagram sources**
- [PartnerBranchOrders.tsx:24-48](file://src/components/partner/PartnerBranchOrders.tsx#L24-L48)

**Section sources**
- [PartnerBranchOrders.tsx:55-369](file://src/components/partner/PartnerBranchOrders.tsx#L55-L369)

### Commission Calculations and Payout Processing
Payout processing calculates net earnings after platform commission, manages payout requests, and tracks history. Bank details are stored and validated for payout eligibility.

```mermaid
flowchart TD
Start(["Open Payouts"]) --> Load["Load Restaurant & Earnings"]
Load --> Rates["Load Commission Rate"]
Rates --> Compute["Compute Totals<br/>Gross, Commission, Net"]
Compute --> Pending["Sum Pending Payouts"]
Pending --> Available["Calculate Available for Payout"]
Available --> Request{"Request Payout?"}
Request --> |Yes| Submit["Submit Payout Request"]
Request --> |No| Review["Review History"]
Submit --> Update["Update Payout Status"]
Update --> Review
Review --> Export["Export Earnings CSV"]
```

**Diagram sources**
- [PartnerPayouts.tsx:311-361](file://src/pages/partner/PartnerPayouts.tsx#L311-L361)
- [PartnerPayouts.tsx:365-389](file://src/pages/partner/PartnerPayouts.tsx#L365-L389)

**Section sources**
- [PartnerPayouts.tsx:227-985](file://src/pages/partner/PartnerPayouts.tsx#L227-L985)

### Partner Onboarding Process
The onboarding wizard collects restaurant details, branding assets, operational settings, and banking information. It enforces validation rules and creates restaurant records with approval status.

```mermaid
sequenceDiagram
participant Partner as "Partner"
participant Wizard as "Onboarding Wizard"
participant Supabase as "Supabase"
participant Storage as "Storage"
Partner->>Wizard : Start Registration
Wizard->>Wizard : Step 1 : Restaurant Info
Wizard->>Wizard : Step 2 : Contact & Hours
Wizard->>Wizard : Step 3 : Branding Uploads
Wizard->>Storage : Upload Logo & Photos
Storage-->>Wizard : Return URLs
Wizard->>Wizard : Step 4 : Operations & Banking
Wizard->>Supabase : Create Restaurant
Wizard->>Supabase : Upsert Details
Wizard->>Supabase : Add Role
Supabase-->>Wizard : Success
Wizard-->>Partner : Redirect to Dashboard
```

**Diagram sources**
- [PartnerOnboarding.tsx:263-385](file://src/pages/partner/PartnerOnboarding.tsx#L263-L385)

**Section sources**
- [PartnerOnboarding.tsx:125-927](file://src/pages/partner/PartnerOnboarding.tsx#L125-L927)

### Restaurant Approval Workflows
Approval workflows integrate with admin controls for menu items exceeding thresholds and restaurant registration. Real-time notifications inform partners of approval/rejection decisions.

```mermaid
sequenceDiagram
participant Partner as "Partner"
participant System as "System"
participant Admin as "Admin"
Partner->>System : Submit Meal/Restaurant
System-->>Partner : Pending Approval
Admin->>System : Approve/Reject
System-->>Partner : Approval Notification
Partner-->>System : Proceed with Availability
```

**Diagram sources**
- [PartnerMenu.tsx:465-527](file://src/pages/partner/PartnerMenu.tsx#L465-L527)
- [PartnerMenu.tsx:203-242](file://src/pages/partner/PartnerMenu.tsx#L203-L242)

**Section sources**
- [PartnerMenu.tsx:166-800](file://src/pages/partner/PartnerMenu.tsx#L166-L800)

### Performance Analytics
Performance analytics aggregates order data, computes revenue trends, and visualizes top-performing meals and distribution by meal type. It uses platform commission rates to derive net earnings.

```mermaid
flowchart TD
Fetch(["Fetch Schedules"]) --> Aggregate["Aggregate by Day/Month"]
Aggregate --> Trends["Compute Revenue Trends"]
Trends --> Top["Rank Top Meals"]
Top --> Charts["Render Charts & Stats"]
```

**Diagram sources**
- [PartnerAnalytics.tsx:117-191](file://src/pages/partner/PartnerAnalytics.tsx#L117-L191)

**Section sources**
- [PartnerAnalytics.tsx:51-436](file://src/pages/partner/PartnerAnalytics.tsx#L51-L436)

### Integration with Fleet Management System
The delivery handoff component integrates with the fleet management system to coordinate driver assignments, QR code verification, and real-time status updates. It provides driver contact information and delivery fee details.

```mermaid
sequenceDiagram
participant Partner as "Partner"
participant Handoff as "Delivery Handoff"
participant Fleet as "Fleet System"
participant Driver as "Driver"
Partner->>Handoff : Ready for Pickup
Handoff->>Fleet : Request/Refresh Verification Code
Fleet-->>Handoff : Provide Code/QR
Fleet->>Driver : Assign Job
Driver->>Partner : Arrive & Verify
Partner->>Fleet : Handoff Confirmation
Fleet-->>Handoff : Update Status
```

**Diagram sources**
- [PartnerDeliveryHandoff.tsx:136-180](file://src/components/partner/PartnerDeliveryHandoff.tsx#L136-L180)
- [PartnerDeliveryHandoff.tsx:63-134](file://src/components/partner/PartnerDeliveryHandoff.tsx#L63-L134)

**Section sources**
- [PartnerDeliveryHandoff.tsx:52-462](file://src/components/partner/PartnerDeliveryHandoff.tsx#L52-L462)

## Dependency Analysis
The partner portal components depend on shared layouts, authentication contexts, and Supabase services. Real-time subscriptions and edge functions enhance responsiveness and automation.

```mermaid
graph TB
DASHBOARD["PartnerDashboard"] --> SUPABASE["Supabase Client"]
MENU["PartnerMenu"] --> SUPABASE
ORDERS["PartnerOrders"] --> SUPABASE
ANALYTICS["PartnerAnalytics"] --> SUPABASE
PAYOUTS["PartnerPayouts"] --> SUPABASE
SETTINGS["PartnerSettings"] --> SUPABASE
BRANCH["PartnerBranchOrders"] --> SUPABASE
HANDOFF["PartnerDeliveryHandoff"] --> SUPABASE
SUPABASE --> TABLES["PostgreSQL Tables"]
SUPABASE --> STORAGE["Storage Buckets"]
SUPABASE --> FUNCTIONS["Edge Functions"]
AUTH["Auth Context"] --> DASHBOARD
AUTH --> MENU
AUTH --> ORDERS
AUTH --> ANALYTICS
AUTH --> PAYOUTS
AUTH --> SETTINGS
```

**Diagram sources**
- [PartnerDashboard.tsx:30-36](file://src/pages/partner/PartnerDashboard.tsx#L30-L36)
- [PartnerMenu.tsx:52-58](file://src/pages/partner/PartnerMenu.tsx#L52-L58)
- [PartnerOrders.tsx:29-33](file://src/pages/partner/PartnerOrders.tsx#L29-L33)
- [PartnerAnalytics.tsx:14-20](file://src/pages/partner/PartnerAnalytics.tsx#L14-L20)
- [PartnerPayouts.tsx:51-54](file://src/pages/partner/PartnerPayouts.tsx#L51-L54)
- [PartnerSettings.tsx:11-15](file://src/pages/partner/PartnerSettings.tsx#L11-L15)
- [PartnerBranchOrders.tsx:20-22](file://src/components/partner/PartnerBranchOrders.tsx#L20-L22)
- [PartnerDeliveryHandoff.tsx:16-19](file://src/components/partner/PartnerDeliveryHandoff.tsx#L16-L19)

**Section sources**
- [PartnerDashboard.tsx:70-687](file://src/pages/partner/PartnerDashboard.tsx#L70-L687)
- [PartnerMenu.tsx:166-800](file://src/pages/partner/PartnerMenu.tsx#L166-L800)
- [PartnerOrders.tsx:185-800](file://src/pages/partner/PartnerOrders.tsx#L185-L800)
- [PartnerAnalytics.tsx:51-436](file://src/pages/partner/PartnerAnalytics.tsx#L51-L436)
- [PartnerPayouts.tsx:227-985](file://src/pages/partner/PartnerPayouts.tsx#L227-L985)
- [PartnerSettings.tsx:43-357](file://src/pages/partner/PartnerSettings.tsx#L43-L357)
- [PartnerBranchOrders.tsx:55-369](file://src/components/partner/PartnerBranchOrders.tsx#L55-L369)
- [PartnerDeliveryHandoff.tsx:52-462](file://src/components/partner/PartnerDeliveryHandoff.tsx#L52-L462)

## Performance Considerations
- Real-time subscriptions reduce polling overhead and improve user experience.
- Batch operations (e.g., fetching add-ons for multiple meals) minimize network requests.
- Chart rendering uses responsive containers to optimize layout performance.
- Image uploads leverage Supabase storage with size validation to prevent large payloads.
- Date range filtering and computed summaries help avoid heavy computations on the client.

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures during AI analysis: The system detects unauthorized sessions and redirects to the auth page.
- Real-time updates not firing: Verify Supabase subscriptions and network connectivity.
- Approval notifications: Ensure admin updates are reflected in real-time channels.
- Payout submission errors: Validate bank details and available balance before requesting payouts.
- Delivery handoff delays: Confirm driver assignment and refresh verification codes when expired.

**Section sources**
- [PartnerMenu.tsx:398-452](file://src/pages/partner/PartnerMenu.tsx#L398-L452)
- [PartnerOrders.tsx:249-308](file://src/pages/partner/PartnerOrders.tsx#L249-L308)
- [PartnerPayouts.tsx:365-389](file://src/pages/partner/PartnerPayouts.tsx#L365-L389)
- [PartnerDeliveryHandoff.tsx:182-186](file://src/components/partner/PartnerDeliveryHandoff.tsx#L182-L186)

## Conclusion
The partner portal provides a comprehensive suite of tools for restaurant partners to manage their operations effectively. From onboarding and menu management to order fulfillment, analytics, and payouts, the system integrates seamlessly with Supabase and the fleet management system. The branch management and delivery handoff features enable efficient multi-location operations, while premium analytics offer advanced insights for business growth.