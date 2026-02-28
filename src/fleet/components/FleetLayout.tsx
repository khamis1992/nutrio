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
  LogOut
} from "lucide-react";
import { CityProvider } from "@/fleet/context/CityContext";
import { useFleetManager } from "@/fleet/components/ProtectedFleetRoute";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

function FleetSidebar({ mobile = false, onClose, onLogout }: { mobile?: boolean; onClose?: () => void; onLogout?: () => void }) {
  const fleetManager = useFleetManager();

  const navItems = [
    { to: "/fleet", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/fleet/drivers", icon: Users, label: "Drivers" },
    { to: "/fleet/vehicles", icon: Truck, label: "Vehicles" },
    { to: "/fleet/tracking", icon: MapPin, label: "Live Tracking" },
    { to: "/fleet/payouts", icon: Wallet, label: "Payouts" },
  ];

  return (
    <div className={`${mobile ? '' : 'w-64'} bg-background border-r flex flex-col h-full`}>
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
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
              ${isActive 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }
            `}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t">
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
    <CityProvider>
      <div className="min-h-screen flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
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
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
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
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </CityProvider>
  );
}
