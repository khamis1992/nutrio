import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active', color: 'bg-green-500' },
  { value: 'pending_verification', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'suspended', label: 'Suspended', color: 'bg-red-500' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-500' },
];

interface DriverFiltersProps {
  status: string;
  onStatusChange: (status: string) => void;
  showOnlineOnly?: boolean;
  onToggleOnline?: () => void;
}

export function DriverFilters({ 
  status, 
  onStatusChange,
  showOnlineOnly,
  onToggleOnline 
}: DriverFiltersProps) {
  const selectedOption = statusOptions.find(opt => opt.value === status);

  return (
    <div className="flex items-center gap-2">
      {/* Status Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">
              {selectedOption?.label || 'Filter'}
            </span>
            {status !== 'all' && (
              <span className={cn(
                "w-2 h-2 rounded-full",
                selectedOption?.color
              )} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0" align="end">
          <div className="py-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onStatusChange(option.value)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  status === option.value && "bg-accent/50"
                )}
              >
                <div className="flex items-center gap-2">
                  {option.color && option.value !== 'all' && (
                    <span className={cn("w-2 h-2 rounded-full", option.color)} />
                  )}
                  <span>{option.label}</span>
                </div>
                {status === option.value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Online Only Toggle */}
      {onToggleOnline && (
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
          <Checkbox
            id="online-only"
            checked={showOnlineOnly}
            onCheckedChange={onToggleOnline}
          />
          <label 
            htmlFor="online-only" 
            className="text-sm cursor-pointer"
          >
            Online only
          </label>
        </div>
      )}
    </div>
  );
}
