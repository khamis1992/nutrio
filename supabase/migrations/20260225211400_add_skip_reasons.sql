-- Migration: Skip Reason Collection for AI Training
-- Date: 2025-02-25
-- Description: Store skip reasons to improve AI recommendations
-- Addresses: P1-010 (Skip Reason Collection)

-- Create skip reasons table
CREATE TABLE IF NOT EXISTS meal_skip_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id UUID REFERENCES meals(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES meal_schedules(id) ON DELETE SET NULL,
    
    -- Skip reason categories
    reason_type VARCHAR(50) NOT NULL CHECK (reason_type IN (
        'not_hungry',
        'eating_out',
        'dont_like',
        'tired_of_this',
        'dietary_restriction',
        'other'
    )),
    
    -- Optional detailed feedback
    details TEXT,
    
    -- Context for ML training
    scheduled_date DATE,
    meal_type VARCHAR(20), -- breakfast, lunch, dinner, snack
    
    -- AI/ML fields
    ai_confidence_score DECIMAL(3,2), -- How confident AI was in this recommendation (0.00-1.00)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one skip reason per schedule
    UNIQUE(schedule_id)
);

-- Create indexes for analysis
CREATE INDEX idx_skip_reasons_user ON meal_skip_reasons(user_id);
CREATE INDEX idx_skip_reasons_meal ON meal_skip_reasons(meal_id);
CREATE INDEX idx_skip_reasons_type ON meal_skip_reasons(reason_type);
CREATE INDEX idx_skip_reasons_created ON meal_skip_reasons(created_at);

-- Create function to get skip analytics (for AI training)
CREATE OR REPLACE FUNCTION get_skip_analytics(
    p_user_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    reason_type VARCHAR(50),
    total_skips BIGINT,
    percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        msr.reason_type,
        COUNT(*)::BIGINT as total_skips,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM meal_skip_reasons msr
    WHERE (p_user_id IS NULL OR msr.user_id = p_user_id)
        AND (p_start_date IS NULL OR msr.scheduled_date >= p_start_date)
        AND (p_end_date IS NULL OR msr.scheduled_date <= p_end_date)
    GROUP BY msr.reason_type
    ORDER BY total_skips DESC;
END;
$$;

-- Create function to submit skip reason
CREATE OR REPLACE FUNCTION submit_skip_reason(
    p_user_id UUID,
    p_meal_id UUID,
    p_schedule_id UUID,
    p_reason_type VARCHAR(50),
    p_details TEXT DEFAULT NULL,
    p_scheduled_date DATE DEFAULT NULL,
    p_meal_type VARCHAR(20) DEFAULT NULL,
    p_ai_confidence_score DECIMAL(3,2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_skip_id UUID;
BEGIN
    INSERT INTO meal_skip_reasons (
        user_id,
        meal_id,
        schedule_id,
        reason_type,
        details,
        scheduled_date,
        meal_type,
        ai_confidence_score
    ) VALUES (
        p_user_id,
        p_meal_id,
        p_schedule_id,
        p_reason_type,
        p_details,
        p_scheduled_date,
        p_meal_type,
        p_ai_confidence_score
    )
    ON CONFLICT (schedule_id) DO UPDATE SET
        reason_type = EXCLUDED.reason_type,
        details = EXCLUDED.details,
        ai_confidence_score = EXCLUDED.ai_confidence_score,
        created_at = NOW()
    RETURNING id INTO v_skip_id;

    RETURN jsonb_build_object(
        'success', true,
        'skip_id', v_skip_id,
        'message', 'Skip reason recorded'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Enable RLS
ALTER TABLE meal_skip_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own skip reasons"
ON meal_skip_reasons
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own skip reasons"
ON meal_skip_reasons
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all skip reasons for analytics"
ON meal_skip_reasons
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_skip_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION submit_skip_reason TO authenticated;

-- Comments
COMMENT ON TABLE meal_skip_reasons IS 'Stores user skip reasons for AI training and recommendation improvement';
COMMENT ON FUNCTION submit_skip_reason IS 'Records a skip reason when user skips a scheduled meal';
