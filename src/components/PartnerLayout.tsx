import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { Home } from "lucide-react";
import { NewOrderNotificationBanner } from "@/components/partner/NewOrderNotificationBanner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PartnerSidebar } from "@/components/PartnerSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface PartnerLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

type PartnerPageConfig = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

type PartnerLayoutContextValue = {
  setPageConfig: (config: PartnerPageConfig) => void;
};

const defaultPageConfig: PartnerPageConfig = {
  title: "Partner",
};

const PartnerLayoutContext = createContext<PartnerLayoutContextValue | null>(null);

export function PartnerLayout({
  children,
  title = "Partner",
  subtitle,
  action,
}: PartnerLayoutProps) {
  const shell = useContext(PartnerLayoutContext);

  useEffect(() => {
    if (!shell) return;
    shell.setPageConfig({ title, subtitle, action });
  }, [action, shell, subtitle, title]);

  if (shell) {
    return <>{children}</>;
  }

  return (
    <PartnerChrome
      title={title}
      subtitle={subtitle}
      action={action}
    >
      {children}
    </PartnerChrome>
  );
}

export function PartnerPortalShell() {
  const [pageConfig, setPageConfig] = useState<PartnerPageConfig>(defaultPageConfig);
  const contextValue = useMemo(() => ({ setPageConfig }), []);
  const location = useLocation();

  useEffect(() => {
    setPageConfig(defaultPageConfig);
  }, [location.pathname]);

  return (
    <PartnerLayoutContext.Provider value={contextValue}>
      <PartnerChrome
        title={pageConfig.title}
        subtitle={pageConfig.subtitle}
        action={pageConfig.action}
      >
        <Outlet />
      </PartnerChrome>
    </PartnerLayoutContext.Provider>
  );
}

function PartnerChrome({
  children,
  title,
  subtitle,
  action,
}: PartnerLayoutProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.pathname, location.search]);

  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F6F8FB]">
        <PartnerSidebar />

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-50 border-b border-[#E5EAF1] bg-white/95 backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
              <SidebarTrigger className="h-10 w-10 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] hover:bg-white" />
              <div className="min-w-0 flex-1">
                <Breadcrumb className="mb-1">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link
                          to="/partner"
                          className="flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-[#020617]"
                        >
                          <Home className="w-3.5 h-3.5" />
                          <span>Partner</span>
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {location.pathname !== "/partner" && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage className="text-xs font-bold text-[#94A3B8]">
                            {title}
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    )}
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h1 className="truncate text-xl font-black tracking-tight text-[#020617] sm:text-2xl">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="truncate text-xs font-semibold text-[#94A3B8] sm:text-sm">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {action && <div className="ml-auto">{action}</div>}
            </div>
          </header>

          <main
            ref={mainRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6 overscroll-contain"
          >
            <div className="max-w-6xl mx-auto">
              <NewOrderNotificationBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
