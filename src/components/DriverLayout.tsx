import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Home, Package, Wallet, User, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DriverLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function DriverLayout({ children, title, subtitle }: DriverLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isDriver, setIsDriver] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkDriver();
    }
  }, [user]);

  const checkDriver = async () => {
    if (!user) return;

    try {
      const { data: driver, error } = await supabase
        .from("drivers")
        .select("id, approval_status, is_online")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!driver) {
        toast({
          title: "Access Denied",
          description: "You don't have a driver account",
          variant: "destructive",
        });
        navigate("/driver/auth");
        return;
      }

      if (driver.approval_status !== "approved") {
        toast({
          title: "Account Pending",
          description: "Your driver account is not yet approved",
          variant: "destructive",
        });
        navigate("/driver/onboarding");
        return;
      }

      setDriverId(driver.id);
      setIsOnline(driver.is_online || false);
      setIsDriver(true);
    } catch (error) {
      console.error("Error checking driver:", error);
      navigate("/driver/auth");
    } finally {
      setLoading(false);
    }
  };

  const toggleOnlineStatus = async () => {
    if (!driverId) return;

    try {
      const newStatus = !isOnline;
      const { error } = await supabase
        .from("drivers")
        .update({ is_online: newStatus })
        .eq("id", driverId);

      if (error) throw error;

      setIsOnline(newStatus);
      toast({
        title: newStatus ? "You're online!" : "You're offline",
        description: newStatus ? "You'll receive delivery requests" : "You won't receive new orders",
      });
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-4 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isDriver) {
    return null;
  }

  const navItems = [
    { path: "/driver", icon: Home, label: "Home" },
    { path: "/driver/orders", icon: Package, label: "Orders" },
    { path: "/driver/history", icon: History, label: "History" },
    { path: "/driver/earnings", icon: Wallet, label: "Earnings" },
    { path: "/driver/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="px-4 h-14 flex items-center justify-between">
          <div>
            {title && <h1 className="font-semibold">{title}</h1>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          
          {/* Online/Offline Toggle */}
          <button
            onClick={toggleOnlineStatus}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              isOnline
                ? "bg-green-500/10 text-green-600 border border-green-500/20"
                : "bg-muted text-muted-foreground border border-border"
            )}
          >
            <span className={cn(
              "w-2 h-2 rounded-full",
              isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
            )} />
            {isOnline ? "Online" : "Offline"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-bottom-nav">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 px-4 transition-colors",
                  isActive ? "text-green-600" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
