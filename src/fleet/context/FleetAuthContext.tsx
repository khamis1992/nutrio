import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loginFleetManager, logoutFleetManager, refreshFleetToken } from '@/fleet/services/fleetApi';
import type { FleetLoginResponse, FleetManagerRole } from '@/fleet/types/fleet';
import { toast } from 'sonner';

interface FleetAuthContextType {
  user: FleetLoginResponse['user'] | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasCityAccess: (cityId: string) => boolean;
}

const FleetAuthContext = createContext<FleetAuthContextType | undefined>(undefined);

export function FleetAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FleetLoginResponse['user'] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    try {
      await logoutFleetManager();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      navigate('/fleet/login');
    }
  }, [navigate]);

  useEffect(() => {
    const trySilentRefresh = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const { data: managerData, error: managerError } = await supabase
            .from('fleet_managers')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .eq('is_active', true)
            .single();

          if (!managerError && managerData) {
            setToken(session.access_token);
            setRefreshToken(session.refresh_token);
            setUser({
              id: managerData.id,
              email: managerData.email,
              fullName: managerData.full_name,
              role: managerData.role,
              assignedCities: managerData.assigned_city_ids || [],
            });
          }
        }
      } catch (err) {
        console.error('Silent fleet auth refresh failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    trySilentRefresh();
  }, []);

  useEffect(() => {
    if (!refreshToken) return;

    const refreshInterval = setInterval(async () => {
      try {
        const { token: newToken, refreshToken: newRefreshToken } = await refreshFleetToken(refreshToken);
        setToken(newToken);
        setRefreshToken(newRefreshToken);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        logout();
      }
    }, 55 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [refreshToken, logout]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await loginFleetManager({ email, password });

      setUser(response.user);
      setToken(response.token);
      setRefreshToken(response.refreshToken);

      toast.success(`Welcome back, ${response.user.fullName}`);

      navigate('/fleet');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error instanceof Error ? error.message : 'Invalid credentials');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const hasCityAccess = useCallback((cityId: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return user.assignedCities.includes(cityId);
  }, [user]);

  const value: FleetAuthContextType = {
    user,
    token,
    refreshToken,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    hasCityAccess,
  };

  return (
    <FleetAuthContext.Provider value={value}>
      {children}
    </FleetAuthContext.Provider>
  );
}

export function useFleetAuth() {
  const context = useContext(FleetAuthContext);
  if (context === undefined) {
    throw new Error('useFleetAuth must be used within a FleetAuthProvider');
  }
  return context;
}

export function useRequireFleetAuth(requiredRole?: FleetManagerRole) {
  const { user, isAuthenticated, isLoading } = useFleetAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast.error('Please login to access the fleet management portal');
      navigate('/fleet/login');
    }

    if (requiredRole && user && user.role !== requiredRole && user.role !== 'super_admin') {
      toast.error('You do not have permission to access this resource');
      navigate('/fleet');
    }
  }, [isAuthenticated, isLoading, navigate, requiredRole, user]);

  return { user, isAuthenticated, isLoading };
}