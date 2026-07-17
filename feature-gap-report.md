# Nutrio External Feature-Gap Audit

## Objective

Audit active open-source fitness, nutrition, workout, and food-delivery projects to identify concrete, adoptable features Nutrio does not yet have.

## Baseline (what Nutrio already has)

- AI meal photo logging (`analyze-meal-image` edge function using Gemini)
- Barcode scanning (ZXing + Open Food Facts)
- Smart meal recommendations
- ML-style calorie/macro prediction (Mifflin-St Jeor + TDEE formulas)
- XP, badges, streaks, community challenges, leaderboards, affiliate system
- Workout programs, guided workouts, health tracking
- Customer, partner, driver, coach, fleet, and admin portals
- Supabase backend with 100+ migrations and 50+ edge functions

## Method

- GitHub CLI `gh search repos` across fitness, calorie counter, food delivery, meal planning, and gamification categories.
- Exa web search for detailed open-source app feature lists.
- Cross-referenced findings against Nutrio's routes, edge functions, and SUPERMEMORY context.

---

## 1. AI / Nutrition Features

| Feature | Source | Stars | Why it matters | Nutrio fit |
|---|---|---|---|---|
| Natural-language food logging (one sentence → structured entry) | fitevo, Dost AI, bhargavpetla/fitness | 50–400 | Fastest way to log mixed meals | New `parse-food-text` edge function + input in `LogMealDialog` |
| Voice-to-meal logging | Fud AI, Vitality-X | 100–2k | Hands-free while cooking | Browser Web Speech API → same parser |
| Nutrition label OCR / scanning | Fud AI, Vitality-X | 100–2k | Packaged-food precision beyond barcode | New `analyze-nutrition-label` edge function with Gemini vision |
| “What if?” meal preview (macro impact before logging) | Fud AI | 400+ | Reduces decision friction | Add preview step to `FoodPhotoLogSheet` / `LogMealDialog` |
| AI uncertainty ranges + USDA cross-check | fitevo | 300+ | Reduces food-hallucination errors | Enrich `analyze-meal-image` response with confidence score and USDA fallback |
| AI diet coach with multi-turn memory grounded in logs | Fud AI, HealthOS, Vitality-X, Daily-Discipline-Trainer | 100–2k+ | Drives daily retention | New `ai-coach` edge function + chat route/page |
| Weekly AI review / check-in with macro adjustment | bhargavpetla/fitness, fitevo, Dost AI | 100–400 | Automates goal tuning | Reuse/extend existing `generate-ai-insight` for weekly summaries |
| Macro target generation from body metrics + optional medical docs | bhargavpetla/fitness, Dost AI | 100–400 | Personalized, safety-aware planning | Enrich onboarding / `NutritionGoals` with structured LLM prompts |
| “What should I eat?” suggestions based on remaining macros | fitevo | 300+ | Converts logging into action | Add to `SmartMealRecommendations` |
| AI recipe import from URL / social video | Mealie, pick-a-recipe | 12k+ / 23 | Scales recipe content | Partner/admin recipe content tool |

---

## 2. Workout / Exercise Features

| Feature | Source | Stars | Why it matters | Nutrio fit |
|---|---|---|---|---|
| Open exercise dataset (muscle groups, equipment, form cues, videos) | wger | 6,269 | Rich exercise metadata for coach module | Seed/import into new `exercises` table |
| Declarative progression rules (weight/reps/sets/RiR/rest per iteration) | wger | 6,269 | Automates periodization | Extend `coach_programs` schema |
| “Needs logs to advance” day locking | wger | 6,269 | Ensures program adherence | Coach workout scheduler |
| Live previous-session numbers during logging | fitevo | 300+ | Key progressive-overload UX | `GuidedWorkout` set logger |
| Rest timer with haptic/notification | fitevo, Dost AI, Daily-Discipline-Trainer | 100–400 | Essential gym UX | Add to `GuidedWorkout` |
| Plate calculator per side | Dost AI, FitnessTrack | 100+ | Useful gym UX | Workout logger utility |
| RPE / RiR tracking | wger, fitevo | 300–6k | Better load management | Add `rpe`/`rir` to `coach_workout_set_logs` |
| Auto PR detection + 1RM estimate (Epley / Brzycki) | fitevo, Dost AI, FitnessTrack | 100–400 | Motivation + analytics | Database trigger/RPC on set completion |
| Per-exercise strength progression chart | fitevo, Dost AI | 100–400 | Visual feedback | Add to Progress / WorkoutHistory |
| Weekly muscle-group volume chips | fitevo | 300+ | Programming feedback | Dashboard/progress widget |
| GPX / cardio activity import (running, cycling) | jovandeginste/workout-tracker | 1,227 | Expands beyond gym | Health tracking import |
| Equipment wear / lifecycle tracking | jovandeginste/workout-tracker | 1,227 | Runner-specific | Health/gear log |

---

## 3. Gamification / Social / Engagement Features

| Feature | Source | Stars | Why it matters | Nutrio fit |
|---|---|---|---|---|
| Streak freeze / recovery tokens | fitevo, OpenNutriTracker | 2k+ | Reduces churn from single miss | Extend existing streak engine |
| Friend leaderboards / leagues | fitevo, FitFuel | 100–400 | Stronger social retention | Community module |
| Group / team challenges | FitFuel, SwadKart | 10–400 | Viral loops | Implemented: team creation, invite codes, member contribution, and team standings |
| Social meal / workout feed | fitevo, FitFuel | 100–400 | UGC + accountability | Community tab |
| Accountability buddy / partner system | fitevo | 300+ | Research-backed behavior change | New community feature |
| Daily quests / missions beyond streaks | FitFuel, SwadKart | 10–400 | Engagement variety | Rewards module |
| Achievement / badge marketplace for redemptions | SwadKart | 10+ | Tangible rewards | Wallet/rewards integration |
| Context-aware push nudges (meal timing / water intervals) | fitevo | 300+ | Habit reinforcement | Existing notifications + scheduled edge function |
| Private progress-photo gallery with zoom | fitevo, archer-fitness | 100–400 | Body recomp tracking | Health tracking |

---

## 4. Food Delivery / Operations Features

| Feature | Source | Stars | Why it matters | Nutrio fit |
|---|---|---|---|---|
| Real-time driver GPS tracking + ETA prediction | SwadKart, Medusa Eats, TanStack POS | 10–251 | Core delivery UX | Driver / Fleet portals |
| Group ordering / split bill | SwadKart | 10+ | Social ordering | Customer cart |
| Voice search in Arabic / English | SwadKart | 10+ | Accessibility + local relevance | Search page |
| AI chatbot that executes actions (order status, ETA, cancel) | SwadKart, POS S360T | 10+ | Support deflection | Support / Community |
| Loyalty coins + order streak badges | SwadKart | 10+ | Retention | Wallet / Rewards |
| Multi-menu support (breakfast/lunch/dinner pricing) | Restaurant POS, kapeOS, Genx | varies | Operational flexibility | Implemented: per-period availability, pricing, customer display, and schedule price snapshot |
| Table / QR self-ordering | kapeOS, Genx, restaurant POS | varies | Dine-in expansion | Partner portal |
| Kitchen Display System (KDS) with item-level status | TanStack POS, Genx, kapeOS | varies | Order ops | Partner order flow |
| Surge pricing / dynamic delivery fees | SwadKart | 10+ | Demand balancing | Fleet pricing |
| Offline-first POS / delivery order queue | kapeOS, POS S360T | varies | Reliability in low connectivity | Partner app |
| Multi-kitchen / multi-branch routing | Genx, restaurant POS | varies | Scale operations | Admin / partner |

---

## 5. Meal Planning / Recipe / Shopping Features

| Feature | Source | Stars | Why it matters | Nutrio fit |
|---|---|---|---|---|
| Recipe import from URL with auto-scrape | Mealie | 12,489 | Scales content | Partner/admin recipe tool |
| Weekly meal-plan calendar → auto shopping list | Mealie, Tandoor | 8k–12k | Core meal-prep UX | Customer Schedule + new ShoppingList feature |
| Ingredient merging + supermarket aisle grouping | Tandoor | 8,417 | Usability | Shopping list generator |
| Step-by-step cook mode with timers | Tandoor | 8,417 | Recipe UX | Recipe detail page |
| AI nutrition estimation per recipe | Tandoor | 8,417 | Accurate macros | Edge function |
| OCR import of handwritten / photo recipes | Tandoor, Mealie | 8k–12k | Low-friction content | Admin/partner recipe upload |

---

## Highest-Impact, Lowest-Friction Recommendations

1. **Natural-language food logging** — large UX win; reuses existing `logMealItems` pipeline.
2. **Nutrition-label OCR** — natural extension of `analyze-meal-image`; adds a dedicated label mode.
3. **AI coach with memory** — high retention; Nutrio already has the data needed to ground it.
4. **Progressive-overload workout logger improvements** — rest timer, previous-session numbers, RPE/RiR, plate calculator, PR detection.
5. **Streak freeze / recovery tokens** — small schema addition to existing streaks/XP engine.
6. **Group ordering / split bill** — differentiates Nutrio in Qatar’s social dining culture.
7. **Recipe URL import + meal-plan-to-shopping-list** — leverages Nutrio’s meal focus and expands into weekly planning.

---

## Next Steps

- Pick 1–3 features for a detailed implementation plan (migrations, edge functions, route registry, UI files, RLS policies, tests).
- Or build a prioritized roadmap ranked by effort, impact, and dependencies.
- Or deep-dive into a single category (e.g., workout logger, AI nutrition, delivery operations).
