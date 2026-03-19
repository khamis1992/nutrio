# Redesign Subscription Hero Card

## Plan
Redesign the "Hero plan card" on the active subscription view in `src/pages/Subscription.tsx` to match the reference design.

## Key Changes
1. **Plan name & status**: Bold uppercase "WEEKLY PLAN" with "Active" subtitle
2. **Meals remaining**: Large number with "meals remaining" label on the right
3. **Segmented progress bars**: Replace continuous bars with segmented ones (10 segments each)
4. **Meal row**: Plate icon + segmented bar + "X of Y meals used" + clock icon "Zd until reset"
5. **Snack row**: Apple icon + segmented bar + "X of Y snacks used" + check icon "Z left"

## Tasks
- [x] Read current code and reference image
- [x] Redesign the hero card JSX in `Subscription.tsx` (lines ~633-693)
- [x] Verify no linter errors

## Review
### Changes made
- **File**: `src/pages/Subscription.tsx`
- **Import**: Added `CheckCircle2` to lucide-react imports
- **Hero card redesign**:
  - Plan name now uses `font-extrabold uppercase tracking-wide` for the bold look
  - Icon container changed from `rounded-2xl` to `rounded-full` with `backdrop-blur-sm`
  - Meals remaining number enlarged to `text-4xl font-extrabold`
  - Continuous progress bars replaced with **segmented bars** — each segment represents one meal/snack slot
  - Meal row: `Utensils` icon + segmented white segments + "X of Y meals used" + `Clock` icon with days until reset
  - Snack row: Apple emoji + segmented gradient segments (red→amber) + "X of Y snacks used" + `CheckCircle2` icon with remaining count
- No new files created, no linter errors introduced
