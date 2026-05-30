-- Migration: Coach Reviews
-- Allows clients to rate and review their coaches

CREATE TABLE IF NOT EXISTS coach_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coach_id, client_id)
);

-- Index for coach's reviews by rating
CREATE INDEX IF NOT EXISTS idx_coach_reviews_coach
  ON coach_reviews(coach_id, rating DESC, created_at DESC);

-- Enable RLS
ALTER TABLE coach_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view reviews (for directory display)
CREATE POLICY "public_read_reviews" ON coach_reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- Clients can insert their own review (must have an active or past subscription)
CREATE POLICY "clients_insert_own_review" ON coach_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM coach_subscriptions
      WHERE coach_id = coach_reviews.coach_id
        AND client_id = auth.uid()
    )
  );

-- Clients can update their own review
CREATE POLICY "clients_update_own_review" ON coach_reviews
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Rating summary view for coach directory display
CREATE OR REPLACE VIEW coach_rating_summary AS
SELECT
  coach_id,
  ROUND(AVG(rating), 1) AS average_rating,
  COUNT(*) AS total_reviews,
  COUNT(*) FILTER (WHERE rating = 5) AS five_star,
  COUNT(*) FILTER (WHERE rating = 4) AS four_star,
  COUNT(*) FILTER (WHERE rating = 3) AS three_star,
  COUNT(*) FILTER (WHERE rating = 2) AS two_star,
  COUNT(*) FILTER (WHERE rating = 1) AS one_star
FROM coach_reviews
GROUP BY coach_id;
