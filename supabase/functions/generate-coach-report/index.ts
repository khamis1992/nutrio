import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  escapeHtml,
  getCorsHeaders,
  getServiceClient,
  hasAdminAssurance,
  handlePreflight,
  HttpError,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

interface RequestBody {
  clientId: string;
  coachId: string;
  startDate: string;
  endDate: string;
}

type Measurement = {
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  log_date: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string, field: string) {
  if (!DATE_PATTERN.test(value)) throw new HttpError(400, `invalid_${field}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `invalid_${field}`);
  return date;
}

function safeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayMeasurement(value: unknown, unit: string) {
  const number = safeNumber(value);
  return number === null ? "N/A" : `${number.toFixed(1)} ${unit}`;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const body = await readJsonBody<RequestBody>(req, 8 * 1024);
    const { clientId, coachId, startDate, endDate } = body;

    if (!UUID_PATTERN.test(clientId || "") || !UUID_PATTERN.test(coachId || "")) {
      throw new HttpError(400, "invalid_user_identifier");
    }

    const start = parseDate(startDate, "start_date");
    const end = parseDate(endDate, "end_date");
    const rangeDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    if (rangeDays < 0 || rangeDays > 366) {
      throw new HttpError(400, "invalid_report_range");
    }

    const principal = await authenticateRequest(req);
    const hasAdminAccess = hasAdminAssurance(principal);
    if (!hasAdminAccess && principal.user.id !== coachId) {
      await recordSecurityEvent(req, {
        eventType: "authorization.coach_report_denied",
        category: "authorization",
        severity: "high",
        outcome: "denied",
        principal,
        action: "generate_coach_report",
        resourceType: "auth.user",
        resourceId: clientId,
      });
      throw new HttpError(403, "forbidden");
    }

    await enforceRateLimit(req, "coach-report:user", principal.user.id, 10, 3600);

    const supabase = getServiceClient();
    if (!hasAdminAccess) {
      const { data: assignment, error: assignmentError } = await supabase
        .from("coach_client_assignments")
        .select("id")
        .eq("coach_id", principal.user.id)
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      if (!assignment) {
        await recordSecurityEvent(req, {
          eventType: "authorization.coach_client_access_denied",
          category: "authorization",
          severity: "high",
          outcome: "denied",
          principal,
          action: "export_client_health_report",
          resourceType: "auth.user",
          resourceId: clientId,
        });
        throw new HttpError(403, "active_assignment_required");
      }
    }

    const [
      profileResult,
      coachProfileResult,
      measurementsResult,
      mealSchedulesResult,
      streaksResult,
      notesResult,
      goalsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", clientId).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("user_id", coachId).maybeSingle(),
      supabase
        .from("body_measurements")
        .select("weight_kg, body_fat_percent, waist_cm, hip_cm, log_date")
        .eq("user_id", clientId)
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .order("log_date", { ascending: true })
        .limit(1000),
      supabase
        .from("meal_schedules")
        .select("scheduled_date, order_status")
        .eq("user_id", clientId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .limit(2000),
      supabase
        .from("user_streaks")
        .select("current_streak")
        .eq("user_id", clientId)
        .eq("streak_type", "logging")
        .maybeSingle(),
      supabase
        .from("coach_notes")
        .select("note, created_at")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("goal_proposals")
        .select("goal_type, status, target_value, deadline")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .in("status", ["accepted", "completed"])
        .limit(100),
    ]);

    const queryResults = [
      profileResult,
      coachProfileResult,
      measurementsResult,
      mealSchedulesResult,
      streaksResult,
      notesResult,
      goalsResult,
    ];
    const failedQuery = queryResults.find((result) => result.error);
    if (failedQuery?.error) throw failedQuery.error;
    if (!profileResult.data) throw new HttpError(404, "client_not_found");

    const clientName = String(profileResult.data.full_name || "Client");
    const coachName = String(coachProfileResult.data?.full_name || "Coach");
    const measurements = (measurementsResult.data || []) as Measurement[];
    const mealSchedules = mealSchedulesResult.data || [];
    const notes = notesResult.data || [];
    const goals = goalsResult.data || [];

    const dayMap = new Map<string, { total: number; delivered: number }>();
    for (const meal of mealSchedules) {
      const date = String(meal.scheduled_date || "");
      if (!date) continue;
      const current = dayMap.get(date) || { total: 0, delivered: 0 };
      current.total += 1;
      if (meal.order_status === "delivered" || meal.order_status === "completed") {
        current.delivered += 1;
      }
      dayMap.set(date, current);
    }

    const adherenceDays = [...dayMap.entries()].map(([date, value]) => ({
      date,
      total: value.total,
      delivered: value.delivered,
      adherence: value.total
        ? Math.round((value.delivered / value.total) * 100)
        : 0,
    }));
    const overallTotal = adherenceDays.reduce((sum, day) => sum + day.total, 0);
    const overallDelivered = adherenceDays.reduce(
      (sum, day) => sum + day.delivered,
      0,
    );
    const overallAdherence = overallTotal
      ? Math.round((overallDelivered / overallTotal) * 100)
      : 0;

    const firstWeight = safeNumber(measurements[0]?.weight_kg);
    const latestMeasurement = measurements.at(-1) || null;
    const currentWeight = safeNumber(latestMeasurement?.weight_kg);
    const weightChange =
      firstWeight !== null && currentWeight !== null
        ? Math.round((currentWeight - firstWeight) * 100) / 100
        : null;
    const currentStreak = Number(streaksResult.data?.current_streak || 0);

    const escapedClientName = escapeHtml(clientName);
    const escapedCoachName = escapeHtml(coachName);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nutrio Progress Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #020617; }
  .cover { text-align: center; padding: 48px 0; border-bottom: 3px solid #22c7a1; margin-bottom: 36px; }
  .cover h1 { font-size: 32px; margin-bottom: 8px; }
  .cover p { color: #64748b; font-size: 14px; }
  .section { margin-bottom: 32px; break-inside: avoid; }
  .section h2 { font-size: 20px; border-bottom: 2px solid #e5eaf1; padding-bottom: 8px; margin-bottom: 16px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .summary-card { background: #f6f8fb; border-radius: 12px; padding: 16px; text-align: center; }
  .summary-card .value { font-size: 22px; font-weight: 800; }
  .summary-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5eaf1; font-size: 13px; }
  th { background: #f6f8fb; font-weight: 700; }
  .note { font-size: 13px; margin-bottom: 8px; padding: 10px; background: #f6f8fb; border-radius: 8px; white-space: pre-wrap; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5eaf1; font-size: 11px; color: #94a3b8; text-align: center; }
  @media (max-width: 640px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } body { margin: 0; } }
</style>
</head>
<body>
  <div class="cover">
    <h1>Progress Report</h1>
    <p>${escapedClientName} &middot; ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</p>
    <p>Coach: ${escapedCoachName}</p>
  </div>
  <div class="section">
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="summary-card"><div class="value">${currentWeight === null ? "N/A" : `${currentWeight.toFixed(1)} kg`}</div><div class="label">Current Weight</div></div>
      <div class="summary-card"><div class="value">${weightChange === null ? "N/A" : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`}</div><div class="label">Weight Change</div></div>
      <div class="summary-card"><div class="value">${overallAdherence}%</div><div class="label">Meal Adherence</div></div>
      <div class="summary-card"><div class="value">${currentStreak} days</div><div class="label">Current Streak</div></div>
    </div>
  </div>
  ${latestMeasurement ? `<div class="section"><h2>Body Measurements</h2><table><tr><th>Metric</th><th>Value</th></tr><tr><td>Weight</td><td>${displayMeasurement(latestMeasurement.weight_kg, "kg")}</td></tr><tr><td>Body Fat</td><td>${displayMeasurement(latestMeasurement.body_fat_percent, "%")}</td></tr><tr><td>Waist</td><td>${displayMeasurement(latestMeasurement.waist_cm, "cm")}</td></tr><tr><td>Hips</td><td>${displayMeasurement(latestMeasurement.hip_cm, "cm")}</td></tr></table></div>` : ""}
  <div class="section"><h2>Meal Adherence</h2>${adherenceDays.length ? `<table><tr><th>Date</th><th>Meals</th><th>Adherence</th></tr>${adherenceDays.map((day) => `<tr><td>${escapeHtml(day.date)}</td><td>${day.delivered}/${day.total}</td><td>${day.adherence}%</td></tr>`).join("")}</table>` : "<p>No meal data for this period.</p>"}</div>
  ${goals.length ? `<div class="section"><h2>Active Goals</h2><table><tr><th>Goal</th><th>Target</th><th>Deadline</th><th>Status</th></tr>${goals.map((goal) => `<tr><td>${escapeHtml(String(goal.goal_type || "").replaceAll("_", " "))}</td><td>${escapeHtml(goal.target_value)}</td><td>${goal.deadline ? escapeHtml(new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })) : "N/A"}</td><td>${escapeHtml(goal.status)}</td></tr>`).join("")}</table></div>` : ""}
  ${notes.length ? `<div class="section"><h2>Coach Notes</h2>${notes.map((note) => `<div class="note"><strong>${escapeHtml(new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))}:</strong> ${escapeHtml(note.note)}</div>`).join("")}</div>` : ""}
  <div class="footer">Generated by Nutrio on ${escapeHtml(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}</div>
</body>
</html>`;

    await recordSecurityEvent(req, {
      eventType: "coach.client_report.exported",
      category: "data_change",
      severity: "medium",
      outcome: "success",
      principal,
      action: "export_health_report",
      resourceType: "auth.user",
      resourceId: clientId,
      metadata: { start_date: startDate, end_date: endDate },
    });

    return new Response(html, {
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="nutrio-progress-${startDate}-to-${endDate}.html"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Coach report generation failed:", error);
    return errorResponse(req, error);
  }
});
