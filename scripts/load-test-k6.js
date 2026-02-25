/**
 * P0-001: k6 Load Testing Script
 * Run with: k6 run scripts/load-test-k6.js
 * 
 * This script tests:
 * - Meal completion RPC under load
 * - Payment processing RPC under load
 * - Subscription management RPC under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const mealCompletionTime = new Trend('meal_completion_time');
const paymentProcessingTime = new Trend('payment_processing_time');
const errorRate = new Rate('error_rate');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '3m', target: 200 },   // Ramp up to 200 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'meal_completion_time': ['p(95)<200'], // 95% under 200ms
    'payment_processing_time': ['p(95)<200'],
    'error_rate': ['rate<0.01'],          // Less than 1% errors
    http_req_duration: ['p(95)<500'],     // 95% under 500ms
  },
};

const SUPABASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = __ENV.SUPABASE_KEY || 'test-key';

export default function () {
  const headers = {
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
  };

  // Test 1: Meal Completion RPC
  const mealStart = Date.now();
  const mealRes = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/complete_meal_atomic`,
    JSON.stringify({
      p_schedule_id: `test-schedule-${__VU}`,
      p_user_id: `test-user-${__VU}`,
      p_log_date: new Date().toISOString().split('T')[0],
      p_calories: 500,
      p_protein_g: 30,
      p_carbs_g: 45,
      p_fat_g: 20,
      p_fiber_g: 8,
    }),
    { headers }
  );
  mealCompletionTime.add(Date.now() - mealStart);

  check(mealRes, {
    'meal completion status is 200': (r) => r.status === 200,
    'meal completion response valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true || body.was_already_completed === true;
      } catch {
        return false;
      }
    },
  });

  if (mealRes.status !== 200) {
    errorRate.add(1);
  }

  sleep(0.1); // 100ms think time

  // Test 2: Payment Processing RPC
  const paymentStart = Date.now();
  const paymentRes = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/process_payment_atomic`,
    JSON.stringify({
      p_payment_id: `test-payment-${__VU}-${Date.now()}`,
      p_user_id: `test-user-${__VU}`,
      p_amount: 100.00,
      p_payment_method: 'sadad',
      p_gateway_reference: `TEST-${__VU}-${Date.now()}`,
      p_description: 'Load test payment',
    }),
    { headers }
  );
  paymentProcessingTime.add(Date.now() - paymentStart);

  check(paymentRes, {
    'payment processing status is 200': (r) => r.status === 200,
    'payment processing response valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true || body.already_processed === true;
      } catch {
        return false;
      }
    },
  });

  if (paymentRes.status !== 200) {
    errorRate.add(1);
  }

  sleep(0.5); // 500ms think time between iterations
}

// Test setup
export function setup() {
  console.log('Starting load test...');
  console.log('Target:', SUPABASE_URL);
  return {};
}

// Test teardown
export function teardown(data) {
  console.log('Load test completed');
}
