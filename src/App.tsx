import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NativeRouteRedirect } from "@/components/NativeRouteRedirect";
import { Loader2 } from "lucide-react";

// Critical first-render pages (eager loaded)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded pages - split by feature area
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Customer pages
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Meals = lazy(() => import("./pages/Meals"));
const RestaurantDetail = lazy(() => import("./pages/RestaurantDetail"));
const MealDetail = lazy(() => import("./pages/MealDetail"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Progress = lazy(() => import("./pages/Progress"));
const Profile = lazy(() => import("./pages/Profile"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const DeliveryTracking = lazy(() => import("./pages/DeliveryTracking"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Settings = lazy(() => import("./pages/Settings"));
const Referral = lazy(() => import("./pages/Referral"));
const Affiliate = lazy(() => import("./pages/Affiliate"));
const ReferralTracking = lazy(() => import("./pages/ReferralTracking"));
const Addresses = lazy(() => import("./pages/Addresses"));
const Support = lazy(() => import("./pages/Support"));
const Wallet = lazy(() => import("./pages/Wallet"));
const InvoiceHistory = lazy(() => import("./pages/InvoiceHistory"));

// Partner pages
const PartnerAuth = lazy(() => import("./pages/partner/PartnerAuth"));
const PartnerDashboard = lazy(() => import("./pages/partner/PartnerDashboard"));
const PartnerMenu = lazy(() => import("./pages/partner/PartnerMenu"));
const PartnerOrders = lazy(() => import("./pages/partner/PartnerOrders"));
const PartnerSettings = lazy(() => import("./pages/partner/PartnerSettings"));
const PartnerAnalytics = lazy(() => import("./pages/partner/PartnerAnalytics"));
const PartnerNotifications = lazy(() => import("./pages/partner/PartnerNotifications"));
const PartnerProfile = lazy(() => import("./pages/partner/PartnerProfile"));
const PartnerReviews = lazy(() => import("./pages/partner/PartnerReviews"));
const PartnerPayouts = lazy(() => import("./pages/partner/PartnerPayouts"));
const PartnerOnboarding = lazy(() => import("./pages/partner/PartnerOnboarding"));
const PartnerBoost = lazy(() => import("./pages/partner/PartnerBoost"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRestaurants = lazy(() => import("./pages/admin/AdminRestaurants"));
const AdminFeatured = lazy(() => import("./pages/admin/AdminFeatured"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminExports = lazy(() => import("./pages/admin/AdminExports"));
const AdminPayouts = lazy(() => import("./pages/admin/AdminPayouts"));
const AdminAffiliatePayouts = lazy(() => import("./pages/admin/AdminAffiliatePayouts"));
const AdminAffiliateApplications = lazy(() => import("./pages/admin/AdminAffiliateApplications"));
const AdminMilestones = lazy(() => import("./pages/admin/AdminMilestones"));
const AdminDietTags = lazy(() => import("./pages/admin/AdminDietTags"));
const AdminPromotions = lazy(() => import("./pages/admin/AdminPromotions"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const AdminIPManagement = lazy(() => import("./pages/admin/AdminIPManagement"));

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

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AnalyticsProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
            <Route
              path="/"
              element={
                <NativeRouteRedirect>
                  <Index />
                </NativeRouteRedirect>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meals" 
              element={
                <ProtectedRoute>
                  <Meals />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/restaurants/:id" 
              element={
                <ProtectedRoute>
                  <RestaurantDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meals/:id" 
              element={
                <ProtectedRoute>
                  <MealDetail />
                </ProtectedRoute>
              } 
            />
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
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute>
                  <OrderHistory />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders/:id" 
              element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tracking" 
              element={
                <ProtectedRoute>
                  <DeliveryTracking />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/subscription" 
              element={
                <ProtectedRoute>
                  <Subscription />
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
              path="/referral" 
              element={
                <ProtectedRoute>
                  <Referral />
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
            {/* Partner Portal Routes */}
            <Route path="/partner/auth" element={<PartnerAuth />} />
            <Route 
              path="/partner/onboarding" 
              element={
                <ProtectedRoute>
                  <PartnerOnboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner" 
              element={
                <ProtectedRoute>
                  <PartnerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/menu" 
              element={
                <ProtectedRoute>
                  <PartnerMenu />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/orders" 
              element={
                <ProtectedRoute>
                  <PartnerOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/settings" 
              element={
                <ProtectedRoute>
                  <PartnerSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/analytics" 
              element={
                <ProtectedRoute>
                  <PartnerAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/notifications" 
              element={
                <ProtectedRoute>
                  <PartnerNotifications />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/profile" 
              element={
                <ProtectedRoute>
                  <PartnerProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/reviews" 
              element={
                <ProtectedRoute>
                  <PartnerReviews />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/payouts" 
              element={
                <ProtectedRoute>
                  <PartnerPayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner/boost" 
              element={
                <ProtectedRoute>
                  <PartnerBoost />
                </ProtectedRoute>
              } 
            />
            {/* Admin Portal Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/restaurants" 
              element={
                <ProtectedRoute>
                  <AdminRestaurants />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/featured" 
              element={
                <ProtectedRoute>
                  <AdminFeatured />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute>
                  <AdminUsers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/orders" 
              element={
                <ProtectedRoute>
                  <AdminOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/subscriptions" 
              element={
                <ProtectedRoute>
                  <AdminSubscriptions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                <ProtectedRoute>
                  <AdminAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/settings" 
              element={
                <ProtectedRoute>
                  <AdminSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/exports" 
              element={
                <ProtectedRoute>
                  <AdminExports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/payouts" 
              element={
                <ProtectedRoute>
                  <AdminPayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/affiliate-payouts" 
              element={
                <ProtectedRoute>
                  <AdminAffiliatePayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/affiliate-applications" 
              element={
                <ProtectedRoute>
                  <AdminAffiliateApplications />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/milestones" 
              element={
                <ProtectedRoute>
                  <AdminMilestones />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/diet-tags" 
              element={
                <ProtectedRoute>
                  <AdminDietTags />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/promotions" 
              element={
                <ProtectedRoute>
                  <AdminPromotions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/announcements" 
              element={
                <ProtectedRoute>
                  <AdminAnnouncements />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/support" 
              element={
                <ProtectedRoute>
                  <AdminSupport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/notifications" 
              element={
                <ProtectedRoute>
                  <AdminNotifications />
                </ProtectedRoute>
              } 
            />
<Route 
  path="/admin/drivers" 
  element={
    <ProtectedRoute>
      <AdminDrivers />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/ip-management" 
  element={
    <ProtectedRoute>
      <AdminIPManagement />
    </ProtectedRoute>
  } 
/>
            {/* Driver Portal Routes */}
            <Route path="/driver/auth" element={<DriverAuth />} />
            <Route 
              path="/driver/onboarding" 
              element={
                <ProtectedRoute>
                  <DriverOnboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver" 
              element={
                <ProtectedRoute>
                  <DriverDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/orders" 
              element={
                <ProtectedRoute>
                  <DriverOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/orders/:id" 
              element={
                <ProtectedRoute>
                  <DriverOrderDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/history" 
              element={
                <ProtectedRoute>
                  <DriverHistory />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/earnings" 
              element={
                <ProtectedRoute>
                  <DriverEarnings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/payouts" 
              element={
                <ProtectedRoute>
                  <DriverPayouts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/profile" 
              element={
                <ProtectedRoute>
                  <DriverProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/settings" 
              element={
                <ProtectedRoute>
                  <DriverSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/support" 
              element={
                <ProtectedRoute>
                  <DriverSupport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/driver/notifications" 
              element={
                <ProtectedRoute>
                  <DriverNotifications />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </AnalyticsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
