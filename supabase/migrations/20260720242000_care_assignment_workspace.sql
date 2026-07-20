BEGIN;

CREATE OR REPLACE FUNCTION public.get_care_assignment_workspace(p_assignment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_assignment public.coach_client_assignments%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT assignment.* INTO v_assignment
  FROM public.coach_client_assignments assignment
  WHERE assignment.id = p_assignment_id
    AND (
      assignment.coach_id = v_actor
      OR assignment.client_id = v_actor
      OR public.has_role(v_actor, 'admin'::public.app_role)
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'CARE_ASSIGNMENT_NOT_FOUND'; END IF;

  RETURN jsonb_build_object(
    'assignment', jsonb_build_object(
      'id', v_assignment.id,
      'coach_id', v_assignment.coach_id,
      'client_id', v_assignment.client_id,
      'status', v_assignment.status,
      'invite_code', CASE WHEN v_assignment.coach_id = v_actor THEN v_assignment.invite_code ELSE NULL END,
      'assignment_type', v_assignment.assignment_type,
      'consent_scopes', to_jsonb(v_assignment.consent_scopes),
      'consent_version', v_assignment.consent_version,
      'accepted_at', v_assignment.accepted_at,
      'ended_at', v_assignment.ended_at,
      'response_due_at', v_assignment.response_due_at,
      'scope_statement_snapshot', v_assignment.scope_statement_snapshot
    ),
    'reviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', review.id,
        'plan_kind', review.plan_kind,
        'plan_version', review.plan_version,
        'decision', review.decision,
        'rationale', review.rationale,
        'reviewed_at', review.reviewed_at,
        'acknowledged_at', review.acknowledged_at
      ) ORDER BY review.reviewed_at DESC)
      FROM public.care_plan_reviews review
      WHERE review.assignment_id = v_assignment.id
    ), '[]'::JSONB),
    'escalations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', escalation.id,
        'category', escalation.category,
        'severity', escalation.severity,
        'status', escalation.status,
        'summary', escalation.summary,
        'due_at', escalation.due_at,
        'resolution', escalation.resolution
      ) ORDER BY escalation.created_at DESC)
      FROM public.care_escalations escalation
      WHERE escalation.assignment_id = v_assignment.id
    ), '[]'::JSONB)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_care_assignment_workspace(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_care_assignment_workspace(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_care_assignment_workspace(UUID) IS
  'Participant-scoped workspace projection for care assignment reviews and escalations; excludes plan snapshots and internal audit metadata.';

NOTIFY pgrst, 'reload schema';

COMMIT;
