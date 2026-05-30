import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DeliveryScheduler } from "@/components/ui/delivery-scheduler";

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: string;
  created_at: string;
  meal_id: string;
  meal?: {
    name?: string;
    restaurant?: {
      name?: string;
    };
  };
}

interface ModifyOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduledMeal | null;
  onModified: () => void;
}

export const ModifyOrderModal = ({
  isOpen,
  onClose,
  schedule,
  onModified,
}: ModifyOrderModalProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"details" | "scheduler">("details");
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [newMealType, setNewMealType] = useState<string>("");

  const MEAL_TYPES = [
    { value: "breakfast", label: t("breakfast") },
    { value: "lunch", label: t("lunch") },
    { value: "dinner", label: t("dinner") },
    { value: "snack", label: t("snack") },
  ];

  const handleSchedule = (result: { date: Date; time: string }) => {
    setNewDate(result.date);
    setNewTime(result.time);
    setStep("details");
  };

  const handleSave = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      if (!newDate && !newMealType) {
        toast({ title: t("no_changes"), description: t("select_new_date_or_meal_type") });
        setSaving(false);
        return;
      }

      const { data, error } = await (supabase.rpc as unknown as (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>)("reschedule_meal", {
        p_schedule_id: schedule.id,
        p_new_date: newDate ? newDate.toISOString().split("T")[0] : null,
        p_new_meal_type: newMealType || null,
        p_new_time_slot: newTime || null,
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string };
      if (!result?.success) {
        toast({
          title: t("failed_to_modify_order"),
          description: result?.error || t("please_try_again"),
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("order_modified"), description: t("order_updated_successfully") });
      onModified();
      onClose();
      reset();
    } catch (err) {
      console.error("Modify order error:", err);
      toast({
        title: t("failed_to_modify_order"),
        description: t("please_try_again"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setNewDate(null);
    setNewTime(null);
    setNewMealType("");
    setStep("details");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        {step === "scheduler" ? (
          <>
            <DialogHeader>
              <DialogTitle>Select Delivery Time</DialogTitle>
              <DialogDescription>
                Choose a new date and time for your order
              </DialogDescription>
            </DialogHeader>
            <DeliveryScheduler
              initialDate={newDate || schedule?.scheduled_date}
              onSchedule={handleSchedule}
              onCancel={() => setStep("details")}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("modify_order")}</DialogTitle>
              <DialogDescription>
                {schedule?.meal?.name
                  ? t("change_date_or_meal_type_for", { mealName: schedule.meal.name })
                  : t("change_date_or_meal_type")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Current details */}
              <div className="p-3 bg-muted/50 rounded-xl text-sm space-y-1">
                <p className="text-muted-foreground">
                  {t("current_date")}{" "}
                  <span className="font-medium text-foreground">{schedule ? formatDate(schedule.scheduled_date) : "—"}</span>
                </p>
                <p className="text-muted-foreground">
                  {t("current_meal_type")}{" "}
                  <span className="font-medium text-foreground capitalize">{schedule?.meal_type}</span>
                </p>
              </div>

              {/* Date & Time changer — opens DeliveryScheduler */}
              <div className="space-y-2">
                <Label>New Date & Time (optional)</Label>
                {newDate && newTime ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 bg-emerald-50 rounded-xl text-sm">
                      <span className="font-medium text-emerald-700">
                        {formatDate(newDate.toISOString().split("T")[0])} at {newTime}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-xs"
                      onClick={() => { setNewDate(null); setNewTime(null); }}
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl justify-start"
                    onClick={() => setStep("scheduler")}
                  >
                    Select Date & Time
                  </Button>
                )}
              </div>

              {/* New meal type */}
              <div className="space-y-2">
                <Label>{t("new_meal_type_optional")}</Label>
                <Select value={newMealType} onValueChange={setNewMealType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={t("keep_current_meal_type")} />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1 rounded-xl">
                {t("cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t("save_changes")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
