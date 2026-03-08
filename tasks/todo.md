# Log Activity - Arabic Translation Fix

## Problem
The `LogActivitySheet.tsx` component has all text hardcoded in English. It does not use the `useLanguage` context, so switching to Arabic has no effect.

## Plan

### Todo Items

- [ ] 1. Add new English translation keys to `LanguageContext.tsx` (after `report_failed` key ~line 244)
- [ ] 2. Add corresponding Arabic translation keys to `LanguageContext.tsx` (after `report_failed` Arabic ~line 2098)
- [ ] 3. Update `LogActivitySheet.tsx` to import and use `useLanguage`, replacing all hardcoded English strings with `t()` calls

### Keys to Add

| Key | English | Arabic |
|-----|---------|--------|
| `log_activity_subtitle` | Track your calories burned today | تتبع السعرات المحروقة اليوم |
| `log_activity_todays_activities` | Today's Activities | أنشطة اليوم |
| `log_activity_cal_burned_today` | {total} cal burned today | {total} سعرة محروقة اليوم |
| `log_activity_search_placeholder` | Search activities... | ابحث عن نشاط... |
| `log_activity_filter_all` | All | الكل |
| `log_activity_cat_cardio` | Cardio | كارديو |
| `log_activity_cat_strength` | Strength | قوة |
| `log_activity_cat_flexibility` | Flexibility | مرونة |
| `log_activity_cat_sports` | Sports | رياضة |
| `log_activity_cal_per_hour` | ~{cal} cal / hour | ~{cal} سعرة / ساعة |
| `log_activity_duration_label` | Duration | المدة |
| `log_activity_custom` | Custom | مخصص |
| `log_activity_estimated_burn` | Estimated burn | الحرق المتوقع |
| `log_activity_how_calculated` | How it's calculated | كيف يتم الحساب |
| `log_activity_formula_desc` | MET ({met}) × your weight ({weight} kg) × duration = calories burned... | MET ({met}) × وزنك ({weight} كجم) × المدة = السعرات المحروقة... |
| `log_activity_success_title` | Activity logged! | تم تسجيل النشاط! |
| `log_activity_success_desc` | {name} — {cal} cal burned. | {name} — {cal} سعرة محروقة. |
| `log_activity_failed_title` | Failed to save | فشل الحفظ |
| `log_activity_failed_desc` | Please try again. | يرجى المحاولة مرة أخرى. |
| `log_activity_log_button` | Log {cal} cal | تسجيل {cal} سعرة |

### Scope
- Only 2 files changed: `LanguageContext.tsx` (add ~40 lines) and `LogActivitySheet.tsx` (add `useLanguage` import + replace ~20 hardcoded strings)
- Activity names stored in DB are **not** changed (they stay in English as DB identifiers)
- No other files touched

## Review

All 3 tasks completed. Changes made to 2 files only:

### `src/contexts/LanguageContext.tsx`
- Added 20 new translation keys to the English section (after `report_failed`)
- Added 20 matching Arabic translations to the Arabic section
- Keys cover: sheet title/subtitle, "Today's Activities", cal burned banner, search placeholder, category filters, cal/hour label, duration label, "min", "Custom", "Estimated burn", formula section, toast messages, and log button

### `src/components/LogActivitySheet.tsx`
- Added `import { useLanguage } from "@/contexts/LanguageContext"`
- Added `const { t } = useLanguage()` inside the component
- Added `categoryLabel()` helper to map English category IDs → translated labels
- Replaced all ~20 hardcoded English strings with `t("key")` calls
- Activity names stored in the DB are kept in English (they're identifiers, not display-only text)
- No other files touched
