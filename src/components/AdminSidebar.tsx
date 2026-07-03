import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Megaphone,
  LogOut,
  UserCheck,
  Trophy,
  Rocket,
  Flame,
  TrendingUp,
  ClipboardCheck,
  Crown,
  Truck,
  ExternalLink,
  Car,
  Package,
  Snowflake,
  Activity,
  GraduationCap,
  DollarSign,
  Cpu,
  type LucideIcon,
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
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_SIDEBAR_SCROLL_KEY = "nutrio:admin-sidebar-scroll";

type NavItem = {
  icon: LucideIcon;
  label: string;
  to: string;
};

const navGroups: Array<{
  label: string;
  accent: string;
  items: NavItem[];
}> = [
  {
    label: "Command",
    accent: "#22C7A1",
    items: [
      { icon: Shield, label: "Dashboard", to: "/admin" },
      { icon: Store, label: "Restaurants", to: "/admin/restaurants" },
      { icon: Users, label: "Users", to: "/admin/users" },
      { icon: Car, label: "Drivers", to: "/admin/drivers" },
    ],
  },
  {
    label: "Operations",
    accent: "#38BDF8",
    items: [
      { icon: ClipboardCheck, label: "Meal Approvals", to: "/admin/meal-approvals" },
      { icon: ShoppingBag, label: "Orders", to: "/admin/orders" },
      { icon: Package, label: "Deliveries", to: "/admin/deliveries" },
      { icon: CreditCard, label: "Subscriptions", to: "/admin/subscriptions" },
      { icon: Snowflake, label: "Freeze Mgmt", to: "/admin/freeze-management" },
    ],
  },
  {
    label: "Growth",
    accent: "#7C83F6",
    items: [
      { icon: Rocket, label: "Featured", to: "/admin/featured" },
      { icon: UserCheck, label: "Affiliate Apps", to: "/admin/affiliate-applications" },
      { icon: UserCheck, label: "Affiliate Payouts", to: "/admin/affiliate-payouts" },
      { icon: Trophy, label: "Affiliate Milestones", to: "/admin/affiliate-milestones" },
      { icon: Flame, label: "Streak Rewards", to: "/admin/streak-rewards" },
      { icon: Trophy, label: "Community Challenges", to: "/admin/community-challenges" },
      { icon: Tag, label: "Diet Tags", to: "/admin/diet-tags" },
      { icon: Ticket, label: "Promotions", to: "/admin/promotions" },
      { icon: Megaphone, label: "Announcements", to: "/admin/notifications" },
    ],
  },
  {
    label: "Finance",
    accent: "#FB6B7A",
    items: [
      { icon: Wallet, label: "Customer Wallets", to: "/admin/customer-wallets" },
      { icon: Wallet, label: "Payouts", to: "/admin/payouts" },
      { icon: TrendingUp, label: "Income & Profit", to: "/admin/profit" },
      { icon: Crown, label: "Premium Analytics", to: "/admin/premium-analytics" },
      { icon: DollarSign, label: "Coach Commissions", to: "/admin/coach-commission" },
    ],
  },
  {
    label: "Insights",
    accent: "#38BDF8",
    items: [
      { icon: BarChart3, label: "Analytics", to: "/admin/analytics" },
      { icon: Activity, label: "Retention", to: "/admin/retention-analytics" },
      { icon: Download, label: "Exports", to: "/admin/exports" },
      { icon: Cpu, label: "AI Engine", to: "/admin/ai-engine" },
    ],
  },
  {
    label: "System",
    accent: "#22C7A1",
    items: [
      { icon: Headphones, label: "Support", to: "/admin/support" },
      { icon: GraduationCap, label: "Coach Apps", to: "/admin/coach-applications" },
      { icon: Settings, label: "Settings", to: "/admin/settings" },
      { icon: Shield, label: "IP Management", to: "/admin/ip-management" },
      { icon: Truck, label: "Fleet Portal", to: "/fleet" },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { state } = useSidebar();
  const contentRef = useRef<HTMLDivElement>(null);
  const isCollapsed = state === "collapsed";

  useEffect(() => {
    const savedScroll = Number(
      sessionStorage.getItem(ADMIN_SIDEBAR_SCROLL_KEY) || 0,
    );
    const frame = window.requestAnimationFrame(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = savedScroll;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

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

  const handleSidebarScroll = () => {
    if (!contentRef.current) return;
    sessionStorage.setItem(
      ADMIN_SIDEBAR_SCROLL_KEY,
      String(contentRef.current.scrollTop),
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-[#E5EAF1] bg-white">
      <SidebarHeader className="border-b border-[#E5EAF1] bg-white px-3 py-3">
        <div className="flex items-center gap-3 rounded-[20px] bg-[#F6F8FB] p-2 ring-1 ring-[#E5EAF1] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#020617] shadow-[0_10px_22px_rgba(2,6,23,0.16)]">
            <Shield className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight text-[#020617]">
                Admin Panel
              </span>
              <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                Nutrio operations
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent
        ref={contentRef}
        onScroll={handleSidebarScroll}
        className="bg-white px-2 py-3 [scrollbar-width:thin]"
      >
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="px-1 py-2">
            <SidebarGroupLabel className="mb-1 h-7 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
              <span
                className="mr-2 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: group.accent }}
              />
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {group.items.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className="group/nav relative h-10 rounded-[14px] px-2.5 text-sm font-black text-[#64748B] transition-all hover:bg-[#F6F8FB] hover:text-[#020617] data-[active=true]:bg-[#020617] data-[active=true]:text-white data-[active=true]:shadow-[0_12px_24px_rgba(2,6,23,0.16)]"
                      >
                        <Link to={item.to}>
                          <span
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-[11px] bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] transition-colors group-data-[active=true]/nav:bg-white/10 group-data-[active=true]/nav:text-white group-data-[active=true]/nav:ring-white/10"
                            style={!active ? { color: group.accent } : undefined}
                          >
                            <item.icon className="h-4 w-4" />
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-[#E5EAF1] bg-white p-3">
        {!isCollapsed && (
          <div className="mb-3 rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#22C7A1]" />
              <p className="text-xs font-black text-[#020617]">Admin workspace</p>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-[#94A3B8]">
              System controls and live operations
            </p>
          </div>
        )}
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="View as Customer"
              className="h-10 rounded-[14px] px-2.5 font-black text-[#64748B] hover:bg-[#F6F8FB] hover:text-[#020617]"
            >
              <Link to="/dashboard">
                <Users className="h-4 w-4 text-[#7C83F6]" />
                <span>View as Customer</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Open Fleet Portal"
              className="h-10 rounded-[14px] px-2.5 font-black text-[#64748B] hover:bg-[#F6F8FB] hover:text-[#020617]"
            >
              <Link to="/fleet" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 text-[#38BDF8]" />
                <span>Open Fleet Portal</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarSeparator className="my-1 bg-[#E5EAF1]" />
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Sign Out"
              className="h-10 rounded-[14px] px-2.5 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
