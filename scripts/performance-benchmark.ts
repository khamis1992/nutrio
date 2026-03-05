/**
 * P0-006: Performance Benchmarking Suite
 * Measures query response times and identifies bottlenecks
 */

import { supabase } from '@/integrations/supabase/client';

interface BenchmarkResult {
  name: string;
  iterations: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  pass: boolean;
  errors: number;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🏁 Starting Performance Benchmarks...\n');

    // RPC Function Benchmarks
    await this.benchmarkRPC('complete_meal_atomic', {
      p_schedule_id: 'benchmark-schedule',
      p_user_id: 'benchmark-user',
      p_log_date: new Date().toISOString().split('T')[0],
      p_calories: 500,
      p_protein_g: 30,
      p_carbs_g: 45,
      p_fat_g: 20,
      p_fiber_g: 8,
    }, 100, 100); // < 100ms target

    await this.benchmarkRPC('process_payment_atomic', {
      p_payment_id: `benchmark-payment-${Date.now()}`,
      p_user_id: 'benchmark-user',
      p_amount: 100.00,
      p_payment_method: 'sadad',
      p_gateway_reference: `BENCH-${Date.now()}`,
      p_description: 'Benchmark test',
    }, 100, 200); // < 200ms target

    await this.benchmarkRPC('process_cancellation', {
      p_subscription_id: 'benchmark-subscription',
      p_step: 1,
      p_reason: 'too_expensive',
    }, 50, 150);

    await this.benchmarkRPC('create_subscription', {
      p_user_id: `benchmark-user-${Date.now()}`,
      p_tier: 'standard',
      p_billing_interval: 'monthly',
    }, 50, 150);

    await this.benchmarkRPC('get_win_back_offers', {
      p_user_id: 'benchmark-user',
      p_subscription_id: 'benchmark-subscription',
      p_step: 2,
    }, 50, 100);

    await this.benchmarkRPC('submit_meal_review', {
      p_meal_id: 'benchmark-meal',
      p_user_id: 'benchmark-user',
      p_rating: 5,
      p_title: 'Benchmark Review',
      p_review_text: 'Great meal!',
      p_photo_urls: [],
      p_would_recommend: true,
      p_tags: ['Delicious'],
    }, 50, 150);

    // Query Benchmarks
    await this.benchmarkQuery('meals_select', supabase
      .from('meals')
      .select('*')
      .limit(10), 100, 50);

    await this.benchmarkQuery('orders_select', supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', 'benchmark-user')
      .limit(10), 50, 100);

    await this.benchmarkQuery('meal_reviews_select', supabase
      .from('meal_reviews')
      .select('*, profiles(user_name)')
      .eq('meal_id', 'benchmark-meal')
      .limit(10), 50, 100);

    // Print results
    this.printResults();

    return this.results;
  }

  private async benchmarkRPC(
    functionName: string,
    params: Record<string, unknown>,
    iterations: number,
    targetMs: number
  ): Promise<void> {
    console.log(`⏱️  Benchmarking ${functionName}...`);
    
    const times: number[] = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.rpc as any)(functionName, params);
        const end = performance.now();
        
        if (error && !this.isExpectedError(error)) {
          errors++;
        } else {
          times.push(end - start);
        }
      } catch {
        errors++;
      }
    }

    const result = this.calculateStats(functionName, times, iterations, targetMs, errors);
    this.results.push(result);
  }

  private async benchmarkQuery(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: Promise<{ error: unknown }> | any,
    iterations: number,
    targetMs: number
  ): Promise<void> {
    console.log(`⏱️  Benchmarking query: ${name}...`);
    
    const times: number[] = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      try {
        const { error } = await query;
        const end = performance.now();
        
        if (error && !this.isExpectedError(error)) {
          errors++;
        } else {
          times.push(end - start);
        }
      } catch {
        errors++;
      }
    }

    const result = this.calculateStats(name, times, iterations, targetMs, errors);
    this.results.push(result);
  }

  private calculateStats(
    name: string,
    times: number[],
    iterations: number,
    targetMs: number,
    errors: number
  ): BenchmarkResult {
    if (times.length === 0) {
      return {
        name,
        iterations,
        avgTime: 0,
        minTime: 0,
        maxTime: 0,
        p95Time: 0,
        p99Time: 0,
        pass: false,
        errors,
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      name,
      iterations,
      avgTime: avg,
      minTime: min,
      maxTime: max,
      p95Time: p95,
      p99Time: p99,
      pass: p95 < targetMs,
      errors,
    };
  }

  private isExpectedError(error: { message?: string }): boolean {
    // Expected errors in test environment (e.g., missing test data)
    const expectedMessages = [
      'not found',
      'does not exist',
      'violates foreign key',
      'duplicate key',
    ];
    
    return expectedMessages.some(msg => 
      error.message?.toLowerCase().includes(msg)
    );
  }

  private printResults(): void {
    console.log('\n📊 Performance Benchmark Results\n');
    console.log('=' .repeat(100));
    console.log(
      `${'Function'.padEnd(35)} | ` +
      `${'Avg'.padStart(8)} | ` +
      `${'Min'.padStart(8)} | ` +
      `${'Max'.padStart(8)} | ` +
      `${'P95'.padStart(8)} | ` +
      `${'P99'.padStart(8)} | ` +
      `${'Status'.padStart(8)}`
    );
    console.log('=' .repeat(100));

    for (const result of this.results) {
      const status = result.pass ? '✅ PASS' : '❌ FAIL';
      const errorInfo = result.errors > 0 ? ` (${result.errors} errors)` : '';
      
      console.log(
        `${result.name.slice(0, 35).padEnd(35)} | ` +
        `${result.avgTime.toFixed(2).padStart(8)} | ` +
        `${result.minTime.toFixed(2).padStart(8)} | ` +
        `${result.maxTime.toFixed(2).padStart(8)} | ` +
        `${result.p95Time.toFixed(2).padStart(8)} | ` +
        `${result.p99Time.toFixed(2).padStart(8)} | ` +
        `${status}${errorInfo}`
      );
    }

    console.log('=' .repeat(100));
    
    const passed = this.results.filter(r => r.pass).length;
    const failed = this.results.filter(r => !r.pass).length;
    
    console.log(`\n🏁 Summary: ${passed} passed, ${failed} failed out of ${this.results.length} benchmarks`);
    
    if (failed > 0) {
      console.log('\n⚠️  Failed benchmarks need optimization:');
      this.results
        .filter(r => !r.pass)
        .forEach(r => console.log(`   - ${r.name}: P95=${r.p95Time.toFixed(2)}ms`));
    }
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runAllBenchmarks().then(() => {
    console.log('\n✅ Benchmarking complete');
    process.exit(0);
  }).catch((err) => {
    console.error('Benchmark failed:', err);
    process.exit(1);
  });
}

export { PerformanceBenchmark };
export type { BenchmarkResult };
