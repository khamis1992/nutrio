import { useRef, useEffect, useState, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

const HIDDEN_NAV_PATHS = [
  "/checkout",
  "/onboarding",
  "/subscription",
];

const DOCK_RESERVED_HEIGHT = "calc(100px + env(safe-area-inset-bottom, 16px))";

export const CustomerLayout = () => {
  const location = useLocation();
  const shouldHideNav = HIDDEN_NAV_PATHS.some(path =>
    location.pathname === path || location.pathname.startsWith(path + "/")
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setKeyboardOpen(window.innerHeight - vv.height > 100);
    };

    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("customer-layout-scroll");
    if (saved && scrollRef.current) {
      scrollRef.current.scrollTop = Number(saved);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      sessionStorage.setItem("customer-layout-scroll", String(scrollRef.current.scrollTop));
    }
  }, []);

  if (import.meta.env.DEV) {
    console.log('[CustomerLayout] Path:', location.pathname, 'Should hide:', shouldHideNav);
  }

  return (
    <div
      className="relative flex flex-col"
      style={{ height: "100dvh", overflow: "hidden" }}
      data-testid="customer-layout"
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
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
