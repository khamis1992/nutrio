import type { BloodMarker } from "@/lib/blood-markers";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const FREE_MODELS = [
  "google/gemini-2.5-flash-lite:free",
  "deepseek/deepseek-v3-0324:free",
  "arcee-ai/trinity-large-preview:free",
  "openai/gpt-oss-120b:free",
];

interface UserProfile {
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
  healthGoals?: string;
}

export async function analyzeBloodWork(
  markers: BloodMarker[],
  profile: UserProfile
): Promise<string> {
  const apiKey = import.meta?.env?.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    return getFallbackAnalysis(markers);
  }

  const systemPrompt = `You are a clinical nutritionist and health analyst. Analyze blood test results and provide:
1. Summary of findings (which markers are abnormal)
2. Potential health implications
3. Specific diet and nutrition recommendations
4. Lifestyle changes suggested
5. Which markers to watch over time

Use clear, simple language. Be encouraging but honest about concerns.
Format with markdown headers and bullet points.`;

  const markerList = markers
    .map(
      (m) =>
        `- ${m.marker_name}: ${m.value} ${m.unit} (Normal: ${m.normal_min ?? "N/A"} - ${m.normal_max ?? "N/A"}) [${m.status.toUpperCase()}]`
    )
    .join("\n");

  const userPrompt = `Analyze these blood markers for a ${profile.age ?? "unknown"}yo ${profile.gender ?? "person"}${profile.healthGoals ? ` with health goals: ${profile.healthGoals}` : ""}.

Blood Test Results:
${markerList}

Please provide a comprehensive analysis with actionable diet and lifestyle recommendations.`;

  for (const model of FREE_MODELS) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Nutrio Blood Analysis",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: 2000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || getFallbackAnalysis(markers);
      }
    } catch {
      continue;
    }
  }

  return getFallbackAnalysis(markers);
}

function getFallbackAnalysis(markers: BloodMarker[]): string {
  const abnormal = markers.filter((m) => m.status !== "normal");
  const critical = markers.filter((m) => m.status === "critical");

  let analysis = "## 📊 Blood Work Analysis\n\n";

  if (abnormal.length === 0) {
    analysis += "**Great news!** All your markers are within normal ranges. Keep up your healthy lifestyle! ✅\n\n";
  } else {
    analysis += `### Summary\n${abnormal.length} of ${markers.length} markers are outside normal ranges.`;
    if (critical.length > 0) {
      analysis += `\n\n⚠️ **Critical values detected:** ${critical.map((m) => m.marker_name).join(", ")}. Please consult your healthcare provider.`;
    }
    analysis += "\n\n### Recommendations\n";
    abnormal.forEach((m) => {
      if (m.marker_name.includes("Vitamin D") || m.marker_name.includes("B12")) {
        analysis += `- **${m.marker_name}**: Consider adding vitamin-rich foods or supplements. Consult your doctor.\n`;
      } else if (m.marker_name.includes("Glucose") || m.marker_name.includes("HbA1c")) {
        analysis += `- **${m.marker_name}**: Focus on low-glycemic foods, reduce refined sugars, and increase fiber intake.\n`;
      } else if (["LDL", "Cholesterol", "Triglycerides"].some((n) => m.marker_name.includes(n))) {
        analysis += `- **${m.marker_name}**: Reduce saturated fats, increase omega-3 fatty acids, and add more soluble fiber.\n`;
      } else {
        analysis += `- **${m.marker_name}**: Follow up with your healthcare provider for personalized advice.\n`;
      }
    });
  }

  analysis += "\n---\n*This is a general analysis. Always consult your healthcare provider for medical advice.*";
  return analysis;
}
