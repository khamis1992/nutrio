import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity_level: null,
    adherence_rate_last_30_days: null,
    affiliate_balance: null,
    affiliate_tier: null,
    age: null,
    ai_suggested_calories: null,
    ai_suggestion_confidence: null,
    avatar_url: null,
    badges_count: null,
    bio: null,
    carbs_target_g: null,
    consecutive_weeks_on_track: null,
    created_at: "2026-01-01T00:00:00.000Z",
    current_weight_kg: null,
    daily_calorie_target: null,
    email: null,
    fat_target_g: null,
    full_name: null,
    gender: null,
    has_unviewed_adjustment: null,
    health_goal: null,
    height_cm: null,
    id: "profile-1",
    last_goal_adjustment_date: null,
    level: null,
    next_scheduled_adjustment: null,
    notification_preferences: null,
    onboarding_completed: null,
    plateau_weeks: null,
    preferred_language: null,
    protein_target_g: null,
    referral_code: null,
    referral_rewards_earned: null,
    referred_by: null,
    specialties: null,
    streak_days: null,
    target_weight: null,
    target_weight_kg: null,
    taste_profile: null,
    tier1_referrer_id: null,
    tier2_referrer_id: null,
    tier3_referrer_id: null,
    total_affiliate_earnings: null,
    total_meals_logged: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    user_id: "user-1",
    weight: null,
    xp: null,
    ...overrides,
  };
}
