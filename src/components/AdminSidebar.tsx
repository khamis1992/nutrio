import { Link, useLocation } from "react-router-dom";
import { 
  Shield, 
  Store, 
  Users, 
  ShoppingBag, 
  BarChart3, 
  CreditCard, 
  Settings, 
  Download, 
  Wallet, 
  Tag, 
  Ticket, 
  Headphones, 
  Bell,
  Megaphone,
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: Shield, label: "Dashboard", to: "/admin" },
  { icon: Store, label: "Restaurants", to: "/admin/restaurants" },
  { icon: Users, label: "Users", to: "/admin/users" },
  { icon: ShoppingBag, label: "Orders", to: "/admin/orders" },
  { icon: CreditCard, label: "Subscriptions", to: "/admin/subscriptions" },
  { icon: Wallet, label: "Payouts", to: "/admin/payouts" },
  { icon: Tag, label: "Diet Tags", to: "/admin/diet-tags" },
  { icon: Ticket, label: "Promotions", to: "/admin/promotions" },
  { icon: Megaphone, label: "Announcements", to: "/admin/announcements" },
  { icon: Bell, label: "Notifications", to: "/admin/notifications" },
  { icon: Headphones, label: "Support", to: "/admin/support" },
  { icon: BarChart3, label: "Analytics", to: "/admin/analytics" },
  { icon: Download, label: "Exports", to: "/admin/exports" },
  { icon: Settings, label: "Settings", to: "/admin/settings" },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
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
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-destructive" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm">Admin Panel</span>
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
