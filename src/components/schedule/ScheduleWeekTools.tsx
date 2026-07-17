import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarRange, Download, Loader2, Plus, Repeat2, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { downloadSchedulePdf } from "@/lib/schedule-pdf";
import {
  deleteScheduleTemplate,
  listScheduleTemplates,
  saveScheduleTemplate,
  templateToScheduleItems,
  type ScheduleTemplate,
  type ScheduleTemplateSource,
} from "@/lib/schedule-templates";
import type { ScheduleMealInput } from "@/lib/schedule-meals";

interface ScheduleWeekToolsProps {
  userId: string;
  weekStart: Date;
  schedules: ScheduleTemplateSource[];
  applying?: boolean;
  onApply: (items: ScheduleMealInput[]) => Promise<void>;
  onCreateSchedule?: () => void;
  variant?: "standalone" | "compact";
}

export default function ScheduleWeekTools({
  userId,
  weekStart,
  schedules,
  applying = false,
  onApply,
  onCreateSchedule,
  variant = "standalone",
}: ScheduleWeekToolsProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My meal week");
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);

  const scheduledMealsCount = schedules.length;
  const canSaveCurrentWeek = scheduledMealsCount > 0;

  const refresh = () => {
    setTemplates(listScheduleTemplates(userId));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, open]);

  const saveCurrentWeek = () => {
    try {
      const template = saveScheduleTemplate(userId, name, weekStart, schedules);
      refresh();
      setName("My meal week");
      toast.success("Week saved", { description: `${template.slots.length} meals are ready to reuse.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message === "TEMPLATE_NAME_REQUIRED"
          ? "Name this week before saving."
          : message === "TEMPLATE_MEALS_REQUIRED"
            ? "Add at least one meal before saving this week."
            : message === "TEMPLATE_STORAGE_UNAVAILABLE" || message === "TEMPLATE_SAVE_FAILED"
              ? "Your browser could not save this template. Please try again."
              : "Could not save this week.",
      );
    }
  };

  const apply = async (template: ScheduleTemplate) => {
    try {
      await onApply(templateToScheduleItems(template, weekStart));
      setOpen(false);
    } catch (error) {
      console.error("Could not apply schedule template:", error);
      toast.error("Could not apply this template.");
    }
  };

  const remove = (templateId: string) => {
    deleteScheduleTemplate(userId, templateId);
    refresh();
  };

  return (
    <>
      {variant === "compact" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open week templates"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#D8DDFF] active:scale-[0.98]"
        >
          <CalendarRange className="h-4 w-4" />
          {templates.length > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#020617] px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
              {templates.length}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-3 flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-xs font-extrabold text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] active:scale-[0.98]"
        >
          <CalendarRange className="h-4 w-4 text-[#7C83F6]" />
          Week tools
          {templates.length > 0 && (
            <span className="rounded-full bg-[#F3F4FF] px-2 py-0.5 text-[10px] text-[#7C83F6]">{templates.length}</span>
          )}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideCloseButton className="bottom-0 top-auto max-h-[82dvh] w-full max-w-[430px] translate-y-0 rounded-t-[28px] rounded-b-none border-0 bg-white p-0 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
          <DialogTitle className="sr-only">Week tools</DialogTitle>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase text-[#7C83F6]">Meal schedule</p>
              <h2 className="text-lg font-black text-[#020617]">Reuse your best weeks</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close week tools"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(82dvh-76px)] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
            <div className="rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-slate-200/80">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-[#020617]">Save this week as a template</p>
                  <p className="mt-1 text-[11px] font-semibold leading-4 text-[#94A3B8]">
                    {canSaveCurrentWeek
                      ? `${scheduledMealsCount} meal${scheduledMealsCount === 1 ? "" : "s"} will be saved for reuse.`
                      : "Add meals to this week before saving it as a template."}
                  </p>
                </div>
                <span className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-white px-3 text-xs font-black text-[#7C83F6] ring-1 ring-[#E5EAF1]">
                  {scheduledMealsCount}
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  className="h-11 rounded-xl border-slate-200 bg-white"
                />
                {canSaveCurrentWeek ? (
                  <Button
                    type="button"
                    onClick={saveCurrentWeek}
                    className="h-11 shrink-0 rounded-xl bg-[#020617] px-4 text-white"
                  >
                    <Save className="h-4 w-4" />
                    <span className="sr-only">Save week</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onCreateSchedule?.();
                    }}
                    className="h-11 shrink-0 rounded-xl bg-[#020617] px-4 text-white"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Add meals first</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[11px] font-black uppercase text-[#94A3B8]">Saved templates</p>
              {templates.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#D8DEE8] bg-[#FBFCFE] px-5 py-8 text-center">
                  <CalendarCheck2 className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-2 text-sm font-bold text-[#64748B]">No saved weeks yet</p>
                  <p className="mx-auto mt-1 max-w-[240px] text-xs font-semibold leading-5 text-[#94A3B8]">
                    Save a week with meals, then apply it again in one tap.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {templates.map((template) => (
                    <div key={template.id} className="flex min-h-[68px] items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#020617]">{template.name}</p>
                        <p className="text-xs font-semibold text-[#94A3B8]">{template.slots.length} meals</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadSchedulePdf(template, weekStart)}
                        aria-label={`Export ${template.name} as PDF`}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6F8FB] text-[#38BDF8]"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void apply(template)}
                        disabled={applying}
                        aria-label={`Apply ${template.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EFFFFA] text-[#22C7A1] disabled:opacity-50"
                      >
                        {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(template.id)}
                        aria-label={`Delete ${template.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-[#FB6B7A]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
