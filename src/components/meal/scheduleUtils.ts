import { Sunrise, Sun, Moon, Apple } from "lucide-react";

export const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", icon: Sunrise, time: "7-10 AM", color: "#F59E0B", gradient: "from-amber-400 to-orange-500" },
  { id: "lunch", label: "Lunch", icon: Sun, time: "12-2 PM", color: "#F97316", gradient: "from-orange-400 to-red-500" },
  { id: "dinner", label: "Dinner", icon: Moon, time: "6-9 PM", color: "#6366F1", gradient: "from-indigo-400 to-purple-500" },
  { id: "snack", label: "Snack", icon: Apple, time: "Anytime", color: "#10B981", gradient: "from-emerald-400 to-teal-500" },
];

export const getSmartDefaultMealType = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 21) return "dinner";
  return "snack";
};

export const getDateContext = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 0 && diffDays <= 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const generateDateOptions = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }
  return dates;
};
