-- Migration: Add missing gamification and goal columns to profiles table
-- Fixes Supabase 406/400 errors from useXp and useBadgeChecker hooks

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS target_weight DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS protein_target_g INTEGER,
  ADD COLUMN IF NOT EXISTS daily_calorie_target INTEGER,
  ADD COLUMN IF NOT EXISTS referral_rewards_earned DECIMAL(10,2) DEFAULT 0;
