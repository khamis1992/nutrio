import { motion } from "framer-motion";

interface CircularMacroGaugeProps {
  value: number;
  max: number;
  color: string;
  icon: React.ElementType;
  label: string;
  delay?: number;
}

export const CircularMacroGauge = ({
  value,
  max,
  color,
  icon: Icon,
  label,
  delay = 0,
}: CircularMacroGaugeProps) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, type: "spring" }}
      className="flex flex-col items-center"
    >
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          <motion.circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ delay: delay + 0.2, duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-5 h-5 mb-0.5" style={{ color }} />
          <span className="text-lg font-bold">{value}g</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground mt-2">{label}</span>
    </motion.div>
  );
};
