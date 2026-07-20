import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  Brain,
  Download,
  HeartPulse,
  Loader2,
  LockKeyhole,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type BleedingFlow,
  type CyclePhase,
  type DigestiveSymptom,
  type HealthContextEntryInput,
  type HealthContextPreferences,
  type HealthContextScale,
  type HealthContextState,
  deleteHealthContextDataset,
  deleteHealthContextEntry,
  exportUserDataWithHealthContext,
  fetchHealthContextState,
  saveHealthContextEntry,
  saveHealthContextPreferences,
  setHealthContextAiConsent,
} from "@/lib/health-context";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { cn } from "@/lib/utils";

const defaultPreferences: HealthContextPreferences = {
  journal_enabled: false,
  cycle_tracking_enabled: false,
  recommendation_context_enabled: false,
  mood_enabled: true,
  stress_enabled: true,
  appetite_enabled: true,
  energy_enabled: true,
  digestive_enabled: true,
  note_enabled: true,
};

const digestiveOptions: DigestiveSymptom[] = [
  "bloating",
  "reflux",
  "constipation",
  "diarrhea",
  "nausea",
  "discomfort",
];
const cyclePhases: CyclePhase[] = ["menstrual", "follicular", "ovulatory", "luteal"];
const bleedingFlows: BleedingFlow[] = ["none", "spotting", "light", "medium", "heavy"];

function emptyEntry(entryDate: string): HealthContextEntryInput {
  return {
    entryDate,
    mood: null,
    stress: null,
    appetite: null,
    energy: null,
    digestiveSymptoms: [],
    symptomSeverity: null,
    cyclePhase: null,
    bleedingFlow: null,
    note: "",
  };
}

export function HealthContextPanel() {
  const { isRTL } = useLanguage();
  const clientFeatureEnabled = isPhaseOneFeatureEnabled("healthContext");
  const today = format(new Date(), "yyyy-MM-dd");
  const [state, setState] = useState<HealthContextState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [entry, setEntry] = useState<HealthContextEntryInput>(() => emptyEntry(today));

  const copy = useMemo(() => isRTL ? {
    eyebrow: "سياقك الصحي",
    title: "افهم نمط يومك",
    subtitle: "سجل الشهية والطاقة والضغط والأعراض بشكل خاص.",
    private: "خاص بك فقط",
    enable: "تفعيل السجل الخاص",
    disabledNote: "الميزة اختيارية ومتوقفة افتراضياً. لن تظهر بياناتك في المجتمع.",
    storedTitle: "بياناتك الصحية محفوظة",
    storedNote: "تم إيقاف جمع البيانات حالياً. ما زال بإمكانك تصدير بياناتك السابقة أو حذفها نهائياً.",
    logToday: "سجل اليوم",
    settings: "الخصوصية",
    entries: "أيام مسجلة",
    appetite: "الشهية",
    stress: "الضغط",
    energy: "الطاقة",
    mood: "المزاج",
    digestive: "الهضم",
    cycle: "مرحلة الدورة",
    bleeding: "شدة النزف",
    note: "ملاحظة خاصة",
    notePlaceholder: "اختياري، لا يتم إرساله للذكاء الاصطناعي",
    save: "حفظ اليوم",
    deleteEntry: "حذف سجل اليوم",
    trends: "ملاحظات خاصة",
    trendsNote: "اتجاهات وصفية وليست تشخيصاً طبياً.",
    cycleToggle: "تسجيل سياق الدورة يدوياً",
    recommendationToggle: "استخدام السياق لتفسير توصيات الوجبات",
    aiToggle: "إضافة المتوسطات المجمعة لتقرير AI",
    aiNote: "يرسل متوسطات مجمعة فقط. لا تُرسل الملاحظات أو التواريخ أو تفاصيل النزف.",
    fields: "الحقول الظاهرة",
    journalToggle: "السجل الصحي الخاص",
    export: "تصدير جميع بياناتي",
    deleteAll: "حذف بيانات السياق الصحي",
    deleteTitle: "حذف كل بيانات السياق الصحي؟",
    deleteDescription: "سيتم حذف السجل والتفضيلات وسحب موافقة AI فوراً. لا يمكن التراجع.",
    cancel: "إلغاء",
    confirmDelete: "حذف نهائي",
    saved: "تم حفظ السياق الصحي",
    enabled: "تم تفعيل السجل الخاص",
    deleted: "تم حذف بيانات السياق الصحي",
    failed: "تعذر إكمال العملية",
    exportReady: "تم تجهيز ملف التصدير",
    symptomSeverity: "شدة الأعراض",
    bloating: "انتفاخ",
    reflux: "ارتجاع",
    constipation: "إمساك",
    diarrhea: "إسهال",
    nausea: "غثيان",
    discomfort: "انزعاج",
    menstrual: "الحيض",
    follicular: "الطور الجريبي",
    ovulatory: "الإباضة",
    luteal: "الطور الأصفري",
    none: "لا يوجد",
    spotting: "تبقيع",
    light: "خفيف",
    medium: "متوسط",
    heavy: "غزير",
  } : {
    eyebrow: "Health context",
    title: "Understand your day",
    subtitle: "Privately log appetite, energy, stress, and symptoms.",
    private: "Private to you",
    enable: "Enable private journal",
    disabledNote: "This is optional and off by default. Your data never appears in Community.",
    storedTitle: "Your health data is stored",
    storedNote: "Collection is currently paused. You can still export your previous data or delete it permanently.",
    logToday: "Log today",
    settings: "Privacy",
    entries: "days logged",
    appetite: "Appetite",
    stress: "Stress",
    energy: "Energy",
    mood: "Mood",
    digestive: "Digestive comfort",
    cycle: "Cycle phase",
    bleeding: "Bleeding flow",
    note: "Private note",
    notePlaceholder: "Optional; never sent to AI",
    save: "Save today",
    deleteEntry: "Delete today's entry",
    trends: "Private observations",
    trendsNote: "Descriptive trends only, not medical findings.",
    cycleToggle: "Manually log cycle context",
    recommendationToggle: "Use context to explain meal recommendations",
    aiToggle: "Include aggregate averages in AI reports",
    aiNote: "Only aggregates are shared. Notes, dates, and bleeding details are never sent.",
    fields: "Visible fields",
    journalToggle: "Private health journal",
    export: "Export all my data",
    deleteAll: "Delete health-context data",
    deleteTitle: "Delete all health-context data?",
    deleteDescription: "This removes entries and preferences and revokes AI consent immediately. It cannot be undone.",
    cancel: "Cancel",
    confirmDelete: "Delete permanently",
    saved: "Health context saved",
    enabled: "Private journal enabled",
    deleted: "Health-context data deleted",
    failed: "Could not complete the action",
    exportReady: "Export file is ready",
    symptomSeverity: "Symptom severity",
    bloating: "Bloating",
    reflux: "Reflux",
    constipation: "Constipation",
    diarrhea: "Diarrhea",
    nausea: "Nausea",
    discomfort: "Discomfort",
    menstrual: "Menstrual",
    follicular: "Follicular",
    ovulatory: "Ovulatory",
    luteal: "Luteal",
    none: "None",
    spotting: "Spotting",
    light: "Light",
    medium: "Medium",
    heavy: "Heavy",
  }, [isRTL]);

  const load = useCallback(async () => {
    try {
      const next = await fetchHealthContextState();
      setState(next);
      const nextPreferences = next.preferences ?? defaultPreferences;
      setPreferences(nextPreferences);
      const todayEntry = next.entries?.find((item) => item.entry_date === today);
      setEntry(todayEntry ? {
        entryDate: today,
        mood: todayEntry.mood,
        stress: todayEntry.stress,
        appetite: todayEntry.appetite,
        energy: todayEntry.energy,
        digestiveSymptoms: todayEntry.digestive_symptoms,
        symptomSeverity: todayEntry.symptom_severity,
        cyclePhase: todayEntry.cycle_phase,
        bleedingFlow: todayEntry.bleeding_flow,
        note: todayEntry.note ?? "",
      } : emptyEntry(today));
    } catch (error) {
      console.error("Unable to load health context", error);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !state) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error("Health context action failed", error);
      toast.error(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  const updatePreferences = async (next: HealthContextPreferences) => {
    setPreferences(next);
    await saveHealthContextPreferences(next);
    await load();
  };

  const enableJournal = () => run(async () => {
    await updatePreferences({ ...preferences, journal_enabled: true });
    toast.success(copy.enabled);
  });

  const saveEntry = () => run(async () => {
    await saveHealthContextEntry(entry);
    setLogOpen(false);
    await load();
    toast.success(copy.saved);
  });

  const todayEntryId = state.entries?.find((item) => item.entry_date === today)?.id;
  const deleteToday = () => run(async () => {
    if (todayEntryId) await deleteHealthContextEntry(todayEntryId);
    setLogOpen(false);
    await load();
  });

  const exportData = () => run(async () => {
    const data = await exportUserDataWithHealthContext();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nutrio-data-${today}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(copy.exportReady);
  });

  const deleteDataset = () => run(async () => {
    await deleteHealthContextDataset();
    setDeleteOpen(false);
    setSettingsOpen(false);
    await load();
    toast.success(copy.deleted);
  });

  const collectionEnabled = clientFeatureEnabled && state.feature_enabled;
  if (!collectionEnabled) {
    if (!state.has_existing_data) return null;
    return (
      <>
        <section dir={isRTL ? "rtl" : "ltr"} className="rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1]">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F6F8FB] text-[#64748B]">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] font-black text-[#020617]">{copy.storedTitle}</h3>
              <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[#64748B]">{copy.storedNote}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={exportData} disabled={busy} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#F6F8FB] text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
              <Download className="h-4 w-4" />
              {copy.export}
            </button>
            <button type="button" onClick={() => setDeleteOpen(true)} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#FFF0F2] text-[11px] font-black text-[#FB6B7A]">
              <Trash2 className="h-4 w-4" />
              {copy.deleteAll}
            </button>
          </div>
        </section>
        <DeleteHealthContextDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDelete={deleteDataset}
          copy={copy}
        />
      </>
    );
  }

  if (!preferences.journal_enabled) {
    return (
      <section dir={isRTL ? "rtl" : "ltr"} className="overflow-hidden rounded-[28px] bg-white ring-1 ring-[#E5EAF1]">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1]">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{copy.private}</p>
              <h3 className="mt-1 text-[20px] font-black text-[#020617]">{copy.title}</h3>
              <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[#64748B]">{copy.disabledNote}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={enableJournal}
            disabled={busy}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#020617] text-[13px] font-black text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {copy.enable}
          </button>
        </div>
      </section>
    );
  }

  const trends = state.trends;
  return (
    <>
      <section dir={isRTL ? "rtl" : "ltr"} className="overflow-hidden rounded-[28px] bg-white ring-1 ring-[#E5EAF1]">
        <div className="bg-[linear-gradient(135deg,#EFFFFA_0%,#FFFFFF_58%,#F3F4FF_100%)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#22C7A1] text-white">
                <HeartPulse className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{copy.eyebrow}</p>
                <h3 className="mt-0.5 text-[20px] font-black text-[#020617]">{copy.title}</h3>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[#64748B]">{copy.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#020617] ring-1 ring-[#E5EAF1]"
              aria-label={copy.settings}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#020617] text-[13px] font-black text-white active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            {copy.logToday}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-px bg-[#E5EAF1]">
          <TrendMetric label={copy.entries} value={String(trends?.entry_count ?? 0)} tone="text-[#22C7A1]" />
          <TrendMetric label={copy.appetite} value={formatAverage(trends?.average_appetite)} tone="text-[#F97316]" />
          <TrendMetric label={copy.stress} value={formatAverage(trends?.average_stress)} tone="text-[#7C83F6]" />
        </div>

        {(trends?.phase_observations?.length ?? 0) > 0 && (
          <div className="border-t border-[#E5EAF1] px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#7C83F6]" />
              <p className="text-[12px] font-black text-[#020617]">{copy.trends}</p>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {trends?.phase_observations.map((item) => (
                <div key={item.cycle_phase} className="min-w-[136px] rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                  <p className="text-[11px] font-black capitalize text-[#020617]">{item.cycle_phase}</p>
                  <p className="mt-1 text-[10px] font-bold text-[#64748B]">
                    {copy.energy}: {formatAverage(item.average_energy)}
                  </p>
                  <p className="text-[10px] font-bold text-[#64748B]">
                    {copy.appetite}: {formatAverage(item.average_appetite)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-[#94A3B8]">{copy.trendsNote}</p>
          </div>
        )}
      </section>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-h-[88vh] w-[calc(100%-24px)] max-w-[406px] overflow-y-auto rounded-[28px] border-0 p-0">
          <DialogHeader className="sticky top-0 z-10 border-b border-[#E5EAF1] bg-white px-5 pb-4 pt-5 text-start">
            <DialogTitle className="text-[20px] font-black text-[#020617]">{copy.logToday}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
            {preferences.mood_enabled && <ScalePicker label={copy.mood} value={entry.mood} onChange={(value) => setEntry((current) => ({ ...current, mood: value }))} />}
            {preferences.stress_enabled && <ScalePicker label={copy.stress} value={entry.stress} onChange={(value) => setEntry((current) => ({ ...current, stress: value }))} />}
            {preferences.appetite_enabled && <ScalePicker label={copy.appetite} value={entry.appetite} onChange={(value) => setEntry((current) => ({ ...current, appetite: value }))} />}
            {preferences.energy_enabled && <ScalePicker label={copy.energy} value={entry.energy} onChange={(value) => setEntry((current) => ({ ...current, energy: value }))} />}

            {preferences.digestive_enabled && (
              <div>
                <p className="mb-2 text-[12px] font-black text-[#020617]">{copy.digestive}</p>
                <div className="flex flex-wrap gap-2">
                  {digestiveOptions.map((symptom) => {
                    const selected = entry.digestiveSymptoms?.includes(symptom) ?? false;
                    return (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => setEntry((current) => ({
                          ...current,
                          digestiveSymptoms: selected
                            ? current.digestiveSymptoms?.filter((item) => item !== symptom)
                            : [...(current.digestiveSymptoms ?? []), symptom],
                        }))}
                        className={cn(
                          "min-h-11 rounded-full px-3 text-[11px] font-black capitalize ring-1",
                          selected ? "bg-[#FFF7ED] text-[#F97316] ring-[#F97316]/30" : "bg-[#F6F8FB] text-[#64748B] ring-[#E5EAF1]",
                        )}
                      >
                          {copy[symptom]}
                      </button>
                    );
                  })}
                </div>
                {(entry.digestiveSymptoms?.length ?? 0) > 0 && (
                  <ScalePicker
                    label={copy.symptomSeverity}
                    value={entry.symptomSeverity === null || entry.symptomSeverity === undefined ? null : Math.max(1, entry.symptomSeverity) as HealthContextScale}
                    onChange={(value) => setEntry((current) => ({ ...current, symptomSeverity: Math.min(4, value) as 1 | 2 | 3 | 4 }))}
                    max={4}
                  />
                )}
              </div>
            )}

            {preferences.cycle_tracking_enabled && (
              <>
                <ChoicePicker label={copy.cycle} options={cyclePhases} labels={copy} value={entry.cyclePhase} onChange={(value) => setEntry((current) => ({ ...current, cyclePhase: value as CyclePhase }))} />
                <ChoicePicker label={copy.bleeding} options={bleedingFlows} labels={copy} value={entry.bleedingFlow} onChange={(value) => setEntry((current) => ({ ...current, bleedingFlow: value as BleedingFlow }))} />
              </>
            )}

            {preferences.note_enabled && (
              <label className="block">
                <span className="mb-2 block text-[12px] font-black text-[#020617]">{copy.note}</span>
                <textarea
                  value={entry.note ?? ""}
                  onChange={(event) => setEntry((current) => ({ ...current, note: event.target.value.slice(0, 800) }))}
                  placeholder={copy.notePlaceholder}
                  className="min-h-[96px] w-full resize-none rounded-2xl bg-[#F6F8FB] p-3 text-[13px] font-semibold text-[#020617] outline-none ring-1 ring-[#E5EAF1] focus:ring-[#22C7A1]"
                />
              </label>
            )}

            <button type="button" onClick={saveEntry} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#22C7A1] text-[13px] font-black text-white disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.save}
            </button>
            {todayEntryId && (
              <button type="button" onClick={deleteToday} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 text-[12px] font-black text-[#FB6B7A]">
                <Trash2 className="h-4 w-4" />
                {copy.deleteEntry}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[88vh] w-[calc(100%-24px)] max-w-[406px] overflow-y-auto rounded-[28px] border-0 p-0">
          <DialogHeader className="sticky top-0 z-10 border-b border-[#E5EAF1] bg-white px-5 pb-4 pt-5 text-start">
            <DialogTitle className="text-[20px] font-black text-[#020617]">{copy.settings}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
            <SettingRow label={copy.journalToggle} checked={preferences.journal_enabled} onChange={(checked) => run(() => updatePreferences({ ...preferences, journal_enabled: checked }))} />
            <SettingRow label={copy.cycleToggle} checked={preferences.cycle_tracking_enabled} onChange={(checked) => run(() => updatePreferences({ ...preferences, cycle_tracking_enabled: checked }))} />
            <SettingRow label={copy.recommendationToggle} checked={preferences.recommendation_context_enabled} onChange={(checked) => run(() => updatePreferences({ ...preferences, recommendation_context_enabled: checked }))} />
            <SettingRow
              label={copy.aiToggle}
              description={copy.aiNote}
              checked={Boolean(state.ai_consent)}
              icon={<Brain className="h-4 w-4" />}
              onChange={(checked) => run(async () => {
                await setHealthContextAiConsent(checked);
                await load();
              })}
            />

            <div className="pt-2">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{copy.fields}</p>
              {([
                ["mood_enabled", copy.mood],
                ["stress_enabled", copy.stress],
                ["appetite_enabled", copy.appetite],
                ["energy_enabled", copy.energy],
                ["digestive_enabled", copy.digestive],
                ["note_enabled", copy.note],
              ] as const).map(([key, label]) => (
                <SettingRow key={key} label={label} checked={preferences[key]} onChange={(checked) => run(() => updatePreferences({ ...preferences, [key]: checked }))} compact />
              ))}
            </div>

            <button type="button" onClick={exportData} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F6F8FB] text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
              <Download className="h-4 w-4" />
              {copy.export}
            </button>
            <button type="button" onClick={() => setDeleteOpen(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FFF0F2] text-[12px] font-black text-[#FB6B7A]">
              <Trash2 className="h-4 w-4" />
              {copy.deleteAll}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteHealthContextDialog open={deleteOpen} onOpenChange={setDeleteOpen} onDelete={deleteDataset} copy={copy} />
    </>
  );
}

function DeleteHealthContextDialog({
  open,
  onOpenChange,
  onDelete,
  copy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  copy: Record<string, string>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-24px)] max-w-[390px] rounded-[26px] border-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[19px] font-black">{copy.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] font-semibold leading-relaxed">{copy.deleteDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 rounded-full">{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="h-11 rounded-full bg-[#FB6B7A] hover:bg-[#FB6B7A]">{copy.confirmDelete}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatAverage(value: number | null | undefined) {
  return value === null || value === undefined ? "--" : Number(value).toFixed(1);
}

function TrendMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-white px-2 py-3 text-center">
      <p className={cn("text-[18px] font-black", tone)}>{value}</p>
      <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-[0.07em] text-[#94A3B8]">{label}</p>
    </div>
  );
}

function ScalePicker({
  label,
  value,
  onChange,
  max = 5,
}: {
  label: string;
  value: HealthContextScale | null | undefined;
  onChange: (value: HealthContextScale) => void;
  max?: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-black text-[#020617]">{label}</p>
        <span className="text-[11px] font-black text-[#22C7A1]">{value ?? "--"}/{max}</span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}>
        {Array.from({ length: max }, (_, index) => (index + 1) as HealthContextScale).map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            className={cn(
              "h-11 rounded-xl text-[12px] font-black ring-1",
              value === number ? "bg-[#22C7A1] text-white ring-[#22C7A1]" : "bg-[#F6F8FB] text-[#64748B] ring-[#E5EAF1]",
            )}
          >
            {number}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChoicePicker({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  labels: Record<string, string>;
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-black text-[#020617]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "min-h-11 rounded-full px-3 text-[11px] font-black capitalize ring-1",
              value === option ? "bg-[#F3F4FF] text-[#7C83F6] ring-[#7C83F6]/30" : "bg-[#F6F8FB] text-[#64748B] ring-[#E5EAF1]",
            )}
          >
            {labels[option] ?? option}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
  icon,
  compact = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl bg-[#F6F8FB] ring-1 ring-[#E5EAF1]", compact ? "min-h-12 px-3 py-2" : "min-h-[68px] p-3")}>
      {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#7C83F6]">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black leading-snug text-[#020617]">{label}</p>
        {description && <p className="mt-1 text-[10px] font-semibold leading-relaxed text-[#64748B]">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
