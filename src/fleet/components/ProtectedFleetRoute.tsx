import { ReactNode, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FleetManager {
  id: string;
  fullName: string;
  email: string;
  role: 'super_admin' | 'fleet_manager';
  isActive: boolean;
  assignedCityIds: string[];
  country?: string;
}

interface ProtectedFleetRouteProps {
  children?: ReactNode;
}

// Cache for fleet manager data
const fleetManagerCache = new Map<string, { data: FleetManager; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getFleetManager(userId: string): Promise<FleetManager | null> {
  const cached = fleetManagerCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from("fleet_managers")
      .select("id, full_name, email, role, is_active, assigned_city_ids, country")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const fleetManager: FleetManager = {
      id: data.id,
      fullName: data.full_name || 'Fleet Manager',
      email: data.email || '',
      role: data.role as 'super_admin' | 'fleet_manager',
      isActive: data.is_active ?? false,
      assignedCityIds: data.assigned_city_ids || [],
      country: data.country || undefined,
    };

    fleetManagerCache.set(userId, { data: fleetManager, timestamp: Date.now() });
    return fleetManager;
  } catch (error) {
    console.error("Error fetching fleet manager:", error);
    return null;
  }
}

export function ProtectedFleetRoute({ children }: ProtectedFleetRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [fleetManager, setFleetManager] = useState<FleetManager | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCheckingRole(false);
      return;
    }

    const checkRole = async () => {
      try {
        const fm = await getFleetManager(user.id);
        
        if (!fm) {
          toast({
            title: "Access Denied",
            description: "You don't have fleet manager access",
            variant: "destructive",
          });
          setIsAuthorized(false);
        } else if (!fm.isActive) {
          toast({
            title: "Account Deactivated",
            description: "Your fleet manager account has been deactivated",
            variant: "destructive",
          });
          setIsAuthorized(false);
        } else {
          setFleetManager(fm);
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error("Fleet role check error:", error);
        setIsAuthorized(false);
      } finally {
        setCheckingRole(false);
      }
    };

    checkRole();
  }, [user, authLoading]);

  // Show loading state
  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated - redirect to fleet login
  if (!user) {
    return <Navigate to="/fleet/login" state={{ from: location }} replace />;
  }

  // Not authorized as fleet manager
  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render children or outlet
  return (
    <FleetContext.Provider value={{ fleetManager }}>
      {children || <Outlet />}
    </FleetContext.Provider>
  );
}

// Context to provide fleet manager data to child components
import { createContext, useContext } from "react";

interface FleetContextType {
  fleetManager: FleetManager | null;
}

const FleetContext = createContext<FleetContextType | null>(null);

export function useFleetContext() {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error("useFleetContext must be used within a ProtectedFleetRoute");
  }
  return context;
}

export function useFleetManager() {
  const { fleetManager } = useFleetContext();
  return fleetManager;
}

// Helper to check if user has super admin access
export function useIsSuperAdmin() {
  const fleetManager = useFleetManager();
  return fleetManager?.role === 'super_admin';
}

// Helper to check if user has access to a specific city
export function useHasCityAccess(cityId: string) {
  const fleetManager = useFleetManager();
  if (!fleetManager) return false;
  if (fleetManager.role === 'super_admin') return true;
  return fleetManager.assignedCityIds.includes(cityId);
}
