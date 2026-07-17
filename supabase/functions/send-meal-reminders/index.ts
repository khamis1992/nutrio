import {
  enforceRateLimit,
  errorResponse,
  getClientIp,
  getCorsHeaders,
  getServiceClient,
  handlePreflight,
  recordSecurityEvent,
  requireAdmin,
  requireInternalSecret,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

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

interface NotificationSettings {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    requirePost(req);
    let principal: SecurityPrincipal | null = null;
    if (req.headers.has("x-internal-secret")) {
      await requireInternalSecret(req, "MEAL_REMINDER_CRON_SECRET");
    } else {
      principal = await requireAdmin(req);
    }
    await enforceRateLimit(
      req,
      "meal-reminder-dispatch",
      principal?.user.id || getClientIp(req) || "internal",
      principal ? 6 : 24,
      60 * 60,
    );

    console.log("Starting meal reminder job...");

    const supabase = getServiceClient();

    // Check if push notifications are enabled in platform settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "notifications")
      .single();

    if (settingsError) {
      console.error("Notification settings lookup failed", { code: settingsError.code });
    }

    const notificationSettings = settingsData?.value as NotificationSettings | null;
    
    // If push notifications are disabled, skip sending reminders
    if (notificationSettings && !notificationSettings.push_enabled) {
      console.log("Push notifications are disabled in platform settings. Skipping meal reminders.");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Push notifications are disabled", 
          count: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      console.error("Meal schedule lookup failed", { code: schedulesError.code });
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} scheduled meals for today`);

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No meals scheduled for today", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user notification preferences to filter out users who disabled meal reminders
    const userIds = [...new Set(schedules.map(s => s.user_id))];
    const { data: userPrefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, meal_reminders, push_notifications")
      .in("user_id", userIds);

    if (prefsError) {
      console.error("Notification preference lookup failed", { code: prefsError.code });
    }

    // Create a map of user preferences
    const userPrefsMap = new Map<string, { meal_reminders: boolean; push_notifications: boolean }>();
    userPrefs?.forEach(pref => {
      userPrefsMap.set(pref.user_id, {
        meal_reminders: pref.meal_reminders ?? true,
        push_notifications: pref.push_notifications ?? true,
      });
    });

    // Filter schedules to only include users who have reminders enabled
    const filteredSchedules = schedules.filter(schedule => {
      const prefs = userPrefsMap.get(schedule.user_id);
      // If no preferences exist, default to enabled
      if (!prefs) return true;
      // Only include if both meal reminders and push notifications are enabled
      return prefs.meal_reminders && prefs.push_notifications;
    });

    console.log(`After filtering by user preferences: ${filteredSchedules.length} schedules remain`);

    if (filteredSchedules.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No meals to remind (all users have reminders disabled)", 
          count: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group schedules by user_id
    const userSchedules = filteredSchedules.reduce((acc: Record<string, MealSchedule[]>, schedule: any) => {
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

      const dedupeKey = `meal-reminder:${today}:${userId}`;
      notifications.push({
        user_id: userId,
        type: "meal_reminder",
        title,
        message,
        dedupe_key: dedupeKey,
        data: {
          dedupe_key: dedupeKey,
          scheduled_date: today,
          meal_count: mealCount,
          schedule_ids: userMeals.map((s: MealSchedule) => s.id),
        },
      });
    }

    if (notifications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Reminders already sent", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: insertedNotifications, error: insertError } = await supabase
      .from("notifications")
      .upsert(notifications, {
        onConflict: "user_id,type,dedupe_key",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insertError) {
      console.error("Meal reminder insert failed", { code: insertError.code });
      throw new Error("meal_reminder_insert_failed");
    }

    const insertedCount = insertedNotifications?.length || 0;
    console.log(`Inserted ${insertedCount} meal reminders`);

    await recordSecurityEvent(req, {
      eventType: "system.meal_reminders_dispatched",
      category: "edge_function",
      severity: "info",
      outcome: "success",
      principal,
      actorType: principal ? undefined : "service",
      action: "dispatch_meal_reminders",
      resourceType: "notification_batch",
      resourceId: today,
      metadata: { notification_count: insertedCount },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${insertedCount} meal reminders`,
        count: insertedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Meal reminder batch failed", {
      code: error instanceof Error ? error.name : "internal_error",
    });
    return errorResponse(req, error);
  }
});
