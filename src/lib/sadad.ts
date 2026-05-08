// Sadad Payment Gateway client — proxies to the `sadad-payment` Supabase edge function.
// All secrets (SADAD_MERCHANT_ID, SADAD_SECRET_KEY, SADAD_API_URL) live server-side now.
// Documentation: https://developer.sadad.qa/

import { supabase } from "@/integrations/supabase/client";

export interface SadadPaymentResponse {
  payment_id: string;
  payment_url: string;
  status: string;
  expiry_time?: string;
}

export interface SadadCallbackData {
  payment_id: string;
  order_id: string;
  status: "success" | "failed" | "cancelled";
  amount: number;
  currency: string;
  transaction_id?: string;
  signature?: string;
}

class SadadService {
  // Configuration is server-side only; the client cannot determine "is configured".
  // We assume the function is deployed when this code runs in production.
  isConfigured(): boolean {
    return true;
  }

  async createPayment(data: {
    amount: number;
    orderId: string;
    customerId: string;
    customerEmail?: string;
    customerPhone?: string;
    description?: string;
    successUrl: string;
    failureUrl: string;
  }): Promise<SadadPaymentResponse> {
    const { data: result, error } = await supabase.functions.invoke("sadad-payment", {
      body: {
        op: "create",
        payload: {
          amount: data.amount,
          orderId: data.orderId,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          description: data.description ?? "Wallet Top-up",
          successUrl: data.successUrl,
          failureUrl: data.failureUrl,
          callbackUrl: `${window.location.origin}/api/payment/callback`,
        },
      },
    });

    if (error || !result || result.error) {
      throw new Error(error?.message ?? result?.error ?? "Sadad create failed");
    }

    return result as SadadPaymentResponse;
  }

  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    amount: number;
    transactionId?: string;
  }> {
    const { data, error } = await supabase.functions.invoke("sadad-payment", {
      body: { op: "status", payload: { paymentId } },
    });
    if (error || !data || data.error) {
      throw new Error(error?.message ?? data?.error ?? "Status lookup failed");
    }
    return data;
  }

  async refundPayment(paymentId: string, amount?: number): Promise<{
    refundId: string;
    status: string;
  }> {
    const { data, error } = await supabase.functions.invoke("sadad-payment", {
      body: { op: "refund", payload: { paymentId, amount } },
    });
    if (error || !data || data.error) {
      throw new Error(error?.message ?? data?.error ?? "Refund failed");
    }
    return data;
  }
}

export const sadadService = new SadadService();

export async function initiateSadadPayment(params: {
  amount: number;
  bonusAmount?: number;
  packageId: string;
  userId: string;
  userEmail?: string;
  userPhone?: string;
}): Promise<{ paymentId: string; paymentUrl: string }> {
  const orderId = `WAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const response = await sadadService.createPayment({
    amount: params.amount,
    orderId,
    customerId: params.userId,
    customerEmail: params.userEmail,
    customerPhone: params.userPhone,
    description: `Wallet Top-up - ${params.amount} QAR${params.bonusAmount ? ` + ${params.bonusAmount} QAR bonus` : ""}`,
    successUrl: `${window.location.origin}/wallet?payment=success&order=${orderId}`,
    failureUrl: `${window.location.origin}/wallet?payment=failed&order=${orderId}`,
  });

  return {
    paymentId: response.payment_id,
    paymentUrl: response.payment_url,
  };
}
