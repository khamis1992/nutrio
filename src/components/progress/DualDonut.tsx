import React from "react";

interface DualDonutProps {
  outerPct: number;
  outerColor: string;
  innerPct: number;
  innerColor: string;
  centerValue: React.ReactNode;
  centerUnit: string;
  legend: Array<{ color: string; label: string }>;
}

export function DualDonut({
  outerPct,
  outerColor,
  innerPct,
  innerColor,
  centerValue,
  centerUnit,
  legend,
}: DualDonutProps) {
  const outerC = 2 * Math.PI * 46;
  const innerC = 2 * Math.PI * 34;

  return (
    <div className="relative shrink-0">
      <svg width="110" height="110" viewBox="0 0 110 110">
        {/* Outer track */}
        <circle cx="55" cy="55" r="46" fill="none" stroke="#F1F5F9" strokeWidth="10" />
        {/* Outer arc */}
        <circle
          cx="55"
          cy="55"
          r="46"
          fill="none"
          stroke={outerColor}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={`${(outerPct / 100) * outerC} ${outerC}`}
          transform="rotate(-90 55 55)"
        />
        {/* Inner track */}
        <circle cx="55" cy="55" r="34" fill="none" stroke="#F1F5F9" strokeWidth="8" />
        {/* Inner arc */}
        <circle
          cx="55"
          cy="55"
          r="34"
          fill="none"
          stroke={innerColor}
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={`${(innerPct / 100) * innerC} ${innerC}`}
          transform="rotate(-90 55 55)"
        />
        {/* Center text */}
        <text x="55" y="50" textAnchor="middle" fontSize="18" fontWeight="900" fill="#0F172A" fontFamily="system-ui">
          {centerValue}
        </text>
        <text x="55" y="63" textAnchor="middle" fontSize="9" fontWeight="700" fill="#94A3B8" fontFamily="system-ui">
          {centerUnit}
        </text>
      </svg>
      {/* Legend dots */}
      <div className="absolute -bottom-2 left-1/2 flex w-max -translate-x-1/2 items-center justify-center gap-4">
        {legend.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[10px] font-black leading-none text-slate-400">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
