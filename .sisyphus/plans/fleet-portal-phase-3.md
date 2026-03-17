# Fleet Portal Phase 3: Tracking Enhancement

## TL;DR

> **Quick Summary**: Enhance the existing `/fleet/tracking` page with Mapbox integration, real-time GPS tracking, route history, geofencing, ETA calculations, and comprehensive UI improvements for fleet management operations.
> 
> **Deliverables**: 
> - Mapbox map provider integration
> - Real-time tracking with API polling system
> - Route history & replay functionality
> - Tracking logs with filtering
> - Driver-vehicle assignment interface
> - Order-vehicle tracking integration
> - Geofencing system with alerts
> - ETA calculation engine
> - Enhanced UI/UX for tracking page
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 8 → Task 12 → Task 20 → F1-F4

---

## Context

### Original Request
Enhance the existing Fleet Tracking page at `/fleet/tracking` with Phase 3 features including real-time tracking, route history, geofencing, ETA calculations, and UI improvements while switching to Mapbox.

### Interview Summary
**Key Discussions**:
- Current tracking page is functional but basic
- Need to switch to Mapbox from current map provider
- Real-time updates via API polling (5-10 seconds, not WebSocket)
- 8 specific enhancement areas identified
- Build on existing fleet portal architecture (5th portal)

**Technical Decisions**:
- Mapbox as map provider (better customization)
- API polling for real-time updates (5-10 second interval)
- Integration with existing Supabase Edge Functions
- Enhance existing TrackingContext
- Follow existing portal patterns (Partner, Admin, Driver)

### Metis Review
**Identified Gaps** (addressed):
- Database schema needed for route history storage
- Performance considerations for API polling frequency
- Mapbox API key management and billing considerations
- Geofencing alert delivery mechanism
- ETA calculation algorithm selection
- Mobile responsiveness for tracking UI

---

## Work Objectives

### Core Objective
Transform the existing basic fleet tracking page into a comprehensive fleet management tool with real-time visibility, historical analysis, and intelligent features for efficient logistics operations.

### Concrete Deliverables
- Mapbox map integration with custom styling
- Real-time vehicle location updates via API polling
- Route history storage and replay visualization
- Tracking logs with date/time filtering
- Visual driver-vehicle assignment interface
- Order status integration with vehicle tracking
- Geofencing system with breach alerts
- Dynamic ETA calculations based on location
- Enhanced UI with better controls, filters, and search

### Definition of Done
- All vehicles show real-time location on Mapbox map
- Route history can be viewed and replayed for any date range
- Driver-vehicle assignments can be made via drag-and-drop or selection
- Geofence alerts trigger when vehicles enter/exit designated areas
- ETA calculations display accurate arrival predictions
- UI provides intuitive controls for all tracking features
- All features work on desktop and mobile devices
- API polling does not cause performance degradation

### Must Have
- Mapbox map with vehicle markers
- Real-time location updates (5-10 second intervals)
- Route history database and visualization
- Driver-vehicle assignment functionality
- Order tracking integration
- Geofencing with alerts
- ETA calculations
- UI improvements with responsive design

### Must NOT Have (Guardrails)
- No changes to other portals (Customer, Partner, Admin, Driver)
- No mobile app changes (Capacitor integration)
- No driver-facing mobile features
- No WebSocket implementation (API polling only)
- No changes to core authentication system
- No modifications to existing fleet portal structure beyond tracking page

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest + React Testing Library)
- **Automated tests**: Tests-after (implementation first, then tests)
- **Framework**: Vitest
- **Agent-Executed QA**: Playwright for UI, Bash (curl) for API endpoints

### QA Policy
Every task includes agent-executed QA scenarios. The executing agent will:
- Use Playwright to verify frontend interactions and map rendering
- Use Bash with curl to test API endpoints
- Verify Mapbox integration and map load performance
- Test real-time updates and data synchronization
- Validate mobile responsiveness
- Check tracking history functionality
- Verify geofencing alert triggers

Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Backend & Config):
├── Task 1: Mapbox account setup & API key configuration
├── Task 2: Database schema for route history
├── Task 3: Database schema for geofencing
├── Task 4: Database schema for ETA calculations
└── Task 5: Mapbox React components & types

Wave 2 (Core Features - Backend Logic):
├── Task 6: Real-time tracking API endpoint (after 5)
├── Task 7: Route history API & storage (after 2)
├── Task 8: Geofencing engine & alert triggers (after 3)
├── Task 9: ETA calculation service (after 4)
└── Task 10: Tracking logs API with filtering (after 2)

Wave 3 (Frontend - Map & Tracking UI):
├── Task 11: Replace current map with Mapbox (after 1, 5)
├── Task 12: Real-time tracking UI with polling (after 6, 11)
├── Task 13: Route history visualization & replay (after 7, 11)
└── Task 14: Tracking logs UI with filters (after 10, 11)

Wave 4 (Frontend - Assignment & Integration):
├── Task 15: Driver-vehicle assignment interface (after 12)
├── Task 16: Order-vehicle tracking integration (after 12, 14)
├── Task 17: Geofencing UI & alert display (after 8, 12)
├── Task 18: ETA display & predictions (after 9, 12)
└── Task 19: UI/UX improvements & responsive design (after 12)

Wave 5 (Integration & Polish):
├── Task 20: API performance optimization (after 6-10)
├── Task 21: Error handling & loading states (after 11-19)
└── Task 22: Final integration testing (after 20, 21)

Wave FINAL (Verification - 4 parallel reviews):
├── Task F1: Plan compliance audit
├── Task F2: Code quality review
├── Task F3: End-to-end QA verification
└── Task F4: Scope fidelity check

Critical Path: Task 1 → Task 2 → Task 6 → Task 11 → Task 12 → Task 20 → Task 22 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 5 tasks (Waves 1-2)
```

### Dependency Matrix

- **Tasks 1-5**: No dependencies (foundation) → Block tasks 6-10, 11
- **Task 6**: Depends on Task 1, 5 → Blocks Task 12, 20
- **Task 7**: Depends on Task 2 → Blocks Task 13, 20
- **Task 8**: Depends on Task 3 → Blocks Task 17, 20
- **Task 9**: Depends on Task 4 → Blocks Task 18, 20
- **Task 10**: Depends on Task 2 → Blocks Task 14, 20
- **Task 11**: Depends on Task 1, 5 → Blocks Tasks 12-14, 21
- **Task 12**: Depends on Task 6, 11 → Blocks Tasks 15-19, 21
- **Task 13**: Depends on Task 7, 11 → Blocks Task 21
- **Task 14**: Depends on Task 10, 11 → Blocks Task 16, 21
- **Task 15**: Depends on Task 12 → Blocks Task 21
- **Task 16**: Depends on Task 12, 14 → Blocks Task 21, 22
- **Task 17**: Depends on Task 8, 12 → Blocks Task 21
- **Task 18**: Depends on Task 9, 12 → Blocks Task 21
- **Task 19**: Depends on Task 12 → Blocks Task 21
- **Task 20**: Depends on Tasks 6-10 → Blocks Task 22
- **Task 21**: Depends on Tasks 11-19 → Blocks Task 22

### Agent Dispatch Summary

- **Wave 1**: 5 tasks → `quick` (configuration and setup tasks)
- **Wave 2**: 5 tasks → `unspecified-high` (backend API logic)
- **Wave 3**: 4 tasks → `visual-engineering` (map UI implementation)
- **Wave 4**: 5 tasks → `deep` (complex feature integration)
- **Wave 5**: 3 tasks → `unspecified-high` (optimization and polish)
- **FINAL**: 4 parallel reviews → `oracle`, `unspecified-high`, `deep`

---

## TODOs

- [ ] 1. Mapbox Account Setup & API Key Configuration

  **What to do**:
  - Create Mapbox account at mapbox.com if not exists
  - Generate API access token with appropriate scopes
  - Add Mapbox environment variables to `.env.production.template` and `.env.local`
  - Variables: `VITE_MAPBOX_ACCESS_TOKEN`, `VITE_MAPBOX_STYLE_URL`
  - Document setup process in `docs/mapbox-setup.md`
  - Verify token works with test API call
  
  **Must NOT do**:
  - Do not commit actual API keys to git
  - Do not use Mapbox in production without proper billing setup
  
  **Recommended Agent Profile**:
  - **Category**: `quick` - Simple configuration task
  - **Skills**: None needed
  
  **Parallelization**:
  - **Can Run In Parallel**: NO (blocks other tasks)
  - **Parallel Group**: Wave 1 (sequential with Tasks 2-5)
  - **Blocks**: Tasks 6, 11-14, 21
  - **Blocked By**: None
  
  **References**:
  - `.env.production.template` - Follow existing env var pattern
  - `docs/setup.md` - Existing setup documentation format
  - Mapbox API docs: `https://docs.mapbox.com/api/overview/`
  
  **Acceptance Criteria**:
  - [ ] `.env.production.template` updated with Mapbox vars (no values)
  - [ ] `.env.local` created with working Mapbox token
  - [ ] `docs/mapbox-setup.md` created with step-by-step instructions
  - [ ] Test API call to Mapbox returns successful response
  
  **QA Scenarios**:
  ```
  Scenario: Mapbox API token validation
    Tool: Bash (curl)
    Preconditions: Mapbox token in .env.local
    Steps:
      1. Run: curl "https://api.mapbox.com/geocoding/v5/mapbox.places/Qatar.json?access_token=$VITE_MAPBOX_ACCESS_TOKEN"
      2. Check response status is 200
    Expected Result: Response contains features array for Qatar location
    Evidence: .sisyphus/evidence/task-1-mapbox-validation.json
  ```
  
  **Commit**: YES
  - Message: `docs: add Mapbox setup documentation`
  - Files: `.env.production.template`, `docs/mapbox-setup.md`

- [ ] 2. Database Schema for Route History

  **What to do**:
  - Create migration for `fleet_route_history` table
  - Columns: id, vehicle_id, driver_id, route_geometry (GeoJSON), start_time, end_time, distance_km, duration_minutes, status
  - Add indexes on vehicle_id, driver_id, start_time
  - Create RLS policies for fleet access
  - Apply migration: `npx supabase db push`
  
  **Must NOT do**:
  - Do not modify existing fleet tables
  - Do not add columns to existing tables (create new table)
  
  **Recommended Agent Profile**:
  - **Category**: `quick` - Database schema definition
  - **Skills**: None needed (SQL migration)
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3-5)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7, 10, 20
  - **Blocked By**: None
  
  **References**:
  - `supabase/migrations/20240228000000_fleet_management.sql` - Existing fleet schema pattern
  - `supabase/migrations/20260228_fleet_management_system.sql` - Latest fleet schema
  - `src/integrations/supabase/types.ts` - Generated types reference
  
  **Acceptance Criteria**:
  - [ ] Migration file created at `supabase/migrations/{timestamp}_route_history.sql`
  - [ ] Table created with all required columns
  - [ ] Indexes created on vehicle_id, driver_id, start_time
  - [ ] RLS policies enabled and correct
  - [ ] `npx supabase db push` succeeds
  - [ ] `npx supabase gen types typescript` regenerates types
  
  **QA Scenarios**:
  ```
  Scenario: Database schema migration success
    Tool: Bash
    Steps:
      1. Run: npx supabase db push
      2. Run: npx supabase gen types typescript
      3. Check types.ts for fleet_route_history types
    Expected Result: Types generated, no errors, table exists in DB
    Evidence: .sisyphus/evidence/task-2-schema-success.txt
  
  Scenario: RLS policies verification
    Tool: Bash (supabase)
    Steps:
      1. Query: supabase query "SELECT * FROM fleet_route_history" with fleet role
      2. Attempt query with anonymous role (should fail)
    Expected Result: Fleet role can access, anonymous cannot
    Evidence: .sisyphus/evidence/task-2-rls-verification.json
  ```
  
  **Commit**: YES
  - Message: `feat(fleet): add route history database schema`
  - Files: `supabase/migrations/*_route_history.sql`, `src/integrations/supabase/types.ts`
  - Pre-commit: `npx supabase typecheck`

- [ ] 3. Database Schema for Geofencing

  **What to do**:
  - Create migration for `fleet_geofences` table
  - Columns: id, name, geometry (GeoJSON polygon), type, alert_on_enter, alert_on_exit, created_by
  - Create `fleet_geofence_events` table for tracking breaches
  - Add RLS policies
  - Apply migration
  
  **Must NOT do**:
  - Do not use simple circles (must support complex polygons)
  - Do not skip event logging table
  
  **Recommended Agent Profile**:
  - **Category**: `quick` - Database schema definition
  - **Skills**: None needed
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 2, 4, 5)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 8, 17, 20
  - **Blocked By**: None
  
  **References**:
  - `supabase/migrations/20240228000000_fleet_management.sql` - For RLS pattern
  - GeoJSON specification for polygon geometry
  - PostGIS documentation for spatial queries
  
  **Acceptance Criteria**:
  - [ ] `fleet_geofences` table created with polygon geometry support
  - [ ] `fleet_geofence_events` table created for logging breaches
  - [ ] RLS policies configured correctly
  - [ ] Migration applies successfully
  - [ ] Types regenerated
  
  **QA Scenarios**:
  ```
  Scenario: Geofence table creation test
    Tool: Bash (psql or supabase)
    Steps:
      1. Insert test geofence polygon
      2. Verify geometry stored correctly
      3. Query geofences containing a point
    Expected Result: Spatial queries work correctly
    Evidence: .sisyphus/evidence/task-3-geofence-spatial-test.json
  ```
  
  **Commit**: YES (group with Task 2)
  - Message: `feat(fleet): add geofencing database schema`

- [ ] 4. Database Schema for ETA Calculations

  **What to do**:
  - Create migration for `fleet_eta_predictions` table
  - Columns: id, vehicle_id, destination, current_location, eta_timestamp, distance_remaining, traffic_factor, status
  - Add indexes on vehicle_id, eta_timestamp
  - Create RLS policies
  - Apply migration
  
  **Must NOT do**:
  - Do not store calculated ETAs in route history table (separate table for performance)
  - Do not skip current_location tracking
  
  **Recommended Agent Profile**:
  - **Category**: `quick` - Database schema definition
  - **Skills**: None needed
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 2-3, 5)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9, 18, 20
  - **Blocked By**: None
  
  **References**:
  - `src/lib/nutrition-calculator.ts` - Example calculation service pattern
  - Existing fleet schema patterns
  
  **Acceptance Criteria**:
  - [ ] `fleet_eta_predictions` table created with all columns
  - [ ] Indexes created for performance
  - [ ] RLS policies enabled
  - [ ] Migration and types generation successful
  
  **QA Scenarios**:
  ```
  Scenario: ETA table schema validation
    Tool: Bash
    Steps:
      1. Apply migration
      2. Insert test ETA record
      3. Verify all columns accept data
    Expected Result: Schema works correctly for ETA tracking
    Evidence: .sisyphus/evidence/task-4-eta-schema-test.json
  ```
  
  **Commit**: YES (group with Tasks 2-3)
  - Message: `feat(fleet): add ETA tracking database schema`

- [ ] 5. Mapbox React Components & Types

  **What to do**:
  - Install @mapbox/mapbox-gl-react library
  - Create reusable Mapbox wrapper component at `src/fleet/components/MapboxMap.tsx`
  - Add TypeScript types for Mapbox integration
  - Create map style constants file
  - Handle map initialization and error boundaries
  
  **Must NOT do**:
  - Do not replace existing map yet (Task 11 will do that)
  - Do not hardcode API token in component (use env var)
  
  **Recommended Agent Profile**:
  - **Category**: `quick` - Component scaffolding and type definitions
  - **Skills**: `senior-frontend` - For proper React component patterns
  
  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 2-4)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 11-14, 21
  - **Blocked By**: None
  
  **References**:
  - `src/fleet/components/common/MapView.tsx` - Current map component (to understand API)
  - `src/lib/sentry.ts` - Error handling pattern
  - Mapbox React GL documentation
  
  **Acceptance Criteria**:
  - [ ] Package `@mapbox/mapbox-gl-react` installed
  - [ ] `MapboxMap.tsx` component created with proper types
  - [ ] Component accepts props: center, zoom, markers, onLoad, onError
  - [ ] Error boundary implemented
  - [ ] Map style constants defined
  - [ ] Types file created/completed
  
  **QA Scenarios**:
  ```
  Scenario: Mapbox component renders without crashing
    Tool: Playwright
    Steps:
      1. Create test page using MapboxMap component
      2. Load page with valid token
      3. Verify map container element exists
      4. Check for console errors
    Expected Result: Map renders, no errors in console
    Evidence: .sisyphus/evidence/task-5-mapbox-component.png
  
  Scenario: Mapbox component handles errors gracefully
    Tool: Playwright
    Steps:
      1. Use invalid API token
      2. Verify error boundary catches and displays user-friendly message
    Expected Result: Error message shown, no app crash
    Evidence: .sisyphus/evidence/task-5-error-boundary.png
  ```
  
  **Commit**: YES
  - Message: `feat(fleet): add Mapbox React components and types`
  - Files: `src/fleet/components/MapboxMap.tsx`, `src/fleet/types/mapbox.ts`, `package.json`
  - Pre-commit: `npm run typecheck`

---

## Final Verification Wave

</form>
