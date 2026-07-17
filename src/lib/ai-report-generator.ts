import type { WeeklyReportData } from "./professional-weekly-report-pdf";
import { supabase } from "@/integrations/supabase/client";
import { runAiTask } from "@/lib/ai-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format, startOfWeek } from "date-fns";

interface AIReportContent {
  summary: string;
  weightAnalysis: string;
  weightCommentary: string;
  metabolicCommentary: string;
  macroCommentary: string;
  insights: Array<{ type: "success" | "warning" | "info"; text: string }>;
  recommendations: Array<{ title: string; description: string }>;
  proteinAssessment: string;
}

type ReportLocale = "en" | "ar";

type ReportCacheDatabase = {
  public: {
    Tables: {
      ai_report_cache: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          data_hash: string;
          content: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          data_hash: string;
          content: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          data_hash?: string;
          content?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// This table is introduced by a pending migration and is not in the generated
// database types yet. Keep the cast scoped to the cache instead of untyping the
// shared Supabase client.
const reportCacheClient = supabase as unknown as SupabaseClient<ReportCacheDatabase>;

function hashData(data: WeeklyReportData): string {
  const keyFields = {
    daysLogged: data.daysLogged,
    consistencyScore: data.consistencyScore,
    avgCalories: Math.round(data.avgCalories),
    calorieTarget: data.calorieTarget,
    avgProtein: Math.round(data.avgProtein),
    proteinTarget: data.proteinTarget,
    avgCarbs: Math.round(data.avgCarbs),
    avgFat: Math.round(data.avgFat),
    mealQualityScore: data.mealQualityScore,
    waterAverage: Math.round(data.waterAverage),
    currentStreak: data.currentStreak,
    bestStreak: data.bestStreak,
    activeGoal: data.activeGoal,
    weightProgress: Math.round(data.weightProgress),
    currentWeight: data.currentWeight ? Math.round(data.currentWeight) : null,
    weightChange: data.weightChange ? Math.round(data.weightChange * 10) / 10 : null,
  };
  let hash = 0;
  const str = JSON.stringify(keyFields);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

class AIReportGenerator {

  async generateReportContent(data: WeeklyReportData, userId?: string, locale: ReportLocale = "en"): Promise<{
    content: AIReportContent;
    fromCache: boolean;
  }> {
    if (userId) {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const hash = `${hashData(data)}-${locale}`;

      const cached = await this.getCachedReport(userId, weekStart, hash);
      if (cached) {
        return { content: cached, fromCache: true };
      }

      const content = await this.generateWithAI(data, locale);
      await this.setCachedReport(userId, weekStart, hash, content);
      return { content, fromCache: false };
    }

    const content = await this.generateWithAI(data, locale);
    return { content, fromCache: false };
  }

  generateFallbackContent(data: WeeklyReportData, locale: ReportLocale = "en"): AIReportContent {
    return {
      summary: this.fallbackSummary(data, locale),
      weightAnalysis: this.fallbackWeightAnalysis(data),
      weightCommentary: this.fallbackWeightCommentary(data),
      metabolicCommentary: this.fallbackMetabolicCommentary(data),
      macroCommentary: this.fallbackMacroCommentary(data),
      insights: this.fallbackInsights(data),
      recommendations: this.fallbackRecommendations(data, locale),
      proteinAssessment: this.fallbackProteinAssessment(data),
    };
  }

  private async getCachedReport(
    userId: string,
    weekStart: string,
    dataHash: string
  ): Promise<AIReportContent | null> {
    try {
      const { data, error } = await reportCacheClient
        .from("ai_report_cache")
        .select("content, data_hash")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (error || !data) return null;
      if (data.data_hash !== dataHash) return null;

      return data.content as unknown as AIReportContent;
    } catch {
      return null;
    }
  }

  private async setCachedReport(
    userId: string,
    weekStart: string,
    dataHash: string,
    content: AIReportContent
  ): Promise<void> {
    try {
      await reportCacheClient.from("ai_report_cache").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          data_hash: dataHash,
          content: content as unknown as Record<string, unknown>,
        },
        { onConflict: "user_id,week_start" }
      );
    } catch {
      // Non-critical — cache write failure should not block the report
    }
  }

  private async generateWithAI(data: WeeklyReportData, locale: ReportLocale): Promise<AIReportContent> {
    const aiText = await this.callAiRouter({
      locale,
      daysLogged: data.daysLogged,
      totalDays: data.totalDays,
      consistencyScore: data.consistencyScore,
      avgCalories: data.avgCalories,
      calorieTarget: data.calorieTarget,
      avgProtein: data.avgProtein,
      proteinTarget: data.proteinTarget,
      avgCarbs: data.avgCarbs,
      avgFat: data.avgFat,
      mealQualityScore: data.mealQualityScore,
      waterAverage: data.waterAverage,
      currentStreak: data.currentStreak,
      bestStreak: data.bestStreak,
      activeGoal: data.activeGoal || "general health",
      currentWeight: data.currentWeight,
      weightGoal: data.weightGoal,
      weightChange: data.weightChange,
      weightProgress: data.weightProgress,
    });
    const parsed = this.parseConsolidatedResponse(aiText);

    return {
      summary: this.cleanUnknownText(parsed.summary) || this.fallbackSummary(data, locale),
      weightAnalysis: this.cleanUnknownText(parsed.weightAnalysis) || this.fallbackWeightAnalysis(data),
      weightCommentary: this.cleanUnknownText(parsed.weightCommentary) || this.fallbackWeightCommentary(data),
      metabolicCommentary: this.cleanUnknownText(parsed.metabolicCommentary) || this.fallbackMetabolicCommentary(data),
      macroCommentary: this.cleanUnknownText(parsed.macroCommentary) || this.fallbackMacroCommentary(data),
      insights: this.parseInsightsArray(parsed.insights) || this.fallbackInsights(data),
      recommendations: this.parseRecommendationsArray(parsed.recommendations) || this.fallbackRecommendations(data, locale),
      proteinAssessment: this.cleanUnknownText(parsed.proteinAssessment) || this.fallbackProteinAssessment(data),
    };
  }

  private parseConsolidatedResponse(text: string): Record<string, unknown> {
    if (!text) return {};

    try {
      const cleaned = text.replace(/```(?:json)?\s*|\s*```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {
      // Fall through to field-by-field extraction
    }

    const extract = (key: string): string => {
      const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s");
      const match = text.match(regex);
      return match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n") : "";
    };

    return {
      summary: extract("summary"),
      weightAnalysis: extract("weightAnalysis"),
      weightCommentary: extract("weightCommentary"),
      metabolicCommentary: extract("metabolicCommentary"),
      macroCommentary: extract("macroCommentary"),
      proteinAssessment: extract("proteinAssessment"),
      insights: null,
      recommendations: null,
    };
  }

  private parseInsightsArray(value: unknown): Array<{ type: "success" | "warning" | "info"; text: string }> | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    return value.map((item: Record<string, unknown>) => ({
      type: ["success", "warning", "info"].includes(item.type as string)
        ? (item.type as "success" | "warning" | "info")
        : "info",
      text: String(item.text || ""),
    }));
  }

  private parseRecommendationsArray(value: unknown): Array<{ title: string; description: string }> | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    return value.map((item: Record<string, unknown>) => ({
      title: String(item.title || ""),
      description: String(item.description || ""),
    }));
  }

  private async callAiRouter(input: Record<string, unknown>): Promise<string> {
    try {
      const result = await runAiTask({
        task: "weekly_report",
        input,
      });
      return result.content;
    } catch (error) {
      console.warn("OpenRouter API not available, using fallback content");
      return "";
    }
  }

  private cleanText(text: string): string {
    if (!text) return "";
    return text
      .replace(/&([a-zA-Z])&/g, "$1")
      .replace(/&([a-zA-Z])/g, "$1")
      .replace(/([a-zA-Z])&/g, "$1")
      .replace(/[ \t]+/g, " ")
      .replace(/^&+|&+$/g, "")
      .trim();
  }

  private cleanUnknownText(value: unknown): string {
    return typeof value === "string" ? this.cleanText(value) : "";
  }

  // ─── FALLBACK METHODS ───

  private fallbackSummary(data: WeeklyReportData, locale: ReportLocale = "en"): string {
    if (locale === "ar") {
      if (data.daysLogged < 3) {
        return `مرحبا بك في رحلة تتبع التغذية. سجلت ${data.daysLogged} أيام هذا الأسبوع. للحصول على رؤى أدق، حاول تسجيل 3 إلى 4 أيام على الأقل حتى تتضح أنماطك الغذائية.`;
      }

      const parts: string[] = [];

      if (data.consistencyScore >= 90) {
        parts.push(`أسبوع ممتاز! انتظامك في التسجيل بنسبة ${data.consistencyScore}% يعكس التزاما قويا بفهم تغذيتك.`);
      } else if (data.consistencyScore >= 70) {
        parts.push(`عمل رائع هذا الأسبوع! سجلت ${data.daysLogged} من أصل ${data.totalDays} أيام، وهذا يبني عادة متابعة قوية.`);
      } else if (data.consistencyScore >= 50) {
        parts.push(`تقدم جيد! سجلت ${data.daysLogged} أيام هذا الأسبوع، وكل يوم تسجيل يعطيك فهما أفضل لأنماطك.`);
      } else {
        parts.push(`سجلت ${data.daysLogged} أيام هذا الأسبوع. بناء عادة التسجيل اليومية يحتاج وقتا، وأنت بدأت الطريق.`);
      }

      const calorieDiff = data.avgCalories - data.calorieTarget;
      if (Math.abs(calorieDiff) < 100) {
        parts.push(`اقتربت جدا من هدف السعرات بمتوسط ${Math.round(data.avgCalories)} سعرة.`);
      } else if (calorieDiff > 0) {
        parts.push(`متوسطك ${Math.round(data.avgCalories)} سعرة. إذا كان لديك هدف محدد، فإن ضبط الحصص يساعدك على تحسين المسار.`);
      } else {
        parts.push(`متوسطك ${Math.round(data.avgCalories)} سعرة، وهذا أقل من هدفك وقد يحتاج إلى توازن أفضل مع نشاطك اليومي.`);
      }

      const proteinRatio = data.avgProtein / data.proteinTarget;
      if (proteinRatio >= 1.0) {
        parts.push(`البروتين ممتاز عند ${Math.round(data.avgProtein)} جم ويدعم التعافي والشبع بعد الوجبات.`);
      } else if (proteinRatio >= 0.8) {
        parts.push(`تقدم البروتين جيد عند ${Math.round(data.avgProtein)} جم، أي ${Math.round(proteinRatio * 100)}% من هدفك.`);
      } else {
        parts.push(`متوسط البروتين ${Math.round(data.avgProtein)} جم. إضافة مصدر بروتين في كل وجبة يساعد على الشبع والتعافي.`);
      }

      if (data.currentStreak >= 3) {
        parts.push(`حافظ على الزخم مع سلسلة تسجيل ${data.currentStreak} أيام.`);
      }

      return parts.join(" ");
    }

    if (data.daysLogged < 3) {
      return `Welcome to your nutrition tracking journey! You've logged ${data.daysLogged} days this week. To get personalized insights, try logging at least 3-4 days. Consistent tracking helps you understand your patterns and build better habits.`;
    }

    const parts: string[] = [];

    if (data.consistencyScore >= 90) {
      parts.push(`Fantastic week! Your ${data.consistencyScore}% logging consistency shows real commitment to understanding your nutrition.`);
    } else if (data.consistencyScore >= 70) {
      parts.push(`Great work this week! You logged ${data.daysLogged} out of ${data.totalDays} days, building a solid tracking habit.`);
    } else if (data.consistencyScore >= 50) {
      parts.push(`Good progress! You logged ${data.daysLogged} days this week. Every day of tracking gives you more insight into your patterns.`);
    } else {
      parts.push(`You logged ${data.daysLogged} days this week. Building a daily tracking habit takes time, and you're on your way!`);
    }

    const calorieDiff = data.avgCalories - data.calorieTarget;
    if (Math.abs(calorieDiff) < 100) {
      parts.push(`You hit your calorie target almost perfectly, averaging ${Math.round(data.avgCalories)} kcal.`);
    } else if (calorieDiff > 0 && calorieDiff < 300) {
      parts.push(`You averaged ${Math.round(data.avgCalories)} kcal, which gives you extra fuel for activity and recovery.`);
    } else if (calorieDiff > 0) {
      parts.push(`Your intake averaged ${Math.round(data.avgCalories)} kcal. If you're working toward specific goals, tracking portion sizes can help fine-tune your approach.`);
    } else if (calorieDiff > -300) {
      parts.push(`You averaged ${Math.round(data.avgCalories)} kcal, creating a moderate deficit that supports gradual progress.`);
    } else {
      parts.push(`Your intake is significantly below your target. Make sure you're fueling enough for your daily activities and workouts.`);
    }

    const proteinRatio = data.avgProtein / data.proteinTarget;
    if (proteinRatio >= 1.0) {
      parts.push(`Excellent protein intake at ${Math.round(data.avgProtein)}g - hitting your target supports muscle recovery and helps you feel satisfied after meals.`);
    } else if (proteinRatio >= 0.8) {
      parts.push(`Good protein progress at ${Math.round(data.avgProtein)}g. You're at ${Math.round(proteinRatio * 100)}% of your goal.`);
    } else {
      parts.push(`Protein intake averaged ${Math.round(data.avgProtein)}g. Adding protein-rich foods to each meal can help with fullness and recovery.`);
    }

    if (data.currentStreak >= 3) {
      parts.push(`Keep up the momentum with your ${data.currentStreak}-day logging streak!`);
    }

    return parts.join(" ");
  }

  private fallbackWeightAnalysis(data: WeeklyReportData): string {
    if (!data.currentWeight) {
      return `Weight tracking helps you see trends over time. For the most useful data, try weighing yourself 2-3 times per week at the same time of day.`;
    }

    const parts = [`Your current weight is ${data.currentWeight.toFixed(1)} kg.`];

    if (data.weightChange !== null) {
      const abs = Math.abs(data.weightChange);
      if (data.weightChange < 0) {
        parts.push(abs > 1.0
          ? `This week you saw a larger decrease of ${abs.toFixed(1)} kg. This might include water weight changes along with any body composition shifts.`
          : abs > 0.5
            ? `You had a steady decrease of ${abs.toFixed(1)} kg this week.`
            : `You had a small decrease of ${abs.toFixed(1)} kg.`);
      } else if (data.weightChange > 0) {
        parts.push(abs > 1.0
          ? `Your weight increased by ${abs.toFixed(1)} kg. Day-to-day fluctuations are normal and can be influenced by hydration, meal timing, and sodium intake.`
          : `Your weight increased by ${abs.toFixed(1)} kg.`);
      } else {
        parts.push(`Your weight stayed steady this week.`);
      }
    }

    if (data.weightGoal) {
      const pct = Math.round(data.weightProgress);
      parts.push(pct >= 75
        ? `You're ${pct}% toward your goal - excellent progress!`
        : pct >= 50
          ? `You're ${pct}% of the way to your target weight.`
          : pct >= 25
            ? `You're building momentum at ${pct}% toward your goal.`
            : `You're making progress toward your ${data.weightGoal} kg target.`);
    }

    return parts.join(" ");
  }

  private fallbackWeightCommentary(data: WeeklyReportData): string {
    if (data.weightChange === null) {
      return `To track weight trends effectively, try weighing yourself at consistent times (like morning, before eating). Looking at weekly averages gives you a clearer picture than single measurements.`;
    }

    const abs = Math.abs(data.weightChange);

    if (abs > 1.0) {
      return data.weightChange < 0
        ? `A ${abs.toFixed(1)} kg weekly decrease is faster than typical. While exciting, make sure you're eating enough to maintain energy for daily activities and workouts. Very low intake can make it harder to stick with your plan long-term.`
        : `A ${abs.toFixed(1)} kg increase in one week is worth noting. Much of this could be normal fluctuation from water retention, carb intake, or meal timing. Look at the trend over 2-4 weeks rather than single weeks.`;
    }

    if (abs > 0.5) {
      return data.weightChange < 0
        ? `A ${abs.toFixed(1)} kg decrease is a solid, sustainable pace. You're creating a consistent calorie deficit while (hopefully) maintaining good energy levels.`
        : `A ${abs.toFixed(1)} kg gain is moderate. If you're building muscle or just had higher sodium meals, this is normal variation.`;
    }

    return `A ${abs.toFixed(1)} kg change is within normal week-to-week variation. Weight naturally fluctuates based on hydration, meal timing, and other factors. Focus on the trend over several weeks.`;
  }

  private fallbackMetabolicCommentary(data: WeeklyReportData): string {
    const calorieDiff = data.calorieTarget - data.avgCalories;
    const deficitPct = (calorieDiff / data.calorieTarget) * 100;
    const absPct = Math.abs(deficitPct);

    if (data.daysLogged < 3) {
      return `With limited logging data, it's hard to assess your nutrition patterns. Try logging more days next week to get personalized insights about your energy intake and consistency.`;
    }

    if (absPct <= 10) {
      return `Your calorie intake is very close to your target - within 10%. This balance typically provides steady energy throughout the day and supports good workout performance. You're averaging ${Math.round(data.avgCalories)} kcal against your ${data.calorieTarget} kcal goal.`;
    }

    if (calorieDiff > 10 && calorieDiff <= 25) {
      return `You're running a moderate calorie deficit of about ${Math.round(deficitPct)}%. This level supports gradual progress while still providing enough fuel for daily activities. Your average of ${Math.round(data.avgCalories)} kcal creates a sustainable approach.`;
    }

    if (calorieDiff > 25) {
      return `Your intake is significantly below your target - about ${Math.round(deficitPct)}% less than planned. While this creates faster short-term changes, very low intake can leave you feeling tired and increase cravings. Consider adding nutritious snacks or slightly larger portions if you're struggling with energy.`;
    }

    if (calorieDiff < -25) {
      return `Your intake is running about ${Math.round(absPct)}% above your target. This surplus provides plenty of energy for activity and muscle building, but may slow progress if you're working toward fat loss.`;
    }

    return `Your calorie intake is running ${Math.round(absPct)}% above target. This modest surplus can support muscle gain and workout recovery. If your goal is maintenance or fat loss, you might gradually adjust portions.`;
  }

  private fallbackMacroCommentary(data: WeeklyReportData): string {
    const totalMacros = data.avgProtein * 4 + data.avgCarbs * 4 + data.avgFat * 9;
    if (totalMacros === 0) {
      return `Macro tracking helps you understand the composition of your meals. Logging your protein, carbs, and fat gives you a clearer picture of your nutrition patterns.`;
    }

    const proteinPct = Math.round((data.avgProtein * 4 / totalMacros) * 100);
    const carbsPct = Math.round((data.avgCarbs * 4 / totalMacros) * 100);
    const fatPct = 100 - proteinPct - carbsPct;
    const proteinRatio = data.avgProtein / data.proteinTarget;

    let text = `Your nutrition breakdown shows ${proteinPct}% protein, ${carbsPct}% carbs, and ${fatPct}% fat. `;

    if (proteinPct >= 30) {
      text += `Your protein at ${proteinPct}% is excellent for building and maintaining muscle. You're hitting ${Math.round(data.avgProtein)}g against your ${data.proteinTarget}g goal. High protein also helps you feel full after meals.`;
    } else if (proteinPct >= 25) {
      text += `With ${proteinPct}% of calories from protein, you're in a great range for body composition goals. Your ${Math.round(data.avgProtein)}g average is ${Math.round(proteinRatio * 100)}% of your target.`;
    } else if (proteinPct >= 20) {
      text += `Your ${proteinPct}% protein intake is solid. Bumping it up toward 25-30% could help with workout recovery and meal satisfaction. You're currently at ${Math.round(proteinRatio * 100)}% of your protein goal.`;
    } else {
      text += `Protein makes up ${proteinPct}% of your intake, which is below optimal ranges. Adding more protein-rich foods (chicken, fish, eggs, Greek yogurt, legumes) can help with muscle maintenance and keeping you full.`;
    }

    if (carbsPct > 50) {
      text += ` Carbs at ${carbsPct}% give you plenty of energy for workouts and daily activities.`;
    } else if (carbsPct < 30) {
      text += ` Your ${carbsPct}% carb intake is on the lower side. If you're feeling low on energy during workouts, you might benefit from adding more carbohydrates.`;
    }

    return text;
  }

  private fallbackInsights(data: WeeklyReportData): Array<{ type: "success" | "warning" | "info"; text: string }> {
    const insights: Array<{ type: "success" | "warning" | "info"; text: string }> = [];

    if (data.consistencyScore >= 90) {
      insights.push({ type: "success", text: `Outstanding dedication! ${data.consistencyScore}% consistency shows you're building a strong tracking habit.` });
    } else if (data.consistencyScore >= 75) {
      insights.push({ type: "success", text: `Great consistency at ${data.consistencyScore}%. You're developing a solid routine.` });
    } else if (data.consistencyScore >= 50) {
      insights.push({ type: "info", text: `Logging ${data.consistencyScore}% of the time. Aim for one more day next week to build momentum!` });
    } else if (data.consistencyScore < 50) {
      insights.push({ type: "info", text: `Consistency at ${data.consistencyScore}%. Try logging right after meals - it only takes a minute!` });
    }

    if (data.currentStreak >= 7) {
      insights.push({ type: "success", text: `Amazing ${data.currentStreak}-day streak! Keep that momentum going.` });
    } else if (data.currentStreak >= 3) {
      insights.push({ type: "success", text: `${data.currentStreak}-day streak! Consistency is key to seeing patterns.` });
    }

    const calorieAdherence = Math.abs(((data.avgCalories - data.calorieTarget) / data.calorieTarget) * 100);
    if (calorieAdherence <= 10) {
      insights.push({ type: "success", text: `Nailed your calorie goal! ${Math.round(data.avgCalories)} kcal is right on target.` });
    } else if (data.avgCalories > data.calorieTarget * 1.2) {
      insights.push({ type: "info", text: `Calorie intake above target. Check portion sizes and liquid calories.` });
    } else if (data.avgCalories < data.calorieTarget * 0.7) {
      insights.push({ type: "info", text: `Low caloric intake detected. Make sure you're fueling enough for your activities.` });
    }

    const proteinRatio = data.avgProtein / data.proteinTarget;
    if (proteinRatio >= 1.0) {
      insights.push({ type: "success", text: `Protein goal achieved! ${Math.round(data.avgProtein)}g supports recovery and fullness.` });
    } else if (proteinRatio < 0.6) {
      insights.push({ type: "info", text: `Protein at ${Math.round(proteinRatio * 100)}% of goal. Add eggs, Greek yogurt, or lean meats.` });
    }

    if (data.mealQualityScore >= 85) {
      insights.push({ type: "success", text: `Excellent meal quality (${data.mealQualityScore}/100)! Great food choices.` });
    } else if (data.mealQualityScore < 50) {
      insights.push({ type: "info", text: `Meal quality at ${data.mealQualityScore}/100. Focus on whole foods.` });
    }

    if (data.waterAverage >= 7) {
      insights.push({ type: "success", text: `Hydration on point! ${data.waterAverage.toFixed(1)} glasses daily.` });
    } else if (data.waterAverage < 4) {
      insights.push({ type: "info", text: `Hydration low at ${data.waterAverage.toFixed(1)} glasses. Carry a water bottle!` });
    }

    if (data.weightChange !== null && data.weightChange < 0) {
      insights.push({ type: "success", text: `Weight trending down! ${Math.abs(data.weightChange).toFixed(1)} kg change this week.` });
    }

    if (insights.length === 0) {
      insights.push({ type: "info", text: "Keep logging daily to unlock personalized insights about your nutrition patterns." });
    }

    return insights.slice(0, 4);
  }

  private fallbackRecommendations(data: WeeklyReportData, locale: ReportLocale = "en"): Array<{ title: string; description: string }> {
    if (locale === "ar") {
      const recommendations: Array<{ title: string; description: string }> = [];
      const proteinRatio = data.avgProtein / data.proteinTarget;

      if (proteinRatio < 0.8) {
        recommendations.push({
          title: "عزز البروتين",
          description: `أنت عند ${Math.round(data.avgProtein)} جم من هدف ${data.proteinTarget} جم. أضف بيضا في الإفطار، زبادي يوناني كسناك، أو لحوما خفيفة في العشاء.`,
        });
      }

      if (data.waterAverage < 6) {
        recommendations.push({
          title: "تحدي الترطيب",
          description: `متوسطك الحالي ${data.waterAverage.toFixed(1)} أكواب يوميا. استخدم تذكيرات أو زجاجة محددة العلامات للوصول إلى 8 أكواب.`,
        });
      }

      if (data.consistencyScore < 70) {
        recommendations.push({
          title: "ابن عادة التسجيل",
          description: `انتظامك ${data.consistencyScore}%. سجل الوجبات مباشرة بعد الأكل، فهي لا تستغرق إلا دقيقتين.`,
        });
      }

      if (recommendations.length < 3) {
        recommendations.push({
          title: "خطط مسبقا",
          description: "تجهيز الوجبات أو اختيارها مسبقا يجعل الالتزام أسهل خلال الأسبوع.",
        });
      }

      return recommendations.slice(0, 4);
    }

    const recommendations: Array<{ title: string; description: string }> = [];

    const proteinRatio = data.avgProtein / data.proteinTarget;
    if (proteinRatio < 0.8) {
      recommendations.push({
        title: "Boost Your Protein",
        description: `You're at ${Math.round(data.avgProtein)}g of your ${data.proteinTarget}g goal. Try adding eggs at breakfast, Greek yogurt as a snack, or lean meats at dinner.`,
      });
    }

    if (data.waterAverage < 6) {
      recommendations.push({
        title: "Hydration Challenge",
        description: `Currently at ${data.waterAverage.toFixed(1)} glasses/day. Set phone reminders or use a marked bottle to hit 8 glasses.`,
      });
    }

    if (data.consistencyScore < 70) {
      recommendations.push({
        title: "Build the Logging Habit",
        description: `At ${data.consistencyScore}% consistency. Log meals immediately after eating - it only takes 2 minutes!`,
      });
    }

    const calorieDiff = data.avgCalories - data.calorieTarget;
    if (calorieDiff > 300) {
      recommendations.push({
        title: "Mindful Portions",
        description: `Running ${Math.round(calorieDiff)} kcal above target. Use a food scale for accuracy and watch liquid calories.`,
      });
    } else if (calorieDiff < -300) {
      recommendations.push({
        title: "Fuel Adequately",
        description: `${Math.round(Math.abs(calorieDiff))} kcal below target. Add healthy snacks like nuts or fruit.`,
      });
    }

    if (data.activeGoal === "weight_loss" && data.weightChange && data.weightChange >= 0) {
      recommendations.push({
        title: "Accelerate Progress",
        description: "Weight stable? Consider a 10% calorie adjustment or add 30 minutes of daily walking.",
      });
    } else if (data.activeGoal === "muscle_gain") {
      recommendations.push({
        title: "Support Muscle Growth",
        description: "Ensure you're eating at a 200-300 kcal surplus. Prioritize protein and lift progressively.",
      });
    }

    if (data.mealQualityScore < 60) {
      recommendations.push({
        title: "Upgrade Your Nutrition",
        description: `Quality score at ${data.mealQualityScore}/100. Swap processed foods for whole grains and vegetables.`,
      });
    }

    if (recommendations.length < 3) {
      const defaults = [
        { title: "Prioritize Sleep", description: "Aim for 7-9 hours of quality sleep. Poor sleep increases hunger and cravings." },
        { title: "Plan Ahead", description: "Meal prep on weekends saves time and ensures healthy options are available." },
        { title: "Eat Mindfully", description: "Put your phone down during meals and eat slowly. It takes 20 minutes for fullness signals." },
      ];
      recommendations.push(defaults[Math.floor(Math.random() * defaults.length)]);
    }

    return recommendations.slice(0, 4);
  }

  private fallbackProteinAssessment(data: WeeklyReportData): string {
    const ratio = data.avgProtein / data.proteinTarget;
    const pct = Math.round(ratio * 100);

    if (ratio >= 1.0) {
      return `PROTEIN STATUS: EXCELLENT (${pct}%). Your ${Math.round(data.avgProtein)}g meets your goal. This level supports workout recovery and helps you feel satisfied after meals.`;
    }
    if (ratio >= 0.8) {
      return `PROTEIN STATUS: GOOD (${pct}%). At ${Math.round(data.avgProtein)}g, you're close to your ${data.proteinTarget}g target. Hitting 100% would optimize recovery and meal satisfaction.`;
    }
    if (ratio >= 0.6) {
      return `PROTEIN STATUS: NEEDS IMPROVEMENT (${pct}%). You're at ${Math.round(data.avgProtein)}g of ${data.proteinTarget}g. Add protein sources to each meal - chicken, fish, eggs, Greek yogurt, or legumes.`;
    }
    return `PROTEIN STATUS: LOW (${pct}%). At ${Math.round(data.avgProtein)}g, you're well below your ${data.proteinTarget}g target. Focus on adding 20-30g protein at each meal.`;
  }
}

export const aiReportGenerator = new AIReportGenerator();
export type { AIReportContent };
