import { Link, useLocation } from "react-router-dom";
import { 
  Store, 
  UtensilsCrossed, 
  Package, 
  BarChart3, 
  Settings, 
  Wallet, 
  Star,
  Bell,
  User,
  Users,
  LogOut
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
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: Store, label: "Dashboard", to: "/partner" },
  { icon: UtensilsCrossed, label: "Menu", to: "/partner/menu" },
  { icon: Package, label: "Add-ons", to: "/partner/addons" },
  { icon: Package, label: "Orders", to: "/partner/orders" },
  { icon: BarChart3, label: "Analytics", to: "/partner/analytics" },
  { icon: Wallet, label: "Payouts", to: "/partner/payouts" },
  { icon: Star, label: "Reviews", to: "/partner/reviews" },
  { icon: Bell, label: "Notifications", to: "/partner/notifications" },
  { icon: User, label: "Profile", to: "/partner/profile" },
  { icon: Settings, label: "Settings", to: "/partner/settings" },
];

// Import Sparkles for boost icon and additional icons
import { Sparkles, Brain } from "lucide-react";

const boostItem = { icon: Sparkles, label: "Boost", to: "/partner/boost" };
const aiInsightsItem = { icon: Brain, label: "AI Insights", to: "/partner/ai-insights" };

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
                    <Link to={item.to}>
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
                  <Link to={boostItem.to}>
                    <boostItem.icon className="h-4 w-4" />
                    <span>{boostItem.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* AI Insights item */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(aiInsightsItem.to)}
                  tooltip={aiInsightsItem.label}
                  className="text-purple-500"
                >
                  <Link to={aiInsightsItem.to}>
                    <aiInsightsItem.icon className="h-4 w-4" />
                    <span>{aiInsightsItem.label}</span>
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
            <SidebarMenuButton
              asChild
              tooltip="View as Customer"
            >
              <Link to="/dashboard">
                <Users className="h-4 w-4" />
                <span>View as Customer</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Sign Out"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
