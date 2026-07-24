# Dashboard Tab Bar Redesign

**Date:** July 24, 2026  
**Status:** Completed  
**File:** `src/pages/Dashboard.tsx`

---

## Todo

- [x] Redesign Dashboard tab bar markup/styles in `Dashboard.tsx`
- [x] Keep motion indicator + a11y/test ids
- [x] Quick visual check of 4 active states

---

## Review

### What changed
Replaced the heavy 54px tab bar with a cleaner Nutrio segmented control:
- Track: `bg-slate-100`, tighter `p-1`
- Active: white pill + soft shadow + emerald icon
- Removed sky/emerald gradient underline and inactive white icon chips
- Height: `min-h-11` (~44px)
- Kept `layoutId` slide animation, routes, and `data-testid`s

### How to verify
Open `/dashboard` and switch Today → Nutrition → Activity → Progress.
