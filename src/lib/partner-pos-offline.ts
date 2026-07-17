import { supabase } from "@/integrations/supabase/client";
import {
  enqueueOfflineMutation,
  flushOfflineMutations,
  isNetworkFailure,
  readOfflineMutations,
  removeOfflineMutation,
  type OfflineMutation,
} from "@/lib/offline-mutation-queue";

export interface PartnerPosMenuItem {
  id: string;
  name: string;
  price: number | null;
  image_url?: string | null;
}

export interface PartnerPosOrderItem {
  mealId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface PartnerPosOrderPayload {
  restaurantId: string;
  restaurantName: string;
  items: PartnerPosOrderItem[];
  customerName?: string;
  phoneNumber?: string;
  notes?: string;
  totalAmount: number;
  createdAt: string;
}

export type PartnerPosOfflineOrder = OfflineMutation<PartnerPosOrderPayload>;

type PosRpcResult = {
  success?: boolean;
  order_id?: string;
};

const POS_KIND = "partner-pos-order" as const;

function normalizeQuantity(quantity: number) {
  return Math.max(1, Math.min(99, Math.round(Number(quantity) || 1)));
}

function normalizeMoney(value: number | null | undefined) {
  return Math.max(0, Number(value || 0));
}

export function createPartnerPosOrderPayload(params: {
  restaurantId: string;
  restaurantName: string;
  items: Array<{ meal: PartnerPosMenuItem; quantity: number }>;
  customerName?: string;
  phoneNumber?: string;
  notes?: string;
}): PartnerPosOrderPayload {
  const items = params.items
    .map(({ meal, quantity }) => ({
      mealId: meal.id,
      name: meal.name,
      quantity: normalizeQuantity(quantity),
      unitPrice: normalizeMoney(meal.price),
    }))
    .filter((item) => item.quantity > 0);

  if (items.length === 0) throw new Error("POS_CART_EMPTY");

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  return {
    restaurantId: params.restaurantId,
    restaurantName: params.restaurantName,
    items,
    customerName: params.customerName?.trim() || undefined,
    phoneNumber: params.phoneNumber?.trim() || undefined,
    notes: params.notes?.trim() || undefined,
    totalAmount,
    createdAt: new Date().toISOString(),
  };
}

export function enqueuePartnerPosOrder(params: {
  userId: string;
  requestId?: string;
  payload: PartnerPosOrderPayload;
}) {
  const id = params.requestId || crypto.randomUUID();
  return enqueueOfflineMutation<PartnerPosOrderPayload>({
    id,
    kind: POS_KIND,
    userId: params.userId,
    payload: params.payload,
  });
}

export function readPartnerPosOrders(userId: string, restaurantId?: string | null) {
  return readOfflineMutations()
    .filter((item): item is PartnerPosOfflineOrder =>
      item.kind === POS_KIND &&
      item.userId === userId &&
      (!restaurantId || (item.payload as PartnerPosOrderPayload).restaurantId === restaurantId),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function syncPartnerPosOrder(mutation: PartnerPosOfflineOrder) {
  const payload = mutation.payload;
  const { data, error } = await (supabase as unknown as {
    rpc: (
      functionName: "partner_create_pos_order",
      args: {
        p_client_request_id: string;
        p_restaurant_id: string;
        p_items: PartnerPosOrderItem[];
        p_customer_name?: string | null;
        p_phone_number?: string | null;
        p_notes?: string | null;
      },
    ) => Promise<{ data: PosRpcResult | null; error: Error | null }>;
  }).rpc("partner_create_pos_order", {
    p_client_request_id: mutation.id,
    p_restaurant_id: payload.restaurantId,
    p_items: payload.items,
    p_customer_name: payload.customerName || null,
    p_phone_number: payload.phoneNumber || null,
    p_notes: payload.notes || null,
  });

  if (error) throw error;
  if (!data?.success) throw new Error("POS_SYNC_FAILED");
}

export async function flushPartnerPosOrders(userId: string) {
  return flushOfflineMutations(userId, {
    [POS_KIND]: (mutation) => syncPartnerPosOrder(mutation as PartnerPosOfflineOrder),
  });
}

export async function syncOrQueuePartnerPosOrder(params: {
  userId: string;
  requestId?: string;
  payload: PartnerPosOrderPayload;
}) {
  const queued = enqueuePartnerPosOrder(params);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { queued, synced: false };
  }

  try {
    await syncPartnerPosOrder(queued);
    removeOfflineMutation(queued.id);
    return { queued, synced: true };
  } catch (error) {
    if (isNetworkFailure(error)) return { queued, synced: false };
    throw error;
  }
}
