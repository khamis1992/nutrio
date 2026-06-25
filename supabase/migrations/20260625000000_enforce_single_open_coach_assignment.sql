-- A customer can only have one open coach relationship at a time.
-- Open means either an active coach or a pending coach request.

WITH active_clients AS (
  SELECT DISTINCT client_id
  FROM public.coach_client_assignments
  WHERE client_id IS NOT NULL
    AND status = 'active'
),
pending_to_cancel AS (
  SELECT cca.id
  FROM public.coach_client_assignments cca
  JOIN active_clients ac ON ac.client_id = cca.client_id
  WHERE cca.status = 'pending'
)
UPDATE public.coach_client_assignments cca
SET status = 'revoked',
    updated_at = now()
FROM pending_to_cancel pc
WHERE cca.id = pc.id;

WITH ranked_open AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY client_id
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.coach_client_assignments
  WHERE client_id IS NOT NULL
    AND status IN ('active', 'pending')
)
UPDATE public.coach_client_assignments cca
SET status = 'revoked',
    updated_at = now()
FROM ranked_open ro
WHERE cca.id = ro.id
  AND ro.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS coach_client_assignments_one_open_per_client_idx
ON public.coach_client_assignments (client_id)
WHERE client_id IS NOT NULL
  AND status IN ('active', 'pending');

CREATE OR REPLACE FUNCTION public.replace_client_coach(p_new_coach_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_assignment_id uuid;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_new_coach_id IS NULL OR p_new_coach_id = v_client_id THEN
    RAISE EXCEPTION 'Invalid coach';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_new_coach_id
      AND role = 'coach'
  ) THEN
    RAISE EXCEPTION 'Coach not found';
  END IF;

  UPDATE public.coach_client_assignments
  SET status = 'revoked',
      updated_at = now()
  WHERE client_id = v_client_id
    AND status = 'pending';

  UPDATE public.coach_client_assignments
  SET status = 'revoked',
      updated_at = now()
  WHERE client_id = v_client_id
    AND status = 'active'
    AND coach_id <> p_new_coach_id;

  SELECT id
  INTO v_assignment_id
  FROM public.coach_client_assignments
  WHERE client_id = v_client_id
    AND coach_id = p_new_coach_id
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
  LIMIT 1;

  IF v_assignment_id IS NULL THEN
    INSERT INTO public.coach_client_assignments (client_id, coach_id, status)
    VALUES (v_client_id, p_new_coach_id, 'active')
    RETURNING id INTO v_assignment_id;
  ELSE
    UPDATE public.coach_client_assignments
    SET status = 'active',
        updated_at = now()
    WHERE id = v_assignment_id
    RETURNING id INTO v_assignment_id;
  END IF;

  RETURN v_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_client_coach(uuid) TO authenticated;
