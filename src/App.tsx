import { lazy, Suspense, useEffect } from "react";
import { isNative } from "@/lib/capacitor";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionTimeoutManager } from "@/components/SessionTimeoutManager";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Loader2 } from "lucide-react";
import { fleetRoutes } from "@/fleet/routes";
import { customerRoutes } from "@/customer/routes";
import CustomerLayout from "@/components/CustomerLayout";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded pages - split by feature area
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Customer pages (used outside CustomerLayout)
const WalkthroughScreen = lazy(() => import("./pages/WalkthroughScreen"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const LiveMap = lazy(() => import("./pages/LiveMap"));

// Partner pages
const PartnerAuth = lazy(() => import("./pages/partner/PartnerAuth"));
const PartnerDashboard = lazy(() => import("./pages/partner/PartnerDashboard"));
const PartnerMenu = lazy(() => import("./pages/partner/PartnerMenu"));
const PartnerOrders = lazy(() => import("./pages/partner/PartnerOrders"));
const PartnerSettings = lazy(() => import("./pages/partner/PartnerSettings"));
const PartnerAnalytics = lazy(() => import("./pages/partner/PartnerAnalytics"));
const PartnerNotifications = lazy(() => import("./pages/partner/PartnerNotifications"));
const PartnerReviews = lazy(() => import("./pages/partner/PartnerReviews"));
const PartnerProfile = lazy(() => import("./pages/partner/PartnerProfile"));
const PartnerPayouts = lazy(() => import("./pages/partner/PartnerPayouts"));
const PartnerOnboarding = lazy(() => import("./pages/partner/PartnerOnboarding"));
const PartnerBoost = lazy(() => import("./pages/partner/PartnerBoost"));
const PendingApproval = lazy(() => import("./pages/partner/PendingApproval"));
const PartnerEarningsDashboard = lazy(() => import("./pages/partner/PartnerEarningsDashboard"));
const SportHubWelcome = lazy(() => import("./pages/partners/SportHubWelcome"));
// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRestaurants = lazy(() => import("./pages/admin/AdminRestaurants"));
const AdminRestaurantDetail = lazy(() => import("./pages/admin/AdminRestaurantDetail"));
const AdminFeatured = lazy(() => import("./pages/admin/AdminFeatured"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminExports = lazy(() => import("./pages/admin/AdminExports"));
const AdminPayouts = lazy(() => import("./pages/admin/AdminPayouts"));
const AdminCustomerWallets = lazy(() => import("./pages/admin/AdminCustomerWallets"));
const AdminAffiliatePayouts = lazy(() => import("./pages/admin/AdminAffiliatePayouts"));
const AdminAffiliateApplications = lazy(() => import("./pages/admin/AdminAffiliateApplications"));
const AdminMilestones = lazy(() => import("./pages/admin/AdminMilestones"));
const AdminDietTags = lazy(() => import("./pages/admin/AdminDietTags"));
const AdminPromotions = lazy(() => import("./pages/admin/AdminPromotions"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const AdminDeliveries = lazy(() => import("./pages/admin/AdminDeliveries"));
const AdminIPManagement = lazy(() => import("./pages/admin/AdminIPManagement"));
const AdminSecurityCenter = lazy(() => import("./pages/admin/AdminSecurityCenter"));
const AdminFreezeManagement = lazy(() => import("./pages/admin/AdminFreezeManagement"));
const AdminRetentionAnalytics = lazy(() => import("./pages/admin/AdminRetentionAnalytics"));
const AdminStreakRewards = lazy(() => import("./pages/admin/AdminStreakRewards"));
const AdminCommunityChallenges = lazy(() => import("./pages/admin/AdminCommunityChallenges"));
const AdminProfitDashboard = lazy(() => import("./pages/admin/AdminProfitDashboard"));
const AdminMealApprovals = lazy(() => import("./pages/admin/AdminMealApprovals"));
const AdminPremiumAnalytics = lazy(() => import("./pages/admin/AdminPremiumAnalytics"));
const AdminCoachApprovals = lazy(() => import("./pages/admin/AdminCoachApprovals"));
const AdminCoachCommission = lazy(() => import("./pages/admin/AdminCoachCommission"));
const AdminPartnerIntegrations = lazy(() => import("./pages/admin/AdminPartnerIntegrations"));

// Driver pages
const DriverAuth = lazy(() => import("./pages/driver/DriverAuth"));
const DriverOnboarding = lazy(() => import("./pages/driver/DriverOnboarding"));
const DriverDashboard = lazy(() => import("./pages/driver/DriverDashboard"));
const DriverOrders = lazy(() => import("./pages/driver/DriverOrders"));
const DriverOrderDetail = lazy(() => import("./pages/driver/DriverOrderDetail"));
const DriverHistory = lazy(() => import("./pages/driver/DriverHistory"));
const DriverEarnings = lazy(() => import("./pages/driver/DriverEarnings"));
const DriverPayouts = lazy(() => import("./pages/driver/DriverPayouts"));
const DriverProfile = lazy(() => import("./pages/driver/DriverProfile"));
const DriverSettings = lazy(() => import("./pages/driver/DriverSettings"));
const DriverSupport = lazy(() => import("./pages/driver/DriverSupport"));
const DriverNotifications = lazy(() => import("./pages/driver/DriverNotifications"));
const DriverLayout = lazy(() => import("./components/driver/DriverLayout").then(m => ({ default: m.DriverLayout })));
const CoachDashboard = lazy(() => import("./pages/coach/CoachDashboard"));
const CoachInsights = lazy(() => import("./pages/coach/CoachInsights"));
const CoachSettings = lazy(() => import("./pages/coach/CoachSettings"));
const CoachChatPage = lazy(() => import("./pages/coach/CoachChatPage"));
const CoachClientDetail = lazy(() => import("./pages/coach/CoachClientDetail"));
const CoachEarningsPage = lazy(() => import("./pages/coach/CoachEarningsPage"));
const CoachPortalLayout = lazy(() => import("./components/coach/CoachPortalLayout").then(m => ({ default: m.CoachPortalLayout })));
const CoachSchedule = lazy(() => import("./pages/coach/CoachSchedule"));
const AdminAIEngineMonitor = lazy(() => import("./pages/admin/AdminAIEngineMonitor"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const AppContentLoader = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

// Resets scroll to top on every route change (fixes Capacitor WebView scroll persistence)
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-center" />
      <BrowserRouter basename={isNative ? undefined : "/nutrio"}>
        <AuthProvider>
          <AnalyticsProvider>
            <SessionTimeoutManager>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <RouteErrorBoundary>
                <Routes>
            <Route
              path="/"
              element={<Navigate to="/auth" replace />}
            />
            <Route path="/walkthrough" element={<WalkthroughScreen />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/sporthub" element={<SportHubWelcome />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Onboarding has no dock/nav */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/* Live map — no nav bar, full screen */}
            <Route path="/live/:id" element={<ProtectedRoute><LiveMap /></ProtectedRoute>} />

            {/* Customer App Routes */}
            <Route element={<CustomerLayout />}>
              {customerRoutes}
            </Route>
            {/* Partner Portal Routes */}
            <Route path="/partner/auth" element={<PartnerAuth />} />
            <Route 
              path="/partner/onboarding" 
              element={
                <ProtectedRoute requiredRole="partner">
                  <PartnerOnboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/menu" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerMenu />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/addons" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <Navigate to="/partner/menu?tab=addons" replace />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/orders"
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/settings" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/analytics" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/notifications" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerNotifications />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/partner/reviews"
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerReviews />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/partner/profile" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/payouts" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerPayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/boost" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerBoost />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/pending-approval" 
              element={
                <ProtectedRoute requiredRole="partner">
                  <PendingApproval />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/earnings" 
              element={
                <ProtectedRoute requiredRole="partner" requireApproval>
                  <PartnerEarningsDashboard />
                </ProtectedRoute>
              } 
            />
            {/* Admin Portal Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/restaurants" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminRestaurants />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/restaurants/:id" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminRestaurantDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/featured" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminFeatured />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/meal-approvals" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminMealApprovals />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsers />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin/users/:userId"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/admin/orders" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/subscriptions" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSubscriptions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/income" 
              element={<Navigate to="/admin/profit" replace />}
            />
            <Route 
              path="/admin/profit" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminProfitDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/settings" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/exports" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminExports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/payouts" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPayouts />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin/customer-wallets"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminCustomerWallets />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/admin/affiliate-payouts" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAffiliatePayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/premium-analytics" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPremiumAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/affiliate-applications" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAffiliateApplications />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin/partner-integrations"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPartnerIntegrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/affiliate-milestones"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminMilestones />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/streak-rewards"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminStreakRewards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/community-challenges"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminCommunityChallenges />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/diet-tags" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDietTags />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/promotions" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPromotions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/announcements" 
              element={<Navigate to="/admin/notifications" replace />} 
            />
            <Route 
              path="/admin/support" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSupport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/notifications" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminNotifications />
                </ProtectedRoute>
              } 
            />
<Route 
  path="/admin/drivers" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDrivers />
    </ProtectedRoute>
  } 
/>
<Route
  path="/admin/deliveries"
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDeliveries />
    </ProtectedRoute>
  }
/>
<Route 
  path="/admin/ip-management" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminIPManagement />
    </ProtectedRoute>
  } 
/>
<Route
  path="/admin/security"
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminSecurityCenter />
    </ProtectedRoute>
  }
/>
<Route 
  path="/admin/freeze-management" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminFreezeManagement />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/retention-analytics" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminRetentionAnalytics />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/coach-applications" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminCoachApprovals />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/coach-commission" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminCoachCommission />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/ai-engine" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminAIEngineMonitor />
    </ProtectedRoute>
  } 
/>
            {/* Driver Portal Routes */}
            <Route path="/driver/auth" element={<DriverAuth />} />
            <Route 
              path="/driver/onboarding" 
              element={
                <ProtectedRoute requiredRole="driver">
                  <DriverOnboarding />
                </ProtectedRoute>
              } 
            />
            <Route path="/driver" element={
              <ProtectedRoute requiredRole="driver">
                <Suspense fallback={<AppContentLoader />}>
                  <DriverLayout />
                </Suspense>
              </ProtectedRoute>
            }>
              <Route index element={<DriverDashboard />} />
              <Route path="orders" element={<DriverOrders />} />
              <Route path="orders/:id" element={<DriverOrderDetail />} />
              <Route path="history" element={<DriverHistory />} />
              <Route path="earnings" element={<DriverEarnings />} />
              <Route path="payouts" element={<DriverPayouts />} />
              <Route path="profile" element={<DriverProfile />} />
              <Route path="settings" element={<DriverSettings />} />
              <Route path="support" element={<DriverSupport />} />
              <Route path="notifications" element={<DriverNotifications />} />
            </Route>
            {/* Fleet Management Portal Routes */}
            {fleetRoutes}
            {/* Coach Portal Routes */}
            <Route path="/coach" element={
              <ProtectedRoute requiredRole="coach">
                <Suspense fallback={<AppContentLoader />}>
                  <CoachPortalLayout />
                </Suspense>
              </ProtectedRoute>
            }>
              <Route index element={<CoachDashboard />} />
              <Route path="insights" element={<CoachInsights />} />
              <Route path="chat" element={<CoachChatPage />} />
              <Route path="earnings" element={<CoachEarningsPage />} />
              <Route path="settings" element={<CoachSettings />} />
              <Route path="client/:clientId" element={<CoachClientDetail />} />
              <Route path="schedule" element={<CoachSchedule />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
              </RouteErrorBoundary>
          </Suspense>
          </SessionTimeoutManager>
          </AnalyticsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
