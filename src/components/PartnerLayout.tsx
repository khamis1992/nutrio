import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Store, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnerSidebar } from "@/components/PartnerSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface PartnerLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PartnerLayout({ children, title = "Partner", subtitle, action }: PartnerLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    if (user) {
      checkPartner();
    }
  }, [user]);

  const checkPartner = async () => {
    if (!user) return;

    try {
      // Check if user has partner role or owns a restaurant
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["restaurant", "partner"])
        .maybeSingle();

      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!roleData && !restaurantData) {
        toast({
          title: "Access Denied",
          description: "You don't have partner privileges",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsPartner(true);
    } catch (error) {
      console.error("Error checking partner:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

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

  if (!isPartner) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PartnerSidebar />
        
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
                        <Link to="/partner" className="flex items-center gap-1">
                          <Home className="w-3.5 h-3.5" />
                          <span>Partner</span>
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {location.pathname !== "/partner" && (
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
              {action && <div className="ml-auto">{action}</div>}
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
