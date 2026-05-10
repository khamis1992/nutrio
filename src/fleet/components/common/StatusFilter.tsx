/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { Check, ChevronDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type StatusOption = {
  value: string;
  label: string;
  color?: string;
};

interface StatusFilterProps {
  options: StatusOption[];
  selectedStatus: string | null;
  onChange: (status: string | null) => void;
  placeholder?: string;
  allLabel?: string;
}

export function StatusFilter({
  options,
  selectedStatus,
  onChange,
  placeholder = 'Filter by Status',
  allLabel = 'All Statuses',
}: StatusFilterProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === selectedStatus);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[180px] justify-between"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 opacity-50" />
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="max-h-[250px] overflow-auto py-2">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              !selectedStatus && "bg-accent/50"
            )}
          >
            <span>{allLabel}</span>
            {!selectedStatus && <Check className="h-4 w-4 text-primary" />}
          </button>

          <div className="h-px bg-border my-1" />

          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                selectedStatus === option.value && "bg-accent/50"
              )}
            >
              <div className="flex items-center gap-2">
                {option.color && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                <span>{option.label}</span>
              </div>
              {selectedStatus === option.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Predefined filter configurations
export const DriverStatusOptions: StatusOption[] = [
  { value: 'active', label: 'Active', color: '#22c55e' },
  { value: 'pending_verification', label: 'Pending', color: '#f59e0b' },
  { value: 'suspended', label: 'Suspended', color: '#ef4444' },
  { value: 'inactive', label: 'Inactive', color: '#6b7280' },
];

export const VehicleStatusOptions: StatusOption[] = [
  { value: 'available', label: 'Available', color: '#22c55e' },
  { value: 'assigned', label: 'Assigned', color: '#3b82f6' },
  { value: 'maintenance', label: 'Maintenance', color: '#f59e0b' },
  { value: 'retired', label: 'Retired', color: '#6b7280' },
];

export const PayoutStatusOptions: StatusOption[] = [
  { value: 'pending', label: 'Pending', color: '#f59e0b' },
  { value: 'processing', label: 'Processing', color: '#3b82f6' },
  { value: 'paid', label: 'Paid', color: '#22c55e' },
  { value: 'failed', label: 'Failed', color: '#ef4444' },
];

export const VehicleTypeOptions: StatusOption[] = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'car', label: 'Car' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'van', label: 'Van' },
];
