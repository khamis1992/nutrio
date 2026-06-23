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
import { CalendarClock, Loader2, Utensils } from "lucide-react";
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

const KEEP_CURRENT_MEAL_TYPE = "__keep_current_meal_type__";

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
      <DialogContent className="max-w-[430px] rounded-[34px] border border-slate-200/80 bg-white p-0 shadow-[0_28px_90px_rgba(2,6,23,0.22)] sm:max-w-md">
        {step === "scheduler" ? (
          <div className="overflow-hidden rounded-[34px]">
            <DialogHeader className="border-b border-slate-100 px-5 py-5 text-left">
              <DialogTitle className="text-[20px] font-black text-[#020617]">Select Delivery Time</DialogTitle>
              <DialogDescription className="text-[13px] font-semibold text-slate-500">
                Choose a new date and time for your order
              </DialogDescription>
            </DialogHeader>
            <div className="p-4">
              <DeliveryScheduler
                initialDate={newDate || schedule?.scheduled_date}
                onSchedule={handleSchedule}
                onCancel={() => setStep("details")}
              />
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[34px]">
            <DialogHeader className="border-b border-slate-100 px-5 pb-4 pt-6 text-left">
              <DialogTitle className="text-center text-[20px] font-black text-[#020617]">{t("modify_order")}</DialogTitle>
              <DialogDescription className="mx-auto mt-1 max-w-[300px] text-center text-[13px] font-semibold leading-5 text-slate-500">
                {schedule?.meal?.name
                  ? t("change_date_or_meal_type_for", { mealName: schedule.meal.name })
                  : t("change_date_or_meal_type")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 py-5">
              {/* Current details */}
              <div className="grid grid-cols-2 gap-2 rounded-[24px] bg-slate-50 p-3 text-sm ring-1 ring-slate-200/70">
                <p className="min-w-0 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 [&_span]:font-black [&_span]:text-[#020617]">
                  {t("current_date")}{" "}
                  <span className="font-medium text-foreground">{schedule ? formatDate(schedule.scheduled_date) : "—"}</span>
                </p>
                <p className="min-w-0 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 [&_span]:font-black [&_span]:text-[#020617]">
                  {t("current_meal_type")}{" "}
                  <span className="font-medium text-foreground capitalize">{schedule?.meal_type}</span>
                </p>
              </div>

              {/* Date & Time changer — opens DeliveryScheduler */}
              <div className="space-y-2">
                <Label className="text-[13px] font-black text-[#020617]">New Date & Time (optional)</Label>
                {newDate && newTime ? (
                  <div className="flex items-center gap-2">
                    <div className="flex min-h-12 flex-1 items-center gap-2 rounded-[18px] bg-slate-50 px-3 text-sm ring-1 ring-slate-200/80">
                      <CalendarClock className="h-4 w-4 shrink-0 text-[#020617]" />
                      <span className="font-black text-[#020617]">
                        {formatDate(newDate.toISOString().split("T")[0])} at {newTime}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs font-black text-slate-500 hover:bg-slate-100"
                      onClick={() => { setNewDate(null); setNewTime(null); }}
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="min-h-12 w-full justify-start rounded-[18px] border-slate-200 bg-white px-4 text-[14px] font-black text-[#020617] shadow-none hover:bg-slate-50 hover:text-[#020617]"
                    onClick={() => setStep("scheduler")}
                  >
                    <CalendarClock className="mr-2 h-4 w-4 text-slate-600" />
                    <span className="text-[#020617]">Select Date & Time</span>
                  </Button>
                )}
              </div>

              {/* New meal type */}
              <div className="space-y-2">
                <Label className="text-[13px] font-black text-[#020617]">{t("new_meal_type_optional")}</Label>
                <Select
                  value={newMealType || KEEP_CURRENT_MEAL_TYPE}
                  onValueChange={(value) => {
                    setNewMealType(value === KEEP_CURRENT_MEAL_TYPE ? "" : value);
                  }}
                >
                  <SelectTrigger className="min-h-12 rounded-[18px] border-slate-200 bg-white px-4 text-[14px] font-black text-[#020617] shadow-none">
                    <Utensils className="mr-2 h-4 w-4 text-slate-500" />
                    <SelectValue placeholder={t("keep_current_meal_type")} />
                  </SelectTrigger>
                  <SelectContent className="z-[220]">
                    <SelectItem
                      value={KEEP_CURRENT_MEAL_TYPE}
                      className="font-black text-[#020617] focus:bg-slate-100 focus:text-[#020617] data-[highlighted]:bg-slate-100 data-[highlighted]:text-[#020617]"
                    >
                      {t("keep_current_meal_type")}
                    </SelectItem>
                    {MEAL_TYPES.map((type) => (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                        className="font-black text-[#020617] focus:bg-slate-100 focus:text-[#020617] data-[highlighted]:bg-slate-100 data-[highlighted]:text-[#020617]"
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="grid gap-2 border-t border-slate-100 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 sm:grid-cols-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="min-h-12 rounded-full bg-[#020617] text-[14px] font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.18)] hover:bg-[#020617]/92"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("save_changes")}
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="min-h-12 rounded-full border-slate-200 bg-white text-[14px] font-black text-[#020617] shadow-none hover:bg-slate-50"
              >
                {t("cancel")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
