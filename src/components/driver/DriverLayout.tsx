import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  History, 
  User, 
  Power,
  MapPin,
  Loader2,
  Package,
  Wallet
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { driverGoOnline, driverGoOffline, updateDriverLocation } from "@/integrations/supabase/delivery";

interface DriverLayoutContext {
  driver: any;
  isOnline: boolean;
}

export function DriverLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const locationInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchDriverProfile();
  }, [user]);

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
    };
  }, []);

  const fetchDriverProfile = async () => {
    if (!user) {
      navigate("/driver/login");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) {
        if (error.code === "PGRST116") {
          // Driver not found, redirect to registration
          navigate("/driver/register");
          return;
        }
        throw error;
      }
      
      setDriver(data);
      setIsOnline(data.is_online);
      
      // If driver is online, start location tracking
      if (data.is_online) {
        startLocationTracking(data.id);
      }
    } catch (err) {
      console.error("Error fetching driver:", err);
      toast({
        title: "Error",
        description: "Could not load driver profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = useCallback((driverId: string) => {
    // Update location immediately
    updateCurrentLocation(driverId);
    
    // Then every 10 seconds
    locationInterval.current = setInterval(() => {
      updateCurrentLocation(driverId);
    }, 10000);
  }, []);

  const stopLocationTracking = useCallback(() => {
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
  }, []);

  const updateCurrentLocation = async (driverId: string) => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await updateDriverLocation(
            driverId,
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            },
            position.coords.accuracy,
            position.coords.heading || undefined,
            position.coords.speed ? position.coords.speed * 3.6 : undefined // Convert to km/h
          );
        } catch (err) {
          console.error("Error updating location:", err);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const toggleOnline = async () => {
    if (!driver) return;
    
    setToggling(true);
    try {
      const newStatus = !isOnline;
      
      if (newStatus) {
        await driverGoOnline(driver.id);
        startLocationTracking(driver.id);
        toast({ title: "You are now online", description: "Ready to receive delivery requests" });
      } else {
        await driverGoOffline(driver.id);
        stopLocationTracking();
        toast({ title: "You are now offline" });
      }
      
      setIsOnline(newStatus);
    } catch (err) {
      console.error("Error toggling status:", err);
      toast({
        title: "Error",
        description: "Could not change status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x border-border">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">Nutrio Driver</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400 animate-pulse" : "bg-gray-400"}`} />
              <p className="text-sm opacity-90">
                {isOnline ? "Online & Active" : "Offline"}
              </p>
            </div>
          </div>
          <Button 
            variant={isOnline ? "destructive" : "secondary"}
            size="sm"
            onClick={toggleOnline}
            disabled={toggling}
            className="shadow-lg"
          >
            {toggling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4 mr-1" />
            )}
            {isOnline ? "Offline" : "Online"}
          </Button>
        </div>
        
        {isOnline && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-white/10 rounded-lg p-2">
            <MapPin className="w-4 h-4" />
            <span className="opacity-90">Location sharing active</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet context={{ driver, isOnline } satisfies DriverLayoutContext} />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-background border-t border-border fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
        <div className="flex justify-around p-2">
          <NavButton to="/driver" icon={Home} label="Home" end />
          <NavButton to="/driver/orders" icon={Package} label="Orders" />
          <NavButton to="/driver/history" icon={History} label="History" />
          <NavButton to="/driver/earnings" icon={Wallet} label="Earnings" />
          <NavButton to="/driver/profile" icon={User} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ 
  to, 
  icon: Icon, 
  label,
  end = false
}: { 
  to: string; 
  icon: React.ElementType; 
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `
        flex flex-col items-center p-2 rounded-lg transition-colors
        ${isActive 
          ? "text-primary bg-primary/10" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }
      `}
    >
      <Icon className="w-5 h-5 mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
  );
}

function DriverSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x border-border">
      <header className="bg-primary text-primary-foreground p-4 h-24 animate-pulse" />
      <main className="flex-1 p-4 space-y-4">
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
      </main>
    </div>
  );
}

export type { DriverLayoutContext };
