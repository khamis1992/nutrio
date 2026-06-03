import { useRef, useEffect, useState, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

const HIDDEN_NAV_PATHS = [
  "/checkout",
  "/onboarding",
  "/subscription",
];

// Dock height: 68px dock + 4px gap + env(safe-area-inset-bottom) bottom padding
const DOCK_RESERVED_HEIGHT = "calc(72px + env(safe-area-inset-bottom, 0px))";

export const CustomerLayout = () => {
  const location = useLocation();
  const shouldHideNav = HIDDEN_NAV_PATHS.some(path =>
    location.pathname === path || location.pathname.startsWith(path + "/")
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const initialRestoreDone = useRef(false);
  const previousPath = useRef<string>(location.pathname);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setKeyboardOpen(window.innerHeight - vv.height > 100);
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  // On every route change: reset inner scroller to top, then save the previous
  // page's scroll position under a per-route key so the user comes back to the
  // same place if they navigate back to it.
  useEffect(() => {
    const prev = previousPath.current;
    if (prev !== location.pathname) {
      // Save the old page's scroll position under its own key
      if (scrollRef.current) {
        sessionStorage.setItem(
          `customer-layout-scroll:${prev}`,
          String(scrollRef.current.scrollTop)
        );
      }
      // Restore the new page's previous position if any, else scroll to top
      const el = scrollRef.current;
      if (el) {
        const saved = sessionStorage.getItem(
          `customer-layout-scroll:${location.pathname}`
        );
        if (saved !== null && initialRestoreDone.current) {
          el.scrollTop = Number(saved);
        } else {
          el.scrollTop = 0;
        }
      }
      previousPath.current = location.pathname;
      initialRestoreDone.current = true;
    }
  }, [location.pathname]);

  // First-mount restore: only runs once, picks up the most recent global fallback
  useEffect(() => {
    if (initialRestoreDone.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(
      `customer-layout-scroll:${location.pathname}`
    );
    if (saved !== null) {
      el.scrollTop = Number(saved);
    } else {
      el.scrollTop = 0;
    }
    initialRestoreDone.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      sessionStorage.setItem(
        `customer-layout-scroll:${location.pathname}`,
        String(scrollRef.current.scrollTop)
      );
    }
  }, [location.pathname]);

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