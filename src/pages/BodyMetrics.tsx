import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  TrendingUp,
  Trash2,
  Loader2,
  Ruler,
  Activity,
  Dumbbell,
  StickyNote,
  Utensils,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useBodyMetrics, useLogBodyMetrics, useDeleteBodyMetrics } from "@/hooks/useBodyMetrics";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const BodyMetrics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: metricsHistory, isLoading: historyLoading } = useBodyMetrics(user?.id);
  const { mutate: logMetrics, isPending } = useLogBodyMetrics();
  const { mutate: deleteMetrics } = useDeleteBodyMetrics();

  const [formData, setFormData] = useState({
    weight_kg: "",
    waist_cm: "",
    body_fat_percent: "",
    muscle_mass_percent: "",
    notes: "",
  });

  const [dietTags, setDietTags] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  useEffect(() => {
    const fetchDietTagsAndPreferences = async () => {
      try {
        const { data: tags, error: tagsError } = await supabase
          .from("diet_tags")
          .select("*")
          .order("name");

        if (tagsError) throw tagsError;
        setDietTags(tags || []);

        if (user) {
          const { data: prefs, error: prefsError } = await supabase
            .from("user_dietary_preferences")
            .select("diet_tag_id")
            .eq("user_id", user.id);

          if (prefsError) throw prefsError;
          setSelectedTags(prefs?.map((p: { diet_tag_id: string }) => p.diet_tag_id) || []);
        }
      } catch {
        // Silently handle
      } finally {
        setTagsLoading(false);
      }
    };

    fetchDietTagsAndPreferences();
  }, [user]);

  const toggleDietPreference = async (tagId: string) => {
    if (!user) return;

    const isSelected = selectedTags.includes(tagId);

    try {
      if (isSelected) {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("diet_tag_id", tagId);

        if (error) throw error;
        setSelectedTags((prev) => prev.filter((id) => id !== tagId));
      } else {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .insert({ user_id: user.id, diet_tag_id: tagId });

        if (error) throw error;
        setSelectedTags((prev) => [...prev, tagId]);
      }
    } catch {
      toast.error("Failed to update dietary preference");
    }
  };

  const getTagColor = (index: number) => {
    const colors = [
      "bg-green-500",
      "bg-emerald-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-sky-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-violet-500",
    ];
    return colors[index % colors.length];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const weight = parseFloat(formData.weight_kg);
    if (!formData.weight_kg || isNaN(weight) || weight <= 0 || weight > 500) {
      toast.error("Please enter a valid weight (0.1 - 500 kg)");
      return;
    }

    logMetrics(
      {
        userId: user.id,
        data: {
          weight_kg: weight,
          waist_cm: formData.waist_cm ? parseFloat(formData.waist_cm) : undefined,
          body_fat_percent: formData.body_fat_percent ? parseFloat(formData.body_fat_percent) : undefined,
          muscle_mass_percent: formData.muscle_mass_percent ? parseFloat(formData.muscle_mass_percent) : undefined,
          notes: formData.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          setFormData({
            weight_kg: "",
            waist_cm: "",
            body_fat_percent: "",
            muscle_mass_percent: "",
            notes: "",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-muted/40 pb-20 pt-safe">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-muted/60 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-4 rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-base font-semibold">Body Metrics</h1>
            <p className="text-xs text-muted-foreground">{t("body_metrics_title")}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Body Metrics</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("body_metrics_title")}</p>
          </div>
          <div className="relative shrink-0">
            <div className="relative h-20 w-20 rounded-full border border-emerald-200 bg-emerald-50">
              <div className="absolute inset-0 grid place-items-center">
                <TrendingUp className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        <Card className="rounded-[24px] border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("body_metrics_log_new")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("body_metrics_log_desc")}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weight" className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, weight_kg: e.target.value }))}
                  className="h-12 rounded-xl bg-muted/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="waist" className="flex items-center gap-2 text-sm">
                  <Ruler className="h-4 w-4 text-emerald-500" />
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, waist_cm: e.target.value }))}
                  className="h-12 rounded-xl bg-muted/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bodyFat" className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-emerald-500" />
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, body_fat_percent: e.target.value }))}
                  className="h-12 rounded-xl bg-muted/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="muscleMass" className="flex items-center gap-2 text-sm">
                  <Dumbbell className="h-4 w-4 text-emerald-500" />
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, muscle_mass_percent: e.target.value }))}
                  className="h-12 rounded-xl bg-muted/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="flex items-center gap-2 text-sm">
                  <StickyNote className="h-4 w-4 text-emerald-500" />
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes about your progress..."
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="rounded-xl bg-muted/50"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full rounded-2xl py-6 text-base font-semibold text-white shadow-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
                  </>
                ) : (
                  "Log Measurement"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : metricsHistory && metricsHistory.length > 0 ? (
          <Card className="rounded-[24px] border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t("body_metrics_history")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("body_metrics_history_desc")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {metricsHistory.map((metric) => (
                <div
                  key={metric.id}
                  className="flex items-center justify-between rounded-2xl border bg-card p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {metric.weight_kg} kg
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(metric.recorded_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {metric.waist_cm && <span>Waist: {metric.waist_cm} cm</span>}
                      {metric.body_fat_percent && <span>BF: {metric.body_fat_percent}%</span>}
                      {metric.muscle_mass_percent && <span>MM: {metric.muscle_mass_percent}%</span>}
                    </div>
                    {metric.notes && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{metric.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMetrics(metric.id)}
                    aria-label="Delete measurement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-muted">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{t("body_metrics_empty")}</p>
            <p className="text-xs text-muted-foreground">{t("body_metrics_empty_desc")}</p>
          </div>
        )}

        <Card className="rounded-[24px] border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50">
                <Utensils className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Dietary Preferences</CardTitle>
                <p className="text-sm text-muted-foreground">{t("body_metrics_preferences")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {tagsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dietTags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-muted">
                  <Utensils className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{t("body_metrics_no_prefs")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {dietTags.map((tag, index) => {
                  const selected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleDietPreference(tag.id)}
                      className={cn(
                        "relative overflow-hidden rounded-xl p-4 text-left transition-colors border-2",
                        selected
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-border bg-card hover:border-emerald-300/70"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors",
                            selected ? "bg-emerald-500" : "border-2 border-muted-foreground/30"
                          )}
                        >
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium", selected && "text-emerald-700")}>
                            {tag.name}
                          </p>
                          {tag.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {tag.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "absolute bottom-0 left-0 top-0 w-1 transition-colors",
                          selected ? getTagColor(index) : "bg-transparent"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BodyMetrics;
