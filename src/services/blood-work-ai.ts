import type { BloodMarker } from "@/lib/blood-markers";

interface UserProfile {
  fullName?: string | null;
  age?: number;
  gender?: string | null;
  currentWeightKg?: number | null;
  targetWeightKg?: number | null;
  heightCm?: number | null;
  healthGoal?: string | null;
  activityLevel?: string | null;
  dailyCalorieTarget?: number | null;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
  trendSummary?: string;
}

function formatProfileValue(value: string | number | null | undefined, suffix = "") {
  if (value === null || value === undefined || value === "") return "Not provided";
  return `${value}${suffix}`;
}

function buildCustomerContext(profile: UserProfile) {
  return [
    `Name: ${formatProfileValue(profile.fullName)}`,
    `Age: ${formatProfileValue(profile.age)}`,
    `Gender: ${formatProfileValue(profile.gender)}`,
    `Current weight: ${formatProfileValue(profile.currentWeightKg, " kg")}`,
    `Target weight: ${formatProfileValue(profile.targetWeightKg, " kg")}`,
    `Height: ${formatProfileValue(profile.heightCm, " cm")}`,
    `Health goal: ${formatProfileValue(profile.healthGoal)}`,
    `Activity level: ${formatProfileValue(profile.activityLevel)}`,
    `Daily calorie target: ${formatProfileValue(profile.dailyCalorieTarget, " kcal")}`,
    `Macro targets: protein ${formatProfileValue(profile.proteinTargetG, "g")}, carbs ${formatProfileValue(profile.carbsTargetG, "g")}, fat ${formatProfileValue(profile.fatTargetG, "g")}`,
  ].join("\n");
}

export async function analyzeBloodWork(
  markers: BloodMarker[],
  profile: UserProfile
): Promise<string> {
  const systemPrompt = `You are Nutrio's AI nutrition insight assistant. Analyze blood test markers for wellness and nutrition guidance only.

Critical rules:
- Never mention DeepSeek, OpenRouter, model names, or any third-party AI provider.
- Do not invent customer demographics. Use only the verified customer context supplied by Nutrio.
- If name, age, gender, height, weight, or goals are missing, write "not provided" and do not guess.
- Do not diagnose disease, declare a medical condition, or replace a healthcare professional.
- Explain that this is an AI-generated guidance summary, not a medical report or diagnosis.
- Base concerns only on supplied marker values and their normal ranges.
- If report trend context is available, use it to explain whether relevant markers are improving, stable, or moving in the wrong direction.

Provide:
1. Summary of findings, including abnormal markers
2. Potential health considerations without diagnosis
3. Specific diet and nutrition recommendations
4. Lifestyle changes suggested
5. Which markers to watch over time

Use clear, simple language. Be encouraging but honest about concerns.
Do not create a separate customer profile or customer context section in the final report. Nutrio already displays verified customer details in the app UI.
Format with markdown headers and bullet points.`;

  const markerList = markers
    .map(
      (marker) =>
        `- ${marker.marker_name}: ${marker.value} ${marker.unit} (Normal: ${marker.normal_min ?? "N/A"} - ${marker.normal_max ?? "N/A"}) [${marker.status.toUpperCase()}]`
    )
    .join("\n");

  const userPrompt = `Create a Nutrio AI guidance summary using only this verified customer context and these blood markers.

Verified customer context:
${buildCustomerContext(profile)}

Blood Test Results:
${markerList}

Report trend context:
${profile.trendSummary || "No previous comparable report is available yet."}

Please provide an organized, customer-specific wellness and nutrition summary. Do not add any demographic detail that is not listed above.`;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase configuration is missing.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/proxy-openrouter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.details || data?.error || `AI analysis failed with status ${response.status}.`);
  }

  if (!data?.content) {
    throw new Error(data?.details || data?.error || "AI analysis service returned an empty response.");
  }

  return data.content;
}
