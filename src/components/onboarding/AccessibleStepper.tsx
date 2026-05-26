import { useCallback, useRef, useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/capacitor";

export type AccessibleStepperProps = {
  label: string;
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
    <div className="space-y-6">
      <div className="text-center">
        <h1
          className="text-3xl md:text-4xl font-bold mb-3"
          id="stepper-label"
        >
          {label}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {unitToggle && (
        <div className="flex justify-center">
          <div
            className="flex gap-1 p-1 bg-muted rounded-full"
            role="radiogroup"
            aria-label={`${label} unit`}
          >
            {unitToggle.options.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unitToggle.current === u}
                onClick={() => unitToggle.onToggle(u)}
                className="px-6 py-2 rounded-full font-semibold text-sm transition-all"
                style={
                  unitToggle.current === u
                    ? {
                        background:
                          "linear-gradient(135deg, hsl(90,65%,50%) 0%, hsl(90,65%,42%) 100%)",
                        color: "#fff",
                      }
                    : { color: "hsl(var(--muted-foreground))" }
                }
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
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
            "w-16 h-16 rounded-2xl bg-card border-2 border-border flex items-center justify-center transition-all duration-150 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            "min-w-[56px] min-h-[56px]",
          )}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-baseline justify-center gap-2 px-4">
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
              className="font-black text-foreground bg-transparent border-none outline-none text-center caret-primary"
              style={{
                fontSize: 72,
                lineHeight: 1,
                letterSpacing: "-2px",
                width: `${Math.max(3, displayValue.length + 1)}ch`,
              }}
              aria-labelledby="stepper-label"
            />
            <span className="text-2xl font-semibold text-muted-foreground">
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
            "w-16 h-16 rounded-2xl bg-card border-2 border-border flex items-center justify-center transition-all duration-150 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            "min-w-[56px] min-h-[56px]",
          )}
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {validationMessage && (
        <p className="text-center text-sm text-amber-600" role="alert">
          {validationMessage}
        </p>
      )}

      {isAtMin && value === min && (
        <p className="text-center text-sm text-muted-foreground">
          Minimum value reached
        </p>
      )}
      {isAtMax && value === max && (
        <p className="text-center text-sm text-muted-foreground">
          Maximum value reached
        </p>
      )}
    </div>
  );
}
