import { Link, useLocation } from "react-router-dom";
import { Store, UtensilsCrossed, Package, Settings, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: Store, label: "Dashboard", to: "/partner" },
  { icon: UtensilsCrossed, label: "Menu", to: "/partner/menu" },
  { icon: Package, label: "Orders", to: "/partner/orders" },
  { icon: Settings, label: "Settings", to: "/partner/settings" },
];

export function PartnerNavigation() {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  
  const isActive = (path: string) => {
    if (path === "/partner") {
      return location.pathname === "/partner";
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("partner-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link 
              key={item.to}
              to={item.to} 
              className={`flex-col h-auto py-2 flex items-center transition-colors ${
                isActive(item.to) 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          ))}
          <Link 
            to="/notifications" 
            className={`flex-col h-auto py-2 flex items-center transition-colors relative ${
              location.pathname === "/notifications" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-medium min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <span className="text-xs mt-1">Alerts</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
