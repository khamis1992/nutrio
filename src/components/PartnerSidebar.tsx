import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  LogOut,
  MessageSquare,
  Package,
  Rocket,
  Settings,
  Store,
  TrendingUp,
  User,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: Store, label: "Dashboard", to: "/partner" },
  { icon: UtensilsCrossed, label: "Menu", to: "/partner/menu" },
  { icon: Package, label: "Orders", to: "/partner/orders" },
  { icon: BarChart3, label: "Analytics", to: "/partner/analytics" },
  { icon: Wallet, label: "Payouts", to: "/partner/payouts" },
  { icon: TrendingUp, label: "Earnings", to: "/partner/earnings" },
  { icon: MessageSquare, label: "Reviews", to: "/partner/reviews" },
  { icon: Bell, label: "Notifications", to: "/partner/notifications" },
  { icon: User, label: "Profile", to: "/partner/profile" },
  { icon: Settings, label: "Settings", to: "/partner/settings" },
];

const boostItem = { icon: Rocket, label: "Boost", to: "/partner/boost" };

const partnerRoutePreloaders: Record<string, () => Promise<unknown>> = {
  "/partner": () => import("@/pages/partner/PartnerDashboard"),
  "/partner/menu": () => import("@/pages/partner/PartnerMenu"),
  "/partner/orders": () => import("@/pages/partner/PartnerOrders"),
  "/partner/analytics": () => import("@/pages/partner/PartnerAnalytics"),
  "/partner/payouts": () => import("@/pages/partner/PartnerPayouts"),
  "/partner/earnings": () => import("@/pages/partner/PartnerEarningsDashboard"),
  "/partner/reviews": () => import("@/pages/partner/PartnerReviews"),
  "/partner/notifications": () =>
    import("@/pages/partner/PartnerNotifications"),
  "/partner/profile": () => import("@/pages/partner/PartnerProfile"),
  "/partner/settings": () => import("@/pages/partner/PartnerSettings"),
  "/partner/boost": () => import("@/pages/partner/PartnerBoost"),
};

const preloadPartnerRoute = (path: string) => {
  void partnerRoutePreloaders[path]?.().catch(() => undefined);
};

export function PartnerSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/partner") {
      return location.pathname === "/partner";
    }
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Store className="w-4 h-4 text-primary" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm">Partner Portal</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.to)}
                    tooltip={item.label}
                  >
                    <Link
                      to={item.to}
                      onMouseEnter={() => preloadPartnerRoute(item.to)}
                      onFocus={() => preloadPartnerRoute(item.to)}
                      onPointerDown={() => preloadPartnerRoute(item.to)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {/* Boost item with highlight */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(boostItem.to)}
                  tooltip={boostItem.label}
                  className="text-primary"
                >
                  <Link
                    to={boostItem.to}
                    onMouseEnter={() => preloadPartnerRoute(boostItem.to)}
                    onFocus={() => preloadPartnerRoute(boostItem.to)}
                    onPointerDown={() => preloadPartnerRoute(boostItem.to)}
                  >
                    <boostItem.icon className="h-4 w-4" />
                    <span>{boostItem.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out">
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
