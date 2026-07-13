BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'coach_reviews'
      AND column_name = 'review'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'coach_reviews'
      AND column_name = 'review_text'
  ) THEN
    ALTER TABLE public.coach_reviews RENAME COLUMN review TO review_text;
  END IF;
END;
$$;

ALTER TABLE public.coach_reviews
  ADD COLUMN IF NOT EXISTS review_text TEXT;

CREATE OR REPLACE VIEW public.coach_rating_summary
WITH (security_invoker = true)
AS
SELECT
  coach_id,
  ROUND(AVG(rating), 1) AS average_rating,
  COUNT(*) AS total_reviews,
  COUNT(*) FILTER (WHERE rating = 5) AS five_star,
  COUNT(*) FILTER (WHERE rating = 4) AS four_star,
  COUNT(*) FILTER (WHERE rating = 3) AS three_star,
  COUNT(*) FILTER (WHERE rating = 2) AS two_star,
  COUNT(*) FILTER (WHERE rating = 1) AS one_star
FROM public.coach_reviews
GROUP BY coach_id;

REVOKE ALL ON public.coach_rating_summary FROM PUBLIC, anon;
GRANT SELECT ON public.coach_rating_summary TO authenticated, service_role;

COMMIT;
