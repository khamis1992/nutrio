import { useState } from 'react';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { useCity } from '@/fleet/context/CityContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Zone } from '@/fleet/types/fleet';

interface ZoneSelectorProps {
  selectedZones: Zone[];
  onChange: (zones: Zone[]) => void;
  disabled?: boolean;
}

export function ZoneSelector({ selectedZones, onChange, disabled }: ZoneSelectorProps) {
  const [open, setOpen] = useState(false);
  const { zones, selectedCity } = useCity();

  const toggleZone = (zone: Zone) => {
    const isSelected = selectedZones.some((z) => z.id === zone.id);
    if (isSelected) {
      onChange(selectedZones.filter((z) => z.id !== zone.id));
    } else {
      onChange([...selectedZones, zone]);
    }
  };

  const getDisplayText = () => {
    if (selectedZones.length === 0) {
      return 'All Zones';
    }
    if (selectedZones.length === 1) {
      return selectedZones[0].name;
    }
    return `${selectedZones.length} Zones`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[180px] justify-between"
          disabled={disabled || !selectedCity}
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 opacity-50" />
            <span className="truncate">{getDisplayText()}</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="p-2 border-b">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            {selectedCity ? `${selectedCity.name} Zones` : 'Select a city first'}
          </p>
        </div>
        <div className="max-h-[250px] overflow-auto py-2">
          {zones.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              {selectedCity ? 'No zones available for this city' : 'Select a city to view zones'}
            </div>
          ) : (
            <div className="space-y-1">
              {zones.map((zone) => {
                const isSelected = selectedZones.some((z) => z.id === zone.id);
                return (
                  <button
                    key={zone.id}
                    onClick={() => toggleZone(zone)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/50"
                    )}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{zone.name}</span>
                      {zone.nameAr && (
                        <span className="text-xs text-muted-foreground" dir="rtl">
                          {zone.nameAr}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selectedZones.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange([])}
            >
              Clear zones
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
