/* eslint-disable react-refresh/only-export-components */
import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  | "gym_owner"
  | "fleet_manager"
  | "coach";

const ROLE_ALIASES: Partial<Record<UserRole, UserRole[]>> = {
  user: ["customer"],
  customer: ["user"],
  restaurant: ["partner"],
  partner: ["restaurant"],
};

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole | UserRole[];
  requireApproval?: boolean; // For partner routes
  fallback?: ReactNode;
}

// Cache for role checks to prevent repeated DB queries
const roleCache = new Map<string, { roles: UserRole[]; timestamp: number }>();
const partnerApprovalCache = new Map<
  string,
  { approved: boolean; timestamp: number }
>();
const CACHE_TTL = 60 * 1000; // 60 seconds

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
 * Gets user roles from cache or database
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const cached = getCachedUserRoles(userId);
  if (cached) return cached;

  const roleSources: Array<Promise<UserRole[]>> = [
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.role)
        .filter(Boolean);
    })(),
    (async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? ["driver"] : [];
    })(),
    (async () => {
      const { data, error } = await supabase
        .from("fleet_managers")
        .select("id")
        .eq("auth_user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data ? ["fleet_manager"] : [];
    })(),
  ];

  const results = await Promise.allSettled(roleSources);
  const successfulResults = results.filter(
    (result): result is PromiseFulfilledResult<UserRole[]> =>
      result.status === "fulfilled",
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.warn("[ProtectedRoute] role source query failed:", result.reason);
    }
  });

  if (successfulResults.length === 0) {
    throw new Error("All role source queries failed");
  }

  const roles = Array.from(
    new Set(successfulResults.flatMap((result) => result.value)),
  );
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

  if (userRoles.includes("admin")) return true;

  return required.some(
    (role) =>
      userRoles.includes(role) ||
      (ROLE_ALIASES[role] ?? []).some((alias) => userRoles.includes(alias)),
  );
}

/**
 * Checks if partner is approved
 */
async function isPartnerApproved(userId: string): Promise<boolean> {
  const cached = getCachedPartnerApproval(userId);
  if (cached !== null) return cached;

  try {
    const { data: restaurant, error } = await supabase
      .from("restaurants")
      .select("approval_status")
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;

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
  const requiredRolesKey = requiredRole
    ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole]).join("|")
    : "";
  const authorizationKey =
    user && requiredRole
      ? `${user.id}:${requiredRolesKey}:${requireApproval}`
      : null;
  const hasResolvedCache = Boolean(
    cachedRoles && (!requireApproval || cachedApproval !== null),
  );

  const [checkingRole, setCheckingRole] = useState(
    Boolean(authorizationKey && !hasResolvedCache),
  );
  const [checkedAuthorizationKey, setCheckedAuthorizationKey] = useState<
    string | null
  >(hasResolvedCache ? authorizationKey : null);
  const [hasRole, setHasRole] = useState(cachedHasRole);
  const [isApproved, setIsApproved] = useState(
    requireApproval ? (cachedApproval ?? false) : true,
  );
  const [userRoles, setUserRoles] = useState<UserRole[]>(cachedRoles ?? []);

  useEffect(() => {
    if (authLoading) {
      setCheckingRole(false);
      return;
    }

    if (!user) {
      setCheckingRole(false);
      setCheckedAuthorizationKey(null);
      return;
    }

    const checkRole = async () => {
      setCheckingRole(Boolean(requiredRole));
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
          setIsApproved(approved ?? false);
          setCheckedAuthorizationKey(authorizationKey);
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
          // Empty or unavailable role data must never grant portal access.
          const hasRoleAccess = hasRequiredRole(roles, requiredRole);
          setHasRole(hasRoleAccess);

          if (requireApproval && hasRoleAccess) {
            const approved = await Promise.race([
              isPartnerApproved(user.id),
              new Promise<boolean>((resolve) =>
                setTimeout(() => resolve(false), 4000),
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
        // Fail closed for role- or approval-protected routes.
        setHasRole(!requiredRole);
        setIsApproved(!requireApproval);
        setUserRoles([]);
      } finally {
        setCheckedAuthorizationKey(authorizationKey);
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
  }, [
    user,
    authLoading,
    requiredRole,
    requireApproval,
    authorizationKey,
  ]);

  // Show loading state
  const authorizationPending = Boolean(
    authorizationKey && checkedAuthorizationKey !== authorizationKey,
  );

  if (authLoading || checkingRole || authorizationPending) {
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
