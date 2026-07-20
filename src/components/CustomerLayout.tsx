import { useRef, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { useContextualNudges } from "@/hooks/useContextualNudges";
import { useSmartGoalAdjustmentNotifications } from "@/hooks/useSmartGoalAdjustmentNotifications";

const HIDDEN_NAV_PATHS = [
  "/checkout",
  "/payment/result",
  "/onboarding",
  "/subscription",
  "/personal-info",
  "/dietary",
  "/medications",
  "/health/dashboard",
  "/addresses",
  "/wallet",
  "/rewards",
  "/invoices",
  "/orders",
  "/favorites",
  "/community",
  "/support",
  "/notifications",
  "/settings",
  "/affiliate",
  "/coach-programs",
  "/programs",
  "/ai-coach",
];

// Keep content clear of the native-style bottom tab bar.
const DOCK_RESERVED_HEIGHT = "calc(74px + env(safe-area-inset-bottom, 0px))";

export const CustomerLayout = () => {
  const location = useLocation();
  useContextualNudges();
  useSmartGoalAdjustmentNotifications();
  const shouldHideNav = HIDDEN_NAV_PATHS.some(path =>
    location.pathname === path || location.pathname.startsWith(path + "/")
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const previousPath = useRef<string>(location.pathname);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // Dual check: viewport must be BOTH significantly smaller AND pushed
      // up from the top. This prevents false positives from browser
      // address bar hide/show, dev tools resize, or window resize on
      // desktop — those change the height diff but offsetTop stays 0.
      const diff = window.innerHeight - vv.height;
      const isKBOpen = diff > 150 && vv.offsetTop > 0;
      setKeyboardOpen(isKBOpen);
    };
    vv.addEventListener("resize", handleResize);

    // Safety reset: spurious resize events during page load (address bar
    // show/hide, orientation changes) can fire before React has settled,
    // leaving keyboardOpen stuck at true. Force-reset after a short delay
    // to guarantee the dock is never permanently hidden.
    const safetyTimer = setTimeout(() => setKeyboardOpen(false), 400);

    return () => {
      vv.removeEventListener("resize", handleResize);
      clearTimeout(safetyTimer);
    };
  }, []);

  // Scroll to top on every route change
  // Also reset keyboard state — a virtual keyboard cannot remain open
  // during a route transition (the browser hides it on navigation).
  useEffect(() => {
    const prev = previousPath.current;
    if (prev !== location.pathname) {
      previousPath.current = location.pathname;
      setKeyboardOpen(false);
      // Force scroll to top — use requestAnimationFrame to ensure
      // the new page content has painted before resetting
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = 0;
        requestAnimationFrame(() => {
          el.scrollTop = 0;
        });
      }
    }
  }, [location.pathname]);

  return (
    <div
      className="relative flex flex-col"
      style={{ height: "100dvh", overflow: "hidden" }}
      data-testid="customer-layout"
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          paddingBottom: shouldHideNav ? undefined : DOCK_RESERVED_HEIGHT,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Outlet />
      </div>

      {!shouldHideNav && (
        <BottomTabBar keyboardOpen={keyboardOpen} />
      )}
    </div>
  );
};

export default CustomerLayout;
