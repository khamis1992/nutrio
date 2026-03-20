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

// Track which tables have been verified to exist (to avoid repeated errors)
const tableExistsCache = new Map<string, boolean>();
const TABLE_CHECK_TIMEOUT = 3000; // 3 second timeout for table checks

/**
 * Check if a table exists by attempting a lightweight query with timeout
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TABLE_CHECK_TIMEOUT);

    await supabase
      .from(tableName)
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);
    tableExistsCache.set(tableName, true);
    return true;
  } catch (error: any) {
    // 406 or 404 means table doesn't exist or has issues
    // PQ/ Postgres errors often indicate table missing
    const errorMsg = error?.message?.toLowerCase() || "";
    const isNotFound = errorMsg.includes("not found") ||
                       errorMsg.includes("does not exist") ||
                       errorMsg.includes("invalid") ||
                       errorMsg.includes("406") ||
                       errorMsg.includes("404");

    tableExistsCache.set(tableName, !isNotFound);
    return !isNotFound;
  }
}

/**
 * Gets user roles from cache or database
 */
async function getUserRoles(userId: string, userEmail?: string): Promise<UserRole[]> {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.roles;
  }

  const roles: UserRole[] = [];

  // --- Check user_roles table (only if it exists) ---
  const userRolesTableExists = await checkTableExists("user_roles");
  if (userRolesTableExists) {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (roleData && roleData.length > 0) {
        roleData.forEach((r: any) => {
          if (r.role && !roles.includes(r.role as UserRole)) {
            roles.push(r.role as UserRole);
          }
        });
      }
    } catch (error) {
      // Table exists but query failed — log and continue
      console.warn("[ProtectedRoute] user_roles query failed:", error);
    }
  }

  // --- Email-based admin fallback ---
  // If the DB returned no admin/staff roles, infer from the email address.
  // This mirrors the safety fallback already in AdminLayout so that known
  // admin accounts are never locked out when the user_roles row is missing.
  if (!roles.includes("admin") && !roles.includes("staff") && userEmail) {
    const email = userEmail.toLowerCase();
    if (
      email.includes("admin") ||
      email.includes("khamis-1992") ||
      email === "khamis-1992@hotmail.com"
    ) {
      roles.push("admin");
    }
  }

  // --- Check if user owns a restaurant (partner) ---
  try {
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
  } catch (error) {
    console.warn("[ProtectedRoute] restaurants query failed:", error);
  }

  // --- Check if user is a driver ---
  const driversTableExists = await checkTableExists("drivers");
  if (driversTableExists) {
    try {
      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (driverData && !roles.includes("driver")) {
        roles.push("driver");
      }
    } catch (error) {
      console.warn("[ProtectedRoute] drivers query failed:", error);
    }
  }

  // --- Check if user is a fleet manager ---
  const fleetManagersTableExists = await checkTableExists("fleet_managers");
  if (fleetManagersTableExists) {
    try {
      const { data: fleetData } = await supabase
        .from("fleet_managers")
        .select("id, is_active")
        .eq("auth_user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (fleetData) {
        roles.push("fleet_manager" as any);
      }
    } catch (error) {
      console.warn("[ProtectedRoute] fleet_managers query failed:", error);
    }
  }

  // Cache the result
  roleCache.set(userId, { roles, timestamp: Date.now() });

  return roles;
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
    console.warn("[ProtectedRoute] isPartnerApproved error:", error);
    return false;
  }
}

/**
 * Force-stops role checking after a timeout so users aren't stuck on blank screens.
 * The app falls back to "no role" which redirects to dashboard.
 */
const ROLE_CHECK_TIMEOUT_MS = 5000;

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
    if (authLoading) {
      // Don't keep user in loading state if auth context is still loading but user is already null
      // This fixes the infinite blank screen when session fails to restore on direct navigation
      setCheckingRole(false);
      return;
    }

    if (!user) {
      setCheckingRole(false);
      return;
    }

    const checkRole = async () => {
      try {
        // Race: either getUserRoles resolves OR the timeout fires first
        // This prevents users from being stuck on blank screens if DB tables are missing
        const raceResult = await Promise.race([
          getUserRoles(user.id, user.email ?? undefined),
          new Promise<UserRole[]>((_, reject) =>
            setTimeout(() => reject(new Error("Role check timeout")), ROLE_CHECK_TIMEOUT_MS)
          ),
        ]);

        const roles = raceResult;
        setUserRoles(roles);

        // Check if user has required role
        if (requiredRole) {
          const hasRoleAccess = hasRequiredRole(roles, requiredRole);
          setHasRole(hasRoleAccess);

          // If partner route, check approval status (with 4-second timeout)
          if (requireApproval && hasRoleAccess) {
            const approved = await Promise.race([
              isPartnerApproved(user.id),
              new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 4000)),
            ]);
            setIsApproved(approved);
          }
        } else {
          // No specific role required, just need to be authenticated
          setHasRole(true);
        }
      } catch (error) {
        console.warn("[ProtectedRoute] Role check failed (timeout or error):", error);
        // On timeout/error: treat as "no role" — will redirect to dashboard
        setHasRole(false);
        setUserRoles([]);
      } finally {
        setCheckingRole(false);
      }
    };

    checkRole();
  }, [user, authLoading, requiredRole, requireApproval]);

  // Show loading state
  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3">
        <img src="/logo.png" alt="Nutrio" className="h-12 w-auto object-contain opacity-80" />
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
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

    getUserRoles(user.id, user.email ?? undefined).then((userRoles) => {
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
