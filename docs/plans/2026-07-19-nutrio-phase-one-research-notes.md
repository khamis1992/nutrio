# Nutrio Phase One Research Notes

## Product constraint

Phase one is a prepared-meal ordering and health-tracking product. Customers do not cook inside the Nutrio workflow. Home recipes, pantry inventory, grocery lists, expiry tracking, and household food expenses are explicitly out of scope.

## Current Nutrio baseline

- Restaurant meals, schedules, orders, subscriptions, meal credits, delivery, partner operations, and drivers already exist.
- Delivered meals can be added idempotently to progress through `add_delivered_meal_to_progress`; delivery currently creates an actionable notification rather than proving consumption.
- Manual nutrition logging, extended nutrients, nutrition goals, allergens, medicine interactions, meal ranking, meal impact preview, and AI recommendations already exist.
- Apple Health/HealthKit, Google Fit-style sync, normalized daily health metrics, SportHub, workout sessions, recovery/readiness, guided workouts, RPE/RIR, automatic progression, rest timing, and workout analytics already exist.
- XP transactions, rewards, badges, community challenges, teams, and notification delivery infrastructure already exist.

## Product decisions derived from the audit

1. `ordered`, `delivered`, and `consumed` are different facts. Delivery must not silently count as nutrition consumed.
2. Meal nutrition must be snapshotted when an order/schedule is committed so later partner edits do not rewrite history.
3. Safety exclusions run before personalization scoring. AI explains deterministic results; it does not override allergy, medication, or availability rules.
4. Wearable data needs event-level provenance and deduplication before it can safely alter recommendations.
5. Activity calories must not be eaten back at 100%. Any adaptive allowance is capped and versioned.
6. Sensitive journal and cycle data is opt-in, private by default, and excluded from community/social surfaces.

## External source map

| Area | Primary repositories to review | What to learn |
|---|---|---|
| Product nutrition | https://github.com/openfoodfacts/openfoodfacts-server | Product taxonomy, allergens, health/environment scores, data provenance |
| Nutrition diary | https://github.com/simonoppowa/OpenNutriTracker | Micronutrient adequacy, meal-period diary, quick logging, fasting UX |
| Fitness content | https://github.com/wger-project/wger | Exercise taxonomy, multilingual content, reusable plans |
| Wearable normalization | https://github.com/the-momentum/open-wearables | Provider adapters, normalized records, webhooks, sync state |
| Direct devices | https://github.com/Freeyourgadget/Gadgetbridge | Device capability matrix, BLE sync, offline-first device data |
| Smart scales | https://github.com/oliexdev/openScale | Body-composition metrics, device pairing, multi-user safeguards |
| Outdoor tracking | https://github.com/OpenTracksApp/OpenTracks | GPS recording, BLE sensors, voice announcements, GPX/KML |
| Guided running | https://github.com/jonasoreland/runnerup | Intervals, target pace, HR zones, audio cues |
| Activity history | https://github.com/SamR1/FitTrackee | Route maps, privacy, activity history |
| Import/backfill | https://github.com/joaovitoriasilva/endurain | GPX/TCX/FIT import and provider backfill |
| Training analytics | https://github.com/GoldenCheetah/GoldenCheetah | Training load, power models, performance trends |
| Strength UX | https://github.com/astashov/liftosaur | Plate calculator, muscle map, templates, substitutions |
| Habit adherence | https://github.com/iSoron/uhabits | Flexible schedules and habit-strength scoring |
| Team motivation | https://github.com/HabitRPG/habitica | Cooperative quests, shared progress, accountability |
| Context journal | https://github.com/open-nomie/nomie6-oss | Custom trackers and context-aware journaling |
| Cycle tracking | https://github.com/bloodyhealth/drip | Privacy-first cycle logging and consent boundaries |

## Deferred repositories

The following are useful only if Nutrio later introduces home cooking: Mealie, Grocy, Tandoor Recipes, and KitchenOwl.

## License rule

Repositories are product and architecture references, not automatic dependencies. GPL and AGPL code must not be copied into Nutrio without an explicit license review and approval.
