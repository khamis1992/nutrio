import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Shield,
  Search,
  Store,
  Users,
  ShoppingBag,
  BarChart3,
  ChevronDown,
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
  ExternalLink,
  Car,
  Package,
  Snowflake,
  Activity,
  GraduationCap,
  DollarSign,
  Cpu,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const ADMIN_SIDEBAR_SCROLL_KEY = "nutrio:admin-sidebar-scroll";
const ADMIN_SIDEBAR_GROUPS_KEY = "nutrio:admin-sidebar-open-groups";

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
      {
        icon: ClipboardCheck,
        label: "Meal Approvals",
        to: "/admin/meal-approvals",
      },
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
      {
        icon: ExternalLink,
        label: "Partner Integrations",
        to: "/admin/partner-integrations",
      },
      {
        icon: UserCheck,
        label: "Affiliate Apps",
        to: "/admin/affiliate-applications",
      },
      {
        icon: UserCheck,
        label: "Affiliate Payouts",
        to: "/admin/affiliate-payouts",
      },
      {
        icon: Trophy,
        label: "Affiliate Milestones",
        to: "/admin/affiliate-milestones",
      },
      { icon: Flame, label: "Streak Rewards", to: "/admin/streak-rewards" },
      {
        icon: Trophy,
        label: "Community Challenges",
        to: "/admin/community-challenges",
      },
      { icon: Tag, label: "Diet Tags", to: "/admin/diet-tags" },
      { icon: Ticket, label: "Promotions", to: "/admin/promotions" },
      { icon: Megaphone, label: "Announcements", to: "/admin/notifications" },
    ],
  },
  {
    label: "Finance",
    accent: "#FB6B7A",
    items: [
      {
        icon: Wallet,
        label: "Customer Wallets",
        to: "/admin/customer-wallets",
      },
      { icon: Wallet, label: "Payouts", to: "/admin/payouts" },
      { icon: TrendingUp, label: "Income & Profit", to: "/admin/profit" },
      {
        icon: Crown,
        label: "Premium Analytics",
        to: "/admin/premium-analytics",
      },
      {
        icon: DollarSign,
        label: "Coach Commissions",
        to: "/admin/coach-commission",
      },
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
      {
        icon: GraduationCap,
        label: "Coach Apps",
        to: "/admin/coach-applications",
      },
      { icon: Settings, label: "Settings", to: "/admin/settings" },
      { icon: ShieldAlert, label: "Security Center", to: "/admin/security" },
      { icon: Shield, label: "IP Management", to: "/admin/ip-management" },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const contentRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);
  const isCollapsed = state === "collapsed";
  const [searchQuery, setSearchQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set(navGroups.map((group) => group.label));
    }

    const saved = sessionStorage.getItem(ADMIN_SIDEBAR_GROUPS_KEY);
    if (!saved) {
      return new Set(navGroups.map((group) => group.label));
    }

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((label) => typeof label === "string"));
      }
    } catch {
      sessionStorage.removeItem(ADMIN_SIDEBAR_GROUPS_KEY);
    }

    return new Set(navGroups.map((group) => group.label));
  });

  const filteredNavGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return navGroups;

    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${group.label} ${item.label}`.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [searchQuery]);

  const isActive = useCallback((path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  }, [location.pathname]);

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

  useEffect(() => {
    if (!contentRef.current || !activeItemRef.current || isCollapsed) return;

    const frame = window.requestAnimationFrame(() => {
      const container = contentRef.current;
      const activeItem = activeItemRef.current;
      if (!container || !activeItem) return;

      const itemTop = activeItem.offsetTop;
      const itemBottom = itemTop + activeItem.offsetHeight;
      const viewportTop = container.scrollTop;
      const viewportBottom = viewportTop + container.clientHeight;

      if (itemTop < viewportTop || itemBottom > viewportBottom) {
        activeItem.scrollIntoView({ block: "nearest" });
        sessionStorage.setItem(
          ADMIN_SIDEBAR_SCROLL_KEY,
          String(container.scrollTop),
        );
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isCollapsed, location.pathname]);

  useEffect(() => {
    const activeGroup = navGroups.find((group) =>
      group.items.some((item) => isActive(item.to)),
    );

    if (!activeGroup || openGroups.has(activeGroup.label)) return;

    setOpenGroups((current) => {
      const next = new Set(current);
      next.add(activeGroup.label);
      sessionStorage.setItem(
        ADMIN_SIDEBAR_GROUPS_KEY,
        JSON.stringify(Array.from(next)),
      );
      return next;
    });
  }, [isActive, openGroups]);

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

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }

      sessionStorage.setItem(
        ADMIN_SIDEBAR_GROUPS_KEY,
        JSON.stringify(Array.from(next)),
      );
      return next;
    });
  };

  const getGroupId = (label: string) =>
    `admin-sidebar-group-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <Sidebar collapsible="icon" className="border-r border-[#E5EAF1] bg-white">
      <SidebarHeader className="border-b border-[#E5EAF1] bg-white px-3 py-3">
        <Link
          to="/admin"
          onClick={handleNavClick}
          className="flex min-h-14 items-center gap-3 rounded-[16px] bg-white p-2 ring-1 ring-[#E5EAF1] transition-colors hover:bg-[#F6F8FB] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#22C7A1]/12 ring-1 ring-[#22C7A1]/25">
            <Shield className="h-4 w-4 text-[#22C7A1]" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight text-[#020617]">
                Nutrio Admin
              </span>
              <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                Control workspace
              </p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent
        ref={contentRef}
        onScroll={handleSidebarScroll}
        className="bg-white px-2 py-3 [scrollbar-width:thin]"
      >
        {!isCollapsed && (
          <div className="sticky top-0 z-10 bg-white px-1 pb-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search admin pages"
                className="h-10 w-full rounded-[14px] border border-[#E5EAF1] bg-[#F6F8FB] pl-10 pr-3 text-sm font-bold text-[#020617] outline-none transition focus:border-[#22C7A1] focus:bg-white focus:ring-4 focus:ring-[#22C7A1]/15 placeholder:text-[#94A3B8]"
              />
            </label>
          </div>
        )}

        {filteredNavGroups.length === 0 && !isCollapsed && (
          <div className="mx-1 rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-center">
            <p className="text-sm font-black text-[#020617]">
              No admin page found
            </p>
            <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
              Try orders, users, payouts, or analytics.
            </p>
          </div>
        )}

        {filteredNavGroups.map((group) => {
          const hasQuery = searchQuery.trim().length > 0;
          const isGroupOpen =
            hasQuery || openGroups.has(group.label) || isCollapsed;

          return (
            <SidebarGroup key={group.label} className="px-1 py-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                disabled={isCollapsed || hasQuery}
                className={cn(
                  "mb-1 flex h-8 w-full items-center rounded-[10px] px-2 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8] transition-colors hover:bg-[#F6F8FB] hover:text-[#020617]",
                  "group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                )}
                aria-expanded={isGroupOpen}
                aria-controls={getGroupId(group.label)}
              >
                <span
                  className="mr-2 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: group.accent }}
                />
                <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
                  {group.label}
                </span>
                {!isCollapsed && (
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-[#94A3B8] transition-transform",
                      isGroupOpen ? "rotate-0" : "-rotate-90",
                      hasQuery && "opacity-40",
                    )}
                  />
                )}
              </button>
              {isGroupOpen && (
                <SidebarGroupContent id={getGroupId(group.label)}>
                  <SidebarMenu className="gap-1.5">
                    {group.items.map((item) => {
                      const active = isActive(item.to);
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.label}
                            className={cn(
                              "group/nav relative h-10 rounded-[12px] px-2.5 text-sm font-black text-[#94A3B8] transition-all hover:bg-[#F6F8FB] hover:text-[#020617]",
                              "data-[active=true]:border data-[active=true]:border-[#22C7A1]/35 data-[active=true]:bg-[#22C7A1]/10 data-[active=true]:text-[#020617]",
                              "data-[active=true]:after:absolute data-[active=true]:after:inset-y-2.5 data-[active=true]:after:left-0 data-[active=true]:after:w-1 data-[active=true]:after:rounded-full data-[active=true]:after:bg-[#22C7A1]",
                            )}
                          >
                            <Link
                              ref={active ? activeItemRef : undefined}
                              to={item.to}
                              aria-current={active ? "page" : undefined}
                              onClick={handleNavClick}
                            >
                              <span
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-white text-[#020617] ring-1 ring-[#E5EAF1] transition-colors group-data-[active=true]/nav:bg-white group-data-[active=true]/nav:ring-[#22C7A1]/30"
                                style={{
                                  color: active ? "#22C7A1" : group.accent,
                                }}
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
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-[#E5EAF1] bg-white p-3">
        {!isCollapsed && (
          <div className="mb-3 rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#22C7A1]" />
              <p className="text-xs font-black text-[#020617]">
                Today workspace
              </p>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-[#94A3B8]">
              Review queues, finance, and platform health.
            </p>
          </div>
        )}
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="View as Customer"
              className="h-10 rounded-[12px] px-2.5 font-black text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
            >
              <Link to="/dashboard" onClick={handleNavClick}>
                <Users className="h-4 w-4 text-[#7C83F6]" />
                <span>View as Customer</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Open Fleet Portal"
              className="h-10 rounded-[12px] px-2.5 font-black text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
            >
              <Link
                to="/fleet"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleNavClick}
              >
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
              className="h-10 rounded-[12px] px-2.5 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
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
