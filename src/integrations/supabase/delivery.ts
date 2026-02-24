// Delivery System API Integration
// This file contains all backend API functions for the delivery system

import { supabase } from "./client";

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

/**
 * Get restaurant location from meal schedule
 */
async function getRestaurantLocation(scheduleId: string): Promise<Location> {
  const { data, error } = await supabase
    .from("meal_schedules")
    .select(`
      meal:meal_id(
        restaurant:restaurant_id(
          current_lat,
          current_lng
        )
      )
    `)
    .eq("id", scheduleId)
    .single();
  
  if (error || !data) {
    // Return Doha center as fallback
    return { lat: 25.276987, lng: 51.520008 };
  }
  
  // Use restaurant coordinates if available
  const restaurant = data.meal?.restaurant;
  if (restaurant?.current_lat && restaurant?.current_lng) {
    return {
      lat: parseFloat(restaurant.current_lat),
      lng: parseFloat(restaurant.current_lng)
    };
  }
  
  return { lat: 25.276987, lng: 51.520008 };
}

/**
 * Assign nearest available driver to a delivery job
 */
export async function assignDriverToJob(jobId: string) {
  // Get job details
  const { data: job, error: jobError } = await supabase
    .from("delivery_jobs")
    .select("schedule_id")
    .eq("id", jobId)
    .eq("status", "pending")
    .single();
  
  if (jobError || !job) {
    throw new Error("Job not found or already assigned");
  }
  
  // Get restaurant location
  const restaurantLocation = await getRestaurantLocation(job.schedule_id);
  
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
  
  // Assign driver to job
  const { error: updateError } = await supabase
    .from("delivery_jobs")
    .update({
      driver_id: selectedDriver.id,
      status: "assigned",
      assigned_at: new Date().toISOString()
    })
    .eq("id", jobId);
  
  if (updateError) throw updateError;
  
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
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .eq("status", "assigned")
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Driver rejects assigned job
 */
export async function driverRejectJob(driverId: string, jobId: string) {
  // Reset job to pending for reassignment
  const { error } = await supabase
    .from("delivery_jobs")
    .update({
      driver_id: null,
      status: "pending",
      assigned_at: null
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .eq("status", "assigned");
  
  if (error) throw error;
  
  // Try to assign to another driver
  await assignDriverToJob(jobId);
}

/**
 * Driver marks job as picked up
 */
export async function driverPickupJob(
  driverId: string, 
  jobId: string,
  photoUrl?: string
) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
      pickup_photo_url: photoUrl
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .eq("status", "accepted")
    .select()
    .single();
  
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      customer_otp: otp,
      delivery_photo_url: photoUrl,
      delivery_notes: notes
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .eq("status", "picked_up")
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Driver marks job as failed
 */
export async function driverFailJob(
  driverId: string,
  jobId: string,
  reason: string
) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: reason
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .in("status", ["assigned", "accepted", "picked_up"])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get driver's current active job
 */
export async function getDriverCurrentJob(driverId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      schedule:schedule_id(
        *,
        meal:meal_id(
          name,
          restaurant:restaurant_id(
            name,
            address,
            phone_number,
            current_lat,
            current_lng
          )
        ),
        user:user_id(
          email,
          raw_user_meta_data
        )
      )
    `)
    .eq("driver_id", driverId)
    .in("status", ["assigned", "accepted", "picked_up"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

/**
 * Get driver's job history
 */
export async function getDriverJobHistory(driverId: string, limit = 20) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      schedule:schedule_id(
        meal:meal_id(name),
        user:user_id(raw_user_meta_data)
      )
    `)
    .eq("driver_id", driverId)
    .in("status", ["delivered", "failed", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}

// ==================== ADMIN MANAGEMENT ====================

/**
 * Get all pending deliveries
 */
export async function getPendingDeliveries() {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      driver:driver_id(*),
      schedule:schedule_id(
        *,
        meal:meal_id(name, image_url),
        user:user_id(
          email,
          raw_user_meta_data
        )
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  
  if (error) throw error;
  return data;
}

/**
 * Get all active deliveries
 */
export async function getActiveDeliveries() {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      driver:driver_id(*),
      schedule:schedule_id(
        *,
        meal:meal_id(name, image_url),
        user:user_id(
          email,
          raw_user_meta_data
        )
      )
    `)
    .in("status", ["assigned", "accepted", "picked_up"])
    .order("created_at", { ascending: true });
  
  if (error) throw error;
  return data;
}

/**
 * Get all online drivers with locations
 */
export async function getOnlineDrivers() {
  const { data, error } = await supabase
    .from("drivers")
    .select(`
      *,
      user:user_id(email, raw_user_meta_data)
    `)
    .eq("is_online", true)
    .eq("is_active", true);
  
  if (error) throw error;
  return data;
}

/**
 * Manually assign driver to job
 */
export async function adminAssignDriver(jobId: string, driverId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      driver_id: driverId,
      status: "assigned",
      assigned_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Reassign job to different driver
 */
export async function adminReassignDriver(jobId: string, newDriverId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      driver_id: newDriverId,
      status: "assigned",
      assigned_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .in("status", ["assigned", "accepted"])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Cancel delivery job
 */
export async function adminCancelJob(jobId: string, reason: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "cancelled",
      failure_reason: reason
    })
    .eq("id", jobId)
    .not("status", "in", ["delivered", "failed", "cancelled"])
    .select()
    .single();
  
  if (error) throw error;
  return data;
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
  callback: (payload: any) => void
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
  callback: (payload: any) => void
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
