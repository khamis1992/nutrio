import { 
  SadadPaymentRequest, 
  SadadPaymentResponse
} from './sadad';
import { 
  SimulationConfig, 
  defaultSimulationConfig,
  PaymentMethod 
} from './payment-simulation-config';

// Simulated payment record
export interface SimulatedPayment {
  paymentId: string;
  orderId: string;
  amount: number;
  status: 'pending' | 'processing' | '3d_secure' | 'success' | 'failed' | 'cancelled';
  method: PaymentMethod;
  createdAt: Date;
  completedAt?: Date;
  failureReason?: string;
  transactionId?: string;
  cardLast4?: string;
}

class PaymentSimulationService {
  private config: SimulationConfig;
  private payments: Map<string, SimulatedPayment> = new Map();
  private listeners: Set<(payment: SimulatedPayment) => void> = new Set();

  constructor(config: SimulationConfig = defaultSimulationConfig) {
    this.config = config;
  }

  isSimulationMode(): boolean {
    return this.config.enabled;
  }

  // Simulate creating a payment
  async createPayment(request: SadadPaymentRequest): Promise<SadadPaymentResponse> {
    if (!this.config.enabled) {
      throw new Error('Simulation not enabled');
    }

    // Artificial delay
    await this.delay();

    const paymentId = `SIM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const payment: SimulatedPayment = {
      paymentId,
      orderId: request.order_id,
      amount: request.amount,
      status: 'pending',
      method: 'credit_card', // Default, can be overridden
      createdAt: new Date(),
    };

    this.payments.set(paymentId, payment);

    // Return simulated response
    return {
      payment_id: paymentId,
      payment_url: `${window.location.origin}/checkout/simulated?paymentId=${paymentId}`,
      status: 'pending',
      expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
    };
  }

  // Simulate 3D Secure check
  async initiate3DSecure(paymentId: string): Promise<{
    requires3D: boolean;
    redirectUrl?: string;
  }> {
    await this.delay(1000, 2000);
    
    if (!this.config.enable3DSecure) {
      return { requires3D: false };
    }

    // 50% chance of requiring 3D Secure
    const requires3D = Math.random() > 0.5;
    
    if (requires3D) {
      this.updatePaymentStatus(paymentId, '3d_secure');
      return {
        requires3D: true,
        redirectUrl: `${window.location.origin}/checkout/3d-secure?paymentId=${paymentId}`,
      };
    }

    return { requires3D: false };
  }

  // Simulate verifying 3D Secure OTP
  async verify3DSecure(paymentId: string, otp: string): Promise<boolean> {
    await this.delay(1500, 3000);
    
    // In simulation, any 6-digit code works
    const isValid = /^\d{6}$/.test(otp);
    
    if (isValid) {
      this.updatePaymentStatus(paymentId, 'processing');
    }
    
    return isValid;
  }

  // Process the payment (final step)
  async processPayment(paymentId: string): Promise<{
    success: boolean;
    transactionId?: string;
    failureReason?: string;
  }> {
    await this.delay(2000, 4000);

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // Determine success based on config
    const isSuccess = Math.random() < this.config.successRate;

    if (isSuccess) {
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.updatePaymentStatus(paymentId, 'success', { transactionId });
      return { success: true, transactionId };
    } else {
      const failureReasons = [
        'Insufficient funds',
        'Card expired',
        'Bank declined transaction',
        'Invalid CVV',
        'Transaction timeout',
      ];
      const failureReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
      this.updatePaymentStatus(paymentId, 'failed', { failureReason });
      return { success: false, failureReason };
    }
  }

  // Get payment status
  getPaymentStatus(paymentId: string): SimulatedPayment | undefined {
    return this.payments.get(paymentId);
  }

  // Subscribe to payment updates
  subscribe(callback: (payment: SimulatedPayment) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Force specific outcome (for testing)
  forceOutcome(paymentId: string, outcome: 'success' | 'failed'): void {
    const payment = this.payments.get(paymentId);
    if (payment) {
      if (outcome === 'success') {
        this.updatePaymentStatus(paymentId, 'success', {
          transactionId: `TXN-${Date.now()}-FORCED`,
        });
      } else {
        this.updatePaymentStatus(paymentId, 'failed', {
          failureReason: 'Forced failure for testing',
        });
      }
    }
  }

  // Cancel payment
  cancelPayment(paymentId: string): void {
    this.updatePaymentStatus(paymentId, 'cancelled');
  }

  // Get all payments (for debugging)
  getAllPayments(): SimulatedPayment[] {
    return Array.from(this.payments.values());
  }

  // Update configuration
  updateConfig(newConfig: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Private helpers
  private async delay(min = this.config.artificialDelay.min, max = this.config.artificialDelay.max): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private updatePaymentStatus(
    paymentId: string, 
    status: SimulatedPayment['status'],
    extras?: Partial<SimulatedPayment>
  ): void {
    const payment = this.payments.get(paymentId);
    if (payment) {
      payment.status = status;
      if (status === 'success' || status === 'failed' || status === 'cancelled') {
        payment.completedAt = new Date();
      }
      Object.assign(payment, extras);
      this.notifyListeners(payment);
    }
  }

  private notifyListeners(payment: SimulatedPayment): void {
    this.listeners.forEach(callback => callback(payment));
  }
}

// Singleton instance
export const paymentSimulation = new PaymentSimulationService();

// Factory function for custom config
export function createPaymentSimulation(config: SimulationConfig): PaymentSimulationService {
  return new PaymentSimulationService(config);
}

// Helper to check if simulation is enabled
export function isPaymentSimulationEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_PAYMENT_SIMULATION === 'true';
}
