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
