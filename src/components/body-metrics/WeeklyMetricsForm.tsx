import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Ruler, Activity, Dumbbell, StickyNote } from "lucide-react";
import { useLogBodyMetrics } from "@/hooks/useBodyMetrics";
import { toast } from "sonner";

interface WeeklyMetricsFormProps {
  userId: string;
  onSuccess?: () => void;
  initialData?: {
    weight_kg?: number;
    waist_cm?: number;
    body_fat_percent?: number;
    muscle_mass_percent?: number;
    notes?: string;
  };
}

export function WeeklyMetricsForm({ userId, onSuccess, initialData }: WeeklyMetricsFormProps) {
  const [formData, setFormData] = useState({
    weight_kg: initialData?.weight_kg?.toString() || "",
    waist_cm: initialData?.waist_cm?.toString() || "",
    body_fat_percent: initialData?.body_fat_percent?.toString() || "",
    muscle_mass_percent: initialData?.muscle_mass_percent?.toString() || "",
    notes: initialData?.notes || "",
  });

  const { mutate: logMetrics, isPending } = useLogBodyMetrics();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate weight (required)
    const weight = parseFloat(formData.weight_kg);
    if (!formData.weight_kg || isNaN(weight) || weight <= 0 || weight > 500) {
      toast.error("Please enter a valid weight (0.1 - 500 kg)");
      return;
    }

    // Validate optional fields
    const waist = formData.waist_cm ? parseFloat(formData.waist_cm) : undefined;
    if (waist !== undefined && (isNaN(waist) || waist <= 0 || waist > 300)) {
      toast.error("Waist measurement must be between 0.1 and 300 cm");
      return;
    }

    const bodyFat = formData.body_fat_percent ? parseFloat(formData.body_fat_percent) : undefined;
    if (bodyFat !== undefined && (isNaN(bodyFat) || bodyFat < 0 || bodyFat > 100)) {
      toast.error("Body fat percentage must be between 0 and 100");
      return;
    }

    const muscleMass = formData.muscle_mass_percent ? parseFloat(formData.muscle_mass_percent) : undefined;
    if (muscleMass !== undefined && (isNaN(muscleMass) || muscleMass < 0 || muscleMass > 100)) {
      toast.error("Muscle mass percentage must be between 0 and 100");
      return;
    }

    logMetrics(
      {
        userId,
        data: {
          weight_kg: weight,
          waist_cm: waist,
          body_fat_percent: bodyFat,
          muscle_mass_percent: muscleMass,
          notes: formData.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Log Weekly Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Weight - Required */}
          <div className="space-y-2">
            <Label htmlFor="weight" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Weight (kg) *
            </Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              min="0.1"
              max="500"
              placeholder="Enter your weight in kg"
              value={formData.weight_kg}
              onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
              required
            />
          </div>

          {/* Waist - Optional */}
          <div className="space-y-2">
            <Label htmlFor="waist" className="flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Waist (cm)
            </Label>
            <Input
              id="waist"
              type="number"
              step="0.1"
              min="0.1"
              max="300"
              placeholder="Optional - Waist circumference"
              value={formData.waist_cm}
              onChange={(e) => setFormData({ ...formData, waist_cm: e.target.value })}
            />
          </div>

          {/* Body Fat - Optional */}
          <div className="space-y-2">
            <Label htmlFor="bodyFat" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Body Fat %
            </Label>
            <Input
              id="bodyFat"
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="Optional - Body fat percentage"
              value={formData.body_fat_percent}
              onChange={(e) => setFormData({ ...formData, body_fat_percent: e.target.value })}
            />
          </div>

          {/* Muscle Mass - Optional */}
          <div className="space-y-2">
            <Label htmlFor="muscleMass" className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4" />
              Muscle Mass %
            </Label>
            <Input
              id="muscleMass"
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="Optional - Muscle mass percentage"
              value={formData.muscle_mass_percent}
              onChange={(e) => setFormData({ ...formData, muscle_mass_percent: e.target.value })}
            />
          </div>

          {/* Notes - Optional */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this week's progress..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Metrics"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            * Required field
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
