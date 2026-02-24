# Task Plan: Advanced Subscription Retention System + Body Progress Dashboard

## Goal
Implement comprehensive subscription retention features (rollover credits + subscription freeze) and a numeric body progress dashboard across all portals with full server-side enforcement and audit logging.

## Overview
This plan extends the existing AI-powered subscription ecosystem with advanced retention mechanisms:
1. **Smart Unused Meals Management** - Rollover credits (20% max) + Subscription freeze (7 days/month max)
2. **Body Progress Dashboard** - Numeric health tracking without photos
3. **Health Compliance Score** - 0-100% scoring system for engagement

## Current State
- AI credit subscription system already implemented (3 tiers: Basic/Standard/Premium)
- Nutrition engine with 5 layers operational
- Weekly meal planner functional
- Database has subscriptions, credit_transactions, behavior_analytics tables

## Phases

### Phase 1: Database Schema Design & Migration
- [ ] Create `subscription_rollovers` table for rollover credit tracking
- [ ] Create `subscription_freezes` table for freeze period tracking  
- [ ] Create `user_body_metrics` table for progress tracking
- [ ] Create `user_health_scores` table for compliance scoring
- [ ] Create `retention_audit_logs` table for audit trail
- [ ] Add columns to existing `subscriptions` table
- [ ] Write database migration file
- [ ] Create database functions for credit calculations with rollover priority

**Skills Required:** Senior Database Design, SQL Optimization

### Phase 2: Backend Logic Implementation (Supabase Edge Functions)
- [ ] Create Edge Function: `process-subscription-renewal` with rollover logic
- [ ] Create Edge Function: `handle-freeze-request` with validation
- [ ] Create Edge Function: `calculate-health-score` - AI compliance calculation
- [ ] Create Edge Function: `consume-credit` - Enforce rollover-first consumption
- [ ] Create Edge Function: `process-body-metrics` - Analytics and trends
- [ ] Create Edge Function: `cleanup-expired-rollovers` - Cron job for expiry
- [ ] Implement security validations and abuse prevention

**Skills Required:** API Integration Specialist, Supabase Edge Functions

### Phase 3: Customer Portal Frontend
- [ ] Create `BodyProgressDashboard` page with Recharts charts
- [ ] Build `WeeklyMetricsForm` component (weight, waist, body fat, muscle mass)
- [ ] Implement `HealthComplianceScore` component with visual indicators
- [ ] Create `FreezeSubscriptionModal` with date picker and validation
- [ ] Add `RolloverCreditsDisplay` in subscription details
- [ ] Build progress charts: WeightTrendChart, WaistChart, BodyFatChart
- [ ] Create `ComplianceScoreBreakdown` showing formula components
- [ ] Update subscription management page with freeze controls

**Skills Required:** Senior Frontend (React, TypeScript, Tailwind, Recharts)

### Phase 4: Admin Portal Enhancements
- [ ] Add `FreezeManagementPanel` in admin subscriptions section
- [ ] Create `RolloverAuditLogViewer` for all rollover activities
- [ ] Build `RetentionAnalyticsDashboard` with aggregated metrics
- [ ] Add `HealthScoresOverview` (anonymized compliance data)
- [ ] Create manual override tools for edge cases
- [ ] Add export functionality for audit logs

**Skills Required:** Senior Frontend, Data Visualization

### Phase 5: Partner Portal Updates
- [ ] Update order processing logic to check freeze status
- [ ] Display customer subscription status (frozen/active) in order cards
- [ ] Add notifications for freeze/unfreeze events affecting orders
- [ ] Update restaurant dashboard with freeze impact metrics

**Skills Required:** Senior Frontend

### Phase 6: Driver Portal (Minimal Changes)
- [ ] Display freeze status on delivery orders if relevant
- [ ] No major changes needed for driver workflow

### Phase 7: Testing & Security Validation
- [ ] Unit tests for all database functions
- [ ] Integration tests for rollover calculation edge cases
- [ ] Boundary tests for freeze period limits
- [ ] Credit consumption order validation tests
- [ ] RLS policy verification for all new tables
- [ ] Load testing for 10K+ concurrent users
- [ ] Security audit - verify no client-side credit manipulation

**Skills Required:** Code Reviewer, Security Testing

### Phase 8: Documentation & Deployment
- [ ] API documentation for new Edge Functions
- [ ] Admin guide for freeze management
- [ ] Health compliance score formula documentation
- [ ] Database schema documentation
- [ ] Deployment checklist and rollback plan

**Skills Required:** Technical Writing

## Key Decisions
- **Rollover Limit**: 20% max, expires after next cycle, no stacking
- **Freeze Limit**: 7 days per billing cycle, resets each cycle
- **Credit Order**: Rollover credits consumed first, then new credits
- **Freeze Timing**: Must be scheduled 24h in advance, no retroactive
- **Health Score**: Weekly calculation via cron job, stored in database
- **Audit Logging**: Mandatory for all rollover and freeze actions
- **Server Control**: All calculations enforced server-side only

## Portal Impact Summary

| Portal | Changes Required |
|--------|-----------------|
| **Customer** | Body Progress Dashboard, Weekly Metrics Form, Health Score Display, Freeze Controls, Rollover Display |
| **Admin** | Freeze Management, Audit Log Viewer, Retention Analytics, Health Score Overview |
| **Partner** | Order freeze status display, freeze notifications |
| **Driver** | Minimal - freeze status on orders |

## Database Schema Requirements

### New Tables
1. `subscription_rollovers` - Track rollover credits
2. `subscription_freezes` - Track freeze periods
3. `user_body_metrics` - Weekly body measurements
4. `user_health_scores` - Calculated compliance scores
5. `retention_audit_logs` - Comprehensive audit trail

### Modified Tables
1. `subscriptions` - Add freeze_days_used, rollover_credits fields

## Security Considerations
- All credit calculations happen in Edge Functions
- RLS policies prevent unauthorized access
- Rate limiting on freeze requests
- Audit logging for all retention actions
- Input validation on all user-submitted metrics

## Performance Targets
- Dashboard load: < 2 seconds
- Health score calculation: < 500ms
- Freeze request processing: < 1 second
- Support 10,000+ active users

## Current Status
**Phase 1** - Creating comprehensive design document and database schema

## Implementation Notes
- Use existing Recharts library for charts
- Follow existing shadcn/ui component patterns
- Maintain TypeScript strict typing
- Use TanStack Query for server state management
- Follow existing RLS policy patterns
