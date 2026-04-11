import { motion } from "framer-motion";

interface Props {
  consumed?: number;
  target?: number;
  protein?: { consumed?: number; target?: number };
  carbs?: { consumed?: number; target?: number };
  fat?: { consumed?: number; target?: number };
}

const easeOut: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

export function CircularCalorieProgress({ 
  consumed = 0, 
  target = 2000, 
  protein = { consumed: 0, target: 0 }, 
  carbs = { consumed: 0, target: 0 }, 
  fat = { consumed: 0, target: 0 } 
}: Props) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const radius = 70;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const macros = [
    { label: "Protein", consumed: protein.consumed ?? 0, target: protein.target ?? 0, color: "bg-blue-500", bar: "bg-blue-400" },
    { label: "Carbs", consumed: carbs.consumed ?? 0, target: carbs.target ?? 0, color: "bg-amber-500", bar: "bg-amber-400" },
    { label: "Fat", consumed: fat.consumed ?? 0, target: fat.target ?? 0, color: "bg-rose-500", bar: "bg-rose-400" },
  ];

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth={stroke} />
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="url(#greenGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: easeOut, delay: 0.3 }}
          />
          <defs>
            <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-black text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {consumed}
          </motion.span>
          <span className="text-xs text-muted-foreground font-medium">
            / {target} kcal
          </span>
        </div>
      </div>

      <div className="w-full space-y-2.5 mt-4">
        {macros.map((m) => {
          const p = m.target > 0 ? Math.min((m.consumed / m.target) * 100, 100) : 0;
          return (
            <div key={m.label} className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium text-muted-foreground w-12">{m.label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${m.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${p}%` }}
                  transition={{ duration: 0.8, ease: easeOut, delay: 0.5 }}
                />
              </div>
              <span className="text-[11px] font-semibold text-foreground w-16 text-right">
                {Math.round(m.consumed)}/{Math.round(m.target)}g
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
