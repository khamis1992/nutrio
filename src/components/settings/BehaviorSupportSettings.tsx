import { useEffect, useState } from "react";
import { BellRing, Clock3, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { type BehaviorPreferences, useBehaviorPreferences } from "@/hooks/useBehaviorSupport";

const COPY = {
  en: {
    title: "Daily behavior support",
    description: "One contextual action at a time, within limits you control.",
    enabled: "Show daily support",
    enabledDescription: "Use reflections and recent activity to adapt the next suggestion.",
    frequency: "Maximum per day",
    quiet: "Quiet hours",
    status: "Saving...",
    prompt: "prompt",
    prompts: "prompts",
  },
  ar: {
    title: "الدعم السلوكي اليومي",
    description: "خطوة واحدة مناسبة للسياق، ضمن حدود تتحكم بها.",
    enabled: "إظهار الدعم اليومي",
    enabledDescription: "استخدام انعكاساتك ونشاطك الأخير لتكييف الاقتراح التالي.",
    frequency: "الحد الأقصى يومياً",
    quiet: "ساعات الهدوء",
    status: "جارٍ الحفظ...",
    prompt: "اقتراح",
    prompts: "اقتراحات",
  },
} as const;

export function BehaviorSupportSettings() {
  const { language, isRTL } = useLanguage();
  const copy = COPY[language === "ar" ? "ar" : "en"];
  const preferences = useBehaviorPreferences();
  const [draft, setDraft] = useState<BehaviorPreferences | null>(null);

  useEffect(() => {
    if (preferences.data) setDraft(preferences.data);
  }, [preferences.data]);

  if (preferences.isLoading || preferences.isError || !draft) return null;

  const save = (next: BehaviorPreferences) => {
    setDraft(next);
    preferences.update.mutate(next);
  };

  return (
    <Card dir={isRTL ? "rtl" : "ltr"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#020617]">
          <Sparkles className="h-5 w-5 text-[#FB6B7A]" />
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-[#7C83F6]" />
            <div>
              <Label htmlFor="behavior-support-enabled">{copy.enabled}</Label>
              <p className="mt-1 text-xs leading-5 text-[#64748B]">{copy.enabledDescription}</p>
            </div>
          </div>
          <Switch
            id="behavior-support-enabled"
            checked={draft.enabled}
            onCheckedChange={(enabled) => save({ ...draft, enabled })}
            disabled={preferences.update.isPending}
          />
        </div>

        {draft.enabled && (
          <>
            <div className="flex min-h-11 items-center justify-between gap-4">
              <Label htmlFor="behavior-frequency">{copy.frequency}</Label>
              <Select
                value={String(draft.max_prompts_per_day)}
                onValueChange={(value) => save({
                  ...draft,
                  max_prompts_per_day: Number(value),
                  max_prompts_per_week: Math.max(draft.max_prompts_per_week, Number(value)),
                })}
                disabled={preferences.update.isPending}
              >
                <SelectTrigger id="behavior-frequency" className="min-h-11 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count} {count === 1 ? copy.prompt : copy.prompts}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl bg-[#F6F8FB] p-3 ring-1 ring-slate-100">
              <p className="flex items-center gap-2 text-xs font-extrabold text-[#020617]">
                <Clock3 className="h-4 w-4 text-[#38BDF8]" /> {copy.quiet}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  aria-label={`${copy.quiet} start`}
                  type="time"
                  value={draft.quiet_hours_start.slice(0, 5)}
                  onChange={(event) => save({ ...draft, quiet_hours_start: event.target.value })}
                  className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#020617]"
                />
                <input
                  aria-label={`${copy.quiet} end`}
                  type="time"
                  value={draft.quiet_hours_end.slice(0, 5)}
                  onChange={(event) => save({ ...draft, quiet_hours_end: event.target.value })}
                  className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#020617]"
                />
              </div>
            </div>
          </>
        )}

        {preferences.update.isPending && <p className="text-xs font-bold text-[#94A3B8]">{copy.status}</p>}
      </CardContent>
    </Card>
  );
}
