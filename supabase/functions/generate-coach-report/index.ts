import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  clientId: string;
  coachId: string;
  startDate: string;
  endDate: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clientId, coachId, startDate, endDate }: RequestBody = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseHeaders = {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    // Helper: fetch from Supabase REST API
    const fetchAPI = async (path: string) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: supabaseHeaders });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    };

    // Fetch all required data in parallel
    const [profile, measurements, mealSchedules, streaks, notes, goals] = await Promise.all([
      fetchAPI(`profiles?select=full_name,avatar_url&user_id=eq.${clientId}`),
      fetchAPI(`body_measurements?select=weight_kg,body_fat_percent,waist_cm,hip_cm,log_date&user_id=eq.${clientId}&log_date=gte.${startDate}&log_date=lte.${endDate}&order=log_date.asc`),
      fetchAPI(`meal_schedules?select=scheduled_date,order_status&user_id=eq.${clientId}&scheduled_date=gte.${startDate}&scheduled_date=lte.${endDate}`),
      fetchAPI(`user_streaks?select=current_streak&user_id=eq.${clientId}&streak_type=eq.logging`),
      fetchAPI(`coach_notes?select=note,created_at&coach_id=eq.${coachId}&client_id=eq.${clientId}&order=created_at.desc&limit=10`),
      fetchAPI(`goal_proposals?select=goal_type,status,target_value,deadline&coach_id=eq.${coachId}&client_id=eq.${clientId}&status=in.(accepted,completed)`),
    ]);

    const clientName = profile?.[0]?.full_name || "Client";
    const coachProfile = await fetchAPI(`profiles?select=full_name&user_id=eq.${coachId}`);
    const coachName = coachProfile?.[0]?.full_name || "Coach";

    // Calculate adherence
    const dayMap = new Map<string, { total: number; delivered: number }>();
    for (const m of mealSchedules || []) {
      const d = m.scheduled_date;
      if (!dayMap.has(d)) dayMap.set(d, { total: 0, delivered: 0 });
      const entry = dayMap.get(d)!;
      entry.total++;
      if (m.order_status === "delivered" || m.order_status === "completed") {
        entry.delivered++;
      }
    }

    const adherenceDays: { date: string; adherence: number; total: number; delivered: number }[] = [];
    let overallTotal = 0;
    let overallDelivered = 0;
    for (const [date, entry] of dayMap) {
      const pct = entry.total > 0 ? Math.round((entry.delivered / entry.total) * 100) : 0;
      adherenceDays.push({ date, adherence: pct, total: entry.total, delivered: entry.delivered });
      overallTotal += entry.total;
      overallDelivered += entry.delivered;
    }
    const overallAdherence = overallTotal > 0 ? Math.round((overallDelivered / overallTotal) * 100) : 0;

    // Weight trend
    const weights = measurements || [];
    let weightChange: number | null = null;
    let currentWeight: number | null = null;
    if (weights.length >= 2) {
      const first = weights[0].weight_kg;
      const last = weights[weights.length - 1].weight_kg;
      weightChange = Math.round((last - first) * 100) / 100;
      currentWeight = last;
    } else if (weights.length === 1) {
      currentWeight = weights[0].weight_kg;
    }

    // Current streak
    const currentStreak = streaks?.[0]?.current_streak || 0;

    // Latest measurements
    const latestMeasurement = weights.length > 0 ? weights[weights.length - 1] : null;

    // Build HTML report
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Progress Report - ${clientName}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
  .cover { text-align: center; padding: 60px 0; border-bottom: 3px solid #059669; margin-bottom: 40px; }
  .cover h1 { font-size: 32px; margin-bottom: 8px; }
  .cover p { color: #666; font-size: 14px; }
  .section { margin-bottom: 32px; }
  .section h2 { font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .summary-card { background: #f9fafb; border-radius: 12px; padding: 16px; text-align: center; }
  .summary-card .value { font-size: 24px; font-weight: 800; }
  .summary-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  th { background: #f9fafb; font-weight: 600; }
  .adherence-bar { display: inline-block; height: 8px; border-radius: 4px; min-width: 40px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
  <div class="cover">
    <h1>Progress Report</h1>
    <p>${clientName} · ${startDate} to ${endDate}</p>
    <p style="margin-top: 8px;">Coach: ${coachName}</p>
  </div>

  <div class="section">
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="value" style="color: ${weightChange !== null && weightChange < 0 ? '#059669' : '#1a1a1a'}">${currentWeight !== null ? currentWeight.toFixed(1) + ' kg' : 'N/A'}</div>
        <div class="label">Current Weight</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: ${weightChange !== null ? (weightChange < 0 ? '#059669' : '#ef4444') : '#6b7280'}">${weightChange !== null ? (weightChange > 0 ? '+' : '') + weightChange.toFixed(1) + ' kg' : 'N/A'}</div>
        <div class="label">Weight Change</div>
      </div>
      <div class="summary-card">
        <div class="value">${overallAdherence}%</div>
        <div class="label">Meal Adherence</div>
      </div>
      <div class="summary-card">
        <div class="value">${currentStreak} days</div>
        <div class="label">Current Streak</div>
      </div>
    </div>
  </div>

  ${latestMeasurement ? `
  <div class="section">
    <h2>Body Measurements</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Weight</td><td>${latestMeasurement.weight_kg ? latestMeasurement.weight_kg.toFixed(1) + ' kg' : 'N/A'}</td></tr>
      <tr><td>Body Fat %</td><td>${latestMeasurement.body_fat_percent ? latestMeasurement.body_fat_percent + '%' : 'N/A'}</td></tr>
      <tr><td>Waist</td><td>${latestMeasurement.waist_cm ? latestMeasurement.waist_cm + ' cm' : 'N/A'}</td></tr>
      <tr><td>Hips</td><td>${latestMeasurement.hip_cm ? latestMeasurement.hip_cm + ' cm' : 'N/A'}</td></tr>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <h2>Meal Adherence (Daily)</h2>
    ${adherenceDays.length > 0 ? `
    <table>
      <tr><th>Date</th><th>Meals</th><th>Adherence</th><th></th></tr>
      ${adherenceDays.map(d => `
        <tr>
          <td>${d.date}</td>
          <td>${d.delivered}/${d.total}</td>
          <td>${d.adherence}%</td>
          <td><span class="adherence-bar" style="width: ${d.adherence}px; background: ${d.adherence >= 80 ? '#059669' : d.adherence >= 50 ? '#d97706' : '#ef4444'}"></span></td>
        </tr>
      `).join('')}
    </table>
    ` : '<p>No meal data for this period.</p>'}
  </div>

  ${goals && goals.length > 0 ? `
  <div class="section">
    <h2>Active Goals</h2>
    <table>
      <tr><th>Goal</th><th>Target</th><th>Deadline</th><th>Status</th></tr>
      ${goals.map((g: { goal_type: string; target_value: string; deadline: string | null; status: string }) => `
        <tr>
          <td>${g.goal_type.replace(/_/g, ' ')}</td>
          <td>${g.target_value}</td>
          <td>${g.deadline ? new Date(g.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</td>
          <td>${g.status}</td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}

  ${notes && notes.length > 0 ? `
  <div class="section">
    <h2>Coach Notes</h2>
    ${notes.map((n: { note: string; created_at: string }) => `
      <p style="font-size: 13px; margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 8px;">
        <strong>${new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}:</strong> ${n.note}
      </p>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · Nutrio Fuel Coach Portal
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="progress-report-${clientName.toLowerCase().replace(/\s+/g, '-')}-${startDate}.html"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
