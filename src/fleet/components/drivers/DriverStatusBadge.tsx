import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DriverStatus } from '@/fleet/types/fleet';

interface DriverStatusBadgeProps {
  status: DriverStatus;
  className?: string;
}

const statusConfig: Record<DriverStatus, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}> = {
  pending_verification: {
    label: 'Pending',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200',
  },
  active: {
    label: 'Active',
    variant: 'default',
    className: 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200',
  },
  suspended: {
    label: 'Suspended',
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200',
  },
  inactive: {
    label: 'Inactive',
    variant: 'outline',
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200',
  },
};

export function DriverStatusBadge({ status, className }: DriverStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        "text-[10px] font-medium capitalize",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
