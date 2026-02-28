import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Define user roles
export type UserRole = 
  | "customer" 
  | "restaurant" 
  | "partner" 
  | "driver" 
  | "admin" 
  | "staff";

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 1,
  restaurant: 2,
  partner: 2, // Partner and restaurant are equivalent
  driver: 2,
  staff: 3,
  admin: 4,
};

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole | UserRole[];
  requireApproval?: boolean; // For partner routes
  fallback?: ReactNode;
}

// Cache for role checks to prevent repeated DB queries
const roleCache = new Map<string, { roles: UserRole[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Gets user roles from cache or database
 */
async function getUserRoles(userId: string): Promise<UserRole[]> {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.roles;
  }

  const roles: UserRole[] = [];

  try {
    // Check user_roles table
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleData) {
      roleData.forEach((r) => {
        if (r.role && !roles.includes(r.role as UserRole)) {
          roles.push(r.role as UserRole);
        }
      });
    }

    // Check if user owns a restaurant (partner)
    const { data: restaurantData } = await supabase
      .from("restaurants")
      .select("id, approval_status")
      .eq("owner_id", userId)
      .maybeSingle();

    if (restaurantData) {
      if (!roles.includes("partner")) {
        roles.push("partner");
      }
      if (!roles.includes("restaurant")) {
        roles.push("restaurant");
      }
    }

    // Check if user is a driver
    const { data: driverData } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (driverData && !roles.includes("driver")) {
      roles.push("driver");
    }

    // Cache the result
    roleCache.set(userId, { roles, timestamp: Date.now() });

    return roles;
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return roles;
  }
}

/**
 * Checks if user has required role
 */
function hasRequiredRole(
  userRoles: UserRole[],
  requiredRole: UserRole | UserRole[]
): boolean {
  const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  
  return required.some((role) => {
    // Direct match
    if (userRoles.includes(role)) return true;
    
    // Check hierarchy (higher roles can access lower role routes)
    const requiredLevel = ROLE_HIERARCHY[role];
    return userRoles.some(
      (userRole) => ROLE_HIERARCHY[userRole] >= requiredLevel
    );
  });
}

/**
 * Checks if partner is approved
 */
async function isPartnerApproved(userId: string): Promise<boolean> {
  try {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("approval_status")
      .eq("owner_id", userId)
      .maybeSingle();

    return restaurant?.approval_status === "approved";
  } catch (error) {
    console.error("Error checking partner approval:", error);
    return false;
  }
}

export const ProtectedRoute = ({
  children,
  requiredRole,
  requireApproval = false,
  fallback,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [checkingRole, setCheckingRole] = useState(true);
  const [hasRole, setHasRole] = useState(false);
  const [isApproved, setIsApproved] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCheckingRole(false);
      return;
    }

    const checkRole = async () => {
      try {
        // Get user roles
        const roles = await getUserRoles(user.id);
        setUserRoles(roles);

        // Check if user has required role
        if (requiredRole) {
          const hasRoleAccess = hasRequiredRole(roles, requiredRole);
          setHasRole(hasRoleAccess);

          // If partner route, check approval status
          if (requireApproval && hasRoleAccess) {
            const approved = await isPartnerApproved(user.id);
            setIsApproved(approved);
          }
        } else {
          // No specific role required, just need to be authenticated
          setHasRole(true);
        }
      } catch (error) {
        console.error("Role check error:", error);
        setHasRole(false);
      } finally {
        setCheckingRole(false);
      }
    };

    checkRole();
  }, [user, authLoading, requiredRole, requireApproval]);

  // Show loading state
  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Role check failed
  if (requiredRole && !hasRole) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Redirect based on user's actual role
    if (userRoles.includes("admin")) {
      return <Navigate to="/admin" replace />;
    } else if (userRoles.includes("partner") || userRoles.includes("restaurant")) {
      return <Navigate to="/partner" replace />;
    } else if (userRoles.includes("driver")) {
      return <Navigate to="/driver" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Partner approval check failed
  if (requireApproval && !isApproved) {
    return <Navigate to="/partner/pending-approval" replace />;
  }

  return <>{children}</>;
};

// Hook to get current user roles (for use in components)
export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    getUserRoles(user.id).then((userRoles) => {
      setRoles(userRoles);
      setLoading(false);
    });
  }, [user]);

  return { roles, loading };
}

// Helper to check if user has specific role
export function useHasRole(requiredRole: UserRole | UserRole[]) {
  const { roles, loading } = useUserRoles();
  
  if (loading) return { hasRole: false, loading: true };
  
  return { 
    hasRole: hasRequiredRole(roles, requiredRole), 
    loading: false 
  };
}
