-- Migration: Add gamification system (XP, levels, badges)
-- Created: 2026-02-25

-- Add gamification columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_meals_logged INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS badges_count INTEGER DEFAULT 0;

-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')) DEFAULT 'common',
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default badges
INSERT INTO badges (id, name, description, icon, xp_reward, rarity, requirement_type, requirement_value) VALUES
('first_meal', 'First Bite', 'Log your first meal', 'star', 50, 'common', 'meals_logged', 1),
('week_warrior', 'Week Warrior', 'Log meals for 7 days straight', 'flame', 100, 'common', 'streak_days', 7),
('nutrition_ninja', 'Nutrition Ninja', 'Hit your calorie goal 5 days in a row', 'target', 150, 'rare', 'goal_streak', 5),
('streak_master', 'Streak Master', 'Maintain a 30-day streak', 'zap', 300, 'epic', 'streak_days', 30),
('variety_king', 'Variety King', 'Order from 10 different restaurants', 'crown', 200, 'rare', 'unique_restaurants', 10),
('goal_crusher', 'Goal Crusher', 'Reach your target weight', 'trophy', 500, 'legendary', 'weight_goal', 1),
('social_butterfly', 'Social Butterfly', 'Refer 3 friends who subscribe', 'award', 250, 'rare', 'referrals', 3),
('subscription_hero', 'Subscription Hero', 'Maintain subscription for 6 months', 'medal', 400, 'epic', 'subscription_months', 6)
ON CONFLICT (id) DO NOTHING;

-- Create user_badges table for tracking unlocked badges
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, badge_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

-- Enable RLS
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_badges
CREATE POLICY "Users can view own badges"
  ON user_badges FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert user badges"
  ON user_badges FOR INSERT
  WITH CHECK (true);

-- RLS Policies for badges (public read-only)
CREATE POLICY "Anyone can view badges"
  ON badges FOR SELECT
  TO authenticated, anon
  USING (true);

-- Function to award XP to user
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_xp_amount INTEGER,
  p_reason TEXT DEFAULT 'Activity'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_xp_to_next INTEGER;
  v_leveled_up BOOLEAN := false;
BEGIN
  -- Get current XP and level
  SELECT xp, level INTO v_current_xp, v_current_level
  FROM profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Calculate new XP
  v_new_xp := v_current_xp + p_xp_amount;
  v_new_level := v_current_level;
  v_xp_to_next := v_new_level * 100;
  
  -- Check for level up
  WHILE v_new_xp >= v_xp_to_next LOOP
    v_new_xp := v_new_xp - v_xp_to_next;
    v_new_level := v_new_level + 1;
    v_xp_to_next := v_new_level * 100;
    v_leveled_up := true;
  END LOOP;
  
  -- Update profile
  UPDATE profiles
  SET 
    xp = v_new_xp,
    level = v_new_level,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'xp_awarded', p_xp_amount,
    'total_xp', v_new_xp,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up,
    'xp_to_next_level', v_xp_to_next - v_new_xp,
    'reason', p_reason
  );
END;
$$;

-- Function to check and award badges
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak_days INTEGER;
  v_meals_logged INTEGER;
  v_badge_record badges%ROWTYPE;
  v_awarded_badges TEXT[] := ARRAY[]::TEXT[];
  v_already_has_badge BOOLEAN;
BEGIN
  -- Get user stats
  SELECT streak_days, total_meals_logged 
  INTO v_streak_days, v_meals_logged
  FROM profiles
  WHERE id = p_user_id;
  
  -- Check each badge
  FOR v_badge_record IN SELECT * FROM badges LOOP
    -- Check if user already has this badge
    SELECT EXISTS(
      SELECT 1 FROM user_badges 
      WHERE user_id = p_user_id AND badge_id = v_badge_record.id
    ) INTO v_already_has_badge;
    
    IF NOT v_already_has_badge THEN
      -- Check requirements based on badge type
      CASE v_badge_record.requirement_type
        WHEN 'streak_days' THEN
          IF v_streak_days >= v_badge_record.requirement_value THEN
            INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge_record.id);
            PERFORM award_xp(p_user_id, v_badge_record.xp_reward, 'Badge unlocked: ' || v_badge_record.name);
            v_awarded_badges := array_append(v_awarded_badges, v_badge_record.id);
          END IF;
        WHEN 'meals_logged' THEN
          IF v_meals_logged >= v_badge_record.requirement_value THEN
            INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge_record.id);
            PERFORM award_xp(p_user_id, v_badge_record.xp_reward, 'Badge unlocked: ' || v_badge_record.name);
            v_awarded_badges := array_append(v_awarded_badges, v_badge_record.id);
          END IF;
        -- Add more badge types as needed
      END CASE;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'awarded_badges', v_awarded_badges,
    'count', array_length(v_awarded_badges, 1)
  );
END;
$$;

-- Comments
COMMENT ON FUNCTION award_xp IS 'Awards XP to a user and handles level ups';
COMMENT ON FUNCTION check_and_award_badges IS 'Checks user stats and awards eligible badges';
COMMENT ON TABLE badges IS 'Available badges for gamification';
COMMENT ON TABLE user_badges IS 'Tracks which badges users have unlocked';
