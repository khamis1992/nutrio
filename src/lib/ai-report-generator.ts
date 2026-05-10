import type { WeeklyReportData } from "./professional-weekly-report-pdf";
import { supabase } from "@/integrations/supabase/client";

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

class AIReportGenerator {
  private async callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke("proxy-openrouter", {
      body: { systemPrompt, userPrompt },
    });
    if (error || !data?.content) {
      console.warn("OpenRouter API not available, using fallback content");
      return "";
    }
    return data.content;
  }

  private cleanText(text: string): string {
    if (!text) return "";
    
    return text
      // Remove & characters between letters (for corrupted AI output)
      .replace(/&([a-zA-Z])&/g, "$1")
      .replace(/&([a-zA-Z])/g, "$1")
      .replace(/([a-zA-Z])&/g, "$1")
      // Normalize multiple spaces to single space (preserve word spacing)
      .replace(/[ \t]+/g, " ")
      // Remove standalone & at start/end
      .replace(/^&+|&+$/g, "")
      .trim();
  }

  async generateReportContent(data: WeeklyReportData): Promise<AIReportContent> {
    const [
      summary,
      weightAnalysis,
      weightCommentary,
      metabolicCommentary,
      macroCommentary,
      insightsJson,
      recommendationsJson,
      proteinAssessment,
    ] = await Promise.all([
      this.generateSummary(data),
      this.generateWeightAnalysis(data),
      this.generateWeightCommentary(data),
      this.generateMetabolicCommentary(data),
      this.generateMacroCommentary(data),
      this.generateInsights(data),
      this.generateRecommendations(data),
      this.generateProteinAssessment(data),
    ]);

    return {
      summary: this.cleanText(summary) || this.fallbackSummary(data),
      weightAnalysis: this.cleanText(weightAnalysis) || this.fallbackWeightAnalysis(data),
      weightCommentary: this.cleanText(weightCommentary) || this.fallbackWeightCommentary(data),
      metabolicCommentary: this.cleanText(metabolicCommentary) || this.fallbackMetabolicCommentary(data),
      macroCommentary: this.cleanText(macroCommentary) || this.fallbackMacroCommentary(data),
      insights: this.parseInsights(insightsJson) || this.fallbackInsights(data),
      recommendations: this.parseRecommendations(recommendationsJson) || this.fallbackRecommendations(data),
      proteinAssessment: this.cleanText(proteinAssessment) || this.fallbackProteinAssessment(data),
    };
  }

  private async generateSummary(data: WeeklyReportData): Promise<string> {
    const systemPrompt = `You are a supportive nutrition coach writing a weekly lifestyle report. 

IMPORTANT RULES:
- NEVER use medical terminology (no hormones, thyroid, metabolic damage, disease, diagnosis)
- NEVER sound clinical or diagnostic
- Use lifestyle and performance language only
- Focus on habits, consistency, and energy
- Be encouraging and motivational
- This is NOT a medical report

Write 2-3 sentences summarizing the week's nutrition habits and performance.`;
    
    const userPrompt = `Write a personalized weekly nutrition summary for a user with these stats:
- Days logged: ${data.daysLogged}/${data.totalDays} (${data.consistencyScore}% consistency)
- Average calories: ${Math.round(data.avgCalories)}/${data.calorieTarget} kcal
- Average protein: ${Math.round(data.avgProtein)}/${data.proteinTarget}g
- Current streak: ${data.currentStreak} days
- Meal quality score: ${data.mealQualityScore}/100
- Water average: ${data.waterAverage.toFixed(1)}/8 glasses
${data.currentWeight ? `- Current weight: ${data.currentWeight.toFixed(1)} kg` : ''}
${data.weightChange !== null ? `- Weight change: ${data.weightChange > 0 ? '+' : ''}${data.weightChange.toFixed(1)} kg` : ''}
- Goal type: ${data.activeGoal || 'general health'}

Use supportive, non-medical language. Focus on habits and progress.`;

    return this.callOpenRouter(systemPrompt, userPrompt);
  }

  private async generateWeightAnalysis(data: WeeklyReportData): Promise<string> {
    if (!data.currentWeight) return "";
    
    const systemPrompt = `You are a nutrition coach providing weight trend feedback.

IMPORTANT:
- NO medical language
- NO clinical terms
- Focus on trends and patterns
- Use neutral, supportive language
- This is lifestyle tracking, not medical monitoring`;
    
    const userPrompt = `Provide weight trend feedback:
- Current weight: ${data.currentWeight.toFixed(1)} kg
${data.weightGoal ? `- Goal weight: ${data.weightGoal} kg` : '- No goal set'}
${data.weightChange !== null ? `- Weekly change: ${data.weightChange > 0 ? '+' : ''}${data.weightChange.toFixed(1)} kg` : '- No change data'}
- Progress toward goal: ${Math.round(data.weightProgress)}%

Use lifestyle-focused language only. No medical references.`;

    return this.callOpenRouter(systemPrompt, userPrompt);
  }

  private async generateWeightCommentary(data: WeeklyReportData): Promise<string> {
    if (data.weightChange === null) return "";
    
    const systemPrompt = `You are a nutrition coach commenting on weight patterns.

CRITICAL:
- NO clinical language
- NO medical references
- NO hormone or physiological terms
- Use only lifestyle and habit language
- Focus on behavior, not biology`;
    
    const userPrompt = `Comment on this weight pattern:
- Weekly change: ${Math.abs(data.weightChange).toFixed(1)} kg ${data.weightChange < 0 ? 'loss' : 'gain'}
- Goal type: ${data.activeGoal || 'maintenance'}
- Rate: ${Math.abs(data.weightChange) > 1.0 ? 'rapid' : Math.abs(data.weightChange) > 0.5 ? 'moderate' : 'minimal'}

Provide lifestyle perspective only. No medical commentary.`;

    return this.callOpenRouter(systemPrompt, userPrompt);
  }

  private async generateMetabolicCommentary(data: WeeklyReportData): Promise<string> {
    const calorieDiff = data.calorieTarget - data.avgCalories;
    const deficitPct = (calorieDiff / data.calorieTarget) * 100;
    
    const systemPrompt = `You are a nutrition coach discussing fuel balance and energy intake.

STRICT RULES:
- NEVER mention: metabolic adaptation, hormones, thyroid, metabolic damage, clinical terms
- Use ONLY: energy balance, fuel intake, nutrition alignment, consistency, adherence
- Focus on performance and daily energy
- This is lifestyle coaching, not medical advice`;
    
    const userPrompt = `Discuss fuel balance:
- Target calories: ${data.calorieTarget} kcal
- Average intake: ${Math.round(data.avgCalories)} kcal
- Difference: ${deficitPct > 0 ? '-' : '+'}${Math.abs(Math.round(deficitPct))}%
- Consistency: ${data.consistencyScore}%
- Goal: ${data.activeGoal || 'general health'}

Use energy and performance language only. No medical or metabolic terminology.`;

    return this.callOpenRouter(systemPrompt, userPrompt);
  }

  private async generateMacroCommentary(data: WeeklyReportData): Promise<string> {
    const totalMacros = data.avgProtein * 4 + data.avgCarbs * 4 + data.avgFat * 9;
    const proteinPct = totalMacros > 0 ? Math.round((data.avgProtein * 4 / totalMacros) * 100) : 0;
    const carbsPct = totalMacros > 0 ? Math.round((data.avgCarbs * 4 / totalMacros) * 100) : 0;
    const fatPct = totalMacros > 0 ? 100 - proteinPct - carbsPct : 0;
    
    const systemPrompt = `You are a nutrition coach analyzing macro distribution for lifestyle optimization.

RULES:
- NO medical language
- Focus on performance, satiety, and goals
- Use lifestyle and nutrition language only`;
    
    const userPrompt = `Analyze this macro distribution:
- Protein: ${proteinPct}% (${Math.round(data.avgProtein)}g / ${data.proteinTarget}g target)
- Carbs: ${carbsPct}% (${Math.round(data.avgCarbs)}g)
- Fat: ${fatPct}% (${Math.round(data.avgFat)}g)
- Goal type: ${data.activeGoal || 'general health'}

Discuss from lifestyle and performance perspective only.`;

    return this.callOpenRouter(systemPrompt, userPrompt);
  }

  private async generateInsights(data: WeeklyReportData): Promise<string> {
    const systemPrompt = `You are a nutrition coach generating lifestyle insights.

CRITICAL RULES:
- Generate 3-4 insights about habits and consistency
- NO medical references
- NO clinical language
- Focus on behavior, routine, and structure
- Return ONLY valid JSON array

Format: [{"type": "success|warning|info", "text": "insight text"}]`;
    
    const userPrompt = `Generate habit-focused insights:
- Consistency: ${data.consistencyScore}%
- Days logged: ${data.daysLogged}/${data.totalDays}
- Streak: ${data.currentStreak} days (best: ${data.bestStreak})
- Meal quality: ${data.mealQualityScore}/100
- Water: ${data.waterAverage.toFixed(1)}/8 glasses
- Calorie alignment: ${Math.round((data.avgCalories / data.calorieTarget) * 100)}%
- Protein alignment: ${Math.round((data.avgProtein / data.proteinTarget) * 100)}%

Focus on habits and routines. No medical language. Return JSON array only.`;

    return this.callOpenRouter(systemPrompt, userPrompt);
  }

  private async generateRecommendations(data: WeeklyReportData): Promise<string> {
    const systemPrompt = `You are a nutrition coach providing habit recommendations.

CRITICAL RULES:
- Generate 3-4 actionable recommendations
- NO medical advice
- NO clinical language
- Focus on habits, routine, and structure
- Return ONLY valid JSON array

Format: [{"title": "Short Title", "description": "Recommendation"}]`;
    
    const userPrompt = `Generate habit-based recommendations:
- Goal: ${data.activeGoal || 'general health'}
- Consistency: ${data.consistencyScore}%
- Protein gap: ${Math.round(data.proteinTarget - data.avgProtein)}g
- Water gap: ${Math.round(8 - data.waterAverage)} glasses
- Calorie variance: ${Math.round(((data.avgCalories - data.calorieTarget) / data.calorieTarget) * 100)}%
- Meal quality: ${data.mealQualityScore}/100

Focus on building habits and routine. No medical language. Return JSON array only.`;

    return this.callOpenRouter(systemPrompt, userPrompt);
  }

  private async generateProteinAssessment(data: WeeklyReportData): Promise<string> {
    const ratio = data.avgProtein / data.proteinTarget;
    
    const systemPrompt = `You are a nutrition coach assessing protein intake for lifestyle goals.

STRICT RULES:
- NO medical or clinical language
- NO references to biological processes
- Focus on satiety, meal structure, and goals
- Use lifestyle and performance language only`;
    
    const userPrompt = `Assess protein intake:
- Average: ${Math.round(data.avgProtein)}g / ${data.proteinTarget}g target
- Achievement: ${Math.round(ratio * 100)}%
- Goal type: ${data.activeGoal || 'general health'}

Discuss from lifestyle and meal planning perspective. No medical terminology.`;

    return this.callOpenRouter(systemPrompt, userPrompt);
  }

  // FALLBACK METHODS - LIFESTYLE-FOCUSED, NON-MEDICAL

  private fallbackSummary(data: WeeklyReportData): string {
    const summaries = [];
    
    // Data availability check
    if (data.daysLogged < 3) {
      return `Welcome to your nutrition tracking journey! You've logged ${data.daysLogged} days this week. To get personalized insights, try logging at least 3-4 days. Consistent tracking helps you understand your patterns and build better habits.`;
    }
    
    // Consistency-based opening
    if (data.consistencyScore >= 90) {
      summaries.push(`Fantastic week! Your ${data.consistencyScore}% logging consistency shows real commitment to understanding your nutrition.`);
    } else if (data.consistencyScore >= 70) {
      summaries.push(`Great work this week! You logged ${data.daysLogged} out of ${data.totalDays} days, building a solid tracking habit.`);
    } else if (data.consistencyScore >= 50) {
      summaries.push(`Good progress! You logged ${data.daysLogged} days this week. Every day of tracking gives you more insight into your patterns.`);
    } else {
      summaries.push(`You logged ${data.daysLogged} days this week. Building a daily tracking habit takes time, and you're on your way!`);
    }
    
    // Calorie alignment
    const calorieDiff = data.avgCalories - data.calorieTarget;
    if (Math.abs(calorieDiff) < 100) {
      summaries.push(`You hit your calorie target almost perfectly, averaging ${Math.round(data.avgCalories)} kcal.`);
    } else if (calorieDiff > 0 && calorieDiff < 300) {
      summaries.push(`You averaged ${Math.round(data.avgCalories)} kcal, which gives you extra fuel for activity and recovery.`);
    } else if (calorieDiff > 0) {
      summaries.push(`Your intake averaged ${Math.round(data.avgCalories)} kcal. If you're working toward specific goals, tracking portion sizes can help fine-tune your approach.`);
    } else if (calorieDiff > -300) {
      summaries.push(`You averaged ${Math.round(data.avgCalories)} kcal, creating a moderate deficit that supports gradual progress.`);
    } else {
      summaries.push(`Your intake is significantly below your target. Make sure you're fueling enough for your daily activities and workouts.`);
    }
    
    // Protein mention
    const proteinRatio = data.avgProtein / data.proteinTarget;
    if (proteinRatio >= 1.0) {
      summaries.push(`Excellent protein intake at ${Math.round(data.avgProtein)}g - hitting your target supports muscle recovery and helps you feel satisfied after meals.`);
    } else if (proteinRatio >= 0.8) {
      summaries.push(`Good protein progress at ${Math.round(data.avgProtein)}g. You're at ${Math.round(proteinRatio * 100)}% of your goal.`);
    } else {
      summaries.push(`Protein intake averaged ${Math.round(data.avgProtein)}g. Adding protein-rich foods to each meal can help with fullness and recovery.`);
    }
    
    // Streak mention
    if (data.currentStreak >= 3) {
      summaries.push(`Keep up the momentum with your ${data.currentStreak}-day logging streak!`);
    }
    
    return summaries.join(" ");
  }

  private fallbackWeightAnalysis(data: WeeklyReportData): string {
    if (!data.currentWeight) {
      return `Weight tracking helps you see trends over time. For the most useful data, try weighing yourself 2-3 times per week at the same time of day.`;
    }
    
    const analyses = [];
    analyses.push(`Your current weight is ${data.currentWeight.toFixed(1)} kg.`);
    
    if (data.weightChange !== null) {
      const changeAbs = Math.abs(data.weightChange);
      if (data.weightChange < 0) {
        if (changeAbs > 1.0) {
          analyses.push(`This week you saw a larger decrease of ${changeAbs.toFixed(1)} kg. This might include water weight changes along with any body composition shifts.`);
        } else if (changeAbs > 0.5) {
          analyses.push(`You had a steady decrease of ${changeAbs.toFixed(1)} kg this week.`);
        } else {
          analyses.push(`You had a small decrease of ${changeAbs.toFixed(1)} kg.`);
        }
      } else if (data.weightChange > 0) {
        if (changeAbs > 1.0) {
          analyses.push(`Your weight increased by ${changeAbs.toFixed(1)} kg. Day-to-day fluctuations are normal and can be influenced by hydration, meal timing, and sodium intake.`);
        } else {
          analyses.push(`Your weight increased by ${changeAbs.toFixed(1)} kg.`);
        }
      } else {
        analyses.push(`Your weight stayed steady this week.`);
      }
    }
    
    if (data.weightGoal) {
      const progress = Math.round(data.weightProgress);
      if (progress >= 75) {
        analyses.push(`You're ${progress}% toward your goal - excellent progress!`);
      } else if (progress >= 50) {
        analyses.push(`You're ${progress}% of the way to your target weight.`);
      } else if (progress >= 25) {
        analyses.push(`You're building momentum at ${progress}% toward your goal.`);
      } else {
        analyses.push(`You're making progress toward your ${data.weightGoal} kg target.`);
      }
    }
    
    return analyses.join(" ");
  }

  private fallbackWeightCommentary(data: WeeklyReportData): string {
    if (data.weightChange === null) {
      return `To track weight trends effectively, try weighing yourself at consistent times (like morning, before eating). Looking at weekly averages gives you a clearer picture than single measurements.`;
    }
    
    const absChange = Math.abs(data.weightChange);
    
    if (absChange > 1.0) {
      if (data.weightChange < 0) {
        return `A ${absChange.toFixed(1)} kg weekly decrease is faster than typical. While exciting, make sure you're eating enough to maintain energy for daily activities and workouts. Very low intake can make it harder to stick with your plan long-term.`;
      } else {
        return `A ${absChange.toFixed(1)} kg increase in one week is worth noting. Much of this could be normal fluctuation from water retention, carb intake, or meal timing. Look at the trend over 2-4 weeks rather than single weeks.`;
      }
    } else if (absChange > 0.5) {
      if (data.weightChange < 0) {
        return `A ${absChange.toFixed(1)} kg decrease is a solid, sustainable pace. You're creating a consistent calorie deficit while (hopefully) maintaining good energy levels.`;
      } else {
        return `A ${absChange.toFixed(1)} kg gain is moderate. If you're building muscle or just had higher sodium meals, this is normal variation.`;
      }
    } else {
      return `A ${absChange.toFixed(1)} kg change is within normal week-to-week variation. Weight naturally fluctuates based on hydration, meal timing, and other factors. Focus on the trend over several weeks.`;
    }
  }

  private fallbackMetabolicCommentary(data: WeeklyReportData): string {
    const calorieDiff = data.calorieTarget - data.avgCalories;
    const deficitPct = (calorieDiff / data.calorieTarget) * 100;
    const absDeficit = Math.abs(deficitPct);
    
    if (data.daysLogged < 3) {
      return `With limited logging data, it's hard to assess your nutrition patterns. Try logging more days next week to get personalized insights about your energy intake and consistency.`;
    }
    
    if (absDeficit <= 10) {
      return `Your calorie intake is very close to your target - within 10%. This balance typically provides steady energy throughout the day and supports good workout performance. You're averaging ${Math.round(data.avgCalories)} kcal against your ${data.calorieTarget} kcal goal.`;
    } else if (calorieDiff > 10 && calorieDiff <= 25) {
      return `You're running a moderate calorie deficit of about ${Math.round(deficitPct)}%. This level supports gradual progress while still providing enough fuel for daily activities. You may notice increased hunger before meals, which is normal. Your average of ${Math.round(data.avgCalories)} kcal creates a sustainable approach.`;
    } else if (calorieDiff > 25) {
      return `Your intake is significantly below your target - about ${Math.round(deficitPct)}% less than planned. While this creates faster short-term changes, very low intake can leave you feeling tired, make workouts harder, and increase cravings. Consider adding nutritious snacks or slightly larger portions if you're struggling with energy.`;
    } else if (calorieDiff < -25) {
      return `Your intake is running about ${Math.round(Math.abs(deficitPct))}% above your target. This surplus provides plenty of energy for activity and muscle building, but may slow progress if you're working toward fat loss. Your average of ${Math.round(data.avgCalories)} kcal gives you lots of fuel for workouts and recovery.`;
    } else {
      return `Your calorie intake is running ${Math.round(Math.abs(deficitPct))}% above target. This modest surplus can support muscle gain and workout recovery. If your goal is maintenance or fat loss, you might gradually adjust portions.`;
    }
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
    
    let commentary = `Your nutrition breakdown shows ${proteinPct}% protein, ${carbsPct}% carbs, and ${fatPct}% fat. `;
    
    if (proteinPct >= 30) {
      commentary += `Your protein at ${proteinPct}% is excellent for building and maintaining muscle. You're hitting ${Math.round(data.avgProtein)}g against your ${data.proteinTarget}g goal. High protein also helps you feel full after meals.`;
    } else if (proteinPct >= 25) {
      commentary += `With ${proteinPct}% of calories from protein, you're in a great range for body composition goals. Your ${Math.round(data.avgProtein)}g average is ${Math.round(proteinRatio * 100)}% of your target.`;
    } else if (proteinPct >= 20) {
      commentary += `Your ${proteinPct}% protein intake is solid. Bumping it up toward 25-30% could help with workout recovery and meal satisfaction. You're currently at ${Math.round(proteinRatio * 100)}% of your protein goal.`;
    } else {
      commentary += `Protein makes up ${proteinPct}% of your intake, which is below optimal ranges. Adding more protein-rich foods (chicken, fish, eggs, Greek yogurt, legumes) can help with muscle maintenance and keeping you full.`;
    }
    
    if (carbsPct > 50) {
      commentary += ` Carbs at ${carbsPct}% give you plenty of energy for workouts and daily activities. If you want to adjust your approach, you could experiment with slightly lower carbs while keeping protein high.`;
    } else if (carbsPct < 30) {
      commentary += ` Your ${carbsPct}% carb intake is on the lower side. If you're feeling low on energy during workouts, you might benefit from adding more carbohydrates.`;
    }
    
    return commentary;
  }

  private fallbackInsights(data: WeeklyReportData): Array<{ type: "success" | "warning" | "info"; text: string }> {
    const insights: Array<{ type: "success" | "warning" | "info"; text: string }> = [];
    
    // Consistency insights
    if (data.consistencyScore >= 90) {
      insights.push({ type: "success", text: `Outstanding dedication! ${data.consistencyScore}% consistency shows you're building a strong tracking habit.` });
    } else if (data.consistencyScore >= 75) {
      insights.push({ type: "success", text: `Great consistency at ${data.consistencyScore}%. You're developing a solid routine.` });
    } else if (data.consistencyScore >= 50) {
      insights.push({ type: "info", text: `Logging ${data.consistencyScore}% of the time. Aim for one more day next week to build momentum!` });
    } else if (data.consistencyScore < 50) {
      insights.push({ type: "info", text: `Consistency at ${data.consistencyScore}%. Try logging right after meals - it only takes a minute!` });
    }
    
    // Streak insights
    if (data.currentStreak >= 7) {
      insights.push({ type: "success", text: `Amazing ${data.currentStreak}-day streak! Keep that momentum going.` });
    } else if (data.currentStreak >= 3) {
      insights.push({ type: "success", text: `${data.currentStreak}-day streak! Consistency is key to seeing patterns.` });
    }
    
    // Calorie insights
    const calorieAdherence = Math.abs(((data.avgCalories - data.calorieTarget) / data.calorieTarget) * 100);
    if (calorieAdherence <= 10) {
      insights.push({ type: "success", text: `Nailed your calorie goal! ${Math.round(data.avgCalories)} kcal is right on target.` });
    } else if (data.avgCalories > data.calorieTarget * 1.2) {
      insights.push({ type: "info", text: `Calorie intake above target. Check portion sizes and liquid calories.` });
    } else if (data.avgCalories < data.calorieTarget * 0.7) {
      insights.push({ type: "info", text: `Low caloric intake detected. Make sure you're fueling enough for your activities.` });
    }
    
    // Protein insights
    const proteinRatio = data.avgProtein / data.proteinTarget;
    if (proteinRatio >= 1.0) {
      insights.push({ type: "success", text: `Protein goal achieved! ${Math.round(data.avgProtein)}g supports recovery and fullness.` });
    } else if (proteinRatio < 0.6) {
      insights.push({ type: "info", text: `Protein at ${Math.round(proteinRatio * 100)}% of goal. Add eggs, Greek yogurt, or lean meats.` });
    }
    
    // Quality insights
    if (data.mealQualityScore >= 85) {
      insights.push({ type: "success", text: `Excellent meal quality (${data.mealQualityScore}/100)! Great food choices.` });
    } else if (data.mealQualityScore < 50) {
      insights.push({ type: "info", text: `Meal quality at ${data.mealQualityScore}/100. Focus on whole foods.` });
    }
    
    // Hydration insights
    if (data.waterAverage >= 7) {
      insights.push({ type: "success", text: `Hydration on point! ${data.waterAverage.toFixed(1)} glasses daily.` });
    } else if (data.waterAverage < 4) {
      insights.push({ type: "info", text: `Hydration low at ${data.waterAverage.toFixed(1)} glasses. Carry a water bottle!` });
    }
    
    // Weight insights
    if (data.weightChange !== null && data.weightChange < 0) {
      insights.push({ type: "success", text: `Weight trending down! ${Math.abs(data.weightChange).toFixed(1)} kg change this week.` });
    }
    
    // Default
    if (insights.length === 0) {
      insights.push({ type: "info", text: "Keep logging daily to unlock personalized insights about your nutrition patterns." });
    }
    
    return insights.slice(0, 4);
  }

  private fallbackRecommendations(data: WeeklyReportData): Array<{ title: string; description: string }> {
    const recommendations: Array<{ title: string; description: string }> = [];
    
    // Protein recommendations
    const proteinRatio = data.avgProtein / data.proteinTarget;
    if (proteinRatio < 0.8) {
      recommendations.push({
        title: "Boost Your Protein",
        description: `You're at ${Math.round(data.avgProtein)}g of your ${data.proteinTarget}g goal. Try adding eggs at breakfast, Greek yogurt as a snack, or lean meats at dinner.`
      });
    }
    
    // Hydration recommendations
    if (data.waterAverage < 6) {
      recommendations.push({
        title: "Hydration Challenge",
        description: `Currently at ${data.waterAverage.toFixed(1)} glasses/day. Set phone reminders or use a marked bottle to hit 8 glasses.`
      });
    }
    
    // Consistency recommendations
    if (data.consistencyScore < 70) {
      recommendations.push({
        title: "Build the Logging Habit",
        description: `At ${data.consistencyScore}% consistency. Log meals immediately after eating - it only takes 2 minutes!`
      });
    }
    
    // Calorie-specific recommendations
    const calorieDiff = data.avgCalories - data.calorieTarget;
    if (calorieDiff > 300) {
      recommendations.push({
        title: "Mindful Portions",
        description: `Running ${Math.round(calorieDiff)} kcal above target. Use a food scale for accuracy and watch liquid calories.`
      });
    } else if (calorieDiff < -300) {
      recommendations.push({
        title: "Fuel Adequately",
        description: `${Math.round(Math.abs(calorieDiff))} kcal below target. Add healthy snacks like nuts or fruit.`
      });
    }
    
    // Goal-specific recommendations
    if (data.activeGoal === "weight_loss" && data.weightChange && data.weightChange >= 0) {
      recommendations.push({
        title: "Accelerate Progress",
        description: "Weight stable? Consider a 10% calorie adjustment or add 30 minutes of daily walking."
      });
    } else if (data.activeGoal === "muscle_gain") {
      recommendations.push({
        title: "Support Muscle Growth",
        description: "Ensure you're eating at a 200-300 kcal surplus. Prioritize protein and lift progressively."
      });
    }
    
    // Quality recommendations
    if (data.mealQualityScore < 60) {
      recommendations.push({
        title: "Upgrade Your Nutrition",
        description: `Quality score at ${data.mealQualityScore}/100. Swap processed foods for whole grains and vegetables.`
      });
    }
    
    // Default recommendations
    if (recommendations.length < 3) {
      const defaults = [
        { title: "Prioritize Sleep", description: "Aim for 7-9 hours of quality sleep. Poor sleep increases hunger and cravings." },
        { title: "Plan Ahead", description: "Meal prep on weekends saves time and ensures healthy options are available." },
        { title: "Eat Mindfully", description: "Put your phone down during meals and eat slowly. It takes 20 minutes for fullness signals." }
      ];
      recommendations.push(defaults[Math.floor(Math.random() * defaults.length)]);
    }
    
    return recommendations.slice(0, 4);
  }

  private fallbackProteinAssessment(data: WeeklyReportData): string {
    const ratio = data.avgProtein / data.proteinTarget;
    const percentage = Math.round(ratio * 100);
    
    if (ratio >= 1.0) {
      return `PROTEIN STATUS: EXCELLENT (${percentage}%). Your ${Math.round(data.avgProtein)}g meets your goal. This level supports workout recovery and helps you feel satisfied after meals.`;
    } else if (ratio >= 0.8) {
      return `PROTEIN STATUS: GOOD (${percentage}%). At ${Math.round(data.avgProtein)}g, you're close to your ${data.proteinTarget}g target. Hitting 100% would optimize recovery and meal satisfaction.`;
    } else if (ratio >= 0.6) {
      return `PROTEIN STATUS: NEEDS IMPROVEMENT (${percentage}%). You're at ${Math.round(data.avgProtein)}g of ${data.proteinTarget}g. Add protein sources to each meal - chicken, fish, eggs, Greek yogurt, or legumes.`;
    } else {
      return `PROTEIN STATUS: LOW (${percentage}%). At ${Math.round(data.avgProtein)}g, you're well below your ${data.proteinTarget}g target. Focus on adding 20-30g protein at each meal.`;
    }
  }

  private parseInsights(jsonString: string): Array<{ type: "success" | "warning" | "info"; text: string }> | null {
    if (!jsonString || jsonString.trim() === "") {
      return null;
    }

    try {
      let cleanedString = jsonString.trim();
      const jsonMatch = cleanedString.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        cleanedString = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(cleanedString);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: { type?: string; text?: string }) => ({
          type: ["success", "warning", "info"].includes(item.type) ? item.type : "info",
          text: String(item.text || ""),
        }));
      }
    } catch (e) {
      console.error("Failed to parse insights JSON:", e);
    }
    return null;
  }

  private parseRecommendations(jsonString: string): Array<{ title: string; description: string }> | null {
    if (!jsonString || jsonString.trim() === "") {
      return null;
    }

    try {
      let cleanedString = jsonString.trim();
      const jsonMatch = cleanedString.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        cleanedString = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(cleanedString);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: { title?: string; description?: string }) => ({
          title: String(item.title || ""),
          description: String(item.description || ""),
        }));
      }
    } catch (e) {
      console.error("Failed to parse recommendations JSON:", e);
    }
    return null;
  }
}

export const aiReportGenerator = new AIReportGenerator();
export type { AIReportContent };
