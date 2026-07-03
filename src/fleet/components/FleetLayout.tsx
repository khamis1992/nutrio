import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  MapPin, 
  Wallet,
  Menu,
  LogOut,
  SendHorizonal,
  BarChart2,
  CreditCard,
} from "lucide-react";
import { CityProvider } from "@/fleet/context/CityContext";
import { TrackingProvider } from "@/fleet/context/TrackingContext";
import { useFleetManager } from "@/fleet/components/ProtectedFleetRoute";
import { useUnassignedOrderCount } from "@/fleet/hooks/useUnassignedOrderCount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

function FleetSidebar({ mobile = false, onClose, onLogout }: { mobile?: boolean; onClose?: () => void; onLogout?: () => void }) {
  const fleetManager = useFleetManager();
  const unassignedCount = useUnassignedOrderCount();

  const navItems = [
    { to: "/fleet", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/fleet/dispatch", icon: SendHorizonal, label: "Dispatch" },
    { to: "/fleet/drivers", icon: Users, label: "Drivers" },
    { to: "/fleet/vehicles", icon: Truck, label: "Vehicles" },
    { to: "/fleet/tracking", icon: MapPin, label: "Live Tracking" },
    { to: "/fleet/payouts", icon: CreditCard, label: "Payouts" },
    { to: "/fleet/analytics", icon: BarChart2, label: "Analytics" },
  ];

  return (
    <div className={`${mobile ? '' : 'w-64'} flex h-full min-h-0 flex-col border-r bg-background`}>
      {/* Logo */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">Fleet</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const hasAlert = item.to === "/fleet/dispatch" && unassignedCount > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                ${isActive
                  ? "bg-primary text-primary-foreground"
                  : hasAlert
                  ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {hasAlert && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unassignedCount > 9 ? "9+" : unassignedCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="shrink-0 border-t p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="font-semibold text-primary">
              {fleetManager?.fullName?.charAt(0).toUpperCase() || 'F'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {fleetManager?.fullName || 'Fleet Manager'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {fleetManager?.email || ''}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function FleetLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out successfully" });
    navigate("/fleet/login");
  };

  return (
    <TrackingProvider>
    <CityProvider>
      <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden h-full shrink-0 lg:block">
          <FleetSidebar onLogout={handleLogout} />
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-64">
              <FleetSidebar mobile onClose={() => setMobileMenuOpen(false)} onLogout={handleLogout} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-40 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between h-14 px-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="font-semibold lg:hidden">Fleet Management</h1>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </header>

          {/* Page Content */}
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 overscroll-contain lg:p-6 [-webkit-overflow-scrolling:touch]">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </CityProvider>
    </TrackingProvider>
  );
}
