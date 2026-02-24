import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ruler, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BodyMeasurementsProps {
  measurements: Array<{
    id: string;
    log_date: string;
    weight_kg: number | null;
    waist_cm: number | null;
    hip_cm: number | null;
    chest_cm: number | null;
    body_fat_percent: number | null;
    muscle_mass_percent: number | null;
    notes: string | null;
  }>;
  latestMeasurement: {
    weight_kg: number | null;
    waist_cm: number | null;
    hip_cm: number | null;
    chest_cm: number | null;
    body_fat_percent: number | null;
    muscle_mass_percent: number | null;
  } | null;
  loading: boolean;
  onAddMeasurement: (measurement: {
    log_date: string;
    weight_kg?: number | null;
    waist_cm?: number | null;
    hip_cm?: number | null;
    chest_cm?: number | null;
    body_fat_percent?: number | null;
    muscle_mass_percent?: number | null;
    notes?: string | null;
  }) => Promise<void>;
  onDeleteMeasurement: (id: string) => Promise<void>;
}

export function BodyMeasurements({
  measurements,
  latestMeasurement,
  onAddMeasurement,
  onDeleteMeasurement,
}: BodyMeasurementsProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    weight: "",
    chest: "",
    waist: "",
    hip: "",
    bodyFat: "",
    muscleMass: "",
    notes: "",
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onAddMeasurement({
        log_date: format(new Date(), "yyyy-MM-dd"),
        weight_kg: formData.weight ? parseFloat(formData.weight) : undefined,
        chest_cm: formData.chest ? parseFloat(formData.chest) : undefined,
        waist_cm: formData.waist ? parseFloat(formData.waist) : undefined,
        hip_cm: formData.hip ? parseFloat(formData.hip) : undefined,
        body_fat_percent: formData.bodyFat ? parseFloat(formData.bodyFat) : undefined,
        muscle_mass_percent: formData.muscleMass ? parseFloat(formData.muscleMass) : undefined,
        notes: formData.notes || undefined,
      });
      toast({ title: "Measurement logged", description: "Body measurements saved successfully" });
      setFormData({ weight: "", chest: "", waist: "", hip: "", bodyFat: "", muscleMass: "", notes: "" });
      setShowForm(false);
    } catch {
      toast({ title: "Error", description: "Failed to save measurements", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const measurementFields = [
    { key: "weight_kg", label: "Weight", icon: "⚖️", unit: "kg" },
    { key: "chest_cm", label: "Chest", icon: "📏", unit: "cm" },
    { key: "waist_cm", label: "Waist", icon: "📍", unit: "cm" },
    { key: "hip_cm", label: "Hip", icon: "🍑", unit: "cm" },
    { key: "body_fat_percent", label: "Body Fat", icon: "📊", unit: "%" },
    { key: "muscle_mass_percent", label: "Muscle", icon: "💪", unit: "%" },
  ];

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Ruler className="w-4 h-4 text-purple-500" />
          Body Measurements
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Latest Measurements */}
        {latestMeasurement && (
          <div className="grid grid-cols-3 gap-2">
            {measurementFields.map(({ key, label, icon, unit }) => {
              const value = latestMeasurement[key as keyof typeof latestMeasurement];
              return value ? (
                <div key={key} className="p-2 rounded-lg bg-purple-50 text-center">
                  <span className="text-lg">{icon}</span>
                  <p className="text-lg font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500">{label} {unit}</p>
                </div>
              ) : null;
            })}
          </div>
        )}

        {!latestMeasurement && !showForm && (
          <div className="text-center py-4 text-slate-400">
            <Ruler className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">No measurements yet</p>
            <p className="text-xs mt-1">Track your body changes over time</p>
          </div>
        )}

        {/* Add Form */}
        {showForm && (
          <div className="p-4 rounded-lg bg-slate-50 space-y-3">
            <p className="font-medium text-sm">Log New Measurements</p>
            <div className="grid grid-cols-2 gap-3">
              {measurementFields.map(({ key, label, unit }) => {
                const formKey = key.replace("_kg", "").replace("_cm", "").replace("_percent", "");
                return (
                  <div key={key}>
                    <label className="text-xs text-slate-500 mb-1 block">{label} ({unit})</label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder={unit}
                      value={formData[formKey as keyof typeof formData]}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [formKey]: e.target.value,
                        }))
                      }
                      className="h-9"
                    />
                  </div>
                );
              })}
            </div>
            <Input
              placeholder="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="h-9"
            />
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} size="sm" className="flex-1">
                <Plus className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} size="sm">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Toggle Form Button */}
        {!showForm && (
          <Button variant="outline" onClick={() => setShowForm(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Log Measurements
          </Button>
        )}

        {/* History */}
        {measurements.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <span>View History ({measurements.length} entries)</span>
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {measurements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 text-sm"
                  >
                    <div>
                      <p className="font-medium">{format(parseISO(m.log_date), "MMM d, yyyy")}</p>
                      <p className="text-xs text-slate-500">
                        {[m.weight_kg && `${m.weight_kg}kg`, m.waist_cm && `W:${m.waist_cm}cm`, m.hip_cm && `H:${m.hip_cm}cm`]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteMeasurement(m.id)}
                      className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
