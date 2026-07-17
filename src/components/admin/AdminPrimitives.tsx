import { ComponentPropsWithoutRef, ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { AlertDialogContent } from "@/components/ui/alert-dialog";
import { DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AdminPanelProps = ComponentPropsWithoutRef<"section"> & {
  children: ReactNode;
};

export function AdminPanel({ children, className, ...props }: AdminPanelProps) {
  return (
    <section
      {...props}
      className={cn(
        "overflow-hidden rounded-[18px] border border-[#E5EAF1] bg-white shadow-[0_10px_28px_rgba(2,6,23,0.045)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

type AdminWorkbenchHeaderProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  icon: LucideIcon;
  accent?: "#22C7A1" | "#7C83F6" | "#38BDF8" | "#FB6B7A" | "#F97316";
  actions?: ReactNode;
  meta?: Array<{ label: string; value: ReactNode }>;
  className?: string;
};

export function AdminWorkbenchHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  accent = "#22C7A1",
  actions,
  meta = [],
  className,
}: AdminWorkbenchHeaderProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[20px] border border-[#E5EAF1] bg-white shadow-[0_12px_30px_rgba(2,6,23,0.045)]",
        className,
      )}
    >
      <div className="grid gap-4 px-5 py-4 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] ring-1"
            style={{
              backgroundColor: `${accent}14`,
              color: accent,
              borderColor: `${accent}28`,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">
              {title}
            </h2>
            {description && (
              <div className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#94A3B8]">
                {description}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 xl:justify-end">{actions}</div>
        )}
      </div>
      {meta.length > 0 && (
        <div className="grid border-t border-[#E5EAF1] bg-[#F6F8FB]/80 sm:grid-cols-3">
          {meta.map((item) => (
            <div
              key={item.label}
              className="border-b border-[#E5EAF1] px-5 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                {item.label}
              </p>
              <div className="mt-1 text-base font-black text-[#020617]">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type AdminKpiStripProps = {
  items: Array<{
    label: string;
    value: ReactNode;
    helper?: ReactNode;
    icon: LucideIcon;
    accent?: "#22C7A1" | "#7C83F6" | "#38BDF8" | "#FB6B7A" | "#F97316";
  }>;
  className?: string;
};

export function AdminKpiStrip({ items, className }: AdminKpiStripProps) {
  return (
    <section
      className={cn("grid gap-3 sm:grid-cols-2 2xl:grid-cols-4", className)}
    >
      {items.map((item) => (
        <AdminMetricTile
          key={item.label}
          label={item.label}
          value={item.value}
          subValue={item.helper}
          icon={item.icon}
          accent={item.accent}
          className="bg-white"
        />
      ))}
    </section>
  );
}

type AdminFilterBarProps = ComponentPropsWithoutRef<"section"> & {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function AdminFilterBar({
  title,
  children,
  actions,
  className,
  ...props
}: AdminFilterBarProps) {
  return (
    <section
      {...props}
      className={cn(
        "rounded-[18px] border border-[#E5EAF1] bg-white p-3 shadow-[0_10px_28px_rgba(2,6,23,0.035)]",
        className,
      )}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {title && (
          <p className="shrink-0 text-sm font-black text-[#020617]">{title}</p>
        )}
        <div className="min-w-0 flex-1">{children}</div>
        {actions && (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        )}
      </div>
    </section>
  );
}

type AdminPanelHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function AdminPanelHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: AdminPanelHeaderProps) {
  return (
    <div
      className={cn(
        "border-b border-[#E5EAF1] bg-white px-5 py-3.5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
              {eyebrow}
            </p>
          )}
          <h2 className="truncate text-base font-black text-[#020617]">
            {title}
          </h2>
          {description && (
            <div className="mt-1 text-xs font-semibold text-[#94A3B8]">
              {description}
            </div>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

type AdminEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: AdminEmptyStateProps) {
  return (
    <div className={cn("px-6 py-10 text-center", className)}>
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
        <Icon className="h-6 w-6 text-[#94A3B8]" />
      </div>
      <p className="font-black text-[#020617]">{title}</p>
      {description && (
        <div className="mx-auto mt-1 max-w-sm text-xs font-semibold leading-5 text-[#94A3B8]">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type AdminListSkeletonProps = {
  rows?: number;
  className?: string;
};

export function AdminListSkeleton({
  rows = 4,
  className,
}: AdminListSkeletonProps) {
  return (
    <div className={cn("space-y-2 p-4", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-3"
        >
          <div className="h-10 w-10 shrink-0 rounded-[14px] bg-[#E5EAF1]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 rounded-full bg-[#E5EAF1]" />
            <div className="h-2.5 w-3/5 rounded-full bg-[#E5EAF1]" />
          </div>
          <div className="hidden h-8 w-20 rounded-[12px] bg-[#E5EAF1] sm:block" />
        </div>
      ))}
    </div>
  );
}

type AdminMetricTileProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  accent?: "#22C7A1" | "#7C83F6" | "#38BDF8" | "#FB6B7A" | "#F97316";
  subValue?: ReactNode;
  className?: string;
};

export function AdminMetricTile({
  label,
  value,
  icon: Icon,
  accent = "#22C7A1",
  subValue,
  className,
}: AdminMetricTileProps) {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-3.5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">
          {label}
        </p>
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] ring-1"
          style={{
            backgroundColor: `${accent}18`,
            color: accent,
            borderColor: `${accent}26`,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-1">
        <p className="text-xl font-black leading-none text-[#020617]">
          {value}
        </p>
        {subValue && (
          <span className="text-xs font-bold text-[#94A3B8]">{subValue}</span>
        )}
      </div>
    </div>
  );
}

type AdminDialogContentProps = ComponentPropsWithoutRef<
  typeof DialogContent
> & {
  size?: "sm" | "md" | "form" | "lg" | "xl";
};

const adminDialogSizeClass: Record<
  NonNullable<AdminDialogContentProps["size"]>,
  string
> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  form: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
};

export function AdminDialogContent({
  className,
  size = "md",
  ...props
}: AdminDialogContentProps) {
  return (
    <DialogContent
      {...props}
      className={cn(
        "max-h-[90vh] max-w-[95vw] overflow-y-auto rounded-[20px] border-[#E5EAF1] bg-white p-0 text-[#020617] shadow-[0_24px_60px_rgba(2,6,23,0.18)]",
        adminDialogSizeClass[size],
        className,
      )}
    />
  );
}

type AdminAlertDialogContentProps = ComponentPropsWithoutRef<
  typeof AlertDialogContent
>;

export function AdminAlertDialogContent({
  className,
  ...props
}: AdminAlertDialogContentProps) {
  return (
    <AlertDialogContent
      {...props}
      className={cn(
        "rounded-[20px] border-[#E5EAF1] bg-white p-0 text-[#020617] shadow-[0_24px_60px_rgba(2,6,23,0.18)]",
        className,
      )}
    />
  );
}

type AdminSheetContentProps = ComponentPropsWithoutRef<typeof SheetContent> & {
  size?: "md" | "lg" | "xl" | "full";
};

const adminSheetSizeClass: Record<
  NonNullable<AdminSheetContentProps["size"]>,
  string
> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  full: "sm:max-w-2xl xl:max-w-3xl",
};

export function AdminSheetContent({
  className,
  size = "lg",
  ...props
}: AdminSheetContentProps) {
  return (
    <SheetContent
      {...props}
      className={cn(
        "w-full overflow-y-auto border-l border-[#E5EAF1] bg-[#F6F8FB] p-0 text-[#020617]",
        adminSheetSizeClass[size],
        className,
      )}
    />
  );
}
