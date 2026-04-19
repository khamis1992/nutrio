# Take Photo – Log Meal Feature: Complete Reverse-Flow Validation & Logic Audit

**Date:** 2026-04-12
**Auditor:** Senior QA Engineer
**Feature:** Take Photo (AI Meal Scanning) on Log Meal
**Files Analyzed:**
- `src/components/LogMealDialog.tsx` (1307 lines)
- `supabase/functions/analyze-meal-image/index.ts` (367 lines)
- `supabase/migrations/20260225211304_add_atomic_meal_completion.sql` (297 lines)
- `supabase/migrations/20260412000002_fix_meal_reverse_flow.sql` (216 lines)
- `src/hooks/useMealCompletion.ts` (163 lines)
- `src/pages/Schedule.tsx` (selected sections)
- `src/pages/health/HealthDashboard.tsx` (selected sections)

---

## 1. FORWARD WORKFLOW AUDIT

### 1.1 Standard Flow: Take Photo → Log Meal

```
[CAMERA/GALLERY] → runImageScan() → analyze-meal-image (edge fn) 
    → Detected Items → User Confirms → logMeal() 
    → progress_logs (INSERT/UPDATE) + meal_history (INSERT) 
    → award_xp_for_meal_log (+10 XP) → increment_meals_logged 
    → complete_meal_atomic (if scheduled) → onMealLogged() callback
```

| Step | Component | Status | Notes |
|------|-----------|--------|-------|
| Camera capture | `handleTakePhoto()` LogMealDialog:563 | ✅ OK | Capacitor Camera API, permission check |
| Permission denied UX | LogMealDialog:568-575 | ✅ OK | Toast + settings redirect |
| Gallery pick | `handlePickFromGallery()` LogMealDialog:598 | ✅ OK | CameraSource.Photos |
| Web fallback | cameraInputRef/galleryInputRef LogMealDialog:673-674 | ✅ OK | File input for web |
| AI analysis invoke | `runImageScan()` LogMealDialog:487 | ✅ OK | Calls analyze-meal-image edge fn |
| JWT auth | analyze-meal-image:13-55 | ✅ OK | validateAuthToken() |
| Rate limit check | analyze-meal-image:105-141 | ⚠️ 50/hr | Uses api_logs table count |
| Vision API call | analyze-meal-image:254-275 | ✅ OK | Gemini 2.5 Flash via Manus proxy |
| Result parsing | analyze-meal-image:294-336 | ✅ OK | Handles JSON wrapped in markdown |
| Fallback on error | analyze-meal-image:346-367 | ✅ OK | Returns empty items |
| User adjusts qty | adjustScanQuantity() LogMealDialog:307 | ✅ OK | 0.5–10 range |
| Items auto-selected | LogMealDialog:509-511 | ✅ OK | Added to selected Map |
| Add selected | handleAddSelected() LogMealDialog:396 | ✅ OK | Calls logMeal() for each |
| Progress update | logMeal() LogMealDialog:342-364 | ✅ OK | progress_logs INSERT or UPDATE |
| History insert | logMeal() LogMealDialog:367-372 | ✅ OK | meal_history INSERT |
| XP award | logMeal() LogMealDialog:375-382 | ✅ OK | award_xp_for_meal_log RPC |
| Counter increment | logMeal() LogMealDialog:385-391 | ✅ OK | increment_meals_logged RPC |
| Schedule complete | handleAddSelected() LogMealDialog:420-426 | ✅ OK | complete_meal_atomic RPC |
| Analytics track | LogMealDialog:435-440 | ✅ OK | meals_logged event |
| Parent refresh | LogMealDialog:443 | ✅ OK | onMealLogged() callback |

### 1.2 Barcode Scanner Flow

| Step | Status | Notes |
|------|--------|-------|
| BarcodeScanner component | ✅ OK | Uses @zxing/library |
| Open Food Facts API lookup | ✅ OK | Public API |
| Duplicate detection (1hr) | ✅ OK | LogMealDialog:524-537 |
| Auto-add to selection | ✅ OK | LogMealDialog:554-558 |

---

## 2. REVERSE / BACKWARD WORKFLOW AUDIT

### 2.1 Delete from Recent History

**Trigger:** Trash2 button on recent meal item → `handleDeleteItem()` (LogMealDialog:180-256)

```
handleDeleteItem() → subtract_meal_from_progress → uncomplete_meal_atomic 
    → decrement_meals_logged → audit_meal_history_delete → meal_history.delete()
```

| Step | Function | Status | Notes |
|------|----------|--------|-------|
| Subtract from progress | subtract_meal_from_progress | ✅ OK | Uses FOR UPDATE lock |
| Uncomplete scheduled | uncomplete_meal_atomic | ✅ OK | If scheduleId exists |
| Decrement counter | decrement_meals_logged | ✅ OK | GREATEST(0, count - 1) |
| Audit log | audit_meal_history_delete | ✅ OK | meal_history_audit table |
| Delete record | meal_history.delete() | ✅ OK | |
| UI update | setRecentItems filter | ✅ OK | Optimistic removal |
| Analytics track | meal_deleted event | ✅ OK | |
| Parent refresh | onMealLogged() | ✅ OK | |

### 2.2 Issues in Reverse Flow

#### 🔴 CRITICAL BUG #1: XP Not Reversed on Meal Deletion

**Location:** `LogMealDialog.tsx:180-256` (`handleDeleteItem`)

When a meal is deleted, **10 XP is NOT deducted**. The `award_xp_for_meal_log()` function is called on meal creation, but no corresponding `deduct_xp_for_meal()` function exists.

**Impact:** Users can delete meals to farm XP indefinitely. XP balance becomes unreliable.

**Recommendation:** Create `deduct_xp_for_meal_deletion()` function and call it in `handleDeleteItem`:
```sql
CREATE OR REPLACE FUNCTION deduct_xp_for_meal_deletion(
    p_user_id UUID,
    p_xp_amount INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE profiles
    SET xp = GREATEST(0, COALESCE(xp, 0) - p_xp_amount),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object('success', true, 'xp_deducted', p_xp_amount);
END;
$$;
```

#### 🔴 CRITICAL BUG #2: Non-Existent Table `meal_logs` Referenced

**Location:** `src/pages/health/HealthDashboard.tsx:68`
```typescript
const { data: meals } = await supabase
  .from("meal_logs")  // ❌ TABLE DOES NOT EXIST
  .select("date, calories, protein")
```

**Confirmed Missing:** `meal_logs` table does NOT exist (documented in `docs/FULL_APP_TEST_RESULTS.md:130`).
The app uses `meal_history` for meal tracking, not `meal_logs`.

**Impact:** Health Dashboard meal compliance section is completely broken.

**Recommendation:** Change to `meal_history` and aggregate by date:
```typescript
const { data: meals } = await supabase
  .from("meal_history")
  .select("logged_at, calories, protein_g")
  .eq("user_id", user.id)
  .gte("logged_at", weekAgo)
```

#### 🟡 BUG #3: No Transaction Wrapper for Multi-Step Deletion

**Location:** `LogMealDialog.tsx:180-256`

The `handleDeleteItem()` function performs 5 sequential database operations with NO atomic transaction wrapper. If any operation fails after a prior one succeeded, the database is left in an inconsistent state.

**Example failure scenario:**
1. ✅ `subtract_meal_from_progress` succeeds
2. ❌ `uncomplete_meal_atomic` fails (network error)
3. ⚠️ Function continues to steps 3-5, then catches error
4. ⚠️ `loadRecent()` restores UI but database is partially modified

**Current error handling (LogMealDialog:247-255):**
```typescript
} catch (error) {
  console.error("Failed to delete meal:", error);
  toast({ title: t("failed_to_delete"), variant: "destructive" });
  loadRecent();  // ⚠️ Only restores UI, doesn't rollback DB changes
}
```

**Recommendation:** Wrap all operations in a database transaction or create a single `delete_meal_history_entry()` RPC that performs all steps atomically.

#### 🟡 BUG #4: Schedule Completion from LogMealDialog Doesn't Pass Nutrition Data

**Location:** `LogMealDialog.tsx:420-426`
```typescript
await (supabase.rpc as any)('complete_meal_atomic', {
  p_schedule_id: scheduleId,
  p_user_id: userId,
  p_log_date: today,
  // ❌ p_calories, p_protein_g, p_carbs_g, p_fat_g NOT PASSED
});
```

Compare to `Schedule.tsx:303-311` which correctly passes nutrition:
```typescript
await (supabase.rpc as any)('complete_meal_atomic', {
  p_schedule_id: scheduleId,
  p_user_id: user.id,
  p_log_date: schedule.scheduled_date,
  p_calories: schedule.meal.calories || 0,      // ✅
  p_protein_g: schedule.meal.protein_g || 0,    // ✅
  p_carbs_g: schedule.meal.carbs_g || 0,         // ✅
  p_fat_g: schedule.meal.fat_g || 0,            // ✅
  p_fiber_g: 0,
});
```

**Impact:** Works correctly due to fallback in `complete_meal_atomic:58-72` that pulls from meal record, but is fragile and inconsistent.

#### 🟡 BUG #5: Wrong Date Used When Uncompleting Past Schedules

**Location:** `LogMealDialog.tsx:200-205`
```typescript
if (item.scheduleId) {
  await (supabase.rpc as any)('uncomplete_meal_atomic', {
    p_schedule_id: item.scheduleId,
    p_user_id: userId,
    p_log_date: logDate,  // ⚠️ This is the logged_at date, not the original schedule date
  });
}
```

**Problem:** When deleting a meal from history that was logged from a past scheduled meal, `logDate` is the meal's `logged_at` timestamp, NOT the original `scheduled_date`. The `uncomplete_meal_atomic` function subtracts nutrition from the wrong day.

**Example:** Meal scheduled for March 10, logged on March 11 (logged_at = 2026-03-11). User deletes it on March 12. The function tries to subtract from `progress_logs` for 2026-03-11 instead of 2026-03-10.

#### 🟡 BUG #6: No Audit for Streak Changes on Deletion

When a meal is deleted and nutrition is subtracted from `progress_logs`, the `on_progress_log_changed` trigger recalculates streaks. However:
- No audit log records the streak impact
- If streak is broken due to deletion, user has no way to verify why
- No notification to user that streak was affected

---

## 3. DEPENDENCY VALIDATION

### 3.1 Accounting / Ledger Entries
| Dependency | Status | Notes |
|------------|--------|-------|
| progress_logs | ✅ OK | Updated on log and deletion |
| profiles.total_meals_logged | ✅ OK | Incremented/decremented |
| profiles.xp | ⚠️ XP not deducted on delete | See Bug #1 |
| meal_history | ✅ OK | Inserted on log, deleted on delete |
| meal_history_audit | ✅ OK | Deletion audited |
| meal_completion_audit | ✅ OK | Schedule completion audited |

### 3.2 Notifications
| Dependency | Status | Notes |
|------------|--------|-------|
| send-meal-reminders | ✅ OK | Cron job, independent |
| useDeliveredMealNotifications | ✅ OK | Uses different data |
| **No reverse notification** | ⚠️ Missing | No notification when meal deleted |

### 3.3 Reports / Analytics
| Dependency | Status | Notes |
|------------|--------|-------|
| Analytics events logged | ✅ OK | xp_earned, meals_logged, meal_deleted |
| HealthDashboard | ❌ BROKEN | References non-existent meal_logs table |
| ProgressRedesigned charts | ✅ OK | Uses progress_logs |
| Dashboard stats | ✅ OK | Uses progress_logs |

### 3.4 Dashboard Stats
| Dependency | Status | Notes |
|------------|--------|-------|
| Today's calories | ✅ OK | progress_logs |
| Protein/carbs/fat | ✅ OK | progress_logs |
| Meals logged count | ✅ OK | profiles.total_meals_logged |

### 3.5 User Balances / Wallet / Credits
| Dependency | Status | Notes |
|------------|--------|-------|
| meal_credits (subscription) | ✅ Separate system | Not affected by photo meals |
| XP balance | ⚠️ Not reversed on delete | See Bug #1 |

### 3.6 Partner/Admin/Driver Portals
| Dependency | Status | Notes |
|------------|--------|-------|
| Partner meal image upload | ✅ OK | Separate flow (MealImageUpload) |
| Admin meal approvals | ✅ OK | Uses meals table |
| Driver QR scanner | ✅ OK | Separate feature |

---

## 4. EDGE CASES

### 4.1 Partial Reversal
**Status:** ⚠️ Issues Found

If deletion fails partway through (e.g., after subtract_meal_from_progress succeeds but before delete), the database is left with:
- Reduced nutrition in progress_logs
- Original meal still in meal_history
- No way for user to know data is inconsistent

### 4.2 Double Reversal Attempt
**Status:** ✅ Handled

The RPC functions are idempotent:
- `subtract_meal_from_progress` uses GREATEST(0, ...) so won't go negative
- `decrement_meals_logged` uses GREATEST(0, ...) so won't go negative
- `uncomplete_meal_atomic` returns `nothing_to_undo: true` if not completed
- `meal_history.delete()` silently succeeds if record gone

### 4.3 Reversal After Timeout/Expiry
**Status:** ❌ Not Handled

If user tries to delete a meal from a past date (e.g., 30 days ago):
- `logDate` is derived from `item.logged_at` in LogMealDialog:187
- `progress_logs` only keeps current state, not historical snapshots per meal
- Subtracting from today's progress_logs instead of the original date's progress

### 4.4 Reversal with Missing Dependencies
**Status:** ✅ OK

- If meal_history record doesn't exist, delete silently succeeds
- If no progress_log for that date, subtract returns `nothing_to_undo: true`
- If no scheduled meal, uncomplete returns `nothing_to_undo: true`

### 4.5 Permissions Conflict
**Status:** ✅ OK

All RPC functions use SECURITY DEFINER with `SET search_path = public` and proper user_id checks. RLS policies enforce ownership.

### 4.6 Concurrent Edits During Reversal
**Status:** ⚠️ Potential Race Condition

`subtract_meal_from_progress` uses `FOR UPDATE` lock on progress_logs row, but:
- `audit_meal_history_delete` is called AFTER the lock is released
- If two deletions happen simultaneously, audit could be written for a meal that was only partially deleted

### 4.7 Invalid Rollback Sequences
**Status:** ✅ OK

The functions validate state before acting:
- `uncomplete_meal_atomic` checks `is_completed` first
- `decrement_meals_logged` uses GREATEST(0, ...) to prevent negative
- No irreversible actions without validation

---

## 5. ADDITIONAL FINDINGS

### 5.1 Type Definitions Out of Sync
**Location:** `src/integrations/supabase/types.ts`

- `meal_photos` table exists in DB but NOT in types.ts
- `user_nutrition_log` exists in types.ts (line 6407) but may not exist in DB
- `meal_completion_audit` RLS policy may be missing (types.ts line 2907)

**Recommendation:** Run `npx supabase gen types typescript` to regenerate

### 5.2 AI Analysis Rate Limit Race Condition
**Location:** `analyze-meal-image/index.ts:105-141`

The rate limit check (`checkRateLimit`) and logging (`logSuccessfulAnalysis`) are separate operations. Under high concurrency:
1. Request A checks count = 49 (allowed)
2. Request B checks count = 49 (allowed)
3. Both proceed and are logged
4. Count becomes 51, exceeding limit

**Not critical** since it's a soft limit (50/hr) and the consequence is just extra API calls, but worth noting.

### 5.3 No Image Storage for AI-Analyzed Meals
**Location:** LogMealDialog.tsx

When a user takes a photo:
- The base64 image is sent to `analyze-meal-image`
- The analyzed nutrition data is stored in meal_history
- **The original image is NOT stored anywhere**

This means:
- No before/after comparison possible
- No manual review of AI analysis accuracy
- No way to re-analyze the same meal
- No proof of what the user actually ate

### 5.4 Partner Meal Image Upload is Separate System
**Location:** `MealImageUpload.tsx`, `PartnerMenu.tsx`

Partner meal photos are uploaded to `meal-images` storage bucket and stored with meals. This is a **completely separate system** from the customer "Take Photo" feature which analyzes images via AI but doesn't store them.

**Gap:** No unified meal photo strategy across the platform.

### 5.5 No Photo in meal_history Table
**Location:** `meal_history` schema

The `meal_history` table has no `image_url` or `photo_url` column. There's no way to:
- See what photo was taken for a logged meal
- Re-verify AI analysis
- Display meal photos in history

---

## 6. SUMMARY OF BUGS/ISSUES

### Critical (Must Fix)
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | XP not reversed on deletion | LogMealDialog:180-256 | XP farming possible |
| 2 | meal_logs table doesn't exist | HealthDashboard:68 | Health compliance broken |

### High (Should Fix)
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 3 | No transaction wrapper for deletion | LogMealDialog:180-256 | Data inconsistency risk |
| 4 | Wrong date for uncomplete on past meals | LogMealDialog:200-205 | Nutrition subtracted from wrong day |
| 5 | Schedule completion doesn't pass nutrition | LogMealDialog:420-426 | Fragile, relies on implicit fallback |

### Medium (Nice to Fix)
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | No streak impact audit | Reverse flow | No visibility into streak changes |
| 7 | AI-analyzed images not stored | LogMealDialog:479-520 | No photo history |
| 8 | No notification on meal deletion | Reverse flow | User not informed of impact |
| 9 | meal_photos not in types | types.ts | Type safety issue |
| 10 | Rate limit race condition | analyze-meal-image:105 | Soft limit, low impact |

### Low (Consider)
| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 11 | Partner meal photos separate system | MealImageUpload vs LogMealDialog | No unified photo strategy |
| 12 | Double-delete race window | LogMealDialog:226 | Minor data integrity |

---

## 7. RECOMMENDATIONS FOR FIXES

### Priority 1 (Critical)
1. **Create `deduct_xp_for_meal_deletion()` function** and call it in `handleDeleteItem`
2. **Fix HealthDashboard** to use `meal_history` instead of `meal_logs`

### Priority 2 (High)
3. **Create atomic `delete_meal_entry()` RPC** that wraps all 5 operations in a single transaction
4. **Pass nutrition data** when calling `complete_meal_atomic` from LogMealDialog
5. **Use original scheduled_date** instead of logged_at for `uncomplete_meal_atomic`

### Priority 3 (Medium)
6. **Store AI-analyzed images** in Supabase storage and link to meal_history
7. **Add streak impact logging** when nutrition is subtracted
8. **Regenerate types** with `npx supabase gen types typescript`
9. **Add deletion notification** toast showing XP/streak impact

### Priority 4 (Low)
10. **Unify photo storage strategy** across Take Photo and Partner uploads
11. **Add index on meal_history.user_id + logged_at** for efficient history queries

---

## 8. TESTING CHECKLIST

### Forward Flow Tests
- [ ] Camera permission granted → photo captured → AI analysis runs
- [ ] Camera permission denied → appropriate error shown
- [ ] Gallery selection works on native and web
- [ ] AI returns empty result → user sees "Nothing detected" toast
- [ ] AI analysis fails → fallback response, user can still log manually
- [ ] Rate limit exceeded → user sees rate limit message with reset time
- [ ] Multiple items detected → all auto-selected with qty=1
- [ ] Quantity adjustment works (0.5 to 10)
- [ ] Deselect item → item removed from selection
- [ ] Add selected → progress_logs updated
- [ ] Add selected → meal_history inserted
- [ ] Add selected → XP incremented by 10
- [ ] Add selected → meals_logged counter incremented
- [ ] Scheduled meal → marked complete via complete_meal_atomic
- [ ] OnMealLogged callback fires → parent refreshes

### Reverse Flow Tests
- [ ] Delete recent meal → nutrition subtracted from progress_logs
- [ ] Delete recent meal → XP deducted by 10
- [ ] Delete scheduled meal → uncomplete_meal_atomic called
- [ ] Delete scheduled meal → meal removed from schedule
- [ ] Delete meal → meal_history_audit record created
- [ ] Delete meal → meal_history record deleted
- [ ] Double delete → no negative values
- [ ] Delete after 7 days → correct date used
- [ ] Delete when progress_log doesn't exist → handled gracefully
- [ ] Delete when schedule already uncomplete → handled gracefully

### Edge Case Tests
- [ ] Network error mid-deletion → transaction rollback
- [ ] Concurrent deletion of same meal → no race condition
- [ ] Delete meal with 0 calories → no XP awarded (already not awarded)
- [ ] Offline → appropriate error handling

---

*Report generated: 2026-04-12*
*Auditor: Senior QA Engineer*
