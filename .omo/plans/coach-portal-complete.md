# Coach Portal Complete Feature Build

## TL;DR

> **Quick Summary**: Build all 14 missing coach portal features across 4 waves — covering earnings withdrawal, milestone notifications, client notes, file sharing, onboarding, bulk messaging, subscriptions, program builder, measurements, goal-setting, scheduling, reports, reviews, and availability.
>
> **Deliverables**:
> - 7 new database tables + 1 storage bucket
> - 6 new `useCoach*` hooks
> - 10 new/updated page components
> - 5 new client-side pages
> - 1 new Supabase Edge Function
> - 1 PDF report generator
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Wave 1 (DB) → Wave 2 (Phase 1 features) → Wave 3 (Phase 2 features) → Wave 4 (Phase 3 features)

---

## Context

### Original Request
Build all 14 features identified in the coach portal gap analysis: earnings withdrawal, milestone notifications, client notes, chat file sharing, client onboarding, bulk messaging, payment subscriptions, program builder, body measurements, collaborative goals, scheduling, PDF reports, coach reviews, and availability signal.

### Interview Summary
**Key Discussions**:
- **Scope**: All 14 features in ONE plan, 4 implementation waves
- **Test strategy**: No unit tests — agent-executed QA only (Playwright, curl, tmux)
- **Earnings**: Qatar bank transfer (IBAN collection + admin approval)
- **Storage**: Supabase Storage bucket `coach-attachments`
- **Notifications**: Full milestone suite — streaks (7/14/30), weight milestones, adherence alerts
- **Onboarding**: Essentials only (health goal, weight, activity level, dietary preferences)
- **Program builder**: Both meal plans AND workout plans
- **Measurements**: Body fat %, waist, hip + photos
- **Reports**: Comprehensive 3-5 page PDF
- **Scheduling**: In-app calendar with booking

**Research Findings**:
- `body_measurements` table already has `waist_cm`, `hip_cm`, `body_fat_percent` — no schema change needed
- `notifications` table supports `notification_type` enum — can add `coach_milestone` type
- Sadad payment gateway fully wired via `src/lib/sadad.ts`
- Realtime already enabled on `coach_messages`
- All pages follow consistent patterns: framer-motion, `cn()`, `useAuth()`, rounded-24px cards

### Gap Analysis (self-performed)
- **Guardrails**: Must not break existing client dashboard, notification system, or partner/admin portals
- **Edge cases**: Empty states for all new features, error handling for Supabase failures
- **Assumptions validated**: Existing `coach_earnings.status` enum supports withdrawal flow

---

## Work Objectives

### Core Objective
Complete the coach portal ecosystem with all 14 missing features, delivered in 4 parallel waves, matching existing codebase patterns.

### Concrete Deliverables
- 7 new DB tables: `coach_notes`, `coach_withdrawal_requests`, `coach_chat_attachments`, `client_onboarding_responses`, `coach_programs`+ `program_meals`+ `program_exercises`, `coach_reviews`, `coach_sessions`, `goal_proposals`
- 1 Supabase Storage bucket: `coach-attachments`
- 6 new hooks: `useCoachNotes`, `useCoachWithdrawal`, `useCoachAttachments`, `useClientOnboarding`, `useCoachPrograms`, `useGoalProposals`, `useCoachSessions`
- New pages: `/coach/notes/:clientId`, `/nutrio/coach-onboarding`, `/nutrio/coach-subscription`, `/nutrio/coach-programs`, `/nutrio/coach-schedule`
- Enhanced existing pages: `CoachClientDetail`, `CoachChatPage`, `CoachEarningsPage`, `CoachDashboard`, `CoachesDirectory`, `NotificationsPage`

### Definition of Done
- [ ] All 14 features functional with agent-verified QA evidence
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All QA evidence files exist in `.omo/evidence/`

### Must Have
- Earnings withdrawal with IBAN collection + admin approval
- Milestone notifications for streaks, weight, adherence
- Client private notes
- File sharing in coach chat
- Client onboarding questionnaire
- Bulk messaging to all active clients
- Sadad-powered subscription checkout
- Meal + workout program builder
- Body fat %, waist, hip tracking + photo comparison
- Goal proposal → accept → track workflow
- In-app calendar with session booking
- Comprehensive PDF progress report
- Client-side coach reviews
- Coach availability signal on directory

### Must NOT Have (Guardrails)
- No breaking existing coach or client pages
- No changing existing notification system (extend only)
- No removing any existing RLS policies
- No AI slop: no `as any`, no `@ts-ignore`, no empty catch blocks, no console.log in prod
- No over-abstraction — direct Supabase queries in hooks, no unnecessary utility layers

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest configured)
- **Automated tests**: None
- **Agent-Executed QA**: ALWAYS — Playwright for UI, curl for API, tmux for CLI

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.
- **Frontend/UI**: Playwright — navigate, fill forms, click, assert, screenshot
- **API/Backend**: Bash (curl) — send requests, assert status + response fields
- **Database**: Bash (supabase execute_sql) — verify migrations applied

---

## Execution Strategy

### Parallel Execution Waves
```
Wave 1 (Start Immediately — DB foundation, all independent):
├── Task 1: coach_notes table migration
├── Task 2: coach_withdrawal_requests table migration
├── Task 3: coach_chat_attachments table + storage bucket
├── Task 4: client_onboarding_responses table migration
├── Task 5: coach_programs / program_meals / program_exercises tables
├── Task 6: coach_reviews table migration
├── Task 7: coach_sessions table migration
└── Task 8: goal_proposals table + milestone notification triggers

Wave 2 (After Wave 1 — Phase 1 core features):
├── Task 9: Regenerate TypeScript types
├── Task 10: Client Notes — hook + UI in CoachClientDetail
├── Task 11: Earnings Withdrawal — hook + form in CoachEarningsPage
├── Task 12: Milestone Notifications — trigger + edge function + UI
├── Task 13: File Upload in Chat — hook + UI in CoachChatPage
├── Task 14: Client Onboarding — hook + form page
└── Task 15: Bulk Messaging — UI in CoachChatPage

Wave 3 (After Wave 2 — Phase 2 + early Phase 3):
├── Task 16: Payment/Subscription Checkout — Sadad integration
├── Task 17: Body Measurements Enhancement — CoachClientDetail + photo
├── Task 18: Coach Reviews — form + directory display
├── Task 19: Goal Proposals — hook + propose/accept flow
├── Task 20: Meal Plan Builder — program assignment UI
├── Task 21: Workout Plan Builder — exercise form + client view
└── Task 22: Coach Availability Signal — directory component

Wave 4 (After Wave 3 — Advanced features + integration):
├── Task 23: Scheduling Calendar — in-app calendar + booking
├── Task 24: PDF Export — report generator + download
├── Task 25: Program Client View — client-side meal/workout display
├── Task 26: Scheduling Client Booking — client-side session booking
└── Task 27: Integration QA — cross-feature smoke tests

Critical Path: Task 3 (storage bucket) → Task 13 (file upload) → Wave 3/4
Max Concurrent: 8 (Wave 1)
```

---

## TODOs

- [ ] 1. coach_notes table migration

  **What to do**:
  - Create migration `YYYYMMDD_add_coach_notes.sql` with table:
    - `id uuid PK DEFAULT gen_random_uuid()`
    - `coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
    - `client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
    - `note text NOT NULL`
    - `created_at timestamptz DEFAULT now()`
    - `updated_at timestamptz DEFAULT now()`
  - Index on `(coach_id, client_id, created_at DESC)`
  - RLS: coach can SELECT/INSERT/UPDATE/DELETE own notes
  - Add to `CoachEarning` type pattern in types.ts

  **Must NOT do**:
  - Do NOT add policies for client read access — notes are coach-private
  - Do NOT alter any existing tables

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single migration file, straightforward DDL
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: Migration + RLS best practices

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-8)
  - **Blocks**: Task 10

  **References**:
  - `supabase/migrations/20260526000000_add_coach_portal.sql:4-16` — Table structure pattern (PK, FKs, RLS)
  - `supabase/migrations/20260527_add_coach_messages.sql:22-48` — RLS policy pattern for coach-only access

  **Acceptance Criteria**:
  - [ ] Migration file created: `supabase/migrations/YYYYMMDD_add_coach_notes.sql`
  - [ ] Table `coach_notes` exists in Supabase with correct columns
  - [ ] RLS policies restrict read/write to coach only
  - [ ] Types regenerated: `npx supabase gen types typescript`

  **QA Scenarios**:
  ```
  Scenario: Coach inserts a note for a client
    Tool: Bash (curl)
    Preconditions: Authenticated coach session, active client assignment exists
    Steps:
      1. POST to Supabase REST API: INSERT INTO coach_notes (coach_id, client_id, note)
         with valid coach_id and client_id
      2. Verify response status 201
      3. SELECT from coach_notes WHERE coach_id = <coach_id> — verify note appears
    Expected Result: Note inserted and retrievable by coach
    Failure Indicators: 401/403 status, empty SELECT result, RLS blocking insert
    Evidence: .omo/evidence/task-1-note-insert.json

  Scenario: Client cannot read coach's private notes
    Tool: Bash (curl)
    Preconditions: Client authenticated session, coach note exists
    Steps:
      1. Client session: SELECT * FROM coach_notes
      2. Verify response returns empty array (0 rows)
    Expected Result: Client sees 0 notes despite notes existing
    Failure Indicators: Client can see coach notes (data returned)
    Evidence: .omo/evidence/task-1-client-cannot-read.json
  ```

  **Commit**: YES
  - Message: `feat(coach): add client notes table with coach-only RLS`
  - Files: `supabase/migrations/YYYYMMDD_add_coach_notes.sql`

- [ ] 2. coach_withdrawal_requests table migration

  **What to do**:
  - Create migration `YYYYMMDD_add_coach_withdrawal.sql` with table:
    - `id uuid PK DEFAULT gen_random_uuid()`
    - `coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
    - `amount decimal NOT NULL CHECK (amount > 0)`
    - `bank_name text NOT NULL`
    - `iban text NOT NULL`
    - `account_holder text NOT NULL`
    - `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed'))`
    - `admin_notes text`
    - `processed_at timestamptz`
    - `created_at timestamptz DEFAULT now()`
  - Index on `(coach_id, status, created_at DESC)`
  - RLS: coach can INSERT/SELECT own requests, admin can UPDATE all
  - Add `notification_type` enum value: `coach_withdrawal` if not exists
  - Trigger: on status change to 'approved'/'rejected', notify coach

  **Must NOT do**:
  - Do NOT auto-transfer funds — this is manual admin approval only
  - Do NOT expose admin notes to coaches (separate column, admin-only RLS)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single migration with trigger, well-defined schema
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: Trigger function + RLS

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-8)
  - **Blocks**: Task 11

  **References**:
  - `supabase/migrations/20260528_coach_monetization.sql:5-13` — coach_pricing table pattern
  - `supabase/migrations/20260528_fix_coach_notifications_reply.sql:10` — ALTER TYPE pattern
  - `supabase/migrations/20260528_coach_monetization.sql:141-166` — Trigger function pattern

  **Acceptance Criteria**:
  - [ ] Migration applied: table `coach_withdrawal_requests` exists
  - [ ] RLS: coach can INSERT own requests, cannot UPDATE
  - [ ] Admin update policy works (for approving/rejecting)
  - [ ] Notification trigger fires on status change

  **QA Scenarios**:
  ```
  Scenario: Coach submits withdrawal request
    Tool: Bash (curl)
    Preconditions: Coach authenticated, settled earnings > 0
    Steps:
      1. POST: INSERT INTO coach_withdrawal_requests (coach_id, amount, bank_name, iban, account_holder)
         with valid values
      2. Verify 201 status
      3. SELECT request — verify status = 'pending', coach_id matches
    Expected Result: Withdrawal request created with 'pending' status
    Evidence: .omo/evidence/task-2-withdrawal-create.json

  Scenario: Admin approves withdrawal
    Tool: Bash (curl)
    Preconditions: Admin session, pending withdrawal exists
    Steps:
      1. Admin: UPDATE coach_withdrawal_requests SET status = 'approved' WHERE id = <id>
      2. Verify 200 status
      3. Check notifications table for coach_withdrawal notification
      4. SELECT request — verify status = 'approved', admin_notes set
    Expected Result: Status updated, coach notified
    Evidence: .omo/evidence/task-2-admin-approve.json
  ```

  **Commit**: YES
  - Message: `feat(coach): add withdrawal requests table with admin approval flow`
  - Files: `supabase/migrations/YYYYMMDD_add_coach_withdrawal.sql`

- [ ] 3. coach_chat_attachments table + storage bucket migration

  **What to do**:
  - Create migration `YYYYMMDD_add_coach_attachments.sql` with:
    - Table `coach_chat_attachments`:
      - `id uuid PK DEFAULT gen_random_uuid()`
      - `message_id uuid NOT NULL REFERENCES coach_messages(id) ON DELETE CASCADE`
      - `file_path text NOT NULL` (Supabase Storage path)
      - `file_name text NOT NULL`
      - `file_size bigint NOT NULL`
      - `file_type text NOT NULL`
      - `uploaded_by uuid NOT NULL REFERENCES auth.users(id)`
      - `created_at timestamptz DEFAULT now()`
    - Index on `(message_id)`
    - RLS: same as coach_messages (coach or client in assignment)
    - Supabase Storage bucket: `coach-attachments` (private, RLS-controlled)
    - Storage RLS: only coach/client in active assignment can upload/download

  **Must NOT do**:
  - Do NOT use public bucket — all files must be private
  - Do NOT change coach_messages schema (attachment table is separate)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Table + storage bucket, straightforward
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: Storage RLS pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-8)
  - **Blocks**: Task 13

  **References**:
  - `supabase/migrations/20260527_add_coach_messages.sql:4-48` — coach_messages pattern
  - `supabase/migrations/20260305000001_create_avatars_bucket.sql` — Storage bucket creation pattern

  **Acceptance Criteria**:
  - [ ] Table `coach_chat_attachments` exists
  - [ ] Storage bucket `coach-attachments` created (private)
  - [ ] Storage RLS: only coach/client in active assignment can access
  - [ ] File upload tested via curl

  **QA Scenarios**:
  ```
  Scenario: Coach uploads file and links to message
    Tool: Bash (curl)
    Preconditions: Coach authenticated, active client assignment
    Steps:
      1. Upload file to coach-attachments bucket with form-data
      2. Verify 200, get publicUrl
      3. INSERT coach_chat_attachments with message_id, file_path, file_name, file_size, file_type
      4. Verify 201
      5. Download file from storage URL — verify file content matches
    Expected Result: File uploaded and accessible by coach
    Evidence: .omo/evidence/task-3-upload.json

  Scenario: Unauthorized user cannot access stored file
    Tool: Bash (curl)
    Preconditions: Random authenticated user (not coach or client)
    Steps:
      1. Try downloading file from storage URL with unauthorized user token
      2. Verify 403 Forbidden
    Expected Result: Access denied
    Evidence: .omo/evidence/task-3-unauthorized.json
  ```

  **Commit**: YES
  - Message: `feat(coach): add chat attachments table and storage bucket`
  - Files: `supabase/migrations/YYYYMMDD_add_coach_attachments.sql`

- [ ] 4. client_onboarding_responses table migration

  **What to do**:
  - Create migration `YYYYMMDD_add_client_onboarding.sql`:
    - Table `client_onboarding_responses`:
      - `id uuid PK DEFAULT gen_random_uuid()`
      - `client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `health_goal text` (weight_loss, muscle_gain, maintenance, general_health)
      - `current_weight_kg decimal(5,2)`
      - `target_weight_kg decimal(5,2)`
      - `activity_level text` (sedentary, light, moderate, active, very_active)
      - `dietary_preferences text` (omnivore, vegetarian, vegan, keto, paleo, mediterranean)
      - `allergies_or_restrictions text`
      - `medical_conditions text`
      - `coaching_expectations text`
      - `submitted_at timestamptz DEFAULT now()`
      - UNIQUE(client_id, coach_id)
    - RLS: client can INSERT/SELECT own responses, coach can SELECT own clients' responses
    - Trigger: on INSERT, notify coach with type `coach_onboarding`

  **Must NOT do**:
  - Do NOT require all fields — only health_goal should be required
  - Do NOT overwrite existing response — use UNIQUE constraint, upsert on resubmit

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single table migration with trigger
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: Trigger + RLS pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-8)
  - **Blocks**: Task 14

  **References**:
  - `supabase/migrations/20260526000000_add_coach_portal.sql:4-16` — Table with UNIQUE constraint pattern
  - `supabase/migrations/20260528_fix_coach_notifications_reply.sql:13-61` — Notification trigger pattern

  **Acceptance Criteria**:
  - [ ] Table `client_onboarding_responses` exists with correct columns
  - [ ] UNIQUE constraint on (client_id, coach_id)
  - [ ] RLS: client can INSERT/SELECT own, coach can SELECT own clients'
  - [ ] Notification trigger fires on submission

  **QA Scenarios**:
  ```
  Scenario: Client submits onboarding form
    Tool: Bash (curl)
    Preconditions: Client authenticated, coach assignment active
    Steps:
      1. INSERT client_onboarding_responses with required fields (client_id, coach_id, health_goal)
      2. Verify 201 status
      3. Check notifications table — verify coach_notification of type 'coach_onboarding' created
    Expected Result: Form saved, coach notified
    Evidence: .omo/evidence/task-4-onboarding-submit.json

  Scenario: Client resubmits (upserts) onboarding
    Tool: Bash (curl)
    Preconditions: Existing onboarding response for this client-coach pair
    Steps:
      1. INSERT again with same client_id + coach_id, updated health_goal
      2. Verify upsert succeeds (no duplicate key error)
      3. SELECT — verify only 1 row, updated values
    Expected Result: Existing row updated, no duplicate
    Evidence: .omo/evidence/task-4-upsert.json
  ```

  **Commit**: YES
  - Message: `feat(coach): add client onboarding responses table`
  - Files: `supabase/migrations/YYYYMMDD_add_client_onboarding.sql`

- [ ] 5. coach_programs table migration (meal plans + workout plans)

  **What to do**:
  - Create migration `YYYYMMDD_add_coach_programs.sql` with THREE tables:
    - `coach_programs`:
      - `id uuid PK DEFAULT gen_random_uuid()`
      - `coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `title text NOT NULL`
      - `description text`
      - `type text NOT NULL CHECK (type IN ('meal_plan', 'workout_plan'))`
      - `start_date date NOT NULL`
      - `end_date date NOT NULL`
      - `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))`
      - `created_at timestamptz DEFAULT now()`
      - UNIQUE(coach_id, client_id, type, start_date)
    - `program_meals`:
      - `id uuid PK DEFAULT gen_random_uuid()`
      - `program_id uuid NOT NULL REFERENCES coach_programs(id) ON DELETE CASCADE`
      - `meal_id uuid REFERENCES meals(id) ON DELETE CASCADE`
      - `assigned_date date NOT NULL`
      - `meal_type text NOT NULL` (breakfast, lunch, dinner, snack)
      - `notes text`
      - `created_at timestamptz DEFAULT now()`
      - UNIQUE(program_id, meal_id, assigned_date, meal_type)
    - `program_exercises`:
      - `id uuid PK DEFAULT gen_random_uuid()`
      - `program_id uuid NOT NULL REFERENCES coach_programs(id) ON DELETE CASCADE`
      - `exercise_name text NOT NULL`
      - `sets int NOT NULL DEFAULT 3 CHECK (sets > 0)`
      - `reps text NOT NULL` (e.g. "12-15" or "AMRAP")
      - `rest_seconds int DEFAULT 60`
      - `notes text`
      - `day_number int NOT NULL CHECK (day_number > 0)`
      - `order_index int NOT NULL DEFAULT 0`
      - `created_at timestamptz DEFAULT now()`
  - RLS on all tables: coach can manage own programs, client can SELECT own programs
  - Indexes on `(coach_id, client_id)` on coach_programs

  **Must NOT do**:
  - Do NOT allow DELETE on coach_programs by client
  - Do NOT allow INSERT/UPDATE on program_meals/program_exercises by client

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Three related tables, well-structured DDL
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: Multi-table migration, FK cascades

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-8)
  - **Blocks**: Tasks 20, 21

  **References**:
  - `supabase/migrations/20260526000000_add_coach_portal.sql:4-16` — Coach-specific table pattern
  - `supabase/migrations/20260528_coach_monetization.sql:21-35` — coach_subscriptions FK pattern

  **Acceptance Criteria**:
  - [ ] All 3 tables exist: `coach_programs`, `program_meals`, `program_exercises`
  - [ ] FK cascades work: delete program → meals/exercises cascade
  - [ ] RLS: coach full access, client SELECT only
  - [ ] type CHECK constraint enforced

  **QA Scenarios**:
  ```
  Scenario: Coach creates a meal plan program
    Tool: Bash (curl)
    Preconditions: Coach authenticated, active client assignment
    Steps:
      1. INSERT coach_programs (type='meal_plan', coach_id, client_id, title, start_date, end_date)
      2. INSERT program_meals linked to program_id with meal_id, assigned_date, meal_type
      3. SELECT program + meals — verify all inserted
    Expected Result: Program and meals created
    Evidence: .omo/evidence/task-5-meal-plan-create.json

  Scenario: Client tries to delete a program (should fail)
    Tool: Bash (curl)
    Preconditions: Client session, program exists for this client
    Steps:
      1. Client: DELETE FROM coach_programs WHERE id = <program_id>
      2. Verify 401/403 (RLS blocks)
    Expected Result: Delete rejected by RLS
    Evidence: .omo/evidence/task-5-client-delete-blocked.json

  Scenario: Coach creates workout plan with exercises
    Tool: Bash (curl)
    Preconditions: Coach authenticated
    Steps:
      1. INSERT coach_programs (type='workout_plan', ...)
      2. INSERT 3 program_exercises linked to program_id with sets, reps, day_number, order_index
      3. SELECT — verify all exercises present, ordered correctly
    Expected Result: Workout program with exercises created
    Evidence: .omo/evidence/task-5-workout-create.json
  ```

  **Commit**: YES
  - Message: `feat(coach): add program builder tables (meals + workouts)`
  - Files: `supabase/migrations/YYYYMMDD_add_coach_programs.sql`

- [ ] 6. coach_reviews table migration

  **What to do**:
  - Create migration `YYYYMMDD_add_coach_reviews.sql`:
    - Table `coach_reviews`:
      - `id uuid PK DEFAULT gen_random_uuid()`
      - `coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `rating int NOT NULL CHECK (rating >= 1 AND rating <= 5)`
      - `review_text text`
      - `created_at timestamptz DEFAULT now()`
      - UNIQUE(coach_id, client_id)
    - RLS: client can INSERT own review (must have active/expired subscription), anyone can SELECT
    - Index on `(coach_id, rating)`
    - View: `coach_rating_summary` (AVG rating, count per coach)

  **Must NOT do**:
  - Do NOT allow client to review same coach twice (UNIQUE constraint)
  - Do NOT allow review from client without active or past assignment

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single table + view, straightforward
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: View creation + CHECK constraints

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7-8)
  - **Blocks**: Task 18

  **References**:
  - `supabase/migrations/20260528_coach_monetization.sql:5-13` — coach_pricing table (single-row-per-coach pattern)
  - `supabase/migrations/20260526000000_add_coach_portal.sql:15` — UNIQUE constraint pattern

  **Acceptance Criteria**:
  - [ ] Table `coach_reviews` exists with rating CHECK constraint
  - [ ] UNIQUE on (coach_id, client_id) enforced
  - [ ] View `coach_rating_summary` returns correct AVG and count
  - [ ] RLS: client INSERT own only, public SELECT

  **QA Scenarios**:
  ```
  Scenario: Client submits a review
    Tool: Bash (curl)
    Preconditions: Client authenticated, has active coach assignment
    Steps:
      1. INSERT coach_reviews (coach_id, client_id, rating=4, review_text="Great coach!")
      2. Verify 201
      3. SELECT coach_rating_summary — verify rating and count updated
    Expected Result: Review saved, summary updated
    Evidence: .omo/evidence/task-6-review-submit.json

  Scenario: Client tries to submit second review for same coach
    Tool: Bash (curl)
    Preconditions: Client already has a review for this coach
    Steps:
      1. INSERT coach_reviews again with same coach_id + client_id
      2. Verify 409 Conflict (UNIQUE violation)
    Expected Result: Duplicate rejected
    Evidence: .omo/evidence/task-6-duplicate-rejected.json
  ```

  **Commit**: YES
  - Message: `feat(coach): add coach reviews table with rating summary view`
  - Files: `supabase/migrations/YYYYMMDD_add_coach_reviews.sql`

- [ ] 7. coach_sessions table migration

  **What to do**:
  - Create migration `YYYYMMDD_add_coach_sessions.sql`:
    - Table `coach_sessions`:
      - `id uuid PK DEFAULT gen_random_uuid()`
      - `coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `title text NOT NULL`
      - `description text`
      - `session_type text NOT NULL DEFAULT 'video_call' CHECK (session_type IN ('video_call', 'in_person', 'phone_call', 'check_in'))`
      - `scheduled_at timestamptz NOT NULL`
      - `duration_minutes int NOT NULL DEFAULT 30`
      - `status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'))`
      - `meeting_link text`
      - `notes text`
      - `created_at timestamptz DEFAULT now()`
      - `updated_at timestamptz DEFAULT now()`
    - Index on `(coach_id, scheduled_at)`, `(client_id, scheduled_at)`
    - RLS: coach full access to own sessions, client SELECT/UPDATE own sessions
    - Trigger: on INSERT, notify client with type `coach_session_scheduled`

  **Must NOT do**:
  - Do NOT add external calendar sync in migration (UI layer only)
  - Do NOT restrict session_type enum — keep extensible

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single table + trigger, well-defined
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: Trigger + RLS

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6, 8)
  - **Blocks**: Tasks 23, 26

  **References**:
  - `supabase/migrations/20260528_coach_monetization.sql:21-35` — coach_subscriptions (timestamptz scheduling pattern)
  - `supabase/migrations/20260528_fix_coach_notifications_reply.sql:13-61` — Notification trigger pattern

  **Acceptance Criteria**:
  - [ ] Table `coach_sessions` exists with correct columns and status enum
  - [ ] Indexes on scheduled_at for both coach and client
  - [ ] RLS: coach full, client SELECT/UPDATE own
  - [ ] Notification trigger fires on session creation

  **QA Scenarios**:
  ```
  Scenario: Coach schedules a session
    Tool: Bash (curl)
    Preconditions: Coach authenticated, active client assignment
    Steps:
      1. INSERT coach_sessions (coach_id, client_id, title, scheduled_at, duration_minutes)
      2. Verify 201
      3. Check notifications table for client notification of type 'coach_session_scheduled'
    Expected Result: Session created, client notified
    Evidence: .omo/evidence/task-7-session-schedule.json

  Scenario: Client confirms a scheduled session
    Tool: Bash (curl)
    Preconditions: Client authenticated, scheduled session exists
    Steps:
      1. Client: UPDATE coach_sessions SET status = 'confirmed' WHERE id = <session_id>
      2. Verify 200
      3. SELECT — verify status = 'confirmed'
    Expected Result: Status updated to confirmed
    Evidence: .omo/evidence/task-7-confirm.json
  ```

  **Commit**: YES
  - Message: `feat(coach): add sessions table with scheduling and notifications`
  - Files: `supabase/migrations/YYYYMMDD_add_coach_sessions.sql`

- [ ] 8. goal_proposals table + milestone notification triggers

  **What to do**:
  - Create migration `YYYYMMDD_add_goal_proposals.sql`:
    - Table `goal_proposals`:
      - `id uuid PK DEFAULT gen_random_uuid()`
      - `coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
      - `goal_type text NOT NULL` (weight_target, calorie_target, macro_target, meal_adherence, workout_frequency, streak_target)
      - `target_value text NOT NULL`
      - `current_value text`
      - `deadline date`
      - `status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected', 'completed'))`
      - `notes text`
      - `created_at timestamptz DEFAULT now()`
      - `updated_at timestamptz DEFAULT now()`
    - RLS: coach INSERT/UPDATE/DELETE, client can SELECT + UPDATE status
    - Function `check_coach_milestones()`: on body_measurements INSERT, user_streaks UPDATE — evaluate milestones and insert notifications
    - Milestone triggers:
      - Streak 7/14/30 days → notify coach
      - Weight loss -2kg, -5kg, goal reached → notify coach
      - Adherence <50% for 3+ consecutive days → notify coach
      - Missed meals 2+ consecutive days → notify coach
    - Add `coach_milestone` to notification_type enum

  **Must NOT do**:
  - Do NOT hardcode milestone thresholds — use configurable values
  - Do NOT duplicate existing meal_schedules data — use JOIN queries

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Table + trigger function, well-scoped
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: Complex trigger function

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-7)
  - **Blocks**: Tasks 12, 19

  **References**:
  - `supabase/migrations/20260528_coach_monetization.sql:89-138` — process_coach_subscription_renewal (complex PL/pgSQL function pattern)
  - `supabase/migrations/20260528_fix_coach_notifications_reply.sql:10` — ALTER TYPE pattern
  - `supabase/migrations/20260526000000_add_coach_portal.sql:70-80` — SECURITY DEFINER function pattern

  **Acceptance Criteria**:
  - [ ] Table `goal_proposals` exists
  - [ ] `check_coach_milestones()` function compiles and runs
  - [ ] Streak trigger: inserting user_streaks at 7 → notification created
  - [ ] Weight trigger: inserting body_measurements showing -2kg → notification created
  - [ ] Adherence trigger: 3+ days <50% adherence → notification created

  **QA Scenarios**:
  ```
  Scenario: Client hits 7-day streak → coach notified
    Tool: Bash (curl)
    Preconditions: Client with coach assignment, streak tracking active
    Steps:
      1. INSERT user_streaks with current_streak=7 for client
      2. Verify trigger fires — check notifications for coach_milestone type
      3. Verify notification message contains streak info
    Expected Result: Coach receives milestone notification
    Evidence: .omo/evidence/task-8-streak-notify.json

  Scenario: Client loses 2kg → coach notified
    Tool: Bash (curl)
    Preconditions: Previous weight entries, coach assignment active
    Steps:
      1. INSERT body_measurements with weight 2kg less than first entry
      2. Verify trigger evaluates weight change
      3. Check notifications for weight milestone
    Expected Result: Coach receives weight milestone notification
    Evidence: .omo/evidence/task-8-weight-notify.json
  ```

  **Commit**: YES
  - Message: `feat(coach): add goal proposals and milestone notification triggers`
  - Files: `supabase/migrations/YYYYMMDD_add_goal_proposals.sql`

- [ ] 9. Regenerate TypeScript types

  **What to do**:
  - Run `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`
  - Overwrite the existing types file with fresh types including all 7 new tables

  **Must NOT do**:
  - Do NOT manually edit types.ts — use Supabase CLI only
  - Do NOT skip this step — downstream tasks depend on correct types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single CLI command, no code changes

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (first task, sequential — must complete before Tasks 10-15)
  - **Blocks**: Tasks 10-15
  - **Blocked By**: Tasks 1-8

  **Acceptance Criteria**:
  - [ ] `src/integrations/supabase/types.ts` updated with new table types
  - [ ] Types include: `coach_notes`, `coach_withdrawal_requests`, `coach_chat_attachments`, `client_onboarding_responses`, `coach_programs`, `program_meals`, `program_exercises`, `coach_reviews`, `coach_sessions`, `goal_proposals`

  **QA Scenarios**:
  ```
  Scenario: TypeScript compilation passes with new types
    Tool: Bash (tmux)
    Preconditions: types.ts regenerated
    Steps:
      1. Run: npm run typecheck
      2. Verify exit code 0, no errors related to Supabase types
    Expected Result: TypeScript compiles cleanly
    Evidence: .omo/evidence/task-9-typecheck.txt
  ```

  **Commit**: YES
  - Message: `chore: regenerate Supabase types for new coach tables`
  - Files: `src/integrations/supabase/types.ts`

- [ ] 10. Client Notes — hook + UI in CoachClientDetail

  **What to do**:
  - Create `src/hooks/useCoachNotes.ts`:
    - `fetchNotes(coachId, clientId)` → Supabase SELECT from `coach_notes`
    - `addNote(coachId, clientId, note)` → INSERT
    - `updateNote(noteId, note)` → UPDATE
    - `deleteNote(noteId)` → DELETE
    - Return `{ notes, loading, addNote, updateNote, deleteNote }`
  - Add "Notes" section to `CoachClientDetail.tsx` below existing sections:
    - Section header: "Private Notes" with lock icon
    - Textarea for new note input
    - Chronological list of existing notes with timestamps
    - Edit/delete buttons on each note
    - Empty state: "No notes yet. Add private observations about this client."
    - Match existing card style (rounded-[24px], white bg, ring-1)

  **Must NOT do**:
  - Do NOT show notes on client-side views
  - Do NOT use `as any` or `@ts-ignore`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single hook + UI section in existing page
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: React hook + UI pattern matching

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 11-15)
  - **Blocked By**: Tasks 1, 9

  **References**:
  - `src/hooks/useCoachClients.ts` — Hook pattern (useState, useEffect, useCallback)
  - `src/pages/coach/CoachClientDetail.tsx:222-268` — Section UI pattern (motion.div, card styling)
  - `src/pages/coach/CoachClientDetail.tsx:396-407` — Modal integration pattern

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useCoachNotes.ts`
  - [ ] Notes section visible on `CoachClientDetail` page
  - [ ] Coach can add, edit, and delete notes
  - [ ] Notes display in chronological order with timestamps

  **QA Scenarios**:
  ```
  Scenario: Coach adds a note for a client
    Tool: Playwright
    Preconditions: Coach logged in, on /coach/client/:id page
    Steps:
      1. Navigate to client detail page
      2. Scroll to "Private Notes" section
      3. Type "Client prefers evening workouts" in the textarea
      4. Click Add Note button or press Enter
      5. Wait for note to appear in the notes list
      6. Assert: note text "Client prefers evening workouts" visible
      7. Take screenshot
    Expected Result: Note appears in chronological list with timestamp
    Failure Indicators: Note not visible, error toast, 401/403
    Evidence: .omo/evidence/task-10-add-note.png

  Scenario: Coach edits an existing note
    Tool: Playwright
    Preconditions: Note exists for client
    Steps:
      1. Click Edit button on existing note
      2. Modify text to "Prefers evening workouts - confirmed"
      3. Click Save
      4. Assert updated text visible in notes list
    Expected Result: Note text updated
    Evidence: .omo/evidence/task-10-edit-note.png

  Scenario: Coach deletes a note
    Tool: Playwright
    Preconditions: Note exists
    Steps:
      1. Click Delete button on note
      2. Confirm deletion in dialog
      3. Assert note removed from list
    Expected Result: Note deleted, removed from list
    Evidence: .omo/evidence/task-10-delete-note.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add private client notes with full CRUD`
  - Files: `src/hooks/useCoachNotes.ts`, `src/pages/coach/CoachClientDetail.tsx`

- [ ] 11. Earnings Withdrawal — hook + form in CoachEarningsPage

  **What to do**:
  - Create `src/hooks/useCoachWithdrawal.ts`:
    - `fetchWithdrawals(coachId)` → SELECT `coach_withdrawal_requests`
    - `requestWithdrawal(coachId, amount, bankName, iban, accountHolder)` → INSERT
    - Return `{ withdrawals, loading, requestWithdrawal }`
  - Add "Withdraw" section to `CoachEarningsPage.tsx`:
    - Show "Available: QAR X" with "Withdraw" button (disabled if 0)
    - Modal/form: bank name, IBAN, account holder name, amount (pre-filled with available, editable)
    - After submission: show confirmation with pending status
    - Below summary cards, add "Withdrawal History" list with status badges
    - Status colors: pending=amber, approved=blue, processed=green, rejected=red
    - Match existing card style

  **Must NOT do**:
  - Do NOT auto-submit — user must confirm
  - Do NOT allow withdrawal of more than available balance
  - Do NOT use Sadad for withdrawals (bank transfer only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI-heavy feature with form and modal
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: React form with validation, modal pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10, 12-15)
  - **Blocked By**: Tasks 2, 9

  **References**:
  - `src/pages/coach/CoachEarningsPage.tsx:1-177` — Page structure, stat cards, transaction history UI
  - `src/hooks/useCoachEarnings.ts` — Hook pattern (fetch + summary)
  - `src/components/coach/InviteClientModal.tsx` — Modal component pattern (Dialog + form)

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useCoachWithdrawal.ts`
  - [ ] "Withdraw" button visible on earnings page when available > 0
  - [ ] Form validates: IBAN format, required fields, amount ≤ available
  - [ ] Withdrawal history list shown on earnings page
  - [ ] Status badges with correct colors

  **QA Scenarios**:
  ```
  Scenario: Coach submits a withdrawal request
    Tool: Playwright
    Preconditions: Coach logged in, available balance > 0
    Steps:
      1. Navigate to /coach/earnings
      2. Click "Withdraw" button
      3. Fill form: bank="QNB", iban="QA12345678901234567890", holder="Ahmed Ali"
      4. Amount pre-filled with available balance — verify matches
      5. Click Submit
      6. Assert success toast "Withdrawal requested"
      7. Assert "Withdrawal History" section shows new pending request
    Expected Result: Withdrawal request created, visible in history
    Failure Indicators: Form validation errors, 400/401, no confirmation
    Evidence: .omo/evidence/task-11-withdraw.png

  Scenario: Withdraw more than available fails validation
    Tool: Playwright
    Preconditions: Available = 500 QAR
    Steps:
      1. Open withdraw form
      2. Enter amount: 1000
      3. Try to submit
      4. Assert validation error: "Cannot exceed available balance (500 QAR)"
    Expected Result: Form validation blocks over-withdrawal
    Evidence: .omo/evidence/task-11-over-amount.png

  Scenario: Empty state — no withdrawals yet
    Tool: Playwright
    Preconditions: Coach with 0 withdrawal history
    Steps:
      1. Navigate to /coach/earnings
      2. Verify "Withdrawal History" section shows empty state message
    Expected Result: Empty state shown
    Evidence: .omo/evidence/task-11-empty.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add earnings withdrawal with bank transfer form`
  - Files: `src/hooks/useCoachWithdrawal.ts`, `src/pages/coach/CoachEarningsPage.tsx`

- [ ] 12. Milestone Notifications — notifications display in Coach Dashboard

  **What to do**:
  - Create `src/hooks/useCoachNotifications.ts`:
    - Fetch `notifications` WHERE `user_id = coachId AND type = 'coach_milestone'`
    - `markAsRead(notificationId)` → UPDATE
    - Return `{ milestones, unreadCount, markAsRead }`
  - Add "Milestones" notification bell section to `CoachDashboard.tsx`:
    - Bell icon with unread count badge
    - Dropdown/list showing recent milestones
    - Each milestone shows: icon (streak=Flame, weight=TrendingDown, adherence=AlertCircle), title, message, time ago
    - Click to dismiss/mark read
    - Empty state: "No milestones yet"

  **Must NOT do**:
  - Do NOT change existing notification system behavior
  - Do NOT modify `notifications` table schema

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with notification dropdown
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: React component with state management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10-11, 13-15)
  - **Blocked By**: Tasks 8, 9

  **References**:
  - `src/pages/coach/CoachDashboard.tsx:172-225` — Pending requests alert section (similar notification pattern)
  - `src/hooks/useCoachClients.ts` — Hook pattern
  - `src/pages/coach/CoachDashboard.tsx:8` — Icon imports (Flame, AlertCircle, etc.)

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useCoachNotifications.ts`
  - [ ] Milestone bell visible on Coach Dashboard header
  - [ ] Unread count badge shows correct number
  - [ ] Milestone list displays streak, weight, and adherence notifications
  - [ ] Click to dismiss marks as read

  **QA Scenarios**:
  ```
  Scenario: Coach sees milestone notifications
    Tool: Playwright
    Preconditions: Coach logged in, milestone notifications exist (from DB trigger)
    Steps:
      1. Navigate to /coach
      2. Verify bell icon shows unread count badge
      3. Click bell icon
      4. Assert dropdown shows milestone items with correct icons
      5. Verify streak milestone shows Flame icon, weight shows TrendingDown
    Expected Result: Milestones visible with correct icons and messages
    Evidence: .omo/evidence/task-12-milestones.png

  Scenario: Mark milestone as read
    Tool: Playwright
    Preconditions: Unread milestones exist
    Steps:
      1. Click milestone notification
      2. Assert badge count decreases by 1
      3. Assert notification no longer highlighted
    Expected Result: Marked as read, count updated
    Evidence: .omo/evidence/task-12-mark-read.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add milestone notification display on dashboard`
  - Files: `src/hooks/useCoachNotifications.ts`, `src/pages/coach/CoachDashboard.tsx`

- [ ] 13. File Upload in Chat — hook + UI in CoachChatPage

  **What to do**:
  - Create `src/hooks/useCoachAttachments.ts`:
    - `uploadFile(coachId, clientId, file)`:
      - Upload to `coach-attachments` bucket at path `{coachId}/{clientId}/{timestamp}_{filename}`
      - INSERT `coach_chat_attachments` with file metadata
      - Send message with file URL reference
    - Return `{ uploading, uploadFile }`
  - Add attachment button to `CoachChatPage.tsx` chat input area:
    - Paperclip icon button next to text input
    - Hidden `<input type="file">` triggered on button click
    - Accept: images (png, jpg, gif, webp), documents (pdf, doc, docx), spreadsheets (xls, xlsx)
    - Max file size: 10MB
    - Upload progress indicator (loading spinner while uploading)
    - After upload: file appears as attachment card in chat bubble
    - Image files: show thumbnail preview inline
    - Other files: show file icon + name with download button

  **Must NOT do**:
  - Do NOT allow file uploads to exceed 10MB
  - Do NOT accept .exe, .sh, .bat, or other executable files
  - Do NOT change existing message bubble styles

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI-heavy chat enhancement with file handling
  - **Skills**: [`senior-frontend`, `supabase-postgres-best-practices`]
    - `senior-frontend`: React file upload + preview UI
    - `supabase-postgres-best-practices`: Supabase Storage upload pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10-12, 14-15)
  - **Blocked By**: Tasks 3, 9

  **References**:
  - `src/pages/coach/CoachChatPage.tsx:226-245` — Chat input area (message input + send button)
  - `src/hooks/useCoachMessages.ts` — Hook pattern with realtime subscription
  - `src/pages/coach/CoachChatPage.tsx:190-211` — Message bubble UI

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useCoachAttachments.ts`
  - [ ] Paperclip button visible in chat input area
  - [ ] File upload works for images (png, jpg) under 10MB
  - [ ] Image preview inline in chat bubble
  - [ ] Non-image files show download link
  - [ ] Executable files rejected with error message

  **QA Scenarios**:
  ```
  Scenario: Coach uploads an image in chat
    Tool: Playwright
    Preconditions: Coach logged in, active chat with client
    Steps:
      1. Navigate to /coach/chat, select client conversation
      2. Click paperclip button
      3. Select a .png file (<10MB)
      4. Wait for upload — verify spinner shows
      5. Assert: image thumbnail appears in chat bubble
      6. Assert: file message sent successfully
    Expected Result: Image uploaded and displayed as preview in chat
    Evidence: .omo/evidence/task-13-image-upload.png

  Scenario: Coach tries to upload executable file (rejected)
    Tool: Playwright
    Preconditions: Coach in chat with client
    Steps:
      1. Click paperclip button
      2. Select a .exe file
      3. Assert: error message "File type not allowed"
      4. Assert: no upload occurs
    Expected Result: Executable file rejected with clear error
    Evidence: .omo/evidence/task-13-reject-exe.png

  Scenario: File exceeds 10MB limit
    Tool: Playwright
    Preconditions: Large file >10MB available
    Steps:
      1. Select file >10MB
      2. Assert validation error before upload starts
    Expected Result: File blocked by client-side validation
    Evidence: .omo/evidence/task-13-size-limit.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add file/image sharing in coach chat`
  - Files: `src/hooks/useCoachAttachments.ts`, `src/pages/coach/CoachChatPage.tsx`

- [ ] 14. Client Onboarding — hook + form page

  **What to do**:
  - Create `src/hooks/useClientOnboarding.ts`:
    - `fetchOnboarding(clientId, coachId)` → SELECT from `client_onboarding_responses`
    - `submitOnboarding(clientId, coachId, data)` → UPSERT (INSERT … ON CONFLICT UPDATE)
    - Return `{ onboarding, loading, submitOnboarding }`
  - Create client-side page `src/pages/nutrio/CoachOnboarding.tsx`:
    - Route: `/nutrio/coach-onboarding?coachId=X`
    - Form fields:
      - Health goal (select: weight_loss, muscle_gain, maintenance, general_health) — required
      - Current weight (number input, kg) — required
      - Target weight (number input, kg)
      - Activity level (select: sedentary, light, moderate, active, very_active)
      - Dietary preferences (select: omnivore, vegetarian, vegan, keto, paleo, mediterranean)
      - Allergies/restrictions (textarea)
      - Medical conditions (textarea)
      - Coaching expectations (textarea)
    - If already submitted: show "✅ Submitted" with edit option
    - Submit button: "Share with Coach"
    - Match existing Nutrio page styling
  - Auto-redirect after first coach connection: if `coach_client_assignments` status = 'active' AND no onboarding exists → redirect to `/nutrio/coach-onboarding`

  **Must NOT do**:
  - Do NOT require all fields — only health_goal and current_weight required
  - Do NOT show onboarding on coach side (client-only form)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Client-side form page with multiple field types
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Form validation, select/textarea inputs

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10-13, 15)
  - **Blocked By**: Tasks 4, 9

  **References**:
  - `src/pages/coach/ApplyCoach.tsx` — Form page pattern for multi-field submission
  - `src/hooks/useCoachSubscription.ts` — Client-side hook pattern
  - `src/pages/coach/CoachSettings.tsx` — Form layout with selects and textareas

  **Acceptance Criteria**:
  - [ ] Page created: `/nutrio/coach-onboarding`
  - [ ] Hook file created: `src/hooks/useClientOnboarding.ts`
  - [ ] Form validates: health_goal and current_weight required
  - [ ] UPSERT works: resubmitting updates existing record
  - [ ] Coach receives notification on submission

  **QA Scenarios**:
  ```
  Scenario: Client fills onboarding after connecting to coach
    Tool: Playwright
    Preconditions: Client authenticated, just connected to coach (active assignment, no onboarding yet)
    Steps:
      1. Navigate to /nutrio/coach-onboarding?coachId=X
      2. Select "Weight Loss" as health goal
      3. Enter current weight: 85
      4. Enter target weight: 75
      5. Select "Moderate" activity level
      6. Select "Omnivore" dietary preference
      7. Click "Share with Coach"
      8. Assert: success toast "Information shared with your coach"
      9. Assert: form shows "✅ Submitted" state
    Expected Result: Form submitted, coach notified
    Evidence: .omo/evidence/task-14-onboarding-submit.png

  Scenario: Required fields validation
    Tool: Playwright
    Preconditions: On onboarding form
    Steps:
      1. Leave health_goal empty
      2. Click Submit
      3. Assert: validation error "Please select a health goal"
    Expected Result: Required field validation works
    Evidence: .omo/evidence/task-14-validation.png

  Scenario: Already submitted — shows submitted state
    Tool: Playwright
    Preconditions: Onboarding already submitted for this coach
    Steps:
      1. Navigate to /nutrio/coach-onboarding?coachId=X
      2. Assert: "✅ Submitted" shown
      3. Assert: "Edit" button available
    Expected Result: Submitted state shown
    Evidence: .omo/evidence/task-14-already-submitted.png
  ```

  **Commit**: YES
  - Message: `feat(client): add coach onboarding questionnaire`
  - Files: `src/hooks/useClientOnboarding.ts`, `src/pages/nutrio/CoachOnboarding.tsx`

- [ ] 15. Bulk Messaging — UI in CoachChatPage

  **What to do**:
  - Add "Message All" button to `CoachChatPage.tsx` conversation list header
  - Bulk message modal:
    - Textarea for message content
    - Recipient list: shows all active clients with checkboxes (all checked by default)
    - "Select All" / "Deselect All" toggle
    - Client count: "Sending to 12 clients"
    - Send button (disabled if message empty or 0 clients selected)
  - `sendBulkMessage(message, clientIds[])`:
    - Loop insert `coach_messages` for each client
    - Use `Promise.all` for parallel inserts
    - Show progress: "Sending... (5/12)"

  **Must NOT do**:
  - Do NOT send to pending/revoked clients — only active
  - Do NOT spam — minimum 30s between bulk sends (client-side throttle)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with multi-select + progress tracking
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Modal form with dynamic list

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10-14)
  - **Blocked By**: Task 9

  **References**:
  - `src/pages/coach/CoachChatPage.tsx:56-143` — Conversation list layout
  - `src/components/coach/InviteClientModal.tsx` — Modal pattern
  - `src/hooks/useCoachMessages.ts:121-137` — sendMessage function pattern

  **Acceptance Criteria**:
  - [ ] "Message All" button visible in chat page header
  - [ ] Modal shows all active clients with checkboxes
  - [ ] Send creates individual messages for each selected client
  - [ ] Progress indicator works during sending
  - [ ] Empty message validation

  **QA Scenarios**:
  ```
  Scenario: Coach sends bulk message to all active clients
    Tool: Playwright
    Preconditions: Coach logged in, 3+ active clients
    Steps:
      1. Navigate to /coach/chat
      2. Click "Message All" button
      3. Assert modal shows all active clients checked
      4. Type message: "Reminder: check your meal plan for tomorrow!"
      5. Click Send
      6. Assert progress indicator: "Sending... (3/3)"
      7. Assert success toast: "Message sent to 3 clients"
      8. Check conversation with client 1 — assert message visible
    Expected Result: All clients receive the message
    Evidence: .omo/evidence/task-15-bulk-send.png

  Scenario: Bulk message with empty text rejected
    Tool: Playwright
    Preconditions: Bulk message modal open
    Steps:
      1. Click Send with empty message
      2. Assert button disabled
      3. Type message, Delete it → button re-disables
    Expected Result: Empty message blocked
    Evidence: .omo/evidence/task-15-empty-message.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add bulk messaging to all active clients`
  - Files: `src/pages/coach/CoachChatPage.tsx`

- [ ] 16. Payment/Subscription Checkout — Sadad integration for client

  **What to do**:
  - Create client page `src/pages/nutrio/CoachSubscription.tsx`:
    - Route: `/nutrio/coach-subscription?coachId=X`
    - Shows: coach name, avatar, pricing (weekly/monthly), coach rating, number of active clients
    - Plan selector: Weekly (QAR X) / Monthly (QAR Y)
    - "Subscribe" button → triggers Sadad payment
    - Payment flow:
      1. `useCoachSubscription.subscribe(plan, 'sadad')`
      2. Show "Redirecting to Sadad..." with loading state
      3. Redirect to Sadad payment URL
    - Post-payment: handle success/failure callback URLs
    - Already subscribed: show current plan with cancel option
  - Integrate with existing `src/lib/sadad.ts` for payment initiation
  - Wire up `useCoachSubscription` hook (already exists) — add Sadad payment method
  - Update `useCoachSubscription.subscribe()` to accept payment_method='sadad'

  **Must NOT do**:
  - Do NOT bypass Sadad — use the existing service
  - Do NOT allow duplicate active subscriptions (UNIQUE constraint already exists)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Payment checkout UI page
  - **Skills**: [`senior-frontend`, `API Integration Specialist`]
    - `senior-frontend`: Checkout page design
    - `API Integration Specialist`: Sadad payment flow integration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 17-22)
  - **Blocked By**: Task 9

  **References**:
  - `src/lib/sadad.ts:94-119` — initiateSadadPayment function (existing Sadad flow)
  - `src/hooks/useCoachSubscription.ts` — Existing subscription hook (subscribe, cancelSubscription)
  - `src/hooks/useCoachSubscription.ts:64-100` — subscribe function pattern

  **Acceptance Criteria**:
  - [ ] Page created: `/nutrio/coach-subscription?coachId=X`
  - [ ] Plan selector shows correct prices from coach_pricing
  - [ ] Subscribe button triggers Sadad payment flow
  - [ ] Success callback creates coach_subscriptions record
  - [ ] Already subscribed shows current plan + cancel button

  **QA Scenarios**:
  ```
  Scenario: Client subscribes to coach via Sadad
    Tool: Playwright
    Preconditions: Client logged in, no existing subscription, coach has pricing set
    Steps:
      1. Navigate to /nutrio/coach-subscription?coachId=X
      2. Assert coach name, avatar, pricing visible
      3. Select "Monthly" plan
      4. Click "Subscribe" button
      5. Assert redirect to Sadad payment URL (or loading state)
    Expected Result: Payment flow initiated, subscription record created on success
    Evidence: .omo/evidence/task-16-subscribe.png

  Scenario: Already subscribed — shows current plan
    Tool: Playwright
    Preconditions: Client has active subscription for this coach
    Steps:
      1. Navigate to /nutrio/coach-subscription?coachId=X
      2. Assert: "Current Plan: Monthly (QAR X)" visible
      3. Assert: "Cancel Subscription" button visible
    Expected Result: Shows existing subscription with cancel option
    Evidence: .omo/evidence/task-16-already-subscribed.png
  ```

  **Commit**: YES
  - Message: `feat(client): add coach subscription checkout with Sadad payment`
  - Files: `src/pages/nutrio/CoachSubscription.tsx`, `src/hooks/useCoachSubscription.ts`

- [ ] 17. Body Measurements Enhancement — CoachClientDetail + photo tracking

  **What to do**:
  - Enhance `CoachClientDetail.tsx`:
    - Add "Body Measurements" section below weight trend
    - Show latest values: body_fat_percent, waist_cm, hip_cm (from existing `body_measurements` table)
    - Add trend sparkline for each metric over last 7 days
    - Add "Photo Progress" subsection:
      - Upload via existing avatars bucket or new `coach-photos` folder
      - Display photos in date-ordered grid with thumbnails
      - Click to view full-size
      - Date label on each photo
      - "Upload Photo" button opens file picker
  - Create `src/hooks/useBodyMeasurements.ts`:
    - `fetchMeasurements(clientId, days=7)` → SELECT from `body_measurements`
    - `uploadPhoto(clientId, file)` → Upload to storage, INSERT photo record
    - Return `{ measurements, photos, loading, uploadPhoto }`

  **Must NOT do**:
  - Do NOT create a new table for measurements — use existing `body_measurements`
  - Do NOT show photos in client list view (only in detail)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Data visualization + photo gallery
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Chart/sparkline + image upload

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16, 18-22)
  - **Blocked By**: Task 9

  **References**:
  - `src/pages/coach/CoachClientDetail.tsx:299-334` — Weight trend section (similar data viz pattern)
  - `src/pages/coach/CoachClientDetail.tsx:66-162` — fetchClientData function (existing measurements query)
  - `src/hooks/useCoachClients.ts` — Hook pattern

  **Acceptance Criteria**:
  - [ ] Body measurements section on Client Detail page
  - [ ] Shows body_fat_percent, waist_cm, hip_cm with latest values
  - [ ] Trend sparklines show 7-day changes
  - [ ] Photo upload works with Supabase Storage
  - [ ] Photo grid shows chronological thumbnails

  **QA Scenarios**:
  ```
  Scenario: Coach views body measurements on client detail
    Tool: Playwright
    Preconditions: Coach logged in, client has body measurement entries
    Steps:
      1. Navigate to /coach/client/:id
      2. Scroll to "Body Measurements" section
      3. Assert: body fat %, waist, hip values visible
      4. Assert: sparkline trends show direction (up/down arrows)
    Expected Result: Measurements displayed with trends
    Evidence: .omo/evidence/task-17-measurements.png

  Scenario: Coach uploads progress photo
    Tool: Playwright
    Preconditions: On client detail page
    Steps:
      1. Click "Upload Photo" button
      2. Select an image file
      3. Assert: photo appears in grid with date label
      4. Click photo thumbnail → full-size view opens
    Expected Result: Photo uploaded and visible in gallery
    Evidence: .omo/evidence/task-17-photo-upload.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add body measurements and photo progress tracking`
  - Files: `src/pages/coach/CoachClientDetail.tsx`, `src/hooks/useBodyMeasurements.ts`

- [ ] 18. Coach Reviews — form + directory display

  **What to do**:
  - Create `src/hooks/useCoachReviews.ts`:
    - `fetchReviews(coachId)` → SELECT from `coach_reviews` + `coach_rating_summary`
    - `submitReview(coachId, clientId, rating, reviewText)` → INSERT
    - Return `{ reviews, summary, loading, submitReview }`
  - Add review form to client-side `CoachesDirectory` page (`/nutrio/coaches`):
    - Star rating selector (1-5, clickable stars)
    - Textarea for review text
    - Submit button
    - "You've already reviewed this coach" state if review exists
    - Can only review if past or active assignment exists
  - Add review display on `CoachesDirectory`:
    - Below each coach card: average rating (stars + numeric)
    - Total review count
    - Expand to show individual reviews with client names

  **Must NOT do**:
  - Do NOT allow self-reviews (coach reviewing themselves)
  - Do NOT allow reviews without assignment

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Star rating UI + form integration
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Interactive star rating component

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-17, 19-22)
  - **Blocked By**: Tasks 6, 9

  **References**:
  - `src/hooks/useCoachSubscription.ts` — Client-side hook pattern
  - `src/hooks/useCoachEarnings.ts:76-91` — Profile lookup pattern (fetching profiles for client names)
  - Coach directory page: check for existing coach listing components

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useCoachReviews.ts`
  - [ ] Star rating selector works (clickable, highlight on hover)
  - [ ] Review form submits to `coach_reviews`
  - [ ] "Already reviewed" state prevents duplicate submission
  - [ ] Coach directory shows average rating and count

  **QA Scenarios**:
  ```
  Scenario: Client submits a review
    Tool: Playwright
    Preconditions: Client logged in, has completed coach subscription
    Steps:
      1. Navigate to /nutrio/coaches
      2. Find connected coach card
      3. Click stars to set 4-star rating
      4. Type review: "Really helped with my nutrition goals"
      5. Click Submit
      6. Assert: success toast
      7. Assert: coach card shows 4.0 rating (or updated average)
    Expected Result: Review submitted, rating displayed
    Evidence: .omo/evidence/task-18-review-submit.png

  Scenario: Duplicate review blocked
    Tool: Playwright
    Preconditions: Client already reviewed this coach
    Steps:
      1. Navigate to coach directory
      2. Assert: "✅ You've reviewed this coach" text visible
      3. Assert: star selector disabled or hidden
    Expected Result: Cannot submit second review
    Evidence: .omo/evidence/task-18-duplicate-blocked.png
  ```

  **Commit**: YES
  - Message: `feat(client): add coach review submission with star ratings`
  - Files: `src/hooks/useCoachReviews.ts`, coach directory page

- [ ] 19. Goal Proposals — hook + propose/accept flow

  **What to do**:
  - Create `src/hooks/useGoalProposals.ts`:
    - `fetchProposals(coachId, clientId?)` → SELECT from `goal_proposals`
    - `proposeGoal(coachId, clientId, goal)` → INSERT with status='proposed'
    - `acceptGoal(proposalId)` → UPDATE status='accepted'
    - `rejectGoal(proposalId)` → UPDATE status='rejected'
    - `completeGoal(proposalId)` → UPDATE status='completed'
    - Return `{ proposals, loading, proposeGoal, acceptGoal, rejectGoal, completeGoal }`
  - Add "Goals" section to `CoachClientDetail.tsx`:
    - "Propose New Goal" button → opens modal with goal_type select, target value, deadline
    - List of existing proposals with status badges (proposed=amber, accepted=blue, rejected=red, completed=green)
    - Coach can complete/mark goals as done
  - Add client-side goals display:
    - On client profile or dedicated section: see coach proposals
    - "Accept" / "Reject" buttons for proposed goals
    - "Mark Complete" for accepted goals
  - On goal acceptance: coach gets notification `coach_goal_accepted`

  **Must NOT do**:
  - Do NOT allow client to create proposals (coach-only)
  - Do NOT allow coach to accept/reject on behalf of client

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: CRUD hook + UI with status workflow
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Status workflow UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-18, 20-22)
  - **Blocked By**: Tasks 8, 9

  **References**:
  - `src/pages/coach/CoachClientDetail.tsx:222-268` — Section card pattern
  - `src/hooks/useCoachClients.ts:69-83` — handleAccept pattern (status update)
  - `src/pages/coach/CoachDashboard.tsx:172-225` — Status-based UI with badges

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useGoalProposals.ts`
  - [ ] "Propose New Goal" button on Client Detail page
  - [ ] Goal proposal modal with goal_type select, target, deadline
  - [ ] Client can accept/reject proposals
  - [ ] Coach can complete goals
  - [ ] Status badges in correct colors

  **QA Scenarios**:
  ```
  Scenario: Coach proposes a weight goal for client
    Tool: Playwright
    Preconditions: Coach on client detail page
    Steps:
      1. Click "Propose New Goal"
      2. Select goal_type: "Weight Target"
      3. Enter target: "75 kg"
      4. Set deadline to 30 days from now
      5. Click Submit
      6. Assert: proposal appears in goals list with amber "Proposed" badge
    Expected Result: Proposal created and visible
    Evidence: .omo/evidence/task-19-propose-goal.png

  Scenario: Client accepts a proposed goal
    Tool: Playwright
    Preconditions: Client logged in, proposal exists
    Steps:
      1. Navigate to goals section (client side)
      2. Find proposed goal
      3. Click "Accept"
      4. Assert: status changes to blue "Accepted" badge
    Expected Result: Goal accepted, coach notified
    Evidence: .omo/evidence/task-19-accept-goal.png

  Scenario: Client rejects a proposed goal
    Tool: Playwright
    Preconditions: Proposal exists
    Steps:
      1. Click "Reject"
      2. Assert: status changes to red "Rejected"
    Expected Result: Goal rejected
    Evidence: .omo/evidence/task-19-reject-goal.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add collaborative goal proposal and acceptance workflow`
  - Files: `src/hooks/useGoalProposals.ts`, `src/pages/coach/CoachClientDetail.tsx`

- [ ] 20. Meal Plan Builder — program assignment UI for coaches

  **What to do**:
  - Create `src/hooks/useCoachPrograms.ts`:
    - `fetchPrograms(coachId, clientId, type?)` → SELECT `coach_programs` + JOIN `program_meals`
    - `createProgram(coachId, clientId, data)` → INSERT program
    - `assignMeal(programId, mealId, date, type)` → INSERT `program_meals`
    - `removeMeal(programMealId)` → DELETE
    - Return `{ programs, loading, createProgram, assignMeal, removeMeal }`
  - Add "Meal Plans" tab/section to `CoachClientDetail.tsx`:
    - "Create Meal Plan" button → modal: title, description, start/end dates
    - After creation: meal assignment interface
      - Day-by-day view with date headers
      - "+ Add Meal" button per day → search meals, select, assign meal_type
      - Draggable meals between days (or manual reassign)
      - Calories/macros summary per day
      - Total vs target comparison
    - Active plan shows progress: X/Y meals followed

  **Must NOT do**:
  - Do NOT change meal_schedules table — program_meals is separate
  - Do NOT implement drag-and-drop if too complex — use dropdown assignment

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex UI with calendar-like meal assignment
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Multi-step form with assignment logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-19, 21-22)
  - **Blocked By**: Tasks 5, 9

  **References**:
  - `src/pages/coach/CoachClientDetail.tsx:222-268` — Macro targets section (calorie/target display)
  - `src/pages/coach/CoachClientDetail.tsx:337-377` — Scheduled meals list
  - `src/hooks/useCoachClients.ts` — Hook pattern

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useCoachPrograms.ts`
  - [ ] "Create Meal Plan" flow: title, dates → program created
  - [ ] Meal assignment: search + select meals, assign to dates
  - [ ] Daily calorie/macro summary per assigned meal day
  - [ ] Active plan progress indicator

  **QA Scenarios**:
  ```
  Scenario: Coach creates a weekly meal plan
    Tool: Playwright
    Preconditions: Coach logged in, on client detail page
    Steps:
      1. Click "Create Meal Plan"
      2. Enter title: "Week 1 - Foundation"
      3. Set start/end dates (7 days apart)
      4. Click Create
      5. Assert: meal plan created, meal assignment interface shown
      6. Click "+ Add Meal" on Day 1
      7. Search for "Grilled Chicken"
      8. Select meal, choose "Lunch"
      9. Assert: meal appears on Day 1 with calories/macros
    Expected Result: Plan created with assigned meals
    Evidence: .omo/evidence/task-20-meal-plan.png

  Scenario: Coach removes a meal from plan
    Tool: Playwright
    Preconditions: Meal assigned to day
    Steps:
      1. Click remove (X) button on assigned meal
      2. Confirm deletion
      3. Assert: meal removed from day view
    Expected Result: Meal removed from plan
    Evidence: .omo/evidence/task-20-remove-meal.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add meal plan builder with day-by-day assignment`
  - Files: `src/hooks/useCoachPrograms.ts`, `src/pages/coach/CoachClientDetail.tsx`

- [ ] 21. Workout Plan Builder — exercise form + client view

  **What to do**:
  - Extend `useCoachPrograms.ts` with workout-specific functions:
    - `assignExercise(programId, exercise)` → INSERT `program_exercises`
    - `removeExercise(programExerciseId)` → DELETE
    - `reorderExercises(programId, exerciseIds[])` → UPDATE order_index
  - Add "Workout Plans" section to `CoachClientDetail.tsx`:
    - Similar to meal plan UI but for workouts
    - "Create Workout Plan" → same program creation, type='workout_plan'
    - Exercise assignment form:
      - Exercise name (text input)
      - Sets (number input)
      - Reps (text input — "12-15" or "AMRAP")
      - Rest (seconds, default 60)
      - Notes (optional)
      - Day number + order within day
    - Day-by-day workout view: Day 1 → chest/triceps, Day 2 → back/biceps, etc.
    - Drag to reorder exercises within a day

  **Must NOT do**:
  - Do NOT build an exercise library — free-text names only
  - Do NOT build video/gif support in this task

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Form-heavy UI with day-by-day organization
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Multi-field form with list management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-20, 22)
  - **Blocked By**: Tasks 5, 9

  **References**:
  - `src/pages/coach/CoachClientDetail.tsx:222-268` — Card section pattern
  - `src/hooks/useCoachPrograms.ts` — (created in Task 20) — extend same hook
  - Task 20 meal plan UI — similar day-by-day pattern

  **Acceptance Criteria**:
  - [ ] Workout plan creation UI (similar to meal plan)
  - [ ] Exercise assignment: name, sets, reps, rest, day, order
  - [ ] Day-by-day workout view
  - [ ] Reorder exercises within day

  **QA Scenarios**:
  ```
  Scenario: Coach creates a workout plan with exercises
    Tool: Playwright
    Preconditions: Coach on client detail page
    Steps:
      1. Create workout plan: "Week 1 - Push/Pull Split"
      2. Add exercise: "Bench Press", 4 sets, "8-10" reps, rest 90s, Day 1, order 1
      3. Add exercise: "Incline DB Press", 3 sets, "12" reps, rest 60s, Day 1, order 2
      4. Add exercise: "Deadlift", 4 sets, "5" reps, rest 120s, Day 2, order 1
      5. Assert: Day 1 shows 2 exercises, Day 2 shows 1 exercise
    Expected Result: Workout plan created with organized exercises
    Evidence: .omo/evidence/task-21-workout-plan.png

  Scenario: Client views assigned workout plan
    Tool: Playwright
    Preconditions: Client logged in, workout plan assigned
    Steps:
      1. Navigate to client-side programs page
      2. Assert: workout plan visible with exercises organized by day
      3. Verify: sets, reps, rest times displayed
    Expected Result: Client can view and follow workout plan
    Evidence: .omo/evidence/task-21-client-view.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add workout plan builder with exercise assignment`
  - Files: `src/hooks/useCoachPrograms.ts`, `src/pages/coach/CoachClientDetail.tsx`

- [ ] 22. Coach Availability Signal — directory component enhancement

  **What to do**:
  - Enhance Coaches Directory page (`/nutrio/coaches`):
    - Show on each coach card:
      - "Accepting new clients" badge (green=yes, grey=no) — from `coach_pricing.is_active`
      - Active client count: query `COUNT(coach_client_assignments WHERE status='active')`
      - Typical response time: calculate from `coach_messages` (avg time between client message and coach reply)
      - "Quick responder" badge if avg response < 2 hours
    - Create `src/hooks/useCoachAvailability.ts`:
      - `fetchAvailability(coachId)` → returns isAccepting, activeClientCount, avgResponseTime
      - Return `{ availability, loading }`
  - Ensure "Accepting New Clients" toggle in `CoachSettings.tsx` already exists and updates `coach_pricing.is_active`

  **Must NOT do**:
  - Do NOT show exact client count if coach prefers privacy — just show "5+" or ranges

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Hook + data display on existing page
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Directory component enhancement

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-21)
  - **Blocked By**: Task 9

  **References**:
  - Coach directory page: existing listing component
  - `src/hooks/useCoachSubscription.ts:28-62` — fetchPricing pattern (coach info lookup)
  - `src/hooks/useCoachClients.ts:98-234` — Client count aggregation pattern

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useCoachAvailability.ts`
  - [ ] Coach cards show "Accepting clients" badge
  - [ ] Active client count displayed (ranges: "1-5", "5-10", "10+")
  - [ ] Response time indicator visible

  **QA Scenarios**:
  ```
  Scenario: Coach directory shows availability signals
    Tool: Playwright
    Preconditions: Client logged in, coaches exist with data
    Steps:
      1. Navigate to /nutrio/coaches
      2. Assert: each coach card shows "Accepting New Clients" or "Not Accepting"
      3. Assert: active client count visible (e.g., "5-10 active clients")
      4. Assert: response time badge for fast responders
    Expected Result: Availability signals visible on all coach cards
    Evidence: .omo/evidence/task-22-availability.png
  ```

  **Commit**: YES
  - Message: `feat(client): add coach availability signals to directory`
  - Files: `src/hooks/useCoachAvailability.ts`, coach directory page

- [ ] 23. Scheduling Calendar — in-app calendar for coaches

  **What to do**:
  - Create `src/hooks/useCoachSessions.ts`:
    - `fetchSessions(coachId, range)` → SELECT `coach_sessions` for date range
    - `createSession(coachId, clientId, data)` → INSERT
    - `updateSession(sessionId, data)` → UPDATE
    - `cancelSession(sessionId)` → UPDATE status='cancelled'
    - Return `{ sessions, loading, createSession, updateSession, cancelSession }`
  - Add "Schedule" tab/page at `/coach/schedule`:
    - Calendar view (weekly or monthly toggle)
    - Each day shows scheduled sessions as colored blocks
    - Click day → modal to create new session:
      - Select client (dropdown of active clients)
      - Title, description
      - Date/time picker
      - Duration (15/30/45/60 min)
      - Session type (video_call, in_person, phone_call, check_in)
    - Click existing session → view/edit/cancel
    - Color-code by status: scheduled=blue, confirmed=green, cancelled=red, completed=grey
    - Upcoming sessions list below calendar

  **Must NOT do**:
  - Do NOT implement Google/Apple calendar sync (defer)
  - Do NOT use a heavy calendar library — simple weekly grid is sufficient

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Calendar UI with CRUD operations
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Custom calendar component

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 24-27)
  - **Blocked By**: Tasks 7, 9

  **References**:
  - `src/pages/coach/CoachClientDetail.tsx:270-296` — 7-day view pattern (similar week display)
  - `src/pages/coach/CoachDashboard.tsx` — Coach tab page structure
  - `src/hooks/useCoachClients.ts` — Hook pattern

  **Acceptance Criteria**:
  - [ ] Hook file created: `src/hooks/useCoachSessions.ts`
  - [ ] `/coach/schedule` page with calendar view
  - [ ] Create session: client select, date/time, duration, type
  - [ ] Edit and cancel existing sessions
  - [ ] Status-based color coding

  **QA Scenarios**:
  ```
  Scenario: Coach schedules a session with a client
    Tool: Playwright
    Preconditions: Coach logged in, active clients exist
    Steps:
      1. Navigate to /coach/schedule
      2. Click on a date in calendar
      3. Fill session form: select client, title="Weekly Check-in", time, duration=30min, type=video_call
      4. Click Create
      5. Assert: session appears on calendar as blue block on selected date
      6. Assert: session appears in upcoming sessions list
    Expected Result: Session created and visible on calendar
    Evidence: .omo/evidence/task-23-schedule-session.png

  Scenario: Coach cancels a scheduled session
    Tool: Playwright
    Preconditions: Scheduled session exists
    Steps:
      1. Click on existing session in calendar
      2. Click "Cancel Session"
      3. Confirm cancellation
      4. Assert: session turns red with "Cancelled" status
    Expected Result: Session cancelled, status updated
    Evidence: .omo/evidence/task-23-cancel-session.png
  ```

  **Commit**: YES
  - Message: `feat(coach): add scheduling calendar with session management`
  - Files: `src/hooks/useCoachSessions.ts`, `src/pages/coach/CoachSchedule.tsx`

- [ ] 24. PDF Export — comprehensive progress report generator

  **What to do**:
  - Create Supabase Edge Function `generate-coach-report`:
    - Accept `{ clientId, coachId, startDate, endDate }`
    - Query: profiles, body_measurements, meal_schedules (adherence), user_streaks, coach_notes, goal_proposals
    - Generate PDF with:
      - Page 1: Cover — client name, date range, coach name
      - Page 2: Summary — weight change, current weight, overall adherence %, current streak
      - Page 3: Weight chart (table-based, not image)
      - Page 4: Meal adherence breakdown (day-by-day table)
      - Page 5: Macro hit rate, measurements table, active goals
      - Footer: generated date, coach notes summary
    - Use a simple HTML-to-PDF approach (Deno-compatible library or HTML template)
    - Return PDF as base64 or download URL
  - Add "Export Report" button to `CoachClientDetail.tsx`:
    - Date range picker (default: last 30 days)
    - "Generate PDF" button
    - Download triggered on response
  - Create `src/hooks/useCoachReport.ts`:
    - `generateReport(clientId, startDate, endDate)` → calls edge function
    - Return `{ generating, generateReport }`

  **Must NOT do**:
  - Do NOT generate PDF client-side — use edge function for consistency
  - Do NOT use heavy PDF library — simple HTML table rendering is sufficient

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Edge function + download button
  - **Skills**: [`supabase-postgres-best-practices`]
    - `supabase-postgres-best-practices`: Edge function pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 23, 25-27)
  - **Blocked By**: Task 9

  **References**:
  - `src/lib/sadad.ts:41` — `supabase.functions.invoke()` pattern
  - `src/pages/coach/CoachClientDetail.tsx:222-268` — Export button placement (near header)
  - Edge function pattern: check existing `supabase/functions/` directory for examples

  **Acceptance Criteria**:
  - [ ] Edge function `generate-coach-report` deployed
  - [ ] "Export Report" button on Client Detail page
  - [ ] Date range picker works
  - [ ] PDF downloads with correct data
  - [ ] PDF contains weight chart, adherence, measurements, goals

  **QA Scenarios**:
  ```
  Scenario: Coach exports a client progress report
    Tool: Playwright
    Preconditions: Coach on client detail page, client has data
    Steps:
      1. Click "Export Report" button
      2. Assert: date range picker shown (default last 30 days)
      3. Click "Generate PDF"
      4. Assert: loading state while generating
      5. Assert: PDF download triggered
      6. Open downloaded PDF — verify pages and data
    Expected Result: PDF generated with comprehensive data
    Failure Indicators: Edge function error, empty PDF, missing data
    Evidence: .omo/evidence/task-24-report.pdf
  ```

  **Commit**: YES
  - Message: `feat(coach): add PDF progress report export`
  - Files: `supabase/functions/generate-coach-report/`, `src/hooks/useCoachReport.ts`, `src/pages/coach/CoachClientDetail.tsx`

- [ ] 25. Program Client View — client-side meal/workout program display

  **What to do**:
  - Create client page `src/pages/nutrio/CoachPrograms.tsx`:
    - Route: `/nutrio/coach-programs`
    - Shows all active programs (meal plans + workout plans) from connected coach
    - Meal plan view:
      - Day-by-day breakdown with assigned meals
      - Calorie/macro totals per day
      - Mark meals as completed
      - Progress bar: X/Y meals completed this week
    - Workout plan view:
      - Day-by-day exercises with sets, reps, rest
      - Mark exercises as completed
      - Progress: X/Y workouts completed this week
    - Empty state: "No programs assigned yet. Your coach will create programs for you."

  **Must NOT do**:
  - Do NOT allow client to edit program content
  - Do NOT show completed dates — just completion checkboxes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Client-facing program display page
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Program display with completion tracking

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 23-24, 26-27)
  - **Blocked By**: Tasks 5, 9, 20, 21

  **References**:
  - `src/pages/coach/CoachClientDetail.tsx:337-377` — Scheduled meals list (similar display)
  - `src/hooks/useCoachSubscription.ts` — Client-side hook pattern
  - `src/pages/coach/CoachClientDetail.tsx:270-296` — 7-day adherence view (similar week layout)

  **Acceptance Criteria**:
  - [ ] Page created: `/nutrio/coach-programs`
  - [ ] Meal plan view with day-by-day meals
  - [ ] Workout plan view with day-by-day exercises
  - [ ] Completion checkboxes work
  - [ ] Progress bars show weekly completion

  **QA Scenarios**:
  ```
  Scenario: Client views assigned meal plan
    Tool: Playwright
    Preconditions: Client logged in, meal plan assigned by coach
    Steps:
      1. Navigate to /nutrio/coach-programs
      2. Assert: meal plan visible with day-by-day meals
      3. Assert: calorie/macro totals shown per day
      4. Click checkbox to mark Monday's lunch as completed
      5. Assert: progress bar updated
    Expected Result: Meal plan visible and interactive
    Evidence: .omo/evidence/task-25-meal-program.png

  Scenario: Client views assigned workout plan
    Tool: Playwright
    Preconditions: Workout plan assigned
    Steps:
      1. Navigate to /nutrio/coach-programs
      2. Switch to workout plan tab
      3. Assert: exercises listed by day with sets/reps
      4. Mark Day 1 workout complete
      5. Assert progress bar updates
    Expected Result: Workout plan visible with completion tracking
    Evidence: .omo/evidence/task-25-workout-program.png

  Scenario: Empty state — no programs
    Tool: Playwright
    Preconditions: Client with no assigned programs
    Steps:
      1. Navigate to /nutrio/coach-programs
      2. Assert: empty state message visible
    Expected Result: Clear message about no programs
    Evidence: .omo/evidence/task-25-empty.png
  ```

  **Commit**: YES
  - Message: `feat(client): add program view for meal and workout plans`
  - Files: `src/pages/nutrio/CoachPrograms.tsx`

- [ ] 26. Scheduling Client Booking — client-side session view and booking

  **What to do**:
  - Create client page `src/pages/nutrio/CoachSchedule.tsx`:
    - Route: `/nutrio/coach-schedule`
    - Shows scheduled sessions from coach (read-only calendar view)
    - Upcoming sessions list with: title, date/time, type, status
    - "Request Session" button → opens request form:
      - Preferred date/time
      - Duration
      - Session type
      - Notes/message to coach
      - Creates `coach_sessions` with status='scheduled', triggers notification to coach
    - Each session: confirm attendance, cancel, or reschedule request
    - Empty state: "No sessions scheduled yet"

  **Must NOT do**:
  - Do NOT let client modify coach-created sessions (only confirm/cancel)
  - Do NOT implement real-time availability checking (defer)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Client-side calendar with booking request
  - **Skills**: [`senior-frontend`]
    - `senior-frontend`: Calendar + booking form

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 23-25, 27)
  - **Blocked By**: Tasks 7, 9

  **References**:
  - `src/pages/coach/CoachSchedule.tsx` — Coach calendar (Task 23, share similar patterns)
  - `src/hooks/useCoachSubscription.ts` — Client-side hook pattern
  - Task 23 session creation pattern

  **Acceptance Criteria**:
  - [ ] Page created: `/nutrio/coach-schedule`
  - [ ] Upcoming sessions list visible
  - [ ] "Request Session" form works
  - [ ] Coach receives notification on session request
  - [ ] Client can confirm/cancel sessions

  **QA Scenarios**:
  ```
  Scenario: Client requests a session with coach
    Tool: Playwright
    Preconditions: Client logged in, active coach subscription
    Steps:
      1. Navigate to /nutrio/coach-schedule
      2. Click "Request Session"
      3. Select date, time, duration=30min, type=video_call
      4. Add note: "Need help with meal prep for next week"
      5. Click Submit
      6. Assert: session appears in upcoming list with "Scheduled" status
      7. Assert: success toast
    Expected Result: Session request created, coach notified
    Evidence: .omo/evidence/task-26-request-session.png

  Scenario: Client confirms upcoming session
    Tool: Playwright
    Preconditions: Scheduled session exists
    Steps:
      1. Find session in upcoming list
      2. Click "Confirm"
      3. Assert: status changes to "Confirmed"
    Expected Result: Session confirmed
    Evidence: .omo/evidence/task-26-confirm-session.png
  ```

  **Commit**: YES
  - Message: `feat(client): add session booking and scheduling view`
  - Files: `src/pages/nutrio/CoachSchedule.tsx`

- [ ] 27. Integration QA — cross-feature smoke tests

  **What to do**:
  - Run comprehensive cross-feature integration tests:
    - Coach creates a meal plan → Client views it on programs page
    - Coach uploads a file in chat → Client downloads it
    - Client submits onboarding → Coach sees it on client detail
    - Coach schedules a session → Client confirms it
    - Client hits 7-day streak → Coach gets milestone notification
    - Client subscribes via Sadad → Coach sees earnings entry
    - Coach writes a note → Only coach can see (not client)
    - Client submits a review → Coach directory rating updates
    - Coach sends bulk message → All active clients receive it
    - Coach submits withdrawal → Admin sees pending request
    - Coach creates workout plan → Client marks exercises complete
    - Coach proposes goal → Client accepts → Both see status
  - Verify no regressions on existing pages:
    - Coach dashboard still loads
    - Insights still show correct aggregate data
    - Settings still functional
    - Existing chat still works
  - Run `npm run lint; npm run typecheck` and confirm clean

  **Must NOT do**:
  - Do NOT skip any smoke test scenario
  - Do NOT assume features work — verify each independently

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive integration testing across all features
  - **Skills**: [`webapp-testing`]
    - `webapp-testing`: Playwright-based cross-feature testing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final task, sequential)
  - **Blocked By**: Tasks 10-26

  **Acceptance Criteria**:
  - [ ] All 12 cross-feature smoke tests pass
  - [ ] No regressions on 5 existing pages
  - [ ] `npm run lint` passes
  - [ ] `npm run typecheck` passes

  **QA Scenarios**:
  ```
  Scenario: End-to-end meal plan flow
    Tool: Playwright
    Preconditions: Coach + client connected, meal plan created
    Steps:
      1. Coach creates meal plan on client detail
      2. Switch to client session — navigate to /nutrio/coach-programs
      3. Assert: meal plan visible with correct meals
      4. Client marks Day 1 meals complete
      5. Switch back to coach — verify adherence updated
    Expected Result: Full meal plan lifecycle works
    Evidence: .omo/evidence/task-27-e2e-meal-plan.png

  Scenario: Full notification flow
    Tool: Playwright
    Preconditions: Coach + client connected
    Steps:
      1. Trigger: client hits 7-day streak (insert test data)
      2. Navigate to coach dashboard
      3. Assert: milestone notification bell shows unread count
      4. Click bell — verify streak notification message
      5. Click to dismiss
      6. Assert: unread count decreases
    Expected Result: Milestone notification delivered and dismissible
    Evidence: .omo/evidence/task-27-notifications.png

  Scenario: No regressions on existing pages
    Tool: Playwright
    Preconditions: All new features deployed
    Steps:
      1. Navigate to /coach — verify dashboard loads
      2. Navigate to /coach/insights — verify stats load
      3. Navigate to /coach/chat — verify conversations load
      4. Navigate to /coach/earnings — verify summary loads
      5. Navigate to /coach/settings — verify form loads
      6. Assert: no console errors, no broken UI
    Expected Result: All existing pages functional
    Evidence: .omo/evidence/task-27-no-regressions.png
  ```

  **Commit**: YES
  - Message: `test: integration QA — all cross-feature smoke tests passed`
  - Files: QA evidence only, no code changes

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files in `.omo/evidence/`.
  Output: `Must Have [14/14] | Must NOT Have [CLEAN] | Tasks [27/27] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run typecheck; npm run lint`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: empty states, error handling.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN] | VERDICT`

---

## Commit Strategy

- Each task commits independently with descriptive messages
- Example: `feat(coach): add client notes table and UI`

---

## Success Criteria

### Verification Commands
```bash
npm run typecheck          # Expected: 0 errors
npm run lint               # Expected: 0 errors
```

### Final Checklist
- [ ] All 14 "Must Have" features present and functional
- [ ] All "Must NOT Have" guardrails respected
- [ ] All QA evidence captured
