import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Meals = lazy(() => import("@/pages/Meals"));
const RestaurantDetail = lazy(() => import("@/pages/RestaurantDetail"));
const MealDetail = lazy(() => import("@/pages/MealDetail"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Progress = lazy(() => import("@/pages/ProgressRedesigned"));
const Tracker = lazy(() => import("@/pages/Tracker"));
const WaterTracker = lazy(() => import("@/pages/WaterTracker"));
const StepCounter = lazy(() => import("@/pages/StepCounter"));
const WeightTracking = lazy(() => import("@/pages/WeightTracking"));
const BloodWorkUpload = lazy(() => import("@/pages/health/BloodWorkUpload"));
const BloodWorkResults = lazy(() => import("@/pages/health/BloodWorkResults"));
const HealthDashboard = lazy(() => import("@/pages/health/HealthDashboard"));
const Profile = lazy(() => import("@/pages/Profile"));
const Dietary = lazy(() => import("@/pages/Dietary"));
const Policies = lazy(() => import("@/pages/Policies"));
const PersonalInfo = lazy(() => import("@/pages/PersonalInfo"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const SubscriptionPlans = lazy(() => import("@/pages/subscription/SubscriptionPlans"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Favorites = lazy(() => import("@/pages/Favorites"));
const Settings = lazy(() => import("@/pages/Settings"));
const Affiliate = lazy(() => import("@/pages/Affiliate"));
const ReferralTracking = lazy(() => import("@/pages/ReferralTracking"));
const Addresses = lazy(() => import("@/pages/Addresses"));
const Support = lazy(() => import("@/pages/Support"));
const Wallet = lazy(() => import("@/pages/Wallet"));
const InvoiceHistory = lazy(() => import("@/pages/InvoiceHistory"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const OrderHistory = lazy(() => import("@/pages/OrderHistory"));
const RecoveryPartners = lazy(() => import("@/pages/recovery/RecoveryPartners"));
const RecoveryDetail = lazy(() => import("@/pages/recovery/RecoveryDetail"));
const MyBookings = lazy(() => import("@/pages/recovery/MyBookings"));
const Community = lazy(() => import("@/pages/Community"));
const LogActivity = lazy(() => import("@/pages/LogActivity"));
const NutritionGoals = lazy(() => import("@/pages/NutritionGoals"));
const BodyMetrics = lazy(() => import("@/pages/BodyMetrics"));
const SmartRecommendationsPage = lazy(() => import("@/pages/recommendations/SmartMealRecommendations"));
const CoachesDirectory = lazy(() => import("@/pages/CoachesDirectory"));
const ApplyCoach = lazy(() => import("@/pages/coach/ApplyCoach"));
const CoachMessages = lazy(() => import("@/pages/CoachMessages"));
const CoachOnboarding = lazy(() => import("@/pages/nutrio/CoachOnboarding"));
const CoachSubscription = lazy(() => import("@/pages/nutrio/CoachSubscription"));
const CoachPrograms = lazy(() => import("@/pages/nutrio/CoachPrograms"));
const GuidedWorkout = lazy(() => import("@/pages/nutrio/GuidedWorkout"));
const CoachSchedule = lazy(() => import("@/pages/coach/CoachSchedule"));
const WorkoutHistory = lazy(() => import("@/pages/nutrio/WorkoutHistory"));
const AIReport = lazy(() => import("@/pages/AIReport"));

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
      path="/progress"
      element={
        <ProtectedRoute>
          <Progress />
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
      element={<Navigate to="/progress?tab=goals" replace />}
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
    <Route path="/orders" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
    <Route path="/order/:id" element={<Navigate to="/dashboard" replace />} />
    <Route path="/tracking" element={<Navigate to="/dashboard" replace />} />
    <Route path="/plans" element={<Navigate to="/subscription/plans" replace />} />
    <Route path="/subscribe" element={<Navigate to="/subscription" replace />} />
    <Route path="/cart" element={<Navigate to="/checkout" replace />} />
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
      path="/checkout"
      element={
        <ProtectedRoute>
          <Checkout />
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
          <SmartRecommendationsPage />
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
    <Route
      path="/coach-onboarding"
      element={
        <ProtectedRoute>
          <CoachOnboarding />
        </ProtectedRoute>
      }
    />
    <Route
      path="/coach-subscription"
      element={
        <ProtectedRoute>
          <CoachSubscription />
        </ProtectedRoute>
      }
    />
    <Route
      path="/coach-programs"
      element={
        <ProtectedRoute>
          <CoachPrograms />
        </ProtectedRoute>
      }
    />
    <Route
      path="/coach-programs/workout/:programId/day/:dayNumber"
      element={
        <ProtectedRoute>
          <GuidedWorkout />
        </ProtectedRoute>
      }
    />
    <Route
      path="/workout-history"
      element={
        <ProtectedRoute>
          <WorkoutHistory />
        </ProtectedRoute>
      }
    />
    <Route
      path="/ai-report"
      element={
        <ProtectedRoute>
          <AIReport />
        </ProtectedRoute>
      }
    />
    <Route
      path="/coach-schedule"
      element={
        <ProtectedRoute>
          <CoachSchedule />
        </ProtectedRoute>
      }
    />
  </>
);
