import React from 'react';
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";

interface DailyNutritionCardProps {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  focusCalories: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  dayLabel?: string;
}

const CircularProgress = ({ value, max, color }: {
  value: number;
  max: number;
  color: string;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 60; // Radius of 60 for larger circle
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
        {/* Background circle */}
        <circle
          cx="70"
          cy="70"
          r="60"
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="10"
        />
        {/* Progress circle */}
        <motion.circle
          cx="70"
          cy="70"
          r="60"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute flex flex-col items-center justify-center">
        <motion.span 
          className="text-3xl font-bold text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {value}
        </motion.span>
      </div>
    </div>
  );
};

const MacroProgressBar = ({ label, value, max, color }: {
  label: string;
  value: number;
  max: number;
  color: string;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      <span className="text-xs font-medium text-foreground w-10 text-right shrink-0">{Math.round(value)}g</span>
    </div>
  );
};

export const DailyNutritionCard: React.FC<DailyNutritionCardProps> = (
  { totalCalories, totalProtein, totalCarbs, totalFat, focusCalories, targetProtein, targetCarbs, targetFat, dayLabel = "Today's Focus" }
) => {
  const caloriesColor = "#22c55e"; // Green
  const proteinColor = "#f97316"; // Orange
  const carbsColor = "#eab308";   // Yellow
  const fatColor = "#94a3b8";     // Gray/Slate

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="p-5 border-none shadow-sm bg-white">
        {/* Section Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">{dayLabel}</h2>
          <p className="text-sm text-muted-foreground">Daily nutrition summary</p>
        </div>
        
        {/* Main Content */}
        <div className="flex items-center gap-6">
          {/* Circular Progress */}
          <div className="shrink-0">
            <CircularProgress 
              value={totalCalories}
              max={focusCalories > 0 ? focusCalories : 2500}
              color={caloriesColor}
            />
          </div>
          
          {/* Stats Column */}
          <div className="flex-1 space-y-3">
            {/* Big Calorie Number */}
            <div className="mb-4">
              <span className="text-4xl font-bold text-foreground">{totalCalories}</span>
            </div>
            
            {/* Macro Progress Bars */}
            <div className="space-y-2">
              <MacroProgressBar 
                label="Protein" 
                value={totalProtein} 
                max={targetProtein || 150} 
                color={proteinColor} 
              />
              <MacroProgressBar 
                label="Carbs" 
                value={totalCarbs} 
                max={targetCarbs || 300} 
                color={carbsColor} 
              />
              <MacroProgressBar 
                label="Fat" 
                value={totalFat} 
                max={targetFat || 90} 
                color={fatColor} 
              />
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
