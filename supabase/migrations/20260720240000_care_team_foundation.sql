BEGIN;

ALTER TABLE public.coach_applications
  ADD COLUMN IF NOT EXISTS professional_type TEXT NOT NULL DEFAULT 'wellness_coach',
  ADD COLUMN IF NOT EXISTS license_authority TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS license_jurisdiction TEXT NOT NULL DEFAULT 'QA',
  ADD COLUMN IF NOT EXISTS license_expires_on DATE,
  ADD COLUMN IF NOT EXISTS credential_document_path TEXT,
  ADD COLUMN IF NOT EXISTS requested_scope TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[],
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.coach_applications
  DROP CONSTRAINT IF EXISTS coach_applications_professional_type_check;
ALTER TABLE public.coach_applications
  ADD CONSTRAINT coach_applications_professional_type_check
  CHECK (professional_type IN ('dietitian', 'fitness_coach', 'wellness_coach'));

ALTER TABLE public.coach_applications
  DROP CONSTRAINT IF EXISTS coach_applications_status_check;
ALTER TABLE public.coach_applications
  ADD CONSTRAINT coach_applications_status_check
  CHECK (status IN ('pending', 'needs_info', 'approved', 'rejected', 'suspended'));

CREATE TABLE IF NOT EXISTS public.care_professional_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.coach_applications(id) ON DELETE SET NULL,
  professional_type TEXT NOT NULL CHECK (professional_type IN ('dietitian', 'fitness_coach', 'wellness_coach')),
  display_title TEXT NOT NULL CHECK (char_length(display_title) BETWEEN 3 AND 100),
  license_authority TEXT NOT NULL CHECK (char_length(license_authority) BETWEEN 2 AND 160),
  license_number TEXT NOT NULL CHECK (char_length(license_number) BETWEEN 3 AND 100),
  license_jurisdiction TEXT NOT NULL DEFAULT 'QA' CHECK (char_length(license_jurisdiction) BETWEEN 2 AND 10),
  license_expires_on DATE NOT NULL,
  credential_document_path TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'suspended', 'expired', 'rejected')),
  scope_statement TEXT NOT NULL CHECK (char_length(scope_statement) BETWEEN 20 AND 1000),
  allowed_actions TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  prohibited_actions TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  languages TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[],
  response_sla_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (response_sla_minutes BETWEEN 15 AND 4320),
  escalation_sla_minutes INTEGER NOT NULL DEFAULT 2880 CHECK (escalation_sla_minutes BETWEEN 30 AND 10080),
  accepting_clients BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT CHECK (suspension_reason IS NULL OR char_length(suspension_reason) BETWEEN 3 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(languages) BETWEEN 1 AND 8),
  CHECK (allowed_actions <@ ARRAY[
    'view_macros', 'view_weight', 'view_hydration', 'view_meal_adherence', 'view_workouts',
    'view_health_context', 'view_labs', 'view_meal_response',
    'approve_nutrition_plan', 'approve_training_plan', 'send_guidance', 'schedule_sessions'
  ]::TEXT[]),
  CHECK (prohibited_actions <@ ARRAY[
    'diagnose', 'prescribe_medication', 'change_medication', 'provide_emergency_care',
    'access_without_consent', 'share_outside_care_team'
  ]::TEXT[])
);

ALTER TABLE public.coach_client_assignments
  ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'fitness_coaching',
  ADD COLUMN IF NOT EXISTS consent_scopes TEXT[] NOT NULL DEFAULT ARRAY['macros', 'weight', 'meal_adherence']::TEXT[],
  ADD COLUMN IF NOT EXISTS consent_version TEXT NOT NULL DEFAULT 'care-team-v1',
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_reason TEXT,
  ADD COLUMN IF NOT EXISTS client_label TEXT,
  ADD COLUMN IF NOT EXISTS scope_statement_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_professional_response_at TIMESTAMPTZ;

ALTER TABLE public.coach_client_assignments
  DROP CONSTRAINT IF EXISTS coach_client_assignments_assignment_type_check;
ALTER TABLE public.coach_client_assignments
  ADD CONSTRAINT coach_client_assignments_assignment_type_check
  CHECK (assignment_type IN ('fitness_coaching', 'nutrition_guidance', 'integrated_care'));

ALTER TABLE public.coach_client_assignments
  DROP CONSTRAINT IF EXISTS coach_client_assignments_consent_scopes_check;
ALTER TABLE public.coach_client_assignments
  ADD CONSTRAINT coach_client_assignments_consent_scopes_check
  CHECK (
    cardinality(consent_scopes) BETWEEN 1 AND 9
    AND consent_scopes <@ ARRAY[
      'macros', 'weight', 'hydration', 'meal_adherence', 'workouts',
      'health_context', 'labs', 'meal_response', 'messages'
    ]::TEXT[]
  );

CREATE UNIQUE INDEX IF NOT EXISTS care_assignment_actor_request_unique
  ON public.coach_client_assignments (requested_by, request_id)
  WHERE request_id IS NOT NULL;
DROP INDEX IF EXISTS public.care_assignment_one_active_client_idx;
DROP INDEX IF EXISTS public.coach_client_assignments_one_open_per_client_idx;
CREATE UNIQUE INDEX IF NOT EXISTS care_assignment_one_active_type_idx
  ON public.coach_client_assignments (client_id, assignment_type)
  WHERE client_id IS NOT NULL AND status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS care_assignment_response_due_idx
  ON public.coach_client_assignments (response_due_at)
  WHERE status = 'active' AND response_due_at IS NOT NULL;

ALTER TABLE public.coach_notes
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.coach_client_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'progress',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS supersedes_note_id UUID REFERENCES public.coach_notes(id) ON DELETE SET NULL;

ALTER TABLE public.coach_notes
  DROP CONSTRAINT IF EXISTS coach_notes_note_type_check;
ALTER TABLE public.coach_notes
  ADD CONSTRAINT coach_notes_note_type_check
  CHECK (note_type IN ('progress', 'nutrition', 'training', 'barrier', 'safety', 'session'));
ALTER TABLE public.coach_notes
  DROP CONSTRAINT IF EXISTS coach_notes_status_check;
ALTER TABLE public.coach_notes
  ADD CONSTRAINT coach_notes_status_check CHECK (status IN ('active', 'corrected', 'archived'));

ALTER TABLE public.coach_sessions
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.coach_client_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS care_session_actor_request_unique
  ON public.coach_sessions (coach_id, request_id)
  WHERE request_id IS NOT NULL;

-- Preserve historical notes and sessions before RPC-only policies require a
-- concrete assignment. Prefer the active assignment, then the newest match.
UPDATE public.coach_notes note
SET assignment_id = (
  SELECT assignment.id
  FROM public.coach_client_assignments assignment
  WHERE assignment.coach_id = note.coach_id
    AND assignment.client_id = note.client_id
  ORDER BY (assignment.status = 'active') DESC, assignment.created_at DESC
  LIMIT 1
)
WHERE note.assignment_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.coach_client_assignments assignment
    WHERE assignment.coach_id = note.coach_id
      AND assignment.client_id = note.client_id
  );

UPDATE public.coach_sessions session
SET assignment_id = (
  SELECT assignment.id
  FROM public.coach_client_assignments assignment
  WHERE assignment.coach_id = session.coach_id
    AND assignment.client_id = session.client_id
  ORDER BY (assignment.status = 'active') DESC, assignment.created_at DESC
  LIMIT 1
)
WHERE session.assignment_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.coach_client_assignments assignment
    WHERE assignment.coach_id = session.coach_id
      AND assignment.client_id = session.client_id
  );

CREATE TABLE IF NOT EXISTS public.care_plan_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.coach_client_assignments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_kind TEXT NOT NULL CHECK (plan_kind IN ('nutrition_goal', 'meal_plan', 'training_plan', 'health_program')),
  source_entity_id UUID,
  plan_version INTEGER NOT NULL CHECK (plan_version > 0),
  plan_snapshot JSONB NOT NULL CHECK (jsonb_typeof(plan_snapshot) = 'object'),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'changes_required', 'outside_scope')),
  rationale TEXT NOT NULL CHECK (char_length(rationale) BETWEEN 10 AND 2000),
  request_id UUID NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id, request_id),
  UNIQUE (assignment_id, plan_kind, source_entity_id, plan_version)
);

CREATE TABLE IF NOT EXISTS public.care_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.coach_client_assignments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('response_overdue', 'scope_question', 'safety_concern', 'service_issue', 'handoff_required')),
  severity TEXT NOT NULL CHECK (severity IN ('normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'cancelled')),
  summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 1000),
  due_at TIMESTAMPTZ NOT NULL,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution TEXT CHECK (resolution IS NULL OR char_length(resolution) BETWEEN 10 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_escalations_open_due_idx
  ON public.care_escalations (due_at, severity)
  WHERE status IN ('open', 'acknowledged');
CREATE UNIQUE INDEX IF NOT EXISTS care_escalations_one_overdue_per_assignment_idx
  ON public.care_escalations (assignment_id)
  WHERE category = 'response_overdue' AND status IN ('open', 'acknowledged');

CREATE TABLE IF NOT EXISTS public.care_team_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id UUID REFERENCES public.coach_client_assignments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_team_events_assignment_created_idx
  ON public.care_team_events (assignment_id, created_at DESC);

ALTER TABLE public.care_professional_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_professional_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.care_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_escalations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.care_team_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_team_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.care_professional_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.care_plan_reviews FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.care_escalations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.care_team_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.care_professional_credentials TO authenticated;
GRANT SELECT ON TABLE public.care_plan_reviews TO authenticated;
GRANT SELECT ON TABLE public.care_escalations TO authenticated;
GRANT SELECT ON TABLE public.care_team_events TO authenticated;
GRANT ALL ON TABLE public.care_professional_credentials, public.care_plan_reviews,
  public.care_escalations, public.care_team_events TO service_role;

CREATE OR REPLACE FUNCTION public.care_professional_has_scope(
  p_client_id UUID,
  p_scope TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND p_scope = ANY(ARRAY[
      'macros', 'weight', 'hydration', 'meal_adherence', 'workouts',
      'health_context', 'labs', 'meal_response', 'messages'
    ]::TEXT[])
    AND EXISTS (
      SELECT 1
      FROM public.coach_client_assignments assignment
      JOIN public.care_professional_credentials credential
        ON credential.user_id = assignment.coach_id
      WHERE assignment.coach_id = (SELECT auth.uid())
        AND assignment.client_id = p_client_id
        AND assignment.status = 'active'
        AND p_scope = ANY(assignment.consent_scopes)
        AND credential.verification_status = 'verified'
        AND credential.license_expires_on >= CURRENT_DATE
        AND CASE p_scope
          WHEN 'macros' THEN 'view_macros'
          WHEN 'weight' THEN 'view_weight'
          WHEN 'hydration' THEN 'view_hydration'
          WHEN 'meal_adherence' THEN 'view_meal_adherence'
          WHEN 'workouts' THEN 'view_workouts'
          WHEN 'health_context' THEN 'view_health_context'
          WHEN 'labs' THEN 'view_labs'
          WHEN 'meal_response' THEN 'view_meal_response'
          WHEN 'messages' THEN 'send_guidance'
        END = ANY(credential.allowed_actions)
    );
$function$;

REVOKE ALL ON FUNCTION public.care_professional_has_scope(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_professional_has_scope(UUID, TEXT) TO authenticated, service_role;

-- Replace broad historical coach access with consent-scoped, verified access.
DROP POLICY IF EXISTS "Coaches can view client body measurements" ON public.body_measurements;
CREATE POLICY care_weight_scope_read ON public.body_measurements
  FOR SELECT TO authenticated
  USING (public.care_professional_has_scope(user_id, 'weight'));

DROP POLICY IF EXISTS care_hydration_scope_read ON public.water_entries;
CREATE POLICY care_hydration_scope_read ON public.water_entries
  FOR SELECT TO authenticated
  USING (public.care_professional_has_scope(user_id, 'hydration'));

DROP POLICY IF EXISTS "Coaches can view client meal schedules" ON public.meal_schedules;
CREATE POLICY care_meal_adherence_scope_read ON public.meal_schedules
  FOR SELECT TO authenticated
  USING (public.care_professional_has_scope(user_id, 'meal_adherence'));

DROP POLICY IF EXISTS "Coaches can view client nutrition goals" ON public.nutrition_goals;
DROP POLICY IF EXISTS "coaches_view_client_goals" ON public.nutrition_goals;
CREATE POLICY care_macros_scope_goal_read ON public.nutrition_goals
  FOR SELECT TO authenticated
  USING (public.care_professional_has_scope(user_id, 'macros'));

DROP POLICY IF EXISTS "Coaches can view client progress" ON public.progress_logs;
CREATE POLICY care_meal_adherence_scope_progress_read ON public.progress_logs
  FOR SELECT TO authenticated
  USING (public.care_professional_has_scope(user_id, 'meal_adherence'));

DROP POLICY IF EXISTS "Coaches can view client streaks" ON public.user_streaks;
CREATE POLICY care_meal_adherence_scope_streak_read ON public.user_streaks
  FOR SELECT TO authenticated
  USING (public.care_professional_has_scope(user_id, 'meal_adherence'));

DROP POLICY IF EXISTS "coaches_view_client_workout_sessions" ON public.coach_workout_sessions;
CREATE POLICY care_workout_scope_session_read ON public.coach_workout_sessions
  FOR SELECT TO authenticated
  USING (public.care_professional_has_scope(user_id, 'workouts'));

DROP POLICY IF EXISTS "coaches_view_client_set_logs" ON public.coach_workout_set_logs;
CREATE POLICY care_workout_scope_set_log_read ON public.coach_workout_set_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_workout_sessions session
      WHERE session.id = coach_workout_set_logs.session_id
        AND public.care_professional_has_scope(session.user_id, 'workouts')
    )
  );

DROP POLICY IF EXISTS "coaches_view_client_progression" ON public.workout_progression_recommendations;
CREATE POLICY care_workout_scope_progression_read ON public.workout_progression_recommendations
  FOR SELECT TO authenticated
  USING (public.care_professional_has_scope(user_id, 'workouts'));

DROP POLICY IF EXISTS "coaches_view_client_profiles" ON public.profiles;
CREATE POLICY care_consented_client_profile_read ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.care_professional_has_scope(user_id, 'macros')
    OR public.care_professional_has_scope(user_id, 'weight')
    OR public.care_professional_has_scope(user_id, 'workouts')
  );

DROP POLICY IF EXISTS "coaches_update_client_goals" ON public.nutrition_goals;
DROP POLICY IF EXISTS "coaches_update_client_targets" ON public.profiles;

CREATE OR REPLACE FUNCTION public.is_coach_of(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_client_assignments assignment
    JOIN public.care_professional_credentials credential
      ON credential.user_id = assignment.coach_id
    WHERE assignment.coach_id = (SELECT auth.uid())
      AND assignment.client_id = p_user_id
      AND assignment.status = 'active'
      AND credential.verification_status = 'verified'
      AND credential.license_expires_on >= CURRENT_DATE
  );
$function$;

REVOKE ALL ON FUNCTION public.is_coach_of(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_of(UUID) TO authenticated, service_role;

CREATE POLICY care_credentials_owner_or_admin_read ON public.care_professional_credentials
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY care_plan_reviews_participant_read ON public.care_plan_reviews
  FOR SELECT TO authenticated
  USING (client_id = (SELECT auth.uid()) OR professional_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY care_escalations_participant_read ON public.care_escalations
  FOR SELECT TO authenticated
  USING (client_id = (SELECT auth.uid()) OR professional_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY care_events_participant_read ON public.care_team_events
  FOR SELECT TO authenticated
  USING (client_id = (SELECT auth.uid()) OR professional_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- Application decisions must be atomic with role and credential changes.
-- Remove the historical direct-write policies and make the RPCs authoritative.
DROP POLICY IF EXISTS "admins_can_manage_applications" ON public.coach_applications;
DROP POLICY IF EXISTS "users_can_submit_applications" ON public.coach_applications;
DROP POLICY IF EXISTS "users_can_view_own_application" ON public.coach_applications;
CREATE POLICY care_applications_owner_or_admin_read ON public.coach_applications
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
REVOKE ALL ON TABLE public.coach_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.coach_applications TO authenticated;
GRANT ALL ON TABLE public.coach_applications TO service_role;

DROP POLICY IF EXISTS "coaches_view_own_assignments" ON public.coach_client_assignments;
DROP POLICY IF EXISTS "clients_view_own_assignments" ON public.coach_client_assignments;
DROP POLICY IF EXISTS "clients_accept_invites" ON public.coach_client_assignments;
DROP POLICY IF EXISTS "coaches_insert_assignments" ON public.coach_client_assignments;
DROP POLICY IF EXISTS "coaches_delete_assignments" ON public.coach_client_assignments;
DROP POLICY IF EXISTS "coaches_update_own_assignments" ON public.coach_client_assignments;
DROP POLICY IF EXISTS "clients_request_coaches" ON public.coach_client_assignments;
DROP POLICY IF EXISTS "clients_accept_invites_by_code" ON public.coach_client_assignments;
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.coach_client_assignments;
CREATE POLICY care_assignments_participant_read ON public.coach_client_assignments
  FOR SELECT TO authenticated
  USING (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_client_assignments FROM authenticated;
GRANT SELECT ON TABLE public.coach_client_assignments TO authenticated;

DROP POLICY IF EXISTS "coaches_read_own_messages" ON public.coach_messages;
DROP POLICY IF EXISTS "coaches_insert_messages" ON public.coach_messages;
DROP POLICY IF EXISTS "users_update_read_status" ON public.coach_messages;
CREATE POLICY care_messages_active_participant_read ON public.coach_messages
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.uid()) = coach_id OR (SELECT auth.uid()) = client_id)
    AND EXISTS (
      SELECT 1 FROM public.coach_client_assignments assignment
      WHERE assignment.coach_id = coach_messages.coach_id
        AND assignment.client_id = coach_messages.client_id
        AND assignment.status = 'active'
    )
  );
CREATE POLICY care_messages_active_participant_insert ON public.coach_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    ((sender_role = 'coach' AND coach_id = (SELECT auth.uid()))
      OR (sender_role = 'client' AND client_id = (SELECT auth.uid())))
    AND EXISTS (
      SELECT 1 FROM public.coach_client_assignments assignment
      WHERE assignment.coach_id = coach_messages.coach_id
        AND assignment.client_id = coach_messages.client_id
        AND assignment.status = 'active'
    )
    AND (
      sender_role = 'client'
      OR EXISTS (
        SELECT 1 FROM public.care_professional_credentials credential
        WHERE credential.user_id = coach_messages.coach_id
          AND credential.verification_status = 'verified'
          AND credential.license_expires_on >= CURRENT_DATE
      )
    )
  );
CREATE POLICY care_messages_receiver_mark_read ON public.coach_messages
  FOR UPDATE TO authenticated
  USING (
    (sender_role = 'coach' AND client_id = (SELECT auth.uid()))
    OR (sender_role = 'client' AND coach_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    (sender_role = 'coach' AND client_id = (SELECT auth.uid()))
    OR (sender_role = 'client' AND coach_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS notifications_authorized_insert ON public.notifications;
CREATE POLICY notifications_authorized_insert
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'staff'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.coach_client_assignments assignment
      JOIN public.care_professional_credentials credential ON credential.user_id = assignment.coach_id
      WHERE assignment.coach_id = (SELECT auth.uid())
        AND assignment.client_id = notifications.user_id
        AND assignment.status = 'active'
        AND credential.verification_status = 'verified'
        AND credential.license_expires_on >= CURRENT_DATE
    )
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs job
      JOIN public.drivers driver ON driver.id = job.driver_id
      JOIN public.restaurants restaurant ON restaurant.id = job.restaurant_id
      WHERE job.id = NULLIF(notifications.data ->> 'delivery_job_id', '')::UUID
        AND driver.user_id = notifications.user_id
        AND restaurant.owner_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.guard_care_message_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.coach_id IS DISTINCT FROM OLD.coach_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.sender_role IS DISTINCT FROM OLD.sender_role
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.read IS NOT TRUE
     OR OLD.read IS TRUE
  THEN
    RAISE EXCEPTION 'CARE_MESSAGE_ONLY_RECEIVER_CAN_MARK_UNREAD_MESSAGE_READ' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS guard_care_message_update_trigger ON public.coach_messages;
CREATE TRIGGER guard_care_message_update_trigger
  BEFORE UPDATE ON public.coach_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_care_message_update();

CREATE OR REPLACE FUNCTION public.notify_coach_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (
    CASE WHEN NEW.sender_role = 'coach' THEN NEW.client_id ELSE NEW.coach_id END,
    'New secure care message',
    'Open Nutrio to read your care-team message.',
    'general',
    jsonb_build_object('route', '/coach-messages', 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "coaches_read_own_notes" ON public.coach_notes;
DROP POLICY IF EXISTS "coaches_insert_notes" ON public.coach_notes;
DROP POLICY IF EXISTS "coaches_update_own_notes" ON public.coach_notes;
DROP POLICY IF EXISTS "coaches_delete_own_notes" ON public.coach_notes;
CREATE POLICY care_notes_verified_professional_read ON public.coach_notes
  FOR SELECT TO authenticated
  USING (
    coach_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.coach_client_assignments assignment
      WHERE assignment.coach_id = coach_notes.coach_id
        AND assignment.client_id = coach_notes.client_id
        AND assignment.status = 'active'
    )
  );
REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_notes FROM authenticated;
GRANT SELECT ON TABLE public.coach_notes TO authenticated;

DROP POLICY IF EXISTS "coaches_manage_own_sessions" ON public.coach_sessions;
DROP POLICY IF EXISTS "clients_view_own_sessions" ON public.coach_sessions;
DROP POLICY IF EXISTS "clients_update_own_sessions" ON public.coach_sessions;
CREATE POLICY care_sessions_participant_read ON public.coach_sessions
  FOR SELECT TO authenticated
  USING (
    (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.coach_client_assignments assignment
      WHERE assignment.coach_id = coach_sessions.coach_id
        AND assignment.client_id = coach_sessions.client_id
        AND assignment.status = 'active'
    )
  );
REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_sessions FROM authenticated;
GRANT SELECT ON TABLE public.coach_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_care_professional_application(
  p_professional_type TEXT,
  p_bio TEXT,
  p_specialties TEXT[],
  p_qualifications TEXT,
  p_license_authority TEXT,
  p_license_number TEXT,
  p_license_jurisdiction TEXT,
  p_license_expires_on DATE,
  p_requested_scope TEXT,
  p_languages TEXT[] DEFAULT ARRAY['en']::TEXT[],
  p_credential_document_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_application_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_professional_type NOT IN ('dietitian', 'fitness_coach', 'wellness_coach') THEN
    RAISE EXCEPTION 'CARE_PROFESSIONAL_TYPE_INVALID';
  END IF;
  IF char_length(COALESCE(btrim(p_bio), '')) NOT BETWEEN 40 AND 2000
     OR cardinality(COALESCE(p_specialties, '{}'::TEXT[])) NOT BETWEEN 1 AND 12
     OR char_length(COALESCE(btrim(p_license_authority), '')) NOT BETWEEN 2 AND 160
     OR char_length(COALESCE(btrim(p_license_number), '')) NOT BETWEEN 3 AND 100
     OR char_length(COALESCE(btrim(p_license_jurisdiction), '')) NOT BETWEEN 2 AND 10
     OR p_license_expires_on IS NULL OR p_license_expires_on <= CURRENT_DATE
     OR char_length(COALESCE(btrim(p_requested_scope), '')) NOT BETWEEN 20 AND 1000
     OR cardinality(COALESCE(p_languages, '{}'::TEXT[])) NOT BETWEEN 1 AND 8
  THEN
    RAISE EXCEPTION 'CARE_PROFESSIONAL_APPLICATION_INCOMPLETE';
  END IF;
  IF p_professional_type = 'dietitian' AND upper(COALESCE(p_license_jurisdiction, '')) <> 'QA' THEN
    RAISE EXCEPTION 'DIETITIAN_QATAR_LICENSE_REQUIRED';
  END IF;

  INSERT INTO public.coach_applications (
    user_id, bio, specialties, qualifications, status,
    professional_type, license_authority, license_number, license_jurisdiction,
    license_expires_on, credential_document_path, requested_scope, languages,
    reviewed_by, reviewed_at, rejection_reason, updated_at
  ) VALUES (
    v_actor, btrim(p_bio), p_specialties, NULLIF(btrim(p_qualifications), ''), 'pending',
    p_professional_type, btrim(p_license_authority), btrim(p_license_number), upper(p_license_jurisdiction),
    p_license_expires_on, NULLIF(btrim(p_credential_document_path), ''), btrim(p_requested_scope), p_languages,
    NULL, NULL, NULL, now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET bio = EXCLUDED.bio,
      specialties = EXCLUDED.specialties,
      qualifications = EXCLUDED.qualifications,
      status = 'pending',
      professional_type = EXCLUDED.professional_type,
      license_authority = EXCLUDED.license_authority,
      license_number = EXCLUDED.license_number,
      license_jurisdiction = EXCLUDED.license_jurisdiction,
      license_expires_on = EXCLUDED.license_expires_on,
      credential_document_path = EXCLUDED.credential_document_path,
      requested_scope = EXCLUDED.requested_scope,
      languages = EXCLUDED.languages,
      reviewed_by = NULL,
      reviewed_at = NULL,
      rejection_reason = NULL,
      updated_at = now()
  WHERE coach_applications.status IN ('pending', 'needs_info', 'rejected', 'suspended')
  RETURNING id INTO v_application_id;

  IF v_application_id IS NULL THEN RAISE EXCEPTION 'CARE_PROFESSIONAL_APPLICATION_ALREADY_APPROVED'; END IF;
  RETURN v_application_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_care_professional_application(
  p_application_id UUID,
  p_decision TEXT,
  p_display_title TEXT,
  p_scope_statement TEXT,
  p_allowed_actions TEXT[],
  p_admin_note TEXT,
  p_response_sla_minutes INTEGER DEFAULT 1440,
  p_escalation_sla_minutes INTEGER DEFAULT 2880
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_application public.coach_applications%ROWTYPE;
  v_credential_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'needs_info', 'rejected') THEN RAISE EXCEPTION 'CARE_REVIEW_DECISION_INVALID'; END IF;

  SELECT * INTO v_application
  FROM public.coach_applications
  WHERE id = p_application_id AND status IN ('pending', 'needs_info', 'suspended')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_APPLICATION_NOT_FOUND'; END IF;

  IF p_decision = 'approved' THEN
    IF v_application.license_expires_on IS NULL OR v_application.license_expires_on <= CURRENT_DATE
       OR char_length(COALESCE(btrim(v_application.license_authority), '')) < 2
       OR char_length(COALESCE(btrim(v_application.license_number), '')) < 3
       OR char_length(COALESCE(btrim(p_display_title), '')) NOT BETWEEN 3 AND 100
       OR char_length(COALESCE(btrim(p_scope_statement), '')) NOT BETWEEN 20 AND 1000
       OR cardinality(COALESCE(p_allowed_actions, '{}'::TEXT[])) = 0
    THEN
      RAISE EXCEPTION 'VERIFIED_CREDENTIAL_EVIDENCE_REQUIRED';
    END IF;

    INSERT INTO public.care_professional_credentials (
      user_id, application_id, professional_type, display_title,
      license_authority, license_number, license_jurisdiction, license_expires_on,
      credential_document_path, verification_status, scope_statement,
      allowed_actions, prohibited_actions, languages,
      response_sla_minutes, escalation_sla_minutes, accepting_clients,
      verified_by, verified_at, next_review_at, updated_at
    ) VALUES (
      v_application.user_id, v_application.id, v_application.professional_type, btrim(p_display_title),
      v_application.license_authority, v_application.license_number, v_application.license_jurisdiction,
      v_application.license_expires_on, v_application.credential_document_path, 'verified', btrim(p_scope_statement),
      p_allowed_actions,
      ARRAY['diagnose', 'prescribe_medication', 'change_medication', 'provide_emergency_care', 'access_without_consent', 'share_outside_care_team'],
      v_application.languages, p_response_sla_minutes, p_escalation_sla_minutes, true,
      v_actor, now(), LEAST(v_application.license_expires_on::TIMESTAMPTZ, now() + INTERVAL '1 year'), now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET application_id = EXCLUDED.application_id,
        professional_type = EXCLUDED.professional_type,
        display_title = EXCLUDED.display_title,
        license_authority = EXCLUDED.license_authority,
        license_number = EXCLUDED.license_number,
        license_jurisdiction = EXCLUDED.license_jurisdiction,
        license_expires_on = EXCLUDED.license_expires_on,
        credential_document_path = EXCLUDED.credential_document_path,
        verification_status = 'verified',
        scope_statement = EXCLUDED.scope_statement,
        allowed_actions = EXCLUDED.allowed_actions,
        prohibited_actions = EXCLUDED.prohibited_actions,
        languages = EXCLUDED.languages,
        response_sla_minutes = EXCLUDED.response_sla_minutes,
        escalation_sla_minutes = EXCLUDED.escalation_sla_minutes,
        accepting_clients = true,
        verified_by = v_actor,
        verified_at = now(),
        next_review_at = EXCLUDED.next_review_at,
        suspended_at = NULL,
        suspension_reason = NULL,
        updated_at = now()
    RETURNING id INTO v_credential_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_application.user_id, 'coach'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
    SET bio = v_application.bio, specialties = v_application.specialties, updated_at = now()
    WHERE user_id = v_application.user_id;
  ELSE
    UPDATE public.care_professional_credentials
    SET verification_status = CASE WHEN p_decision = 'rejected' THEN 'rejected' ELSE 'pending' END,
        accepting_clients = false,
        updated_at = now()
    WHERE user_id = v_application.user_id;
  END IF;

  UPDATE public.coach_applications
  SET status = p_decision,
      admin_notes = NULLIF(btrim(p_admin_note), ''),
      rejection_reason = CASE WHEN p_decision = 'approved' THEN NULL ELSE NULLIF(btrim(p_admin_note), '') END,
      reviewed_by = v_actor,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = v_application.id;

  INSERT INTO public.care_team_events (
    professional_id, actor_id, event_type, resource_type, resource_id, metadata
  ) VALUES (
    v_application.user_id, v_actor, 'credential.' || p_decision,
    'care_professional_credential', COALESCE(v_credential_id::TEXT, v_application.id::TEXT),
    jsonb_build_object('professional_type', v_application.professional_type, 'decision', p_decision)
  );

  RETURN jsonb_build_object('status', p_decision, 'credential_id', v_credential_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_verified_care_professionals()
RETURNS TABLE (
  professional_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  specialties TEXT[],
  professional_type TEXT,
  display_title TEXT,
  scope_statement TEXT,
  languages TEXT[],
  verification_expires_on DATE,
  accepting_clients BOOLEAN,
  client_count BIGINT,
  average_rating NUMERIC,
  review_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT credential.user_id,
    profile.full_name,
    profile.avatar_url,
    profile.bio,
    COALESCE(profile.specialties, '{}'::TEXT[]),
    credential.professional_type,
    credential.display_title,
    credential.scope_statement,
    credential.languages,
    credential.license_expires_on,
    credential.accepting_clients,
    (SELECT count(*) FROM public.coach_client_assignments assignment
      WHERE assignment.coach_id = credential.user_id AND assignment.status = 'active'),
    COALESCE((SELECT round(avg(review.rating)::NUMERIC, 1) FROM public.coach_reviews review
      WHERE review.coach_id = credential.user_id), 0),
    (SELECT count(*) FROM public.coach_reviews review WHERE review.coach_id = credential.user_id)
  FROM public.care_professional_credentials credential
  JOIN public.profiles profile ON profile.user_id = credential.user_id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND credential.verification_status = 'verified'
    AND credential.license_expires_on >= CURRENT_DATE
  ORDER BY credential.accepting_clients DESC, 13 DESC, profile.full_name;
$function$;

CREATE OR REPLACE FUNCTION public.request_care_professional(
  p_professional_id UUID,
  p_assignment_type TEXT,
  p_consent_scopes TEXT[],
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_credential public.care_professional_credentials%ROWTYPE;
  v_assignment public.coach_client_assignments%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_request_id IS NULL OR p_professional_id = v_actor THEN RAISE EXCEPTION 'CARE_REQUEST_INVALID'; END IF;
  IF p_assignment_type NOT IN ('fitness_coaching', 'nutrition_guidance', 'integrated_care') THEN RAISE EXCEPTION 'CARE_ASSIGNMENT_TYPE_INVALID'; END IF;
  IF cardinality(COALESCE(p_consent_scopes, '{}'::TEXT[])) NOT BETWEEN 1 AND 9
     OR NOT p_consent_scopes <@ ARRAY['macros','weight','hydration','meal_adherence','workouts','health_context','labs','meal_response','messages']::TEXT[]
  THEN RAISE EXCEPTION 'CARE_CONSENT_SCOPES_INVALID'; END IF;

  SELECT * INTO v_credential
  FROM public.care_professional_credentials
  WHERE user_id = p_professional_id
    AND verification_status = 'verified'
    AND license_expires_on >= CURRENT_DATE
    AND accepting_clients
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_PROFESSIONAL_UNAVAILABLE'; END IF;
  IF p_assignment_type IN ('nutrition_guidance', 'integrated_care')
     AND v_credential.professional_type <> 'dietitian'
  THEN RAISE EXCEPTION 'LICENSED_DIETITIAN_REQUIRED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.coach_client_assignments
    WHERE client_id = v_actor
      AND assignment_type = p_assignment_type
      AND status = 'active'
  ) THEN RAISE EXCEPTION 'ACTIVE_CARE_ASSIGNMENT_TYPE_EXISTS'; END IF;

  INSERT INTO public.coach_client_assignments (
    coach_id, client_id, status, assignment_type, consent_scopes, consent_version,
    request_id, requested_by, scope_statement_snapshot, response_due_at, updated_at
  ) VALUES (
    p_professional_id, v_actor, 'pending', p_assignment_type, p_consent_scopes, 'care-team-v1',
    p_request_id, v_actor, v_credential.scope_statement,
    now() + make_interval(mins => v_credential.response_sla_minutes), now()
  )
  ON CONFLICT (coach_id, client_id) DO UPDATE
  SET status = 'pending',
      assignment_type = EXCLUDED.assignment_type,
      consent_scopes = EXCLUDED.consent_scopes,
      consent_version = EXCLUDED.consent_version,
      request_id = EXCLUDED.request_id,
      requested_by = EXCLUDED.requested_by,
      scope_statement_snapshot = EXCLUDED.scope_statement_snapshot,
      response_due_at = EXCLUDED.response_due_at,
      accepted_at = NULL,
      ended_at = NULL,
      end_reason = NULL,
      updated_at = now()
  WHERE coach_client_assignments.status = 'revoked'
  RETURNING * INTO v_assignment;

  IF v_assignment.id IS NULL THEN
    SELECT * INTO v_assignment
    FROM public.coach_client_assignments
    WHERE requested_by = v_actor AND request_id = p_request_id;
  END IF;
  IF v_assignment.id IS NULL THEN RAISE EXCEPTION 'CARE_REQUEST_ALREADY_PENDING'; END IF;

  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_actor, p_professional_id, v_actor, 'assignment.requested', 'care_assignment', v_assignment.id::TEXT,
    jsonb_build_object('assignment_type', p_assignment_type, 'consent_scopes', to_jsonb(p_consent_scopes)));

  RETURN jsonb_build_object('assignment_id', v_assignment.id, 'status', v_assignment.status, 'response_due_at', v_assignment.response_due_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_care_invite(
  p_assignment_type TEXT,
  p_consent_scopes TEXT[],
  p_client_label TEXT,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_credential public.care_professional_credentials%ROWTYPE;
  v_assignment public.coach_client_assignments%ROWTYPE;
  v_code TEXT;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT * INTO v_credential FROM public.care_professional_credentials
  WHERE user_id = v_actor AND verification_status = 'verified'
    AND license_expires_on >= CURRENT_DATE AND accepting_clients;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERIFIED_CARE_PROFESSIONAL_REQUIRED'; END IF;
  IF p_assignment_type NOT IN ('fitness_coaching', 'nutrition_guidance', 'integrated_care')
     OR (p_assignment_type IN ('nutrition_guidance', 'integrated_care') AND v_credential.professional_type <> 'dietitian')
  THEN RAISE EXCEPTION 'CARE_ASSIGNMENT_TYPE_OUTSIDE_SCOPE'; END IF;
  IF cardinality(COALESCE(p_consent_scopes, '{}'::TEXT[])) NOT BETWEEN 1 AND 9
     OR NOT p_consent_scopes <@ ARRAY['macros','weight','hydration','meal_adherence','workouts','health_context','labs','meal_response','messages']::TEXT[]
  THEN RAISE EXCEPTION 'CARE_CONSENT_SCOPES_INVALID'; END IF;

  SELECT * INTO v_assignment FROM public.coach_client_assignments
  WHERE requested_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('assignment_id', v_assignment.id, 'invite_code', v_assignment.invite_code, 'status', v_assignment.status, 'already_processed', true);
  END IF;

  LOOP
    v_code := 'NUTR-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.coach_client_assignments WHERE invite_code = v_code);
  END LOOP;

  INSERT INTO public.coach_client_assignments (
    coach_id, client_id, status, invite_code, assignment_type, consent_scopes,
    consent_version, request_id, requested_by, client_label, scope_statement_snapshot,
    response_due_at, updated_at
  ) VALUES (
    v_actor, NULL, 'pending', v_code, p_assignment_type, p_consent_scopes,
    'care-team-v1', p_request_id, v_actor, NULLIF(btrim(p_client_label), ''),
    v_credential.scope_statement, now() + INTERVAL '7 days', now()
  ) RETURNING * INTO v_assignment;

  INSERT INTO public.care_team_events (assignment_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_actor, v_actor, 'assignment.invite_created', 'care_assignment', v_assignment.id::TEXT,
    jsonb_build_object('assignment_type', p_assignment_type));
  RETURN jsonb_build_object('assignment_id', v_assignment.id, 'invite_code', v_code, 'status', 'pending', 'already_processed', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_care_invite(p_invite_code TEXT, p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_assignment public.coach_client_assignments%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT assignment.* INTO v_assignment
  FROM public.coach_client_assignments assignment
  JOIN public.care_professional_credentials credential ON credential.user_id = assignment.coach_id
  WHERE assignment.invite_code = upper(btrim(p_invite_code))
    AND assignment.client_id IS NULL AND assignment.status = 'pending'
    AND assignment.response_due_at > now()
    AND credential.verification_status = 'verified'
    AND credential.license_expires_on >= CURRENT_DATE
  FOR UPDATE OF assignment;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_INVITE_INVALID_OR_EXPIRED'; END IF;
  IF EXISTS (
    SELECT 1
    FROM public.coach_client_assignments active_assignment
    WHERE active_assignment.client_id = v_actor
      AND active_assignment.assignment_type = v_assignment.assignment_type
      AND active_assignment.status = 'active'
  ) THEN
    RAISE EXCEPTION 'ACTIVE_CARE_ASSIGNMENT_TYPE_EXISTS';
  END IF;

  UPDATE public.coach_client_assignments
  SET client_id = v_actor, status = 'active', requested_by = v_actor,
      request_id = p_request_id, accepted_at = now(), response_due_at = NULL, updated_at = now()
  WHERE id = v_assignment.id;

  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_actor, v_assignment.coach_id, v_actor, 'assignment.invite_accepted', 'care_assignment', v_assignment.id::TEXT,
    jsonb_build_object('consent_scopes', to_jsonb(v_assignment.consent_scopes)));
  RETURN jsonb_build_object('assignment_id', v_assignment.id, 'professional_id', v_assignment.coach_id, 'status', 'active');
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_care_assignment(p_assignment_id UUID, p_decision TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_assignment public.coach_client_assignments%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_decision NOT IN ('accept', 'decline') THEN RAISE EXCEPTION 'CARE_ASSIGNMENT_DECISION_INVALID'; END IF;
  SELECT assignment.* INTO v_assignment
  FROM public.coach_client_assignments assignment
  JOIN public.care_professional_credentials credential ON credential.user_id = assignment.coach_id
  WHERE assignment.id = p_assignment_id AND assignment.coach_id = v_actor
    AND assignment.client_id IS NOT NULL AND assignment.status = 'pending'
    AND credential.verification_status = 'verified' AND credential.license_expires_on >= CURRENT_DATE
  FOR UPDATE OF assignment;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_ASSIGNMENT_NOT_FOUND'; END IF;
  IF p_decision = 'accept' AND EXISTS (
    SELECT 1 FROM public.coach_client_assignments
    WHERE client_id = v_assignment.client_id
      AND assignment_type = v_assignment.assignment_type
      AND status = 'active'
      AND id <> v_assignment.id
  ) THEN RAISE EXCEPTION 'CLIENT_ALREADY_HAS_ACTIVE_CARE_ASSIGNMENT_TYPE'; END IF;

  UPDATE public.coach_client_assignments
  SET status = CASE WHEN p_decision = 'accept' THEN 'active' ELSE 'revoked' END,
      accepted_at = CASE WHEN p_decision = 'accept' THEN now() ELSE NULL END,
      ended_at = CASE WHEN p_decision = 'decline' THEN now() ELSE NULL END,
      end_reason = CASE WHEN p_decision = 'decline' THEN 'professional_declined' ELSE NULL END,
      response_due_at = NULL, updated_at = now()
  WHERE id = v_assignment.id;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_assignment.client_id, v_actor, v_actor, 'assignment.' || p_decision || 'ed', 'care_assignment', v_assignment.id::TEXT, '{}'::JSONB);
  RETURN jsonb_build_object('assignment_id', v_assignment.id, 'status', CASE WHEN p_decision = 'accept' THEN 'active' ELSE 'revoked' END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_care_assignment(p_assignment_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_assignment public.coach_client_assignments%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR char_length(COALESCE(btrim(p_reason), '')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'CARE_END_REASON_REQUIRED'; END IF;
  SELECT * INTO v_assignment FROM public.coach_client_assignments
  WHERE id = p_assignment_id AND status IN ('pending', 'active')
    AND (coach_id = v_actor OR client_id = v_actor)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_ASSIGNMENT_NOT_FOUND'; END IF;
  UPDATE public.coach_client_assignments
  SET status = 'revoked', ended_at = now(), end_reason = btrim(p_reason), response_due_at = NULL, updated_at = now()
  WHERE id = v_assignment.id;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_assignment.client_id, v_assignment.coach_id, v_actor, 'assignment.ended', 'care_assignment', v_assignment.id::TEXT,
    jsonb_build_object('reason', btrim(p_reason)));
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_care_note(p_assignment_id UUID, p_note_type TEXT, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_assignment public.coach_client_assignments%ROWTYPE;
  v_note public.coach_notes%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_note_type NOT IN ('progress','nutrition','training','barrier','safety','session')
     OR char_length(COALESCE(btrim(p_note), '')) NOT BETWEEN 3 AND 4000
  THEN RAISE EXCEPTION 'CARE_NOTE_INVALID'; END IF;
  SELECT assignment.* INTO v_assignment FROM public.coach_client_assignments assignment
  JOIN public.care_professional_credentials credential ON credential.user_id = assignment.coach_id
  WHERE assignment.id = p_assignment_id AND assignment.coach_id = v_actor AND assignment.status = 'active'
    AND credential.verification_status = 'verified' AND credential.license_expires_on >= CURRENT_DATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_VERIFIED_CARE_ASSIGNMENT_REQUIRED'; END IF;
  INSERT INTO public.coach_notes (coach_id, client_id, assignment_id, note_type, note)
  VALUES (v_actor, v_assignment.client_id, v_assignment.id, p_note_type, btrim(p_note))
  RETURNING * INTO v_note;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_assignment.client_id, v_actor, v_actor, 'note.created', 'care_note', v_note.id::TEXT,
    jsonb_build_object('note_type', p_note_type));
  RETURN to_jsonb(v_note);
END;
$function$;

CREATE OR REPLACE FUNCTION public.amend_care_note(p_note_id UUID, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_old public.coach_notes%ROWTYPE;
  v_new public.coach_notes%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR char_length(COALESCE(btrim(p_note), '')) NOT BETWEEN 3 AND 4000 THEN RAISE EXCEPTION 'CARE_NOTE_INVALID'; END IF;
  SELECT note.* INTO v_old FROM public.coach_notes note
  JOIN public.coach_client_assignments assignment ON assignment.id = note.assignment_id
  WHERE note.id = p_note_id AND note.coach_id = v_actor AND note.status = 'active' AND assignment.status = 'active'
  FOR UPDATE OF note;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_NOTE_NOT_FOUND'; END IF;
  UPDATE public.coach_notes SET status = 'corrected', updated_at = now() WHERE id = v_old.id;
  INSERT INTO public.coach_notes (coach_id, client_id, assignment_id, note_type, note, supersedes_note_id)
  VALUES (v_old.coach_id, v_old.client_id, v_old.assignment_id, v_old.note_type, btrim(p_note), v_old.id)
  RETURNING * INTO v_new;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_old.assignment_id, v_old.client_id, v_actor, v_actor, 'note.corrected', 'care_note', v_new.id::TEXT,
    jsonb_build_object('supersedes_note_id', v_old.id));
  RETURN to_jsonb(v_new);
END;
$function$;

CREATE OR REPLACE FUNCTION public.archive_care_note(p_note_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_old public.coach_notes%ROWTYPE;
BEGIN
  SELECT note.* INTO v_old FROM public.coach_notes note
  JOIN public.coach_client_assignments assignment ON assignment.id = note.assignment_id
  WHERE note.id = p_note_id AND note.coach_id = v_actor AND note.status = 'active' AND assignment.status = 'active'
  FOR UPDATE OF note;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_NOTE_NOT_FOUND'; END IF;
  UPDATE public.coach_notes SET status = 'archived', updated_at = now() WHERE id = v_old.id;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_old.assignment_id, v_old.client_id, v_actor, v_actor, 'note.archived', 'care_note', v_old.id::TEXT, '{}'::JSONB);
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_care_session(
  p_assignment_id UUID, p_title TEXT, p_description TEXT, p_session_type TEXT,
  p_scheduled_at TIMESTAMPTZ, p_duration_minutes INTEGER, p_notes TEXT, p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_assignment public.coach_client_assignments%ROWTYPE;
  v_session public.coach_sessions%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL
     OR char_length(COALESCE(btrim(p_title), '')) NOT BETWEEN 3 AND 120
     OR p_session_type NOT IN ('video_call','in_person','phone_call','check_in')
     OR p_scheduled_at <= now() OR p_duration_minutes NOT BETWEEN 15 AND 180
  THEN RAISE EXCEPTION 'CARE_SESSION_INVALID'; END IF;
  SELECT assignment.* INTO v_assignment FROM public.coach_client_assignments assignment
  JOIN public.care_professional_credentials credential ON credential.user_id = assignment.coach_id
  WHERE assignment.id = p_assignment_id AND assignment.coach_id = v_actor AND assignment.status = 'active'
    AND credential.verification_status = 'verified' AND credential.license_expires_on >= CURRENT_DATE
    AND 'schedule_sessions' = ANY(credential.allowed_actions);
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_SESSION_OUTSIDE_SCOPE'; END IF;
  INSERT INTO public.coach_sessions (
    coach_id, client_id, assignment_id, title, description, session_type,
    scheduled_at, duration_minutes, notes, request_id
  ) VALUES (
    v_actor, v_assignment.client_id, v_assignment.id, btrim(p_title), NULLIF(btrim(p_description), ''), p_session_type,
    p_scheduled_at, p_duration_minutes, NULLIF(btrim(p_notes), ''), p_request_id
  )
  ON CONFLICT (coach_id, request_id) WHERE request_id IS NOT NULL DO UPDATE SET updated_at = coach_sessions.updated_at
  RETURNING * INTO v_session;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_assignment.client_id, v_actor, v_actor, 'session.created', 'care_session', v_session.id::TEXT,
    jsonb_build_object('session_type', p_session_type, 'scheduled_at', p_scheduled_at));
  RETURN to_jsonb(v_session);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_care_session(
  p_session_id UUID,
  p_status TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_meeting_link TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_cancellation_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_session public.coach_sessions%ROWTYPE;
  v_is_professional BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  SELECT session.* INTO v_session FROM public.coach_sessions session
  JOIN public.coach_client_assignments assignment ON assignment.id = session.assignment_id
  WHERE session.id = p_session_id AND assignment.status = 'active'
    AND (session.coach_id = v_actor OR session.client_id = v_actor)
  FOR UPDATE OF session;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_SESSION_NOT_FOUND'; END IF;
  v_is_professional := v_session.coach_id = v_actor;
  IF NOT v_is_professional AND (
    p_status NOT IN ('confirmed', 'cancelled')
    OR p_title IS NOT NULL OR p_description IS NOT NULL OR p_meeting_link IS NOT NULL OR p_notes IS NOT NULL
  ) THEN RAISE EXCEPTION 'CLIENT_SESSION_UPDATE_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('scheduled','confirmed','completed','cancelled','no_show') THEN RAISE EXCEPTION 'CARE_SESSION_STATUS_INVALID'; END IF;
  IF p_status = 'cancelled' AND char_length(COALESCE(btrim(p_cancellation_reason), '')) < 3 THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED'; END IF;

  UPDATE public.coach_sessions
  SET status = COALESCE(p_status, status),
      title = CASE WHEN v_is_professional THEN COALESCE(NULLIF(btrim(p_title), ''), title) ELSE title END,
      description = CASE WHEN v_is_professional AND p_description IS NOT NULL THEN NULLIF(btrim(p_description), '') ELSE description END,
      meeting_link = CASE WHEN v_is_professional AND p_meeting_link IS NOT NULL THEN NULLIF(btrim(p_meeting_link), '') ELSE meeting_link END,
      notes = CASE WHEN v_is_professional AND p_notes IS NOT NULL THEN NULLIF(btrim(p_notes), '') ELSE notes END,
      cancellation_reason = CASE WHEN p_status = 'cancelled' THEN btrim(p_cancellation_reason) ELSE cancellation_reason END,
      updated_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_session;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_session.assignment_id, v_session.client_id, v_session.coach_id, v_actor, 'session.updated', 'care_session', v_session.id::TEXT,
    jsonb_build_object('status', v_session.status));
  RETURN to_jsonb(v_session);
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_care_plan(
  p_assignment_id UUID, p_plan_kind TEXT, p_source_entity_id UUID,
  p_plan_version INTEGER, p_plan_snapshot JSONB, p_decision TEXT,
  p_rationale TEXT, p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_assignment public.coach_client_assignments%ROWTYPE;
  v_review public.care_plan_reviews%ROWTYPE;
  v_required_action TEXT;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL OR p_plan_kind NOT IN ('nutrition_goal','meal_plan','training_plan','health_program')
     OR p_plan_version < 1 OR jsonb_typeof(COALESCE(p_plan_snapshot, 'null'::JSONB)) <> 'object'
     OR char_length(p_plan_snapshot::TEXT) > 20000
     OR p_decision NOT IN ('approved','changes_required','outside_scope')
     OR char_length(COALESCE(btrim(p_rationale), '')) NOT BETWEEN 10 AND 2000
  THEN RAISE EXCEPTION 'CARE_PLAN_REVIEW_INVALID'; END IF;
  v_required_action := CASE WHEN p_plan_kind = 'training_plan' THEN 'approve_training_plan' ELSE 'approve_nutrition_plan' END;
  SELECT assignment.* INTO v_assignment FROM public.coach_client_assignments assignment
  JOIN public.care_professional_credentials credential ON credential.user_id = assignment.coach_id
  WHERE assignment.id = p_assignment_id AND assignment.coach_id = v_actor AND assignment.status = 'active'
    AND credential.verification_status = 'verified' AND credential.license_expires_on >= CURRENT_DATE
    AND v_required_action = ANY(credential.allowed_actions);
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_PLAN_REVIEW_OUTSIDE_SCOPE'; END IF;
  INSERT INTO public.care_plan_reviews (
    assignment_id, client_id, professional_id, plan_kind, source_entity_id,
    plan_version, plan_snapshot, decision, rationale, request_id
  ) VALUES (
    v_assignment.id, v_assignment.client_id, v_actor, p_plan_kind, p_source_entity_id,
    p_plan_version, p_plan_snapshot, p_decision, btrim(p_rationale), p_request_id
  )
  ON CONFLICT (professional_id, request_id) DO UPDATE SET request_id = care_plan_reviews.request_id
  RETURNING * INTO v_review;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_assignment.client_id, v_actor, v_actor, 'plan.' || p_decision, 'care_plan_review', v_review.id::TEXT,
    jsonb_build_object('plan_kind', p_plan_kind, 'plan_version', p_plan_version));
  RETURN to_jsonb(v_review) - 'plan_snapshot';
END;
$function$;

CREATE OR REPLACE FUNCTION public.acknowledge_care_plan_review(p_review_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_actor UUID := auth.uid(); v_review public.care_plan_reviews%ROWTYPE;
BEGIN
  UPDATE public.care_plan_reviews SET acknowledged_at = COALESCE(acknowledged_at, now())
  WHERE id = p_review_id AND client_id = v_actor
  RETURNING * INTO v_review;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_PLAN_REVIEW_NOT_FOUND'; END IF;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_review.assignment_id, v_actor, v_review.professional_id, v_actor, 'plan.acknowledged', 'care_plan_review', v_review.id::TEXT, '{}'::JSONB);
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.open_care_escalation(
  p_assignment_id UUID, p_category TEXT, p_severity TEXT, p_summary TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_actor UUID := auth.uid(); v_assignment public.coach_client_assignments%ROWTYPE; v_id UUID; v_due TIMESTAMPTZ;
BEGIN
  IF v_actor IS NULL OR p_category NOT IN ('response_overdue','scope_question','safety_concern','service_issue','handoff_required')
     OR p_severity NOT IN ('normal','high','urgent')
     OR char_length(COALESCE(btrim(p_summary), '')) NOT BETWEEN 10 AND 1000
  THEN RAISE EXCEPTION 'CARE_ESCALATION_INVALID'; END IF;
  SELECT * INTO v_assignment FROM public.coach_client_assignments
  WHERE id = p_assignment_id AND status = 'active' AND (coach_id = v_actor OR client_id = v_actor);
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_ASSIGNMENT_NOT_FOUND'; END IF;
  v_due := now() + CASE p_severity WHEN 'urgent' THEN INTERVAL '15 minutes' WHEN 'high' THEN INTERVAL '1 hour' ELSE INTERVAL '4 hours' END;
  INSERT INTO public.care_escalations (
    assignment_id, client_id, professional_id, opened_by, category, severity, summary, due_at
  ) VALUES (
    v_assignment.id, v_assignment.client_id, v_assignment.coach_id, v_actor, p_category, p_severity, btrim(p_summary), v_due
  ) RETURNING id INTO v_id;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_assignment.id, v_assignment.client_id, v_assignment.coach_id, v_actor, 'escalation.opened', 'care_escalation', v_id::TEXT,
    jsonb_build_object('category', p_category, 'severity', p_severity, 'due_at', v_due));
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_care_escalation(p_escalation_id UUID, p_action TEXT, p_resolution TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_actor UUID := auth.uid(); v_escalation public.care_escalations%ROWTYPE; v_is_admin BOOLEAN;
BEGIN
  IF v_actor IS NULL OR p_action NOT IN ('acknowledge','resolve','cancel') THEN RAISE EXCEPTION 'CARE_ESCALATION_ACTION_INVALID'; END IF;
  v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  SELECT * INTO v_escalation FROM public.care_escalations
  WHERE id = p_escalation_id AND status IN ('open','acknowledged')
    AND (professional_id = v_actor OR v_is_admin)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_ESCALATION_NOT_FOUND'; END IF;
  IF p_action IN ('resolve','cancel') AND char_length(COALESCE(btrim(p_resolution), '')) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'CARE_ESCALATION_RESOLUTION_REQUIRED';
  END IF;
  UPDATE public.care_escalations
  SET status = CASE p_action WHEN 'acknowledge' THEN 'acknowledged' WHEN 'resolve' THEN 'resolved' ELSE 'cancelled' END,
      acknowledged_by = CASE WHEN p_action = 'acknowledge' THEN v_actor ELSE acknowledged_by END,
      acknowledged_at = CASE WHEN p_action = 'acknowledge' THEN now() ELSE acknowledged_at END,
      resolved_by = CASE WHEN p_action IN ('resolve','cancel') THEN v_actor ELSE resolved_by END,
      resolved_at = CASE WHEN p_action IN ('resolve','cancel') THEN now() ELSE resolved_at END,
      resolution = CASE WHEN p_action IN ('resolve','cancel') THEN btrim(p_resolution) ELSE resolution END,
      updated_at = now()
  WHERE id = v_escalation.id;
  INSERT INTO public.care_team_events (assignment_id, client_id, professional_id, actor_id, event_type, resource_type, resource_id, metadata)
  VALUES (v_escalation.assignment_id, v_escalation.client_id, v_escalation.professional_id, v_actor,
    'escalation.' || p_action, 'care_escalation', v_escalation.id::TEXT, '{}'::JSONB);
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_care_message_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_sla INTEGER;
BEGIN
  SELECT credential.response_sla_minutes INTO v_sla
  FROM public.care_professional_credentials credential
  WHERE credential.user_id = NEW.coach_id;
  IF NEW.sender_role = 'client' THEN
    UPDATE public.coach_client_assignments
    SET response_due_at = COALESCE(response_due_at, now() + make_interval(mins => COALESCE(v_sla, 1440))), updated_at = now()
    WHERE coach_id = NEW.coach_id AND client_id = NEW.client_id AND status = 'active';
  ELSE
    UPDATE public.coach_client_assignments
    SET response_due_at = NULL, last_professional_response_at = now(), updated_at = now()
    WHERE coach_id = NEW.coach_id AND client_id = NEW.client_id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS track_care_message_sla_trigger ON public.coach_messages;
CREATE TRIGGER track_care_message_sla_trigger
  AFTER INSERT ON public.coach_messages
  FOR EACH ROW EXECUTE FUNCTION public.track_care_message_sla();

CREATE OR REPLACE FUNCTION public.escalate_overdue_care_responses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO public.care_escalations (
    assignment_id, client_id, professional_id, opened_by,
    category, severity, summary, due_at
  )
  SELECT assignment.id, assignment.client_id, assignment.coach_id, NULL,
    'response_overdue', 'high',
    'The care-team response SLA elapsed without a professional reply.',
    now() + INTERVAL '1 hour'
  FROM public.coach_client_assignments assignment
  WHERE assignment.status = 'active'
    AND assignment.response_due_at IS NOT NULL
    AND assignment.response_due_at <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.care_escalations escalation
      WHERE escalation.assignment_id = assignment.id
        AND escalation.category = 'response_overdue'
        AND escalation.status IN ('open','acknowledged')
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'care-team-sla-escalation';
    PERFORM cron.schedule('care-team-sla-escalation', '*/15 * * * *', 'SELECT public.escalate_overdue_care_responses();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable for care-team SLA; invoke escalate_overdue_care_responses from the operations worker';
END;
$do$;

REVOKE ALL ON FUNCTION public.submit_care_professional_application(TEXT,TEXT,TEXT[],TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT[],TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_care_professional_application(UUID,TEXT,TEXT,TEXT,TEXT[],TEXT,INTEGER,INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_verified_care_professionals() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_care_professional(UUID,TEXT,TEXT[],UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_care_invite(TEXT,TEXT[],TEXT,UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_care_invite(TEXT,UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_care_assignment(UUID,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_care_assignment(UUID,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_care_note(UUID,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.amend_care_note(UUID,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_care_note(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_care_session(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,TEXT,UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_care_session(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_care_plan(UUID,TEXT,UUID,INTEGER,JSONB,TEXT,TEXT,UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.acknowledge_care_plan_review(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_care_escalation(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_care_escalation(UUID,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.escalate_overdue_care_responses() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_care_professional_application(TEXT,TEXT,TEXT[],TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT[],TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_care_professional_application(UUID,TEXT,TEXT,TEXT,TEXT[],TEXT,INTEGER,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_verified_care_professionals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_care_professional(UUID,TEXT,TEXT[],UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_care_invite(TEXT,TEXT[],TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_care_invite(TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_care_assignment(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_care_assignment(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_care_note(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.amend_care_note(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_care_note(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_care_session(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_care_session(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_care_plan(UUID,TEXT,UUID,INTEGER,JSONB,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_care_plan_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_care_escalation(UUID,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_care_escalation(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_care_responses() TO service_role;

COMMENT ON TABLE public.care_professional_credentials IS
  'Private, admin-verified professional credentials and explicit wellness-scope boundaries.';
COMMENT ON TABLE public.care_plan_reviews IS
  'Versioned professional review evidence for nutrition, training, and program plans.';
COMMENT ON TABLE public.care_escalations IS
  'SLA, scope, safety, service, and handoff escalations for active care-team assignments.';
COMMENT ON FUNCTION public.list_verified_care_professionals() IS
  'Returns only public-safe profiles for currently verified, unexpired care professionals.';

COMMIT;
