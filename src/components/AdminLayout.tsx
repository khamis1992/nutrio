import { ReactNode, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import {
  Activity,
  BarChart3,
  ExternalLink,
  Home,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

const ADMIN_PAGE_TITLES: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/admin/restaurants": "Restaurant Network",
  "/admin/featured": "Featured Partners",
  "/admin/meal-approvals": "Meal Approvals",
  "/admin/users": "Users",
  "/admin/orders": "Orders",
  "/admin/subscriptions": "Subscription Plans",
  "/admin/analytics": "Platform Analytics",
  "/admin/income": "Income & Profit",
  "/admin/profit": "Income & Profit",
  "/admin/settings": "Platform Settings",
  "/admin/exports": "Exports",
  "/admin/payouts": "Payouts",
  "/admin/customer-wallets": "Customer Wallets",
  "/admin/affiliate-payouts": "Affiliate Payouts",
  "/admin/premium-analytics": "Premium Analytics",
  "/admin/affiliate-applications": "Affiliate Applications",
  "/admin/partner-integrations": "Partner Integrations",
  "/admin/affiliate-milestones": "Affiliate Milestones",
  "/admin/streak-rewards": "Streak Rewards",
  "/admin/community-challenges": "Community Challenges",
  "/admin/diet-tags": "Diet Tags",
  "/admin/promotions": "Promotions",
  "/admin/announcements": "Announcements",
  "/admin/support": "Support",
  "/admin/notifications": "Announcements",
  "/admin/drivers": "Drivers",
  "/admin/deliveries": "Deliveries",
  "/admin/security": "Security Center",
  "/admin/ip-management": "IP Management",
  "/admin/freeze-management": "Freeze Management",
  "/admin/retention-analytics": "Retention Analytics",
  "/admin/coach-applications": "Coach Applications",
  "/admin/coach-commission": "Coach Revenue",
  "/admin/ai-engine": "AI Engine",
};

const ADMIN_WORKFLOWS = [
  {
    label: "Command",
    description: "Dashboard, restaurants, users",
    to: "/admin",
    icon: ShieldCheck,
    match: ["/admin", "/admin/restaurants", "/admin/users", "/admin/drivers"],
    accent: "#22C7A1",
  },
  {
    label: "Operations",
    description: "Orders, meals, delivery",
    to: "/admin/orders",
    icon: ShoppingBag,
    match: [
      "/admin/orders",
      "/admin/meal-approvals",
      "/admin/deliveries",
      "/admin/subscriptions",
      "/admin/freeze-management",
    ],
    accent: "#38BDF8",
  },
  {
    label: "Growth",
    description: "Campaigns and partners",
    to: "/admin/featured",
    icon: Store,
    match: [
      "/admin/featured",
      "/admin/partner-integrations",
      "/admin/affiliate-applications",
      "/admin/affiliate-milestones",
      "/admin/streak-rewards",
      "/admin/community-challenges",
      "/admin/diet-tags",
      "/admin/promotions",
      "/admin/notifications",
    ],
    accent: "#7C83F6",
  },
  {
    label: "Finance",
    description: "Payouts, wallets, profit",
    to: "/admin/profit",
    icon: Wallet,
    match: [
      "/admin/profit",
      "/admin/income",
      "/admin/payouts",
      "/admin/customer-wallets",
      "/admin/affiliate-payouts",
      "/admin/premium-analytics",
      "/admin/coach-commission",
    ],
    accent: "#F97316",
  },
  {
    label: "Insights",
    description: "Analytics and AI",
    to: "/admin/analytics",
    icon: BarChart3,
    match: [
      "/admin/analytics",
      "/admin/retention-analytics",
      "/admin/exports",
      "/admin/ai-engine",
    ],
    accent: "#7C83F6",
  },
  {
    label: "System",
    description: "Support and settings",
    to: "/admin/settings",
    icon: Settings,
    match: [
      "/admin/support",
      "/admin/settings",
      "/admin/security",
      "/admin/ip-management",
      "/admin/coach-applications",
    ],
    accent: "#FB6B7A",
  },
];

function getAdminPageTitle(pathname: string) {
  if (/^\/admin\/restaurants\/[^/]+$/.test(pathname)) {
    return "Restaurant Details";
  }

  const exact = ADMIN_PAGE_TITLES[pathname];
  if (exact) return exact;

  const match = Object.entries(ADMIN_PAGE_TITLES)
    .filter(([path]) => path !== "/admin" && pathname.startsWith(`${path}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];

  return match?.[1] ?? "Admin Dashboard";
}

function isWorkflowActive(pathname: string, matchers: string[]) {
  return matchers.some((path) =>
    path === "/admin" ? pathname === "/admin" : pathname.startsWith(path),
  );
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const pageTitle = title || getAdminPageTitle(location.pathname);
  const activeWorkflow =
    ADMIN_WORKFLOWS.find((workflow) =>
      isWorkflowActive(location.pathname, workflow.match),
    ) ?? ADMIN_WORKFLOWS[0];

  const checkAdmin = useCallback(async () => {
    if (!user) return;

    try {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError) {
        console.warn("[AdminLayout] user_roles query failed:", roleError);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!roleData);
    } catch (error) {
      console.error("Error checking admin:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      // ProtectedRoute already guards this, but guard here too to avoid hanging
      setLoading(false);
      return;
    }

    const checkTimeout = setTimeout(() => {
      console.warn("[AdminLayout] Admin check timed out - denying access");
      setIsAdmin(false);
      setLoading(false);
    }, 5000);

    checkAdmin().finally(() => {
      clearTimeout(checkTimeout);
    });
  }, [checkAdmin, user]);

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => {
      document.body.classList.remove("admin-mode");
    };
  }, []);

  if (loading) {
    return (
      <div className="admin-console flex min-h-screen bg-[#F6F8FB] text-[#020617]">
        <aside className="hidden w-64 shrink-0 border-r border-[#E5EAF1] bg-white p-3 md:block">
          <div className="flex items-center gap-3 rounded-[16px] bg-[#F6F8FB] p-2 ring-1 ring-[#E5EAF1]">
            <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#22C7A1]/10 text-[#22C7A1] ring-1 ring-[#22C7A1]/25">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-28 rounded-full bg-[#E5EAF1]" />
              <Skeleton className="h-2.5 w-36 rounded-full bg-[#E5EAF1]" />
            </div>
          </div>
          <div className="mt-5 space-y-5">
            {["Command", "Operations", "Growth", "Finance", "System"].map(
              (group) => (
                <div key={group} className="space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22C7A1]" />
                    <Skeleton className="h-2.5 w-20 rounded-full bg-[#E5EAF1]" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-11 rounded-[14px] bg-[#F6F8FB]" />
                    <Skeleton className="h-11 rounded-[14px] bg-[#F6F8FB]" />
                  </div>
                </div>
              ),
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[#E5EAF1] bg-white/90 px-4 py-4 shadow-[0_16px_40px_rgba(2,6,23,0.04)] backdrop-blur-xl sm:px-6">
            <div className="flex min-h-[72px] items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-[18px] bg-[#F6F8FB]" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-32 rounded-full bg-[#E5EAF1]" />
                  <Skeleton className="h-7 w-48 rounded-full bg-[#E5EAF1]" />
                </div>
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <Skeleton className="h-11 w-28 rounded-[16px] bg-[#F6F8FB]" />
                <Skeleton className="h-11 w-28 rounded-[16px] bg-[#F6F8FB]" />
                <Skeleton className="h-11 w-11 rounded-[16px] bg-[#E5EAF1]" />
              </div>
            </div>
          </header>

          <main className="admin-main min-w-0 flex-1 p-3 sm:p-6">
            <div className="mx-auto w-full max-w-[1500px] space-y-4">
              <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-[0_18px_44px_rgba(2,6,23,0.06)] sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-3">
                    <Skeleton className="h-3 w-24 rounded-full bg-[#7C83F6]/20" />
                    <Skeleton className="h-8 w-56 rounded-full bg-[#E5EAF1]" />
                    <Skeleton className="h-4 w-72 max-w-full rounded-full bg-[#E5EAF1]" />
                  </div>
                  <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-[#22C7A1]/10 ring-1 ring-[#22C7A1]/20">
                    <Activity className="h-6 w-6 text-[#22C7A1]" />
                  </div>
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {["#22C7A1", "#7C83F6", "#38BDF8", "#FB6B7A"].map(
                  (color, index) => (
                    <div
                      key={color}
                      className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.05)]"
                    >
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-20 rounded-full bg-[#E5EAF1]" />
                        <span
                          className="h-9 w-9 rounded-[14px]"
                          style={{ backgroundColor: `${color}1F` }}
                        />
                      </div>
                      <Skeleton className="mt-5 h-8 w-24 rounded-full bg-[#E5EAF1]" />
                      <Skeleton
                        className="mt-4 h-1.5 rounded-full"
                        style={{
                          backgroundColor: index === 0 ? "#22C7A1" : "#E5EAF1",
                        }}
                      />
                    </div>
                  ),
                )}
              </div>

              <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_18px_44px_rgba(2,6,23,0.06)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28 rounded-full bg-[#E5EAF1]" />
                    <Skeleton className="h-6 w-44 rounded-full bg-[#E5EAF1]" />
                  </div>
                  <Skeleton className="h-11 w-28 rounded-[16px] bg-[#E5EAF1]" />
                </div>
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4].map((row) => (
                    <Skeleton
                      key={row}
                      className="h-14 rounded-[18px] bg-[#F6F8FB]"
                    />
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    // Never return null; that produces a blank screen.
    // Navigate declaratively so React always renders a meaningful route.
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <SidebarProvider>
      <div className="admin-console flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[#F6F8FB] text-[#020617]">
        <AdminSidebar />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-50 border-b border-[#E5EAF1] bg-white/95 shadow-[0_12px_28px_rgba(2,6,23,0.035)] backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center justify-between gap-4 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="h-10 w-10 shrink-0 rounded-[14px] border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] hover:bg-white" />
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#22C7A1]/10 ring-1 ring-[#22C7A1]/25">
                  <activeWorkflow.icon
                    className="h-4 w-4"
                    style={{ color: activeWorkflow.accent }}
                  />
                </div>
                <div className="min-w-0">
                  <Breadcrumb className="mb-0.5">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link
                            to="/admin"
                            className="flex items-center gap-1 text-xs font-black text-[#94A3B8] hover:text-[#020617]"
                          >
                            <Home className="h-3.5 w-3.5" />
                            <span>Admin</span>
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      {location.pathname !== "/admin" && (
                        <>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbPage className="text-xs font-black text-[#94A3B8]">
                              {activeWorkflow.label}
                            </BreadcrumbPage>
                          </BreadcrumbItem>
                        </>
                      )}
                    </BreadcrumbList>
                  </Breadcrumb>
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h1 className="truncate text-xl font-black tracking-tight text-[#020617]">
                      {pageTitle}
                    </h1>
                    {subtitle && (
                      <p className="hidden truncate text-xs font-semibold text-[#94A3B8] xl:block">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                <div className="flex h-10 items-center gap-2 rounded-[14px] border border-[#E5EAF1] bg-[#F6F8FB] px-3">
                  <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
                  <span className="text-xs font-black text-[#020617]">
                    Live workspace
                  </span>
                </div>
                <Link
                  to="/admin/analytics"
                  className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#E5EAF1] bg-white px-3 text-xs font-black text-[#020617] transition-colors hover:bg-[#F6F8FB]"
                >
                  <Activity className="h-4 w-4 text-[#7C83F6]" />
                  Insights
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#E5EAF1] bg-white px-3 text-xs font-black text-[#020617] transition-colors hover:bg-[#F6F8FB]"
                >
                  <Users className="h-4 w-4 text-[#38BDF8]" />
                  Customer view
                </Link>
                <Link
                  to="/fleet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] transition-colors hover:bg-white"
                  aria-label="Open Fleet Portal"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="hidden border-t border-[#E5EAF1] px-5 py-2 xl:block">
              <nav className="flex items-center gap-2 overflow-x-auto">
                {ADMIN_WORKFLOWS.map((workflow) => {
                  const active = workflow.label === activeWorkflow.label;
                  return (
                    <Link
                      key={workflow.label}
                      to={workflow.to}
                      className="group flex min-w-[170px] items-center gap-3 rounded-[14px] border px-3 py-2 transition-colors"
                      style={{
                        borderColor: active
                          ? `${workflow.accent}55`
                          : "#E5EAF1",
                        backgroundColor: active
                          ? `${workflow.accent}12`
                          : "white",
                      }}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]"
                        style={{ color: workflow.accent }}
                      >
                        <workflow.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-[#020617]">
                          {workflow.label}
                        </span>
                        <span className="block truncate text-[11px] font-semibold text-[#94A3B8]">
                          {workflow.description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>

          <main className="admin-main min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-5">
            <div className="mx-auto w-full min-w-0 max-w-[1680px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
