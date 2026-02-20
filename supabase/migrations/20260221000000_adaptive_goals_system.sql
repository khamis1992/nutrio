-- Migration: Adaptive Goals AI System
-- Phase 1: Database Foundation
-- Created: 2026-02-20

-- ============================================
-- 1. ADAPTIVE GOAL SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.adaptive_goal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  auto_adjust_enabled BOOLEAN DEFAULT true,
  adjustment_frequency TEXT DEFAULT 'weekly' CHECK (adjustment_frequency IN ('weekly', 'biweekly', 'monthly')),
  min_calorie_floor INTEGER DEFAULT 1200,
  max_calorie_ceiling INTEGER DEFAULT 4000,
  weight_change_threshold_kg DECIMAL(4,2) DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.adaptive_goal_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own adaptive settings"
  ON public.adaptive_goal_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own adaptive settings"
  ON public.adaptive_goal_settings FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adaptive settings"
  ON public.adaptive_goal_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_adaptive_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_adaptive_settings_updated_at ON public.adaptive_goal_settings;
CREATE TRIGGER update_adaptive_settings_updated_at
  BEFORE UPDATE ON public.adaptive_goal_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_adaptive_settings_updated_at();

-- ============================================
-- 2. GOAL ADJUSTMENT HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.goal_adjustment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  adjustment_date DATE NOT NULL,
  previous_calories INTEGER NOT NULL,
  new_calories INTEGER NOT NULL,
  previous_macros JSONB NOT NULL,
  new_macros JSONB NOT NULL,
  reason TEXT NOT NULL,
  weight_change_kg DECIMAL(4,2),
  adherence_rate DECIMAL(3,2),
  plateau_detected BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2),
  applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goal_adjustment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view own adjustment history"
  ON public.goal_adjustment_history FOR SELECT 
  USING (auth.uid() = user_id);

-- ============================================
-- 3. WEEKLY ADHERENCE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.weekly_adherence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  days_logged INTEGER DEFAULT 0,
  days_on_target INTEGER DEFAULT 0,
  avg_calories_consumed INTEGER,
  target_calories INTEGER,
  adherence_rate DECIMAL(3,2),
  weight_start DECIMAL(5,2),
  weight_end DECIMAL(5,2),
  weight_change DECIMAL(4,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Enable RLS
ALTER TABLE public.weekly_adherence ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view own adherence"
  ON public.weekly_adherence FOR SELECT 
  USING (auth.uid() = user_id);

-- ============================================
-- 4. WEIGHT PREDICTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.weight_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prediction_date DATE NOT NULL,
  predicted_weight DECIMAL(5,2) NOT NULL,
  confidence_lower DECIMAL(5,2),
  confidence_upper DECIMAL(5,2),
  model_version TEXT DEFAULT 'v1.0',
  actual_weight DECIMAL(5,2),
  accuracy DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, prediction_date)
);

-- Enable RLS
ALTER TABLE public.weight_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view own predictions"
  ON public.weight_predictions FOR SELECT 
  USING (auth.uid() = user_id);

-- ============================================
-- 5. PLATEAU EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.plateau_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  detected_at DATE NOT NULL,
  weeks_without_change INTEGER NOT NULL,
  suggested_action TEXT NOT NULL,
  user_acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plateau_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view own plateau events"
  ON public.plateau_events FOR SELECT 
  USING (auth.uid() = user_id);

-- ============================================
-- 6. ADD FIELDS TO PROFILES TABLE
-- ============================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_goal_adjustment_date DATE,
ADD COLUMN IF NOT EXISTS next_scheduled_adjustment DATE,
ADD COLUMN IF NOT EXISTS adherence_rate_last_30_days DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS consecutive_weeks_on_track INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS plateau_weeks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_suggested_calories INTEGER,
ADD COLUMN IF NOT EXISTS ai_suggestion_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS has_unviewed_adjustment BOOLEAN DEFAULT false;

-- Add adherence tracking to progress_logs
ALTER TABLE public.progress_logs
ADD COLUMN IF NOT EXISTS on_target BOOLEAN,
ADD COLUMN IF NOT EXISTS variance_from_target INTEGER;

-- ============================================
-- 7. CREATE DATABASE FUNCTIONS
-- ============================================

-- Function to calculate weekly adherence
CREATE OR REPLACE FUNCTION calculate_weekly_adherence(
  p_user_id UUID,
  p_week_start DATE
)
RETURNS TABLE (
  adherence_rate DECIMAL,
  avg_calories INTEGER,
  days_logged INTEGER
) AS $$
DECLARE
  v_target_calories INTEGER;
BEGIN
  SELECT daily_calorie_target INTO v_target_calories
  FROM profiles WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT 
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE COUNT(CASE WHEN ABS(calories_consumed - v_target_calories) <= v_target_calories * 0.1 THEN 1 END)::DECIMAL / COUNT(*)
    END,
    COALESCE(AVG(calories_consumed)::INTEGER, 0),
    COUNT(*)::INTEGER
  FROM progress_logs
  WHERE user_id = p_user_id
    AND log_date >= p_week_start
    AND log_date < p_week_start + INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect weight plateau
CREATE OR REPLACE FUNCTION detect_weight_plateau(
  p_user_id UUID,
  p_weeks_threshold INTEGER DEFAULT 3
)
RETURNS BOOLEAN AS $$
DECLARE
  v_first_weight DECIMAL;
  v_latest_weight DECIMAL;
  v_weeks_logged INTEGER;
BEGIN
  SELECT 
    MIN(weight_kg),
    MAX(weight_kg),
    COUNT(DISTINCT DATE_TRUNC('week', log_date))
  INTO v_first_weight, v_latest_weight, v_weeks_logged
  FROM progress_logs
  WHERE user_id = p_user_id
    AND weight_kg IS NOT NULL
    AND log_date >= CURRENT_DATE - INTERVAL '12 weeks';

  RETURN v_weeks_logged >= p_weeks_threshold 
    AND ABS(COALESCE(v_latest_weight, 0) - COALESCE(v_first_weight, 0)) < 0.5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate weight change rate
CREATE OR REPLACE FUNCTION calculate_weight_change_rate(
  p_user_id UUID,
  p_weeks INTEGER DEFAULT 4
)
RETURNS DECIMAL AS $$
DECLARE
  v_start_weight DECIMAL;
  v_end_weight DECIMAL;
BEGIN
  SELECT weight_kg INTO v_start_weight
  FROM progress_logs
  WHERE user_id = p_user_id AND weight_kg IS NOT NULL
  ORDER BY log_date ASC
  LIMIT 1 OFFSET (SELECT COUNT(*) / 2 FROM progress_logs WHERE user_id = p_user_id AND weight_kg IS NOT NULL);

  SELECT weight_kg INTO v_end_weight
  FROM progress_logs
  WHERE user_id = p_user_id AND weight_kg IS NOT NULL
  ORDER BY log_date DESC
  LIMIT 1;

  RETURN CASE 
    WHEN v_start_weight IS NULL OR v_end_weight IS NULL THEN 0
    ELSE (v_end_weight - v_start_weight) / NULLIF(p_weeks, 0)
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_goal_adjustments_user_date 
ON public.goal_adjustment_history(user_id, adjustment_date DESC);

CREATE INDEX IF NOT EXISTS idx_adherence_user_week 
ON public.weekly_adherence(user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_user_date 
ON public.weight_predictions(user_id, prediction_date);

CREATE INDEX IF NOT EXISTS idx_plateau_user_date 
ON public.plateau_events(user_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_adaptive_settings_user 
ON public.adaptive_goal_settings(user_id);

-- ============================================
-- 9. INITIALIZE DEFAULT SETTINGS FOR EXISTING USERS
-- ============================================

INSERT INTO public.adaptive_goal_settings (user_id, auto_adjust_enabled)
SELECT user_id, true
FROM public.profiles
WHERE onboarding_completed = true
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 10. TRIGGER TO AUTO-CREATE SETTINGS FOR NEW USERS
-- ============================================

CREATE OR REPLACE FUNCTION create_adaptive_settings_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.adaptive_goal_settings (user_id, auto_adjust_enabled)
  VALUES (NEW.user_id, true)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_adaptive_settings ON public.profiles;
CREATE TRIGGER trigger_create_adaptive_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_adaptive_settings_for_new_user();

-- ============================================
-- 11. BACKFILL ADHERENCE DATA (Optional - run manually if needed)
-- ============================================

-- Uncomment and run manually if you want to backfill historical adherence
/*
INSERT INTO weekly_adherence (user_id, week_start, week_end, days_logged, target_calories)
SELECT 
  user_id,
  DATE_TRUNC('week', log_date)::DATE as week_start,
  (DATE_TRUNC('week', log_date) + INTERVAL '6 days')::DATE as week_end,
  COUNT(*) as days_logged,
  MAX(daily_calorie_target) as target_calories
FROM progress_logs pl
JOIN profiles p ON pl.user_id = p.user_id
WHERE log_date >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY user_id, DATE_TRUNC('week', log_date)
ON CONFLICT (user_id, week_start) DO NOTHING;
*/
