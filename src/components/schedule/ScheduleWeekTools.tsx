import { useEffect, useState } from "react";
import { CalendarRange, Download, Loader2, Repeat2, Save, Trash2, X } from "lucide-react";
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
}

export default function ScheduleWeekTools({
  userId,
  weekStart,
  schedules,
  applying = false,
  onApply,
}: ScheduleWeekToolsProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My meal week");
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);

  const refresh = () => setTemplates(listScheduleTemplates(userId));
  useEffect(refresh, [userId, open]);

  const saveCurrentWeek = () => {
    try {
      const template = saveScheduleTemplate(userId, name, weekStart, schedules);
      refresh();
      setName("My meal week");
      toast.success("Week saved", { description: `${template.slots.length} meals are ready to reuse.` });
    } catch (error) {
      toast.error(error instanceof Error && error.message === "TEMPLATE_MEALS_REQUIRED"
        ? "Add at least one meal before saving this week."
        : "Could not save this week.");
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
            <div className="rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-slate-200/80">
              <p className="mb-2 text-xs font-extrabold text-[#020617]">Save this week as a template</p>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  className="h-11 rounded-xl border-slate-200 bg-white"
                />
                <Button
                  type="button"
                  onClick={saveCurrentWeek}
                  disabled={schedules.length === 0}
                  className="h-11 shrink-0 rounded-xl bg-[#020617] px-4 text-white"
                >
                  <Save className="h-4 w-4" />
                  <span className="sr-only">Save week</span>
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[11px] font-black uppercase text-[#94A3B8]">Saved templates</p>
              {templates.length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarRange className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-bold text-[#64748B]">No saved weeks yet</p>
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
