import { supabase } from "@/integrations/supabase/client";

const DISPATCHABLE_ORDER_STATUSES = ["preparing", "ready_for_pickup"] as const;
// meal_schedules statuses that are ready for fleet dispatch
const DISPATCHABLE_SCHEDULE_STATUSES = ["preparing", "ready"] as const;
const ACTIVE_DELIVERY_JOB_STATUSES = ["assigned", "accepted", "picked_up", "in_transit"] as const;
const CLOSED_DELIVERY_JOB_STATUSES = ["picked_up", "in_transit", "delivered", "completed", "failed", "cancelled"] as const;

type RawOrder = {
  id: string;
  created_at: string;
  status: string;
  restaurant_id: string | null;
  user_id: string | null;
  meal_id: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_fee: number | null;
  total_amount: number | null;
  tip_amount: number | null;
  phone_number: string | null;
  estimated_delivery_time: string | null;
  restaurant_branch_id?: string | null;
};

type RawMealSchedule = {
  id: string;
  created_at: string | null;
  order_status: string | null;
  user_id: string;
  meal_id: string;
  restaurant_id: string | null;
  delivery_fee: number | null;
  delivery_type: string | null;
};

export interface DispatchOrderRecord {
  id: string;
  createdAt: string;
  status: string;
  /** Where this order originated — "order" row or "meal_schedule" row */
  source: "order" | "meal_schedule";
  /** Original meal_schedule.id when source = "meal_schedule" (same as id for those rows) */
  mealScheduleId: string | null;
  restaurantId: string | null;
  restaurantName: string;
  restaurantAddress: string | null;
  branchId: string | null;
  branchName: string | null;
  branchAddress: string | null;
  customerName: string;
  customerPhone: string | null;
  mealName: string;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryFee: number;
  totalAmount: number;
  tipAmount: number;
  estimatedDeliveryTime: string | null;
  pickupAddress: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  assignmentStatus: string | null;
  existingJobId: string | null;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
}

export interface DispatchDriverActiveJob {
  id: string;
  status: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
}

export interface DispatchDriverRecord {
  id: string;
  fullName: string;
  phone: string | null;
  rating: number | null;
  totalDeliveries: number | null;
  isOnline: boolean;
  isActive: boolean;
  currentLat: number | null;
  currentLng: number | null;
  locationUpdatedAt: string | null;
  activeJobs: DispatchDriverActiveJob[];
  vehiclePlate: string | null;
}

export interface DispatchActivityRecord {
  id: string;
  action: string;
  performedAt: string | null;
  reason: string | null;
  notes: string | null;
  driverName: string;
  orderId: string | null;
  jobStatus: string | null;
}

export async function getDispatchOrders(): Promise<DispatchOrderRecord[]> {
  // Fetch both orders and meal_schedules in parallel
  const [
    { data: ordersData, error: ordersError },
    { data: schedulesData, error: schedulesError },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .in("status", [...DISPATCHABLE_ORDER_STATUSES])
      .order("created_at", { ascending: true }),
    supabase
      .from("meal_schedules")
      .select("id, created_at, order_status, user_id, meal_id, restaurant_id, delivery_fee, delivery_type")
      .in("order_status", [...DISPATCHABLE_SCHEDULE_STATUSES])
      .neq("delivery_type", "pickup")
      .order("created_at", { ascending: true }),
  ]);

  if (ordersError) throw ordersError;
  if (schedulesError) throw schedulesError;

  const orders = (ordersData || []) as RawOrder[];
  const schedules = (schedulesData || []) as RawMealSchedule[];

  // Collect all IDs needed for lookups across both sources
  const allRestaurantIds = Array.from(new Set([
    ...orders.map((o) => o.restaurant_id),
    ...schedules.map((s) => s.restaurant_id),
  ].filter(Boolean) as string[]));

  const allUserIds = Array.from(new Set([
    ...orders.map((o) => o.user_id),
    ...schedules.map((s) => s.user_id),
  ].filter(Boolean) as string[]));

  const allMealIds = Array.from(new Set([
    ...orders.map((o) => o.meal_id),
    ...schedules.map((s) => s.meal_id),
  ].filter(Boolean) as string[]));

  const orderBranchIds = Array.from(
    new Set(orders.map((o) => o.restaurant_branch_id).filter(Boolean) as string[])
  );

  const orderIds = orders.map((o) => o.id);
  const scheduleIds = schedules.map((s) => s.id);
  const allJobScheduleIds = [...orderIds, ...scheduleIds];

  const [
    { data: restaurantsData, error: restaurantsError },
    { data: profilesData, error: profilesError },
    { data: mealsData, error: mealsError },
    { data: branchesData, error: branchesError },
    { data: addressesData, error: addressesError },
    { data: jobsData, error: jobsError },
  ] = await Promise.all([
    allRestaurantIds.length > 0
      ? supabase
          .from("restaurants")
          .select("id, name, address, latitude, longitude")
          .in("id", allRestaurantIds)
      : Promise.resolve({ data: [], error: null }),
    allUserIds.length > 0
      ? supabase.from("profiles").select("user_id, full_name").in("user_id", allUserIds)
      : Promise.resolve({ data: [], error: null }),
    allMealIds.length > 0
      ? supabase.from("meals").select("id, name").in("id", allMealIds)
      : Promise.resolve({ data: [], error: null }),
    orderBranchIds.length > 0
      ? supabase
          .from("restaurant_branches")
          .select("id, name, address, latitude, longitude")
          .in("id", orderBranchIds)
      : Promise.resolve({ data: [], error: null }),
    // Get default delivery address for meal_schedule customers
    allUserIds.length > 0
      ? supabase
          .from("user_addresses")
          .select("user_id, address_line1, address_line2, city, phone, is_default")
          .in("user_id", allUserIds)
          .eq("is_default", true)
      : Promise.resolve({ data: [], error: null }),
    // delivery_jobs.schedule_id can reference either orders.id OR meal_schedules.id
    allJobScheduleIds.length > 0
      ? supabase
          .from("delivery_jobs")
          .select("id, schedule_id, status, driver_id")
          .in("schedule_id", allJobScheduleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (restaurantsError) throw restaurantsError;
  if (profilesError) throw profilesError;
  if (mealsError) throw mealsError;
  if (branchesError) throw branchesError;
  if (addressesError) throw addressesError;
  if (jobsError) throw jobsError;

  // Fetch drivers for assigned jobs
  const driverIds = Array.from(
    new Set((jobsData || []).map((job) => job.driver_id).filter(Boolean) as string[])
  );
  const { data: driversData, error: driversError } = driverIds.length > 0
    ? await supabase.from("drivers").select("id, full_name, phone_number").in("id", driverIds)
    : { data: [], error: null };

  if (driversError) throw driversError;

  // Build lookup maps
  const restaurantsMap = new Map((restaurantsData || []).map((item) => [item.id, item]));
  const profilesMap = new Map((profilesData || []).map((item) => [item.user_id, item]));
  const mealsMap = new Map((mealsData || []).map((item) => [item.id, item]));
  const branchesMap = new Map((branchesData || []).map((item) => [item.id, item]));
  const addressesMap = new Map((addressesData || []).map((item: any) => [item.user_id, item]));
  // A single job can reference either an order or a schedule — keyed by schedule_id either way
  const jobsMap = new Map((jobsData || []).map((item) => [item.schedule_id, item]));
  const driversMap = new Map((driversData || []).map((item) => [item.id, item]));

  // ── Map orders (one-time purchases) ─────────────────────────────────────────
  const orderRecords: DispatchOrderRecord[] = orders.map((order) => {
    const restaurant = order.restaurant_id ? restaurantsMap.get(order.restaurant_id) : undefined;
    const branch = order.restaurant_branch_id ? branchesMap.get(order.restaurant_branch_id) : undefined;
    const profile = order.user_id ? profilesMap.get(order.user_id) : undefined;
    const meal = order.meal_id ? mealsMap.get(order.meal_id) : undefined;
    const deliveryJob = jobsMap.get(order.id);
    const assignedDriver = deliveryJob?.driver_id ? driversMap.get(deliveryJob.driver_id) : undefined;

    return {
      id: order.id,
      createdAt: order.created_at,
      status: order.status,
      source: "order",
      mealScheduleId: null,
      restaurantId: order.restaurant_id,
      restaurantName: restaurant?.name || "Restaurant",
      restaurantAddress: restaurant?.address || null,
      branchId: order.restaurant_branch_id || null,
      branchName: branch?.name || null,
      branchAddress: branch?.address || null,
      customerName: profile?.full_name || "Customer",
      customerPhone: order.phone_number || null,
      mealName: meal?.name || "Meal",
      deliveryAddress: order.delivery_address,
      deliveryLat: order.delivery_lat,
      deliveryLng: order.delivery_lng,
      deliveryFee: order.delivery_fee || 0,
      totalAmount: order.total_amount || 0,
      tipAmount: order.tip_amount || 0,
      estimatedDeliveryTime: order.estimated_delivery_time,
      pickupAddress: branch?.address || restaurant?.address || null,
      pickupLat: branch?.latitude ?? restaurant?.latitude ?? null,
      pickupLng: branch?.longitude ?? restaurant?.longitude ?? null,
      assignmentStatus: deliveryJob?.status || null,
      existingJobId: deliveryJob?.id || null,
      assignedDriverId: deliveryJob?.driver_id || null,
      assignedDriverName: assignedDriver?.full_name || null,
    };
  });

  // ── Map meal_schedules (subscription meals ready for delivery) ──────────────
  const scheduleRecords: DispatchOrderRecord[] = schedules.map((schedule) => {
    const restaurant = schedule.restaurant_id ? restaurantsMap.get(schedule.restaurant_id) : undefined;
    const profile = profilesMap.get(schedule.user_id);
    const meal = mealsMap.get(schedule.meal_id);
    const address = addressesMap.get(schedule.user_id);
    const deliveryJob = jobsMap.get(schedule.id);
    const assignedDriver = deliveryJob?.driver_id ? driversMap.get(deliveryJob.driver_id) : undefined;

    const deliveryAddress = address
      ? [address.address_line1, address.address_line2, address.city].filter(Boolean).join(", ")
      : null;

    return {
      id: schedule.id,
      createdAt: schedule.created_at || new Date().toISOString(),
      status: schedule.order_status || "pending",
      source: "meal_schedule",
      mealScheduleId: schedule.id,
      restaurantId: schedule.restaurant_id,
      restaurantName: restaurant?.name || "Restaurant",
      restaurantAddress: restaurant?.address || null,
      branchId: null,
      branchName: null,
      branchAddress: null,
      customerName: profile?.full_name || "Subscriber",
      customerPhone: (address as any)?.phone || null,
      mealName: meal?.name || "Meal",
      deliveryAddress,
      deliveryLat: null,
      deliveryLng: null,
      deliveryFee: schedule.delivery_fee || 0,
      totalAmount: schedule.delivery_fee || 0,
      tipAmount: 0,
      estimatedDeliveryTime: null,
      pickupAddress: restaurant?.address || null,
      pickupLat: restaurant?.latitude ?? null,
      pickupLng: restaurant?.longitude ?? null,
      assignmentStatus: deliveryJob?.status || null,
      existingJobId: deliveryJob?.id || null,
      assignedDriverId: deliveryJob?.driver_id || null,
      assignedDriverName: assignedDriver?.full_name || null,
    };
  });

  return [...orderRecords, ...scheduleRecords];
}

export async function getDispatchDrivers(): Promise<DispatchDriverRecord[]> {
  const { data: driversData, error: driversError } = await supabase
    .from("drivers")
    .select("id, full_name, phone_number, rating, total_deliveries, is_online, is_active, current_lat, current_lng, last_location_update, approval_status")
    .eq("is_active", true)
    .order("is_online", { ascending: false });

  if (driversError) throw driversError;

  const drivers = driversData || [];
  if (drivers.length === 0) return [];

  const driverIds = drivers.map((driver) => driver.id);

  const [{ data: activeJobsData, error: activeJobsError }, { data: vehiclesData }] = await Promise.all([
    supabase
      .from("delivery_jobs")
      .select("id, driver_id, status, delivery_lat, delivery_lng, delivery_address")
      .in("driver_id", driverIds)
      .in("status", [...ACTIVE_DELIVERY_JOB_STATUSES]),
    supabase
      .from("vehicles")
      .select("assigned_driver_id, plate_number")
      .in("assigned_driver_id", driverIds),
  ]);

  if (activeJobsError) throw activeJobsError;

  const jobsByDriver = new Map<string, DispatchDriverActiveJob[]>();
  (activeJobsData || []).forEach((job) => {
    if (!job.driver_id) return;
    if (!jobsByDriver.has(job.driver_id)) jobsByDriver.set(job.driver_id, []);
    jobsByDriver.get(job.driver_id)?.push({
      id: job.id,
      status: job.status || "assigned",
      deliveryLat: job.delivery_lat,
      deliveryLng: job.delivery_lng,
      deliveryAddress: job.delivery_address,
    });
  });

  const plateByDriver = new Map<string, string>();
  (vehiclesData || []).forEach((v: any) => {
    if (v.assigned_driver_id && v.plate_number) plateByDriver.set(v.assigned_driver_id, v.plate_number);
  });

  return drivers.map((driver) => ({
    id: driver.id,
    fullName: driver.full_name || `Driver ${driver.phone_number?.slice(-4) || driver.id.slice(0, 8)}`,
    phone: driver.phone_number,
    rating: driver.rating,
    totalDeliveries: driver.total_deliveries,
    isOnline: Boolean(driver.is_online),
    isActive: Boolean(driver.is_active) && driver.approval_status === "approved",
    currentLat: driver.current_lat,
    currentLng: driver.current_lng,
    locationUpdatedAt: driver.last_location_update,
    activeJobs: jobsByDriver.get(driver.id) || [],
    vehiclePlate: plateByDriver.get(driver.id) || null,
  }));
}

export async function assignDispatchOrder(params: {
  orderId: string;
  driverId: string;
  managerId?: string | null;
  reason?: string;
  notes?: string;
  /** "order" (default) or "meal_schedule" */
  source?: "order" | "meal_schedule";
}): Promise<void> {
  const { orderId, driverId, managerId, reason, notes, source = "order" } = params;

  const now = new Date().toISOString();

  if (source === "meal_schedule") {
    // ── Branch: meal_schedule-sourced dispatch ──────────────────────────────
    const [scheduleResult, jobResult] = await Promise.all([
      supabase
        .from("meal_schedules")
        .select("id, restaurant_id, user_id, delivery_fee")
        .eq("id", orderId)
        .single(),
      supabase
        .from("delivery_jobs")
        .select("id, driver_id, status")
        .eq("schedule_id", orderId)
        .maybeSingle(),
    ]);

    if (scheduleResult.error) throw scheduleResult.error;
    if (jobResult.error) throw jobResult.error;

    const schedule = scheduleResult.data;
    const currentJob = jobResult.data;
    const currentStatus = currentJob?.status || null;

    if (currentStatus && [...CLOSED_DELIVERY_JOB_STATUSES].includes(currentStatus as (typeof CLOSED_DELIVERY_JOB_STATUSES)[number])) {
      throw new Error("This order can no longer be reassigned from the fleet portal.");
    }

    // Fetch pickup address from restaurant
    const { data: restaurantData } = schedule.restaurant_id
      ? await supabase.from("restaurants").select("address").eq("id", schedule.restaurant_id).maybeSingle()
      : { data: null };

    let jobId = currentJob?.id || null;
    const previousDriverId = currentJob?.driver_id || null;

    if (jobId) {
      const { error } = await supabase
        .from("delivery_jobs")
        .update({ driver_id: driverId, status: "assigned", assigned_at: now })
        .eq("id", jobId);
      if (error) throw error;
    } else {
      const { data: createdJob, error } = await supabase
        .from("delivery_jobs")
        .insert({
          // Correct FK: use meal_schedule.id so delivery_jobs properly links to meal_schedules
          schedule_id: schedule.id,
          restaurant_id: schedule.restaurant_id,
          pickup_address: restaurantData?.address || null,
          delivery_fee: schedule.delivery_fee,
          driver_earnings: schedule.delivery_fee,
          driver_id: driverId,
          status: "assigned",
          assigned_at: now,
        })
        .select("id")
        .single();
      if (error) throw error;
      jobId = createdJob.id;
    }

    // P2-B: Update meal_schedules.order_status so the partner portal sees the dispatch
    await supabase
      .from("meal_schedules")
      .update({ order_status: "out_for_delivery", updated_at: now })
      .eq("id", schedule.id);

    if (jobId) {
      const action = previousDriverId && previousDriverId !== driverId ? "reassigned" : "assigned";
      await supabase.from("driver_assignment_history").insert({
        action,
        driver_id: driverId,
        job_id: jobId,
        performed_by: managerId || null,
        reason: reason || "Manual dispatch from fleet portal",
        notes: notes || null,
      });
    }

    return;
  }

  // ── Branch: orders table (original one-time purchase flow) ─────────────────
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError) throw orderError;

  const order = orderData as RawOrder;

  const [jobResult, branchResult, restaurantResult] = await Promise.all([
    supabase
      .from("delivery_jobs")
      .select("id, driver_id, status")
      .eq("schedule_id", orderId)
      .maybeSingle(),
    order.restaurant_branch_id
      ? supabase
          .from("restaurant_branches")
          .select("address")
          .eq("id", order.restaurant_branch_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    order.restaurant_id
      ? supabase
          .from("restaurants")
          .select("address")
          .eq("id", order.restaurant_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (jobResult.error) throw jobResult.error;
  if (branchResult.error) throw branchResult.error;
  if (restaurantResult.error) throw restaurantResult.error;

  const pickupAddress = branchResult.data?.address || restaurantResult.data?.address || null;

  let jobId = jobResult.data?.id || null;
  const previousDriverId = jobResult.data?.driver_id || null;
  const currentStatus = jobResult.data?.status || null;

  if (currentStatus && [...CLOSED_DELIVERY_JOB_STATUSES].includes(currentStatus as (typeof CLOSED_DELIVERY_JOB_STATUSES)[number])) {
    throw new Error("This order can no longer be reassigned from the fleet portal.");
  }

  if (jobId) {
    const { error: updateJobError } = await supabase
      .from("delivery_jobs")
      .update({
        driver_id: driverId,
        status: "assigned",
        assigned_at: now,
      })
      .eq("id", jobId);

    if (updateJobError) throw updateJobError;
  } else {
    const { data: createdJob, error: createJobError } = await supabase
      .from("delivery_jobs")
      .insert({
        schedule_id: order.id,
        restaurant_id: order.restaurant_id,
        pickup_address: pickupAddress,
        delivery_address: order.delivery_address,
        delivery_lat: order.delivery_lat,
        delivery_lng: order.delivery_lng,
        delivery_fee: order.delivery_fee,
        tip_amount: order.tip_amount,
        driver_earnings: order.delivery_fee,
        driver_id: driverId,
        status: "assigned",
        assigned_at: now,
      })
      .select("id")
      .single();

    if (createJobError) throw createJobError;

    jobId = createdJob.id;
  }

  await supabase
    .from("orders")
    .update({ driver_id: driverId })
    .eq("id", order.id);

  await supabase
    .from("delivery_queue")
    .update({
      assigned_driver_id: driverId,
      assigned_at: now,
      manual_assignment_notes: reason || "Assigned from fleet portal",
    })
    .eq("order_id", order.id);

  if (jobId) {
    const action = previousDriverId && previousDriverId !== driverId ? "reassigned" : "assigned";

    await supabase.from("driver_assignment_history").insert({
      action,
      driver_id: driverId,
      job_id: jobId,
      performed_by: managerId || null,
      reason: reason || "Manual dispatch from fleet portal",
      notes: notes || null,
    });
  }
}

// ─── Auto-dispatch rule helpers ───────────────────────────────────────────────

export interface AutoDispatchRule {
  id: string;
  label: string;
  enabled: boolean;
  triggerStatus: "ready_for_pickup" | "preparing";
  minWaitMinutes: number;
  maxDriverDistanceKm: number;
}

const AUTO_DISPATCH_STORAGE_KEY = "fleet_auto_dispatch_rules";

export function loadAutoDispatchRules(): AutoDispatchRule[] {
  try {
    const raw = localStorage.getItem(AUTO_DISPATCH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AutoDispatchRule[]) : [];
  } catch {
    return [];
  }
}

export function saveAutoDispatchRules(rules: AutoDispatchRule[]): void {
  localStorage.setItem(AUTO_DISPATCH_STORAGE_KEY, JSON.stringify(rules));
}

// ─── Route-plan lock ────────────────────────────────────────────────────────
// When Route Optimization has an active unconfirmed plan, it sets this flag
// so the Auto-Dispatch runner pauses and avoids assigning the same orders.

const ROUTE_PLAN_LOCK_KEY = "fleet_route_plan_active";

export function setRoutePlanLock(active: boolean): void {
  if (active) {
    localStorage.setItem(ROUTE_PLAN_LOCK_KEY, "1");
  } else {
    localStorage.removeItem(ROUTE_PLAN_LOCK_KEY);
  }
}

export function isRoutePlanLocked(): boolean {
  return localStorage.getItem(ROUTE_PLAN_LOCK_KEY) === "1";
}

// ─── Realtime subscription ─────────────────────────────────────────────────────

/** Returns a teardown function. Calls `onChanged` whenever a dispatchable order/schedule is added/updated/removed. */
export function subscribeToDispatchOrders(onChanged: () => void): () => void {
  // Channel 1: one-time orders
  const ordersChannel = supabase
    .channel("dispatch-orders-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => {
        const newStatus = (payload.new as { status?: string } | null)?.status;
        const oldStatus = (payload.old as { status?: string } | null)?.status;
        const dispatchable = (s?: string) => s === "preparing" || s === "ready_for_pickup";
        if (dispatchable(newStatus) || dispatchable(oldStatus)) {
          onChanged();
        }
      }
    )
    .subscribe();

  // Channel 2: subscription meal_schedules
  const schedulesChannel = supabase
    .channel("dispatch-schedules-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "meal_schedules" },
      (payload) => {
        const newStatus = (payload.new as { order_status?: string } | null)?.order_status;
        const oldStatus = (payload.old as { order_status?: string } | null)?.order_status;
        const dispatchable = (s?: string) => s === "preparing" || s === "ready";
        if (dispatchable(newStatus) || dispatchable(oldStatus)) {
          onChanged();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(ordersChannel);
    supabase.removeChannel(schedulesChannel);
  };
}

export async function getDispatchActivity(limit = 10): Promise<DispatchActivityRecord[]> {
  const { data: historyData, error: historyError } = await supabase
    .from("driver_assignment_history")
    .select("*")
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (historyError) throw historyError;

  const history = historyData || [];
  if (history.length === 0) return [];

  const driverIds = Array.from(new Set(history.map((item) => item.driver_id).filter(Boolean)));
  const jobIds = Array.from(new Set(history.map((item) => item.job_id).filter(Boolean)));

  const [{ data: driversData, error: driversError }, { data: jobsData, error: jobsError }] = await Promise.all([
    driverIds.length > 0
      ? supabase.from("drivers").select("id, full_name, phone_number").in("id", driverIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length > 0
      ? supabase.from("delivery_jobs").select("id, schedule_id, status").in("id", jobIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driversError) throw driversError;
  if (jobsError) throw jobsError;

  const driversMap = new Map((driversData || []).map((item) => [item.id, item]));
  const jobsMap = new Map((jobsData || []).map((item) => [item.id, item]));

  return history.map((item) => {
    const job = item.job_id ? jobsMap.get(item.job_id) : undefined;
    return {
      id: item.id,
      action: item.action,
      performedAt: item.performed_at,
      reason: item.reason,
      notes: (item as Record<string, unknown>).notes as string | null ?? null,
      driverName:
        (item.driver_id ? driversMap.get(item.driver_id)?.full_name : null) ||
        (item.driver_id ? driversMap.get(item.driver_id)?.phone_number : null) ||
        "Driver",
      orderId: job?.schedule_id || null,
      jobStatus: (job as { status?: string } | undefined)?.status || null,
    };
  });
}
