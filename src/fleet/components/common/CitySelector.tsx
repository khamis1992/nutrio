import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { useCity } from '@/fleet/context/CityContext';
import { useFleetAuth } from '@/fleet/hooks/useFleetAuth';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function CitySelector() {
  const [open, setOpen] = useState(false);
  const { availableCities, selectedCities, toggleCity, isLoading, isMultiSelect } = useCity();
  const { user } = useFleetAuth();

  const getDisplayText = () => {
    if (selectedCities.length === 0) {
      return 'Select City';
    }
    if (selectedCities.length === 1) {
      return selectedCities[0].name;
    }
    return `${selectedCities.length} Cities`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 opacity-50" />
            <span className="truncate">{getDisplayText()}</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <div className="p-2 border-b">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            {isMultiSelect ? 'Select cities to view' : 'Select your city'}
          </p>
        </div>
        <div className="max-h-[300px] overflow-auto py-2">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Loading cities...
            </div>
          ) : availableCities.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No cities available
            </div>
          ) : (
            <div className="space-y-1">
              {availableCities.map((city) => {
                const isSelected = selectedCities.some((c) => c.id === city.id);
                return (
                  <button
                    key={city.id}
                    onClick={() => toggleCity(city.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/50"
                    )}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{city.name}</span>
                      {city.nameAr && (
                        <span className="text-xs text-muted-foreground" dir="rtl">
                          {city.nameAr}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isMultiSelect && city.driverCount !== undefined && (
                        <Badge variant="secondary" className="text-xs">
                          {city.driverCount} drivers
                        </Badge>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {isMultiSelect && selectedCities.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                // Clear all selections
                selectedCities.forEach((city) => toggleCity(city.id));
              }}
            >
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
