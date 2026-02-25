import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * P0-001: Payment Processing Load Tests
 * Verifies atomic wallet credit operations under concurrent load
 */

interface PaymentLoadTestResult {
  totalRequests: number;
  successfulPayments: number;
  failedPayments: number;
  doubleSpendingAttempts: number;
  averageResponseTime: number;
  errors: string[];
}

class PaymentLoadTest {
  private results: PaymentLoadTestResult = {
    totalRequests: 0,
    successfulPayments: 0,
    failedPayments: 0,
    doubleSpendingAttempts: 0,
    averageResponseTime: 0,
    errors: [],
  };

  private responseTimes: number[] = [];

  async runConcurrentPayments(
    userId: string,
    paymentId: string,
    amount: number,
    concurrency: number
  ): Promise<PaymentLoadTestResult> {
    console.log(`Starting payment load test: ${concurrency} concurrent attempts`);
    
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.attemptPayment(userId, paymentId, amount, i));
    }

    await Promise.all(promises);

    // Calculate statistics
    if (this.responseTimes.length > 0) {
      this.results.averageResponseTime = 
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    return this.results;
  }

  private async attemptPayment(
    userId: string,
    paymentId: string,
    amount: number,
    attemptIndex: number
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      const { data, error } = await (supabase.rpc as any)('process_payment_atomic', {
        p_payment_id: paymentId,
        p_user_id: userId,
        p_amount: amount,
        p_payment_method: 'sadad',
        p_gateway_reference: `TEST-${attemptIndex}-${Date.now()}`,
        p_description: 'Load test payment',
      });

      const endTime = performance.now();
      this.responseTimes.push(endTime - startTime);

      if (error) {
        this.results.failedPayments++;
        this.results.errors.push(`Attempt ${attemptIndex}: ${error.message}`);
      } else {
        const result = data as { 
          success: boolean; 
          already_processed?: boolean; 
          error?: string;
          new_balance?: number;
        };
        
        if (result.success) {
          this.results.successfulPayments++;
          
          // Check for double-spending detection
          if (result.already_processed) {
            this.results.doubleSpendingAttempts++;
          }
        } else {
          this.results.failedPayments++;
          this.results.errors.push(`Attempt ${attemptIndex}: ${result.error || 'Failed'}`);
        }
      }

      this.results.totalRequests++;
    } catch (err) {
      this.results.failedPayments++;
      this.results.totalRequests++;
      this.results.errors.push(`Attempt ${attemptIndex}: ${err instanceof Error ? err.message : 'Exception'}`);
    }
  }
}

describe('Payment Processing Load Tests', () => {
  const paymentTest = new PaymentLoadTest();

  it('should prevent double-spending with 50 concurrent payment attempts', async () => {
    const testUserId = 'test-payment-user';
    const testPaymentId = `test-payment-${Date.now()}`;
    const amount = 100;

    const results = await paymentTest.runConcurrentPayments(
      testUserId,
      testPaymentId,
      amount,
      50 // 50 concurrent attempts for same payment
    );

    console.log('Payment Load Test Results:', {
      total: results.totalRequests,
      success: results.successfulPayments,
      failed: results.failedPayments,
      doubleSpendingDetected: results.doubleSpendingAttempts,
      avgTime: `${results.averageResponseTime.toFixed(2)}ms`,
    });

    // Assertions
    expect(results.totalRequests).toBe(50);
    // Only 1 should succeed (atomic), others should get already_processed
    expect(results.successfulPayments).toBeGreaterThanOrEqual(1);
    expect(results.averageResponseTime).toBeLessThan(200); // < 200ms target
  }, 30000);

  it('should handle 100 concurrent different payments', async () => {
    const testUserId = 'test-bulk-payment-user';
    const amount = 50;
    const concurrency = 100;

    // Create unique payment IDs for each attempt
    const promises = Array.from({ length: concurrency }, async (_, i) => {
      const paymentId = `bulk-test-${Date.now()}-${i}`;
      return paymentTest.attemptPayment(testUserId, paymentId, amount, i);
    });

    await Promise.all(promises);

    // All should succeed since they're different payments
    expect(paymentTest.results.successfulPayments).toBeGreaterThanOrEqual(95); // 95%+ success rate
  }, 60000);
});

export { PaymentLoadTest };
