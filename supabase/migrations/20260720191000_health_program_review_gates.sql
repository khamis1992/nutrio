BEGIN;

CREATE TABLE IF NOT EXISTS public.health_program_review_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_version_id UUID NOT NULL REFERENCES public.health_program_versions(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL CHECK (gate_type IN ('qatar_legal', 'licensed_dietitian', 'medical_safety', 'privacy_dpia')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_name TEXT,
  evidence_reference TEXT,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_version_id, gate_type),
  CHECK (reviewer_name IS NULL OR char_length(reviewer_name) <= 160),
  CHECK (evidence_reference IS NULL OR char_length(evidence_reference) <= 500),
  CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  CHECK (status = 'pending' OR (reviewer_name IS NOT NULL AND evidence_reference IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.health_program_review_gate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id UUID NOT NULL REFERENCES public.health_program_review_gates(id) ON DELETE CASCADE,
  program_version_id UUID NOT NULL REFERENCES public.health_program_versions(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL,
  status TEXT NOT NULL,
  reviewer_name TEXT,
  evidence_reference TEXT,
  review_note TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_program_review_events_version_idx
  ON public.health_program_review_gate_events(program_version_id, created_at DESC);

ALTER TABLE public.health_program_review_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_review_gate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_program_review_gates_admin_read ON public.health_program_review_gates
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY health_program_review_events_admin_read ON public.health_program_review_gate_events
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON public.health_program_review_gates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.health_program_review_gates
FOR EACH ROW EXECUTE FUNCTION public.health_program_set_updated_at();

CREATE OR REPLACE FUNCTION public.review_health_program_gate(
  p_program_version_id UUID,
  p_gate_type TEXT,
  p_status TEXT,
  p_reviewer_name TEXT,
  p_evidence_reference TEXT,
  p_review_note TEXT DEFAULT NULL
)
RETURNS public.health_program_review_gates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gate public.health_program_review_gates;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_gate_type NOT IN ('qatar_legal', 'licensed_dietitian', 'medical_safety', 'privacy_dpia') THEN
    RAISE EXCEPTION 'Invalid review gate';
  END IF;
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN RAISE EXCEPTION 'Invalid review status'; END IF;
  IF p_status <> 'pending' AND (nullif(trim(p_reviewer_name), '') IS NULL OR nullif(trim(p_evidence_reference), '') IS NULL) THEN
    RAISE EXCEPTION 'Reviewer and evidence reference are required';
  END IF;

  INSERT INTO public.health_program_review_gates (
    program_version_id, gate_type, status, reviewer_name, evidence_reference,
    review_note, reviewed_at, reviewed_by
  ) VALUES (
    p_program_version_id, p_gate_type, p_status,
    nullif(trim(p_reviewer_name), ''), nullif(trim(p_evidence_reference), ''),
    nullif(trim(p_review_note), ''), CASE WHEN p_status = 'pending' THEN NULL ELSE now() END,
    auth.uid()
  )
  ON CONFLICT (program_version_id, gate_type) DO UPDATE SET
    status = EXCLUDED.status,
    reviewer_name = EXCLUDED.reviewer_name,
    evidence_reference = EXCLUDED.evidence_reference,
    review_note = EXCLUDED.review_note,
    reviewed_at = EXCLUDED.reviewed_at,
    reviewed_by = EXCLUDED.reviewed_by
  RETURNING * INTO v_gate;

  INSERT INTO public.health_program_review_gate_events (
    gate_id, program_version_id, gate_type, status, reviewer_name,
    evidence_reference, review_note, actor_id
  ) VALUES (
    v_gate.id, v_gate.program_version_id, v_gate.gate_type, v_gate.status,
    v_gate.reviewer_name, v_gate.evidence_reference, v_gate.review_note, auth.uid()
  );
  RETURN v_gate;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_health_program_publication_gates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_approved INTEGER;
BEGIN
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    SELECT count(DISTINCT gate_type) INTO v_approved
    FROM public.health_program_review_gates
    WHERE program_version_id = NEW.id AND status = 'approved';
    IF v_approved <> 4 THEN
      RAISE EXCEPTION 'All four external review gates must be approved before publication';
    END IF;
    NEW.reviewed_at := now();
    NEW.reviewed_by := auth.uid();
    NEW.effective_at := coalesce(NEW.effective_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_publication_gates ON public.health_program_versions;
CREATE TRIGGER enforce_publication_gates
BEFORE UPDATE OF status ON public.health_program_versions
FOR EACH ROW EXECUTE FUNCTION public.enforce_health_program_publication_gates();

CREATE OR REPLACE FUNCTION public.publish_health_program_version(p_program_version_id UUID)
RETURNS public.health_program_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version public.health_program_versions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  UPDATE public.health_program_versions SET status = 'published'
  WHERE id = p_program_version_id AND status = 'draft'
  RETURNING * INTO v_version;
  IF v_version.id IS NULL THEN RAISE EXCEPTION 'Draft program version not found'; END IF;
  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.review_health_program_gate(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_health_program_version(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_health_program_gate(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_health_program_version(UUID) TO authenticated;

INSERT INTO public.health_program_review_gates (program_version_id, gate_type)
SELECT hpv.id, gate_type
FROM public.health_program_versions hpv
CROSS JOIN unnest(ARRAY['qatar_legal','licensed_dietitian','medical_safety','privacy_dpia']) AS gate_type
JOIN public.health_programs hp ON hp.id = hpv.program_id
WHERE hp.slug = 'glp1-nutrition-strength-support' AND hpv.version = 1
ON CONFLICT (program_version_id, gate_type) DO NOTHING;

COMMIT;
