import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Scale, Ruler, Percent, Dumbbell, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek } from "date-fns";

interface WeeklyMetricsFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function WeeklyMetricsForm({ onSuccess, onCancel }: WeeklyMetricsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    weight_kg: "",
    waist_cm: "",
    body_fat_percent: "",
    muscle_mass_percent: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to log metrics");
        return;
      }

      const weightKg = parseFloat(formData.weight_kg);
      if (isNaN(weightKg) || weightKg <= 0) {
        toast.error("Please enter a valid weight");
        return;
      }

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });

      const { error } = await supabase
        .from("user_body_metrics")
        .upsert({
          user_id: user.id,
          weight_kg: weightKg,
          waist_cm: formData.waist_cm ? parseFloat(formData.waist_cm) : null,
          body_fat_percent: formData.body_fat_percent ? parseFloat(formData.body_fat_percent) : null,
          muscle_mass_percent: formData.muscle_mass_percent ? parseFloat(formData.muscle_mass_percent) : null,
          week_start: weekStart.toISOString().split("T")[0],
          recorded_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,week_start"
        });

      if (error) throw error;

      toast.success("Weekly metrics logged successfully!");
      onSuccess();
    } catch (error) {
      console.error("Error logging metrics:", error);
      toast.error("Failed to log metrics. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Log your metrics once per week for the most accurate progress tracking. 
            Weight is required, other fields are optional but recommended.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {/* Weight */}
        <div className="space-y-2">
          <Label htmlFor="weight" className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Weight (kg) *
          </Label>
          <Input
            id="weight"
            type="number"
            step="0.1"
            placeholder="e.g., 75.5"
            value={formData.weight_kg}
            onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
            required
          />
          <p className="text-xs text-slate-500">Required - Log in kilograms</p>
        </div>

        {/* Waist */}
        <div className="space-y-2">
          <Label htmlFor="waist" className="flex items-center gap-2">
            <Ruler className="w-4 h-4" />
            Waist Circumference (cm)
          </Label>
          <Input
            id="waist"
            type="number"
            step="0.5"
            placeholder="e.g., 85"
            value={formData.waist_cm}
            onChange={(e) => setFormData({ ...formData, waist_cm: e.target.value })}
          />
          <p className="text-xs text-slate-500">Optional - Measure at navel level</p>
        </div>

        {/* Body Fat % */}
        <div className="space-y-2">
          <Label htmlFor="bodyFat" className="flex items-center gap-2">
            <Percent className="w-4 h-4" />
            Body Fat Percentage
          </Label>
          <Input
            id="bodyFat"
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="e.g., 20.5"
            value={formData.body_fat_percent}
            onChange={(e) => setFormData({ ...formData, body_fat_percent: e.target.value })}
          />
          <p className="text-xs text-slate-500">Optional - If measured with calipers or smart scale</p>
        </div>

        {/* Muscle Mass % */}
        <div className="space-y-2">
          <Label htmlFor="muscleMass" className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4" />
            Muscle Mass Percentage
          </Label>
          <Input
            id="muscleMass"
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="e.g., 42.0"
            value={formData.muscle_mass_percent}
            onChange={(e) => setFormData({ ...formData, muscle_mass_percent: e.target.value })}
          />
          <p className="text-xs text-slate-500">Optional - From body composition scale</p>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Log Metrics"}
        </Button>
      </div>
    </form>
  );
}
