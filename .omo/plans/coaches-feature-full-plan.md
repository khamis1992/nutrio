# Coaches Feature: Full Operational Plan

**Status**: Draft  
**Date**: 2026-05-27  
**Goal**: Make the Nutrio coaches feature fully operational — from coach onboarding through client-coach interaction, with real data flowing end-to-end.

---

## Current State Summary

| Component | Status | Notes |
|-----------|--------|-------|
| `/nutrio/coaches` page | ✅ Renders | Shows "No coaches yet" because zero coaches exist in DB |
| `/coach` portal routes | ✅ Defined | Auth, Dashboard, Layout all exist |
| `coach_client_assignments` table | ✅ Exists | RLS policies configured but have critical bugs |
| `user_roles` table with `coach` role | ✅ Schema present | Zero rows with `role = 'coach'` |
| Client invite acceptance (Profile.tsx) | 🔴 Broken | RLS policy blocks updating NULL client_id rows |
| Coach pending requests UI | 🔴 Missing | Coach sees nothing when clients request connection |
| Client request flow (CoachesDirectory) | ✅ Functional | Inserts correctly but no one sees it |
| Coach Insights/Settings pages | 🔴 Missing | Nav links exist but pages don't |
| Coach bio/specialties | 🟡 Fake data | Hardcoded `null` / `[]` in display |
| Coach rating system | 🟡 Fake data | Always shows `4.5` |
| Connected coach visibility | 🟡 Missing | Banner shows but connected coach card doesn't |
| Coach onboarding | 🔴 Missing | No way to become a coach without direct DB access |

---

## Phase 1: Foundation (Database & RLS Fixes)

### 1.1 Fix the Invite Code Acceptance Flow

**Problem**: When a coach creates an invite, the row has `client_id: NULL` and `invite_code: 'NUTR-XXXXXX'`. The client finds the row by `invite_code` in `Profile.tsx:229` and tries to UPDATE it to set `status = 'active'`. But the RLS policy `clients_accept_invites` checks `USING (client_id = auth.uid())` — which fails because `client_id` is still NULL.

**Fix**: Add a new RLS policy specifically for invite code acceptance, OR modify the flow to use a `SECURITY DEFINER` function.

*Approach A — Simple RLS addition (recommended)*:
```sql
-- Allow clients to accept invites where client_id IS NULL and invite_code matches
-- The client sets their own client_id during acceptance
CREATE POLICY "clients_accept_invites_by_code" ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (invite_code IS NOT NULL AND client_id IS NULL);
```

*In `Profile.tsx` `handleConnectCoach`: after matching by invite_code, update both `client_id` and `status`:*
```typescript
// Current code only updates status, leaving client_id NULL
// Fix: also set client_id
await supabase.from("coach_client_assignments")
  .update({ status: "active", client_id: userId })
  .eq("invite_code", inviteCode.trim().toUpperCase());
```

**Files to change**:
- New SQL migration: `20260527_fix_coach_invite_acceptance.sql`
- `src/pages/Profile.tsx` lines 239-243: add `client_id: userId` to the update

### 1.2 Fix `clients_request_coaches` RLS Policy

**Problem**: The policy at line 57-59 of the migration is incomplete — the file shows:
```sql
CREATE POLICY "clients_request_coaches" ON coach_client_assignments
  FOR INSERT
  TO authenticated
-- The WITH CHECK clause is missing/incomplete
```

If the migration file is truly truncated, clients cannot insert request rows.

**Fix**: Verify the migration is complete. If truncated, add `WITH CHECK (client_id = auth.uid())`. Also add a `coach_id IS NOT NULL` check.

**Files to change**:
- Same migration file as 1.1, or verify existing migration is complete

### 1.3 Create Seed Data / Coach Role Assignment

**Problem**: Zero users have `role = 'coach'` in `user_roles`. The coaches directory is always empty.

**Fix**: Provide a way to assign the coach role:
- Option A: Create a migration that adds the coach role to an existing user for testing
- Option B: Build an admin panel section to manage coach roles (more work, defer to Phase 3)
- Option C: Create a self-serve onboarding flow (significant scope)

**Recommendation**: Option A for immediate testing + Option B in Phase 3.

```sql
-- Seed migration: assign coach role to a known user for testing
INSERT INTO public.user_roles (user_id, role)
VALUES ('<coach-user-uuid>', 'coach')
ON CONFLICT (user_id, role) DO NOTHING;
```

**Files to change**:
- New SQL migration: seed data
- (Phase 3) admin panel for coach management

### 1.4 Add Missing Profile Columns for Coaches

**Problem**: `CoachesDirectory.tsx` references `bio` and `specialties` but both are hardcoded to `null`/`[]`. The `profiles` table has no such columns.

**Fix**: Add a `coach_profile` table or extend `profiles` with coach-specific fields.

```sql
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}';
```

*Alternative*: If you don't want to pollute `profiles`, create a `coach_bios` table:
```sql
CREATE TABLE IF NOT EXISTS coach_bios (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  bio text,
  specialties text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Files to change**:
- New SQL migration for profile columns
- `src/pages/CoachesDirectory.tsx` lines 83-93: read real `bio` and `specialties` from the query
- `src/pages/coach/CoachSettings.tsx` (new): form to edit bio/specialties

---

## Phase 2: Core Workflow (Coach ↔ Client Interaction)

### 2.1 Coach Pending Requests UI

**Problem**: When a client clicks "Request" on a coach's card, a row is inserted with `status = 'pending'`. But `useCoachClients` only queries `status = 'active'`, so the coach never sees the request.

**Fix**: Add a pending requests section to `CoachDashboard.tsx`.

**Data**: Query `coach_client_assignments` where `status = 'pending'` and join with `profiles` to get client names.

**UI**: Add a separate section at the top of the dashboard (above the compliance grid) showing pending requests with Accept/Reject buttons.

**Accept flow**:
1. Coach clicks Accept → UPDATE `status = 'active'` on the assignment
2. Refresh the client list

**Reject flow**:
1. Coach clicks Reject → DELETE the assignment row
2. OR set `status = 'revoked'`

**Files to change**:
- `src/hooks/useCoachClients.ts`: add `pendingRequests` state, fetch pending rows
- `src/pages/coach/CoachDashboard.tsx`: add pending requests UI section
- `src/components/coach/PendingRequestCard.tsx` (new): card for each pending request

### 2.2 Fix Coach Invite Creation (CoachDashboard.tsx)

**Problem**: `CoachDashboard.tsx:159-164` inserts a row with `client_id: undefined` (implicitly NULL) and uses `prompt()` for client name. The name is captured but never used. The `invite_code` is generated client-side with `Math.random()` — fragile.

**Fix**:
- Remove `prompt()` for client name (it breaks on mobile / non-browser environments)
- Replace with a proper modal form
- Generate invite codes server-side or use a more robust client-side method
- Consider storing the client name hint in a `notes` field or separate record

```typescript
// Better approach: modal with client name/email input
// Store name hint in the assignment row (add column or use metadata)
```

**Files to change**:
- `src/pages/coach/CoachDashboard.tsx`: replace prompt() with modal
- `src/components/coach/InviteClientModal.tsx` (new): modal form
- Possible SQL migration: add `client_name_hint text` column to `coach_client_assignments`

### 2.3 Connected Coach Visibility in Directory

**Problem**: When a client has an active coach connection, `CoachesDirectory.tsx` shows a banner but doesn't show the connected coach's card with messaging/manage options.

**Fix**: Fetch the connected coach's profile and display it as the first card in the directory with special styling and actions (Message, View Progress).

**Files to change**:
- `src/pages/CoachesDirectory.tsx`: add connected coach card, "Message Coach" button, "View Progress" link
- `src/hooks/useCoachClients.ts`: export a `getConnectedCoach` query for the client side

---

## Phase 3: Feature Completion

### 3.1 Coach Insights Page

**Problem**: `/coach/insights` is in the sidebar but the page doesn't exist (would 404).

**Fix**: Create `CoachInsights.tsx` with aggregate client data: total clients, average adherence, at-risk clients, macro compliance trends, weight change trends.

**Route**: Add to App.tsx under the `/coach` layout.

**Files to change**:
- `src/pages/coach/CoachInsights.tsx` (new)
- `src/App.tsx`: add `<Route path="insights" element={<CoachInsights />} />`

### 3.2 Coach Settings Page

**Problem**: `/coach/settings` is in the sidebar but doesn't exist.

**Fix**: Create `CoachSettings.tsx` with:
- Edit bio and specialties
- Toggle what data is shared with clients (privacy toggles)
- Notification preferences

**Route**: Add to App.tsx.

**Files to change**:
- `src/pages/coach/CoachSettings.tsx` (new)
- `src/App.tsx`: add route

### 3.3 Coach Rating System

**Problem**: Rating is always `4.5` — fake data.

**Fix**: Add a `coach_reviews` table:

```sql
CREATE TABLE IF NOT EXISTS coach_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review text,
  created_at timestamptz DEFAULT now()
);
```

Then calculate `AVG(rating)` in the directory query.

**Files to change**:
- New SQL migration
- `src/pages/CoachesDirectory.tsx`: replace hardcoded rating with real query
- `src/components/coach/RateCoachDialog.tsx` (new): client rating form

### 3.4 Coach Onboarding Flow

**Problem**: There's no way for an existing user to become a coach.

**Fix**: Add a "Become a Coach" flow:
- A form where users apply to become coaches (bio, specialties, qualifications)
- Admin review process (or auto-approve for MVP)
- On approval, insert `user_roles` row with `role = 'coach'`

**Files to change**:
- `src/pages/coach/ApplyCoach.tsx` (new): application form
- `src/pages/admin/CoachApprovals.tsx` (new): admin review panel
- New SQL migration: `coach_applications` table

---

## Phase 4: Polish

### 4.1 Navigation & Discovery

- Add "Coaches" to the BottomTabBar (currently only on Community page)
- Add a "Find a Coach" CTA on the Profile page
- Show active coach status in the Dashboard header

### 4.2 Coach Chat Bubble Integration

- The `CoachChatBubble` currently uses VIP-tier subscription gating and AI-only chat
- Consider: when a client has a human coach, show a different chat bubble that connects to the real coach (or keep separate)

### 4.3 Notifications

- Notify coach when a client sends a request
- Notify client when coach accepts/rejects
- Notify client when coach reaches out

### 4.4 Progress Sharing

- Client can toggle what data the coach sees (macros, weight, adherence)
- The existing `can_view_*` columns already exist on `coach_client_assignments`

---

## Execution Order

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| 1.1 Fix invite RLS | 🔴 P0 | Small | None |
| 1.2 Fix request RLS | 🔴 P0 | Small | None |
| 1.3 Seed coach data | 🔴 P0 | Tiny | None |
| 1.4 Profile columns | 🟡 P1 | Small | None |
| 2.1 Pending requests UI | 🔴 P0 | Medium | 1.1, 1.2, 1.3 |
| 2.2 Fix invite creation | 🟡 P1 | Medium | 1.3 |
| 2.3 Connected coach card | 🟡 P1 | Small | 2.1 |
| 3.1 Insights page | 🟡 P1 | Medium | 1.3 |
| 3.2 Settings page | 🟡 P1 | Medium | 1.4 |
| 3.3 Rating system | 🟢 P2 | Medium | 1.3 |
| 3.4 Onboarding flow | 🟢 P2 | Large | 3.2 |
| 4.x Polish items | 🟢 P2 | Small-Medium | All above |

---

## Open Questions

1. **Coach data source**: Should coach profiles use the existing `profiles` table or a separate `coach_profiles` table? (Recommendation: extend `profiles` for simplicity)

2. **Coach chat**: Should the VIP AI coach chat (CoachChatBubble) also work as a human coach chat when a real coach is connected? Or keep them separate?

3. **Coach discovery**: Should coaches be searchable/filterable by specialty, goal type, or rating in the directory?

4. **Coach seed data**: Who should the first test coach be? A separate test account or an existing user?

5. **Auto-approve coaches?**: For MVP, should coach applications be auto-approved or require admin review?
