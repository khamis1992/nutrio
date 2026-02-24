# Full Integration Plan: Retention System + Body Progress Dashboard

## Executive Summary

This document provides a detailed integration plan showing exactly where each feature will be implemented in the existing Nutrio Fuel codebase. Each feature is mapped to specific files, routes, components, and integration points.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Customer Portal    │  Admin Portal    │  Partner Portal   │
│  (/dashboard/*)     │  (/admin/*)      │  (/partner/*)     │
│  (/meals/*)         │                  │                   │
│  (/subscription/*)  │                  │                   │
├─────────────────────────────────────────────────────────────┤
│                     BACKEND LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  Edge Functions     │  Database Functions   │  Cron Jobs    │
│  (supabase/functions/) │  (PostgreSQL)      │  (pg_cron)    │
├─────────────────────────────────────────────────────────────┤
│                     DATA LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  New Tables:                                                │
│  - subscription_rollovers                                   │
│  - subscription_freezes                                     │
│  - user_body_metrics                                        │
│  - user_health_scores                                       │
│  - retention_audit_logs                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION 1: CUSTOMER PORTAL INTEGRATION

### 1.1 Body Progress Dashboard

#### New Route
```typescript
// src/App.tsx - Add new route
<Route path="/progress" element={<BodyProgressDashboard />} />
```

#### New Page Component
**File**: `src/pages/dashboard/BodyProgressDashboard.tsx`
```typescript
// Full page component with:
// - Weight trend chart (Recharts)
// - Waist measurement chart
// - Body fat trend chart
// - Monthly comparison cards
// - Health compliance score display
// - Add metrics button
```

#### Integration with Existing Navigation
**File**: `src/components/Navigation.tsx` or existing nav component
```typescript
// Add to customer navigation:
{
  label: 'Body Progress',
  path: '/progress',
  icon: TrendingUpIcon,
  badge: healthScore // Show current score
}
```

#### Recharts Implementation
**Uses existing library**: `recharts` already in package.json
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
```

### 1.2 Weekly Metrics Form

#### Component Location
**File**: `src/components/body-metrics/WeeklyMetricsForm.tsx` (NEW)
```typescript
// Props interface
interface WeeklyMetricsFormProps {
  userId: string;
  onSuccess?: () => void;
  initialData?: BodyMetrics;
}

// Form fields:
// - Weight (kg) - required
// - Waist (cm) - optional
// - Body Fat % - optional
// - Muscle Mass % - optional
// - Notes - optional
```

#### Integration Point
**File**: `src/pages/dashboard/BodyProgressDashboard.tsx`
```typescript
// Modal trigger
<Dialog>
  <DialogTrigger asChild>
    <Button>Log Weekly Metrics</Button>
  </DialogTrigger>
  <DialogContent>
    <WeeklyMetricsForm 
      userId={user.id} 
      onSuccess={refetchData}
    />
  </DialogContent>
</Dialog>
```

#### API Hook
**File**: `src/hooks/useBodyMetrics.ts` (NEW)
```typescript
export function useBodyMetrics(userId: string) {
  return useQuery({
    queryKey: ['body-metrics', userId],
    queryFn: () => fetchBodyMetrics(userId)
  });
}

export function useLogBodyMetrics() {
  return useMutation({
    mutationFn: (data: BodyMetricsInput) => logBodyMetrics(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['body-metrics']);
      toast.success('Metrics logged successfully');
    }
  });
}
```

### 1.3 Health Compliance Score Display

#### Component Location
**File**: `src/components/health-score/ComplianceScoreCard.tsx` (NEW)
```typescript
// Displays:
// - Overall score (0-100)
// - Color indicator (green/orange/red)
// - Score breakdown (macro, consistency, logging, protein)
// - Trend indicator (up/down)
// - Encouraging message based on score
```

#### Integration Points

**1. Dashboard Page** (`src/pages/dashboard/Index.tsx`)
```typescript
// Add to dashboard grid
<ComplianceScoreCard 
  score={subscription?.last_health_score}
  category={subscription?.health_score_category}
/>
```

**2. Subscription Page** (`src/pages/subscription/SubscriptionManage.tsx`)
```typescript
// Show in subscription details
<Card>
  <CardHeader>Health Score</CardHeader>
  <CardContent>
    <ComplianceScoreCard score={healthScore} />
  </CardContent>
</Card>
```

**3. Weekly Planner** (`src/pages/planner/AIWeeklyPlanner.tsx`)
```typescript
// Show current compliance score
<ComplianceScoreBadge score={healthScore} />
```

### 1.4 Subscription Freeze Controls

#### Component Location
**File**: `src/components/subscription/FreezeSubscriptionModal.tsx` (NEW)
```typescript
// Props
interface FreezeModalProps {
  subscription: Subscription;
  freezeDaysUsed: number;
  onSuccess?: () => void;
}

// Features:
// - Date picker for start/end dates
// - Display remaining freeze days (7 - used)
// - Validation messages
// - Confirmation dialog
// - Success toast
```

#### Integration Points

**1. Subscription Management Page**
**File**: `src/pages/subscription/SubscriptionManage.tsx`
```typescript
// Add freeze button
<Card>
  <CardHeader>
    <CardTitle>Subscription Freeze</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex justify-between items-center">
      <div>
        <p>Freeze Days Used: {subscription.freeze_days_used}/7</p>
        <p>Remaining: {7 - subscription.freeze_days_used} days</p>
      </div>
      <FreezeSubscriptionModal 
        subscription={subscription}
        freezeDaysUsed={subscription.freeze_days_used}
      />
    </div>
  </CardContent>
</Card>
```

**2. Dashboard Quick Actions**
**File**: `src/pages/dashboard/Index.tsx`
```typescript
// Add to quick actions section
<QuickActionCard
  title="Freeze Subscription"
  description="Pause your subscription for up to 7 days"
  icon={PauseIcon}
  onClick={() => openFreezeModal()}
/>
```

#### API Hook
**File**: `src/hooks/useSubscriptionFreeze.ts` (NEW)
```typescript
export function useRequestFreeze() {
  return useMutation({
    mutationFn: (data: FreezeRequest) => 
      supabase.functions.invoke('handle-freeze-request', { body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries(['subscription']);
      toast.success('Freeze scheduled successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
}
```

### 1.5 Rollover Credits Display

#### Component Location
**File**: `src/components/subscription/RolloverCreditsDisplay.tsx` (NEW)
```typescript
interface RolloverDisplayProps {
  rolloverCredits: number;
  expiryDate: Date;
  totalCredits: number;
}

// Visual indicator showing:
// - Rollover credits count
// - Days until expiry
// - Percentage of total credits
// - Progress bar
```

#### Integration Points

**1. Dashboard Credit Meter**
**File**: `src/pages/dashboard/Index.tsx`
```typescript
// Update existing credit display
<CreditMeter 
  totalCredits={subscription.credits_remaining}
  rolloverCredits={subscription.rollover_credits}
  rolloverExpiry={subscription.rollover_expiry_date}
  usedCredits={subscription.credits_used}
/>
```

**2. Subscription Page**
**File**: `src/pages/subscription/SubscriptionManage.tsx`
```typescript
<RolloverCreditsDisplay
  rolloverCredits={subscription.rollover_credits}
  expiryDate={subscription.rollover_expiry_date}
  totalCredits={subscription.credits_remaining}
/>
```

**3. Checkout/Order Flow**
**File**: `src/pages/orders/OrderCheckout.tsx`
```typescript
// Show rollover consumption priority
<CreditBreakdown
  rolloverCredits={subscription.rollover_credits}
  newCredits={subscription.credits_remaining - subscription.rollover_credits}
  orderTotal={order.total}
/>
```

---

## SECTION 2: ADMIN PORTAL INTEGRATION

### 2.1 Freeze Management Panel

#### New Route
```typescript
// src/App.tsx - Add admin route
<Route path="/admin/subscriptions/freezes" element={<FreezeManagementPanel />} />
```

#### New Page Component
**File**: `src/pages/admin/subscriptions/FreezeManagementPanel.tsx` (NEW)
```typescript
// Admin features:
// - List all scheduled/active freezes
// - Filter by status, date, user
// - Cancel freeze action
// - View freeze history
// - Export to CSV
// - Bulk operations
```

#### Integration with Admin Navigation
**File**: `src/components/AdminSidebar.tsx`
```typescript
// Add to admin navigation
{
  section: 'Subscription Management',
  items: [
    { label: 'All Subscriptions', path: '/admin/subscriptions' },
    { label: 'Freeze Management', path: '/admin/subscriptions/freezes', badge: 'New' },
    { label: 'Rollover Audit Logs', path: '/admin/subscriptions/rollovers' }
  ]
}
```

#### Data Table Component
**File**: `src/components/admin/FreezesDataTable.tsx` (NEW)
```typescript
// Uses existing TanStack Table pattern
// Columns:
// - User info
// - Subscription ID
// - Freeze dates
// - Status
// - Days used
// - Actions (cancel)
```

### 2.2 Rollover Audit Log Viewer

#### New Route
```typescript
<Route path="/admin/audit/rollovers" element={<RolloverAuditLogViewer />} />
```

#### New Page Component
**File**: `src/pages/admin/audit/RolloverAuditLogViewer.tsx` (NEW)
```typescript
// Features:
// - Filter by action type
// - Filter by date range
// - Filter by user
// - Advanced search
// - Export to CSV/Excel
// - Detail view modal
```

#### Integration Points

**1. Admin Audit Section**
**File**: `src/pages/admin/AdminAudit.tsx`
```typescript
// Add new tab or section
<Tabs>
  <TabsList>
    <TabsTrigger value="general">General Audit</TabsTrigger>
    <TabsTrigger value="rollovers">Rollover & Freeze</TabsTrigger>
  </TabsList>
  <TabsContent value="rollovers">
    <RolloverAuditLogViewer />
  </TabsContent>
</Tabs>
```

#### API Hook
**File**: `src/hooks/useRetentionAuditLogs.ts` (NEW)
```typescript
export function useRetentionAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: ['retention-audit', filters],
    queryFn: () => fetchRetentionAuditLogs(filters)
  });
}
```

### 2.3 Retention Analytics Dashboard

#### New Route
```typescript
<Route path="/admin/analytics/retention" element={<RetentionAnalyticsDashboard />} />
```

#### New Page Component
**File**: `src/pages/admin/analytics/RetentionAnalyticsDashboard.tsx` (NEW)
```typescript
// Analytics components:
// - Rollover utilization rate chart
// - Freeze utilization rate chart
// - Health score distribution
// - Retention correlation analysis
// - Churn prevention effectiveness
// - Export reports
```

#### Integration with Analytics
**File**: `src/pages/admin/AdminAnalytics.tsx`
```typescript
// Add retention analytics card
<AnalyticsCard
  title="Retention Metrics"
  description="Rollover, freeze, and health score analytics"
  href="/admin/analytics/retention"
  icon={TrendingUpIcon}
/>
```

### 2.4 Health Score Overview

#### Component Location
**File**: `src/pages/admin/analytics/HealthScoreOverview.tsx` (NEW)
```typescript
// Aggregated metrics (anonymized):
// - Average health score by plan
// - Score distribution histogram
// - Trending users (improving/declining)
// - Correlation with retention
// - Export capabilities
```

#### Integration Points

**1. User Management**
**File**: `src/pages/admin/AdminUsers.tsx`
```typescript
// Add health score column to users table
<DataTable columns={[
  ...existingColumns,
  { 
    accessorKey: 'health_score', 
    header: 'Health Score',
    cell: ({ row }) => <HealthScoreBadge score={row.original.last_health_score} />
  }
]} />
```

**2. User Detail Page**
**File**: `src/pages/admin/AdminUserDetail.tsx`
```typescript
// Add health metrics section
<Card>
  <CardHeader>Health & Progress</CardHeader>
  <CardContent>
    <HealthMetricsHistory userId={user.id} />
    <ComplianceScoreHistory userId={user.id} />
  </CardContent>
</Card>
```

---

## SECTION 3: PARTNER PORTAL INTEGRATION

### 3.1 Freeze Status in Orders

#### Component Update
**File**: `src/pages/partner/PartnerOrders.tsx` (UPDATE)
```typescript
// Add freeze status indicator to order cards
<OrderCard>
  <OrderHeader>
    <OrderId>{order.id}</OrderId>
    {order.customer_subscription_frozen && (
      <Badge variant="warning">
        <PauseIcon className="w-3 h-3 mr-1" />
        Account Frozen
      </Badge>
    )}
  </OrderHeader>
  {/* ... rest of order card */}
</OrderCard>
```

#### Data Layer Update
**File**: `src/hooks/usePartnerOrders.ts` (UPDATE)
```typescript
// Update query to include subscription status
const { data: orders } = useQuery({
  queryKey: ['partner-orders', restaurantId],
  queryFn: () => supabase
    .from('orders')
    .select(`
      *,
      subscriptions!inner(
        status,
        freeze_days_used,
        subscription_freezes(status)
      )
    `)
});
```

### 3.2 Customer Subscription Status Display

#### Component Location
**File**: `src/components/partner/CustomerSubscriptionBadge.tsx` (NEW)
```typescript
interface CustomerSubscriptionBadgeProps {
  subscription: {
    status: string;
    freeze_days_used: number;
    active_freeze?: {
      start_date: Date;
      end_date: Date;
    };
  };
}

// Shows:
// - Active/Inactive status
// - Freeze indicator with dates
// - Credits remaining (if relevant)
```

#### Integration Points

**1. Order Detail View**
**File**: `src/pages/partner/OrderDetail.tsx` (UPDATE)
```typescript
// Show customer subscription info
<Card>
  <CardHeader>Customer Subscription</CardHeader>
  <CardContent>
    <CustomerSubscriptionBadge subscription={order.subscription} />
    {order.subscription.active_freeze && (
      <Alert>
        <AlertDescription>
          Customer account is frozen until {formatDate(order.subscription.active_freeze.end_date)}
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

### 3.3 Freeze Notifications

#### Component Location
**File**: `src/components/partner/FreezeNotificationCenter.tsx` (NEW)
```typescript
// Shows notifications for:
// - Upcoming freezes affecting orders
// - Freeze cancellations
// - Freeze completions
// - New orders from frozen accounts (if any)
```

#### Integration Points

**1. Partner Dashboard**
**File**: `src/pages/partner/PartnerDashboard.tsx` (UPDATE)
```typescript
// Add notification center
<PartnerDashboardLayout>
  <FreezeNotificationCenter restaurantId={restaurant.id} />
  {/* ... existing dashboard content */}
</PartnerDashboardLayout>
```

**2. Real-time Updates**
**File**: `src/hooks/useFreezeNotifications.ts` (NEW)
```typescript
export function useFreezeNotifications(restaurantId: string) {
  return useQuery({
    queryKey: ['freeze-notifications', restaurantId],
    queryFn: () => fetchFreezeNotifications(restaurantId)
  });
}
```

---

## SECTION 4: DRIVER PORTAL INTEGRATION

### 4.1 Freeze Status on Delivery Orders

#### Component Update
**File**: `src/pages/driver/DriverOrders.tsx` or `src/components/driver/DeliveryCard.tsx` (UPDATE)
```typescript
// Minimal change - show freeze status if relevant
<DeliveryCard>
  <DeliveryHeader>
    <OrderId>{order.id}</OrderId>
    {order.customer_subscription_frozen && (
      <Tooltip content="Customer account is frozen">
        <Badge variant="secondary">
          <PauseIcon className="w-3 h-3" />
        </Badge>
      </Tooltip>
    )}
  </DeliveryHeader>
</DeliveryCard>
```

**Note**: Driver portal changes are minimal since freeze status doesn't affect delivery workflow, only provides context.

---

## SECTION 5: EDGE FUNCTIONS INTEGRATION

### 5.1 Edge Functions Location

All Edge Functions created in: `supabase/functions/`

```
supabase/functions/
├── process-subscription-renewal/     # NEW
│   └── index.ts
├── handle-freeze-request/            # NEW
│   └── index.ts
├── calculate-health-score/           # NEW
│   └── index.ts
├── cleanup-expired-rollovers/        # NEW
│   └── index.ts
├── nutrition-profile-engine/         # EXISTING
├── smart-meal-allocator/             # EXISTING
├── dynamic-adjustment-engine/        # EXISTING
├── behavior-prediction-engine/       # EXISTING
└── restaurant-intelligence-engine/   # EXISTING
```

### 5.2 Function Details

#### 1. process-subscription-renewal
**Purpose**: Handle subscription renewal with rollover calculation
**Called by**: 
- Cron job (daily at midnight)
- Manual admin trigger
**Integrates with**: 
- `subscriptions` table
- `subscription_rollovers` table
- `calculate_rollover_credits()` function

#### 2. handle-freeze-request
**Purpose**: Process subscription freeze requests
**Called by**:
- Customer portal (freeze modal)
- Admin portal (admin override)
**Integrates with**:
- `request_subscription_freeze()` function
- `subscription_freezes` table
- Real-time notifications

#### 3. calculate-health-score
**Purpose**: Calculate weekly health compliance score
**Called by**:
- Cron job (weekly on Sundays)
- Manual trigger after body metrics logging
**Integrates with**:
- `calculate_health_compliance_score()` function
- `user_health_scores` table
- `user_body_metrics` table
- `weekly_meal_plans` table

#### 4. cleanup-expired-rollovers
**Purpose**: Handle expired rollover credits
**Called by**:
- Cron job (daily)
**Integrates with**:
- `subscription_rollovers` table
- `subscriptions` table
- Audit logging

### 5.3 Cron Jobs Configuration

**File**: Database migration or Supabase dashboard
```sql
-- Daily at midnight: Process renewals and cleanup
SELECT cron.schedule('process-renewals', '0 0 * * *', 
  'SELECT process_subscription_renewals()'
);

-- Daily: Cleanup expired rollovers
SELECT cron.schedule('cleanup-rollovers', '0 2 * * *',
  'SELECT cleanup_expired_rollovers()'
);

-- Weekly (Sunday at 3 AM): Calculate health scores
SELECT cron.schedule('calculate-health-scores', '0 3 * * 0',
  'SELECT calculate_all_health_scores()'
);

-- Daily: Check and activate scheduled freezes
SELECT cron.schedule('activate-freezes', '0 6 * * *',
  'SELECT activate_scheduled_freezes()'
);
```

---

## SECTION 6: HOOKS & SERVICES INTEGRATION

### 6.1 New Hooks to Create

**Location**: `src/hooks/`

```typescript
// useBodyMetrics.ts
export function useBodyMetrics(userId: string)
export function useLogBodyMetrics()
export function useBodyMetricsHistory(userId: string, weeks: number)

// useHealthScore.ts
export function useHealthScore(userId: string)
export function useHealthScoreHistory(userId: string)
export function useHealthScoreBreakdown(userId: string)

// useSubscriptionFreeze.ts
export function useSubscriptionFreezes(subscriptionId: string)
export function useRequestFreeze()
export function useCancelFreeze()
export function useFreezeDaysRemaining(subscriptionId: string)

// useRolloverCredits.ts
export function useRolloverCredits(userId: string)
export function useRolloverHistory(userId: string)

// useRetentionAudit.ts (Admin only)
export function useRetentionAuditLogs(filters: AuditFilters)
export function useRolloverAuditStats()

// useRetentionAnalytics.ts (Admin only)
export function useRetentionMetrics(period: DateRange)
export function useHealthScoreDistribution()
export function useFreezeUtilizationRate()
```

### 6.2 Services to Create/Update

**Location**: `src/services/`

```typescript
// bodyMetricsService.ts (NEW)
export async function fetchBodyMetrics(userId: string): Promise<BodyMetrics[]>
export async function logBodyMetrics(data: BodyMetricsInput): Promise<void>
export async function updateBodyMetrics(id: string, data: Partial<BodyMetricsInput>): Promise<void>

// subscriptionFreezeService.ts (NEW)
export async function requestFreeze(data: FreezeRequest): Promise<FreezeResult>
export async function cancelFreeze(freezeId: string): Promise<void>
export async function getActiveFreezes(subscriptionId: string): Promise<SubscriptionFreeze[]>

// rolloverService.ts (NEW)
export async function getRolloverCredits(userId: string): Promise<RolloverInfo>
export async function getRolloverHistory(userId: string): Promise<RolloverRecord[]>

// retentionAuditService.ts (NEW - Admin only)
export async function fetchRetentionAuditLogs(filters: AuditFilters): Promise<AuditLog[]>
export async function exportAuditLogs(filters: AuditFilters): Promise<Blob>

// retentionAnalyticsService.ts (NEW - Admin only)
export async function fetchRetentionMetrics(period: DateRange): Promise<RetentionMetrics>
export async function fetchHealthScoreDistribution(): Promise<DistributionData>
```

---

## SECTION 7: TYPES & INTERFACES

### 7.1 Type Definitions

**Location**: `src/types/` or `src/integrations/supabase/types.ts`

```typescript
// body-metrics.ts
export interface BodyMetrics {
  id: string;
  user_id: string;
  recorded_at: Date;
  weight_kg: number;
  waist_cm?: number;
  body_fat_percent?: number;
  muscle_mass_percent?: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface BodyMetricsInput {
  weight_kg: number;
  waist_cm?: number;
  body_fat_percent?: number;
  muscle_mass_percent?: number;
  notes?: string;
  recorded_at?: Date;
}

// subscription-freeze.ts
export interface SubscriptionFreeze {
  id: string;
  user_id: string;
  subscription_id: string;
  freeze_start_date: Date;
  freeze_end_date: Date;
  freeze_days: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  requested_at: Date;
  activated_at?: Date;
  completed_at?: Date;
}

export interface FreezeRequest {
  subscription_id: string;
  freeze_start_date: Date;
  freeze_end_date: Date;
}

// rollover-credits.ts
export interface RolloverInfo {
  rollover_credits: number;
  expiry_date: Date;
  total_credits: number;
}

export interface RolloverRecord {
  id: string;
  rollover_credits: number;
  source_cycle_start: Date;
  source_cycle_end: Date;
  expiry_date: Date;
  is_consumed: boolean;
  consumed_at?: Date;
}

// health-score.ts
export interface HealthScore {
  id: string;
  user_id: string;
  calculated_at: Date;
  score_week_start: Date;
  macro_adherence_score: number;
  meal_consistency_score: number;
  weight_logging_score: number;
  protein_accuracy_score: number;
  overall_score: number;
  category: 'green' | 'orange' | 'red';
  metrics_used: Record<string, any>;
}

export interface HealthScoreBreakdown {
  overall_score: number;
  category: 'green' | 'orange' | 'red';
  macro_adherence: number;
  meal_consistency: number;
  weight_logging: number;
  protein_accuracy: number;
}

// retention-audit.ts
export interface RetentionAuditLog {
  id: string;
  user_id: string;
  action_type: string;
  subscription_id?: string;
  action_details: Record<string, any>;
  previous_state?: Record<string, any>;
  new_state?: Record<string, any>;
  triggered_by: 'user' | 'system' | 'admin';
  triggered_by_user_id?: string;
  ip_address?: string;
  created_at: Date;
}
```

---

## SECTION 8: DATABASE INTEGRATION SUMMARY

### 8.1 Tables Overview

| Table | Purpose | Primary Users | RLS Policy |
|-------|---------|---------------|------------|
| `subscription_rollovers` | Track rollover credits with expiry | Customer, Admin | User sees own, Admin sees all |
| `subscription_freezes` | Track freeze periods | Customer, Admin, Partner | User manages own, Admin manages all |
| `user_body_metrics` | Weekly body measurements | Customer, Admin | User manages own |
| `user_health_scores` | Calculated compliance scores | Customer, Admin | User views own, Admin views all |
| `retention_audit_logs` | Audit trail | Admin only | Admin full access, User read own |

### 8.2 Functions Overview

| Function | Purpose | Called By |
|----------|---------|-----------|
| `calculate_rollover_credits()` | Calculate 20% rollover on renewal | Edge Function, Cron |
| `request_subscription_freeze()` | Validate and create freeze | Edge Function |
| `consume_meal_credit_v2()` | Deduct credits (rollover first) | Order processing |
| `calculate_health_compliance_score()` | Calculate weekly score | Edge Function, Cron |

---

## SECTION 9: ROUTING & NAVIGATION SUMMARY

### 9.1 New Routes

```typescript
// Customer Portal
/dashboard/progress           // Body Progress Dashboard
/subscription/freeze          // Freeze management (or modal)

// Admin Portal
/admin/subscriptions/freezes  // Freeze management panel
/admin/audit/rollovers        // Rollover audit logs
/admin/analytics/retention    // Retention analytics

// Partner Portal (existing routes, updated components)
/partner/orders               // Updated with freeze indicators
/partner/dashboard            // Updated with freeze notifications
```

### 9.2 Navigation Updates

```typescript
// Customer Nav Addition
{
  label: 'Body Progress',
  path: '/dashboard/progress',
  icon: TrendingUpIcon,
  badge: (user) => user.last_health_score
}

// Admin Nav Addition
{
  section: 'Subscription Management',
  items: [
    { label: 'All Subscriptions', path: '/admin/subscriptions' },
    { label: 'Freeze Management', path: '/admin/subscriptions/freezes' },
    { label: 'Rollover Audit', path: '/admin/audit/rollovers' }
  ]
}

// Admin Analytics Addition
{
  label: 'Retention Analytics',
  path: '/admin/analytics/retention',
  icon: BarChartIcon
}
```

---

## SECTION 10: COMPONENT HIERARCHY

### 10.1 Customer Portal Components

```
BodyProgressDashboard (Page)
├── PageHeader
├── ComplianceScoreCard
│   ├── ScoreDisplay
│   ├── ScoreBreakdown
│   └── TrendIndicator
├── ProgressCharts
│   ├── WeightTrendChart (Recharts)
│   ├── WaistChart (Recharts)
│   └── BodyFatChart (Recharts)
├── MonthlyComparison
│   ├── ComparisonCard (x3)
│   └── ChangeIndicator
└── AddMetricsButton
    └── WeeklyMetricsForm (Modal)
        ├── WeightInput (required)
        ├── WaistInput (optional)
        ├── BodyFatInput (optional)
        ├── MuscleMassInput (optional)
        └── NotesInput (optional)

SubscriptionManage (Page Update)
├── Existing Sections...
├── RolloverCreditsDisplay (NEW)
│   ├── CreditsBreakdown
│   ├── ExpiryCountdown
│   └── ConsumptionPriority
└── FreezeManagementCard (NEW)
    ├── FreezeStatus
    ├── DaysRemaining
    └── FreezeSubscriptionModal
        ├── DateRangePicker
        ├── ValidationMessages
        └── ConfirmationDialog
```

### 10.2 Admin Portal Components

```
FreezeManagementPanel (Page)
├── PageHeader
├── Filters
│   ├── StatusFilter
│   ├── DateRangeFilter
│   └── UserSearch
├── FreezesDataTable
│   ├── UserColumn
│   ├── DatesColumn
│   ├── StatusColumn
│   └── ActionsColumn
└── ExportButton

RolloverAuditLogViewer (Page)
├── PageHeader
├── AdvancedFilters
│   ├── ActionTypeFilter
│   ├── DateRangeFilter
│   ├── UserFilter
│   └── SubscriptionFilter
├── AuditLogsTable
│   ├── TimestampColumn
│   ├── ActionColumn
│   ├── UserColumn
│   └── DetailsColumn
├── DetailModal
└── ExportControls

RetentionAnalyticsDashboard (Page)
├── PageHeader
├── KPIRow
│   ├── RolloverUtilizationCard
│   ├── FreezeUtilizationCard
│   ├── AvgHealthScoreCard
│   └── RetentionRateCard
├── ChartsSection
│   ├── RolloverTrendChart
│   ├── FreezeTrendChart
│   └── HealthScoreDistribution
└── DataTable
    └── CorrelationAnalysisTable
```

### 10.3 Partner Portal Components

```
PartnerOrders (Page Update)
├── Filters (existing)
├── OrdersList
│   └── OrderCard (Updated)
│       ├── OrderHeader (NEW: FreezeBadge)
│       ├── OrderDetails
│       └── Actions
└── Pagination

PartnerDashboard (Page Update)
├── StatsCards (existing)
├── FreezeNotificationCenter (NEW)
│   ├── NotificationList
│   └── NotificationItem
└── RecentOrders (existing)
```

---

## SECTION 11: TESTING INTEGRATION POINTS

### 11.1 Test Files to Create

**Location**: `src/` (following existing test patterns)

```typescript
// useBodyMetrics.test.ts
// Tests for fetching, logging, and updating body metrics

// useSubscriptionFreeze.test.ts
// Tests for freeze request validation, cancellation

// useRolloverCredits.test.ts
// Tests for rollover calculation and consumption priority

// useHealthScore.test.ts
// Tests for score calculation and breakdown

// FreezeSubscriptionModal.test.tsx
// Component tests for date validation, submission

// WeeklyMetricsForm.test.tsx
// Component tests for form validation, submission

// ComplianceScoreCard.test.tsx
// Component tests for score display, color coding
```

### 11.2 Integration Tests

```typescript
// Database function tests
// - calculate_rollover_credits() edge cases
// - request_subscription_freeze() validation
// - consume_meal_credit_v2() priority logic
// - calculate_health_compliance_score() formula

// Edge function tests
// - process-subscription-renewal
// - handle-freeze-request
// - calculate-health-score
// - cleanup-expired-rollovers

// E2E tests
// - Complete freeze workflow
// - Complete body metrics logging
// - Rollover consumption flow
// - Health score calculation flow
```

---

## SECTION 12: IMPLEMENTATION ORDER

### Recommended Implementation Sequence

**Week 1: Database & Core Backend**
1. ✅ Create migration file (DONE)
2. Apply migration to database
3. Test database functions
4. Create 4 Edge Functions
5. Set up cron jobs

**Week 2: Customer Portal - Body Progress**
1. Create `useBodyMetrics` hook
2. Create `WeeklyMetricsForm` component
3. Create `BodyProgressDashboard` page
4. Add route and navigation
5. Test end-to-end flow

**Week 3: Customer Portal - Retention**
1. Create `useSubscriptionFreeze` hook
2. Create `FreezeSubscriptionModal` component
3. Update `SubscriptionManage` page
4. Create `RolloverCreditsDisplay` component
5. Create `ComplianceScoreCard` component
6. Test freeze workflow

**Week 4: Admin Portal**
1. Create `useRetentionAuditLogs` hook
2. Create `FreezeManagementPanel` page
3. Create `RolloverAuditLogViewer` page
4. Create `RetentionAnalyticsDashboard` page
5. Add admin navigation

**Week 5: Partner Portal & Polish**
1. Update `PartnerOrders` with freeze status
2. Create `FreezeNotificationCenter`
3. Driver portal updates (minimal)
4. Bug fixes and optimization
5. Final testing

---

## SECTION 13: FILE CHECKLIST

### New Files to Create (47 total)

**Database (1)** ✅
- [x] `supabase/migrations/20250223000004_advanced_retention_system.sql`

**Edge Functions (4)**
- [ ] `supabase/functions/process-subscription-renewal/index.ts`
- [ ] `supabase/functions/handle-freeze-request/index.ts`
- [ ] `supabase/functions/calculate-health-score/index.ts`
- [ ] `supabase/functions/cleanup-expired-rollovers/index.ts`

**Hooks (10)**
- [ ] `src/hooks/useBodyMetrics.ts`
- [ ] `src/hooks/useHealthScore.ts`
- [ ] `src/hooks/useSubscriptionFreeze.ts`
- [ ] `src/hooks/useRolloverCredits.ts`
- [ ] `src/hooks/useRetentionAudit.ts`
- [ ] `src/hooks/useRetentionAnalytics.ts`

**Services (5)**
- [ ] `src/services/bodyMetricsService.ts`
- [ ] `src/services/subscriptionFreezeService.ts`
- [ ] `src/services/rolloverService.ts`
- [ ] `src/services/retentionAuditService.ts`
- [ ] `src/services/retentionAnalyticsService.ts`

**Types (1)**
- [ ] `src/types/retention.ts` (consolidated types)

**Components - Customer (10)**
- [ ] `src/components/body-metrics/WeeklyMetricsForm.tsx`
- [ ] `src/components/health-score/ComplianceScoreCard.tsx`
- [ ] `src/components/health-score/ComplianceScoreBadge.tsx`
- [ ] `src/components/subscription/FreezeSubscriptionModal.tsx`
- [ ] `src/components/subscription/RolloverCreditsDisplay.tsx`
- [ ] `src/components/charts/WeightTrendChart.tsx`
- [ ] `src/components/charts/WaistChart.tsx`
- [ ] `src/components/charts/BodyFatChart.tsx`

**Pages - Customer (1)**
- [ ] `src/pages/dashboard/BodyProgressDashboard.tsx`

**Components - Admin (6)**
- [ ] `src/components/admin/FreezesDataTable.tsx`
- [ ] `src/components/admin/AuditLogsTable.tsx`
- [ ] `src/components/admin/RetentionMetricsCards.tsx`
- [ ] `src/components/admin/HealthScoreDistributionChart.tsx`

**Pages - Admin (3)**
- [ ] `src/pages/admin/subscriptions/FreezeManagementPanel.tsx`
- [ ] `src/pages/admin/audit/RolloverAuditLogViewer.tsx`
- [ ] `src/pages/admin/analytics/RetentionAnalyticsDashboard.tsx`

**Components - Partner (2)**
- [ ] `src/components/partner/CustomerSubscriptionBadge.tsx`
- [ ] `src/components/partner/FreezeNotificationCenter.tsx`

**Tests (5+)**
- [ ] `src/hooks/__tests__/useBodyMetrics.test.ts`
- [ ] `src/hooks/__tests__/useSubscriptionFreeze.test.ts`
- [ ] `src/components/__tests__/WeeklyMetricsForm.test.tsx`
- [ ] `src/components/__tests__/FreezeSubscriptionModal.test.tsx`

### Files to Update (12 total)

**Routes (1)**
- [ ] `src/App.tsx` - Add new routes

**Navigation (3)**
- [ ] `src/components/Navigation.tsx` - Customer nav
- [ ] `src/components/AdminSidebar.tsx` - Admin nav
- [ ] `src/components/PartnerSidebar.tsx` - Partner nav

**Pages - Updates (6)**
- [ ] `src/pages/dashboard/Index.tsx` - Add health score
- [ ] `src/pages/subscription/SubscriptionManage.tsx` - Add freeze & rollover
- [ ] `src/pages/admin/AdminUsers.tsx` - Add health score column
- [ ] `src/pages/admin/AdminUserDetail.tsx` - Add health metrics
- [ ] `src/pages/admin/AdminAnalytics.tsx` - Add retention card
- [ ] `src/pages/partner/PartnerOrders.tsx` - Add freeze status
- [ ] `src/pages/partner/PartnerDashboard.tsx` - Add notifications

**Hooks - Updates (1)**
- [ ] `src/hooks/useSubscription.ts` - Add rollover/freeze fields

**Services - Updates (1)**
- [ ] `src/services/orderService.ts` - Use consume_meal_credit_v2

---

## Summary

This integration plan provides a complete roadmap for implementing the Advanced Subscription Retention System and Body Progress Dashboard across all four portals (Customer, Admin, Partner, Driver).

### Key Integration Points:
- **Customer Portal**: 1 new page, 8 new components, 4 new hooks
- **Admin Portal**: 3 new pages, 4 new components, 2 new hooks
- **Partner Portal**: 2 new components, updates to existing pages
- **Driver Portal**: Minimal updates (1 component)
- **Backend**: 4 Edge Functions, 4 Database Functions, 5 new tables

### Total New Code:
- **~4,000 lines** of TypeScript/TSX
- **~1,000 lines** of SQL
- **~500 lines** of tests
- **59 total files** (47 new, 12 updated)

### Timeline:
- **Week 1**: Database & Backend
- **Week 2**: Customer Portal - Body Progress
- **Week 3**: Customer Portal - Retention
- **Week 4**: Admin Portal
- **Week 5**: Partner Portal & Testing

All features are designed to integrate seamlessly with the existing Nutrio Fuel architecture using established patterns (TanStack Query, shadcn/ui, Recharts, Supabase).
