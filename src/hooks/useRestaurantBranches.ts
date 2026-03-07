import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  findNearestBranch, 
  type BranchLocation, 
  type NearestBranchResult,
  calculateDistance,
  formatDistance,
  formatDeliveryTime,
  isWithinDeliveryRange
} from '@/lib/distance';

export interface RestaurantBranch {
  id: string;
  restaurant_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UseRestaurantBranchesOptions {
  restaurantId?: string;
  userLat?: number;
  userLon?: number;
  maxDistance?: number; // km
}

export const useRestaurantBranches = (options: UseRestaurantBranchesOptions = {}) => {
  const { restaurantId, userLat, userLon, maxDistance = 10 } = options;
  
  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setLoading(true);
        
        let query = supabase
          .from('restaurant_branches')
          .select('*')
          .eq('is_active', true);

        if (restaurantId) {
          query = query.eq('restaurant_id', restaurantId);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setBranches(data || []);
      } catch (err) {
        console.error('Error fetching restaurant branches:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, [restaurantId]);

  // Convert to BranchLocation format for distance calculations
  const branchLocations: BranchLocation[] = useMemo(() => {
    return branches.map(b => ({
      id: b.id,
      name: b.name,
      latitude: Number(b.latitude),
      longitude: Number(b.longitude),
      address: b.address || undefined,
      phone_number: b.phone_number || undefined,
    }));
  }, [branches]);

  // Find nearest branch to user
  const nearestBranch: NearestBranchResult | null = useMemo(() => {
    if (!userLat || !userLon || branchLocations.length === 0) {
      return null;
    }
    return findNearestBranch(userLat, userLon, branchLocations);
  }, [userLat, userLon, branchLocations]);

  // Check if within delivery range
  const canDeliver = useMemo(() => {
    if (!nearestBranch) return false;
    return isWithinDeliveryRange(nearestBranch.distance, maxDistance);
  }, [nearestBranch, maxDistance]);

  // Get all branches sorted by distance from user
  const branchesByDistance = useMemo(() => {
    if (!userLat || !userLon || branchLocations.length === 0) {
      return branches.map(b => ({ branch: b, distance: 0 }));
    }

    return branchLocations
      .map(branch => ({
        branch,
        distance: calculateDistance(userLat, userLon, branch.latitude, branch.longitude),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [userLat, userLon, branches, branchLocations]);

  return {
    branches,
    branchLocations,
    loading,
    error,
    nearestBranch,
    canDeliver,
    branchesByDistance,
    formatDistance,
    formatDeliveryTime,
  };
};

/**
 * Hook to find the nearest branch for a specific restaurant given user location
 */
export const useNearestBranch = (
  restaurantId: string | undefined,
  userLat: number | undefined,
  userLon: number | undefined
) => {
  const { branches, loading, error, nearestBranch, canDeliver, formatDistance, formatDeliveryTime } = 
    useRestaurantBranches({ 
      restaurantId, 
      userLat, 
      userLon 
    });

  return {
    branches,
    loading,
    error,
    nearestBranch,
    canDeliver,
    formatDistance,
    formatDeliveryTime,
  };
};

/**
 * Hook for selecting the best branch when ordering from multiple restaurants
 */
export const useMultiRestaurantRoute = (
  restaurantIds: string[],
  userLat: number | undefined,
  userLon: number | undefined
) => {
  const [allBranches, setAllBranches] = useState<RestaurantBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllBranches = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('restaurant_branches')
          .select('*')
          .eq('is_active', true)
          .in('restaurant_id', restaurantIds);

        if (error) throw error;
        setAllBranches(data || []);
      } catch (err) {
        console.error('Error fetching branches:', err);
      } finally {
        setLoading(false);
      }
    };

    if (restaurantIds.length > 0 && userLat && userLon) {
      fetchAllBranches();
    }
  }, [restaurantIds.join(','), userLat, userLon]);

  // Group branches by restaurant and find nearest for each
  const optimalRoute = useMemo(() => {
    if (!userLat || !userLon || allBranches.length === 0) return null;

    const branchesByRestaurant = new Map<string, BranchLocation[]>();
    
    for (const branch of allBranches) {
      const existing = branchesByRestaurant.get(branch.restaurant_id) || [];
      existing.push({
        id: branch.id,
        name: branch.name,
        latitude: Number(branch.latitude),
        longitude: Number(branch.longitude),
        address: branch.address || undefined,
        phone_number: branch.phone_number || undefined,
      });
      branchesByRestaurant.set(branch.restaurant_id, existing);
    }

    // Find nearest branch for each restaurant
    const route: { restaurantId: string; branch: BranchLocation; distance: number }[] = [];
    
    for (const [restaurantId, branches] of branchesByRestaurant) {
      const nearest = findNearestBranch(userLat, userLon, branches);
      if (nearest) {
        route.push({
          restaurantId,
          branch: nearest.branch,
          distance: nearest.distance,
        });
      }
    }

    // Sort by distance for optimal driver route
    route.sort((a, b) => a.distance - b.distance);

    return route;
  }, [allBranches, userLat, userLon]);

  return {
    allBranches,
    loading,
    optimalRoute,
    formatDistance,
  };
};
