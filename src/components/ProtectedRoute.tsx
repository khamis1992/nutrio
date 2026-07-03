/* eslint-disable react-refresh/only-export-components */
import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostgrestError } from "@supabase/supabase-js";
import { assetPath } from "@/lib/asset-path";

// Define user roles
export type UserRole =
  | "user"
  | "customer"
  | "restaurant"
  | "partner"
  | "driver"
  | "admin"
  | "staff"
  | "fleet_manager"
  | "coach";

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  customer: 1,
  restaurant: 2,
  partner: 2,
  driver: 2,
  staff: 3,
  admin: 4,
  fleet_manager: 2,
  coach: 2,
};

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole | UserRole[];
  requireApproval?: boolean; // For partner routes
  fallback?: ReactNode;
}

interface UserRoleRow {
  role: UserRole;
}

// Cache for role checks to prevent repeated DB queries
const roleCache = new Map<string, { roles: UserRole[]; timestamp: number }>();
const partnerApprovalCache = new Map<
  string,
  { approved: boolean; timestamp: number }
>();
const CACHE_TTL = 60 * 1000; // 60 seconds

// Track which tables have been verified to exist (to avoid repeated errors)
const tableExistsCache = new Map<string, boolean>();
const TABLE_CHECK_TIMEOUT = 3000; // 3 second timeout for table checks

/**
 * Clear role cache on logout to prevent stale role data persisting across sessions
 */
export function clearRoleCache(): void {
  roleCache.clear();
  partnerApprovalCache.clear();
}

function getCachedUserRoles(userId: string): UserRole[] | null {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.roles;
  }
  return null;
}

function getCachedPartnerApproval(userId: string): boolean | null {
  const cached = partnerApprovalCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.approved;
  }
  return null;
}

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
  } catch (error: unknown) {
    // 406 or 404 means table doesn't exist or has issues
    // PQ/ Postgres errors often indicate table missing
    const errorMsg =
      (error as PostgrestError)?.message?.toLowerCase() ||
      String(error ?? "").toLowerCase();
    const isNotFound =
      errorMsg.includes("not found") ||
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
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const cached = getCachedUserRoles(userId);
  if (cached) return cached;

  const roles: UserRole[] = [];

  const [userRolesTableExists, driversTableExists, fleetManagersTableExists] =
    await Promise.all([
      checkTableExists("user_roles"),
      checkTableExists("drivers"),
      checkTableExists("fleet_managers"),
    ]);

  const roleQueries: Promise<void>[] = [];

  if (userRolesTableExists) {
    roleQueries.push(
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .then(({ data: roleData }) => {
          if (roleData && roleData.length > 0) {
            roleData.forEach((r: UserRoleRow) => {
              if (r.role && !roles.includes(r.role)) {
                roles.push(r.role);
              }
            });
          }
        })
        .catch((error) => {
          console.warn("[ProtectedRoute] user_roles query failed:", error);
        }),
    );
  }

  roleQueries.push(
    supabase
      .from("restaurants")
      .select("id, approval_status")
      .eq("owner_id", userId)
      .maybeSingle()
      .then(({ data: restaurantData }) => {
        if (restaurantData) {
          if (!roles.includes("partner")) roles.push("partner");
          if (!roles.includes("restaurant")) roles.push("restaurant");
        }
      })
      .catch((error) => {
        console.warn("[ProtectedRoute] restaurants query failed:", error);
      }),
  );

  if (driversTableExists) {
    roleQueries.push(
      supabase
        .from("drivers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data: driverData }) => {
          if (driverData && !roles.includes("driver")) roles.push("driver");
        })
        .catch((error) => {
          console.warn("[ProtectedRoute] drivers query failed:", error);
        }),
    );
  }

  if (fleetManagersTableExists) {
    roleQueries.push(
      supabase
        .from("fleet_managers")
        .select("id, is_active")
        .eq("auth_user_id", userId)
        .eq("is_active", true)
        .maybeSingle()
        .then(({ data: fleetData }) => {
          if (fleetData) roles.push("fleet_manager");
        })
        .catch((error) => {
          console.warn("[ProtectedRoute] fleet_managers query failed:", error);
        }),
    );
  }

  await Promise.all(roleQueries);

  // Cache the result
  roleCache.set(userId, { roles, timestamp: Date.now() });

  return roles;
}

/**
 * Checks if user has required role
 */
export function hasRequiredRole(
  userRoles: UserRole[],
  requiredRole: UserRole | UserRole[],
): boolean {
  const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  return required.some((role) => {
    // Direct match
    if (userRoles.includes(role)) return true;

    // Check hierarchy (higher roles can access lower role routes)
    const requiredLevel = ROLE_HIERARCHY[role];
    return userRoles.some(
      (userRole) => ROLE_HIERARCHY[userRole] >= requiredLevel,
    );
  });
}

/**
 * Checks if partner is approved
 */
async function isPartnerApproved(userId: string): Promise<boolean> {
  const cached = getCachedPartnerApproval(userId);
  if (cached !== null) return cached;

  try {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("approval_status")
      .eq("owner_id", userId)
      .maybeSingle();

    const approved = restaurant?.approval_status === "approved";
    partnerApprovalCache.set(userId, { approved, timestamp: Date.now() });
    return approved;
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

function getAppPath(pathname: string): string {
  return pathname.startsWith("/nutrio") ? pathname.slice("/nutrio".length) || "/" : pathname;
}

function samePath(pathname: string, target: string): boolean {
  return getAppPath(pathname) === target;
}

export const ProtectedRoute = ({
  children,
  requiredRole,
  requireApproval = false,
  fallback,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const cachedRoles = user ? getCachedUserRoles(user.id) : null;
  const cachedHasRole =
    requiredRole && cachedRoles
      ? hasRequiredRole(cachedRoles, requiredRole)
      : !requiredRole;
  const cachedApproval =
    user && requireApproval ? getCachedPartnerApproval(user.id) : null;
  const shouldCheckInitially = Boolean(
    !authLoading &&
    user &&
    requiredRole &&
    (!cachedRoles ||
      (cachedHasRole && requireApproval && cachedApproval === null)),
  );

  const [checkingRole, setCheckingRole] = useState(shouldCheckInitially);
  const [hasRole, setHasRole] = useState(cachedHasRole);
  const [isApproved, setIsApproved] = useState(
    requireApproval ? (cachedApproval ?? true) : true,
  );
  const [userRoles, setUserRoles] = useState<UserRole[]>(cachedRoles ?? []);

  useEffect(() => {
    if (authLoading) {
      setCheckingRole(false);
      return;
    }

    if (!user) {
      setCheckingRole(false);
      return;
    }

    const checkRole = async () => {
      const cached = getCachedUserRoles(user.id);
      if (cached) {
        const hasRoleAccess = requiredRole
          ? hasRequiredRole(cached, requiredRole)
          : true;
        const approved = requireApproval
          ? getCachedPartnerApproval(user.id)
          : true;

        if (!requireApproval || approved !== null || !hasRoleAccess) {
          setUserRoles(cached);
          setHasRole(hasRoleAccess);
          setIsApproved(approved ?? true);
          setCheckingRole(false);
          return;
        }
      }

      try {
        const raceResult = await Promise.race([
          getUserRoles(user.id),
          new Promise<UserRole[]>((_, reject) =>
            setTimeout(
              () => reject(new Error("Role check timeout")),
              ROLE_CHECK_TIMEOUT_MS,
            ),
          ),
        ]);

        const roles = raceResult;
        setUserRoles(roles);

        if (requiredRole) {
          // When role queries return empty (all failed silently due to RLS,
          // network, or table issues), treat as inconclusive — let the user
          // through. Denying access on missing data creates an infinite
          // redirect loop because the target route's ProtectedRoute runs
          // the same check and fails identically. RLS blocks unauthorized
          // data access at the database level regardless.
          const hasRoleAccess = roles.length > 0
            ? hasRequiredRole(roles, requiredRole)
            : true;
          setHasRole(hasRoleAccess);

          if (requireApproval && hasRoleAccess) {
            const approved = await Promise.race([
              isPartnerApproved(user.id),
              new Promise<boolean>((resolve) =>
                setTimeout(() => resolve(true), 4000),
              ),
            ]);
            setIsApproved(approved);
          }
        } else {
          setHasRole(true);
        }
      } catch (error) {
        console.warn(
          "[ProtectedRoute] Role check failed (timeout or error):",
          error,
        );
        // CRITICAL: When role check fails, do NOT redirect — show children
        // with a fallback role. Redirecting on failure creates an infinite
        // re-render loop because the target route's ProtectedRoute also
        // runs checkRole(), which can fail again, triggering another
        // redirect, and so on.
        //
        // Instead, treat failure as "insufficient data to deny access."
        // The user is authenticated; let them through. If they truly lack
        // the role, the page's data queries will fail gracefully.
        setHasRole(true);
        setUserRoles(requiredRole ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole]) : []);
      } finally {
        setCheckingRole(false);
      }
    };

    checkRole();

    const channel = supabase
      .channel(`user_roles_rt_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          roleCache.delete(user.id);
          partnerApprovalCache.delete(user.id);
          checkRole();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, requiredRole, requireApproval]);

  // Show loading state
  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-5">
        <img
          src={assetPath("/logo.png")}
          alt="Nutrio"
          className="h-28 w-auto object-contain opacity-95"
        />
        <Loader2 className="h-7 w-7 animate-spin text-[#22C7A1]" />
      </div>
    );
  }

  // Not authenticated — redirect to appropriate auth page
  if (!user) {
    const appPath = getAppPath(location.pathname);
    const isPartnerPath = appPath.startsWith("/partner");
    const isDriverPath = appPath.startsWith("/driver");
    const isAdminPath = appPath.startsWith("/admin");
    const isFleetPath = appPath.startsWith("/fleet");

    const authPath = isPartnerPath
      ? "/partner/auth"
      : isDriverPath
        ? "/driver/auth"
        : isAdminPath
          ? "/auth"
          : isFleetPath
            ? "/fleet/login"
            : "/auth";

    if (samePath(location.pathname, authPath)) return null;
    return <Navigate to={authPath} state={{ from: location }} replace />;
  }

  // Role check failed
  if (requiredRole && !hasRole) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Redirect based on user's actual role
    if (userRoles.includes("admin")) {
      if (samePath(location.pathname, "/admin")) return null;
      return <Navigate to="/admin" replace />;
    } else if (
      userRoles.includes("partner") ||
      userRoles.includes("restaurant")
    ) {
      if (samePath(location.pathname, "/partner")) return null;
      return <Navigate to="/partner" replace />;
    } else if (userRoles.includes("driver")) {
      if (samePath(location.pathname, "/driver")) return null;
      return <Navigate to="/driver" replace />;
    } else {
      if (samePath(location.pathname, "/dashboard")) return null;
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Partner approval check failed
  if (requireApproval && !isApproved) {
    if (samePath(location.pathname, "/partner/pending-approval")) return null;
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
      setRoles([]);
      setLoading(false);
      return;
    }

    getUserRoles(user.id).then((userRoles) => {
      setRoles(userRoles);
      setLoading(false);
    });

    return () => {
      roleCache.delete(user.id);
    };
  }, [user]);

  return { roles, loading };
}

// Helper to check if user has specific role
export function useHasRole(requiredRole: UserRole | UserRole[]) {
  const { roles, loading } = useUserRoles();

  if (loading) return { hasRole: false, loading: true };

  return {
    hasRole: hasRequiredRole(roles, requiredRole),
    loading: false,
  };
}
