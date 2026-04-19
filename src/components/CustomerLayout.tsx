import { Outlet, useLocation } from "react-router-dom";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

const HIDDEN_NAV_PATHS = [
  "/checkout",
  "/onboarding",
];

export const CustomerLayout = () => {
  const location = useLocation();
  const shouldHideNav = HIDDEN_NAV_PATHS.some(path => 
    location.pathname === path || location.pathname.startsWith(path + "/")
  );

  console.log('[CustomerLayout] Path:', location.pathname, 'Should hide:', shouldHideNav);

  return (
    <div className="min-h-screen" data-testid="customer-layout">
      <Outlet />
      {!shouldHideNav && <BottomTabBar />}
    </div>
  );
};

export default CustomerLayout;
