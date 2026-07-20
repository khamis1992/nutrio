BEGIN;

UPDATE public.health_programs
SET status = 'published', updated_at = now()
WHERE slug = 'glp1-nutrition-strength-support'
  AND status = 'draft';

COMMENT ON TABLE public.health_programs IS
  'Public program catalog. A published catalog record is not enrollable until one reviewed protocol version is also published.';

COMMIT;
