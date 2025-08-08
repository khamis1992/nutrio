import { createSupabaseServerClient } from "./supabase/server";

export async function getSessionUser() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function userHasRole(userId: string, roles: string | string[]) {
  const supabase = createSupabaseServerClient();
  const roleList = Array.isArray(roles) ? roles : [roles];
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) return false;
  const userRoles = new Set((data || []).map((r) => r.role));
  return roleList.some((r) => userRoles.has(r));
}

export async function requireRole(roles: string | string[]) {
  const user = await getSessionUser();
  if (!user) return { allowed: false, reason: "unauthenticated" } as const;
  const ok = await userHasRole(user.id, roles);
  if (!ok) return { allowed: false, reason: "forbidden" } as const;
  return { allowed: true, user } as const;
}


