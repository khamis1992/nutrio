# Driver Management

<cite>
**Referenced Files in This Document**
- [fleet-management-portal-design.md](file://docs/fleet-management-portal-design.md)
- [20260228_fleet_management_system.sql](file://supabase/migrations/20260228_fleet_management_system.sql)
- [fleet.ts](file://src/fleet/types/fleet.ts)
- [DriverList.tsx](file://src/fleet/components/drivers/DriverList.tsx)
- [DriverFilters.tsx](file://src/fleet/components/drivers/DriverFilters.tsx)
- [DriverCard.tsx](file://src/fleet/components/drivers/DriverCard.tsx)
- [useDrivers.ts](file://src/fleet/hooks/useDrivers.ts)
- [DriverManagement.tsx](file://src/fleet/pages/DriverManagement.tsx)
- [FleetDashboard.tsx](file://src/fleet/pages/FleetDashboard.tsx)
- [DashboardStats.tsx](file://src/fleet/components/dashboard/DashboardStats.tsx)
- [FleetLayout.tsx](file://src/fleet/components/layout/FleetLayout.tsx)
- [routes.tsx](file://src/fleet/routes.tsx)
- [DriverOnboarding.tsx](file://src/pages/driver/DriverOnboarding.tsx)
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
This document describes the fleet driver management system, focusing on driver onboarding, background verification, fleet assignment workflows, and operational dashboards. It explains driver profile management, license validation, vehicle assignment, performance tracking, the driver listing interface with filtering and bulk operations, status monitoring, availability management, compliance tracking, and integration with live tracking and analytics.

## Project Structure
The driver management system spans frontend React components, routing, typed APIs, and backend Supabase tables and functions. The design document defines the database schema and API specification, while the frontend implements the driver listing, filtering, and dashboard views.

```mermaid
graph TB
subgraph "Frontend"
Routes["routes.tsx"]
Layout["FleetLayout.tsx"]
Dashboard["FleetDashboard.tsx"]
DriverListPage["DriverManagement.tsx"]
DriverListComp["DriverList.tsx"]
DriverCard["DriverCard.tsx"]
DriverFilters["DriverFilters.tsx"]
DashboardStats["DashboardStats.tsx"]
end
subgraph "Types"
Types["fleet.ts"]
end
subgraph "Hooks"
UseDrivers["useDrivers.ts"]
end
subgraph "Backend"
Schema["20260228_fleet_management_system.sql"]
Design["fleet-management-portal-design.md"]
end
Routes --> Layout
Layout --> Dashboard
Layout --> DriverListPage
DriverListPage --> DriverListComp
DriverListComp --> DriverCard
DriverListComp --> DriverFilters
Dashboard --> DashboardStats
DriverListPage --> UseDrivers
DriverListComp --> UseDrivers
Dashboard --> UseDrivers
UseDrivers --> Types
DriverListPage --> Types
Dashboard --> Types
Schema --> UseDrivers
Design --> Schema
```

**Diagram sources**
- [routes.tsx:20-41](file://src/fleet/routes.tsx#L20-L41)
- [FleetLayout.tsx:16-62](file://src/fleet/components/layout/FleetLayout.tsx#L16-L62)
- [FleetDashboard.tsx:21-294](file://src/fleet/pages/FleetDashboard.tsx#L21-L294)
- [DriverManagement.tsx:20-203](file://src/fleet/pages/DriverManagement.tsx#L20-L203)
- [DriverList.tsx:13-133](file://src/fleet/components/drivers/DriverList.tsx#L13-L133)
- [DriverCard.tsx:28-140](file://src/fleet/components/drivers/DriverCard.tsx#L28-L140)
- [DriverFilters.tsx:26-97](file://src/fleet/components/drivers/DriverFilters.tsx#L26-L97)
- [DashboardStats.tsx:18-111](file://src/fleet/components/dashboard/DashboardStats.tsx#L18-L111)
- [useDrivers.ts:16-104](file://src/fleet/hooks/useDrivers.ts#L16-L104)
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)
- [20260228_fleet_management_system.sql:233-270](file://supabase/migrations/20260228_fleet_management_system.sql#L233-L270)
- [fleet-management-portal-design.md:615-1265](file://docs/fleet-management-portal-design.md#L615-L1265)

**Section sources**
- [routes.tsx:20-41](file://src/fleet/routes.tsx#L20-L41)
- [FleetLayout.tsx:16-62](file://src/fleet/components/layout/FleetLayout.tsx#L16-L62)
- [FleetDashboard.tsx:21-294](file://src/fleet/pages/FleetDashboard.tsx#L21-L294)
- [DriverManagement.tsx:20-203](file://src/fleet/pages/DriverManagement.tsx#L20-L203)
- [DriverList.tsx:13-133](file://src/fleet/components/drivers/DriverList.tsx#L13-L133)
- [DriverCard.tsx:28-140](file://src/fleet/components/drivers/DriverCard.tsx#L28-L140)
- [DriverFilters.tsx:26-97](file://src/fleet/components/drivers/DriverFilters.tsx#L26-L97)
- [DashboardStats.tsx:18-111](file://src/fleet/components/dashboard/DashboardStats.tsx#L18-L111)
- [useDrivers.ts:16-104](file://src/fleet/hooks/useDrivers.ts#L16-L104)
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)
- [20260228_fleet_management_system.sql:233-270](file://supabase/migrations/20260228_fleet_management_system.sql#L233-L270)
- [fleet-management-portal-design.md:615-1265](file://docs/fleet-management-portal-design.md#L615-L1265)

## Core Components
- Driver listing and filtering: The driver list page integrates search, status filter, and online-only toggle, merging REST data with real-time tracking signals.
- Driver card: Presents contact info, ratings, delivery counts, current balance, and quick actions (track, view details).
- Driver filters: Provides popover-based status selection and an online-only toggle.
- Hooks: Centralized data fetching and transformations for drivers, stats, and payouts.
- Types: Strongly typed entities for drivers, vehicles, documents, payouts, and WebSocket events.
- Dashboard: Aggregates fleet statistics and presents driver status charts and recent activity.
- Backend schema: Defines drivers, vehicles, driver documents, driver locations, payouts, and activity logs.

**Section sources**
- [DriverList.tsx:13-133](file://src/fleet/components/drivers/DriverList.tsx#L13-L133)
- [DriverCard.tsx:28-140](file://src/fleet/components/drivers/DriverCard.tsx#L28-L140)
- [DriverFilters.tsx:26-97](file://src/fleet/components/drivers/DriverFilters.tsx#L26-L97)
- [useDrivers.ts:16-104](file://src/fleet/hooks/useDrivers.ts#L16-L104)
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)
- [FleetDashboard.tsx:21-294](file://src/fleet/pages/FleetDashboard.tsx#L21-L294)
- [20260228_fleet_management_system.sql:233-270](file://supabase/migrations/20260228_fleet_management_system.sql#L233-L270)

## Architecture Overview
The system follows a layered architecture:
- Frontend: React components and hooks integrate with Supabase for data retrieval and updates.
- Types: Shared TypeScript interfaces define entities and API contracts.
- Backend: Supabase tables and functions implement driver lifecycle, verification, and payouts.
- Real-time: WebSocket events update driver locations and statuses.

```mermaid
sequenceDiagram
participant User as "Fleet Manager"
participant UI as "DriverList.tsx"
participant Hook as "useDrivers.ts"
participant Supabase as "Supabase"
participant Types as "fleet.ts"
User->>UI : Open Drivers page
UI->>Hook : useDrivers({filters})
Hook->>Supabase : Query drivers with filters
Supabase-->>Hook : Drivers data + count
Hook->>Types : Transform to Driver[]
Hook-->>UI : drivers, pagination
UI-->>User : Render Driver cards with online status
```

**Diagram sources**
- [DriverList.tsx:21-47](file://src/fleet/components/drivers/DriverList.tsx#L21-L47)
- [useDrivers.ts:24-92](file://src/fleet/hooks/useDrivers.ts#L24-L92)
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)

**Section sources**
- [DriverList.tsx:13-133](file://src/fleet/components/drivers/DriverList.tsx#L13-L133)
- [useDrivers.ts:16-104](file://src/fleet/hooks/useDrivers.ts#L16-L104)
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)

## Detailed Component Analysis

### Driver Listing Interface and Filtering
- Search: Text-based search across phone and license identifiers.
- Status filter: Enumerated statuses including pending verification, active, suspended, inactive.
- Online-only toggle: Restricts results to drivers currently online.
- Pagination: Controlled via page and limit parameters.
- Real-time merge: Live tracking data augments driver records for accurate online status and location.

```mermaid
flowchart TD
Start(["Render DriverList"]) --> BuildFilters["Build filters from URL/state"]
BuildFilters --> Fetch["useDrivers() fetchDrivers()"]
Fetch --> Query["Supabase query with range/order"]
Query --> Transform["Transform to Driver[]"]
Transform --> Merge["Merge with tracking data"]
Merge --> ApplyToggle{"Show online only?"}
ApplyToggle --> |Yes| FilterOnline["Filter isOnline=true"]
ApplyToggle --> |No| KeepAll["Keep all drivers"]
FilterOnline --> Render["Render Driver cards"]
KeepAll --> Render
Render --> End(["Done"])
```

**Diagram sources**
- [DriverList.tsx:21-47](file://src/fleet/components/drivers/DriverList.tsx#L21-L47)
- [useDrivers.ts:24-92](file://src/fleet/hooks/useDrivers.ts#L24-L92)

**Section sources**
- [DriverList.tsx:13-133](file://src/fleet/components/drivers/DriverList.tsx#L13-L133)
- [DriverFilters.tsx:26-97](file://src/fleet/components/drivers/DriverFilters.tsx#L26-L97)
- [useDrivers.ts:16-104](file://src/fleet/hooks/useDrivers.ts#L16-L104)

### Driver Profile Management and License Validation
- Driver profiles include contact info, status, ratings, delivery metrics, balances, and assigned vehicle.
- License validation is part of the driver onboarding flow and document verification pipeline.
- Documents table supports multiple document types (ID card, driving license, vehicle registration, insurance, background check, contract) with verification status tracking.

```mermaid
classDiagram
class Driver {
+string id
+string email
+string phone
+string fullName
+string cityId
+string[] assignedZoneIds
+string status
+boolean isOnline
+number totalDeliveries
+number rating
+number cancellationRate
+number currentBalance
+number totalEarnings
+string assignedVehicleId
+string profilePhotoUrl
+string idDocumentUrl
+string licenseDocumentUrl
+string createdAt
+string updatedAt
}
class DriverDocument {
+string id
+string driverId
+string documentType
+string documentUrl
+string verificationStatus
+string rejectionReason
+string expiryDate
+string verifiedBy
+string verifiedAt
+string uploadedAt
+string createdAt
+string updatedAt
}
Driver "1" --> "*" DriverDocument : "has documents"
```

**Diagram sources**
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)
- [fleet.ts:224-237](file://src/fleet/types/fleet.ts#L224-L237)
- [20260228_fleet_management_system.sql:345-363](file://supabase/migrations/20260228_fleet_management_system.sql#L345-L363)

**Section sources**
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)
- [20260228_fleet_management_system.sql:123-136](file://supabase/migrations/20260228_fleet_management_system.sql#L123-L136)
- [20260228_fleet_management_system.sql:345-363](file://supabase/migrations/20260228_fleet_management_system.sql#L345-L363)

### Vehicle Assignment and Availability Management
- Vehicles have type, make, model, year, color, plate number, insurance provider, and status (available, assigned, maintenance, retired).
- Assigned driver relationship enables fleet managers to assign vehicles to drivers.
- Insurance expiry tracking helps manage compliance and availability.

```mermaid
classDiagram
class Vehicle {
+string id
+string cityId
+string type
+string make
+string model
+number year
+string color
+string plateNumber
+string registrationNumber
+string insuranceProvider
+string insuranceExpiry
+string insuranceDocumentUrl
+string status
+string assignedDriverId
+string vehiclePhotoUrl
+string registrationDocumentUrl
+string createdAt
+string updatedAt
}
class Driver {
+string id
+string assignedVehicleId
}
Driver "1" --> "0..1" Vehicle : "assigned"
```

**Diagram sources**
- [fleet.ts:186-218](file://src/fleet/types/fleet.ts#L186-L218)
- [20260228_fleet_management_system.sql:304-334](file://supabase/migrations/20260228_fleet_management_system.sql#L304-L334)

**Section sources**
- [fleet.ts:186-218](file://src/fleet/types/fleet.ts#L186-L218)
- [20260228_fleet_management_system.sql:304-334](file://supabase/migrations/20260228_fleet_management_system.sql#L304-L334)

### Performance Tracking and Compliance Tracking
- Driver performance metrics include total deliveries, completed deliveries, cancelled deliveries, average rating, average delivery time, on-time rate, and earnings.
- Compliance tracking includes document verification status and expiry dates.
- Activity logs capture driver and fleet manager actions for auditability.

```mermaid
classDiagram
class DriverPerformance {
+number totalDeliveries
+number completedDeliveries
+number cancelledDeliveries
+number averageRating
+number averageDeliveryTime
+number onTimeRate
+number earnings
}
class DriverActivityLog {
+string id
+string driverId
+string activityType
+object details
+string ipAddress
+string userAgent
+string createdAt
}
class DriverDocument {
+string id
+string driverId
+string documentType
+string verificationStatus
+string expiryDate
+string verifiedAt
}
Driver "1" --> "*" DriverActivityLog : "logs"
Driver "1" --> "*" DriverDocument : "has docs"
```

**Diagram sources**
- [fleet.ts:172-180](file://src/fleet/types/fleet.ts#L172-L180)
- [fleet.ts:162-170](file://src/fleet/types/fleet.ts#L162-L170)
- [fleet.ts:224-237](file://src/fleet/types/fleet.ts#L224-L237)
- [20260228_fleet_management_system.sql:434-446](file://supabase/migrations/20260228_fleet_management_system.sql#L434-L446)
- [20260228_fleet_management_system.sql:123-136](file://supabase/migrations/20260228_fleet_management_system.sql#L123-L136)

**Section sources**
- [fleet.ts:172-180](file://src/fleet/types/fleet.ts#L172-L180)
- [fleet.ts:162-170](file://src/fleet/types/fleet.ts#L162-L170)
- [20260228_fleet_management_system.sql:434-446](file://supabase/migrations/20260228_fleet_management_system.sql#L434-L446)
- [20260228_fleet_management_system.sql:123-136](file://supabase/migrations/20260228_fleet_management_system.sql#L123-L136)

### Driver Onboarding Procedures
- The driver onboarding page collects vehicle type, make, model, plate number, and license number.
- License requirements vary by vehicle type; certain types require a license.
- After submission, the driver awaits fleet approval.

```mermaid
sequenceDiagram
participant Driver as "Driver"
participant Onboarding as "DriverOnboarding.tsx"
participant Supabase as "Supabase"
participant Fleet as "Fleet Manager"
Driver->>Onboarding : Load onboarding form
Onboarding->>Supabase : Read driver record
Driver->>Onboarding : Submit form (vehicle/license)
Onboarding->>Supabase : Update driver record
Note over Driver,Fleet : Driver waits for approval
```

**Diagram sources**
- [DriverOnboarding.tsx:34-119](file://src/pages/driver/DriverOnboarding.tsx#L34-L119)

**Section sources**
- [DriverOnboarding.tsx:34-119](file://src/pages/driver/DriverOnboarding.tsx#L34-L119)

### Background Verification Processes
- The document verification pipeline tracks verification status and expiry dates for ID, driving license, vehicle registration, insurance, background checks, and contracts.
- Verification status transitions include pending, approved, rejected, expired.
- Expiry date triggers alerts and impacts availability.

```mermaid
flowchart TD
Upload["Upload Document"] --> Pending["Verification: Pending"]
Pending --> Approved["Verification: Approved"]
Pending --> Rejected["Verification: Rejected"]
Approved --> Expired["Expiry Date Reached"]
Expired --> Pending
```

**Diagram sources**
- [20260228_fleet_management_system.sql:123-136](file://supabase/migrations/20260228_fleet_management_system.sql#L123-L136)
- [20260228_fleet_management_system.sql:345-363](file://supabase/migrations/20260228_fleet_management_system.sql#L345-L363)

**Section sources**
- [20260228_fleet_management_system.sql:123-136](file://supabase/migrations/20260228_fleet_management_system.sql#L123-L136)
- [20260228_fleet_management_system.sql:345-363](file://supabase/migrations/20260228_fleet_management_system.sql#L345-L363)

### Fleet Assignment Workflows
- Fleet managers can assign vehicles to drivers and update driver status.
- Driver status influences visibility and eligibility for assignments.
- Real-time tracking updates enable live monitoring of driver locations.

```mermaid
sequenceDiagram
participant Fleet as "Fleet Manager"
participant UI as "DriverManagement.tsx"
participant Hook as "useDrivers.ts"
participant Supabase as "Supabase"
Fleet->>UI : Select driver and action
UI->>Hook : Update driver status/vehicle
Hook->>Supabase : Upsert driver
Supabase-->>Hook : Updated driver
Hook-->>UI : Refresh list
UI-->>Fleet : Updated driver card
```

**Diagram sources**
- [DriverManagement.tsx:20-203](file://src/fleet/pages/DriverManagement.tsx#L20-L203)
- [useDrivers.ts:184-241](file://src/fleet/hooks/useDrivers.ts#L184-L241)

**Section sources**
- [DriverManagement.tsx:20-203](file://src/fleet/pages/DriverManagement.tsx#L20-L203)
- [useDrivers.ts:184-241](file://src/fleet/hooks/useDrivers.ts#L184-L241)

### Driver Status Monitoring and Availability Management
- Dashboard displays total drivers, active drivers, online drivers, orders in progress, today’s deliveries, and average delivery time.
- Driver cards indicate online/offline status and provide quick links to track drivers.

```mermaid
graph LR
Stats["DashboardStats.tsx"] --> Totals["Total/Active/Online Drivers"]
Stats --> Orders["Orders In Progress"]
Stats --> Deliveries["Today's Deliveries"]
DriverCard["DriverCard.tsx"] --> Online["Online Indicator"]
DriverCard --> Track["Track Link"]
```

**Diagram sources**
- [DashboardStats.tsx:18-111](file://src/fleet/components/dashboard/DashboardStats.tsx#L18-L111)
- [FleetDashboard.tsx:21-294](file://src/fleet/pages/FleetDashboard.tsx#L21-L294)
- [DriverCard.tsx:28-140](file://src/fleet/components/drivers/DriverCard.tsx#L28-L140)

**Section sources**
- [DashboardStats.tsx:18-111](file://src/fleet/components/dashboard/DashboardStats.tsx#L18-L111)
- [FleetDashboard.tsx:21-294](file://src/fleet/pages/FleetDashboard.tsx#L21-L294)
- [DriverCard.tsx:28-140](file://src/fleet/components/drivers/DriverCard.tsx#L28-L140)

### Communication Features, Shift Scheduling Integration, and Performance Analytics
- Communication: Driver cards expose contact info; fleet managers can initiate actions from driver details.
- Shift scheduling: Not explicitly implemented in the reviewed files; fleet assignment and status controls are available.
- Performance analytics: Dashboard aggregates KPIs; driver performance metrics are defined in types.

[No sources needed since this section synthesizes capabilities without analyzing specific files]

## Dependency Analysis
The frontend components depend on shared types and hooks, which in turn depend on Supabase for data persistence. The backend schema defines the data model and constraints.

```mermaid
graph TB
Types["fleet.ts"]
UseDrivers["useDrivers.ts"]
DriverList["DriverList.tsx"]
DriverCard["DriverCard.tsx"]
DriverFilters["DriverFilters.tsx"]
DriverManagement["DriverManagement.tsx"]
FleetDashboard["FleetDashboard.tsx"]
DashboardStats["DashboardStats.tsx"]
Schema["20260228_fleet_management_system.sql"]
DriverList --> UseDrivers
DriverCard --> Types
DriverFilters --> Types
DriverManagement --> UseDrivers
DriverManagement --> Types
FleetDashboard --> DashboardStats
DashboardStats --> Types
UseDrivers --> Types
UseDrivers --> Schema
```

**Diagram sources**
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)
- [useDrivers.ts:16-104](file://src/fleet/hooks/useDrivers.ts#L16-L104)
- [DriverList.tsx:13-133](file://src/fleet/components/drivers/DriverList.tsx#L13-L133)
- [DriverCard.tsx:28-140](file://src/fleet/components/drivers/DriverCard.tsx#L28-L140)
- [DriverFilters.tsx:26-97](file://src/fleet/components/drivers/DriverFilters.tsx#L26-L97)
- [DriverManagement.tsx:20-203](file://src/fleet/pages/DriverManagement.tsx#L20-L203)
- [FleetDashboard.tsx:21-294](file://src/fleet/pages/FleetDashboard.tsx#L21-L294)
- [DashboardStats.tsx:18-111](file://src/fleet/components/dashboard/DashboardStats.tsx#L18-L111)
- [20260228_fleet_management_system.sql:233-270](file://supabase/migrations/20260228_fleet_management_system.sql#L233-L270)

**Section sources**
- [fleet.ts:95-133](file://src/fleet/types/fleet.ts#L95-L133)
- [useDrivers.ts:16-104](file://src/fleet/hooks/useDrivers.ts#L16-L104)
- [DriverList.tsx:13-133](file://src/fleet/components/drivers/DriverList.tsx#L13-L133)
- [DriverCard.tsx:28-140](file://src/fleet/components/drivers/DriverCard.tsx#L28-L140)
- [DriverFilters.tsx:26-97](file://src/fleet/components/drivers/DriverFilters.tsx#L26-L97)
- [DriverManagement.tsx:20-203](file://src/fleet/pages/DriverManagement.tsx#L20-L203)
- [FleetDashboard.tsx:21-294](file://src/fleet/pages/FleetDashboard.tsx#L21-L294)
- [DashboardStats.tsx:18-111](file://src/fleet/components/dashboard/DashboardStats.tsx#L18-L111)
- [20260228_fleet_management_system.sql:233-270](file://supabase/migrations/20260228_fleet_management_system.sql#L233-L270)

## Performance Considerations
- Database indexing: Status, online status, and location indexes improve query performance for filtering and geospatial queries.
- Pagination: REST endpoints support pagination to avoid large payloads.
- Real-time updates: WebSocket events keep driver locations and statuses current without polling.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Driver list empty: Verify filters (status, online-only, search) and pagination limits.
- Loading states: Use skeleton loaders while data is being fetched.
- Toast notifications: Errors during data fetch trigger user-facing messages.

**Section sources**
- [DriverList.tsx:84-98](file://src/fleet/components/drivers/DriverList.tsx#L84-L98)
- [useDrivers.ts:82-91](file://src/fleet/hooks/useDrivers.ts#L82-L91)

## Conclusion
The fleet driver management system provides a comprehensive solution for driver onboarding, verification, assignment, and monitoring. The frontend offers robust filtering and real-time visibility, while the backend schema and API specification support scalability and compliance. The design document and database schema define clear contracts for drivers, vehicles, documents, payouts, and activity logs, enabling efficient fleet operations and analytics.