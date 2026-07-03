# 🧠 Intelligence Layer: AI Data Flow & Logic

Nutrio utilizes several "Intelligence Pipelines" where user data is sent to serverless edge functions, analyzed by LLMs/Vision models, and returned as structured clinical or nutritional data.

---

## 1. AI Meal Photo Logging Flow
The process of converting a real-world image into a nutritional log entry.

### 🔄 Technical Sequence:
1. **Capture**: `FoodPhotoLogSheet` triggers Capacitor Camera $\rightarrow$ Image uploaded to Supabase Storage.
2. **Invoke**: Frontend calls `analyze-meal-image` Edge Function via `supabase.functions.invoke()`.
3. **Analysis**:
   - Edge Function sends the image to **Gemini 2.5 Flash (Vision)**.
   - Prompt requires a structured JSON response containing: `food_item`, `estimated_weight`, and `calories/macros`.
4. **Validation**: Edge Function validates the JSON structure.
5. **Commit**: Frontend receives items $\rightarrow$ `logMealItems()` $\rightarrow$ Inserts into `progress_logs` and `meal_history` tables.
6. **Reward**: `useXPBalance` hook triggers XP award based on the logging event.

---

## 2. Blood Work AI Analysis Flow
Converting raw clinical lab reports into a health score and actionable advice.

### 🔄 Technical Sequence:
1. **Upload**: User uploads PDF/JPG in `BloodWorkUpload.tsx`.
2. **OCR & Extraction**: The file is sent to a specialized Edge Function that perform OCR $\rightarrow$ identifies biomarkers (e.g., *HbA1c, LDL, Creatinine*).
3. **Categorization**: The AI maps identified markers to categories (*Metabolic, Lipid, etc.*) and compares them against medical reference ranges.
4. **Insight Generation**: AI generates a natural language report explaining anomalies and suggesting nutritional interventions.
5. **Storage**: Results are stored in the `blood_work_records` table for historic trend tracking.
6. **Composite Score**: A `health_score` is calculated by weighting critical biomarkers.

---

## 3. Weekly AI Health Report Generation
A periodic synthesis of all user activity, nutrition, and biometrics.

### 🔄 Technical Sequence:
1. **Trigger**: Weekly cron job or user-requested trigger in `/ai-report`.
2. **Data Aggregation**: Edge Function queries:
   - `progress_logs` (Calorie/Macro adherence).
   - `weight_tracking` (Weight trends).
   - `activity_logs` (MET values/Step counts).
   - `blood_work_records` (Recent biological lapped markers).
3. **Synthesis**: Data is passed to the LLM with a prompt focused on *consistency, quality, and goal alignment*.
4. **Generation**: The AI produces a structured report containing:
   - **Meal Quality Score**.
   - **Consistency Rating**.
   - **Readiness Analysis**.
5. **Delivery**: The final report is rendered as a UI view and made available as a downloadable PDF.

`💡 Developer Note: Since all AI flows rely on asynchronous Edge Functions, the frontend implements "Optimistic UI" updates and loading skeletons to maintain a premium perceived performance.`
