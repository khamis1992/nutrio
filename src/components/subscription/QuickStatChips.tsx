import { Calendar, Utensils, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatChip {
  icon: "calendar" | "meals" | "snacks" | "rollover";
  value: string | number;
  label: string;
  variant?: "default" | "warning" | "danger";
}

interface QuickStatChipsProps {
  chips: StatChip[];
  className?: string;
}

const iconMap = {
  calendar: Calendar,
  meals: Utensils,
  rollover: RotateCcw,
};

export function QuickStatChips({ chips, className }: QuickStatChipsProps) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4", className)}>
      {chips.map((chip, i) => {
        const Icon = iconMap[chip.icon as keyof typeof iconMap];
        const variantStyles = {
          default: "bg-card border-border/60",
          warning: "bg-warning/5 border-warning/20",
          danger: "bg-destructive/5 border-destructive/20",
        };

        return (
          <div
            key={i}
            className={cn(
              "shrink-0 flex items-center gap-2 rounded-2xl px-4 py-3 border shadow-sm",
              variantStyles[chip.variant || "default"]
            )}
          >
            {Icon ? (
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  chip.variant === "warning" && "text-warning",
                  chip.variant === "danger" && "text-destructive",
                  !chip.variant && "text-primary"
                )}
              />
            ) : (
              <span className="text-base leading-none shrink-0">🍎</span>
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  "text-base font-bold leading-none tabular-nums",
                  chip.variant === "warning" && "text-warning",
                  chip.variant === "danger" && "text-destructive",
                  !chip.variant && "text-foreground"
                )}
              >
                {chip.value}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{chip.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
