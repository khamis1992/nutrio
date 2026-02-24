// Layer 5: Restaurant Intelligence Engine
// Analyzes restaurant demand, capacity, and provides optimization insights
// Balances demand across restaurants to prevent overload

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RestaurantMetrics {
  restaurant_id: string;
  total_orders: number;
  unique_customers: number;
  avg_prep_time: number;
  customer_satisfaction: number;
  peak_hours: number[];
  popular_categories: Record<string, number>;
  capacity_limit: number;
}

interface DemandAnalysis {
  demand_score: number;
  capacity_utilization: number;
  is_overloaded: boolean;
  order_growth_rate: number;
  recommendation: string;
}

// Calculate demand score (1-100)
function calculateDemandScore(metrics: RestaurantMetrics): number {
  // Base score from order volume
  let score = Math.min(40, (metrics.total_orders / 10) * 4);
  
  // Customer satisfaction impact (up to 30 points)
  score += Math.min(30, metrics.customer_satisfaction * 6);
  
  // Unique customers diversity (up to 20 points)
  const diversityScore = Math.min(20, metrics.unique_customers * 2);
  score += diversityScore;
  
  // Preparation efficiency (up to 10 points)
  const efficiencyScore = Math.max(0, 10 - (metrics.avg_prep_time - 20) / 3);
  score += efficiencyScore;
  
  return Math.round(Math.min(100, score));
}

// Calculate capacity utilization (0-1)
function calculateCapacityUtilization(
  totalOrders: number,
  capacityLimit: number,
  daysPeriod: number
): number {
  if (capacityLimit === 0) return 0;
  
  const avgDailyOrders = totalOrders / daysPeriod;
  const utilization = avgDailyOrders / capacityLimit;
  
  return Math.min(1.0, utilization);
}

// Calculate order growth rate
function calculateOrderGrowthRate(
  recentOrders: number,
  previousOrders: number
): number {
  if (previousOrders === 0) return recentOrders > 0 ? 100 : 0;
  
  const growth = ((recentOrders - previousOrders) / previousOrders) * 100;
  return Math.round(growth);
}

// Generate AI insights for restaurant
function generateRestaurantInsights(
  restaurantId: string,
  metrics: RestaurantMetrics,
  demandAnalysis: DemandAnalysis
): any[] {
  const insights: any[] = [];
  
  // Overload warning
  if (demandAnalysis.is_overloaded) {
    insights.push({
      restaurant_id: restaurantId,
      insight_type: 'capacity_adjustment',
      insight_data: {
        title: 'Capacity Alert',
        message: `Operating at ${Math.round(demandAnalysis.capacity_utilization * 100)}% capacity. Consider expanding hours or increasing staff.`,
        utilization: demandAnalysis.capacity_utilization,
        recommendation: 'increase_capacity',
      },
      priority: 'high',
    });
  }
  
  // Popular categories analysis
  const sortedCategories = Object.entries(metrics.popular_categories)
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedCategories.length > 0) {
    const topCategory = sortedCategories[0];
    const topPercentage = (topCategory[1] / metrics.total_orders) * 100;
    
    if (topPercentage > 60) {
      insights.push({
        restaurant_id: restaurantId,
        insight_type: 'menu_optimization',
        insight_data: {
          title: 'Menu Diversification Opportunity',
          message: `${topPercentage.toFixed(0)}% of orders are ${topCategory[0]}. Consider adding more variety to attract different customer segments.`,
          top_category: topCategory[0],
          percentage: topPercentage,
          recommendation: 'add_variety',
        },
        priority: 'medium',
      });
    }
  }
  
  // Peak hours optimization
  if (metrics.peak_hours.length > 0) {
    insights.push({
      restaurant_id: restaurantId,
      insight_type: 'demand_forecast',
      insight_data: {
        title: 'Peak Hours Identified',
        message: `Highest demand at ${metrics.peak_hours.join(', ')}:00. Ensure adequate staffing during these times.`,
        peak_hours: metrics.peak_hours,
        recommendation: 'optimize_staffing',
      },
      priority: 'medium',
    });
  }
  
  // Growth trend
  if (demandAnalysis.order_growth_rate > 20) {
    insights.push({
      restaurant_id: restaurantId,
      insight_type: 'demand_forecast',
      insight_data: {
        title: 'Rapid Growth Detected',
        message: `Orders increased by ${demandAnalysis.order_growth_rate}% recently. Prepare for sustained high demand.`,
        growth_rate: demandAnalysis.order_growth_rate,
        recommendation: 'prepare_expansion',
      },
      priority: 'medium',
    });
  }
  
  return insights;
}

// Adjust AI recommendations based on restaurant load
async function balanceRestaurantDemand(
  overloadedRestaurants: string[],
  underutilizedRestaurants: string[],
  supabaseClient: any
): Promise<void> {
  // Reduce AI recommendations for overloaded restaurants
  for (const restaurantId of overloadedRestaurants) {
    // Update restaurant_analytics to mark as overloaded
    await supabaseClient
      .from('restaurant_analytics')
      .update({
        is_overloaded: true,
        overload_start_date: new Date().toISOString().split('T')[0],
      })
      .eq('restaurant_id', restaurantId)
      .eq('analyzed_date', new Date().toISOString().split('T')[0]);
  }
  
  // Increase visibility for underutilized restaurants
  for (const restaurantId of underutilizedRestaurants) {
    // Create promotion opportunity insight
    await supabaseClient
      .from('restaurant_ai_insights')
      .insert({
        restaurant_id: restaurantId,
        insight_type: 'demand_forecast',
        insight_data: {
          title: 'Growth Opportunity',
          message: 'Current capacity utilization is low. Consider promotional campaigns to increase orders.',
          recommendation: 'increase_marketing',
        },
        priority: 'medium',
      });
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
      restaurant_id,
      analyze_all = false,
      days_of_history = 14,
      apply_balancing = true
    } = await req.json();

    // Calculate date range
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days_of_history);

    let restaurantsToAnalyze: string[] = [];

    if (analyze_all) {
      // Get all active restaurants
      const { data: restaurants } = await supabaseClient
        .from('restaurants')
        .select('id')
        .eq('is_approved', true);
      
      restaurantsToAnalyze = restaurants?.map(r => r.id) || [];
    } else if (restaurant_id) {
      restaurantsToAnalyze = [restaurant_id];
    } else {
      return new Response(
        JSON.stringify({ error: "Either restaurant_id or analyze_all must be provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    const overloadedRestaurants: string[] = [];
    const underutilizedRestaurants: string[] = [];

    for (const rid of restaurantsToAnalyze) {
      // Fetch orders for this restaurant
      const { data: orders, error: ordersError } = await supabaseClient
        .from('orders')
        .select('id, user_id, status, created_at, meal_id')
        .eq('restaurant_id', rid)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString())
        .not('status', 'in', '("cancelled","refunded")');

      if (ordersError) {
        console.error(`Error fetching orders for restaurant ${rid}:`, ordersError);
        continue;
      }

      // Fetch ratings
      const { data: ratings } = await supabaseClient
        .from('meal_ratings')
        .select('rating, order_id')
        .in('order_id', orders?.map(o => o.id) || []);

      // Calculate metrics
      const totalOrders = orders?.length || 0;
      const uniqueCustomers = new Set(orders?.map(o => o.user_id)).size;
      const avgRating = ratings && ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      // Calculate peak hours
      const hourCounts: Record<number, number> = {};
      orders?.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      const peakHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => parseInt(hour));

      // Fetch meal categories
      const mealIds = orders?.map(o => o.meal_id).filter(Boolean) || [];
      const { data: meals } = await supabaseClient
        .from('meals')
        .select('id, macro_category')
        .in('id', mealIds);

      const categoryCounts: Record<string, number> = {};
      meals?.forEach(meal => {
        if (meal.macro_category) {
          categoryCounts[meal.macro_category] = (categoryCounts[meal.macro_category] || 0) + 1;
        }
      });

      // Get restaurant capacity (default to 20 orders/day)
      const { data: restaurant } = await supabaseClient
        .from('restaurants')
        .select('max_daily_orders')
        .eq('id', rid)
        .single();

      const capacityLimit = restaurant?.max_daily_orders || 20;

      // Get previous period for growth calculation
      const prevPeriodStart = new Date(periodStart);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - days_of_history);
      
      const { data: prevOrders } = await supabaseClient
        .from('orders')
        .select('id')
        .eq('restaurant_id', rid)
        .gte('created_at', prevPeriodStart.toISOString())
        .lt('created_at', periodStart.toISOString())
        .not('status', 'in', '("cancelled","refunded")');

      const growthRate = calculateOrderGrowthRate(
        totalOrders,
        prevOrders?.length || 0
      );

      const metrics: RestaurantMetrics = {
        restaurant_id: rid,
        total_orders: totalOrders,
        unique_customers: uniqueCustomers,
        avg_prep_time: 25, // Would need actual prep time tracking
        customer_satisfaction: avgRating,
        peak_hours: peakHours,
        popular_categories: categoryCounts,
        capacity_limit: capacityLimit,
      };

      const demandScore = calculateDemandScore(metrics);
      const capacityUtilization = calculateCapacityUtilization(
        totalOrders,
        capacityLimit,
        days_of_history
      );

      const isOverloaded = capacityUtilization > 0.85;
      
      if (isOverloaded) {
        overloadedRestaurants.push(rid);
      } else if (capacityUtilization < 0.3) {
        underutilizedRestaurants.push(rid);
      }

      const demandAnalysis: DemandAnalysis = {
        demand_score: demandScore,
        capacity_utilization: capacityUtilization,
        is_overloaded: isOverloaded,
        order_growth_rate: growthRate,
        recommendation: isOverloaded 
          ? 'Reduce AI recommendations by 50% and suggest capacity increase'
          : capacityUtilization < 0.3
          ? 'Increase marketing and promotions'
          : 'Maintain current operations',
      };

      // Save analytics
      await supabaseClient.from('restaurant_analytics').insert({
        restaurant_id: rid,
        analyzed_date: new Date().toISOString().split('T')[0],
        demand_score: demandScore,
        capacity_utilization: capacityUtilization,
        order_growth_rate: growthRate,
        customer_satisfaction: avgRating,
        avg_prep_time_minutes: 25,
        popular_macro_categories: categoryCounts,
        peak_ordering_hours: peakHours,
        is_overloaded: isOverloaded,
      });

      // Generate and save insights
      const insights = generateRestaurantInsights(rid, metrics, demandAnalysis);
      
      for (const insight of insights) {
        await supabaseClient.from('restaurant_ai_insights').insert(insight);
      }

      results.push({
        restaurant_id: rid,
        metrics: {
          total_orders: totalOrders,
          unique_customers: uniqueCustomers,
          avg_rating: avgRating,
          peak_hours: peakHours,
          growth_rate: growthRate,
        },
        analysis: demandAnalysis,
        insights_count: insights.length,
      });
    }

    // Apply demand balancing if requested
    if (apply_balancing && (overloadedRestaurants.length > 0 || underutilizedRestaurants.length > 0)) {
      await balanceRestaurantDemand(
        overloadedRestaurants,
        underutilizedRestaurants,
        supabaseClient
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        restaurants_analyzed: results.length,
        overloaded_count: overloadedRestaurants.length,
        underutilized_count: underutilizedRestaurants.length,
        results,
        balancing_applied: apply_balancing,
        message: `Analyzed ${results.length} restaurants. ${overloadedRestaurants.length} overloaded, ${underutilizedRestaurants.length} underutilized.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in restaurant-intelligence-engine:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
