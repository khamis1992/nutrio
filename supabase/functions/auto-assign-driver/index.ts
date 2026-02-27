// Supabase Edge Function: Auto Assign Driver
// Automatically assigns the best available driver to a delivery order

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeliveryJob {
  delivery_id: string;
  schedule_id: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_lat: number;
  delivery_lng: number;
  restaurant_id: string;
  user_id: string;
}

interface Driver {
  id: string;
  user_id: string;
  current_lat: number | null;
  current_lng: number | null;
  rating: number;
  total_deliveries: number;
  is_online: boolean;
}

interface ScoredDriver extends Driver {
  current_orders: number;
  score: number;
  distance_km: number;
}

// Create Supabase client with service role
const createSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase credentials not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

// Haversine formula for calculating distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Score driver based on distance, capacity, and rating
function scoreDriver(driver: Driver, currentOrders: number, job: DeliveryJob): { score: number; distance: number } {
  // Default max orders per driver
  const maxOrders = 3;
  
  // If driver has no location, use a default far distance
  let pickupDistance = 100; // Default 100km if no location
  
  if (driver.current_lat && driver.current_lng) {
    pickupDistance = calculateDistance(
      driver.current_lat, driver.current_lng,
      job.pickup_lat, job.pickup_lng
    );
  }

  // Score components (0-100 scale each)
  // Distance score: closer = higher score (exponential decay)
  const distanceScore = Math.max(0, 100 * Math.exp(-pickupDistance / 5)); // 5km half-life
  
  // Capacity score: more available capacity = higher score
  const availableCapacity = Math.max(0, maxOrders - currentOrders);
  const capacityScore = (availableCapacity / maxOrders) * 100;
  
  // Rating score: higher rating = higher score
  const ratingScore = (driver.rating || 0) * 20; // 5 * 20 = 100 max
  
  // Experience bonus: drivers with more deliveries get a small boost
  const experienceScore = Math.min(10, (driver.total_deliveries || 0) / 10); // Max 10 points
  
  // Weighted total score
  const totalScore = (distanceScore * 0.5) + (capacityScore * 0.3) + (ratingScore * 0.15) + (experienceScore * 0.05);
  
  return { score: Math.round(totalScore), distance: pickupDistance };
}

// Send notification to driver
const notifyDriver = async (supabase: any, driverId: string, deliveryId: string): Promise<void> => {
  try {
    // Get driver user_id
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("id", driverId)
      .single();

    if (driverError || !driver) {
      console.error("Failed to get driver for notification:", driverError);
      return;
    }

    // Invoke notification function
    await supabase.functions.invoke("send-notification", {
      body: {
        userId: driver.user_id,
        type: "new_delivery",
        title: "New Delivery Assignment",
        body: "You have been assigned a new delivery order",
        data: { deliveryId },
      },
    });
  } catch (error) {
    console.error("Error sending driver notification:", error);
    // Non-blocking - don't fail assignment if notification fails
  }
};

// Main assignment logic
const assignDriver = async (deliveryId: string): Promise<{
  success: boolean;
  driverId?: string;
  score?: number;
  message?: string;
  queued?: boolean;
}> => {
  const supabase = createSupabaseClient();

  // Get delivery details with restaurant location
  const { data: delivery, error: deliveryError } = await supabase
    .from("deliveries")
    .select(`
      id,
      schedule_id,
      restaurant_id,
      user_id,
      delivery_lat,
      delivery_lng,
      status,
      driver_id,
      restaurants:restaurant_id (latitude, longitude, address)
    `)
    .eq("id", deliveryId)
    .single();

  if (deliveryError || !delivery) {
    throw new Error(`Delivery not found: ${deliveryError?.message || "Unknown error"}`);
  }

  // Check if already assigned
  if (delivery.driver_id) {
    return { success: true, message: "Driver already assigned", driverId: delivery.driver_id };
  }

  // Check if status allows assignment
  if (delivery.status !== "pending") {
    return { success: false, message: `Delivery status is ${delivery.status}, cannot assign` };
  }

  // For pickup location, use restaurant coordinates if available, otherwise default to Doha center
  const pickupLat = delivery.restaurants?.latitude || 25.2854;
  const pickupLng = delivery.restaurants?.longitude || 51.5310;

  const job: DeliveryJob = {
    delivery_id: deliveryId,
    schedule_id: delivery.schedule_id,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    delivery_lat: delivery.delivery_lat || 25.2854,
    delivery_lng: delivery.delivery_lng || 51.5310,
    restaurant_id: delivery.restaurant_id,
    user_id: delivery.user_id,
  };

  // Get available drivers (online and approved)
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("id, user_id, current_lat, current_lng, rating, total_deliveries, is_online, approval_status")
    .eq("is_online", true)
    .eq("approval_status", "approved");

  if (driversError) {
    throw new Error(`Failed to fetch drivers: ${driversError.message}`);
  }

  if (!drivers || drivers.length === 0) {
    // No drivers available - queue for manual assignment
    await supabase
      .from("deliveries")
      .update({ 
        status: "pending",
        assignment_notes: "Auto-assignment failed: No drivers available"
      })
      .eq("id", deliveryId);
    
    return { success: false, message: "No drivers available, queued for manual assignment", queued: true };
  }

  // Get current active deliveries for each driver
  const driverIds = drivers.map((d: Driver) => d.id);
  const { data: activeDeliveries } = await supabase
    .from("deliveries")
    .select("driver_id, status")
    .in("driver_id", driverIds)
    .in("status", ["claimed", "picked_up", "on_the_way"]);

  // Count active orders per driver
  const orderCounts: Record<string, number> = {};
  (activeDeliveries || []).forEach((d: any) => {
    orderCounts[d.driver_id] = (orderCounts[d.driver_id] || 0) + 1;
  });

  // Score and rank drivers
  const maxOrders = 3;
  const scoredDrivers: ScoredDriver[] = drivers
    .filter((d: Driver) => (orderCounts[d.id] || 0) < maxOrders)
    .map((d: Driver) => {
      const currentOrders = orderCounts[d.id] || 0;
      const { score, distance } = scoreDriver(d, currentOrders, job);
      return {
        ...d,
        current_orders: currentOrders,
        score,
        distance_km: distance,
      };
    })
    .sort((a: ScoredDriver, b: ScoredDriver) => b.score - a.score);

  if (scoredDrivers.length === 0) {
    // All drivers at capacity
    await supabase
      .from("deliveries")
      .update({ 
        status: "pending",
        assignment_notes: "Auto-assignment failed: All drivers at capacity"
      })
      .eq("id", deliveryId);
    
    return { success: false, message: "All drivers at capacity, queued for manual assignment", queued: true };
  }

  const bestDriver = scoredDrivers[0];

  // Assign driver to delivery
  const { error: updateError } = await supabase
    .from("deliveries")
    .update({
      driver_id: bestDriver.id,
      status: "claimed",
      claimed_at: new Date().toISOString(),
      assignment_method: "auto",
      assignment_score: bestDriver.score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliveryId);

  if (updateError) {
    throw new Error(`Failed to assign driver: ${updateError.message}`);
  }

  // Update meal_schedule order status
  await supabase
    .from("meal_schedules")
    .update({ order_status: "out_for_delivery" })
    .eq("id", delivery.schedule_id);

  // Send notification to driver (non-blocking)
  await notifyDriver(supabase, bestDriver.id, deliveryId);

  return {
    success: true,
    driverId: bestDriver.id,
    score: bestDriver.score,
    message: `Driver assigned successfully (score: ${bestDriver.score}, distance: ${bestDriver.distance_km.toFixed(1)}km)`,
  };
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify credentials
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({
          error: "Service not configured",
          details: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { deliveryId, orderId } = await req.json();

    // Support both deliveryId and orderId (for backwards compatibility)
    const targetDeliveryId = deliveryId || orderId;

    if (!targetDeliveryId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: deliveryId or orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute assignment
    const result = await assignDriver(targetDeliveryId);

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in auto-assign-driver:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
