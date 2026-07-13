import { supabase } from "@/integrations/supabase/client";

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

export async function scheduleMealsAtomic(
  subscriptionId: string,
  items: ScheduleMealInput[],
  requestBatchId = crypto.randomUUID(),
): Promise<ScheduleMealsResult> {
  const { data, error } = await supabase.rpc(
    "schedule_meals_atomic" as never,
    {
      p_subscription_id: subscriptionId,
      p_items: items,
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
