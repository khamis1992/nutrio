// Sadad Payment Gateway Integration for Qatar
// Documentation: https://developer.sadad.qa/

import { createHmac } from 'crypto';

const SADAD_API_URL = import.meta.env.VITE_SADAD_API_URL || 'https://api.sadad.qa';
const SADAD_MERCHANT_ID = import.meta.env.VITE_SADAD_MERCHANT_ID;
const SADAD_SECRET_KEY = import.meta.env.VITE_SADAD_SECRET_KEY;

export interface SadadPaymentRequest {
  merchant_id: string;
  amount: number;
  currency: string;
  order_id: string;
  customer_id: string;
  customer_email?: string;
  customer_phone?: string;
  callback_url: string;
  success_url: string;
  failure_url: string;
  description?: string;
}

export interface SadadPaymentResponse {
  payment_id: string;
  payment_url: string;
  status: string;
  expiry_time?: string;
}

export interface SadadCallbackData {
  payment_id: string;
  order_id: string;
  status: 'success' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  transaction_id?: string;
  signature?: string;
}

class SadadService {
  private apiUrl: string;
  private merchantId: string | undefined;
  private secretKey: string | undefined;

  constructor() {
    this.apiUrl = SADAD_API_URL;
    this.merchantId = SADAD_MERCHANT_ID;
    this.secretKey = SADAD_SECRET_KEY;
  }

  isConfigured(): boolean {
    return !!(this.merchantId && this.secretKey);
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
    if (!this.isConfigured()) {
      throw new Error('Sadad payment gateway is not configured');
    }

    const request: SadadPaymentRequest = {
      merchant_id: this.merchantId!,
      amount: data.amount,
      currency: 'QAR',
      order_id: data.orderId,
      customer_id: data.customerId,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      callback_url: `${window.location.origin}/api/payment/callback`,
      success_url: data.successUrl,
      failure_url: data.failureUrl,
      description: data.description || 'Wallet Top-up',
    };

    try {
      const response = await fetch(`${this.apiUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Sadad API error: ${error}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Sadad payment creation failed:', error);
      throw error;
    }
  }

  verifyCallback(callbackData: SadadCallbackData): boolean {
    if (!this.secretKey) {
      console.error('Sadad secret key not configured');
      return false;
    }

    // Verify signature if provided
    if (callbackData.signature) {
      // Implementation depends on Sadad's signature verification method
      // This is a placeholder - implement according to Sadad documentation
      const expectedSignature = this.generateSignature(callbackData);
      return callbackData.signature === expectedSignature;
    }

    return callbackData.status === 'success';
  }

  private generateSignature(data: SadadCallbackData): string {
    // Implement signature generation according to Sadad documentation
    // This is a placeholder implementation
    const payload = `${data.payment_id}|${data.order_id}|${data.status}|${data.amount}`;
    return createHmac('sha256', this.secretKey!)
      .update(payload)
      .digest('hex');
  }

  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    amount: number;
    transactionId?: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Sadad payment gateway is not configured');
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get payment status');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get payment status:', error);
      throw error;
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<{
    refundId: string;
    status: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Sadad payment gateway is not configured');
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new Error('Refund failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Refund failed:', error);
      throw error;
    }
  }
}

export const sadadService = new SadadService();

// Helper function for frontend to initiate payment
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
    description: `Wallet Top-up - ${params.amount} QAR${params.bonusAmount ? ` + ${params.bonusAmount} QAR bonus` : ''}`,
    successUrl: `${window.location.origin}/wallet?payment=success&order=${orderId}`,
    failureUrl: `${window.location.origin}/wallet?payment=failed&order=${orderId}`,
  });

  return {
    paymentId: response.payment_id,
    paymentUrl: response.payment_url,
  };
}
