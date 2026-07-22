import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Meals = lazy(() => import("@/pages/Meals"));
const RestaurantDetail = lazy(() => import("@/pages/RestaurantDetail"));
const MealDetail = lazy(() => import("@/pages/MealDetail"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const BodyProgressDashboard = lazy(() => import("@/pages/progress/BodyProgressDashboard"));
const Tracker = lazy(() => import("@/pages/Tracker"));
const WaterTracker = lazy(() => import("@/pages/WaterTracker"));
const StepCounter = lazy(() => import("@/pages/StepCounter"));
const WeightTracking = lazy(() => import("@/pages/WeightTracking"));
const BloodWorkUpload = lazy(() => import("@/pages/health/BloodWorkUpload"));
const BloodWorkResults = lazy(() => import("@/pages/health/BloodWorkResults"));
const HealthDashboard = lazy(() => import("@/pages/health/HealthDashboard"));
const MealResponse = lazy(() => import("@/pages/health/MealResponse"));
const RecoveryInsights = lazy(() => import("@/pages/RecoveryInsights"));
const Profile = lazy(() => import("@/pages/Profile"));
const Rewards = lazy(() => import("@/pages/Rewards"));
const Dietary = lazy(() => import("@/pages/Dietary"));
const Policies = lazy(() => import("@/pages/Policies"));
const PersonalInfo = lazy(() => import("@/pages/PersonalInfo"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const SubscriptionPlans = lazy(() => import("@/pages/subscription/SubscriptionPlans"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Favorites = lazy(() => import("@/pages/Favorites"));
const Settings = lazy(() => import("@/pages/Settings"));
const NutritionGoals = lazy(() => import("@/pages/NutritionGoals"));
const Affiliate = lazy(() => import("@/pages/Affiliate"));
const ReferralTracking = lazy(() => import("@/pages/ReferralTracking"));
const Addresses = lazy(() => import("@/pages/Addresses"));
const Support = lazy(() => import("@/pages/Support"));
const Wallet = lazy(() => import("@/pages/Wallet"));
const InvoiceHistory = lazy(() => import("@/pages/InvoiceHistory"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const PaymentResult = lazy(() => import("@/pages/PaymentResult"));
const OrderHistory = lazy(() => import("@/pages/OrderHistory"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const DeliveryTracking = lazy(() => import("@/pages/DeliveryTracking"));
const RecoveryPartners = lazy(() => import("@/pages/recovery/RecoveryPartners"));
const RecoveryDetail = lazy(() => import("@/pages/recovery/RecoveryDetail"));
const MyBookings = lazy(() => import("@/pages/recovery/MyBookings"));
const SportHubPartner = lazy(() => import("@/pages/partners/SportHubPartner"));
const Community = lazy(() => import("@/pages/Community"));
const LogActivity = lazy(() => import("@/pages/LogActivity"));
const OutdoorActivity = lazy(() => import("@/pages/OutdoorActivity"));
const BodyMetrics = lazy(() => import("@/pages/BodyMetrics"));
const CoachesDirectory = lazy(() => import("@/pages/CoachesDirectory"));
const Recipes = lazy(() => import("@/pages/Recipes"));
const RecipeNew = lazy(() => import("@/pages/RecipeNew"));
const RecipeDetail = lazy(() => import("@/pages/RecipeDetail"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const ApplyCoach = lazy(() => import("@/pages/coach/ApplyCoach"));
const CoachMessages = lazy(() => import("@/pages/CoachMessages"));
const CoachOnboarding = lazy(() => import("@/pages/nutrio/CoachOnboarding"));
const CoachSubscription = lazy(() => import("@/pages/nutrio/CoachSubscription"));
const CoachPrograms = lazy(() => import("@/pages/nutrio/CoachPrograms"));
const GuidedWorkout = lazy(() => import("@/pages/nutrio/GuidedWorkout"));
const ClientCoachSchedule = lazy(() => import("@/pages/nutrio/CoachSchedule"));
const WorkoutHistory = lazy(() => import("@/pages/nutrio/WorkoutHistory"));
const Friends = lazy(() => import("@/pages/Friends"));
const FriendLeaderboard = lazy(() => import("@/pages/FriendLeaderboard"));
const AIReport = lazy(() => import("@/pages/AIReport"));
const AiCoach = lazy(() => import("@/pages/AiCoach"));
const WeeklyAICheckIn = lazy(() => import("@/pages/WeeklyAICheckIn"));
const Medications = lazy(() => import("@/pages/Medications"));
const HealthPrograms = lazy(() => import("@/pages/programs/HealthPrograms"));
  const HealthProgramDetail = lazy(() => import("@/pages/programs/HealthProgramDetail"));
  const MyHealthProgram = lazy(() => import("@/pages/programs/MyHealthProgram"));
  const HealthProgramOnboarding = lazy(() => import("@/pages/programs/HealthProgramOnboarding"));
  const HealthProgramMeals = lazy(() => import("@/pages/programs/HealthProgramMeals"));
const SmartMealRecommendations = lazy(
  () => import("@/pages/recommendations/SmartMealRecommendations"),
);

export const customerRoutes = (
  <>
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/nutrition"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/activity"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/progress"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route path="/meals" element={<ProtectedRoute><Meals /></ProtectedRoute>} />
    <Route path="/restaurant/:id" element={<ProtectedRoute><RestaurantDetail /></ProtectedRoute>} />
    <Route path="/meals/:id" element={<ProtectedRoute><MealDetail /></ProtectedRoute>} />
    <Route
      path="/schedule"
      element={
        <ProtectedRoute>
          <Schedule />
        </ProtectedRoute>
      }
    />
    <Route
      path="/schedule/fill-my-week"
      element={
        <ProtectedRoute>
          <Schedule />
        </ProtectedRoute>
      }
    />
    <Route
      path="/progress"
      element={
        <ProtectedRoute>
          <Navigate to="/dashboard/progress" replace />
        </ProtectedRoute>
      }
    />
    <Route
      path="/body-progress"
      element={
        <ProtectedRoute>
          <BodyProgressDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tracker"
      element={
        <ProtectedRoute>
          <Tracker />
        </ProtectedRoute>
      }
    />
    <Route
      path="/water-tracker"
      element={
        <ProtectedRoute>
          <WaterTracker />
        </ProtectedRoute>
      }
    />
    <Route
      path="/step-counter"
      element={
        <ProtectedRoute>
          <StepCounter />
        </ProtectedRoute>
      }
    />
    <Route
      path="/weight-tracking"
      element={
        <ProtectedRoute>
          <WeightTracking />
        </ProtectedRoute>
      }
    />
    <Route
      path="/health/dashboard"
      element={
        <ProtectedRoute>
          <HealthDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/health/blood-work"
      element={
        <ProtectedRoute>
          <BloodWorkUpload />
        </ProtectedRoute>
      }
    />
    <Route
      path="/health/blood-work/results"
      element={
        <ProtectedRoute>
          <BloodWorkResults />
        </ProtectedRoute>
      }
    />
    <Route
      path="/goals"
      element={<Navigate to="/nutrition-goals" replace />}
    />
    <Route
      path="/nutrition-goals"
      element={
        <ProtectedRoute>
          <NutritionGoals />
        </ProtectedRoute>
      }
    />
    <Route
      path="/edit-goal"
      element={
        <ProtectedRoute>
          <NutritionGoals />
        </ProtectedRoute>
      }
    />
    <Route
      path="/body-metrics"
      element={
        <ProtectedRoute>
          <BodyMetrics />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dietary"
      element={
        <ProtectedRoute>
          <Dietary />
        </ProtectedRoute>
      }
    />
    <Route
      path="/policies"
      element={
        <ProtectedRoute>
          <Policies />
        </ProtectedRoute>
      }
    />
    <Route
      path="/personal-info"
      element={
        <ProtectedRoute>
          <PersonalInfo />
        </ProtectedRoute>
      }
    />
    <Route
      path="/profile"
      element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      }
    />
    <Route
      path="/recovery-insights"
      element={
        <ProtectedRoute>
          <RecoveryInsights />
        </ProtectedRoute>
      }
    />
    <Route
      path="/rewards"
      element={
        <ProtectedRoute>
          <Rewards />
        </ProtectedRoute>
      }
    />
    <Route path="/orders" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
    <Route path="/order/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
    <Route path="/tracking" element={<ProtectedRoute><DeliveryTracking /></ProtectedRoute>} />
    <Route path="/plans" element={<Navigate to="/subscription/plans" replace />} />
    <Route path="/subscribe" element={<Navigate to="/subscription" replace />} />
    <Route path="/cart" element={<Navigate to="/meals" replace />} />
    <Route
      path="/subscription"
      element={
        <ProtectedRoute>
          <Subscription />
        </ProtectedRoute>
      }
    />
    <Route
      path="/subscription/plans"
      element={
        <ProtectedRoute>
          <SubscriptionPlans />
        </ProtectedRoute>
      }
    />
    <Route
      path="/wallet"
      element={
        <ProtectedRoute>
          <Wallet />
        </ProtectedRoute>
      }
    />
    <Route
      path="/recovery"
      element={
        <ProtectedRoute>
          <RecoveryPartners />
        </ProtectedRoute>
      }
    />
    <Route
      path="/recovery/:id"
      element={
        <ProtectedRoute>
          <RecoveryDetail />
        </ProtectedRoute>
      }
    />
    <Route
      path="/recovery/bookings"
      element={
        <ProtectedRoute>
          <MyBookings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/partners/sporthub"
      element={
        <ProtectedRoute>
          <SportHubPartner />
        </ProtectedRoute>
      }
    />
    <Route
      path="/checkout"
      element={
        <ProtectedRoute>
          <Checkout />
        </ProtectedRoute>
      }
    />
    <Route
      path="/health/meal-response"
      element={
        <ProtectedRoute>
          {isPhaseOneFeatureEnabled("mealResponse") ? (
            <MealResponse />
          ) : (
            <Navigate to="/health/dashboard" replace />
          )}
        </ProtectedRoute>
      }
    />
    <Route
      path="/payment/result"
      element={
        <ProtectedRoute>
          <PaymentResult />
        </ProtectedRoute>
      }
    />
    <Route
      path="/invoices"
      element={
        <ProtectedRoute>
          <InvoiceHistory />
        </ProtectedRoute>
      }
    />
    <Route
      path="/notifications"
      element={
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      }
    />
    <Route
      path="/favorites"
      element={
        <ProtectedRoute>
          <Favorites />
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings"
      element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/affiliate"
      element={
        <ProtectedRoute>
          <Affiliate />
        </ProtectedRoute>
      }
    />
    <Route
      path="/affiliate/tracking"
      element={
        <ProtectedRoute>
          <ReferralTracking />
        </ProtectedRoute>
      }
    />
    <Route
      path="/addresses"
      element={
        <ProtectedRoute>
          <Addresses />
        </ProtectedRoute>
      }
    />
    <Route
      path="/support"
      element={
        <ProtectedRoute>
          <Support />
        </ProtectedRoute>
      }
    />
    <Route
      path="/community"
      element={
        <ProtectedRoute>
          <Community />
        </ProtectedRoute>
      }
    />
    <Route
      path="/log-activity"
      element={
        <ProtectedRoute>
          <LogActivity />
        </ProtectedRoute>
      }
    />
    <Route
      path="/recommendations"
      element={
        <ProtectedRoute>
          <SmartMealRecommendations />
        </ProtectedRoute>
      }
    />
    <Route
      path="/coaches"
      element={
        <ProtectedRoute>
          <CoachesDirectory />
        </ProtectedRoute>
      }
    />
    <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
    <Route path="/friend-leaderboard" element={<ProtectedRoute><FriendLeaderboard /></ProtectedRoute>} />
    <Route
      path="/become-coach"
      element={
        <ProtectedRoute>
          <ApplyCoach />
        </ProtectedRoute>
      }
    />
    <Route
      path="/coach-messages"
      element={
        <ProtectedRoute>
          <CoachMessages />
        </ProtectedRoute>
      }
    />
    <Route path="/coach-onboarding" element={<ProtectedRoute><CoachOnboarding /></ProtectedRoute>} />
    <Route path="/coach-subscription" element={<ProtectedRoute><CoachSubscription /></ProtectedRoute>} />
    <Route path="/coach-programs" element={<ProtectedRoute><CoachPrograms /></ProtectedRoute>} />
    <Route path="/coach-programs/workout/:programId/day/:dayNumber" element={<ProtectedRoute><GuidedWorkout /></ProtectedRoute>} />
    <Route path="/workout-history" element={<ProtectedRoute><WorkoutHistory /></ProtectedRoute>} />
    <Route
      path="/ai-report"
      element={
        <ProtectedRoute>
          <AIReport />
        </ProtectedRoute>
      }
    />
    <Route
      path="/outdoor-activity"
      element={
        <ProtectedRoute>
          {isPhaseOneFeatureEnabled("outdoorRecording") ? (
            <OutdoorActivity />
          ) : (
            <Navigate to="/log-activity" replace />
          )}
        </ProtectedRoute>
      }
    />
    <Route
      path="/ai-coach"
      element={
        <ProtectedRoute>
          <AiCoach />
        </ProtectedRoute>
      }
    />
    <Route
      path="/weekly-check-in"
      element={
        <ProtectedRoute>
          <WeeklyAICheckIn />
        </ProtectedRoute>
      }
    />
    <Route path="/coach-schedule" element={<ProtectedRoute><ClientCoachSchedule /></ProtectedRoute>} />
    <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
    <Route path="/recipes/new" element={<ProtectedRoute><RecipeNew /></ProtectedRoute>} />
    <Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetail /></ProtectedRoute>} />
    <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
    <Route path="/medications" element={<ProtectedRoute><Medications /></ProtectedRoute>} />
      <Route path="/programs" element={<ProtectedRoute><HealthPrograms /></ProtectedRoute>} />
      <Route path="/programs/current" element={<ProtectedRoute><MyHealthProgram /></ProtectedRoute>} />
      <Route path="/programs/current/meals" element={<ProtectedRoute><HealthProgramMeals /></ProtectedRoute>} />
      <Route path="/programs/onboarding" element={<ProtectedRoute><HealthProgramOnboarding /></ProtectedRoute>} />
      <Route path="/programs/:slug" element={<ProtectedRoute><HealthProgramDetail /></ProtectedRoute>} />
  </>
);
