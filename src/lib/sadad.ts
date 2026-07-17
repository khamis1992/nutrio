import { supabase } from "@/integrations/supabase/client";

export type SadadPaymentType = "wallet_topup" | "subscription" | "coach_subscription";

// Kept for the isolated development-only simulator. Production checkout does
// not use these caller-priced request/response shapes.
export interface SadadPaymentRequest {
  amount: number;
  orderId: string;
  customerId: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  successUrl: string;
  failureUrl: string;
}

export interface SadadPaymentResponse {
  payment_id: string;
  payment_url: string;
  status: string;
  expiry_time?: string;
}

export interface SadadCheckoutResponse {
  payment_id: string;
  amount: number;
  currency: string;
  payment_type: SadadPaymentType;
  description: string;
  metadata?: Record<string, unknown>;
  form_action: string;
  form_method: "POST";
  fields: Record<string, string | number>;
}

export interface SadadPaymentStatus {
  payment_id: string;
  amount: number;
  currency: string;
  payment_type: SadadPaymentType;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  fulfillment_status: "pending" | "completed" | "failed";
  description: string | null;
  metadata: Record<string, unknown>;
  transaction_id: string | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

interface FunctionErrorPayload {
  error?: string;
}

interface FunctionInvokeError extends Error {
  context?: {
    clone?: () => { json: () => Promise<unknown> };
    json?: () => Promise<unknown>;
  };
}

async function readFunctionError(error: FunctionInvokeError | null): Promise<string | undefined> {
  if (!error?.context) return error?.message;

  try {
    const context = error.context.clone?.() ?? error.context;
    const payload = await context.json?.() as FunctionErrorPayload | undefined;
    return payload?.error || error.message;
  } catch {
    return error.message;
  }
}

async function getFunctionError(
  fallback: string,
  result: FunctionErrorPayload | null | undefined,
  invokeError: FunctionInvokeError | null,
): Promise<Error> {
  return new Error(result?.error || await readFunctionError(invokeError) || fallback);
}

class SadadService {
  async createPayment(input: {
    paymentType: SadadPaymentType;
    referenceId: string;
    mobileNumber: string;
    subscriptionId?: string;
    coachPlan?: "weekly" | "monthly";
    language?: "ar" | "en";
  }): Promise<SadadCheckoutResponse> {
    const { data, error } = await supabase.functions.invoke("sadad-payment", {
      body: {
        op: "create",
        payload: input,
      },
    });

    const result = data as (SadadCheckoutResponse & FunctionErrorPayload) | null;
    if (error || !result || result.error) {
      throw await getFunctionError("SADAD_PAYMENT_CREATION_FAILED", result, error);
    }

    return result;
  }

  submitHostedCheckout(checkout: SadadCheckoutResponse): void {
    const form = document.createElement("form");
    form.method = checkout.form_method;
    form.action = checkout.form_action;
    form.style.display = "none";

    Object.entries(checkout.fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  }

  async getPaymentStatus(paymentId: string): Promise<SadadPaymentStatus> {
    const { data, error } = await supabase.functions.invoke("sadad-payment", {
      body: {
        op: "status",
        payload: { paymentId },
      },
    });

    const result = data as (SadadPaymentStatus & FunctionErrorPayload) | null;
    if (error || !result || (result.error && !result.payment_id)) {
      throw await getFunctionError("SADAD_STATUS_LOOKUP_FAILED", result, error);
    }

    return result;
  }
}

export const sadadService = new SadadService();
