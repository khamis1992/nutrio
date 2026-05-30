# Auto-fill Feature UX Redesign Plan

**Project:** Nutrio Fuel - Customer App  
**Feature:** Auto-fill (Smart Meal Scheduling)  
**Current Location:** `Schedule.tsx` → `MealWizard.tsx`  
**Created:** 2026-03-18  

---

## Executive Summary

The current Auto-fill feature allows users to have AI automatically suggest and fill their daily meal schedule. While functional, the UX has several friction points that reduce adoption and usability. This document outlines a comprehensive redesign to improve the user experience.

**Current State Score: 5/10**  
- Functionality works but requires multiple steps
- No personalization before generating suggestions  
- Loading state provides no guidance or skeleton
- Success state lacks celebration or next steps

**Target State Score: 8.5/10**  
- Streamlined 2-click completion
- Personalized suggestions based on preferences
- Clear loading states with progress indication
- Delightful success experience with action follow-up

---

## Current Flow Analysis

### How It Works Now

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CURRENT AUTO-FILL FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

Schedule Page
    │
    ├── User clicks "Auto-fill" button (✨ sparkles icon)
    │
    ▼
MealWizard Opens (mode → skipped, phase → "scheduling")
    │
    ├── Auto-loads smart-meal-allocator edge function
    │   └── Shows "Feature not available" toast if error
    │
    ▼
Auto-fill Dialog (Modal)
    │
    ├── Shows generated meal suggestions (4 meal types)
    ├── User can toggle individual meals on/off
    ├── Shows meal name, restaurant, calories for each
    ├── "Refresh" button to get new suggestions
    │   └── Locked meals preserved on refresh
    │
    ▼
User clicks "Apply Selected"
    │
    ├── Selected meals added to selectedMeals state
    ├── Dialog closes
    ├── If all 4 meals selected → Plan Summary shown
    └── User still needs to confirm delivery time
```

### Code Flow

```tsx
// Schedule.tsx - Line 653
onClick={() => { setWizardAutoFill(true); setShowWizard(true); }}

// MealWizard.tsx - Line 182-188
useEffect(() => {
  if (autoFill) {
    setLocalSingleMode(false);
    setPhase("scheduling");
    handleAutoFillDay(false);  // Immediately calls AI
  }
}, [autoFill]);

// Edge function call - Line 712
const { data, error } = await supabase.functions.invoke("smart-meal-allocator", {
  body: requestBody,  // user_id, week_start_date, generate_variations
});
```

---

## Identified UX Issues

### 🔴 Critical Issues

| # | Issue | Impact | Line |
|---|-------|--------|------|
| 1 | **No Personalization Before Generate** | Users can't specify preferences (cuisine, calorie target, dietary restrictions) before AI generates suggestions | N/A |
| 2 | **Blocking Modal** | The entire wizard blocks the screen; users can't reference their schedule while choosing | Line 874-957 |
| 3 | **No Loading Skeleton** | When `autoFillLoading=true`, just a spinner - no preview of what's coming | Line 1820-1882 |
| 4 | **Error Handling** | "Feature not available" toast on failure with no retry or fallback | Line 738-746 |

### 🟡 Moderate Issues

| # | Issue | Impact | Line |
|---|-------|--------|------|
| 5 | **Refresh Not Obvious** | Users don't realize they can refresh to get different suggestions | Line 817-827 |
| 6 | **No Nutrition Preview** | Can't see total calories/macros until after applying | Line 1177-1197 |
| 7 | **No Explanation** | Doesn't explain WHY these meals were recommended | N/A |
| 8 | **Locked Meals UX** | The "lock and refresh" pattern is confusing | Line 757-766 |

### 🟢 Minor Issues

| # | Issue | Impact | Line |
|---|-------|--------|------|
| 9 | **Success State Basic** | After applying, just shows success briefly | Line 857-866 |
| 10 | **No Quick Actions** | Can't undo or quickly swap individual meals | Line 1161-1169 |
| 11 | **Timing Context** | Doesn't consider time of day (morning vs evening orders) | N/A |

---

## Redesign Recommendations

### Phase 1: Quick Wins (1-2 Days)

#### 1.1 Add Loading Skeleton with Preview

**Current:**
```tsx
{autoFillLoading ? (
  <Loader2 className="w-6 h-6 animate-spin" />
) : (...)}
```

**Recommended:**
```tsx
// Show skeleton cards matching the expected output
{autoFillLoading ? (
  <div className="space-y-4">
    {MEAL_TYPES.map((type) => (
      <div key={type} className="animate-pulse flex items-center gap-3 p-4 bg-gray-100 rounded-2xl">
        <div className="w-12 h-12 rounded-xl bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>
    ))}
    <p className="text-center text-sm text-gray-400 mt-2">
      <Sparkles className="w-4 h-4 inline animate-pulse" />
      Generating your personalized meal plan...
    </p>
  </div>
) : (...)}
```

---

#### 1.2 Improve Error Handling

**Current:**
```tsx
// Shows generic error toast
toast({
  title: "Feature not available",
  description: "Auto-fill is coming soon!"
});
```

**Recommended:**
```tsx
// Offer fallback + retry
const handleAutoFillError = (error: any) => {
  toast({
    title: "AI Suggestions Unavailable",
    description: "We're having trouble generating suggestions. You can still select meals manually or try again.",
    variant: "destructive",
    action: {
      label: "Try Again",
      onClick: () => handleAutoFillDay(false)
    }
  });
};
```

---

#### 1.3 Add Nutrition Preview in Dialog

**Current:** Shows only individual meal calories  
**Recommended:** Add a "Today's Totals" section above the meal list

```tsx
{/* Nutrition summary at top of dialog */}
<div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-3 mb-4">
  <p className="text-xs font-medium text-muted-foreground mb-2">Planned Nutrition</p>
  <div className="grid grid-cols-4 gap-2">
    <div>
      <p className="text-lg font-bold text-primary">{totalCalories}</p>
      <p className="text-xs text-muted-foreground">kcal</p>
    </div>
    <div>
      <p className="text-lg font-bold text-blue-500">{totalProtein}g</p>
      <p className="text-xs text-muted-foreground">protein</p>
    </div>
    <div>
      <p className="text-lg font-bold text-amber-500">{totalCarbs}g</p>
      <p className="text-xs text-muted-foreground">carbs</p>
    </div>
    <div>
      <p className="text-lg font-bold text-pink-500">{totalFat}g</p>
      <p className="text-xs text-muted-foreground">fat</p>
    </div>
  </div>
</div>
```

---

### Phase 2: UX Improvements (3-5 Days)

#### 2.1 Add Preference Quick-Select Before Generation

**Current:** AI generates without user input  
**Recommended:** Show preference chips before calling edge function

```tsx
// New state
const [showPreferencesSheet, setShowPreferencesSheet] = useState(true);
const [quickPrefs, setQuickPrefs] = useState({
  maxCalories: null,
  cuisine: null,
  proteinFocus: false,
});

// Before generating suggestions
{showPreferencesSheet && (
  <motion.div className="p-4 space-y-3">
    <p className="text-sm font-medium">Customize your day (optional)</p>
    
    {/* Calorie target slider */}
    <div>
      <p className="text-xs text-muted-foreground mb-2">Calorie target</p>
      <input type="range" min={1200} max={2500} step={100} />
    </div>
    
    {/* Quick cuisine preferences */}
    <div className="flex flex-wrap gap-2">
      {["High Protein", "Low Carb", "Vegetarian", "Quick Prep"].map(pref => (
        <button className="px-3 py-1 rounded-full text-xs border border-gray-200 hover:border-primary">
          {pref}
        </button>
      ))}
    </div>
    
    <Button onClick={() => { setShowPreferencesSheet(false); handleAutoFillDay(); }}>
      Generate My Day
    </Button>
  </motion.div>
)}
```

---

#### 2.2 Improve Lock & Refresh Pattern

**Current:** Confusing UI with lock/unlock buttons  
**Recommended:** Clear "Keep" / "Swap" pattern

```tsx
// Each meal row shows
<div className="flex items-center gap-2">
  <button onClick={() => toggleMealLock(index)}>
    {isLocked ? (
      <Lock className="w-4 h-4 text-primary" />  // Keep this meal
    ) : (
      <RefreshCw className="w-4 h-4 text-gray-400" />  // Swap for new suggestion
    )}
  </button>
  <button onClick={() => removeMeal(index)}>
    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
  </button>
</div>

// Footer
<div className="flex justify-between p-4 border-t">
  <Button variant="outline" onClick={handleRefreshWithLocked}>
    <RefreshCw className="w-4 h-4 mr-2" />
    Refresh Unlocked
  </Button>
  <Button onClick={applyAutoFillPlan}>
    Apply Selected ({selectedCount})
  </Button>
</div>
```

---

#### 2.3 Add "Why These Meals?" Explanation

**Current:** No explanation of recommendations  
**Recommended:** Add subtle explanatory text

```tsx
<div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
  <div className="flex items-start gap-2">
    <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
    <div>
      <p className="text-xs font-medium text-blue-700">Personalized for you</p>
      <p className="text-xs text-blue-600 mt-0.5">
        Based on your {userGoal} goal, dietary preferences, and today's remaining nutrition.
        {proteinFocus && " We prioritized protein-rich options."}
      </p>
    </div>
  </div>
</div>
```

---

### Phase 3: Enhanced Features (1-2 Weeks)

#### 3.1 Inline Auto-fill Preview (Non-Modal)

**Current:** Opens full-screen MealWizard modal  
**Recommended:** Show inline preview on Schedule page

```tsx
// Schedule.tsx - Add preview card
{showAutoFillPreview && (
  <motion.div 
    className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 mb-4"
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center gap-2 mb-3">
      <Sparkles className="w-5 h-5 text-orange-500" />
      <span className="font-semibold text-sm"> AI Suggestions for Today</span>
    </div>
    
    {/* Mini meal cards */}
    <div className="grid grid-cols-4 gap-2 mb-3">
      {suggestedMeals.map(meal => (
        <div className="bg-white rounded-xl p-2 text-center">
          <img src={meal.image} className="w-12 h-12 rounded-lg mx-auto mb-1" />
          <p className="text-xs font-medium truncate">{meal.name}</p>
          <p className="text-xs text-gray-400">{meal.calories} kcal</p>
        </div>
      ))}
    </div>
    
    <Button 
      size="sm" 
      onClick={acceptPreview}
      className="w-full"
    >
      Accept All
    </Button>
  </motion.div>
)}
```

---

#### 3.2 Quick Swap Gestures

**Current:** Must remove and regenerate  
**Recommended:** Swipe to swap individual meals

```tsx
// Swipe left on a suggested meal to swap it
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(e, info) => {
    if (info.offset.x < -100) {
      // Swipe left - replace this meal
      replaceMeal(index);
    }
  }}
>
  {/* Meal card */}
</motion.div>
```

---

#### 3.3 Celebration Success State

**Current:** Basic success message  
**Recommended:** Delightful animation with action buttons

```tsx
// Success screen
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  className="flex flex-col items-center py-8"
>
  {/* Animated checkmark */}
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ delay: 0.2, type: "spring" }}
    className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-primary flex items-center justify-center shadow-xl"
  >
    <Check className="w-10 h-10 text-white" />
  </motion.div>
  
  {/* Success message */}
  <h3 className="text-xl font-bold mt-4">Your Day is Set! 🎉</h3>
  <p className="text-sm text-gray-400 mt-1">
    {format(selectedDate, "EEEE, MMM d")} • {selectedMeals.length} meals scheduled
  </p>
  
  {/* Nutrition summary */}
  <div className="bg-gray-50 rounded-xl p-4 mt-4 w-full">
    <div className="grid grid-cols-4 gap-2 text-center">
      {/* Calories, Protein, Carbs, Fat */}
    </div>
  </div>
  
  {/* Action buttons */}
  <div className="flex gap-3 mt-4 w-full">
    <Button variant="outline" onClick={() => navigate("/progress")} className="flex-1">
      View Progress
    </Button>
    <Button onClick={onComplete} className="flex-1">
      Done
    </Button>
  </div>
</motion.div>
```

---

## Implementation Priority

| Phase | Task | Effort | Impact |
|-------|------|--------|--------|
| **Phase 1** | Loading skeleton | 2h | High |
| **Phase 1** | Error handling | 1h | High |
| **Phase 1** | Nutrition preview | 2h | Medium |
| **Phase 2** | Preference chips | 4h | Medium |
| **Phase 2** | Lock/swap UI | 3h | Medium |
| **Phase 2** | Explanation text | 1h | Low |
| **Phase 3** | Inline preview | 8h | High |
| **Phase 3** | Swipe gestures | 6h | Medium |
| **Phase 3** | Success state | 3h | Medium |

---

## File Changes Required

### Primary Files
- `src/components/MealWizard.tsx` - Main wizard component
- `src/pages/Schedule.tsx` - Schedule page with auto-fill trigger

### New Components to Create
- `src/components/AutoFillPreferences.tsx` - Quick preference selection
- `src/components/AutoFillPreview.tsx` - Inline preview card
- `src/components/AutoFillSuccess.tsx` - Celebration success screen

---

## Testing Checklist

### Functional Testing
- [ ] Auto-fill generates valid suggestions
- [ ] Locked meals preserved on refresh
- [ ] Calorie totals update correctly
- [ ] Apply selected schedules correctly
- [ ] Error handling works with fallback

### UX Testing
- [ ] Loading skeleton displays during generation
- [ ] Preference selections reflect in suggestions
- [ ] Nutrition totals accurate
- [ ] Success animation plays correctly
- [ ] All touch targets ≥ 44px

### Edge Cases
- [ ] No meals available from restaurants
- [ ] Network timeout during edge function call
- [ ] User has no active subscription
- [ ] All meals already scheduled for the day

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Auto-fill usage rate | ~15% (est.) | 40% | 2 weeks |
| Time to complete | ~60s | ~15s | 2 weeks |
| Error recovery rate | N/A | 80% | 1 week |
| User satisfaction | N/A | 85%+ | 4 weeks |

---

## Appendix: Current Code Reference

### Key Files
- `src/pages/Schedule.tsx` - Lines 653-663 (Auto-fill trigger)
- `src/components/MealWizard.tsx` - Lines 182-188 (Auto-fill init)
- `src/components/MealWizard.tsx` - Lines 685-802 (Auto-fill logic)
- `src/components/MealWizard.tsx` - Lines 829-866 (Apply logic)
- `supabase/functions/smart-meal-allocator/index.ts` - Edge function

### Key Functions
- `handleAutoFillDay(isRefresh)` - Generates suggestions
- `applyAutoFillPlan()` - Applies selected meals to state
- `toggleMealSelection(index)` - Toggles meal selection
- `handleRefreshWithLocked()` - Refreshes non-locked meals