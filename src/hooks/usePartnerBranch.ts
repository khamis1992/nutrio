import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  findNearestBranch, 
  type BranchLocation, 
  type NearestBranchResult,
  formatDistance,
  formatDeliveryTime,
  isWithinDeliveryRange,
  calculateDistance
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

/**
 * Partner Hook: Get branches for the logged-in partner restaurant
 * Partners only see their own branches and orders
 */
export const usePartnerBranches = () => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPartnerBranches = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // First get the restaurant owned by this user
        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id')
          .eq('owner_id', user.id)
          .single();

        if (restaurantError) throw restaurantError;
        if (!restaurant) {
          setBranches([]);
          setLoading(false);
          return;
        }

        // Then get branches for that restaurant
        const { data: branchData, error: branchError } = await supabase
          .from('restaurant_branches')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true)
          .order('name');

        if (branchError) throw branchError;
        setBranches(branchData || []);
      } catch (err) {
        console.error('Error fetching partner branches:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPartnerBranches();
  }, [user]);

  // Convert to BranchLocation format
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

  return {
    branches,
    branchLocations,
    loading,
    error,
    formatDistance,
    formatDeliveryTime,
  };
};

/**
 * Partner Hook: Get orders for a specific branch
 * Only shows orders assigned to that branch
 */
export const useBranchOrders = (branchId: string | undefined) => {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBranchOrders = async () => {
      if (!branchId) {
        setOrders([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('orders')
          .select(`
            *,
            restaurant:restaurants(name),
            meals(*)
          `)
          .eq('restaurant_branch_id', branchId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setOrders(data || []);
      } catch (err) {
        console.error('Error fetching branch orders:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchBranchOrders();
  }, [branchId]);

  return { orders, loading, error };
};

/**
 * Fleet Manager Hook: Get orders grouped by branch for driver assignment
 * Shows all branches and their pending orders for efficient driver dispatch
 */
export const useFleetBranchOrders = () => {
  const [branchOrders, setBranchOrders] = useState<{
    branch: RestaurantBranch;
    restaurant: { name: string };
    orders: Record<string, unknown>[];
    totalDistance: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const fetchAllBranchOrders = async () => {
      try {
        // Get all active branches with their restaurants
        const { data: branches, error: branchError } = await supabase
          .from('restaurant_branches')
          .select(`
            *,
            restaurant:restaurants(name)
          `)
          .eq('is_active', true);

        if (branchError) throw branchError;

        // Get all pending/preparing orders
        const { data: orders, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup'])
          .not('restaurant_branch_id', 'is', null);

        if (orderError) throw orderError;

        // Group orders by branch
        const ordersByBranch = new Map<string, Record<string, unknown>[]>();
        for (const order of orders || []) {
          const branchId = order.restaurant_branch_id;
          if (!ordersByBranch.has(branchId)) {
            ordersByBranch.set(branchId, []);
          }
          ordersByBranch.get(branchId)!.push(order);
        }

        // Combine branch data with orders
        const combined = (branches || []).map((branch: RestaurantBranch & { restaurant: { name: string } }) => ({
          branch,
          restaurant: branch.restaurant,
          orders: ordersByBranch.get(branch.id) || [],
          totalDistance: 0, // Will be calculated when driver location is set
        })).filter(item => item.orders.length > 0);

        setBranchOrders(combined);
      } catch (err) {
        console.error('Error fetching fleet branch orders:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllBranchOrders();
  }, []);

  // Update distances when driver location changes
  useEffect(() => {
    if (!driverLocation) return;

    const updated = branchOrders.map(item => {
     
      const distance = calculateDistance(
        driverLocation.lat,
        driverLocation.lng,
        Number(item.branch.latitude),
        Number(item.branch.longitude)
      );
      return { ...item, totalDistance: distance };
    });

    // Sort by distance (nearest first)
    updated.sort((a, b) => a.totalDistance - b.totalDistance);
    setBranchOrders(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation]);

  const updateDriverLocation = (lat: number, lng: number) => {
    setDriverLocation({ lat, lng });
  };

  return {
    branchOrders,
    loading,
    error,
    driverLocation,
    updateDriverLocation,
    formatDistance,
    formatDeliveryTime,
  };
};

/**
 * Hook to auto-select nearest branch when creating an order
 */
export const useAutoBranchSelect = (
  restaurantId: string | undefined,
  customerLat: number | undefined,
  customerLon: number | undefined
) => {
  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<NearestBranchResult | null>(null);

  useEffect(() => {
    const fetchAndSelectBranch = async () => {
      if (!restaurantId || !customerLat || !customerLon) {
        setSelectedBranch(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch branches for this restaurant
        const { data, error } = await supabase
          .from('restaurant_branches')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true);

        if (error) throw error;

        setBranches(data || []);

        // Find nearest branch
        const branchLocations: BranchLocation[] = (data || []).map(b => ({
          id: b.id,
          name: b.name,
          latitude: Number(b.latitude),
          longitude: Number(b.longitude),
          address: b.address || undefined,
          phone_number: b.phone_number || undefined,
        }));

        const nearest = findNearestBranch(customerLat, customerLon, branchLocations);
        setSelectedBranch(nearest);
      } catch (err) {
        console.error('Error selecting branch:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndSelectBranch();
  }, [restaurantId, customerLat, customerLon]);

  return {
    branches,
    loading,
    selectedBranch,
    canDeliver: selectedBranch ? isWithinDeliveryRange(selectedBranch.distance) : false,
    formatDistance,
    formatDeliveryTime,
  };
};
