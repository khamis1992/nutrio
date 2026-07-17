import { supabase } from "@/integrations/supabase/client";
import {
  enqueueOfflineMutation,
  flushOfflineMutations,
  isNetworkFailure,
  type OfflineMutation,
} from "@/lib/offline-mutation-queue";

export interface ScheduleMealAddonInput {
  addon_id: string;
  quantity: number;
}

export interface ScheduleMealInput {
  meal_id: string;
  scheduled_date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  delivery_address_id?: string | null;
  delivery_time_slot?: string | null;
  delivery_quote_id?: string | null;
  customization_data?: Record<string, unknown>;
  restaurant_note?: string | null;
  addons?: ScheduleMealAddonInput[];
  schedule_source?: "customer" | "coach_program" | "coach_replacement";
  coach_program_id?: string;
  program_meal_id?: string;
  coach_suggested_meal_id?: string;
  coach_replacement_status?: "followed" | "replaced";
  coach_replacement_delta?: Record<string, number>;
}

export interface ScheduleMealsResult {
  success: boolean;
  already_processed: boolean;
  schedule_ids: string[];
}

export interface QueuedScheduleMealsResult {
  success: false;
  queued: true;
  already_processed: false;
  schedule_ids: [];
  requestBatchId: string;
}

const SCHEDULE_MEALS_ERROR_CODES = [
  "AUTHENTICATION_REQUIRED",
  "SUBSCRIPTION_NOT_FOUND",
  "SCHEDULE_DATE_INVALID",
  "MEAL_NOT_AVAILABLE",
  "MEAL_NOT_OFFERED_FOR_PERIOD",
  "DELIVERY_ADDRESS_NOT_FOUND",
  "MEAL_QUOTA_EXHAUSTED",
  "SNACK_QUOTA_EXHAUSTED",
] as const;

export type ScheduleMealsErrorCode = (typeof SCHEDULE_MEALS_ERROR_CODES)[number];

/** Extracts the database error identifier from Error and PostgREST error objects. */
export function getScheduleMealsErrorCode(error: unknown): ScheduleMealsErrorCode | null {
  const messages: string[] = [];

  if (error instanceof Error) messages.push(error.message);
  if (typeof error === "string") messages.push(error);

  if (error && typeof error === "object") {
    const postgrestError = error as Record<string, unknown>;
    for (const field of ["message", "details", "hint", "code"] as const) {
      if (typeof postgrestError[field] === "string") messages.push(postgrestError[field]);
    }
  }

  const combinedMessage = messages.join(" ").toUpperCase();
  return SCHEDULE_MEALS_ERROR_CODES.find((code) => combinedMessage.includes(code)) ?? null;
}

interface QueuedSchedulePayload {
  userId: string;
  subscriptionId: string;
  items: ScheduleMealInput[];
  requestBatchId: string;
}

export async function scheduleMealsAtomic(
  subscriptionId: string,
  items: ScheduleMealInput[],
  requestBatchId: string = crypto.randomUUID(),
): Promise<ScheduleMealsResult> {
  const rpcItems = items.map(({ delivery_quote_id, customization_data, ...item }) => ({
    ...item,
    customization_data: delivery_quote_id
      ? { ...(customization_data || {}), _delivery_quote_id: delivery_quote_id }
      : customization_data,
  }));

  const { data, error } = await supabase.rpc(
    "schedule_meals_atomic" as never,
    {
      p_subscription_id: subscriptionId,
      p_items: rpcItems,
      p_request_batch_id: requestBatchId,
    } as never,
  );

  if (error) throw error;

  const result = data as unknown as ScheduleMealsResult | null;
  if (!result?.success || !Array.isArray(result.schedule_ids)) {
    throw new Error("MEAL_SCHEDULING_FAILED");
  }

  return result;
}

export async function scheduleMealsResilient(
  userId: string,
  subscriptionId: string,
  items: ScheduleMealInput[],
  requestBatchId: string = crypto.randomUUID(),
): Promise<ScheduleMealsResult | QueuedScheduleMealsResult> {
  if (!userId) throw new Error("USER_REQUIRED");
  if (items.length === 0) throw new Error("SCHEDULE_ITEMS_REQUIRED");

  const payload: QueuedSchedulePayload = { userId, subscriptionId, items, requestBatchId };
  const queue = (): QueuedScheduleMealsResult => {
    enqueueOfflineMutation({
      id: requestBatchId,
      kind: "schedule-meals",
      userId,
      payload,
    });
    return { success: false, queued: true, already_processed: false, schedule_ids: [], requestBatchId };
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) return queue();

  try {
    return await scheduleMealsAtomic(subscriptionId, items, requestBatchId);
  } catch (error) {
    if (isNetworkFailure(error)) return queue();
    throw error;
  }
}

export async function flushQueuedSchedules(userId: string) {
  return flushOfflineMutations(userId, {
    "schedule-meals": async (mutation: OfflineMutation) => {
      const payload = mutation.payload as QueuedSchedulePayload;
      await scheduleMealsAtomic(payload.subscriptionId, payload.items, payload.requestBatchId);
    },
  });
}
