// Delivery System API Integration
// This file contains all backend API functions for the delivery system

import { supabase } from "./client";

const asJsonObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

type DeliverySource = "order" | "meal_schedule";

type UntypedRpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

const callDeliveryRpc = <T,>(name: string, args: Record<string, unknown>) =>
  (supabase as unknown as {
    rpc: (functionName: string, parameters: Record<string, unknown>) => Promise<UntypedRpcResult<T>>;
  }).rpc(name, args);

const requireRpcSuccess = (
  data: unknown,
  fallbackMessage: string,
): Record<string, unknown> => {
  const result = asJsonObject(data);
  if (result?.success !== true) {
    throw new Error(
      typeof result?.error === "string" ? result.error : fallbackMessage,
    );
  }
  return result;
};

async function transitionDeliveryJob(
  jobId: string,
  status: string,
  deliveryNotes?: string,
  failureReason?: string,
) {
  const { data, error } = await callDeliveryRpc<unknown>("transition_delivery_job", {
    p_delivery_job_id: jobId,
    p_new_status: status,
    p_delivery_notes: deliveryNotes || null,
    p_failure_reason: failureReason || null,
  });

  if (error) throw error;
  return requireRpcSuccess(data, "The delivery status could not be updated.");
}

async function resolveDeliverySource(jobId: string): Promise<{
  source: DeliverySource;
  sourceId: string;
}> {
  const { data, error } = await callDeliveryRpc<unknown>(
    "get_delivery_details_for_driver",
    { p_delivery_job_id: jobId },
  );

  if (error) throw error;
  const details = asJsonObject(data);
  if (typeof details?.order_id === "string") {
    return { source: "order", sourceId: details.order_id };
  }
  if (typeof details?.schedule_id === "string") {
    return { source: "meal_schedule", sourceId: details.schedule_id };
  }
  throw new Error("The delivery source could not be resolved.");
}

async function assignDeliverySource(
  source: DeliverySource,
  sourceId: string,
  driverId: string,
  reason: string,
) {
  const { data, error } = await callDeliveryRpc<unknown>("assign_fleet_delivery_job", {
    p_source_type: source,
    p_source_id: sourceId,
    p_driver_id: driverId,
    p_reason: reason,
    p_notes: null,
  });

  if (error) throw error;
  return requireRpcSuccess(data, "The delivery could not be assigned.");
}

async function assignDeliveryJobById(
  jobId: string,
  driverId: string,
  reason: string,
) {
  const { source, sourceId } = await resolveDeliverySource(jobId);
  return assignDeliverySource(source, sourceId, driverId, reason);
}

// ==================== DRIVER MANAGEMENT ====================

/**
 * Set driver online status and start location tracking
 */
export async function driverGoOnline(driverId: string) {
  const { data, error } = await supabase
    .from("drivers")
    .update({ 
      is_online: true,
      is_active: true,
      last_location_update: new Date().toISOString()
    })
    .eq("id", driverId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Set driver offline and stop location tracking
 */
export async function driverGoOffline(driverId: string) {
  const { data, error } = await supabase
    .from("drivers")
    .update({ 
      is_online: false,
      current_location: null,
      current_lat: null,
      current_lng: null
    })
    .eq("id", driverId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update driver current location
 */
export async function updateDriverLocation(
  driverId: string,
  location: { lat: number; lng: number },
  accuracy?: number,
  heading?: number,
  speed?: number
) {
  // Update driver current location
  const { error: driverError } = await supabase
    .from("drivers")
    .update({
      current_lat: location.lat,
      current_lng: location.lng,
      current_location: `POINT(${location.lng} ${location.lat})`,
      last_location_update: new Date().toISOString()
    })
    .eq("id", driverId);
  
  if (driverError) throw driverError;
  
  // Store location history
  const { error: locationError } = await supabase
    .from("driver_locations")
    .insert({
      driver_id: driverId,
      location: `POINT(${location.lng} ${location.lat})`,
      accuracy_meters: accuracy,
      heading: heading,
      speed_kmh: speed
    });
  
  if (locationError) throw locationError;
}

/**
 * Get driver profile with stats
 */
export async function getDriverProfile(driverId: string) {
  const { data, error } = await supabase
    .from("drivers")
    .select(`
      *,
      user:user_id(email, raw_user_meta_data)
    `)
    .eq("id", driverId)
    .single();
  
  if (error) throw error;
  return data;
}

// ==================== JOB ASSIGNMENT ====================

interface Location {
  lat: number;
  lng: number;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth's radius in km
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/** Get the pickup location from the restaurant already bound to the job. */
async function getRestaurantLocation(restaurantId: string | null): Promise<Location> {
  if (!restaurantId) {
    throw new Error("Delivery job has no restaurant");
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("public_restaurant_catalog" as "restaurants")
    .select("latitude, longitude")
    .eq("id", restaurantId)
    .single();

  if (restaurantError) throw restaurantError;
  if (!restaurant?.latitude || !restaurant?.longitude) {
    throw new Error("Restaurant location is not configured");
  }

  return {
    lat: Number(restaurant.latitude),
    lng: Number(restaurant.longitude),
  };
}

/**
 * Assign nearest available driver to a delivery job
 */
export async function assignDriverToJob(jobId: string) {
  // Get job details
  const { data: job, error: jobError } = await supabase
    .from("delivery_jobs")
    .select("restaurant_id, order_id, schedule_id")
    .eq("id", jobId)
    .eq("status", "pending")
    .single();
  
  if (jobError || !job) {
    throw new Error("Job not found or already assigned");
  }
  
  // Get restaurant location
  const restaurantLocation = await getRestaurantLocation(job.restaurant_id);
  
  // Find online drivers with location
  const { data: drivers, error: driverError } = await supabase
    .from("drivers")
    .select("id, user_id, current_lat, current_lng, rating, total_deliveries")
    .eq("is_online", true)
    .eq("is_active", true)
    .not("current_lat", "is", null)
    .not("current_lng", "is", null);
  
  if (driverError || !drivers || drivers.length === 0) {
    throw new Error("No drivers available");
  }
  
  // Calculate distances and sort
  const driversWithDistance = drivers
    .map(driver => ({
      ...driver,
      distance: calculateDistance(
        { lat: driver.current_lat!, lng: driver.current_lng! },
        restaurantLocation
      )
    }))
    .sort((a, b) => {
      // Prioritize distance, then rating
      if (Math.abs(a.distance - b.distance) < 0.5) {
        return (b.rating || 0) - (a.rating || 0);
      }
      return a.distance - b.distance;
    });
  
  const selectedDriver = driversWithDistance[0];
  
  const source = job.order_id ? "order" : "meal_schedule";
  const sourceId = job.order_id || job.schedule_id;
  if (!sourceId) throw new Error("Delivery job has no dispatch source");

  await assignDeliverySource(
    source,
    sourceId,
    selectedDriver.id,
    "Automatic assignment",
  );
  
  return selectedDriver;
}

/**
 * Auto-assign all pending jobs
 */
export async function autoAssignAllPendingJobs() {
  const { data: pendingJobs, error } = await supabase
    .from("delivery_jobs")
    .select("id")
    .eq("status", "pending");
  
  if (error || !pendingJobs) throw error;
  
  let assigned = 0;
  let failed = 0;
  
  for (const job of pendingJobs) {
    try {
      await assignDriverToJob(job.id);
      assigned++;
    } catch (err) {
      failed++;
    }
  }
  
  return { assigned, failed };
}

// ==================== DRIVER ACTIONS ====================

/**
 * Driver accepts assigned job
 */
export async function driverAcceptJob(driverId: string, jobId: string) {
  void driverId;
  return transitionDeliveryJob(jobId, "accepted");
}

/**
 * Driver rejects assigned job
 */
export async function driverRejectJob(driverId: string, jobId: string) {
  void driverId;
  await transitionDeliveryJob(jobId, "pending", undefined, "Driver rejected assignment");
}

/**
 * Driver marks job as picked up
 */
export async function driverPickupJob(
  driverId: string,
  jobId: string,
  capability: string,
) {
  void driverId;
  if (!capability) throw new Error("A pickup capability is required.");

  const { data, error } = await callDeliveryRpc<unknown>("complete_delivery_pickup", {
    p_delivery_job_id: jobId,
    p_capability: capability,
  });
  if (error) throw error;
  return requireRpcSuccess(data, "Pickup verification failed.");
}

/**
 * Driver marks job as delivered
 */
export async function driverDeliverJob(
  driverId: string,
  jobId: string,
  otp?: string,
  photoUrl?: string,
  notes?: string
) {
  void driverId;
  if (otp || photoUrl) {
    throw new Error("Delivery proof requires a reviewed proof-verification RPC.");
  }
  return transitionDeliveryJob(jobId, "delivered", notes);
}

/**
 * Driver marks job as failed
 */
export async function driverFailJob(
  driverId: string,
  jobId: string,
  reason: string
) {
  void driverId;
  return transitionDeliveryJob(jobId, "failed", undefined, reason);
}

/**
 * Get driver's current active job
 */
export async function getDriverCurrentJob(driverId: string) {
  const { data: job, error } = await supabase
    .from("delivery_jobs")
    .select("*")
    .eq("driver_id", driverId)
    .in("status", ["assigned", "accepted", "picked_up", "in_transit"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  if (!job) return null;

  const [{ data: details, error: detailsError }, { data: restaurant, error: restaurantError }] =
    await Promise.all([
      supabase.rpc("get_delivery_details_for_driver", { p_delivery_job_id: job.id }),
      job.restaurant_id
        ? supabase
            .from("public_restaurant_catalog" as "restaurants")
            .select("name, address, phone, latitude, longitude")
            .eq("id", job.restaurant_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (detailsError) throw detailsError;
  if (restaurantError) throw restaurantError;
  const detailObject = asJsonObject(details);

  return {
    ...job,
    schedule: {
      meal: {
        name: readString(detailObject?.meal_name, "Order"),
        restaurant: restaurant
          ? {
              ...restaurant,
              phone_number: restaurant.phone,
              current_lat: restaurant.latitude,
              current_lng: restaurant.longitude,
            }
          : null,
      },
      user: {
        email: null,
        raw_user_meta_data: { name: readString(detailObject?.customer_name, "Customer") },
      },
    },
    customer_phone: typeof detailObject?.customer_phone === "string" ? detailObject.customer_phone : null,
  };
}

/**
 * Get driver's job history
 */
export async function getDriverJobHistory(driverId: string, limit = 20) {
  // Fetch delivery jobs without embedded queries
  const { data: jobs, error: jobsError } = await supabase
    .from("delivery_jobs")
    .select("*")
    .eq("driver_id", driverId)
    .in("status", ["completed", "delivered", "failed", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(limit);
  
  if (jobsError) throw jobsError;
  if (!jobs || jobs.length === 0) return [];

  const restaurantIds = [...new Set(jobs.map((job) => job.restaurant_id).filter((id): id is string => Boolean(id)))];
  const { data: restaurants, error: restaurantsError } = restaurantIds.length > 0
    ? await supabase.from("public_restaurant_catalog" as "restaurants").select("id, name").in("id", restaurantIds)
    : { data: [], error: null };
  if (restaurantsError) throw restaurantsError;
  const restaurantNames = new Map((restaurants || []).map((restaurant) => [restaurant.id, restaurant.name]));

  return Promise.all(jobs.map(async (job) => {
    const { data: details, error } = await supabase.rpc(
      "get_delivery_details_for_driver",
      { p_delivery_job_id: job.id },
    );
    if (error) throw error;
    const detailObject = asJsonObject(details);

    return {
      ...job,
      meal_name: readString(detailObject?.meal_name, "Order"),
      customer_name: readString(detailObject?.customer_name, "Customer"),
      restaurant_name: job.restaurant_id
        ? restaurantNames.get(job.restaurant_id) || "Restaurant"
        : "Restaurant",
    };
  }));
}

// ==================== ADMIN MANAGEMENT ====================

/**
 * Get all pending deliveries.
 * Uses separate queries instead of PostgREST embedded resources because
 * cross-schema FKs (public → auth) are not resolved by PostgREST's schema cache.
 */
export async function getPendingDeliveries() {
  const { data: jobs, error } = await supabase
    .from("delivery_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!jobs || jobs.length === 0) return [];

  return enrichDeliveryJobs(jobs);
}

/**
 * Get all active deliveries.
 */
export async function getActiveDeliveries() {
  const { data: jobs, error } = await supabase
    .from("delivery_jobs")
    .select("*")
    .in("status", ["assigned", "accepted", "picked_up", "in_transit", "on_the_way"])
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!jobs || jobs.length === 0) return [];

  return enrichDeliveryJobs(jobs);
}

async function enrichDeliveryJobs(jobs: Record<string, unknown>[]) {
  const driverIds = [...new Set(jobs.map((j) => j.driver_id as string).filter(Boolean))];
  const scheduleIds = [...new Set(jobs.map((j) => j.schedule_id as string).filter(Boolean))];
  const orderIds = [...new Set(jobs.map((j) => j.order_id as string).filter(Boolean))];

  const [driversResult, schedulesResult, ordersResult] = await Promise.all([
    driverIds.length > 0
      ? supabase.from("drivers").select("*").in("id", driverIds)
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length > 0
      ? supabase.from("meal_schedules").select("*").in("id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length > 0
      ? supabase.from("orders").select("*").in("id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driversResult.error) throw driversResult.error;
  if (schedulesResult.error) throw schedulesResult.error;
  if (ordersResult.error) throw ordersResult.error;

  const drivers = driversResult.data || [];
  const schedules = schedulesResult.data || [];
  const orders = ordersResult.data || [];
  const sources = [...schedules, ...orders];
  const mealIds = [...new Set(sources.map((source) => source.meal_id as string).filter(Boolean))];
  const userIds = [...new Set(sources.map((source) => source.user_id as string).filter(Boolean))];
  const sourceRestaurantIds = sources
    .map((source) => source.restaurant_id as string)
    .filter(Boolean);

  const [mealsResult, profilesResult] = await Promise.all([
    mealIds.length > 0
      ? supabase.from("public_meal_catalog" as "meals").select("id, name, image_url, restaurant_id").in("id", mealIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (mealsResult.error) throw mealsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const meals = mealsResult.data || [];
  const profiles = profilesResult.data || [];
  const restaurantIds = [...new Set([
    ...sourceRestaurantIds,
    ...meals.map((meal) => meal.restaurant_id as string).filter(Boolean),
  ])];
  const { data: restaurants, error: restaurantsError } = restaurantIds.length > 0
    ? await supabase
        .from("public_restaurant_catalog" as "restaurants")
        .select("id, name, address, phone_number")
        .in("id", restaurantIds)
    : { data: [], error: null };

  if (restaurantsError) throw restaurantsError;

  const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
  const scheduleMap = Object.fromEntries(schedules.map((s) => [s.id, s]));
  const orderMap = Object.fromEntries(orders.map((order) => [order.id, order]));
  const mealMap = Object.fromEntries(meals.map((m) => [m.id, m]));
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const restaurantMap = Object.fromEntries((restaurants || []).map((restaurant) => [restaurant.id, restaurant]));

  return jobs.map((job) => {
    const schedule = scheduleMap[job.schedule_id as string];
    const order = orderMap[job.order_id as string];
    const source = schedule || order;
    const meal = source ? mealMap[source.meal_id as string] : null;
    const profile = source ? profileMap[source.user_id as string] : null;
    const restaurantId = (source?.restaurant_id || meal?.restaurant_id || job.restaurant_id) as string | undefined;
    const restaurant = restaurantId ? restaurantMap[restaurantId] : null;

    return {
      ...job,
      driver: driverMap[job.driver_id as string] || null,
      schedule: source
        ? {
            ...source,
            source_type: schedule ? "meal_schedule" : "order",
            meal_type: schedule?.meal_type || "Direct order",
            order_status: schedule?.order_status || order?.status || job.status,
            meal: meal
              ? {
                  id: meal.id,
                  name: meal.name,
                  image_url: meal.image_url,
                  restaurant,
                }
              : null,
            user: profile
              ? { email: null, raw_user_meta_data: { name: profile.full_name } }
              : null,
          }
        : null,
    };
  });
}

/**
 * Get all online drivers with locations.
 */
export async function getOnlineDrivers() {
  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("is_online", true)
    .eq("is_active", true);

  if (error) throw error;
  if (!drivers || drivers.length === 0) return [];

  const userIds = [...new Set(drivers.map((d) => d.user_id as string).filter(Boolean))];

  const { data: profiles } = userIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  return drivers.map((d) => ({
    ...d,
    user: profileMap[d.user_id as string]
      ? { email: null, raw_user_meta_data: { name: profileMap[d.user_id as string].full_name } }
      : null,
  }));
}

/**
 * Manually assign driver to job
 */
export async function adminAssignDriver(jobId: string, driverId: string) {
  return assignDeliveryJobById(jobId, driverId, "Manual admin assignment");
}

/**
 * Reassign job to different driver
 */
export async function adminReassignDriver(jobId: string, newDriverId: string) {
  return assignDeliveryJobById(jobId, newDriverId, "Manual admin reassignment");
}

/**
 * Cancel delivery job
 */
export async function adminCancelJob(jobId: string, reason: string) {
  return transitionDeliveryJob(jobId, "cancelled", undefined, reason);
}

/**
 * Get delivery statistics
 */
export async function getDeliveryStats(dateRange?: { start: string; end: string }) {
  let query = supabase
    .from("delivery_jobs")
    .select("status, created_at");
  
  if (dateRange) {
    query = query
      .gte("created_at", dateRange.start)
      .lte("created_at", dateRange.end);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  const stats = {
    total: data?.length || 0,
    pending: data?.filter(j => j.status === "pending").length || 0,
    assigned: data?.filter(j => j.status === "assigned").length || 0,
    picked_up: data?.filter(j => j.status === "picked_up").length || 0,
    delivered: data?.filter(j => j.status === "delivered").length || 0,
    failed: data?.filter(j => j.status === "failed").length || 0,
    cancelled: data?.filter(j => j.status === "cancelled").length || 0
  };
  
  return stats;
}

// ==================== CUSTOMER TRACKING ====================

/**
 * Get delivery tracking info for customer
 */
export async function getDeliveryTracking(scheduleId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      driver:driver_id(
        id,
        phone_number,
        vehicle_type,
        rating,
        total_deliveries,
        current_lat,
        current_lng,
        current_location,
        user:user_id(
          raw_user_meta_data
        )
      )
    `)
    .eq("schedule_id", scheduleId)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

/**
 * Get driver current location
 */
export async function getDriverLocation(driverId: string) {
  const { data, error } = await supabase
    .from("driver_locations")
    .select("*")
    .eq("driver_id", driverId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

/**
 * Subscribe to delivery updates (real-time)
 */
export function subscribeToDeliveryUpdates(
  scheduleId: string,
  callback: (payload: Record<string, unknown>) => void
) {
  return supabase
    .channel(`delivery-${scheduleId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "delivery_jobs",
        filter: `schedule_id=eq.${scheduleId}`
      },
      callback
    )
    .subscribe();
}

/**
 * Subscribe to driver location updates
 */
export function subscribeToDriverLocation(
  driverId: string,
  callback: (payload: Record<string, unknown>) => void
) {
  return supabase
    .channel(`driver-location-${driverId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${driverId}`
      },
      callback
    )
    .subscribe();
}
