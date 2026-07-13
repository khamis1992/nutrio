import { useCallback, useRef, useState, useEffect, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/capacitor";

export type AccessibleStepperProps = {
  label: ReactNode;
  ariaLabel: string;
  subtitle?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  displayValue: string;
  unitToggle?: {
    options: readonly string[];
    current: string;
    onToggle: (u: string) => void;
  };
  warnAtMin?: number;
  warnAtMax?: number;
  inputMode?: "decimal" | "numeric";
};

export function AccessibleStepper({
  label,
  ariaLabel,
  subtitle,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  displayValue,
  unitToggle,
  warnAtMin,
  warnAtMax,
  inputMode = "decimal",
}: AccessibleStepperProps) {
  const isAtMin = value <= min;
  const isAtMax = value >= max;
  const isNearMin = !isAtMin && warnAtMin !== undefined && value <= warnAtMin;
  const isNearMax = !isAtMax && warnAtMax !== undefined && value >= warnAtMax;

  const validationMessage = (() => {
    if (isAtMin) return null;
    if (isAtMax) return null;
    if (isNearMin) return `Close to minimum (${min}${unit})`;
    if (isNearMax) return `Close to maximum (${max}${unit})`;
    return null;
  })();

  const adjust = useCallback(
    (delta: number) => {
      haptics.selection();
      const raw = value + delta * step;
      const clamped = Math.min(max, Math.max(min, raw));
      const rounded = Math.round(clamped * 10) / 10;
      onChange(rounded);
    },
    [value, step, min, max, onChange],
  );

  const onMinus = useCallback(() => adjust(-1), [adjust]);
  const onPlus = useCallback(() => adjust(1), [adjust]);

  const longPressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = useCallback(
    (delta: number) => {
      longPressTimeoutRef.current = setTimeout(() => {
        longPressRef.current = setInterval(() => {
          adjust(delta);
        }, 80);
      }, 400);
    },
    [adjust],
  );

  const stopLongPress = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (longPressRef.current) {
      clearInterval(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const [localInput, setLocalInput] = useState<string | null>(null);

  useEffect(() => {
    setLocalInput(null);
  }, [value]);

  const commitInput = useCallback(() => {
    if (localInput === null) return;
    const parsed = parseFloat(localInput);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      const rounded = Math.round(clamped * 10) / 10;
      onChange(rounded);
    }
    setLocalInput(null);
  }, [localInput, min, max, onChange]);

  return (
    <div className="space-y-6 rounded-[30px] border border-[#E5EAF1] bg-white p-5 shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
      <div className="text-center">
        <h1
          className="mb-3 text-[28px] font-extrabold leading-tight text-[#020617]"
          id="stepper-label"
        >
          {label}
        </h1>
        {subtitle && (
          <p className="text-sm leading-6 text-[#64748B]">{subtitle}</p>
        )}
      </div>

      {unitToggle && (
        <div className="flex justify-center">
          <div
            className="flex gap-1 rounded-full bg-[#F6F8FB] p-1"
            role="radiogroup"
            aria-label={`${ariaLabel} unit`}
          >
            {unitToggle.options.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unitToggle.current === u}
                onClick={() => unitToggle.onToggle(u)}
                className="min-h-10 rounded-full px-6 py-2 text-sm font-extrabold transition-all"
                style={
                  unitToggle.current === u
                    ? { background: "#020617", color: "#fff" }
                    : { color: "#64748B" }
                }
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onMinus}
          disabled={isAtMin}
          onPointerDown={() => startLongPress(-1)}
          onPointerUp={stopLongPress}
          onPointerLeave={stopLongPress}
          onPointerCancel={stopLongPress}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "flex h-14 w-14 min-h-[56px] min-w-[56px] items-center justify-center rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] transition-all duration-150 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#020617] focus-visible:ring-offset-2",
            "disabled:opacity-30 disabled:cursor-not-allowed",
          )}
          aria-label={`Decrease ${ariaLabel}`}
        >
          <Minus className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-baseline justify-center gap-2 px-2">
            <input
              ref={inputRef}
              type="text"
              inputMode={inputMode}
              value={localInput ?? displayValue}
              onChange={(e) => setLocalInput(e.target.value)}
              onBlur={commitInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitInput();
                  inputRef.current?.blur();
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  adjust(1);
                  haptics.selection();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  adjust(-1);
                  haptics.selection();
                }
              }}
              className="border-none bg-transparent text-center font-black text-[#020617] outline-none caret-[#F97316]"
              style={{
                fontSize: "clamp(48px, 16vw, 68px)",
                lineHeight: 1,
                letterSpacing: 0,
                width: `${Math.max(3, displayValue.length + 1)}ch`,
              }}
              aria-labelledby="stepper-label"
            />
            <span className="text-xl font-extrabold text-[#64748B]">
              {unit}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onPlus}
          disabled={isAtMax}
          onPointerDown={() => startLongPress(1)}
          onPointerUp={stopLongPress}
          onPointerLeave={stopLongPress}
          onPointerCancel={stopLongPress}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "flex h-14 w-14 min-h-[56px] min-w-[56px] items-center justify-center rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] transition-all duration-150 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#020617] focus-visible:ring-offset-2",
            "disabled:opacity-30 disabled:cursor-not-allowed",
          )}
          aria-label={`Increase ${ariaLabel}`}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {validationMessage && (
        <p className="text-center text-sm font-bold text-[#F97316]" role="alert">
          {validationMessage}
        </p>
      )}

      {isAtMin && value === min && (
        <p className="text-center text-sm text-[#64748B]">
          Minimum value reached
        </p>
      )}
      {isAtMax && value === max && (
        <p className="text-center text-sm text-[#64748B]">
          Maximum value reached
        </p>
      )}
    </div>
  );
}
