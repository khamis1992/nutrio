import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { loginFleetManager, logoutFleetManager, refreshFleetToken } from '@/fleet/services/fleetApi';
import type { FleetLoginResponse, FleetManagerRole } from '@/fleet/types/fleet';

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

const TOKEN_KEY = 'fleet_token';
const REFRESH_TOKEN_KEY = 'fleet_refresh_token';
const USER_KEY = 'fleet_user';

export function FleetAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FleetLoginResponse['user'] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
        setUser(parsedUser);
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // Token refresh interval
  useEffect(() => {
    if (!refreshToken) return;

    const refreshInterval = setInterval(async () => {
      try {
        const { token: newToken, refreshToken: newRefreshToken } = await refreshFleetToken(refreshToken);
        setToken(newToken);
        setRefreshToken(newRefreshToken);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Token refresh failed, logout user
        await logout();
      }
    }, 55 * 60 * 1000); // Refresh every 55 minutes

    return () => clearInterval(refreshInterval);
  }, [refreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await loginFleetManager({ email, password });
      
      setUser(response.user);
      setToken(response.token);
      setRefreshToken(response.refreshToken);

      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));

      toast({
        title: 'Login Successful',
        description: `Welcome back, ${response.user.fullName}`,
      });

      navigate('/fleet');
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast]);

  const logout = useCallback(async () => {
    try {
      await logoutFleetManager();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      navigate('/fleet/login');
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

// Hook for protected route checks
export function useRequireFleetAuth(requiredRole?: FleetManagerRole) {
  const { user, isAuthenticated, isLoading } = useFleetAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please login to access the fleet management portal',
        variant: 'destructive',
      });
      navigate('/fleet/login');
    }

    if (requiredRole && user && user.role !== requiredRole && user.role !== 'super_admin') {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this resource',
        variant: 'destructive',
      });
      navigate('/fleet');
    }
  }, [isAuthenticated, isLoading, navigate, requiredRole, toast, user]);

  return { user, isAuthenticated, isLoading };
}
