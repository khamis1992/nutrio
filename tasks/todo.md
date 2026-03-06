# Add التحليلات Section to Weekly Report (UI + PDF)

## Plan

- [x] 1. Add `report_analytics` translation keys to `LanguageContext.tsx`
- [x] 2. Add `waterChartData` + `macroChartData` useMemo in `ProfessionalWeeklyReport.tsx`
- [x] 3. Insert "التحليلات" Card section in the on-screen report (after calorie chart)
- [x] 4. Add `analyticsPage()` to `nutrio-report-pdf.ts` and call it from `generate()`

## Review

### Changes Made

1. **`src/contexts/LanguageContext.tsx`** — Added translation keys:
   - `report_analytics`: "Analytics" / "التحليلات"
   - `report_analytics_water`: "Water Intake" / "استهلاك الماء"
   - `report_analytics_macros`: "Macros Breakdown" / "توزيع العناصر الغذائية"
   - `report_carbs`: "Carbs" / "الكربوهيدرات"
   - `report_fat`: "Fat" / "الدهون"

2. **`src/components/progress/ProfessionalWeeklyReport.tsx`** — Added on-screen analytics card:
   - `waterChartData` + `macroChartData` useMemo hooks
   - Card section with water bar chart + macros grouped bar chart + legend

3. **`src/lib/nutrio-report-pdf.ts`** — Added a new PDF page (Analytics):
   - `analyticsPage()` method with jsPDF drawing:
     - Water intake bar chart (glasses/day, with target line at 8 glasses)
     - Daily macros grouped bar chart (protein=violet, carbs=amber, fat=teal)
     - 4-column summary cards (avg water, avg protein, avg carbs, avg fat)
   - Called from `generate()` as Page 5 (before Meal Plan)
