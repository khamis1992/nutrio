# Nutrio XP and Rewards System

## Official Sources

- `profiles.xp`: current XP progress inside the current level.
- `profiles.level`: current customer level.
- `xp_transactions`: immutable XP ledger and duplicate protection.
- `reward_definitions`: active reward configuration.
- `reward_transactions`: granted rewards and redemption status.
- `user_badges`: unlocked badge ownership.

## XP Events

| Action | XP | Source ID | Trigger |
| --- | ---: | --- | --- |
| `meal_log` | 10 | manual log id or generated manual id | Manual meal logging RPC |
| `meal_completed` | 10 | `meal_schedules.id` | `complete_meal_atomic` |
| `meal_uncompleted` | -10 | `meal_schedules.id` | `uncomplete_meal_atomic` |
| `daily_nutrition_complete` | 25 | log date | First day crossing calorie target |
| `water_goal` | 15 | log date | First day crossing water goal |
| `order_completed` | 20 | `meal_schedules.id` | Order reaches delivered/completed |
| `friend_referred` | 100 | referred `profiles.user_id` | Referral link attached to new profile |
| `community_challenge_complete` | challenge reward | `community_challenges.id` | Challenge reaches target |
| `badge_unlock` | badge reward | badge id | Badge unlock |

## Badge Rules

| Badge | Condition | Data Source | XP | Real Reward |
| --- | --- | --- | ---: | --- |
| First Bite | First logged meal | `meal_history` / badge trigger | 50 | Badge only |
| Salad Sampler | 5 delivered salad meals | `meal_schedules`, `meals` | 50 | Badge only |
| Week Warrior | 7 day logging streak | `user_streaks` | 100 | Badge only |
| Nutrition Ninja | Hit calorie target 5 days in a row | `progress_logs`, `profiles.daily_calorie_target` | 150 | Badge only |
| Variety King | 10 different restaurants | `user_orders_view` | 200 | Badge only |
| Explorer | 10 different restaurants | `user_orders_view` | 100 | Badge only |
| Social Butterfly | 3 referrals | `profiles.referral_rewards_earned` | 250 | QAR 5 wallet credit |
| Hydration Hero | 14 days at 2000ml+ | `water_entries` | 100 | Badge only |
| Protein King | 30 days at protein target | `progress_logs` | 200 | Badge only |
| 30-Day Streak | 30 day logging streak | `user_streaks` | 300 | Badge only |
| Subscription Hero | 6 months subscribed | `subscriptions` | 400 | Badge only |
| Goal Crusher | Current weight reaches target | `profiles.current_weight_kg`, `profiles.target_weight_kg` | 500 | Badge only |
| NUTRIO Royalty | Reach level 50 | `profiles.level` | 1000 | Badge only |

## Active Rewards

| Requirement | Reward |
| --- | --- |
| 500 lifetime XP | QAR 5 wallet credit |
| 1000 lifetime XP | QAR 10 discount |
| Level 5 | Free snack |
| Social Butterfly badge | QAR 5 wallet credit |

All XP grants must call `award_xp`. All user-facing rewards must be inserted through `grant_progress_rewards` or `grant_badge_reward`.
