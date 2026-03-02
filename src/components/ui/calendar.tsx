import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-6",
        month: "space-y-3",
        caption: "flex justify-between items-center px-1 mb-1",
        caption_label: "text-sm font-semibold text-foreground tracking-wide",
        nav: "flex items-center gap-1",
        nav_button: cn(
          "h-7 w-7 rounded-full flex items-center justify-center",
          "border border-border bg-background text-muted-foreground",
          "hover:bg-primary hover:text-primary-foreground hover:border-primary",
          "transition-all duration-150 cursor-pointer",
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse",
        head_row: "flex mb-1",
        head_cell:
          "text-muted-foreground/60 w-9 text-center text-[0.7rem] font-medium uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: cn(
          "relative h-9 w-9 text-center text-sm p-0",
          "[&:has([aria-selected].day-range-end)]:rounded-r-full",
          "[&:has([aria-selected].day-outside)]:bg-primary/10",
          "[&:has([aria-selected])]:bg-primary/10",
          "first:[&:has([aria-selected])]:rounded-l-full",
          "last:[&:has([aria-selected])]:rounded-r-full",
          "focus-within:relative focus-within:z-20",
        ),
        day: cn(
          "h-9 w-9 rounded-full p-0 font-normal text-sm",
          "flex items-center justify-center",
          "hover:bg-primary/10 hover:text-primary",
          "transition-all duration-150 cursor-pointer",
          "aria-selected:opacity-100",
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground font-semibold",
          "hover:bg-primary hover:text-primary-foreground",
          "focus:bg-primary focus:text-primary-foreground",
          "shadow-sm",
        ),
        day_today: cn(
          "ring-2 ring-primary ring-offset-1 ring-offset-background",
          "font-semibold text-primary",
        ),
        day_outside:
          "day-outside text-muted-foreground/30 aria-selected:bg-primary/10 aria-selected:text-muted-foreground aria-selected:opacity-40",
        day_disabled: "text-muted-foreground/30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground/30",
        day_range_middle:
          "aria-selected:bg-primary/10 aria-selected:text-primary rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-3.5 w-3.5" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-3.5 w-3.5" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
