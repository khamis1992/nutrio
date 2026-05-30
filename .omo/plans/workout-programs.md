# Workout Programs — Full Implementation Plan

## Objective
Make the Programs/Workouts card functional end-to-end: coach creates workout plans, clients complete exercises with real tracking, coach sees adherence and progress, and the system supports guided workouts with progressive overload.

## Current State
- **DB tables**: `coach_programs`, `program_meals`, `program_exercises` exist with RLS
- **Coach side** (`CoachClientDetail.tsx`): Can create workout plans and add exercises per day — this works
- **Client side** (`CoachPrograms.tsx`): Broken `coachId = "active"` (string, not UUID), fake `Math.random()` progress, checkboxes do nothing
- **Missing**: No completion tracking table, no workout session logging, no exercise library, no guided workout mode, no coach analytics

---

## Phase 1: Fix Data Flow & Completion Tracking

### 1.1 Create `program_exercise_completions` table
**File**: `supabase/migrations/20260529_add_exercise_completions.sql`

```sql
CREATE TABLE program_exercise_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_exercise_id uuid NOT NULL REFERENCES program_exercises(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(program_exercise_id, client_id, DATE(completed_at))
);
-- RLS: clients insert own completions, coaches view completions on their programs
```

**Acceptance**: Table created, RLS policies allow client INSERT and coach SELECT.

### 1.2 Fix client coachId lookup
**File**: `src/pages/nutrio/CoachPrograms.tsx`

Replace `const coachId = "active"` with a query to `coach_client_assignments`:
- Fetch the active assignment where `client_id = user.id AND status = 'active'`
- Get the `coach_id` from that assignment
- Pass real coachId to `useCoachPrograms(coachId, clientId)`

**Acceptance**: Client page loads real programs from their assigned coach.

### 1.3 Wire client exercise checkboxes to DB
**File**: `src/pages/nutrio/CoachPrograms.tsx`

- Add a `useClientExerciseCompletions` hook (or extend `useCoachPrograms`)
- On checkbox click: INSERT into `program_exercise_completions` (or DELETE to uncomplete)
- Fetch completions for today's date to show checked state
- Replace `Math.floor(Math.random() * totalExercises)` with real completion count

**Acceptance**: Client checks exercise → persists to DB → stays checked on reload → progress bar shows real %.

### 1.4 Wire client meal checkboxes to DB (same pattern)
**File**: `src/pages/nutrio/CoachPrograms.tsx`

- Create `program_meal_completions` table (same pattern as exercise completions)
- Wire meal checkboxes to INSERT/DELETE completions
- Replace fake meal completion count with real data

**Acceptance**: Meal checkboxes persist state, progress bar reflects real completions.

### 1.5 Coach sees completion stats on CoachClientDetail
**File**: `src/pages/coach/CoachClientDetail.tsx`

In the Programs card expanded view:
- Show completion count per exercise (e.g., "completed 3/5 times")
- Show overall program completion percentage
- Color-code: green ≥80%, amber ≥50%, red <50%

**Acceptance**: Coach expands a workout plan → sees which exercises the client has completed.

---

## Phase 2: Guided Workout Mode

### 2.1 Create `workout_sessions` table
**File**: `supabase/migrations/20260529_add_workout_sessions.sql`

```sql
CREATE TABLE workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid REFERENCES coach_programs(id) ON DELETE SET NULL,
  day_number int NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds int,
  notes text
);

CREATE TABLE workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  set_number int NOT NULL,
  reps int,
  weight_kg numeric(5,2),
  completed boolean DEFAULT true,
  notes text
);
```

**Acceptance**: Tables created with RLS for client CRUD.

### 2.2 Create `useWorkoutSession` hook
**File**: `src/hooks/useWorkoutSession.ts`

- `startSession(programId, dayNumber)` → creates workout_session
- `logSet(sessionId, exerciseName, setNumber, reps, weightKg)` → creates workout_set_log
- `completeSession(sessionId)` → sets completed_at, calculates duration
- Real-time state: current exercise index, current set, rest timer

**Acceptance**: Hook manages full workout session lifecycle.

### 2.3 Build Guided Workout page
**File**: `src/pages/nutrio/GuidedWorkout.tsx`

Client taps "Start Workout" on a program day → opens guided mode:
- **Header**: Program name, day number, elapsed time
- **Current exercise card**: Name, sets×reps, weight input, "Complete Set" button
- **Rest timer**: Counts down between sets (uses rest_seconds from program_exercises)
- **Progress dots**: Shows which exercise/set is current
- **Summary screen**: When all exercises done → shows total time, exercises completed, button to finish

**Route**: `/coach-programs/workout/:programId/day/:dayNumber`

**Acceptance**: Client can step through a full workout with timer and weight logging.

### 2.4 Add "Start Workout" button on CoachPrograms
**File**: `src/pages/nutrio/CoachPrograms.tsx`

On each workout day card, add a "Start Workout" button that navigates to the guided workout page. Only show for days that have exercises and are within the program date range.

**Acceptance**: Client sees "Start Workout" button → navigates to guided mode.

### 2.5 Auto-complete program_exercise_completions
When a workout session is completed, automatically INSERT into `program_exercise_completions` for each exercise in that day. This keeps Phase 1 completion tracking in sync.

**Acceptance**: Completing a guided workout marks all exercises as done.

---

## Phase 3: Coach Intelligence

### 3.1 Workout adherence stats on CoachClientDetail
**File**: `src/pages/coach/CoachClientDetail.tsx`

Add a "Workout Adherence" section (similar to Meal Adherence):
- Weekly bar chart showing workout completion rate per day
- Overall adherence percentage
- Comparison to target (if coach set workout_frequency goal)

**Acceptance**: Coach sees visual workout adherence chart for the past 7 days.

### 3.2 Exercise history with progressive overload
**File**: `src/pages/coach/CoachClientDetail.tsx`

In the expanded workout plan view, for each exercise show:
- Last 5 logged weights/reps (from workout_set_logs)
- Trend arrow (up/down/flat) for weight progression
- Color-coded: green if progressing, red if stalling/declining

**Acceptance**: Coach expands exercise → sees weight trend over recent sessions.

### 3.3 Client workout history page
**File**: `src/pages/nutrio/WorkoutHistory.tsx`

New client page showing:
- List of completed workout sessions (date, program, duration, exercises)
- Tap to expand and see set-level details
- Personal records highlighted (heaviest weight, most reps)

**Route**: `/workout-history`

**Acceptance**: Client can view their workout history with details.

### 3.4 Coach adherence alerts
**File**: `src/pages/coach/CoachClientDetail.tsx`

Show warning badges when:
- Client hasn't completed a workout in 3+ days
- Workout adherence drops below 50% for the week
- Program is past end date but incomplete

**Acceptance**: Coach sees red/amber warning badges for at-risk clients.

---

## Phase 4: Smart Features

### 4.1 Exercise library
**File**: `supabase/migrations/20260529_add_exercise_library.sql`

```sql
CREATE TABLE exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL, -- 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio'
  muscle_groups text[] NOT NULL,
  equipment text, -- 'barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'kettlebell'
  instructions text,
  demo_url text,
  difficulty text DEFAULT 'intermediate' -- 'beginner', 'intermediate', 'advanced'
);
```

Seed with 50+ common exercises. Coach can also add custom exercises.

**Acceptance**: Coach picks from searchable exercise library instead of typing names.

### 4.2 Workout templates
**File**: `supabase/migrations/20260529_add_workout_templates.sql`

```sql
CREATE TABLE workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'workout_plan',
  is_public boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  sets int NOT NULL DEFAULT 3,
  reps text NOT NULL,
  rest_seconds int DEFAULT 60,
  day_number int NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  notes text
);
```

Coach creates a template → reuses it for any client. "Use Template" button in workout builder.

**Acceptance**: Coach creates template → selects it when building a client's workout → exercises auto-populate.

### 4.3 Calendar workout scheduling
**File**: `src/pages/nutrio/WorkoutCalendar.tsx`

Calendar view showing:
- Scheduled workout days (from program day assignments)
- Completed sessions (green dots)
- Missed sessions (red dots)
- Upcoming sessions (blue dots)
- Tap a day to see exercises or start workout

**Route**: `/coach-programs/calendar`

**Acceptance**: Client sees workout calendar with completion status.

### 4.4 Progressive overload suggestions
On the coach's exercise view, show AI-style suggestions:
- "Increase Bench Press by 2.5kg — client has hit target for 3 consecutive sessions"
- "Add 1 set to Squats — client's volume has plateaued"
- Based on workout_set_logs trends

**Acceptance**: Coach sees suggestions with "Apply" button that updates the program exercise.

---

## Execution Order & Dependencies

```
Phase 1 (Foundation — can start immediately)
  1.1 DB: exercise completions table
  1.2 Fix: client coachId lookup
  1.3 Wire: exercise checkboxes → DB
  1.4 Wire: meal checkboxes → DB
  1.5 Coach: completion stats display

Phase 2 (Guided Mode — depends on Phase 1)
  2.1 DB: workout_sessions + set_logs tables
  2.2 Hook: useWorkoutSession
  2.3 Page: GuidedWorkout.tsx
  2.4 UI: "Start Workout" button
  2.5 Auto-complete: session → completions sync

Phase 3 (Intelligence — depends on Phase 2)
  3.1 Coach: workout adherence chart
  3.2 Coach: progressive overload display
  3.3 Client: workout history page
  3.4 Coach: adherence alerts

Phase 4 (Smart Features — depends on Phase 3)
  4.1 DB: exercise library + seeding
  4.2 DB: workout templates
  4.3 Page: WorkoutCalendar.tsx
  4.4 Feature: overload suggestions
```

## Files to Create/Modify

| Action | File | Phase |
|--------|------|-------|
| CREATE | `supabase/migrations/20260529_add_exercise_completions.sql` | 1.1 |
| MODIFY | `src/pages/nutrio/CoachPrograms.tsx` | 1.2, 1.3, 1.4, 2.4 |
| CREATE | `src/hooks/useExerciseCompletions.ts` | 1.3 |
| CREATE | `supabase/migrations/20260529_add_meal_completions.sql` | 1.4 |
| MODIFY | `src/pages/coach/CoachClientDetail.tsx` | 1.5, 3.1, 3.2, 3.4 |
| CREATE | `supabase/migrations/20260529_add_workout_sessions.sql` | 2.1 |
| CREATE | `src/hooks/useWorkoutSession.ts` | 2.2 |
| CREATE | `src/pages/nutrio/GuidedWorkout.tsx` | 2.3 |
| MODIFY | `src/customer/routes.tsx` | 2.3 |
| CREATE | `src/pages/nutrio/WorkoutHistory.tsx` | 3.3 |
| CREATE | `supabase/migrations/20260529_add_exercise_library.sql` | 4.1 |
| MODIFY | `src/hooks/useCoachPrograms.ts` | 4.1 |
| CREATE | `supabase/migrations/20260529_add_workout_templates.sql` | 4.2 |
| CREATE | `src/pages/nutrio/WorkoutCalendar.tsx` | 4.3 |

## Verification Checklist (per phase)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` no new errors
- [ ] Dev server loads without console errors
- [ ] Client page shows real data (no more Math.random)
- [ ] Checkboxes persist across page reload
- [ ] Coach sees client completion data
- [ ] Guided workout flow works end-to-end
- [ ] Coach adherence charts render correctly

## Estimated Effort
- Phase 1: ~3-4 hours (foundation, mostly DB + wiring)
- Phase 2: ~4-5 hours (guided workout is the biggest piece)
- Phase 3: ~3-4 hours (analytics + history)
- Phase 4: ~5-6 hours (library + templates + calendar + suggestions)
- **Total: ~15-19 hours**
