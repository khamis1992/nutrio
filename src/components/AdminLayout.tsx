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

export function AdminLayout({ children, title = "Admin", subtitle }: AdminLayoutProps) {
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
        <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
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
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
            <div className="px-4 h-14 flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex flex-col gap-1">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/admin" className="flex items-center gap-1">
                          <Home className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {location.pathname !== "/admin" && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>{title}</BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    )}
                  </BreadcrumbList>
                </Breadcrumb>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
