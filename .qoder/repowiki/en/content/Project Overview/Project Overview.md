# Project Overview

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [src/App.tsx](file://src/App.tsx)
- [src/fleet/index.ts](file://src/fleet/index.ts)
- [src/fleet/routes.tsx](file://src/fleet/routes.tsx)
- [src/components/AdaptiveGoalCard.tsx](file://src/components/AdaptiveGoalCard.tsx)
- [src/hooks/useAdaptiveGoals.ts](file://src/hooks/useAdaptiveGoals.ts)
- [ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md](file://ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md)
- [src/pages/DeliveryTracking.tsx](file://src/pages/DeliveryTracking.tsx)
- [src/components/OrderTrackingHub.tsx](file://src/components/OrderTrackingHub.tsx)
- [docs/PRODUCT_STRATEGY.md](file://docs/PRODUCT_STRATEGY.md)
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
Nutrio (formerly NUTRIO) is a multi-role digital platform designed to deliver healthy meals while enabling precise nutrition tracking and intelligent progress management. The platform serves four primary stakeholder groups:
- Customers: Users seeking convenient, nutritious meals with personalized nutrition guidance
- Restaurant Partners: Food providers integrated into the marketplace with operational tools
- Delivery Drivers: Independent contractors managing real-time deliveries
- Administrators: Platform operators overseeing operations, analytics, and ecosystem governance

The platform’s core value proposition centers on three pillars:
- Automated nutrition recommendations powered by adaptive goals and AI/ML logic
- End-to-end meal delivery management with real-time tracking and fleet orchestration
- Intelligent progress tracking with predictive insights and user-centric recommendations

This overview synthesizes both conceptual stakeholder benefits and technical implementation details, using terminology consistent with the codebase such as adaptive goals, fleet management, and real-time tracking.

## Project Structure
The application is a modern React-based single-page application with a comprehensive routing system supporting multiple portals:
- Customer portal for browsing, ordering, nutrition tracking, and progress monitoring
- Restaurant partner portal for menu management, order handling, and analytics
- Driver portal for onboarding, route execution, and earnings management
- Administrator portal for operations oversight, reporting, and policy management
- Fleet Management Portal for centralized driver and vehicle oversight with live tracking and payout management

```mermaid
graph TB
subgraph "Customer Portal"
C_Dash["Dashboard"]
C_Meals["Meals & Restaurant Discovery"]
C_Schedule["Schedule & Planner"]
C_Tracker["Nutrition Tracker<br/>Progress & Goals"]
C_Deliveries["Order History & Tracking"]
end
subgraph "Restaurant Partner Portal"
P_Dash["Dashboard"]
P_Menu["Menu Management"]
P_Orders["Order Management"]
P_Analytics["Analytics & Insights"]
end
subgraph "Driver Portal"
D_Onboard["Onboarding"]
D_Dash["Daily Dashboard"]
D_Orders["Active Orders"]
D_History["Earnings & History"]
end
subgraph "Admin Portal"
A_Dash["Operations Dashboard"]
A_Restaurants["Restaurant Management"]
A_Users["User Management"]
A_Orders["Order Analytics"]
A_Settings["System Settings"]
end
subgraph "Fleet Management Portal"
F_Dash["Fleet Dashboard"]
F_Drivers["Driver Management"]
F_Vehicles["Vehicle Management"]
F_Live["Live Tracking"]
F_Payouts["Payout Management"]
end
C_Dash --> |"Real-time updates"| F_Live
P_Orders --> |"Fleet dispatch"| D_Orders
D_Orders --> |"Status updates"| C_Deliveries
A_Restaurants --> P_Dash
A_Orders --> C_Deliveries
```

**Diagram sources**
- [src/App.tsx:174-727](file://src/App.tsx#L174-L727)
- [src/fleet/routes.tsx:20-41](file://src/fleet/routes.tsx#L20-L41)

**Section sources**
- [src/App.tsx:174-727](file://src/App.tsx#L174-L727)
- [src/fleet/routes.tsx:20-41](file://src/fleet/routes.tsx#L20-L41)

## Core Components
This section highlights the platform’s foundational capabilities that enable its multi-stakeholder mission.

- Adaptive Goals System
  - Purpose: Automatically adjust daily nutrition targets based on user progress, adherence, and AI/ML analysis
  - Key Elements: Recommendation cards, settings panel, prediction charts, and backend edge functions
  - Impact: Personalized nutrition without manual recalibration, improved goal achievement, and reduced user churn

- Real-Time Delivery & Fleet Management
  - Purpose: Coordinate driver assignments, optimize routes, and provide transparent tracking for all stakeholders
  - Key Elements: Live tracking dashboards, driver management, vehicle oversight, and automated dispatch logic
  - Impact: Efficient operations, predictable delivery windows, and scalable fleet growth

- Nutrition Tracking & Progress Monitoring
  - Purpose: Enable users to log meals, monitor macronutrients, track weight trends, and visualize progress
  - Key Elements: Daily trackers, progress cards, goal adherence metrics, and predictive weight modeling
  - Impact: Data-driven behavior change, motivation through insights, and alignment with health objectives

Practical examples:
- Adaptive Goals: A user on a weight-loss journey receives a suggestion to reduce calories after detecting a plateau, with a confidence score and actionable tip
- Real-Time Tracking: A customer views an order moving from “preparing” to “out for delivery,” with driver details and estimated arrival
- Fleet Management: An administrator monitors driver utilization, assigns nearby drivers to pending orders, and processes payouts

**Section sources**
- [ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md:136-166](file://ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md#L136-L166)
- [src/components/AdaptiveGoalCard.tsx:1-218](file://src/components/AdaptiveGoalCard.tsx#L1-L218)
- [src/hooks/useAdaptiveGoals.ts:62-407](file://src/hooks/useAdaptiveGoals.ts#L62-L407)
- [src/pages/DeliveryTracking.tsx:113-592](file://src/pages/DeliveryTracking.tsx#L113-L592)
- [src/components/OrderTrackingHub.tsx:37-235](file://src/components/OrderTrackingHub.tsx#L37-L235)
- [src/fleet/index.ts:1-14](file://src/fleet/index.ts#L1-L14)

## Architecture Overview
The platform employs a modular, role-based routing architecture with shared components and a centralized Supabase backend. The frontend integrates real-time subscriptions for dynamic updates, while edge functions power AI-driven recommendations and batch processing.

```mermaid
graph TB
FE["React SPA<br/>Routing & UI"]
Auth["Auth Context"]
Queries["React Query<br/>Data Fetching"]
Supabase["Supabase Backend<br/>PostgreSQL + Edge Functions"]
subgraph "Portals"
Customer["Customer Portal"]
Partner["Partner Portal"]
Driver["Driver Portal"]
Admin["Admin Portal"]
Fleet["Fleet Management Portal"]
end
FE --> Auth
FE --> Queries
Queries --> Supabase
Supabase --> |"Real-time Postgres<br/>Webhooks"| FE
Supabase --> |"Edge Functions<br/>AI/ML & Batch"| FE
Customer --- Partner
Customer --- Driver
Customer --- Admin
Customer --- Fleet
```

**Diagram sources**
- [src/App.tsx:139-739](file://src/App.tsx#L139-L739)
- [src/hooks/useAdaptiveGoals.ts:137-178](file://src/hooks/useAdaptiveGoals.ts#L137-L178)

**Section sources**
- [src/App.tsx:139-739](file://src/App.tsx#L139-L739)
- [src/hooks/useAdaptiveGoals.ts:137-178](file://src/hooks/useAdaptiveGoals.ts#L137-L178)

## Detailed Component Analysis

### Adaptive Goals System
The adaptive goals system continuously analyzes user progress and suggests personalized nutrition adjustments. It combines historical data, adherence metrics, and predictive models to propose safe, effective changes.

```mermaid
sequenceDiagram
participant User as "Customer"
participant Hook as "useAdaptiveGoals"
participant Supabase as "Supabase"
participant Edge as "Edge Function<br/>adaptive-goals"
User->>Hook : Open Dashboard
Hook->>Supabase : Invoke "adaptive-goals" (dry_run=true)
Supabase->>Edge : Execute AI analysis
Edge-->>Supabase : Recommendation + Predictions
Supabase-->>Hook : Data payload
Hook-->>User : AdaptiveGoalCard + WeightPredictionChart
User->>Hook : Apply suggestion
Hook->>Supabase : Update profile + mark applied
Supabase-->>Hook : Success
Hook-->>User : Confirmation toast
```

**Diagram sources**
- [src/hooks/useAdaptiveGoals.ts:137-178](file://src/hooks/useAdaptiveGoals.ts#L137-L178)
- [src/hooks/useAdaptiveGoals.ts:246-286](file://src/hooks/useAdaptiveGoals.ts#L246-L286)
- [src/components/AdaptiveGoalCard.tsx:28-218](file://src/components/AdaptiveGoalCard.tsx#L28-L218)
- [ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md:136-166](file://ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md#L136-L166)

**Section sources**
- [src/hooks/useAdaptiveGoals.ts:62-407](file://src/hooks/useAdaptiveGoals.ts#L62-L407)
- [src/components/AdaptiveGoalCard.tsx:1-218](file://src/components/AdaptiveGoalCard.tsx#L1-L218)
- [ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md:1-309](file://ADAPTIVE_GOALS_IMPLEMENTATION_SUMMARY.md#L1-L309)

### Real-Time Delivery Tracking
The delivery tracking hub aggregates active orders, subscribes to real-time updates, and presents actionable controls for customers. It integrates with the fleet management system to reflect driver assignments and status changes.

```mermaid
sequenceDiagram
participant Customer as "Customer"
participant Hub as "OrderTrackingHub"
participant Supabase as "Supabase"
participant Driver as "Driver App"
participant Fleet as "Fleet Portal"
Customer->>Hub : Open Active Orders
Hub->>Supabase : Query active meal_schedules
Supabase-->>Hub : Orders with driver info
Supabase-->>Hub : Real-time postgres_changes
Hub-->>Customer : Live status updates
Driver->>Supabase : Update order_status
Supabase-->>Hub : Event broadcast
Hub-->>Customer : Toast + refreshed list
Fleet->>Supabase : Assign driver to order
Supabase-->>Hub : Driver details included
Hub-->>Customer : Driver name/phone visible
```

**Diagram sources**
- [src/components/OrderTrackingHub.tsx:37-235](file://src/components/OrderTrackingHub.tsx#L37-L235)
- [src/pages/DeliveryTracking.tsx:113-592](file://src/pages/DeliveryTracking.tsx#L113-L592)

**Section sources**
- [src/components/OrderTrackingHub.tsx:37-235](file://src/components/OrderTrackingHub.tsx#L37-L235)
- [src/pages/DeliveryTracking.tsx:113-592](file://src/pages/DeliveryTracking.tsx#L113-L592)

### Fleet Management Portal
The fleet management portal centralizes driver and vehicle oversight, enabling administrators to manage dispatch, monitor live locations, and process payouts.

```mermaid
flowchart TD
Start(["Fleet Login"]) --> Dash["Fleet Dashboard"]
Dash --> ManageDrivers["Driver Management"]
Dash --> ManageVehicles["Vehicle Management"]
Dash --> LiveTracking["Live Tracking"]
Dash --> Payouts["Payout Management"]
ManageDrivers --> Assign["Assign Drivers to Orders"]
ManageVehicles --> Optimize["Route Optimization"]
LiveTracking --> Monitor["Monitor Driver Locations"]
Payouts --> Process["Process Payouts"]
Assign --> End(["Dispatch Complete"])
Optimize --> End
Monitor --> End
Process --> End
```

**Diagram sources**
- [src/fleet/routes.tsx:20-41](file://src/fleet/routes.tsx#L20-L41)
- [src/fleet/index.ts:1-14](file://src/fleet/index.ts#L1-14)

**Section sources**
- [src/fleet/routes.tsx:20-41](file://src/fleet/routes.tsx#L20-L41)
- [src/fleet/index.ts:1-14](file://src/fleet/index.ts#L1-L14)

### Conceptual Overview
From a stakeholder perspective:
- Customers benefit from intelligent, personalized nutrition guidance and seamless order experiences with real-time visibility
- Restaurant Partners gain operational tools to manage menus, orders, and analytics, improving efficiency and customer satisfaction
- Delivery Drivers enjoy streamlined onboarding, clear order assignment, and transparent earnings management
- Administrators oversee platform operations, enforce policies, and drive growth through data-driven insights
- Fleet Management enables centralized oversight of drivers and vehicles, ensuring scalability and reliability

These capabilities align with the platform’s long-term strategy to evolve from a meal delivery marketplace into an AI-powered nutrition intelligence platform, integrating deeply with health ecosystems and expanding globally.

**Section sources**
- [docs/PRODUCT_STRATEGY.md:10-23](file://docs/PRODUCT_STRATEGY.md#L10-L23)
- [docs/PRODUCT_STRATEGY.md:137-166](file://docs/PRODUCT_STRATEGY.md#L137-L166)

## Dependency Analysis
The application relies on a cohesive set of dependencies and integrations:
- React ecosystem: React Router for routing, React Query for data fetching, Radix UI and ShadCN components for UI primitives
- Supabase integration: Authentication, real-time Postgres, and edge functions for AI/ML logic
- Mobile/native: Capacitor for cross-platform capabilities
- Observability and analytics: PostHog, Sentry, and notification services

```mermaid
graph TB
App["App.tsx"]
Router["React Router"]
Query["React Query"]
Supabase["Supabase Client"]
UI["Radix/ShadCN UI"]
Native["Capacitor"]
App --> Router
App --> Query
App --> Supabase
App --> UI
App --> Native
```

**Diagram sources**
- [src/App.tsx:1-14](file://src/App.tsx#L1-L14)
- [package.json:44-126](file://package.json#L44-L126)

**Section sources**
- [package.json:44-126](file://package.json#L44-L126)
- [src/App.tsx:1-14](file://src/App.tsx#L1-L14)

## Performance Considerations
- Real-time subscriptions: Use targeted queries and efficient polling to minimize bandwidth and battery usage on mobile devices
- Edge functions: Offload heavy computations (e.g., adaptive goals analysis) to edge functions to keep the client responsive
- Image optimization: Lazy-load meal images and thumbnails to improve initial render performance
- Pagination and virtualization: Implement infinite scrolling and virtualized lists for order histories and tracking feeds
- Caching: Cache frequently accessed data (e.g., restaurant and menu metadata) to reduce redundant network calls

## Troubleshooting Guide
Common issues and resolutions:
- Adaptive Goals not available
  - Symptom: Recommendation card does not appear or shows a message indicating AI analysis is not available
  - Cause: Edge function not deployed or CORS error
  - Resolution: Deploy the adaptive goals edge functions and ensure proper CORS configuration
  - Reference: [src/hooks/useAdaptiveGoals.ts:149-178](file://src/hooks/useAdaptiveGoals.ts#L149-L178)

- Real-time updates not reflecting
  - Symptom: Order status does not update without manual refresh
  - Cause: Real-time subscription not established or channel removed
  - Resolution: Verify real-time subscription setup and ensure channels are subscribed/unsubscribed correctly
  - Reference: [src/components/OrderTrackingHub.tsx:94-114](file://src/components/OrderTrackingHub.tsx#L94-L114), [src/pages/DeliveryTracking.tsx:258-275](file://src/pages/DeliveryTracking.tsx#L258-L275)

- Fleet tracking discrepancies
  - Symptom: Driver location or status mismatch
  - Cause: Delayed updates or stale data
  - Resolution: Confirm live tracking is enabled and refresh the fleet dashboard; verify driver app connectivity
  - Reference: [src/fleet/routes.tsx:20-41](file://src/fleet/routes.tsx#L20-L41)

**Section sources**
- [src/hooks/useAdaptiveGoals.ts:149-178](file://src/hooks/useAdaptiveGoals.ts#L149-L178)
- [src/components/OrderTrackingHub.tsx:94-114](file://src/components/OrderTrackingHub.tsx#L94-L114)
- [src/pages/DeliveryTracking.tsx:258-275](file://src/pages/DeliveryTracking.tsx#L258-L275)
- [src/fleet/routes.tsx:20-41](file://src/fleet/routes.tsx#L20-L41)

## Conclusion
Nutrio delivers a comprehensive, multi-stakeholder platform that blends healthy meal delivery with intelligent nutrition guidance and robust operational management. Through adaptive goals, real-time delivery tracking, and centralized fleet oversight, the platform creates a seamless ecosystem for customers, restaurant partners, drivers, and administrators. Its technical foundation—built on React, Supabase, and edge computing—enables scalable, data-driven personalization and operational excellence, aligning with a forward-looking strategy to become a leading AI-powered nutrition intelligence platform.