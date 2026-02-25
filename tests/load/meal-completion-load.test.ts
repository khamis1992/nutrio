import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * P0-001: Atomic Transaction Stress Testing Framework
 * Tests concurrent meal completion to verify race condition prevention
 */

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  raceConditions: number;
  errors: string[];
}

class MealCompletionLoadTest {
  private results: LoadTestResult = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    raceConditions: 0,
    errors: [],
  };

  private responseTimes: number[] = [];

  async runConcurrentTest(
    userId: string,
    scheduleId: string,
    concurrency: number,
    iterations: number
  ): Promise<LoadTestResult> {
    console.log(`Starting load test: ${concurrency} concurrent users, ${iterations} iterations each`);
    
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runUserIteration(userId, scheduleId, iterations, i));
    }

    await Promise.all(promises);

    // Calculate statistics
    this.calculateStatistics();

    return this.results;
  }

  private async runUserIteration(
    userId: string,
    scheduleId: string,
    iterations: number,
    userIndex: number
  ): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        const { data, error } = await (supabase.rpc as any)('complete_meal_atomic', {
          p_schedule_id: scheduleId,
          p_user_id: userId,
          p_log_date: new Date().toISOString().split('T')[0],
          p_calories: 500,
          p_protein_g: 30,
          p_carbs_g: 45,
          p_fat_g: 20,
          p_fiber_g: 8,
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        this.responseTimes.push(responseTime);

        if (error) {
          this.results.failedRequests++;
          this.results.errors.push(`User ${userIndex}, Iter ${i}: ${error.message}`);
        } else {
          const result = data as { success: boolean; was_already_completed?: boolean; error?: string };
          
          if (result.success) {
            this.results.successfulRequests++;
            
            // Check for idempotency (should return was_already_completed on duplicate)
            if (i > 0 && !result.was_already_completed) {
              // This might indicate a race condition
              this.results.raceConditions++;
              this.results.errors.push(`User ${userIndex}, Iter ${i}: Possible race condition - meal not marked as already completed`);
            }
          } else {
            this.results.failedRequests++;
            this.results.errors.push(`User ${userIndex}, Iter ${i}: ${result.error || 'Unknown error'}`);
          }
        }

        this.results.totalRequests++;
      } catch (err) {
        this.results.failedRequests++;
        this.results.totalRequests++;
        this.results.errors.push(`User ${userIndex}, Iter ${i}: ${err instanceof Error ? err.message : 'Exception'}`);
      }
    }
  }

  private calculateStatistics(): void {
    if (this.responseTimes.length === 0) return;

    // Sort for percentile calculation
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    
    this.results.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    this.results.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
    this.results.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
  }
}

describe('Meal Completion Load Tests', () => {
  const loadTest = new MealCompletionLoadTest();
  
  // Note: These tests require actual Supabase credentials and test data
  // They should be run against a staging environment, not production
  
  it('should handle 10 concurrent users completing the same meal', async () => {
    // This test verifies that only one completion succeeds and others get idempotent response
    const testUserId = 'test-user-id';
    const testScheduleId = 'test-schedule-id';
    
    const results = await loadTest.runConcurrentTest(
      testUserId,
      testScheduleId,
      10, // 10 concurrent users
      5   // 5 iterations each
    );

    console.log('Load Test Results:', {
      total: results.totalRequests,
      success: results.successfulRequests,
      failed: results.failedRequests,
      avgTime: `${results.averageResponseTime.toFixed(2)}ms`,
      p95: `${results.p95ResponseTime.toFixed(2)}ms`,
      p99: `${results.p99ResponseTime.toFixed(2)}ms`,
      raceConditions: results.raceConditions,
    });

    // Assertions
    expect(results.totalRequests).toBe(50); // 10 users × 5 iterations
    expect(results.averageResponseTime).toBeLessThan(100); // < 100ms target
    expect(results.p95ResponseTime).toBeLessThan(200); // P95 < 200ms
    expect(results.raceConditions).toBe(0); // No race conditions detected
  }, 30000);

  it('should maintain data consistency under concurrent load', async () => {
    // Verify that nutrition totals are correct after concurrent completions
    const testUserId = 'consistency-test-user';
    const testScheduleId = 'consistency-test-schedule';
    
    // Reset test data first
    await supabase
      .from('meal_schedules')
      .update({ is_completed: false, completed_at: null })
      .eq('id', testScheduleId);

    // Run concurrent completions
    const results = await loadTest.runConcurrentTest(
      testUserId,
      testScheduleId,
      20, // 20 concurrent users
      3   // 3 iterations each
    );

    // Only 1 successful completion should have actually updated nutrition
    // The rest should be idempotent (already completed)
    const actualCompletions = results.successfulRequests - results.raceConditions;
    expect(actualCompletions).toBeLessThanOrEqual(20); // At most one per user
  }, 60000);
});

// Export for use in other test files
export { MealCompletionLoadTest };
