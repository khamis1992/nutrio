import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Driver, FleetDashboardStats } from "@/fleet/types";

interface UseDriversOptions {
  cityIds?: string[];
  status?: string;
  zoneId?: string;
  isOnline?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export function useDrivers(options: UseDriversOptions = {}) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("drivers")
        .select("*", { count: "exact" });

      if (options.status && options.status !== "all") {
        query = query.eq("approval_status", options.status as "pending" | "approved" | "rejected");
      }

      if (options.isOnline !== undefined) {
        query = query.eq("is_online", options.isOnline);
      }

      if (options.cityIds?.length) {
        query = query.in("city_id", options.cityIds);
      }

      if (options.zoneId) {
        query = query.contains("assigned_zone_ids", [options.zoneId]);
      }

      if (options.search) {
        query = query.or(`phone_number.ilike.%${options.search}%,license_number.ilike.%${options.search}%`);
      }

      const page = options.page || 1;
      const limit = options.limit || 20;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      // Fetch vehicle plates for these drivers
      const driverIds = (data || []).map((d: { id: string }) => d.id);
      const plateMap: Record<string, string> = {};
      const cityMap: Record<string, string> = {};
      if (driverIds.length > 0) {
        const { data: vehicles } = await supabase
          .from("vehicles")
          .select("assigned_driver_id, plate_number")
          .in("assigned_driver_id", driverIds);
        (vehicles || []).forEach((v: { assigned_driver_id?: string | null; plate_number?: string | null }) => {
          if (v.assigned_driver_id && v.plate_number) {
            plateMap[v.assigned_driver_id] = v.plate_number;
          }
        });
      }

      const cityIds = [
        ...new Set(
          (data || [])
            .map((driver) => driver.city_id)
            .filter((cityId): cityId is string => Boolean(cityId)),
        ),
      ];
      if (cityIds.length > 0) {
        const { data: cities, error: citiesError } = await supabase
          .from("cities")
          .select("id, name")
          .in("id", cityIds);
        if (citiesError) throw citiesError;
        (cities || []).forEach((city) => {
          cityMap[city.id] = city.name;
        });
      }

      const transformedDrivers: Driver[] = (data || []).map((d) => ({
        id: d.id,
        authUserId: d.user_id || undefined,
        email: d.email || "",
        phone: d.phone_number || "",
        fullName: d.full_name || `Driver ${d.phone_number?.slice(-4) || d.id.slice(0, 8)}`,
        cityId: d.city_id || "",
        cityName: d.city_id ? cityMap[d.city_id] : undefined,
        assignedZoneIds: d.assigned_zone_ids || [],
        status: d.approval_status === "approved" && d.is_active 
          ? "active" 
          : d.approval_status === "pending" 
            ? "pending_verification" 
            : "inactive",
        currentLatitude: d.current_lat ?? undefined,
        currentLongitude: d.current_lng ?? undefined,
        locationUpdatedAt: d.last_location_update || undefined,
        isOnline: d.is_online || false,
        totalDeliveries: d.total_deliveries || 0,
        rating: d.rating || 5.0,
        cancellationRate: d.cancellation_rate || 0,
        currentBalance: d.wallet_balance || 0,
        totalEarnings: d.total_earnings || 0,
        assignedVehicleId: undefined,
        vehiclePlate: plateMap[d.id] || undefined,
        createdAt: d.created_at || new Date().toISOString(),
      }));

      setDrivers(transformedDrivers);
      setTotal(count || 0);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast({
        title: "Error",
        description: "Failed to load drivers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
    }, [options.cityIds, options.isOnline, options.limit, options.page, options.search, options.status, options.zoneId]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  return {
    drivers,
    isLoading,
    total,
    pagination: {
      page: options.page || 1,
      total,
      totalPages: Math.max(1, Math.ceil(total / (options.limit || 20))),
    },
    refetch: fetchDrivers,
  };
}

export function useFleetStats(cityIds?: string[]) {
  const [stats, setStats] = useState<FleetDashboardStats>({
    totalDrivers: 0,
    activeDrivers: 0,
    onlineDrivers: 0,
    ordersInProgress: 0,
    todayDeliveries: 0,
    averageDeliveryTime: 0,
    cities: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all drivers regardless of city selection
      let driversQuery = supabase
        .from("drivers")
        .select("id, approval_status, is_online, is_active", { count: "exact" });

      if (cityIds?.length) {
        driversQuery = driversQuery.in("city_id", cityIds);
      }
      
      const { data: drivers, count: totalDrivers, error: driversError } = await driversQuery;
      
      if (driversError) {
        console.error("Error fetching drivers:", driversError);
        throw driversError;
      }

      const driverIds = (drivers || []).map((driver) => driver.id);
      let activeOrdersQuery = supabase
        .from("delivery_jobs")
        .select("id", { count: "exact" })
        .in("status", ["assigned", "accepted", "picked_up", "in_transit", "on_the_way"]);

      if (cityIds?.length && driverIds.length > 0) {
        activeOrdersQuery = activeOrdersQuery.in("driver_id", driverIds);
      }

      const { count: queriedOrdersInProgress, error: ordersError } = cityIds?.length && driverIds.length === 0
        ? { count: 0, error: null }
        : await activeOrdersQuery;
      
      if (ordersError) console.error("Error fetching orders:", ordersError);

      const today = new Date().toISOString().split("T")[0];
      let deliveredTodayQuery = supabase
        .from("delivery_jobs")
        .select("id", { count: "exact" })
        .in("status", ["delivered", "completed"])
        .gte("delivered_at", today);

      if (cityIds?.length && driverIds.length > 0) {
        deliveredTodayQuery = deliveredTodayQuery.in("driver_id", driverIds);
      }

      const { count: queriedTodayDeliveries, error: deliveriesError } = cityIds?.length && driverIds.length === 0
        ? { count: 0, error: null }
        : await deliveredTodayQuery;
      
      if (deliveriesError) console.error("Error fetching deliveries:", deliveriesError);

      const activeDrivers = drivers?.filter(d => d.approval_status === "approved" && d.is_active).length || 0;
      const onlineDrivers = drivers?.filter(d => d.is_online).length || 0;

      let durationQuery = supabase
        .from("delivery_jobs")
        .select("accepted_at, delivered_at")
        .not("accepted_at", "is", null)
        .not("delivered_at", "is", null)
        .order("delivered_at", { ascending: false })
        .limit(100);

      if (cityIds?.length && driverIds.length > 0) {
        durationQuery = durationQuery.in("driver_id", driverIds);
      }

      const { data: completedJobs, error: durationError } = cityIds?.length && driverIds.length === 0
        ? { data: [], error: null }
        : await durationQuery;
      if (durationError) console.error("Error fetching delivery durations:", durationError);

      const durations = (completedJobs || []).flatMap((job) => {
        if (!job.accepted_at || !job.delivered_at) return [];
        const minutes = (new Date(job.delivered_at).getTime() - new Date(job.accepted_at).getTime()) / 60000;
        return minutes >= 0 ? [minutes] : [];
      });
      const averageDeliveryTime = durations.length
        ? Math.round(durations.reduce((total, minutes) => total + minutes, 0) / durations.length)
        : 0;

      const newStats = {
        totalDrivers: totalDrivers || 0,
        activeDrivers,
        onlineDrivers,
        ordersInProgress: queriedOrdersInProgress || 0,
        todayDeliveries: queriedTodayDeliveries || 0,
        averageDeliveryTime,
        cities: [],
      };
      
      setStats(newStats);
    } catch (error) {
      console.error("Error fetching fleet stats:", error);
    } finally {
      setIsLoading(false);
    }
    }, [cityIds]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}

export interface DriverVehicle {
  id: string;
  plateNumber: string;
  type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  insuranceExpiry: string | null;
  status: string;
}

export function useDriverDetail(driverId: string) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDriver = useCallback(async () => {
    if (!driverId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", driverId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setDriver(null);
        setVehicle(null);
        setIsLoading(false);
        return;
      }

      setDriver({
        id: data.id,
        authUserId: data.user_id,
        email: data.email || "",
        phone: data.phone_number || "",
        fullName: data.full_name || `Driver ${data.phone_number?.slice(-4) || data.id.slice(0, 8)}`,
        cityId: data.city_id || "",
        assignedZoneIds: data.assigned_zone_ids || [],
        status: data.approval_status === "approved" && data.is_active 
          ? "active" 
          : data.approval_status === "pending" 
            ? "pending_verification" 
            : "inactive",
        currentLatitude: data.current_lat || undefined,
        currentLongitude: data.current_lng || undefined,
        locationUpdatedAt: data.last_location_update || undefined,
        isOnline: data.is_online || false,
        totalDeliveries: data.total_deliveries || 0,
        rating: data.rating || 5.0,
        cancellationRate: data.cancellation_rate || 0,
        currentBalance: data.wallet_balance || 0,
        totalEarnings: data.total_earnings || 0,
        assignedVehicleId: undefined,
        createdAt: data.created_at || new Date().toISOString(),
      });

      const { data: vData } = await supabase
        .from("vehicles")
        .select("id, plate_number, type, make, model, year, color, insurance_expiry, status")
        .eq("assigned_driver_id", data.id)
        .maybeSingle();

      setVehicle(vData ? {
          id: vData.id,
          plateNumber: vData.plate_number,
          type: vData.type,
          make: vData.make,
          model: vData.model,
          year: vData.year,
          color: vData.color,
          insuranceExpiry: vData.insurance_expiry,
          status: vData.status || "unknown",
      } : null);
    } catch (error) {
      console.error("Error fetching driver detail:", error);
      toast({
        title: "Error",
        description: "Failed to load driver details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchDriver();
  }, [fetchDriver]);

  return { driver, vehicle, isLoading, refetch: fetchDriver };
}

// Payout types
export interface Payout {
  id: string;
  driverId: string;
  driverName?: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  processedAt: string | null;
  payoutMethod?: string;
  createdAt: string;
}

interface UsePayoutsOptions {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function usePayouts(options: UsePayoutsOptions = {}) {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchPayouts = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('driver_payouts')
        .select(`
          *,
          drivers!inner(full_name)
        `, { count: 'exact' });

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      const page = options.page || 1;
      const limit = options.limit || 20;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      const transformedPayouts: Payout[] = (data || []).map((p) => ({
        id: p.id,
        driverId: p.driver_id,
        driverName: p.drivers?.full_name || 'Unknown Driver',
        amount: p.amount || 0,
        periodStart: p.period_start,
        periodEnd: p.period_end,
        status: (p.status || 'pending') as Payout['status'],
        processedAt: p.processed_at || null,
        payoutMethod: p.payout_method || undefined,
        createdAt: p.created_at || new Date().toISOString(),
      }));

      setPayouts(transformedPayouts);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payouts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [options.status, options.page, options.limit]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  return { payouts, isLoading, total, refetch: fetchPayouts };
}
