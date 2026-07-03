# Nutrio Customer Portal - Unified Documentation



---

# File: C:\Users\khamis\Documents\nutrio\docs\tech-spec\architecture-overview.md

# 🏗️ Technical Architecture Overview: Nutrio Customer Portal

This document defines the systemic infrastructure, data flow, and integration patterns of the Nutrio Customer Portal.

---

## 1. System Architecture
Nutrio is built as a **Modern Single Page Application (SPA)** following a decoupled architecture where the frontend acts as a thin orchestration layer for a robust serverless backend.

### 🧩 Tech Stack
- **Frontend**: React (Vite) $\rightarrow$ TypeScript $\rightarrow$ Tailwind CSS $\rightarrow$ Framer Motion.
- **Backend-as-a-Service**: Supabase (PostgreSQL, Auth, Storage).
- **Compute**: Supabase Edge Functions (Deno/TypeScript) for AI and 3rd-party integrations.
- **External APIs**: Gemini Vision (AI Image analysis), Open Food Facts (Barcode data), SADAD (Payment gateway).

---

## 2. Core Data Flow Patterns

### 🔄 The "Hook-to-DB" Pattern
The application utilizes a custom hook-driven data architecture to ensure real-time synchronization across the portal:
`React Component` $\rightarrow$ `Custom Hook (e.g., useWallet)` $\rightarrow$ `Supabase Client` $\rightarrow$ `PostgreSQL Table` $\rightarrow$ `Real-time Subscription`.

### ⚡ Edge Function Execution (The "Intelligence" Layer)
For tasks requiring external APIs or heavy computation, Nutrio uses a secure Edge Function bridge:
`Frontend` $\rightarrow$ `supabase.functions.invoke('function-name')` $\rightarrow$ `JWT Validation` $\rightarrow$ `External API` $\rightarrow$ `Structured JSON Response` $\rightarrow$ `Frontend State Update`.

---

## 3. Integration Ecosystem

### 🧬 Health Data Sync
Nutrio implements a bidirectional sync pattern for biometric data:
- **Ingestion**: `HealthKit (iOS) / Google Fit (Android)` $\rightarrow$ `Capacitor Bridge` $\rightarrow$ `Local State` $\rightarrow$ `Supabase Storage`.
- **Processing**: The system maps external units (e.g., steps, calories) to Nutrio's internal metric system using a a normalized transformation layer.

### 💳 Financial Flow (The Wallet Bridge)
The payment system is designed to prevent balance drift:
1. **Initiation**: User selects package $\rightarrow$ `SADAD` payment request generated.
2. **Validation**: `SADAD Callback` $\rightarrow$ `Edge Function` $\rightarrow$ `Verify Transaction Hash`.
3. **Commit**: `Database Transaction` $\rightarrow$ `Increment Wallet Balance` $\rightarrow$ `Log Transaction`.

---

## 4. Security & Constraint Model
- **RLS (Row Level Security)**: Every table in the database is protected by RLS policies, ensuring users can only access their own nutrition logs, health reports, and wallet data.
- **Auth Gates**: Routes are protected via an `AuthProvider` that verifies session validity before rendering components.
- **Type Safety**: End-to-end type safety is maintained using generated Supabase TypeScript types.

`💡 Architecture Note: By moving all complex logic (AI analysis, Payment verification) into Edge Functions, the client remains lightweight and secure, preventing the exposure of sensitive API keys (e.g., Gemini, SADAD) to the browser.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\tech-spec\data-flow-ai.md

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



---

# File: C:\Users\khamis\Documents\nutrio\docs\tech-spec\finance-logic.md

# 💰 Financial & Subscription Logic: Wallet, SADAD, and Credits

Nutrio manages a hybrid financial model combining a credit-based wallet for a la carte lapped meals and a tiered subscription model for recurring access and quotas.

---

## 1. Wallet & SADAD Integration Flow
The wallet balances are handled with strict transactional integrity to prevent "phantom credits."

### 🔄 The Top-up Sequence:
1. **Selection**: User selects a top-up package in `Wallet.tsx`.
2. **Initiation**: Frontend calls `initiateSADADPayment()` $\rightarrow$ sends request to SADAD gateway.
3. **Payment State**: The system creates a `payment_transaction` record with status `pending`.
4. **The Callback**: SADAD invokes the `payment_callback` Supabase Edge Function upon successful payment.
5. **SADAD Verification**: The Edge Function verifies the transaction hash against the SADAD API.
6. **Balance Update**: On success, the system executes a PostgreSQL transaction:
   - `UPDATE user_wallets SET balance = balance + amount`
   - `UPDATE payment_transactions SET status = 'completed'`
7. **UI Update**: The `useWalletBalance` hook, listening via a Supabase Realtime subscription, updates the UI instantly.

---

## 2. Subscription Tiers & Quota Management
Subscriptions are managed through a logic layer that controls feature access and meal counts.

### 📋 Tier Hierarchy
Nutrio supports multiple tiers: *Basic, Standard, Premium, VIP, Healthy, Fresh, Weekly Boost, Elite*.
- **Meal Quota**: Each tier defines a monthly meal count (e.g., 60 meals/mo).
- **Feature Access**: High-tier plans unlock the `SADAD` rollover and the `AI Health Suite`.

### 🔄 The Rollover System
To prevent user frustration, Nutrio implements "Rollover Credits":
- **Calculation**: At the end of the billing cycle, `unused_credits = plan_limit - actual_consumed`.
- **Carry-over**: The system adds `unused_credits` to the next month's quota.
- **Limit**: Rollovers are capped at a maximum of 2x the monthly plan limit to prevent infinite accumulation.

### 🛡️ The Subscription Gate
The app implements a `SubscriptionGate` component:
- **Check**: `user_subscriptions` table $\rightarrow$ `expiry_date` and `status`.
- **Action**: If `status == 'expired'`, the component redirects the user to `/subscription/plans` and displays an "Expiry Banner."

---

## 3. Checkout & Credit Deduction
When a user schedules a meal or buys from the marketplace:
1. **Validation**: System checks `wallet_balance` $\rightarrow$ `meal_price`.
2. **Deduction**: `UPDATE user_wallets SET balance = balance - cost`.
3. **Log**: An entry is created in `wallet_transactions` for auditability.
4. **Failure**: If balance is insufficient, the `Buy Meal Credit` modal is triggered.



---

# File: C:\Users\khamis\Documents\nutrio\docs\tech-spec\health-sync.md

# 📲 Health Ecosystem Integration: HealthKit & Google Fit

Nutrio synchronizes biometric and activity data from external health providers to eliminate manual entry and increase tracking accuracy.

---

## 1. Integration Architecture
Nutrio uses a **Bridged Sync Pattern** to handle the differences between iOS (Apple Health) and Android (Google Fit).

### 🔄 The Sync Pipeline
`External Provider` $\rightarrow$ `Capacitor Plugin` $\rightarrow$ `Normalized Data Object` $\rightarrow$ `Supabase Table`.

### ⚙️ Provider-Specific Implementation
- **Apple Health (HealthKit)**: 
  - Uses a "Permission Request" flow to access specifically requested read/write keys.
  - Syncs Steps, Active Energy Burned, and Sleep data.
- **Google Fit**:
  - Uses OAuth2.0 to authenticate with the Google Health Connect API.
  - Syncs Steps, Heart Rate, and Distance.

---

## 2. Data Normalization & Mapping
Because different providers report data in different formats, Nutrio uses a transformation layer.

| External Key | Target Nutrio Table | Mapping Logic |
| :--- | :--- | :--- |
| `steps` | `daily_activity` | $\sum$ steps per UTC day $\rightarrow$ total_steps |
| `energy_burned` | `daily_activity` | kcal $\rightarrow$ activity_calories |
| `weight` | `weight_tracking` | lb/kg $\rightarrow$ normalized_kg |
| `sleep_duration` | `sleep_logs` | seconds $\rightarrow$ hours/minutes |

---

## 3. The Sync Engine Logic

### 🕒 Synchronization Cadence
To avoid battery drain and API rate limiting, Nutrio employs a **Tiered Sync Strategy**:
- **Immediate Sync**: Triggered when the user manually opens the `/step-counter` or `/tracker` pages.
- **Background Sync**: Triggered every 4 hours via a background task (if permitted by the OS).
- **On-Event Sync**: Triggered when the app moves from background to foreground.

### 🛠️ Collision Handling
When a manual entry conflicts with a synced value:
- **Weight**: Manual entry takes precedence over synced data (as users provide the most accurate scale readings).
- **Steps**: The system takes the **maximum** value between the manual entry and the synced provider to prevent under-counting.

---

## 4. Privacy & Security
- **Explicit Consent**: Users must explicitly grant permission for each specific metric.
- **Zero-Plaintext Storage**: Biometric data is stored using RLS-protected tables, ensuring no third-party access beyond the user and their assigned coach.
- **Encryption**: All data transmitted between the Health Providers and Supabase is encrypted via HTTPS.

`💡 Developer Note: When debugging sync issues, check the Capacitor logs for "Permission Denied" errors, as OS-level updates frequently reset HealthKit/Google Fit permissions.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\tech-spec\route-registry.md

# 🗺️ Detailed Route Registry & Feature Map

This document provides the absolute mapping between the feature catalog and the actual implementation within the React application.

---

## 1. Core Portal Routes
| Feature Set | Route | Primary Component | Key Hook / Logic |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `/dashboard` | `Dashboard.tsx` | `useUserNutrition`, `useDailyActivity` |
| **Nutrition Progress** | `/dashboard/nutrition` | `NutritionProgress.tsx` | `useNutritionGoals` |
| **Activity Feed** | `/dashboard/activity` | `ActivityFeed.tsx` | `useUserActivity` |
| **Weight/Trend Progress** | `/dashboard/progress` | `ProgressDashboard.tsx` | `useWeightTrend` |
| **Meal Browser** | `/meals` | `Meals.tsx` | `useSmartRecommendations` |
| **Restaurant Profile** | `/restaurant/:id` | `RestaurantDetail.tsx` | `useRestaurantData` |
| **Meal Detail** | `/meals/:id` | `MealDetail.tsx` | `useMealNutrition` |
| **Weekly Schedule** | `/schedule` | `Schedule.tsx` | `useMealSchedule` |
| **Progress & Analytics** | `/progress` | `Progress.tsx` | `usePerformanceMetrics` |
| **All-in-One Tracker** | `/tracker` | `Tracker.tsx` | `useBMICalculator` |
| **Water Tracker** | `/water-tracker` | `WaterTracker.tsx` | `useWaterLog` |
| **Step Counter** | `/step-counter` | `StepCounter.tsx` | `useStepSync` |
| **Weight Tracking** | `/weight-tracking` | `WeightTracking.tsx` | `useWeightHistory` |
| **Nutrition Goals** | `/nutrition-goals` | `NutritionGoals.tsx` | `useNutritionGoals` |
| **Body Metrics** | `/body-metrics` | `BodyMetrics.tsx` | `useBodyMeasurements` |
| **Health Dashboard** | `/health/dashboard` | `HealthDashboard.tsx` | `useHealthScore` |
| **Blood Work Upload** | `/health/blood-work` | `BloodWorkUpload.tsx` | `useFileUploader` |
| **Blood Work Results** | `/health/blood-work/results` | `BloodWorkResults.tsx` | `useBloodWorkAnalysis` |
| **Recovery Insights** | `/recovery-insights` | `RecoveryInsights.tsx` | `useReadinessScore` |
| **User Profile** | `/profile` | `Profile.tsx` | `useUserProfile` |
| **Rewards & XP** | `/rewards` | `Rewards.tsx` | `useXPBalance` |
| **Community Hub** | `/community` | `Community.tsx` | `useCommunityFeed` |
| **Friends List** | `/friends` | `Friends.tsx` | `useFriendships` |
| **Friend Leaderboard** | `/friend-leaderboard` | `Leaderboard.tsx` | `useLeaderboardRank` |
| **Order History** | `/orders` | `Orders.tsx` | `useOrderHistory` |
| **Order Detail** | `/order/:id` | `OrderDetail.tsx` | `useOrderStatus` |
| **Delivery Tracking** | `/tracking` | `DeliveryTracking.tsx` | `useLiveTracking` |
| **Subscription** | `/subscription` | `Subscription.tsx` | `useSubscriptionPlan` |
| **Plan Catalog** | `/subscription/plans` | `PlanCatalog.tsx` | `usePlanPricing` |
| **Wallet** | `/wallet` | `Wallet.tsx` | `useWalletBalance` |
| **Checkout** | `/checkout` | `Checkout.tsx` | `useCheckoutFlow` |
| **Invoice History** | `/invoices` | `Invoices.tsx` | `useInvoiceData` |
| **Coaches Directory** | `/coaches` | `Coaches.tsx` | `useCoachDirectory` |
| **Coach Onboarding** | `/coach-onboarding` | `CoachOnboarding.tsx` | `useClientOnboarding` |
| **Coach Subscription** | `/coach-subscription` | `CoachSubscription.tsx` | `useSADADPayment` |
| **Coach Programs** | `/coach-programs` | `CoachPrograms.tsx` | `useCoachPrograms` |
| **Guided Workouts** | `/coach-programs/workout/...` | `WorkoutSession.tsx` | `useWorkoutLog` |
| **Coach Schedule** | `/coach-schedule` | `CoachSchedule.tsx` | `useCoachSessions` |
| **Coach Messages** | `/coach-messages` | `CoachMessages.tsx` | `useChatHistory` |
| **Workout History** | `/workout-history` | `WorkoutHistory.tsx` | `useExerciseLog` |
| **Become a Coach** | `/become-coach` | `BecomeCoach.tsx` | `useCoachApplication` |
| **AI Health Report** | `/ai-report` | `AIReport.tsx` | `useAIReportGenerator` |
| **Medications** | `/medications` | `Medications.tsx` | `useMedChecks` |
| **Affiliate Portal** | `/affiliate` | `Affiliate.tsx` | `useAffiliateEarnings` |
| **Referral Tracking** | `/affiliate/tracking` | `ReferralTracking.tsx` | `useReferralStats` |
| **Favorites** | `/favorites` | `Favorites.tsx` | `useFavorites` |
| **Addresses** | `/addresses` | `Addresses.tsx` | `useAddressBook` |
| **Support Portal** | `/support` | `Support.tsx` | `useSupportTickets` |
| **Notifications** | `/notifications` | `Notifications.tsx` | `useNotificationFeed` |
| **Settings** | `/settings` | `Settings.tsx` | `useAppPreferences` |
| **Personal Info** | `/personal-info` | `PersonalInfo.tsx` | `useAccountData` |
| **Dietary Prefs** | `/dietary` | `DietaryPreferences.tsx` | `useDietaryTags` |
| **Policies & Legal** | `/policies` | `Policies.tsx` | `useLegalDocs` |
| **Log Activity** | `/log-activity` | `LogActivity.tsx` | `useActivityLog` |
| **Recipes** | `/recipes` | `Recipes.tsx` | `useUserRecipes` |
| **Marketplace** | `/marketplace` | `Marketplace.tsx` | `useStoreInventory` |
| **Recovery Partners** | `/recovery` | `RecoveryPartners.tsx` | `usePartnerBooking` |

---

## 2. Functional Component Mapping

### 🛠️ Critical Modals & Sheets
- **`LogMealModal`**: Unified entry point for Manual, Barcode, and AI Photo logging.
- **`ModifyOrderModal`**: used across Dashboard, Schedule, and Tracking to edit pending orders.
- **`RewardUnlockSheet`**: Triggered via XP balance updates to celebrate achievements.
- **`SADADPaymentModal`**: Handles the secure bridge to the external payment gateway.

### 🛠️ Specialized Intelligence Components
- **`NutritionRingDial`**: Animated SVG visualization of macros vs. goals.
- **`GoalAlignmentScore`**: A computed value in MealDetail based on current lapped macros.
- **`SmartRecommendationsWidget`**: AI-driven meal suggestions surface.
- **`LiveMapComponent`**: Integrated real-time delivery tracking.

---

## 3. Data Integrity Constraints
- **Route Protection**: `/subscription` and `/coach-programs` are guarded by a `SubscriptionGate` component.
- **SADAD Verification**: Wallet top-ups are not committed until the `payment_callback` edge function returns a success status.
- **Medication Check**: The `useMealMedicineCheck` hook is called before a meal is confirmed in the schedule to prevent interactions.



---

# File: C:\Users\khamis\Documents\nutrio\docs\user-manual\01-onboarding.md

# 🛠️ Getting Started: Your Journey to Wellness

Welcome to Nutrio. This guide will walk you through the initial setup of your portal, ensuring your nutrition goals are precision-tuned to your biology and lifestyle.

---

## 1. Account & Personalization
Your journey begins by establishing your baseline. The portal uses this data to calculate your BMR (Basal Metabolic Rate) and TDEE (Total Daily Energy Expenditure).

### 👤 Personal Information (`/personal-info`)
Ensure your profile is accurate to get the most precise AI recommendations.
- **Core Details**: Update your name, email, and phone number via the Profile Settings.
- **Biometrics**: Set your gender and date of birth.
- **Customization**: Toggle between **Metric** (kg/cm) or **Imperial** (lbs/in) unit preferences based on your comfort.

### 🥗 Dietary Preferences & Allergens (`/dietary`)
Nutrio filters the meal browser and AI recommendations based on these settings.
- **Dietary Tags**: Select your preferred eating pattern (e.g., *High-Protein, Low-Carb, Keto, Vegan, Vegetarian*).
- **Allergen Alerts**: Mark critical allergens (e.g., *Gluten-Free, Dairy-Free, Nut-Free*) to ensure the system flags any incompatible ingredients in the Meal Detail view.
- **Save & Sync**: Once saved, these preferences act as a global filter for the Meal Browser and Smart Recommendations.

---

## 2. The Nutrition Goal Wizard (`/nutrition-goals`)
Instead of guessing your needs, Nutrio uses a guided wizard to build your daily targets.

### 🎯 Setting Your Objective
Choose your primary health driver:
- **Lose Weight**: Prioritizes a caloric deficit with high protein retention.
- **Maintain**: Balances calories for stable weight and energy.
- **Gain Muscle**: Focuses on a caloric surplus and high protein targets.
- **Custom**: Set your own precision targets.

### 📊 The Calibration Process
The wizard will guide you through:
1. **Current Metrics**: Input your current weight, height, age, and gender.
2. **Activity Level**: Select your lifestyle intensity (from Sedentary to Professional Athlete).
3. **Target Setting**: The system proposes initial targets for **Calories, Protein, Carbs, and Fats**.

`💡 Pro Tip: You can always manually adjust these targets in the /edit-goal screen if your coach suggests a change or your progress plateaus.`

### 🤖 Smart Goal Adjustments
Nutrio doesn't stay static. As you log weight and activity, the AI will trigger **Smart Goal Adjustment Notifications**, suggesting a target shift based on your actual metabolic response.

---

## 3. First-Time Experience Checklist
Before diving into the dashboard, ensure you have completed these steps:
- [ ] Upload your profile avatar.
- [ ] Complete the Dietary Preferences tags.
- [ ] Finish the Goal Setup Wizard.
- [ ] Connect your Health Apps (Apple Health / Google Fit) in Settings.

`⚠️ Note: Certain advanced features in the Health Dashboard may be locked until your first set of body metrics is logged.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\user-manual\02-dashboard.md

# 🚀 The Command Center: Mastering Your Dashboard

Your Dashboard is the heart of the Nutrio experience. It provides a real-time snapshot of your biological status and a direct gateway to every essential tool in the portal.

---

## 1. The Daily Nutrition Snapshot (`/dashboard`)
At a glance, you can track your adherence to the daily goals set in your Nutrition Wizard.

### ⭕ The Nutrition Ring Meters
Located at the top of your view, these animated rings track your progress toward your daily targets:
- **Calories**: Total energy intake vs. goal.
- **Protein**: Muscle recovery and satiety tracking.
- **Carbs**: Energy levels and glycogen fueling.
- **Fats**: Hormonal health and essential fatty acids.

### 📈 Performance Widgets
Beyond the rings, the dashboard provides deep insights into your day:
- **Weekly Adherence Chart**: A bar chart showing your meal completion rate by day.
- **Macro Distribution**: A pie/bar breakdown showing the ratio of your intake.
- **Weight Progress**: A trend line comparing your current weight against your long-term goal.
- **Body Correlation Widget**: A specialized view that plots your weigh-ins against your nutrition trends to see how diet affects weight.

---

## 2. Immediate Action Tools
The Dashboard is designed for minimal friction. You can log data without ever leaving the main screen.

### 🍽️ Meal Logging (LogMealModal)
Log your food using three distinct methods depending on your environment:
1. **Manual Entry**: Search the database for specific foods or meals.
2. **Barcode Scanning**: Use your camera to scan packaged foods for instant nutrition data.
3. **AI Photo Logging**: Snap a photo of your plate; Nutrio's AI analyzes the image and suggests the food items and portions.

### 💧 Water & 👟 Activity
- **Water Intake**: Use the quick-log buttons to add glasses of water and track your daily hydration goal.
- **Step Counter**: Enter your steps manually or view the auto-synced data from **Google Fit** or **HealthKit**.

---

## 3. Quick Access & Navigation
The **Quick Actions** row provides one-tap shortcuts to:
- **Schedule**: Manage your upcoming meal deliveries.
- **Meals**: Browse and discover new dishes.
- **Tracker**: View detailed BMI and metric logs.
- **Community**: Engage with challenges and other users.
- **Rewards**: Check your XP and redeem prizes.

---

## 4. Advanced Dashboard Intelligence
Nutrio uses AI to proactively manage your health:

### 🧬 Recovery & Readiness
The **Recovery Readiness** widget analyzes your body load and activity to provide:
- **Readiness Score**: A 0-100 value indicating if today is a day for high intensity or active recovery.
- **Body Load Score**: Your accumulated physical stress.
- **Daily Food Tip**: A nutrition suggestion tailored to your current recovery state (e.g., *"Increase protein today for muscle repair"*).

### 🔔 Alerts & Engagement
- **Notification Badge**: Keeps you updated on order status, coach messages, and health insights.
- **Reward Unlock Sheet**: A celebratory overlay that appears the moment you earn a new achievement or reach an XP milestone.
- **Subscription Nudge**: A subtle banner alerting you if you are nearing your plan limits or if your subscription is expiring.

`💡 Pro Tip: Need to change a meal for tomorrow? Use the "Modify Order" shortcut directly from the dashboard to swap a dish without navigating through the full schedule.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\user-manual\03-daily-metrics.md

# 📈 Precision Tracking: Weight, Water, and Activity

Consistent tracking is the foundation of metabolic success. Nutrio provides three dedicated modules to monitor your daily habits with high precision.

---

## 1. The Water Tracker (`/water-tracker`)
Hydration affects every metabolic process in your body. Nutrio makes logging fluid intake effortless.

### 💧 Daily Logging
- **Preset Amounts**: Quickly log common amounts (100ml to 600ml) with a single tap.
- **Custom Entry**: Need a specific amount? Use the custom ml entry for exact logs.
- **Visual Progress**: Watch your daily goal fill up via the **glass fill animation** as you log.

### 📅 Analytics & History
- **Monthly View**: Use the calendar to see your hydration consistency across the month.
- **Day Detail Sheet**: Drill down into a specific day to view the exact time and amount of each water entry.
- **Editing**: Correct mistakes by selecting an entry in the detail sheet to edit or delete.
- **Weekly Trends**: Analyze your average daily totals to identify hydration gaps.

---

## 2. The Step Counter (`/step-counter`)
Activity tracking ensures your TDEE calculations remain accurate.

### 👟 Logging Your Movement
- **Manual Entry**: Quickly add steps using presets (500, 1000, 2000, 5000) for those times you aren't wearing a tracker.
- **Auto-Sync**: Connect **Google Fit** (Android) or **HealthKit** (iOS) in Settings for automatic, real-time step synchronization.
- **Calorie Estimation**: Nutrio translates your steps into calorie burn based on your current weight and **MET (Metabolic Equivalent of Task)** values.

### 🎯 Goal Management
- **Custom Goals**: Set your daily target between **3K and 15K steps**.
- **History Calendar**: View your total steps per day in a month-view calendar.
- **Workout Detection**: The system automatically identifies high-intensity activities via synced health apps.

---

## 3. Weight Tracking & Body Metrics (`/weight-tracking`, `/body-metrics`)
Weight is a key indicator, but body composition is where the real progress is measured.

### ⚖️ Weight Logging
- **Daily Entry**: Log your weight in kg via the quick-entry dialog.
- **Trend Analysis**: The system displays **Trend Arrows** (up/down) next to your entries to indicate immediate weight movement.
- **Goal Comparison**: View your current weight relative to your target goal on the trend line.
- **Weekly Calendar**: Monitor your weigh-in consistency.

### 📏 Advanced Body Metrics (`/body-metrics`)
For athletes and those focused on muscle gain, weight isn't enough. Log the following measurements:
- **Core Metrics**: Waist, Hips, Chest, Arms, and Thighs.
- **Body Fat %**: Track your lean mass vs. fat mass.
- **Progress Table**: Compare these measurements over time in the history table to see where you are leaning out or building muscle.

---

## 4. The All-in-One Tracker (`/tracker`)
If you need a fast summary of your physical state, head to the Tracker.

- **Daily Snapshot**: A single screen showing your Total Calories, Protein, Carbs, Fat, Water, and Steps.
- **BMI Visualization**: The system automatically calculates your BMI based on your height and weight logs, displaying it with a **status label** and a **visual range bar**.
- **Metric Management**: Quickly update your height to ensure BMI calculations remain accurate.
- **Insights Tab**: Access AI-driven patterns that correlate your activity levels with your weight trends.

`💡 Pro Tip: For the best results, weigh yourself first thing in the morning (fasted) and log it immediately. This removes the "noise" of food and water weight from your trends.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\user-manual\04-meal-workflow.md

# 🍱 Precision Meal Management: From Discovery to Delivery

The Nutrio meal system is designed to bridge the gap between nutrition goals and actual eating habits. This guide covers how to find, customize, and schedule your meals for the week.

---

## 1. Meal Discovery & Exploration (`/meals`)
Finding the right meal is the first step toward hitting your macro targets.

### 🔍 Browsing & Searching
- **Categorized Discovery**: Browse meals by type—*Breakfast, Lunch, Dinner, or Snacks*—to plan your day.
- **Smart Meal Picks**: The AI surface recommendations based on your current nutrition gaps and flavor preferences.
- **Advanced Filters**: Use cuisine type and dietary tags (e.g., *Keto, Vegan*) to narrow down the list.
- **Search**: Use the global search bar to find specific ingredients or meal names.

### 🏪 Restaurant Experience (`/restaurant/:id`)
Nutrio partners with premium health-focused restaurants.
- **Restaurant Profiles**: View ratings, operating hours, and cuisine specialties.
- **Menu Navigation**: Explore categorized lists of meals with basic nutrition summaries.
- **Favorites**: Toggle the heart icon to save a restaurant for quicker access in the future.
- **Sharing**: Use the share sheet to send a restaurant recommendation to a friend.

---

## 2. The Meal Detail Deep-Dive (`/meals/:id`)
Before adding a meal to your schedule, analyze if it fits your biological needs for the day.

### 📊 Nutrition & Goal Alignment
- **Full Breakdown**: View precisely how many calories, proteins, carbs, fats, and fibers are in the dish.
- **Goal Alignment Score**: Nutrio calculates how well this specific meal fits into your remaining daily targets.
- **Ingredient Transparency**: View the full ingredient list with **allergen highlights** to ensure safety.

### 🛠️ Customization
- **Portion Selector**: Choose between *Regular* or *Large* portions, or select the *High-Protein variant* if you are in a muscle-gain phase.
- **Add-ons**: Browse and add supplements or sides to increase the nutritional value of the meal.

### ⚡ Quick Actions
- **Schedule Meal**: Add the meal directly to your delivery calendar.
- **Favorites**: Save the meal to your favorites grid for one-tap access later.
- **Buy Credits**: If your wallet balance is too low, the system provides a direct link to top up your credits.

`⚠️ Health Warning: Certain meals may trigger a "Meal Interaction Banner" if they conflict with medications you have logged in your profile.`

---

## 3. The Weekly Schedule (`/schedule`)
The Schedule is where your nutrition plan becomes reality.

### 📅 Navigating Your Week
- **7-Day Grid**: A scrollable view of your entire week, divided by meal type (Breakfast $\rightarrow$ Lunch $\rightarrow$ Dinner $\rightarrow$ Snack).
- **Completion Toggle**: Mark a meal as "completed" once you've eaten it to update your daily nutrition rings.
- **Empty Slots**: See where gaps exist in your week and tap the placeholder to add a meal.

### 🤖 AI-Powered Planning
- **Meal Plan Generator**: Instead of picking meals one-by-one, use the AI to generate a full weekly plan that perfectly hits your macro targets.
- **Fill My Week / Auto-fill**: Use the one-tap FAB (Floating Action Button) to automatically populate all empty slots with highly-recommended meals.
- **Smart Substitution**: The system suggests replacement meals if a chosen item becomes unavailable or if your goals change.

### 🚚 Delivery & Modification
- **Delivery Scheduler**: Set your preferred delivery windows for the week.
- **Modify Order**: Change, replace, or remove scheduled meals before the cutoff time.
- **Quick View**: Use the Meal Detail Sheet to check nutrition info without leaving the calendar view.

`💡 Pro Tip: Use the "Coach Meal Suggestions" feature if you are assigned to a professional coach—they can push specific meal recommendations directly into your schedule.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\user-manual\05-health-suite.md

# 🩺 The AI Health Suite: From Blood Work to Recovery

Nutrio goes beyond simple calorie counting. The Health Suite integrates clinical data, AI-driven analysis, and recovery metrics to provide a 360-degree view of your biological health.

---

## 1. Blood Work Analysis (`/health/blood-work`)
Stop guessing what your markers mean. Nutrio converts complex lab reports into actionable insights.

### 📤 Uploading Lab Reports
- **Automated Analysis**: Upload your lab report as a **PDF or Image**. Our AI analyzes the document, extracts key markers, and categorizes them automatically.
- **Manual Entry**: If you prefer, you can search for and manually input specific markers.
- **Metadata**: Track the lab name, test date, and whether you were in a fasting state to ensure data accuracy.

### 🔬 Understanding Your Results (`/health/blood-work/results`)
- **Categorized View**: Markers are grouped by biological system (e.g., *Metabolic, Lipid, Liver, Kidney, Thyroid*).
- **Status Indicators**: Each marker shows its value, the reference range, and a status (e.g., Optimal, High, Low).
- **Mini Trend Charts**: View how specific markers have changed over time to track the impact of your diet.
- **AI Insight Reports**: For every record, the AI generates a detailed report explaining what the results mean and recommending changes to your nutrition.

---

## 2. Comprehensive AI Reports (`/ai-report`)
Once a week, Nutrio synthesizes all your data into a high-level executive summary of your health.

### 📊 Report Components
- **Meal Quality Score**: An AI evaluation of your food choices based on nutrient density and goal alignment.
- **Consistency Rating**: A measure of how well you adhered to your targets across the week.
- **Recovery Analysis**: A deep dive into how your sleep, activity, and nutrition are affecting your recovery.
- **Nutrition Balance**: Analysis of your macro distribution over 7 days.

### 📋 Actionable Recommendations
The report doesn't just show data; it tells you what to do. It provides **Smart Recommendations** (e.g., *"Your iron levels are trending low; consider adding more spinach or red meat to your next 3 meal schedules"*).

`📄 Export: You can download your Weekly AI Report as a professional PDF to share with your doctor or coach.`

---

## 3. Recovery & Readiness (`/recovery-insights`)
Physical performance is a balance of stress and recovery. Nutrio tracks this equilibrium in real-time.

### ⚡ Key Recovery Metrics
- **Readiness Score (0-100)**: A composite score indicating if your body is primed for a high-intensity workout or needs a rest day.
- **Body Load Score**: Tracks the cumulative physical stress from your workouts and activity logs.
- **Health Baseline**: Your rolling 14-day average of key health metrics, used to detect anomalies in your recovery.

### 🛠️ The Recovery Plan
Based on your readiness, the portal provides a **Recovery Plan Key** and a **Daily Food Tip**.
- *Example*: If your readiness is low, the system might suggest: *"Focus on anti-inflammatory foods today; increase Omega-3 intake."*

---

## 4. Managing Your Health Ecosystem (`/health/dashboard`)
The Health Dashboard is your central hub for all medical and biological data.

- **Health Score**: A single, composite score derived from your blood work, weight, and activity levels.
- **Provider Status**: Monitor your connection to **Apple Health** and **Google Fit** to ensure data is syncing correctly.
- **Trend Overlays**: View your meal logging trends side-by-side with your blood work improvements.

`💡 Pro Tip: Regularly upload your blood work every 3-6 months. This allows the AI to calibrate your nutrition goals based on actual biological markers rather than general averages.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\user-manual\06-coaching.md

# 🎓 Professional Coaching: Guided Transformation

Nutrio provides an integrated layer of professional human guidance to complement the AI. Whether you need a nutritionist for meal planning or a trainer for workouts, the Coaching Suite manages the entire relationship.

---

## 1. Finding and Connecting with a Coach (`/coaches`)
Your transformation is more effective with professional oversight.

### 🔍 The Coaches Directory
- **Coach Profiles**: Browse verified experts with detailed bios, specialties (e.g., *Keto Expert, Bodybuilding, Weight Loss*), and ratings.
- **Availability**: Check real-time availability and client counts before reaching out.
- **Connection**: Use the "Connect" feature to initiate messaging or book a discovery session.

### 📝 Onboarding for Coaching (`/coach-onboarding`)
Once you connect with a coach, you'll go through a specialized onboarding process to align goals:
- **Health Goal Selection**: Define exactly what you want to achieve with your coach.
- **Current Metrics**: Share your current/target weight and activity levels.
- **Medical Context**: Disclose dietary preferences, allergies, or medical conditions for safe planning.

---

## 2. Coach-Led Programs & Workouts (`/coach-programs`)
Coaches don't just give advice; they provide structured, day-by-day blueprints.

### 📅 Program Execution
- **Day-by-Day View**: Follow a precise schedule of meals and exercises assigned by your coach.
- **Meal Replacements**: If a suggested meal doesn't fit your taste, you can swap it while remaining within the coach's macro guidelines.
- **Progress Tracking**: Mark lapped programs and tracks calorie targets in real-time.

### 🏋️ Guided Workouts (`/coach-programs/workout/...`)
Transform your physical laounds with precision training:
- **Exercise List**: A structured list of the day's workout, including sets, reps, and movements.
- **Set Tracking**: Log the weight lifted and reps completed for every set.
- **Integrated Timer**: Use the built-in rest timer to keep your intensity levels optimal.
- **PR Tracking**: The system automatically identifies and logs Personal Records (PRs) during your sessions.

---

## 3. Session & Communication Management

### 💬 Direct Messaging (`/coach-messages`)
Maintain a constant line of communication with your coach via the integrated chat:
- **Message History**: Keep a searchable record of all guidance and feedback.
- **Media Attachments**: Send photos of your meals or workout form for coach review.

### 📅 Booking & Scheduling (`/coach-schedule`)
Manage your 1-on-1 time with your coach efficiently:
- **Session Types**: Book different formats, including *Video Calls, Phone Calls, In-Person visits, or textual Check-ins*.
- **Booking Request**: Request a session time and receive confirmation within the app.
- **Management**: Reschedule or cancel appointments directly from your session list.

### 📈 Workout History (`/workout-history`)
Audit your physical growth over time:
- **Session Summaries**: View all past workout completions.
- **Detailed Logs**: Expand any session to see the lapped weight and reps for every exercise.
- **Best Lifts**: A dedicated view of your all-time personal records.

---

## 4. For Professionals: Becoming a Coach (`/become-coach`)
If you are a certified professional, you can apply to join the Nutrio ecosystem.
- **Application Flow**: Submit your credentials and specialty experience through the Coach Application form.

`💡 Pro Tip: If your coach assigns a "Program," check your /schedule. They often sync their meal suggestions directly into your delivery calendar for seamless execution.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\user-manual\07-social-gamma.md

# 🏆 Community, Socials & Rewards: The Gamification of Health

Nutrio isn't just a tool; it's a social ecosystem. We use experience points (XP), leaderboard competition, and community challenges to keep you motivated on your journey.

---

## 1. The Rewards System (`/rewards`)
Your consistency is rewarded with tangible value. Every action—from logging a meal to completing a workout—earns you experience points.

### 🌟 XP & Leveling
- **XP Balance**: Track your total experience points on the rewards home screen.
- **Level Progress**: Your XP determines your current level. Watch the progress bar to see how close you are to the next rank.
- **XP History**: A transparent transaction log showing exactly how you earned your points (e.g., *"Log 7-day streak +500 XP"*).

### 🎁 The Reward Catalog
Exchange your hard-earned XP for real-world benefits in the curated catalog:
- **Wallet Credits**: Convert XP into spending power for your next order.
- **Exclusive Discounts**: Unlock percentage-based discounts on specific plans.
- **Free Perks**: Redeem XP for free snacks or free delivery on upcoming orders.
- **Reward Unlock Sheet**: A celebratory overlay that triggers the moment you earn a new achievement or unlock a reward.

---

## 2. Community Engagement (`/community`)
Connect with thousands of other health-seekers in the Nutrio Experience Hub.

### 🎡 The Experience Hub
- **Social Feed**: A vibrant center for engagement, sharing results, and discovering new health trends.
- **Active Challenges**: Join community-driven challenges (e.g., *"30-Day Protein Push"*) to earn bonus XP and badges.
- **Popular Combos**: See the most frequently ordered meal combinations from the community to spark new ideas for your schedule.
- **Referral Milestones**: Track your progress toward referral bonuses via the progress widget.

### 🤝 The Coach Connection
If you aren't already paired, the community hub provides **Coach Invite Cards** to help you quickly find and connect with a professional.

---

## 3. Friends & Competition (`/friends`, `/friend-leaderboard`)
Healthy competition is the fastest way to stay disciplined.

### 👥 Managing Your Circle (`/friends`)
- **Friend Discovery**: Send friend requests to other users by searching for their username.
- **Request Management**: Accept or reject incoming requests from your friends list.
- **Social Indicators**: Your friends list features **XP Flame Indicators**, showing who is currently on a hot streak.

### 🥇 The Leaderboard (`/friend-leaderboard`)
Compare your progress against the best:
- **Friend Ranking**: A private leaderboard showing where you stand among your direct friends.
- **Global Ranking**: Compete on the world stage and see where you rank against every Nutrio user.
- **Time Filters**: Toggle between **Weekly**, **Monthly**, or **All-Time** views to see who is dominating the current period.

`💡 Pro Tip: The fastest way to climb the leaderboard is through "Streak Bonuses." Consistently meeting your nutrition goals for 7 consecutive days provides a massive XP multiplier.`



---

# File: C:\Users\khamis\Documents\nutrio\docs\user-manual\08-account-logistics.md

# 💳 Account, Logistics & Support: Managing Your Experience

The logistics layer of Nutrio ensures that your nutrition plan is supported by a seamless payment, subscription, and support system.

---

## 1. Wallet & Payments (`/wallet`)
The Nutrio Wallet allows you to maintain a balance for flexible meal purchasing and subscription management.

### 💰 Balance Management
- **Real-time Balance**: Your current available credit is displayed prominently on the wallet home screen.
- **Top-up Packages**: Choose from preset top-up amounts to quickly add funds to your account.
- **Transaction History**: A detailed log of all wallet activities, including credits added and meals purchased.

### 💳 Payment Integration (SADAD)
Nutrio utilizes the **SADAD payment flow** for secure and reliable transactions:
- **Top-up Flow**: Select your package and follow the SADAD integration steps.
- **Payment Callback**: The system automatically handles success and failure callbacks to ensure your balance is updated instantly after a successful transaction.

---

## 2. Subscription & Plan Management (`/subscription`)
Your subscription defines your meal quotas and access levels.

### 📋 Plan Overview
- **Current Plan Info**: View your tier (e.g., *Standard, VIP*), remaining meal credits, and billing cycle details.
- **Plan Comparison (`/subscription/plans`)**: Compare all available tiers (Basic, Standard, Premium, VIP, etc.) side-by-side via a feature comparison table.
- **Billing Intervals**: Toggle between **Monthly** and **Annual** billing to optimize your cost.

### ⚙️ Plan Control
- **Upgrade/Downgrade**: Use the plan picker to change your tier mid-cycle.
- **Freeze Subscription**: Need a break? Pause your delivery and subscription without losing your progress.
- **Rollover Credits**: Unused meal credits from the previous month are displayed and applied to your current balance.

`⚠️ Subscription Gate: Access to certain high-tier features (like AI Reports or specialized Coaching) will be restricted if your subscription has expired. An "Expiry Banner" will appear as a final warning.`

---

## 3. Order & Delivery Logistics (`/orders`, `/tracking`)
Turning your schedule into delivered meals.

### 🚚 Order Management
- **Order History**: A complete record of all past and upcoming orders, filterable by status (*Pending, Confirmed, Preparing, Ready, Delivered, Cancelled*).
- **Modify Order**: Change, replace, or remove meals from an upcoming order before the kitchen cutoff.
- **One-Tap Reorder**: Found a perfect meal combination? Reorder your entire past order with a single click.

### 📍 Real-time Tracking (`/tracking`)
- **Status Timeline**: A step-by-step visual tracker showing the progress of your order from preparation to delivery.
- **LiveMap Link**: Access a real-time map to see your delivery's current position.
- **ETA**: View the estimated time of arrival for your meals.

---

## 4. Administration & Support (`/addresses`, `/support`, `/settings`)

### 🏠 Address Book (`/addresses`)
Manage where your nutrition arrives:
- **Multiple Addresses**: Save several locations (Home, Office, Gym).
- **Default Setting**: Mark your primary delivery spot for faster checkout.

### 🎧 Support Center (`/support`)
If something goes wrong, the support suite is your direct line to help:
- **Ticket System**: Create a support ticket with a specific category, priority, and description.
- **Attachments**: Upload screenshots or PDFs to help the admin team resolve your issue faster.
- **Threaded Communication**: Follow the conversation with Nutrio support in a clean message thread.

### ⚙️ Global Settings (`/settings`)
- **Notification Control**: Granular toggles for push, email, and meal reminders.
- **Quiet Hours**: Set specific times when the app will not send you notifications.
- **Theme Toggle**: Switch between **Dark** and **Light** modes for visual comfort.
- **Health App Integration**: Connect/Disconnect your Apple Health or Google Fit accounts.

`💡 Pro Tip: Use the /personal-info page to update your units to Metric (kg) or Imperial (lbs) to ensure your Weight Tracking and BMI calculations are accurate.`


