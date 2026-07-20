export interface MealDeliveryAvailability {
  deliveryAvailable: boolean | null;
  deliveryMinutes: number | null;
  routedAt: string | null;
}

interface AvailabilityInput {
  generatedAt: string;
  operatingHours: unknown;
  restaurantPrepMinutes: number | null;
  routingResult: unknown;
}

interface RoutingCandidate {
  avg_prep_time_minutes?: unknown;
  branch_id?: unknown;
  distance_km?: unknown;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function timeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function qatarDateParts(isoDate: string) {
  const date = new Date(isoDate);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Qatar",
    weekday: "long",
  }).format(date).toLowerCase();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Qatar",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { weekday, minutes: hour * 60 + minute };
}

export function restaurantOpenState(
  operatingHours: unknown,
  generatedAt: string,
): boolean | null {
  const schedule = objectRecord(operatingHours);
  if (!schedule) return null;

  const { weekday, minutes } = qatarDateParts(generatedAt);
  const day = objectRecord(schedule[weekday]);
  if (!day) return null;
  if (day.is_open === false) return false;

  const open = timeToMinutes(day.open ?? day.open_time);
  const close = timeToMinutes(day.close ?? day.close_time);
  if (open === null || close === null) return null;
  if (open === close) return true;
  return close > open
    ? minutes >= open && minutes < close
    : minutes >= open || minutes < close;
}

function selectedRoutingCandidate(
  route: Record<string, unknown>,
): RoutingCandidate | null {
  const branchId = typeof route.branch_id === "string" ? route.branch_id : null;
  if (!branchId || !Array.isArray(route.candidates)) return null;
  return (
    route.candidates.find((candidate) => {
      const record = objectRecord(candidate);
      return record?.branch_id === branchId;
    }) as RoutingCandidate | undefined
  ) ?? null;
}

export function deriveMealDeliveryAvailability({
  generatedAt,
  operatingHours,
  restaurantPrepMinutes,
  routingResult,
}: AvailabilityInput): MealDeliveryAvailability {
  const route = objectRecord(routingResult);
  if (!route) {
    return { deliveryAvailable: null, deliveryMinutes: null, routedAt: null };
  }

  const status = typeof route.status === "string" ? route.status : "unknown";
  const openState = restaurantOpenState(operatingHours, generatedAt);
  const routeAvailable = status === "routed" || status === "single_kitchen"
    ? true
    : status === "manual_review"
      ? false
      : null;
  const deliveryAvailable = routeAvailable === false || openState === false
    ? false
    : routeAvailable === true && openState === true
      ? true
      : null;

  const candidate = selectedRoutingCandidate(route);
  const prepMinutes = finiteNumber(candidate?.avg_prep_time_minutes)
    ?? finiteNumber(restaurantPrepMinutes);
  const distanceKm = finiteNumber(candidate?.distance_km);
  const travelMinutes = distanceKm === null ? null : Math.ceil(distanceKm * 3);
  const deliveryMinutes = prepMinutes === null
    ? null
    : prepMinutes + (travelMinutes ?? 0);

  return {
    deliveryAvailable,
    deliveryMinutes,
    routedAt: typeof route.routed_at === "string" ? route.routed_at : null,
  };
}

export function recommendationSlot(generatedAt: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Qatar",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(generatedAt));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  if (hour >= 5 && hour < 11) return { mealType: "breakfast", timeSlot: "8:00 AM" };
  if (hour >= 11 && hour < 15) return { mealType: "lunch", timeSlot: "12:00 PM" };
  if (hour >= 15 && hour < 18) return { mealType: "snack", timeSlot: "4:00 PM" };
  return { mealType: "dinner", timeSlot: "7:00 PM" };
}
