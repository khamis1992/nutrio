# Order & Delivery Tables

<cite>
**Referenced Files in This Document**
- [delivery_system_design.md](file://delivery_system_design.md)
- [delivery_system_plan.md](file://delivery_system_plan.md)
- [delivery_integration_plan.md](file://delivery_integration_plan.md)
- [delivery_system_visual.md](file://delivery_system_visual.md)
- [delivery_queue_migration.sql](file://supabase/migrations/20240101000003_add_delivery_queue.sql)
- [cancel_order_rpc.sql](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql)
- [CREATE_TABLES_SQL.md](file://CREATE_TABLES_SQL.md)
- [delivery_tracking_page.tsx](file://src/pages/DeliveryTracking.tsx)
- [order_tracking_hub.tsx](file://src/components/OrderTrackingHub.tsx)
- [order_modification_hook.ts](file://src/hooks/useOrderModification.ts)
- [delivery_api.ts](file://src/integrations/supabase/delivery.ts)
- [driver_delivery_tracker.tsx](file://src/components/customer/CustomerDeliveryTracker.tsx)
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
This document provides comprehensive technical documentation for the order management and delivery tracking system, focusing on the database tables, workflows, and real-time tracking capabilities. It covers order lifecycle management, delivery routing algorithms, driver assignment logic, real-time delivery status updates, order modification and cancellation procedures, refund processing, delivery fee calculations, tip management, and performance metrics tracking.

## Project Structure
The order and delivery system spans frontend components, backend API integrations, and database schema with stored procedures. The key areas include:
- Database schema with delivery-related tables and stored procedures
- Frontend pages and components for order tracking and delivery monitoring
- API integration layer for driver management, job assignment, and real-time updates
- Migration files defining table structures and business logic

```mermaid
graph TB
subgraph "Frontend"
DT["DeliveryTracking Page"]
OTH["OrderTrackingHub Component"]
CDT["CustomerDeliveryTracker Component"]
end
subgraph "Backend API"
DA["Delivery API Module"]
end
subgraph "Database"
O["orders"]
OI["order_items"]
MQ["delivery_queue"]
OC["order_cancellations"]
DJ["delivery_jobs"]
D["drivers"]
DL["driver_locations"]
end
DT --> DA
OTH --> DA
CDT --> DA
DA --> MQ
DA --> DJ
DA --> D
DA --> DL
DT --> O
DT --> OI
DT --> OC
```

**Diagram sources**
- [delivery_tracking_page.tsx:113-592](file://src/pages/DeliveryTracking.tsx#L113-L592)
- [order_tracking_hub.tsx:37-235](file://src/components/OrderTrackingHub.tsx#L37-L235)
- [delivery_api.ts:1-735](file://src/integrations/supabase/delivery.ts#L1-L735)
- [delivery_queue_migration.sql:9-60](file://supabase/migrations/20240101000003_add_delivery_queue.sql#L9-L60)
- [cancel_order_rpc.sql:9-36](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql#L9-L36)

**Section sources**
- [delivery_system_design.md:1-510](file://delivery_system_design.md#L1-L510)
- [delivery_system_plan.md:1-155](file://delivery_system_plan.md#L1-L155)

## Core Components
This section documents the primary database tables and their relationships, along with the frontend components that interact with them.

### Database Tables

#### Orders and Order Items
- **orders**: Central order record containing user association, status, timing, and financial details.
- **order_items**: Links meals to orders with quantities and supports multi-meal orders.

#### Delivery Queue and Cancellations
- **delivery_queue**: Manages orders awaiting driver assignment with priority scoring, status tracking, and escalation mechanisms.
- **order_cancellations**: Audit trail for cancellations including reasons, refund amounts, and policy enforcement.

#### Delivery Jobs and Drivers
- **delivery_jobs**: Tracks driver assignments, job statuses, timing, photos, and financial outcomes.
- **drivers**: Driver profiles, availability, ratings, and current location tracking.
- **driver_locations**: Historical location data for real-time tracking and analytics.

#### Supporting Tables
- **meal_schedules**: Links orders to scheduled delivery times and manages order_status for tracking.
- **restaurants**: Restaurant metadata used for delivery routing and driver assignment.

```mermaid
erDiagram
ORDERS {
uuid id PK
uuid user_id FK
uuid restaurant_id FK
text status
numeric total_amount
timestamp estimated_delivery_time
text delivery_address
numeric delivery_lat
numeric delivery_lng
numeric delivery_fee
numeric tip_amount
timestamp created_at
timestamp updated_at
}
ORDER_ITEMS {
uuid id PK
uuid order_id FK
uuid meal_id FK
integer quantity
}
MEAL_SCHEDULES {
uuid id PK
uuid user_id FK
uuid meal_id FK
date scheduled_date
text meal_type
text order_status
boolean is_completed
timestamp created_at
}
DELIVERY_QUEUE {
uuid id PK
uuid order_id FK
uuid restaurant_id FK
text status
uuid assigned_driver_id FK
integer priority_score
timestamp expires_at
numeric delivery_fee
numeric tip_amount
timestamp queued_at
timestamp updated_at
}
ORDER_CANCELLATIONS {
uuid id PK
uuid order_id FK
uuid user_id FK
uuid cancelled_by FK
text cancelled_by_role
text reason
text reason_category
numeric refund_amount
text refund_type
uuid wallet_transaction_id FK
numeric cancellation_fee
timestamp created_at
}
DELIVERY_JOBS {
uuid id PK
uuid schedule_id FK
uuid driver_id FK
text status
timestamp assigned_at
timestamp accepted_at
timestamp picked_up_at
timestamp delivered_at
numeric driver_earnings
timestamp created_at
timestamp updated_at
}
DRIVERS {
uuid id PK
uuid user_id FK
varchar phone_number
varchar vehicle_type
boolean is_active
geography current_location
timestamp last_location_update
integer total_deliveries
decimal rating
timestamp created_at
}
DRIVER_LOCATIONS {
uuid id PK
uuid driver_id FK
geography location
decimal accuracy_meters
decimal heading
decimal speed_kmh
timestamp timestamp
}
RESTAURANTS {
uuid id PK
uuid owner_id FK
varchar name
numeric latitude
numeric longitude
varchar address
}
ORDERS ||--o{ ORDER_ITEMS : "contains"
ORDERS ||--o{ DELIVERY_QUEUE : "queued"
ORDERS ||--o{ MEAL_SCHEDULES : "scheduled"
MEAL_SCHEDULES ||--o{ DELIVERY_JOBS : "mapped_to"
DRIVERS ||--o{ DELIVERY_JOBS : "assigned"
DRIVERS ||--o{ DRIVER_LOCATIONS : "tracked_by"
RESTAURANTS ||--o{ ORDERS : "hosts"
```

**Diagram sources**
- [delivery_queue_migration.sql:9-60](file://supabase/migrations/20240101000003_add_delivery_queue.sql#L9-L60)
- [cancel_order_rpc.sql:9-36](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql#L9-L36)
- [delivery_system_visual.md:74-100](file://delivery_system_visual.md#L74-L100)
- [delivery_integration_plan.md:64-137](file://delivery_integration_plan.md#L64-L137)

**Section sources**
- [delivery_queue_migration.sql:1-595](file://supabase/migrations/20240101000003_add_delivery_queue.sql#L1-L595)
- [cancel_order_rpc.sql:1-393](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql#L1-L393)
- [delivery_system_visual.md:74-119](file://delivery_system_visual.md#L74-L119)
- [delivery_integration_plan.md:64-137](file://delivery_integration_plan.md#L64-L137)

## Architecture Overview
The system follows a modular architecture with clear separation between order management, delivery orchestration, and real-time tracking. The frontend components subscribe to database changes for live updates, while the backend API encapsulates driver assignment, job lifecycle transitions, and location tracking.

```mermaid
sequenceDiagram
participant Customer as "Customer App"
participant Page as "DeliveryTracking Page"
participant API as "Delivery API"
participant DB as "Supabase DB"
Customer->>Page : Open "My Orders"
Page->>API : Fetch orders and scheduled meals
API->>DB : Query orders, order_items, meal_schedules
DB-->>API : Return data
API-->>Page : Orders with status and items
Page->>DB : Real-time subscription to meal_schedules
DB-->>Page : Status updates (confirmed, preparing, ready, delivered)
Page-->>Customer : Live order tracking cards
```

**Diagram sources**
- [delivery_tracking_page.tsx:138-275](file://src/pages/DeliveryTracking.tsx#L138-L275)
- [order_tracking_hub.tsx:44-114](file://src/components/OrderTrackingHub.tsx#L44-L114)

**Section sources**
- [delivery_tracking_page.tsx:113-275](file://src/pages/DeliveryTracking.tsx#L113-L275)
- [order_tracking_hub.tsx:37-114](file://src/components/OrderTrackingHub.tsx#L37-L114)

## Detailed Component Analysis

### Order Lifecycle Management
The order lifecycle spans from creation through delivery completion, with explicit status transitions and real-time updates.

```mermaid
stateDiagram-v2
[*] --> Pending
Pending --> Confirmed : Partner confirms
Confirmed --> Preparing : Restaurant starts prep
Preparing --> Ready : Food prepared
Ready --> OutForDelivery : Driver assigned/picked up
OutForDelivery --> Delivered : Driver delivered
Pending --> Cancelled : Customer/partner/admin cancels
Confirmed --> Cancelled : Customer/partner/admin cancels
Preparing --> Cancelled : Partner/admin cancels
OutForDelivery --> Cancelled : Admin cancels
Delivered --> Completed : Final status
```

Key behaviors:
- Status updates are propagated to both orders and meal_schedules for tracking consistency.
- Real-time subscriptions notify customers of status changes (confirmed, preparing, ready, out_for_delivery, delivered, cancelled).
- The unified order view aggregates both placed orders and scheduled meals, enabling a single pane of glass.

**Section sources**
- [delivery_tracking_page.tsx:64-76](file://src/pages/DeliveryTracking.tsx#L64-L76)
- [order_tracking_hub.tsx:121-132](file://src/components/OrderTrackingHub.tsx#L121-L132)

### Delivery Routing and Driver Assignment
The system employs a priority-based queue with geographic proximity to assign drivers efficiently.

```mermaid
flowchart TD
Start([New Order]) --> AddQueue["Add to delivery_queue<br/>with priority score"]
AddQueue --> FindDrivers["Find available drivers<br/>near restaurant"]
FindDrivers --> Score["Calculate priority:<br/>tip bonus, VIP bonus,<br/>waiting time, urgency"]
Score --> Assign["Assign driver with highest score"]
Assign --> UpdateOrder["Update orders and delivery_jobs"]
UpdateOrder --> Notify["Notify driver and customer"]
Notify --> End([Delivery in progress])
```

Priority scoring factors:
- Tip amount: higher tips increase priority (up to +20 points).
- VIP subscription tier: premium subscribers gain +15 points.
- Waiting time: older orders receive +1 point per 5 minutes (up to +15).
- Urgency: orders within 30 minutes of estimated delivery time gain +10 points.

**Diagram sources**
- [delivery_queue_migration.sql:526-575](file://supabase/migrations/20240101000003_add_delivery_queue.sql#L526-L575)

**Section sources**
- [delivery_queue_migration.sql:148-209](file://supabase/migrations/20240101000003_add_delivery_queue.sql#L148-L209)
- [delivery_queue_migration.sql:472-524](file://supabase/migrations/20240101000003_add_delivery_queue.sql#L472-L524)

### Real-Time Delivery Status Updates
Real-time updates are achieved through Supabase PostgreSQL Realtime, ensuring immediate visibility of status changes and driver movements.

```mermaid
sequenceDiagram
participant DB as "Supabase DB"
participant Sub as "Realtime Channel"
participant Hub as "OrderTrackingHub"
participant Page as "DeliveryTracking Page"
DB-->>Sub : Change event (meal_schedules)
Sub-->>Hub : Payload with new status
Hub->>Hub : Update active orders list
Sub-->>Page : Payload with new status
Page->>Page : Refresh orders and scheduled meals
Page-->>Page : Show updated status badges and actions
```

**Diagram sources**
- [order_tracking_hub.tsx:94-114](file://src/components/OrderTrackingHub.tsx#L94-L114)
- [delivery_tracking_page.tsx:258-275](file://src/pages/DeliveryTracking.tsx#L258-L275)

**Section sources**
- [order_tracking_hub.tsx:93-114](file://src/components/OrderTrackingHub.tsx#L93-L114)
- [delivery_tracking_page.tsx:258-275](file://src/pages/DeliveryTracking.tsx#L258-L275)

### Order Modification Workflows
Order modification eligibility is governed by status rules and scheduling constraints.

```mermaid
flowchart TD
Check([Check modification eligibility]) --> Status{"Order status<br/>not in non-modifiable list?"}
Status --> |No| Deny["Deny modification"]
Status --> |Yes| Future{"Scheduled date >= today?"}
Future --> |No| Deny
Future --> |Yes| Allow["Allow modification"]
```

Non-modifiable statuses include delivered, cancelled, in_transit, and preparing. Scheduled meals can be modified only if the scheduled date is today or in the future.

**Diagram sources**
- [order_modification_hook.ts:6-22](file://src/hooks/useOrderModification.ts#L6-L22)

**Section sources**
- [order_modification_hook.ts:1-23](file://src/hooks/useOrderModification.ts#L1-L23)

### Cancellation Procedures and Refund Processing
The system enforces role-based cancellation rules and automates refund processing with audit logging.

```mermaid
flowchart TD
Request([Cancellation Request]) --> Validate["Validate order exists<br/>and status allows cancellation"]
Validate --> Role{"Cancelled by role"}
Role --> |Customer| CustomerRules["Allowed only for pending/confirmed<br/>Apply 2 QAR fee if confirmed"]
Role --> |Partner| PartnerRules["Allowed for pending/confirmed/preparing<br/>No fee"]
Role --> |Admin| AdminRules["Allowed for any except delivered/completed<br/>No fee"]
CustomerRules --> Refund["Calculate refund: total - fee"]
PartnerRules --> Refund
AdminRules --> Refund
Refund --> Process["Credit wallet if applicable"]
Process --> Restore["Restore meal quota if applicable"]
Restore --> Log["Log cancellation in order_cancellations"]
Log --> Update["Update order_status_history"]
Update --> Complete([Cancellation complete])
```

Refund categories:
- Full: when no cancellation fee is applied.
- Partial: when a fee is deducted.
- None: when the order value is zero or negative after fee deduction.

**Diagram sources**
- [cancel_order_rpc.sql:64-267](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql#L64-L267)

**Section sources**
- [cancel_order_rpc.sql:112-142](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql#L112-L142)
- [cancel_order_rpc.sql:162-190](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql#L162-L190)
- [cancel_order_rpc.sql:224-239](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql#L224-L239)

### Delivery Fee Calculations and Tip Management
Delivery fee and tip management are integrated into the delivery queue and order records.

Fee and tip fields:
- delivery_fee: Base delivery fee stored in delivery_queue and orders.
- tip_amount: Optional tip amount associated with the order.

Priority scoring incorporates tip amounts to incentivize higher-paying orders.

**Section sources**
- [delivery_queue_migration.sql:47-48](file://supabase/migrations/20240101000003_add_delivery_queue.sql#L47-L48)
- [delivery_queue_migration.sql:551-554](file://supabase/migrations/20240101000003_add_delivery_queue.sql#L551-L554)

### Performance Metrics Tracking
The system tracks key performance indicators through database statistics and driver analytics.

Metrics:
- Delivery time: Average time from restaurant readiness to successful delivery.
- Success rate: Percentage of deliveries completed successfully.
- Customer satisfaction: Average ratings and feedback.
- Driver utilization: Percentage of drivers active during peak hours.
- Cost efficiency: Average delivery cost per order.

Statistics collection:
- Delivery statistics endpoint aggregates job statuses over configurable date ranges.
- Driver profiles include ratings and total deliveries for performance evaluation.

**Section sources**
- [delivery_api.ts:617-643](file://src/integrations/supabase/delivery.ts#L617-L643)
- [delivery_system_design.md:449-456](file://delivery_system_design.md#L449-L456)

## Dependency Analysis
The system exhibits clear separation of concerns with minimal coupling between components.

```mermaid
graph TB
DT["DeliveryTracking Page"] --> API["Delivery API"]
OTH["OrderTrackingHub"] --> API
CDT["CustomerDeliveryTracker"] --> API
API --> MQ["delivery_queue"]
API --> DJ["delivery_jobs"]
API --> D["drivers"]
API --> DL["driver_locations"]
DT --> O["orders"]
DT --> OI["order_items"]
DT --> OC["order_cancellations"]
DT --> MS["meal_schedules"]
```

**Diagram sources**
- [delivery_tracking_page.tsx:1-50](file://src/pages/DeliveryTracking.tsx#L1-L50)
- [order_tracking_hub.tsx:1-35](file://src/components/OrderTrackingHub.tsx#L1-L35)
- [delivery_api.ts:1-60](file://src/integrations/supabase/delivery.ts#L1-L60)

**Section sources**
- [delivery_tracking_page.tsx:1-50](file://src/pages/DeliveryTracking.tsx#L1-L50)
- [order_tracking_hub.tsx:1-35](file://src/components/OrderTrackingHub.tsx#L1-L35)
- [delivery_api.ts:1-60](file://src/integrations/supabase/delivery.ts#L1-L60)

## Performance Considerations
- Indexing: Strategic indexes on delivery_queue (status, priority, location) and driver_locations (driver_id, timestamp) improve query performance.
- Real-time updates: Supabase Realtime minimizes polling overhead and ensures timely UI updates.
- Driver proximity: Geographic indexing and distance calculations enable efficient driver matching.
- Transaction safety: Stored procedures enforce atomicity for critical operations like driver assignment and cancellations.

## Troubleshooting Guide
Common issues and resolutions:
- No drivers available: The system throws an error when no drivers meet availability criteria. Consider expanding driver coverage or relaxing constraints.
- Expired assignments: If a driver does not accept within the expiry window, the assignment resets to waiting for reassignment.
- Real-time updates not appearing: Verify Supabase Realtime subscriptions and network connectivity.
- Cancellation errors: Ensure the order status allows cancellation for the requesting role and that the order is not already delivered or completed.

**Section sources**
- [delivery_api.ts:199-201](file://src/integrations/supabase/delivery.ts#L199-L201)
- [delivery_api.ts:288-305](file://src/integrations/supabase/delivery.ts#L288-L305)
- [cancel_order_rpc.sql:108-110](file://supabase/migrations/20240101000002_add_cancel_order_rpc.sql#L108-L110)

## Conclusion
The order and delivery system provides a robust foundation for managing multi-restaurant orders, intelligent driver assignment, and real-time tracking. Its modular design, comprehensive audit trails, and performance-focused architecture support scalability and maintainability. The documented workflows for cancellation, refund processing, fee calculation, and metrics tracking ensure operational transparency and customer satisfaction.