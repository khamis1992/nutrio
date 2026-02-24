-- Migration: Create progress page enhancement tables
-- Created: 2026-02-24
-- Purpose: Add tables for water tracking, streaks, body measurements, goals, meal quality, and nutrition reports

-- 1. Water Intake Tracking
CREATE TABLE IF NOT EXISTS public.water_intake (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    glasses INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, log_date)
);

-- 2. User Streak Tracking
CREATE TABLE IF NOT EXISTS public.user_streaks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_log_date DATE,
    streak_type VARCHAR(50) DEFAULT 'logging', -- 'logging', 'goals', 'weight', 'water'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, streak_type)
);

-- 3. Body Measurements (extended beyond just weight)
CREATE TABLE IF NOT EXISTS public.body_measurements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    weight_kg DECIMAL(5,2),
    waist_cm DECIMAL(5,2),
    hip_cm DECIMAL(5,2),
    chest_cm DECIMAL(5,2),
    body_fat_percent DECIMAL(4,2),
    muscle_mass_percent DECIMAL(4,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, log_date)
);

-- 4. Nutrition Goals
CREATE TABLE IF NOT EXISTS public.nutrition_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL, -- 'weight_loss', 'muscle_gain', 'maintenance', 'general_health'
    target_weight_kg DECIMAL(5,2),
    target_date DATE,
    daily_calorie_target INTEGER DEFAULT 2000,
    protein_target_g INTEGER DEFAULT 120,
    carbs_target_g INTEGER DEFAULT 250,
    fat_target_g INTEGER DEFAULT 65,
    fiber_target_g INTEGER DEFAULT 25,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Meal Quality Ratings
CREATE TABLE IF NOT EXISTS public.meal_quality_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    meal_quality_score INTEGER CHECK (meal_quality_score >= 0 AND meal_quality_score <= 100),
    protein_present BOOLEAN DEFAULT false,
    vegetables_count INTEGER DEFAULT 0,
    whole_grains BOOLEAN DEFAULT false,
    added_sugars BOOLEAN DEFAULT false,
    overall_grade CHAR(1) CHECK (overall_grade IN ('A', 'B', 'C', 'D', 'F')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, log_date)
);

-- 6. User Milestones/Achievements
CREATE TABLE IF NOT EXISTS public.user_milestones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    milestone_type VARCHAR(100) NOT NULL, -- 'weight_loss', 'streak', 'consistency', 'goal_reached'
    milestone_value DECIMAL(10,2),
    description TEXT NOT NULL,
    achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_celebrated BOOLEAN DEFAULT false,
    icon_emoji VARCHAR(10) DEFAULT '🎉'
);

-- 7. Weekly Nutrition Reports
CREATE TABLE IF NOT EXISTS public.weekly_nutrition_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    avg_calories DECIMAL(8,2),
    avg_protein DECIMAL(6,2),
    avg_carbs DECIMAL(6,2),
    avg_fat DECIMAL(6,2),
    avg_fiber DECIMAL(6,2),
    days_logged INTEGER DEFAULT 0,
    days_on_target INTEGER DEFAULT 0,
    consistency_score INTEGER DEFAULT 0, -- 0-100
    weight_change_kg DECIMAL(5,2),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    report_data JSONB,
    UNIQUE(user_id, week_start_date)
);

-- Enable RLS on all tables
ALTER TABLE public.water_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_quality_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_nutrition_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for water_intake
CREATE POLICY "Users can view own water intake"
    ON public.water_intake FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water intake"
    ON public.water_intake FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water intake"
    ON public.water_intake FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for user_streaks
CREATE POLICY "Users can view own streaks"
    ON public.user_streaks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks"
    ON public.user_streaks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
    ON public.user_streaks FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for body_measurements
CREATE POLICY "Users can view own measurements"
    ON public.body_measurements FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurements"
    ON public.body_measurements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements"
    ON public.body_measurements FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for nutrition_goals
CREATE POLICY "Users can view own goals"
    ON public.nutrition_goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
    ON public.nutrition_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
    ON public.nutrition_goals FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for meal_quality_logs
CREATE POLICY "Users can view own meal quality"
    ON public.meal_quality_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal quality"
    ON public.meal_quality_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal quality"
    ON public.meal_quality_logs FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for user_milestones
CREATE POLICY "Users can view own milestones"
    ON public.user_milestones FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestones"
    ON public.user_milestones FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own milestones"
    ON public.user_milestones FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for weekly_nutrition_reports
CREATE POLICY "Users can view own reports"
    ON public.weekly_nutrition_reports FOR SELECT
    USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_water_intake_user_date ON public.water_intake(user_id, log_date);
CREATE INDEX idx_user_streaks_user_type ON public.user_streaks(user_id, streak_type);
CREATE INDEX idx_body_measurements_user_date ON public.body_measurements(user_id, log_date);
CREATE INDEX idx_nutrition_goals_user_active ON public.nutrition_goals(user_id, is_active);
CREATE INDEX idx_meal_quality_user_date ON public.meal_quality_logs(user_id, log_date);
CREATE INDEX idx_user_milestones_user ON public.user_milestones(user_id, achieved_at DESC);
CREATE INDEX idx_weekly_reports_user_week ON public.weekly_nutrition_reports(user_id, week_start_date);

-- Function to calculate meal quality score
CREATE OR REPLACE FUNCTION public.calculate_meal_quality_score(
    protein_present BOOLEAN,
    vegetables_count INTEGER,
    whole_grains BOOLEAN,
    added_sugars BOOLEAN
)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Protein presence (30 points)
    IF protein_present THEN
        score := score + 30;
    END IF;
    
    -- Vegetables (25 points max, 8.33 per serving)
    score := score + LEAST(vegetables_count * 8, 25);
    
    -- Whole grains (20 points)
    IF whole_grains THEN
        score := score + 20;
    END IF;
    
    -- Added sugars penalty (-15 points)
    IF added_sugars THEN
        score := score - 15;
    END IF;
    
    -- Balance bonus (10 points if protein and vegetables present)
    IF protein_present AND vegetables_count >= 2 THEN
        score := score + 10;
    END IF;
    
    RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get letter grade from score
CREATE OR REPLACE FUNCTION public.get_meal_quality_grade(score INTEGER)
RETURNS CHAR(1) AS $$
BEGIN
    IF score >= 90 THEN RETURN 'A';
    ELSIF score >= 80 THEN RETURN 'B';
    ELSIF score >= 70 THEN RETURN 'C';
    ELSIF score >= 60 THEN RETURN 'D';
    ELSE RETURN 'F';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update streaks automatically
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
    v_current_streak INTEGER;
    v_best_streak INTEGER;
    v_last_date DATE;
    v_days_diff INTEGER;
BEGIN
    -- Get current streak info
    SELECT current_streak, best_streak, last_log_date
    INTO v_current_streak, v_best_streak, v_last_date
    FROM public.user_streaks
    WHERE user_id = NEW.user_id AND streak_type = 'logging';
    
    IF v_last_date IS NULL THEN
        -- First log ever
        INSERT INTO public.user_streaks (user_id, streak_type, current_streak, best_streak, last_log_date)
        VALUES (NEW.user_id, 'logging', 1, 1, NEW.log_date);
    ELSE
        v_days_diff := NEW.log_date - v_last_date;
        
        IF v_days_diff = 0 THEN
            -- Same day, no streak change
            NULL;
        ELSIF v_days_diff = 1 THEN
            -- Consecutive day, increment streak
            v_current_streak := COALESCE(v_current_streak, 0) + 1;
            IF v_current_streak > COALESCE(v_best_streak, 0) THEN
                v_best_streak := v_current_streak;
            END IF;
            
            UPDATE public.user_streaks
            SET current_streak = v_current_streak,
                best_streak = v_best_streak,
                last_log_date = NEW.log_date,
                updated_at = NOW()
            WHERE user_id = NEW.user_id AND streak_type = 'logging';
        ELSE
            -- Streak broken, reset to 1
            UPDATE public.user_streaks
            SET current_streak = 1,
                last_log_date = NEW.log_date,
                updated_at = NOW()
            WHERE user_id = NEW.user_id AND streak_type = 'logging';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update streaks on progress_logs insert
DROP TRIGGER IF EXISTS tr_update_streak_on_log ON public.progress_logs;
CREATE TRIGGER tr_update_streak_on_log
    AFTER INSERT ON public.progress_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_streak();

-- Function to generate weekly report
CREATE OR REPLACE FUNCTION public.generate_weekly_report(
    p_user_id UUID,
    p_week_start DATE
)
RETURNS UUID AS $$
DECLARE
    v_report_id UUID;
    v_week_end DATE;
    v_avg_calories DECIMAL(8,2);
    v_avg_protein DECIMAL(6,2);
    v_avg_carbs DECIMAL(6,2);
    v_avg_fat DECIMAL(6,2);
    v_days_logged INTEGER;
    v_goal calories INTEGER;
BEGIN
    v_week_end := p_week_start + INTERVAL '6 days';
    
    -- Get user's calorie goal
    SELECT daily_calorie_target INTO v_goal
    FROM public.nutrition_goals
    WHERE user_id = p_user_id AND is_active = true
    LIMIT 1;
    
    IF v_goal IS NULL THEN
        v_goal := 2000;
    END IF;
    
    -- Calculate averages
    SELECT 
        AVG(calories_consumed),
        AVG(protein_consumed_g),
        AVG(carbs_consumed_g),
        AVG(fat_consumed_g),
        COUNT(*)
    INTO v_avg_calories, v_avg_protein, v_avg_carbs, v_avg_fat, v_days_logged
    FROM public.progress_logs
    WHERE user_id = p_user_id
    AND log_date >= p_week_start
    AND log_date <= v_week_end;
    
    -- Insert or update report
    INSERT INTO public.weekly_nutrition_reports (
        user_id,
        week_start_date,
        week_end_date,
        avg_calories,
        avg_protein,
        avg_carbs,
        avg_fat,
        days_logged,
        days_on_target,
        consistency_score,
        report_data
    )
    VALUES (
        p_user_id,
        p_week_start,
        v_week_end,
        COALESCE(v_avg_calories, 0),
        COALESCE(v_avg_protein, 0),
        COALESCE(v_avg_carbs, 0),
        COALESCE(v_avg_fat, 0),
        v_days_logged,
        0, -- Will be calculated
        0, -- Will be calculated
        jsonb_build_object(
            'goal_calories', v_goal,
            'variance', COALESCE(v_avg_calories, 0) - v_goal
        )
    )
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET
        avg_calories = EXCLUDED.avg_calories,
        avg_protein = EXCLUDED.avg_protein,
        avg_carbs = EXCLUDED.avg_carbs,
        avg_fat = EXCLUDED.avg_fat,
        days_logged = EXCLUDED.days_logged,
        report_data = EXCLUDED.report_data,
        generated_at = NOW()
    RETURNING id INTO v_report_id;
    
    RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.water_intake IS 'Tracks daily water consumption in glasses';
COMMENT ON TABLE public.user_streaks IS 'Tracks user logging streaks for various activities';
COMMENT ON TABLE public.body_measurements IS 'Extended body measurements beyond weight';
COMMENT ON TABLE public.nutrition_goals IS 'User-defined nutrition and weight goals';
COMMENT ON TABLE public.meal_quality_logs IS 'Daily meal quality ratings and scores';
COMMENT ON TABLE public.user_milestones IS 'Celebration of user achievements';
COMMENT ON TABLE public.weekly_nutrition_reports IS 'Auto-generated weekly nutrition summaries';
