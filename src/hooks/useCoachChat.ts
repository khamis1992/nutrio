import { useState, useCallback, useMemo } from "react";

export interface CoachMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  timestamp: number;
}

interface NutritionSnapshot {
  caloriesTarget: number;
  caloriesConsumed: number;
  proteinTarget: number;
  proteinConsumed: number;
  carbsTarget: number;
  carbsConsumed: number;
  fatTarget: number;
  fatConsumed: number;
  goal: string;
  weight?: number;
  targetWeight?: number;
  streakDays: number;
}

const MESSAGE_ID = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const WELCOME_TIPS = [
  "Track your meals daily to stay on target.",
  "Aim to hit your protein goal first — it keeps you full.",
  "Drink water before meals to manage hunger.",
  "Consistency matters more than perfection.",
  "You can log skipped meals to help me track patterns.",
];

function generateWelcome(data: NutritionSnapshot): string {
  const remainingCal = Math.max(0, data.caloriesTarget - data.caloriesConsumed);
  const remainingProtein = Math.max(0, data.proteinTarget - data.proteinConsumed);
  const tips = WELCOME_TIPS.sort(() => Math.random() - 0.5).slice(0, 2);

  let intro: string;
  if (data.streakDays >= 7) {
    intro = `Amazing! You've hit a ${data.streakDays}-day streak. Keep it going!`;
  } else if (data.caloriesConsumed === 0) {
    intro = "Let's get started! Log your first meal today.";
  } else {
    intro = `You've had ${data.caloriesConsumed} kcal so far today.`;
  }

  return `${intro} You have ${remainingCal} kcal and ${remainingProtein}g protein remaining. 💡 Tip: ${tips[0]} ${tips[1] ?? ""}`;
}

function respondTo(data: NutritionSnapshot, question: string): string {
  const q = question.toLowerCase().trim();

  if (q.includes("what should i eat") || q.includes("suggest") || q.includes("recommend") || q.includes("meal for today")) {
    const remProtein = Math.max(0, data.proteinTarget - data.proteinConsumed);
    const remCarbs = Math.max(0, data.carbsTarget - data.carbsConsumed);
    const remFat = Math.max(0, data.fatTarget - data.fatConsumed);
    return `Based on your remaining macros today, focus on meals rich in protein (${remProtein}g needed). Aim for lean proteins like chicken, fish, or legumes. You have ${remCarbs}g carbs and ${remFat}g fat remaining. Try our grilled chicken bowl or salmon plate — both fit your plan!`;
  }

  if (q.includes("how am i doing") || q.includes("progress") || q.includes("summary") || q.includes("week")) {
    const pctCal = data.caloriesTarget > 0 ? Math.round((data.caloriesConsumed / data.caloriesTarget) * 100) : 0;
    const streakMsg = data.streakDays > 0
      ? `You're on a ${data.streakDays}-day tracking streak!`
      : "Start tracking to build a streak!";
    return `Here's your snapshot: ${pctCal}% of today's calories consumed. ${streakMsg} Your goal is to ${data.goal === "lose" ? "lose weight" : data.goal === "gain" ? "gain muscle" : "maintain your weight"}.${data.weight && data.targetWeight ? ` Currently ${data.weight}kg with a target of ${data.targetWeight}kg.` : ""}`;
  }

  if (q.includes("more protein") || q.includes("protein tip") || q.includes("high protein")) {
    return "Great goal! Here are tips to increase protein: 1) Add eggs or Greek yogurt to breakfast, 2) Choose lean meats like chicken or turkey, 3) Try our high-protein meal collection in the VIP section, 4) Snack on nuts or cottage cheese, 5) Consider a protein shake post-workout. Need me to suggest specific meals from our menu?";
  }

  if (q.includes("on track") || q.includes("my goal") || q.includes("am i doing well")) {
    const pctProgress = data.caloriesTarget > 0 ? Math.round((data.caloriesConsumed / data.caloriesTarget) * 100) : 0;
    let verdict: string;
    if (pctProgress >= 80 && pctProgress <= 110) {
      verdict = "You're right on track!";
    } else if (pctProgress > 110) {
      verdict = "You've gone a bit over your calorie target today — don't worry, just adjust tomorrow.";
    } else if (pctProgress >= 40) {
      verdict = "You're making good progress so far.";
    } else {
      verdict = "You're just getting started today.";
    }
    return `${verdict} You've consumed ${pctProgress}% of your daily calories. Your goal is ${data.goal === "lose" ? "weight loss" : data.goal === "gain" ? "muscle building" : "maintenance"}.${data.weight && data.targetWeight ? ` Current weight: ${data.weight}kg → Target: ${data.targetWeight}kg.` : ""} Stay consistent and you'll see results!`;
  }

  if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
    return `Hello! I'm your Nutrio coach. How can I help you today? You can ask me about your progress, meal suggestions, or tips to reach your goals.`;
  }

  if (q.includes("thank")) {
    return "You're welcome! I'm here whenever you need help. Keep crushing your goals! 💪";
  }

  return `I'm here to help with your nutrition! Try asking: "What should I eat today?", "How am I doing?", "Tips for more protein?", or "Am I on track for my goal?"`;
}

export function useCoachChat() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [initialized, setInitialized] = useState(false);

  const init = useCallback((data: NutritionSnapshot) => {
    if (initialized) return;
    const welcome: CoachMessage = {
      id: MESSAGE_ID(),
      role: "coach",
      text: generateWelcome(data),
      timestamp: Date.now(),
    };
    setMessages([welcome]);
    setInitialized(true);
  }, [initialized]);

  const ask = useCallback((question: string, data: NutritionSnapshot) => {
    const userMsg: CoachMessage = {
      id: MESSAGE_ID(),
      role: "user",
      text: question,
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const response: CoachMessage = {
        id: MESSAGE_ID(),
        role: "coach",
        text: respondTo(data, question),
        timestamp: Date.now() + 1,
      };
      return [...prev, userMsg, response];
    });
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setInitialized(false);
  }, []);

  const quickQuestions = useMemo(() => [
    "What should I eat today?",
    "How am I doing?",
    "Tips for more protein?",
    "Am I on track for my goal?",
  ], []);

  return { messages, initialized, init, ask, reset, quickQuestions };
}
