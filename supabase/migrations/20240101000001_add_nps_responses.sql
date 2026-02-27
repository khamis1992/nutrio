-- Migration: NPS Responses (Net Promoter Score)
-- Date: 2024-01-01
-- Description: Creates table for tracking Net Promoter Score ratings and feedback

-- ========================================
-- STEP 1: Create nps_responses table
-- ========================================

CREATE TABLE IF NOT EXISTS public.nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  meal_schedule_id UUID REFERENCES public.meal_schedules(id) ON DELETE SET NULL,
  
  -- NPS core fields
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  feedback_text TEXT,
  
  -- Categorization (auto-calculated)
  category TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN score >= 9 THEN 'promoter'
      WHEN score >= 7 THEN 'passive'
      ELSE 'detractor'
    END
  ) STORED,
  
  -- Response context
  survey_trigger TEXT CHECK (survey_trigger IN ('post_delivery', 'post_order', 'periodic', 'manual', 'app_prompt')),
  responded_at TIMESTAMPTZ DEFAULT now(),
  
  -- Follow-up fields
  follow_up_sent BOOLEAN DEFAULT false,
  follow_up_sent_at TIMESTAMPTZ,
  follow_up_response TEXT,
  
  -- Admin fields
  admin_notes TEXT,
  is_featured BOOLEAN DEFAULT false,
  featured_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one response per order per user
  UNIQUE (user_id, order_id)
);

-- ========================================
-- STEP 2: Create indexes for performance
-- ========================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_nps_responses_user_id ON public.nps_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_nps_responses_order_id ON public.nps_responses(order_id);
CREATE INDEX IF NOT EXISTS idx_nps_responses_meal_schedule_id ON public.nps_responses(meal_schedule_id);

-- Analysis indexes
CREATE INDEX IF NOT EXISTS idx_nps_responses_score ON public.nps_responses(score);
CREATE INDEX IF NOT EXISTS idx_nps_responses_category ON public.nps_responses(category);
CREATE INDEX IF NOT EXISTS idx_nps_responses_responded_at ON public.nps_responses(responded_at DESC);
CREATE INDEX IF NOT EXISTS idx_nps_responses_survey_trigger ON public.nps_responses(survey_trigger);

-- Filtering indexes
CREATE INDEX IF NOT EXISTS idx_nps_responses_featured ON public.nps_responses(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_nps_responses_follow_up ON public.nps_responses(follow_up_sent) WHERE follow_up_sent = false;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nps_responses_user_responded ON public.nps_responses(user_id, responded_at DESC);

-- ========================================
-- STEP 3: Enable RLS
-- ========================================

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

-- Users can view their own NPS responses
DROP POLICY IF EXISTS "Users can view their own NPS responses" ON public.nps_responses;
CREATE POLICY "Users can view their own NPS responses"
  ON public.nps_responses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own NPS responses
DROP POLICY IF EXISTS "Users can create their own NPS responses" ON public.nps_responses;
CREATE POLICY "Users can create their own NPS responses"
  ON public.nps_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own responses (only for follow-up fields within 24 hours)
DROP POLICY IF EXISTS "Users can update their own NPS responses" ON public.nps_responses;
CREATE POLICY "Users can update their own NPS responses"
  ON public.nps_responses FOR UPDATE
  USING (
    auth.uid() = user_id 
    AND created_at > now() - interval '24 hours'
  );

-- Admins can view all NPS responses
DROP POLICY IF EXISTS "Admins can view all NPS responses" ON public.nps_responses;
CREATE POLICY "Admins can view all NPS responses"
  ON public.nps_responses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all NPS responses
DROP POLICY IF EXISTS "Admins can manage NPS responses" ON public.nps_responses;
CREATE POLICY "Admins can manage NPS responses"
  ON public.nps_responses FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- STEP 4: Create helper functions
-- ========================================

-- Function to calculate NPS score for a date range
CREATE OR REPLACE FUNCTION public.calculate_nps_score(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_responses BIGINT,
  promoters BIGINT,
  passives BIGINT,
  detractors BIGINT,
  nps_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE score >= 9) as promoter_count,
      COUNT(*) FILTER (WHERE score >= 7 AND score <= 8) as passive_count,
      COUNT(*) FILTER (WHERE score <= 6) as detractor_count
    FROM public.nps_responses
    WHERE (p_start_date IS NULL OR responded_at::date >= p_start_date)
      AND (p_end_date IS NULL OR responded_at::date <= p_end_date)
  )
  SELECT 
    counts.total,
    counts.promoter_count,
    counts.passive_count,
    counts.detractor_count,
    CASE 
      WHEN counts.total = 0 THEN 0
      ELSE ROUND(((counts.promoter_count::NUMERIC - counts.detractor_count::NUMERIC) / counts.total::NUMERIC) * 100, 2)
    END as nps_score
  FROM counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get NPS trend by month
CREATE OR REPLACE FUNCTION public.get_nps_trend_by_month(
  p_months INTEGER DEFAULT 6
)
RETURNS TABLE(
  month TEXT,
  total_responses BIGINT,
  nps_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_scores AS (
    SELECT 
      TO_CHAR(DATE_TRUNC('month', responded_at), 'YYYY-MM') as month_key,
      COUNT(*) as responses,
      COUNT(*) FILTER (WHERE score >= 9) as promoters,
      COUNT(*) FILTER (WHERE score <= 6) as detractors
    FROM public.nps_responses
    WHERE responded_at >= now() - (p_months || ' months')::interval
    GROUP BY DATE_TRUNC('month', responded_at)
  )
  SELECT 
    monthly_scores.month_key,
    monthly_scores.responses,
    CASE 
      WHEN monthly_scores.responses = 0 THEN 0
      ELSE ROUND(((monthly_scores.promoters::NUMERIC - monthly_scores.detractors::NUMERIC) / monthly_scores.responses::NUMERIC) * 100, 2)
    END as calculated_nps
  FROM monthly_scores
  ORDER BY monthly_scores.month_key DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has already submitted NPS for an order
CREATE OR REPLACE FUNCTION public.has_user_submitted_nps(
  p_user_id UUID,
  p_order_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.nps_responses
    WHERE user_id = p_user_id
      AND order_id = p_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark NPS response as featured
CREATE OR REPLACE FUNCTION public.feature_nps_response(
  p_response_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.nps_responses
  SET is_featured = true,
      featured_at = now(),
      updated_at = now()
  WHERE id = p_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 5: Create updated_at trigger
-- ========================================

DROP TRIGGER IF EXISTS update_nps_responses_updated_at ON public.nps_responses;
CREATE TRIGGER update_nps_responses_updated_at
  BEFORE UPDATE ON public.nps_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- STEP 6: Add comments
-- ========================================

COMMENT ON TABLE public.nps_responses IS 'Stores Net Promoter Score responses from customers';
COMMENT ON COLUMN public.nps_responses.score IS 'NPS score from 0-10 (0-6 detractor, 7-8 passive, 9-10 promoter)';
COMMENT ON COLUMN public.nps_responses.category IS 'Auto-calculated category based on score';
COMMENT ON COLUMN public.nps_responses.survey_trigger IS 'What prompted the survey (post-delivery, periodic, etc.)';
COMMENT ON FUNCTION public.calculate_nps_score IS 'Calculates overall NPS score for a date range';
