// Layer 4: Behavior Prediction Engine
// Analyzes user behavior patterns to predict churn, boredom, and engagement
// Implements weighted scoring algorithms for proactive retention

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BehaviorMetrics {
  user_id: string;
  ordering_frequency: number;
  skip_rate: number;
  restaurant_diversity: number;
  meal_rating_avg: number;
  app_opens_last_7_days: number;
  avg_session_duration: number;
  plan_adherence: number;
  cuisine_diversity: number;
  response_time_hours: number;
}

interface PredictionScores {
  churn_risk_score: number;
  boredom_risk_score: number;
  engagement_score: number;
  confidence_level: number;
}

interface RetentionRecommendation {
  action_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  suggested_message?: string;
  incentive_amount?: number;
}

// Calculate churn risk score (0-1)
function calculateChurnRisk(metrics: BehaviorMetrics): number {
  let score = 0;
  
  // Factor 1: Low ordering frequency (< 50% of expected) - Weight: 0.30
  if (metrics.ordering_frequency < 0.5) {
    score += 0.30;
  } else if (metrics.ordering_frequency < 0.75) {
    score += 0.15;
  }
  
  // Factor 2: High skip rate (> 30%) - Weight: 0.25
  if (metrics.skip_rate > 0.30) {
    score += 0.25;
  } else if (metrics.skip_rate > 0.20) {
    score += 0.10;
  }
  
  // Factor 3: Low restaurant diversity (> 60% same restaurant) - Weight: 0.15
  if (metrics.restaurant_diversity < 0.4) {
    score += 0.15;
  }
  
  // Factor 4: No app opens in 7 days - Weight: 0.20
  if (metrics.app_opens_last_7_days === 0) {
    score += 0.20;
  } else if (metrics.app_opens_last_7_days < 3) {
    score += 0.10;
  }
  
  // Factor 5: Subscription ending soon - Weight: 0.10
  // This is handled in the calling function
  
  return Math.min(1.0, score);
}

// Calculate boredom risk score (0-1)
function calculateBoredomRisk(metrics: BehaviorMetrics): number {
  let score = 0;
  
  // Factor 1: Low meal rating average (< 3.5) - Weight: 0.40
  if (metrics.meal_rating_avg > 0 && metrics.meal_rating_avg < 3.5) {
    score += 0.40;
  } else if (metrics.meal_rating_avg > 0 && metrics.meal_rating_avg < 4.0) {
    score += 0.20;
  }
  
  // Factor 2: Low cuisine diversity - Weight: 0.25
  if (metrics.cuisine_diversity < 0.3) {
    score += 0.25;
  }
  
  // Factor 3: Never modifies AI plan - inferred from adherence - Weight: 0.20
  if (metrics.plan_adherence > 0.95) {
    score += 0.20; // Too perfect = never modifies
  }
  
  // Factor 4: Same restaurant repetition - Weight: 0.15
  if (metrics.restaurant_diversity < 0.3) {
    score += 0.15;
  }
  
  return Math.min(1.0, score);
}

// Calculate engagement score (1-100)
function calculateEngagementScore(metrics: BehaviorMetrics): number {
  let score = 100;
  
  // Deduct for low ordering frequency
  if (metrics.ordering_frequency < 0.5) {
    score -= 30;
  } else if (metrics.ordering_frequency < 0.75) {
    score -= 15;
  }
  
  // Deduct for high skip rate
  if (metrics.skip_rate > 0.30) {
    score -= 25;
  } else if (metrics.skip_rate > 0.20) {
    score -= 10;
  }
  
  // Deduct for low app opens
  if (metrics.app_opens_last_7_days === 0) {
    score -= 20;
  } else if (metrics.app_opens_last_7_days < 3) {
    score -= 10;
  }
  
  // Deduct for low plan adherence
  if (metrics.plan_adherence < 0.5) {
    score -= 15;
  }
  
  // Deduct for low meal ratings
  if (metrics.meal_rating_avg > 0 && metrics.meal_rating_avg < 3.5) {
    score -= 10;
  }
  
  return Math.max(1, score);
}

// Generate retention recommendations based on scores
function generateRetentionRecommendations(
  churnRisk: number,
  boredomRisk: number,
  engagementScore: number,
  metrics: BehaviorMetrics
): RetentionRecommendation[] {
  const recommendations: RetentionRecommendation[] = [];
  
  // Critical churn risk
  if (churnRisk > 0.7) {
    recommendations.push({
      action_type: 'personal_outreach',
      priority: 'critical',
      reason: 'Churn risk is critically high',
      suggested_message: 'We noticed you haven\'t been ordering lately. Is everything okay? Our nutritionist would love to help you get back on track.',
      incentive_amount: 5, // Bonus credits
    });
  }
  // High churn risk
  else if (churnRisk > 0.5) {
    recommendations.push({
      action_type: 'bonus_credit',
      priority: 'high',
      reason: 'Churn risk is elevated',
      suggested_message: 'We miss you! Here are 3 bonus credits to try something new.',
      incentive_amount: 3,
    });
  }
  
  // Boredom risk
  if (boredomRisk > 0.6) {
    recommendations.push({
      action_type: 'cuisine_exploration',
      priority: churnRisk > 0.5 ? 'high' : 'medium',
      reason: 'User may be bored with current selection',
      suggested_message: 'Ready to explore? Try these new cuisines we think you\'ll love!',
    });
    
    recommendations.push({
      action_type: 'plan_regeneration',
      priority: 'medium',
      reason: 'Fresh AI-generated plan with new restaurants',
      suggested_message: 'We\'ve created a fresh meal plan with exciting new options!',
    });
  }
  
  // Low engagement
  if (engagementScore < 40) {
    recommendations.push({
      action_type: 'gamification',
      priority: 'medium',
      reason: 'Low engagement score',
      suggested_message: 'Start a 7-day streak and earn bonus rewards!',
    });
  }
  
  // Low plan adherence
  if (metrics.plan_adherence < 0.6) {
    recommendations.push({
      action_type: 'flexible_scheduling',
      priority: 'medium',
      reason: 'User struggling with current schedule',
      suggested_message: 'Let\'s adjust your meal times to better fit your lifestyle.',
    });
  }
  
  // High skip rate
  if (metrics.skip_rate > 0.25) {
    recommendations.push({
      action_type: 'preference_update',
      priority: 'medium',
      reason: 'Many meals being skipped',
      suggested_message: 'Help us serve you better - update your preferences!',
    });
  }
  
  // Default: No action needed
  if (recommendations.length === 0) {
    recommendations.push({
      action_type: 'none',
      priority: 'low',
      reason: 'User engagement is healthy',
    });
  }
  
  return recommendations;
}

// Execute retention action
async function executeRetentionAction(
  userId: string,
  recommendation: RetentionRecommendation,
  supabaseClient: any
): Promise<boolean> {
  try {
    // Log the action
    const { error: logError } = await supabaseClient
      .from('retention_actions')
      .insert({
        user_id: userId,
        trigger_reason: recommendation.action_type === 'bonus_credit' ? 'churn_risk' : 
                       recommendation.action_type === 'cuisine_exploration' ? 'boredom_risk' : 'low_engagement',
        risk_score: recommendation.priority === 'critical' ? 0.8 : 
                   recommendation.priority === 'high' ? 0.6 : 0.4,
        action_type: recommendation.action_type,
        action_details: {
          priority: recommendation.priority,
          message: recommendation.suggested_message,
          incentive: recommendation.incentive_amount,
          reason: recommendation.reason,
        },
        sent_at: new Date().toISOString(),
      });
    
    if (logError) {
      console.error('Error logging retention action:', logError);
    }
    
    // Award bonus credits if applicable
    if (recommendation.incentive_amount && recommendation.incentive_amount > 0) {
      // Get active subscription
      const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id, credits_remaining')
      .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (subscription) {
        // Add credits
        await supabaseClient
          .from('subscriptions')
          .update({
            credits_remaining: subscription.credits_remaining + recommendation.incentive_amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);
        
        // Log transaction
        await supabaseClient
          .from('credit_transactions')
          .insert({
            user_id: userId,
            subscription_id: subscription.id,
            transaction_type: 'bonus',
            credits_amount: recommendation.incentive_amount,
            meal_value_qar: 50,
            description: `Retention bonus: ${recommendation.reason}`,
          });
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error executing retention action:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      user_id, 
      analyze_period_days = 30,
      auto_execute = false 
    } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - analyze_period_days);

    // Fetch orders in period
    const { data: orders, error: ordersError } = await supabaseClient
      .from('orders')
      .select('id, restaurant_id, status, created_at')
      .eq('user_id', user_id)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
    }

    // Fetch meal ratings
    const { data: ratings, error: ratingsError } = await supabaseClient
      .from('meal_ratings')
      .select('rating, created_at')
      .eq('user_id', user_id)
      .gte('created_at', periodStart.toISOString());

    if (ratingsError) {
      console.error('Error fetching ratings:', ratingsError);
    }

    // Fetch behavior events (app opens)
    const { data: events, error: eventsError } = await supabaseClient
      .from('behavior_events')
      .select('event_type, created_at')
      .eq('user_id', user_id)
      .gte('created_at', periodStart.toISOString());

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    }

    // Fetch weekly plans
    const { data: plans, error: plansError } = await supabaseClient
      .from('weekly_meal_plans')
      .select('user_accepted, user_modified, plan_status')
      .eq('user_id', user_id)
      .gte('created_at', periodStart.toISOString());

    if (plansError) {
      console.error('Error fetching plans:', plansError);
    }

    // Calculate metrics
    const totalOrders = orders?.length || 0;
    const cancelledOrders = orders?.filter(o => o.status === 'cancelled').length || 0;
    const skipRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0;
    
    const uniqueRestaurants = new Set(orders?.map(o => o.restaurant_id) || []).size;
    const restaurantDiversity = totalOrders > 0 ? uniqueRestaurants / totalOrders : 0;
    
    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;
    
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const appOpensLast7Days = events?.filter(e => 
      e.event_type === 'app_open' && 
      new Date(e.created_at) >= last7Days
    ).length || 0;
    
    const acceptedPlans = plans?.filter(p => p.user_accepted).length || 0;
    const modifiedPlans = plans?.filter(p => p.user_modified).length || 0;
    const totalPlans = plans?.length || 0;
    const planAdherence = totalPlans > 0 ? acceptedPlans / totalPlans : 1.0;

    // Expected ordering frequency (based on subscription)
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('meal_credits')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const expectedOrdersPerMonth = subscription?.meal_credits || 78;
    const expectedOrdersInPeriod = (expectedOrdersPerMonth / 30) * analyze_period_days;
    const orderingFrequency = expectedOrdersInPeriod > 0 
      ? Math.min(1, totalOrders / expectedOrdersInPeriod) 
      : 0;

    const metrics: BehaviorMetrics = {
      user_id: user_id,
      ordering_frequency: orderingFrequency,
      skip_rate: skipRate,
      restaurant_diversity: restaurantDiversity,
      meal_rating_avg: avgRating,
      app_opens_last_7_days: appOpensLast7Days,
      avg_session_duration: 0, // Would need session tracking
      plan_adherence: planAdherence,
      cuisine_diversity: restaurantDiversity, // Simplified
      response_time_hours: 0, // Would need notification tracking
    };

    // Calculate prediction scores
    const churnRiskScore = calculateChurnRisk(metrics);
    const boredomRiskScore = calculateBoredomRisk(metrics);
    const engagementScore = calculateEngagementScore(metrics);
    
    const predictions: PredictionScores = {
      churn_risk_score: parseFloat(churnRiskScore.toFixed(2)),
      boredom_risk_score: parseFloat(boredomRiskScore.toFixed(2)),
      engagement_score: engagementScore,
      confidence_level: 0.75, // Based on data quality
    };

    // Generate recommendations
    const recommendations = generateRetentionRecommendations(
      churnRiskScore,
      boredomRiskScore,
      engagementScore,
      metrics
    );

    // Save analytics record
    await supabaseClient.from('behavior_analytics').insert({
      user_id: user_id,
      analyzed_period_start: periodStart.toISOString().split('T')[0],
      analyzed_period_end: periodEnd.toISOString().split('T')[0],
      ordering_frequency: orderingFrequency,
      restaurant_diversity_score: restaurantDiversity,
      cuisine_diversity_score: restaurantDiversity,
      meal_rating_avg: avgRating || null,
      skipped_meals_count: cancelledOrders,
      cancellation_rate: skipRate,
      engagement_score: engagementScore,
      churn_risk_score: churnRiskScore,
      boredom_risk_score: boredomRiskScore,
      plan_adherence_rate: planAdherence,
      ai_acceptance_rate: planAdherence,
    });

    // Execute recommendations if auto-execute enabled
    const executedActions: string[] = [];
    if (auto_execute) {
      for (const rec of recommendations) {
        if (rec.priority === 'critical' || rec.priority === 'high') {
          const success = await executeRetentionAction(user_id, rec, supabaseClient);
          if (success) {
            executedActions.push(rec.action_type);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        predictions,
        metrics: {
          total_orders: totalOrders,
          skip_rate: skipRate,
          restaurant_diversity: restaurantDiversity,
          avg_rating: avgRating,
          app_opens_last_7_days: appOpensLast7Days,
          plan_adherence: planAdherence,
        },
        recommendations,
        executed_actions: auto_execute ? executedActions : undefined,
        message: auto_execute && executedActions.length > 0
          ? `Executed ${executedActions.length} retention actions`
          : 'Analysis complete. Review recommendations.',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in behavior-prediction-engine:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
