/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { SlidersHorizontal, X } from "lucide-react";

export interface MealFiltersState {
  dietTags: string[];
  caloriesRange: [number, number];
  proteinRange: [number, number];
  carbsRange: [number, number];
  fatRange: [number, number];
}

interface MealFiltersProps {
  availableTags: string[];
  filters: MealFiltersState;
  onFiltersChange: (filters: MealFiltersState) => void;
  maxCalories: number;
  maxProtein: number;
  maxCarbs: number;
  maxFat: number;
}

export const defaultFilters: MealFiltersState = {
  dietTags: [],
  caloriesRange: [0, 2000],
  proteinRange: [0, 200],
  carbsRange: [0, 300],
  fatRange: [0, 150],
};

export const MealFilters = ({
  availableTags,
  filters,
  onFiltersChange,
  maxCalories,
  maxProtein,
  maxCarbs,
  maxFat,
}: MealFiltersProps) => {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<MealFiltersState>(filters);

  const activeFilterCount = 
    (filters.dietTags.length > 0 ? 1 : 0) +
    (filters.caloriesRange[0] > 0 || filters.caloriesRange[1] < maxCalories ? 1 : 0) +
    (filters.proteinRange[0] > 0 || filters.proteinRange[1] < maxProtein ? 1 : 0) +
    (filters.carbsRange[0] > 0 || filters.carbsRange[1] < maxCarbs ? 1 : 0) +
    (filters.fatRange[0] > 0 || filters.fatRange[1] < maxFat ? 1 : 0);

  const toggleDietTag = (tag: string) => {
    setLocalFilters(prev => ({
      ...prev,
      dietTags: prev.dietTags.includes(tag)
        ? prev.dietTags.filter(t => t !== tag)
        : [...prev.dietTags, tag],
    }));
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    const resetFilters: MealFiltersState = {
      dietTags: [],
      caloriesRange: [0, maxCalories],
      proteinRange: [0, maxProtein],
      carbsRange: [0, maxCarbs],
      fatRange: [0, maxFat],
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalFilters(filters);
    }
    setOpen(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Filter Meals</SheetTitle>
          <SheetDescription>
            Narrow down meals by dietary preferences and nutritional values
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(85vh-180px)]">
          {/* Diet Tags */}
          {availableTags.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Diet Tags</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={localFilters.dietTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleDietTag(tag)}
                  >
                    {tag}
                    {localFilters.dietTags.includes(tag) && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Calories Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Calories</Label>
<span className="text-sm text-muted-foreground">
                {localFilters.caloriesRange[0]} - {localFilters.caloriesRange[1]} cal
              </span>
            </div>
            <Slider
              min={0}
              max={maxCalories}
              step={50}
              value={localFilters.caloriesRange}
              onValueChange={(value) => setLocalFilters(prev => ({
                ...prev,
                caloriesRange: value as [number, number]
              }))}
              className="w-full"
            />
          </div>

          {/* Protein Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Protein</Label>
              <span className="text-sm text-muted-foreground">
                {localFilters.proteinRange[0]} - {localFilters.proteinRange[1]}g
              </span>
            </div>
            <Slider
              min={0}
              max={maxProtein}
              step={5}
              value={localFilters.proteinRange}
              onValueChange={(value) => setLocalFilters(prev => ({
                ...prev,
                proteinRange: value as [number, number]
              }))}
              className="w-full"
            />
          </div>

          {/* Carbs Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Carbohydrates</Label>
              <span className="text-sm text-muted-foreground">
                {localFilters.carbsRange[0]} - {localFilters.carbsRange[1]}g
              </span>
            </div>
            <Slider
              min={0}
              max={maxCarbs}
              step={5}
              value={localFilters.carbsRange}
              onValueChange={(value) => setLocalFilters(prev => ({
                ...prev,
                carbsRange: value as [number, number]
              }))}
              className="w-full"
            />
          </div>

          {/* Fat Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Fat</Label>
              <span className="text-sm text-muted-foreground">
                {localFilters.fatRange[0]} - {localFilters.fatRange[1]}g
              </span>
            </div>
            <Slider
              min={0}
              max={maxFat}
              step={5}
              value={localFilters.fatRange}
              onValueChange={(value) => setLocalFilters(prev => ({
                ...prev,
                fatRange: value as [number, number]
              }))}
              className="w-full"
            />
          </div>
        </div>

        <SheetFooter className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
