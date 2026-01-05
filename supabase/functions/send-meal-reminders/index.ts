import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MealSchedule {
  id: string;
  user_id: string;
  meal_id: string;
  meal_type: string;
  scheduled_date: string;
  meals: {
    name: string;
    restaurant_id: string;
    restaurants: {
      name: string;
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting meal reminder job...");

    // Create Supabase client with service role for admin access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get today's date
    const today = new Date().toISOString().split("T")[0];
    console.log(`Checking schedules for date: ${today}`);

    // Fetch all scheduled meals for today that are not completed
    const { data: schedules, error: schedulesError } = await supabase
      .from("meal_schedules")
      .select(`
        id,
        user_id,
        meal_id,
        meal_type,
        scheduled_date,
        meals (
          name,
          restaurant_id,
          restaurants (
            name
          )
        )
      `)
      .eq("scheduled_date", today)
      .eq("is_completed", false);

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} scheduled meals for today`);

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No meals scheduled for today", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group schedules by user_id
    const userSchedules = schedules.reduce((acc: Record<string, MealSchedule[]>, schedule: any) => {
      const userId = schedule.user_id;
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(schedule);
      return acc;
    }, {});

    console.log(`Sending reminders to ${Object.keys(userSchedules).length} users`);

    // Create notifications for each user
    const notifications = [];

    for (const [userId, userMeals] of Object.entries(userSchedules)) {
      const mealCount = userMeals.length;
      const mealNames = userMeals
        .slice(0, 3)
        .map((s: MealSchedule) => s.meals?.name || "Unknown meal")
        .join(", ");

      const mealTypes = [...new Set(userMeals.map((s: MealSchedule) => s.meal_type))].join(", ");

      let title: string;
      let message: string;

      if (mealCount === 1) {
        const meal = userMeals[0];
        const mealTypeName = meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1);
        title = `${mealTypeName} Reminder`;
        message = `Don't forget your ${meal.meal_type}: ${meal.meals?.name || "your scheduled meal"} from ${meal.meals?.restaurants?.name || "the restaurant"}.`;
      } else {
        title = `${mealCount} Meals Scheduled Today`;
        message = `You have ${mealCount} meals planned for today (${mealTypes}): ${mealNames}${mealCount > 3 ? "..." : ""}.`;
      }

      notifications.push({
        user_id: userId,
        type: "meal_reminder",
        title,
        message,
        metadata: {
          scheduled_date: today,
          meal_count: mealCount,
          schedule_ids: userMeals.map((s: MealSchedule) => s.id),
        },
      });
    }

    // Insert all notifications
    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      throw insertError;
    }

    console.log(`Successfully sent ${notifications.length} meal reminders`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${notifications.length} meal reminders`,
        count: notifications.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-meal-reminders:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
