import { supabase } from "@/integrations/supabase/client";
import type {
  FleetLoginRequest,
  FleetLoginResponse,
  FleetManagerRole,
} from "@/fleet/types/fleet";

const isFleetManagerRole = (role: string): role is FleetManagerRole =>
  role === "super_admin" || role === "fleet_manager";

export async function loginFleetManager(
  credentials: FleetLoginRequest,
): Promise<FleetLoginResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw error;
  if (!data.user) throw new Error("Login failed");

  const { data: manager, error: managerError } = await supabase
    .from("fleet_managers")
    .select("id, email, full_name, role, assigned_city_ids, is_active")
    .eq("auth_user_id", data.user.id)
    .eq("is_active", true)
    .single();

  if (managerError || !manager) {
    await supabase.auth.signOut();
    throw new Error("Access denied: Not a fleet manager");
  }

  if (!isFleetManagerRole(manager.role)) {
    await supabase.auth.signOut();
    throw new Error("Access denied: Invalid fleet role");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session?.access_token) throw new Error("Failed to get access token");

  return {
    token: session.access_token,
    refreshToken: session.refresh_token || "",
    user: {
      id: manager.id,
      email: manager.email || credentials.email,
      fullName: manager.full_name || "Fleet Manager",
      role: manager.role,
      assignedCities: manager.assigned_city_ids || [],
    },
  };
}

export async function logoutFleetManager(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function refreshFleetToken(
  refreshToken: string,
): Promise<{ token: string; refreshToken: string }> {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) throw error;
  if (!data.session) throw new Error("Failed to refresh token");

  return {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token || "",
  };
}
