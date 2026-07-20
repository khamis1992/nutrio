import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
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
import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

type AdminPageConfig = {
  title?: string;
  subtitle?: string;
};

type AdminLayoutContextValue = {
  setPageConfig: (config: AdminPageConfig) => void;
};

const AdminLayoutContext = createContext<AdminLayoutContextValue | null>(null);

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
  "/admin/subscriptions/freezes": "Freeze Management",
  "/admin/retention-analytics": "Retention Analytics",
  "/admin/analytics/retention": "Retention Analytics",
  "/admin/audit/rollovers": "Rollover Audit",
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
      "/admin/subscriptions/freezes",
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
      "/admin/analytics/retention",
      "/admin/audit/rollovers",
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
  const shell = useContext(AdminLayoutContext);

  useEffect(() => {
    if (!shell) return;
    shell.setPageConfig({ title, subtitle });
  }, [shell, subtitle, title]);

  if (shell) {
    return <>{children}</>;
  }

  return (
    <AdminChrome title={title} subtitle={subtitle}>
      {children}
    </AdminChrome>
  );
}

export function AdminPortalShell() {
  const [pageConfig, setPageConfig] = useState<AdminPageConfig>({});
  const contextValue = useMemo(() => ({ setPageConfig }), []);
  const location = useLocation();

  useEffect(() => {
    setPageConfig({});
  }, [location.pathname]);

  return (
    <AdminLayoutContext.Provider value={contextValue}>
      <AdminChrome title={pageConfig.title} subtitle={pageConfig.subtitle}>
        <Outlet />
      </AdminChrome>
    </AdminLayoutContext.Provider>
  );
}

function AdminChrome({ children, title, subtitle }: AdminLayoutProps) {
  const location = useLocation();
  const pageTitle = title || getAdminPageTitle(location.pathname);
  const activeWorkflow =
    ADMIN_WORKFLOWS.find((workflow) =>
      isWorkflowActive(location.pathname, workflow.match),
    ) ?? ADMIN_WORKFLOWS[0];

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => {
      document.body.classList.remove("admin-mode");
    };
  }, []);

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
