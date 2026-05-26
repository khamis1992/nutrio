-- Seed achievement badges
INSERT INTO badges (id, name, description, icon, rarity, xp_reward, requirement_type, requirement_value)
VALUES
  ('salad_sampler', 'Salad Sampler', 'Order 5 different salads', '🥗', 'common', 50, 'unique_salads', 5),
  ('protein_king', 'Protein King', 'Hit protein target 30 days in a row', '🏋️', 'epic', 200, 'protein_target_streak', 30),
  ('hydration_hero', 'Hydration Hero', 'Log 8 cups of water for 14 days straight', '💧', 'rare', 100, 'water_streak', 14),
  ('streak_30', '30-Day Streak', '30 consecutive days of meal logging', '🔥', 'legendary', 300, 'streak_days', 30),
  ('goal_crusher', 'Goal Crusher', 'Reach your weight goal', '🎯', 'legendary', 500, 'weight_goal', 1),
  ('explorer', 'Explorer', 'Order from 10 different restaurants', '🌍', 'rare', 100, 'unique_restaurants', 10),
  ('nutrio_royalty', 'NUTRIO Royalty', 'Reach Level 50', '👑', 'legendary', 1000, 'level', 50)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  rarity = EXCLUDED.rarity,
  xp_reward = EXCLUDED.xp_reward,
  requirement_type = EXCLUDED.requirement_type,
  requirement_value = EXCLUDED.requirement_value;
