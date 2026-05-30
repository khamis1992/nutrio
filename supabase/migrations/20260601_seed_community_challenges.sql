-- Seed community challenges
INSERT INTO community_challenges (title, description, challenge_type, difficulty_level, category, target_value, reward_points, xp_reward, participant_count, is_active, start_date, end_date)
VALUES
  (
    '30-Day Streak Challenge',
    'Log your meals every day for 30 days straight and claim the ultimate consistency crown!',
    'streak',
    'hard',
    'nutrition',
    30,
    500,
    300,
    0,
    true,
    '2026-05-01',
    '2026-06-30'
  ),
  (
    'Weekly Water Warrior',
    'Hit your daily water goal (8 glasses) for 7 consecutive days.',
    'water',
    'medium',
    'nutrition',
    7,
    200,
    100,
    0,
    true,
    '2026-05-15',
    '2026-06-30'
  ),
  (
    'Protein Powerhouse',
    'Hit your daily protein target for 21 days this month.',
    'protein',
    'medium',
    'nutrition',
    21,
    300,
    200,
    0,
    true,
    '2026-05-01',
    '2026-06-30'
  ),
  (
    'Meal Logging Marathon',
    'Log the most meals this month and climb the leaderboard!',
    'meals',
    'easy',
    'nutrition',
    60,
    400,
    250,
    0,
    true,
    '2026-05-01',
    '2026-06-30'
  );
