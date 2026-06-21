# Blood Work Integration Plan

## Goal
Connect blood work data to the rest of the Nutrio system so that uploading lab results actually changes what meals, goals, and recommendations the customer receives.

## Current State (The Problem)

Blood work data enters the system but never flows out:
- `blood_work_records` and `blood_markers` tables are populated correctly
- `HealthDashboard.tsx` displays the data and shows a health score
- `BloodWorkUpload.tsx` lets users upload PDF or enter markers manually
- `blood-work-ai.ts` generates an AI analysis stored in `blood_work_records.ai_analysis`

**But none of this data reaches:**
- `useSmartRecommendations` — the main recommendation engine
- `useMealRecommendations` — meal suggestion logic
- `generateWeeklyMealPlan()` — meal plan generation
- `useNutritionGoals` — goal targets
- `aiReportGenerator` — the weekly AI report
- The dashboard or any customer-facing surface besides `/health/*`

## Architecture Overview

```
Current flow (broken):
  Blood Work Upload → blood_markers table → HealthDashboard (dead end)
                                              ↓
  Meal Recommendations ← progress_logs + nutrition_goals (no blood data)
  AI Report ← weekly_summary + meal_quality (no blood data)
  Nutrition Goals ← onboarding + manual edit (no blood data)

Target flow:
  Blood Work Upload → blood_markers table
                       ↓                    ↓                    ↓
  Smart Recommendations    Meal Plan Gen     AI Report
  (merge blood signals)  (filter by markers) (include blood analysis)
         ↓                    ↓                    ↓
  Dashboard / Meals       Weekly Plan        Weekly Report
```

## Phases

### Phase 1: Blood Work Service Layer (Enhance existing services)
- [ ] Create `useBloodWorkSummary` hook — fetch latest blood markers, compute health score, identify abnormal markers, cache with TanStack Query
- [ ] Add `getLatestAbnormalMarkers(userId)` to `blood-work.ts` service — returns active abnormal markers grouped by severity
- [ ] Add `getBloodWorkTrends(userId, markerName)` — returns temporal changes across multiple records (already exists as `fetchMarkerHistory` but needs a hook wrapper)
- [ ] Add `hasBloodWork(userId)` — lightweight check if user has any records (for conditional UI)

**Files to create/modify:**
- `src/hooks/useBloodWorkSummary.ts` (new)
- `src/services/blood-work.ts` (add 2 functions)

### Phase 2: Unified Recommendation Engine (Merge blood + nutrition signals)
- [ ] Add blood marker signals to `useSmartRecommendations` hook
- [ ] Blood signals become high-priority items when markers are abnormal
- [ ] Recommendations link to meals that address the specific abnormality
- [ ] Example: "Your Vitamin D is low (18 ng/mL) — we've highlighted fatty fish meals for you"

**Recommendation mapping table:**
| Abnormal Marker | Recommendation | Meal Filter | Priority |
|----------------|---------------|-------------|----------|
| Vitamin D low | Add fatty fish, eggs, fortified milk | `?filter=vitamin-d` | high |
| LDL high | Reduce saturated fats, add soluble fiber | `?filter=heart-healthy` | high |
| Glucose high | Reduce sugars, pair carbs with protein | `?filter=low-glycemic` | high |
| Hemoglobin low/abnormal | Red meat, spinach, lentils + vit C | `?filter=iron-rich` | high |
| Iron low | Liver, lentils, spinach; avoid tea with meals | `?filter=iron-rich` | high |
| Triglycerides high | Reduce refined carbs, add omega-3 | `?filter=low-fat` | high |
| TSH abnormal | Consult endocrinologist, iodine-rich foods | navigation to coach | high |
| CRP high (inflammation) | Anti-inflammatory foods (turmeric, berries, fatty fish) | `?filter=anti-inflammatory` | medium |
| Ferritin low | Iron-rich foods + vitamin C | `?filter=iron-rich` | medium |
| B12 low | Animal protein, fortified foods | `?filter=b12-rich` | medium |

**Files to modify:**
- `src/hooks/useSmartRecommendations.ts` (add blood marker queries and recommendation branches)

### Phase 3: Meal Filtering & Tagging System (Let blood work influence meals)
- [ ] Add health-benefit tags to meals in the database (or derive them from meal nutritional profile)
- [ ] Create a `useHealthFilteredMeals` hook that filters meals based on user's active abnormal markers
- [ ] Add a "Health Match" badge on meal cards when a meal addresses a user's specific abnormality
- [ ] Integrate filtering into the Meals page (`/meals`) via URL params and the existing filter system

**Approach options:**
- **Option A (DB-driven):** Add a `meal_health_tags` table mapping meals to health conditions (heart-healthy, iron-rich, low-glycemic, anti-inflammatory, vitamin-d-rich, b12-rich). More accurate, requires admin management.
- **Option B (Computed):** Derive tags from meal nutrition data (protein > 30g → "high-protein", fiber > 8g → "heart-healthy", iron > 3mg → "iron-rich"). Simpler, less precise.
- **Option C (Hybrid):** Computed tags as default, with optional manual overrides in DB. Recommended.

**Files to create/modify:**
- `supabase/migrations/002_meal_health_tags.sql` (new — if Option A/C)
- `src/hooks/useHealthFilteredMeals.ts` (new)
- `src/lib/meal-health-tagger.ts` (new — computes tags from nutrition data)
- `src/pages/Meals.tsx` (add health filter integration)
- `src/components/meal/MealCard.tsx` or equivalent (add "Health Match" badge)

### Phase 4: Nutrition Goal Intelligence (Blood work adjusts goals)
- [ ] Create `suggestGoalAdjustments(bloodMarkers, currentGoals)` function — returns suggested changes when blood work indicates the current goals are suboptimal
- [ ] Show a "Based on your latest blood work" suggestion card on the NutritionGoals page
- [ ] Don't auto-change goals — suggest and let user accept/reject
- [ ] Examples:
  - High HbA1c + goal=muscle_gain → suggest reducing carb target by 15%
  - High LDL + goal=maintenance → suggest switching to heart-health goal type
  - Low iron + any goal → suggest increasing protein target and adding iron-rich meal preference
  - High CRP + any goal → suggest anti-inflammatory diet approach

**Files to create/modify:**
- `src/lib/goal-adjustment-suggestions.ts` (new — pure function, takes markers + goals, returns suggestions)
- `src/hooks/useGoalAdjustmentSuggestions.ts` (new — wraps the above with data fetching)
- `src/pages/NutritionGoals.tsx` (add suggestion card section)

### Phase 5: AI Report Integration (Blood work in weekly report)
- [ ] Feed blood marker data into `aiReportGenerator.generateReportContent()` as additional context
- [ ] Add a "Blood Work" section to the AI report PDF structure
- [ ] The AI prompt should include: latest abnormal markers, health score, trend direction, and how current nutrition relates to blood findings
- [ ] Example report output: "Your LDL cholesterol is 142 mg/dL (borderline high). Your weekly saturated fat intake averages 22g — consider switching to the heart-healthy meal filter. Meals tagged heart-healthy are available on your meals page."

**Files to modify:**
- `src/lib/ai-report-generator.ts` (add blood work data to context/prompt)
- `src/lib/ai-report-pdf.ts` (add blood work section to PDF template)
- `src/lib/professional-weekly-report-pdf.ts` (add blood work fields to WeeklyReportData type)
- `src/pages/AIReport.tsx` (fetch and pass blood work data)

### Phase 6: Dashboard Integration (Surface blood signals where users actually look)
- [ ] Add a compact "Health Alert" card on the main Dashboard when blood markers are abnormal
- [ ] Show top 1-2 blood-based recommendations inline on the dashboard (not just on health page)
- [ ] Add health score to the dashboard if blood work exists
- [ ] Link "View full health report" to `/health/dashboard`

**Files to modify:**
- `src/pages/Dashboard.tsx` (add health alert card)
- `src/hooks/useSmartRecommendations.ts` (ensure blood-based recs surface in the shared pool)

### Phase 7: Coach Visibility (Let coaches see blood work)
- [ ] Add blood work summary to the coach's client view
- [ ] Coach can see: latest health score, abnormal markers, AI analysis, trends
- [ ] Coach can leave notes on blood work interpretation
- [ ] This enables the coach to give dietary guidance informed by real lab data

**Files to create/modify:**
- `src/pages/coach/ClientDetail.tsx` or equivalent (add blood work summary section)
- `src/services/blood-work.ts` (add `fetchBloodWorkForClient(clientId)` if coach permissions differ)
- `supabase/migrations/003_coach_blood_work_access.sql` (RLS policy for coach read access)

---

## Implementation Priority

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Phase 2: Unified Recommendations | High | Medium | P0 — most user-visible improvement |
| Phase 3: Meal Filtering & Tagging | High | High | P0 — core value proposition |
| Phase 5: AI Report Integration | Medium | Medium | P1 — enhances existing feature |
| Phase 4: Goal Intelligence | Medium | Medium | P1 — proactive health management |
| Phase 6: Dashboard Integration | Medium | Low | P1 — visibility |
| Phase 1: Service Layer | Medium | Low | P0 — prerequisite for all other phases |
| Phase 7: Coach Visibility | Low | Medium | P2 — future enhancement |

## Recommended Implementation Order

```
Phase 1 (Service Layer)     ─┐
                              ├→ Phase 2 (Recommendations)  ─┐
Phase 3 (Meal Tagging)      ─┘                                ├→ Phase 6 (Dashboard)
                                                              ├→ Phase 5 (AI Report)
                                                              └→ Phase 4 (Goals)
                                                                 Phase 7 (Coach) — future
```

Phase 1 and Phase 3 can start in parallel. Phase 2 depends on Phase 1. Phases 4-6 depend on Phase 2.

## Key Technical Decisions

### 1. Meal tagging approach
**Decision needed:** Option A (DB table), Option B (computed), or Option C (hybrid)?
**Recommendation:** Option C (hybrid) — compute tags from nutrition data as default, allow manual overrides. Start with computed only (simpler), add DB table later if precision is needed.

### 2. How aggressively to change user experience
**Decision needed:** Should abnormal blood markers change the default meal sort order, or only add filters/badges?
**Recommendation:** Add filters and badges first (opt-in). Only change default sort if user explicitly accepts a goal adjustment in Phase 4.

### 3. AI analysis freshness
**Decision needed:** Re-run AI analysis when new blood work is uploaded, or on-demand when AI report is generated?
**Recommendation:** On upload (already implemented in upload flow). Store result in `blood_work_records.ai_analysis`. Reuse in AI report.

## Data Flow Summary (Post-Implementation)

```
User uploads blood work
  → blood_markers table populated
  → AI analysis generated and stored (existing)
  → useBloodWorkSummary hook caches: health score, abnormal markers, trends

  → useSmartRecommendations now queries blood markers
    → generates blood-specific high-priority recommendations
    → links to filtered meals page

  → Meals page supports health filter params
    → meals tagged via computed nutrition tags
    → "Health Match" badge shows on relevant meals

  → NutritionGoals page shows blood-based suggestions
    → user can accept/reject suggested changes
    → accepted changes flow into nutrition_goals

  → AI Report includes blood work section
    → AI prompt includes marker data + nutrition context
    → PDF gets a blood work page

  → Dashboard shows compact health alert
    → top 1-2 blood recommendations inline
    → links to full health dashboard

  → Coach can see blood work for assigned clients
    → RLS policy allows coach read access
```

## Risk Considerations

1. **Medical disclaimers:** All blood-driven recommendations must include "Consult your healthcare provider" — already present in existing code, must be preserved in all new surfaces.

2. **Stale data:** Blood work from 2 years ago shouldn't drive today's recommendations. Add a `test_date` freshness check — only use markers from the last 6 months for active recommendations. Show "consider updating your blood work" if data is stale.

3. **Overwhelming the user:** Don't dump 10 blood recommendations on the dashboard. Prioritize: show only the top 2 most critical, link to full health dashboard for more.

4. **Negative food relationships:** Don't make the user feel like they can't eat anything. Frame suggestions as "add these foods" not "avoid everything." The tone matters for engagement.

## Definition of Done

When blood work data flows to at least:
- [ ] Smart recommendations (Phase 2)
- [ ] Meal filtering (Phase 3)
- [ ] AI report (Phase 5)
- [ ] Dashboard visibility (Phase 6)

A user who uploads blood work showing high LDL should, within the same session, see heart-healthy meal recommendations on their dashboard and meals page, and have their next AI report mention the LDL finding with dietary context.