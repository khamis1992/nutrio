import { createSupabaseBrowserClient } from './supabase/client';
import { createSupabaseServerClient } from './supabase/server';
import { UserRole } from '@/types';

export async function getCurrentUser() {
  const supabase = createSupabaseBrowserClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  // Get user roles
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  return {
    ...user,
    roles: roles?.map(r => r.role) || []
  };
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const supabase = createSupabaseBrowserClient();
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true);

  return roles?.map(r => r.role) || [];
}

export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(role);
}

export async function signIn(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();
  return await supabase.auth.signOut();
}

export async function signUp(email: string, password: string, role: UserRole = 'customer') {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error || !data.user) {
    return { data, error };
  }

  // Add user role
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: data.user.id,
      role,
      is_active: true
    });

  return { data, error: roleError };
}
