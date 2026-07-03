import { ReactNode, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { Home } from "lucide-react";
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

export function AdminLayout({
  children,
  title = "Admin",
  subtitle,
}: AdminLayoutProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
      console.warn("[AdminLayout] Admin check timed out — denying access");
      setIsAdmin(false);
      setLoading(false);
    }, 5000);

    checkAdmin().finally(() => {
      clearTimeout(checkTimeout);
    });
  }, [checkAdmin, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="w-full px-4 py-6 space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    // Never return null — that produces a blank screen.
    // Navigate declaratively so React always renders a meaningful route.
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[#F6F8FB] text-[#020617]">
        <AdminSidebar />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-50 border-b border-[#E5EAF1] bg-white/95 backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center gap-3 px-4 py-3 sm:px-6">
              <SidebarTrigger className="h-10 w-10 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] hover:bg-white" />
              <div className="min-w-0 flex flex-col gap-1">
                <Breadcrumb className="mb-0.5">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link
                          to="/admin"
                          className="flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-[#020617]"
                        >
                          <Home className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {location.pathname !== "/admin" && (
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
          </header>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            <div className="w-full min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
