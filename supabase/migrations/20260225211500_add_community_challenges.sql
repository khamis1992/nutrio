-- Migration: Community Challenges System
-- Date: 2025-02-25
-- Addresses: P2-001 (Community Challenges)

-- Enable existing community_challenges table features
ALTER TABLE community_challenges 
ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'extreme'))
DEFAULT 'medium';

ALTER TABLE community_challenges 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'nutrition';

ALTER TABLE community_challenges 
ADD COLUMN IF NOT EXISTS badge_icon VARCHAR(100);

ALTER TABLE community_challenges 
ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 100;

-- Create challenge leaderboard view
CREATE OR REPLACE VIEW challenge_leaderboard AS
SELECT 
    cp.challenge_id,
    cp.user_id,
    p.full_name as user_name,
    p.avatar_url,
    cp.current_progress,
    cc.target_value,
    ROUND((cp.current_progress::DECIMAL / cc.target_value) * 100, 1) as progress_percent,
    cp.completed_at,
    RANK() OVER (PARTITION BY cp.challenge_id ORDER BY cp.current_progress DESC, cp.completed_at ASC) as rank
FROM challenge_participants cp
JOIN community_challenges cc ON cp.challenge_id = cc.id
LEFT JOIN profiles p ON cp.user_id = p.id
WHERE cc.is_active = true;

-- Create function to join challenge
CREATE OR REPLACE FUNCTION join_challenge(
    p_challenge_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challenge RECORD;
    v_participant_id UUID;
BEGIN
    -- Check if challenge exists and is active
    SELECT * INTO v_challenge
    FROM community_challenges
    WHERE id = p_challenge_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge not found or inactive');
    END IF;
    
    -- Check if user already joined
    IF EXISTS (
        SELECT 1 FROM challenge_participants 
        WHERE challenge_id = p_challenge_id AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already joined this challenge');
    END IF;
    
    -- Add participant
    INSERT INTO challenge_participants (challenge_id, user_id, current_progress)
    VALUES (p_challenge_id, p_user_id, 0)
    RETURNING id INTO v_participant_id;
    
    -- Update participant count
    UPDATE community_challenges 
    SET participant_count = participant_count + 1
    WHERE id = p_challenge_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'participant_id', v_participant_id,
        'message', 'Challenge joined successfully'
    );
END;
$$;

-- Create function to update challenge progress
CREATE OR REPLACE FUNCTION update_challenge_progress(
    p_challenge_id UUID,
    p_user_id UUID,
    p_progress INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_participant RECORD;
    v_challenge RECORD;
    v_was_completed BOOLEAN;
BEGIN
    -- Get participant record
    SELECT * INTO v_participant
    FROM challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not participating in this challenge');
    END IF;
    
    -- Get challenge target
    SELECT target_value INTO v_challenge
    FROM community_challenges
    WHERE id = p_challenge_id;
    
    v_was_completed := v_participant.completed_at IS NOT NULL;
    
    -- Update progress
    UPDATE challenge_participants
    SET current_progress = LEAST(p_progress, v_challenge.target_value),
        completed_at = CASE 
            WHEN p_progress >= v_challenge.target_value AND completed_at IS NULL 
            THEN NOW() 
            ELSE completed_at 
        END,
        updated_at = NOW()
    WHERE id = v_participant.id;
    
    -- Award XP if newly completed
    IF NOT v_was_completed AND p_progress >= v_challenge.target_value THEN
        -- Award XP (would integrate with gamification system)
        RETURN jsonb_build_object(
            'success', true,
            'completed', true,
            'message', 'Challenge completed! XP awarded.'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'progress', LEAST(p_progress, v_challenge.target_value),
        'target', v_challenge.target_value
    );
END;
$$;

-- Create function to get active challenges with leaderboard
CREATE OR REPLACE FUNCTION get_active_challenges(
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    challenge_type TEXT,
    difficulty_level TEXT,
    category TEXT,
    target_value INTEGER,
    reward_points INTEGER,
    xp_reward INTEGER,
    participant_count INTEGER,
    start_date DATE,
    end_date DATE,
    is_joined BOOLEAN,
    user_progress INTEGER,
    user_rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cc.id,
        cc.title,
        cc.description,
        cc.challenge_type,
        cc.difficulty_level,
        cc.category,
        cc.target_value,
        cc.reward_points,
        cc.xp_reward,
        cc.participant_count,
        cc.start_date::DATE,
        cc.end_date::DATE,
        p_user_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM challenge_participants cp2 
            WHERE cp2.challenge_id = cc.id AND cp2.user_id = p_user_id
        ) as is_joined,
        COALESCE(cp.current_progress, 0) as user_progress,
        COALESCE(cl.rank, 0) as user_rank
    FROM community_challenges cc
    LEFT JOIN challenge_participants cp ON cc.id = cp.challenge_id AND cp.user_id = p_user_id
    LEFT JOIN challenge_leaderboard cl ON cc.id = cl.challenge_id AND cl.user_id = p_user_id
    WHERE cc.is_active = true
        AND cc.start_date <= CURRENT_DATE
        AND cc.end_date >= CURRENT_DATE
    ORDER BY cc.start_date DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION join_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION update_challenge_progress TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_challenges TO authenticated;

-- Comments
COMMENT ON FUNCTION join_challenge IS 'Allow user to join an active community challenge';
COMMENT ON FUNCTION update_challenge_progress IS 'Update user progress in a challenge';
