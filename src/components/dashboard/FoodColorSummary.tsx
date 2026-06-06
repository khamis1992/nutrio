import { motion } from "framer-motion";
import { classifyFood, getColorBar, type FoodColor, getColorBg } from "@/lib/foodColorClassification";

interface MealEntry {
  calories: number;
  protein_g: number;
  fat_g: number;
  name: string;
}

export function FoodColorSummary({ meals, compact }: { meals: MealEntry[]; compact?: boolean }) {
  const colors: Record<FoodColor, number> = { green: 0, yellow: 0, red: 0 };

  for (const meal of meals) {
    const { color } = classifyFood(meal.calories, meal.protein_g, meal.fat_g);
    colors[color]++;
  }

  const total = colors.green + colors.yellow + colors.red || 1;
  const greenPct = (colors.green / total) * 100;
  const yellowPct = (colors.yellow / total) * 100;
  const redPct = (colors.red / total) * 100;

  if (meals.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={compact ? "mb-3" : "mx-4 mt-2 mb-4"}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
          Food Balance
        </p>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden">
        {greenPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${greenPct}%` }}
            transition={{ duration: 0.4 }}
            className={getColorBar("green")}
          />
        )}
        {yellowPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${yellowPct}%` }}
            transition={{ duration: 0.4 }}
            className={getColorBar("yellow")}
          />
        )}
        {redPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${redPct}%` }}
            transition={{ duration: 0.4 }}
            className={getColorBar("red")}
          />
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          {colors.green} green
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {colors.yellow} yellow
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          {colors.red} red
        </span>
      </div>
    </motion.div>
  );
}

export function MealColorDot({ calories, protein_g, fat_g }: MealEntry) {
  const { color, reason } = classifyFood(calories, protein_g, fat_g);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${getColorBg(color)}`}
      title={reason}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        color === "green" ? "bg-emerald-400" : color === "yellow" ? "bg-amber-400" : "bg-rose-400"
      }`} />
      {color}
    </span>
  );
}
