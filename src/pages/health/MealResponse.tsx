import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  Gauge,
  HeartPulse,
  Loader2,
  MessageCircleMore,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { MealResponseExperimentPanel } from "@/components/meal-response/MealResponseExperimentPanel";
import { MealResponsePrivacyControls } from "@/components/meal-response/MealResponsePrivacyControls";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMealResponse } from "@/hooks/useMealResponse";
import {
  DEFAULT_PREFERENCES,
  type MealResponseEvidenceTier,
  type PendingMealResponseCheckIn,
} from "@/lib/meal-response";
import { cn } from "@/lib/utils";

const evidenceColors: Record<MealResponseEvidenceTier, string> = {
  descriptive: "bg-[#F6F8FB] text-[#64748B] ring-[#DCE4EE]",
  early: "bg-[#EFF9FF] text-[#0284C7] ring-[#38BDF8]/25",
  medium: "bg-[#F3F4FF] text-[#6268D9] ring-[#7C83F6]/25",
  strong: "bg-[#EFFFFA] text-[#0D9F7F] ring-[#22C7A1]/25",
};

const copy = {
  en: {
    eyebrow: "MEAL RESPONSE",
    title: "How meals work for you",
    subtitle: "Connect what you ate with measured glucose and a short check-in. Patterns appear only after enough reliable repeats.",
    setupTitle: "Start building your personal evidence",
    setupBody: "Nutrio stores meal timing and your short responses. Glucose is analyzed only when you separately allow it.",
    enable: "Enable meal response",
    privacy: "You control each use",
    privacyBody: "Recommendation use, coach sharing and research remain separate choices. Raw health samples are never sent to AI text tools.",
    episodes: "Eligible meals",
    checkIns: "Check-ins due",
    evidence: "Best evidence",
    noEvidence: "Collecting",
    glucose: "Glucose source",
    connected: "Connected",
    notConnected: "Not connected",
    connect: "Connect health app",
    pending: "Quick check-in",
    pendingBody: "A 20-second response helps distinguish how the meal felt from what a sensor measured.",
    insights: "Your meal patterns",
    noInsights: "No reliable pattern yet",
    noInsightsBody: "Confirm meal times and complete a few check-ins. We will describe individual meals first, then look for repeatable patterns.",
    measured: "Measured",
    observed: "Observed",
    predicted: "Predicted",
    experiment: "Personal experiment",
    confidence: "confidence",
    repeats: "eligible repeats",
    useful: "Useful",
    inaccurate: "Not accurate",
    experiments: "Personal comparisons",
    next: "Next",
    safety: "Wellness guidance only. Nutrio does not diagnose glucose conditions or recommend medication changes.",
    retry: "Try again",
  },
  ar: {
    eyebrow: "استجابة الوجبات",
    title: "كيف تؤثر الوجبات عليك",
    subtitle: "اربط ما تناولته بقياس الجلوكوز وتقييم قصير. لا تظهر الأنماط إلا بعد تكرارات موثوقة كافية.",
    setupTitle: "ابدأ بناء دليلك الشخصي",
    setupBody: "يحفظ Nutrio وقت الوجبة واستجابتك القصيرة. لا يُحلل الجلوكوز إلا بعد موافقة منفصلة منك.",
    enable: "تفعيل استجابة الوجبات",
    privacy: "أنت تتحكم بكل استخدام",
    privacyBody: "استخدام النتائج في التوصيات ومشاركتها مع المدرب والبحث خيارات منفصلة. لا نرسل القياسات الصحية الخام إلى أدوات النص بالذكاء الاصطناعي.",
    episodes: "وجبات مؤهلة",
    checkIns: "تقييمات مطلوبة",
    evidence: "أفضل دليل",
    noEvidence: "قيد الجمع",
    glucose: "مصدر الجلوكوز",
    connected: "متصل",
    notConnected: "غير متصل",
    connect: "ربط تطبيق الصحة",
    pending: "تقييم سريع",
    pendingBody: "استجابة مدتها 20 ثانية تساعدنا على فصل شعورك بعد الوجبة عما قاسه المستشعر.",
    insights: "أنماط وجباتك",
    noInsights: "لا يوجد نمط موثوق بعد",
    noInsightsBody: "أكد أوقات الوجبات وأكمل بعض التقييمات. سنصف كل وجبة أولًا ثم نبحث عن نمط متكرر.",
    measured: "مقاس",
    observed: "ملاحظ",
    predicted: "متنبأ",
    experiment: "تجربة شخصية",
    confidence: "ثقة",
    repeats: "تكرارات مؤهلة",
    useful: "مفيد",
    inaccurate: "غير دقيق",
    experiments: "مقارنات شخصية",
    next: "التالي",
    safety: "إرشاد للعافية فقط. لا يشخص Nutrio اضطرابات الجلوكوز ولا يوصي بتغيير الأدوية.",
    retry: "إعادة المحاولة",
  },
} as const;

export default function MealResponse() {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const text = copy[language];
  const { data, isLoading, error, refetch, preferences, checkIn, feedback } = useMealResponse();
  const [activeCheckIn, setActiveCheckIn] = useState<PendingMealResponseCheckIn | null>(null);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const bestEvidence = useMemo(() => {
    const order: MealResponseEvidenceTier[] = ["strong", "medium", "early", "descriptive"];
    return order.find((tier) => data?.estimates.some((item) => item.evidence_tier === tier));
  }, [data?.estimates]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB]"><Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" /></div>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#F6F8FB] pb-[calc(32px+env(safe-area-inset-bottom))]" dir={isRTL ? "rtl" : "ltr"}>
      <header className="px-4 pb-4 pt-[calc(18px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#020617] ring-1 ring-[#DCE4EE]">
            <BackIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase text-[#22C7A1]">{text.eyebrow}</p>
            <h1 className="mt-0.5 text-[22px] font-black leading-tight text-[#020617]">{text.title}</h1>
          </div>
          <button type="button" onClick={() => void refetch()} aria-label={text.retry} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#020617] text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#64748B]">{text.subtitle}</p>
      </header>

      <div className="space-y-4 px-4">
        {error ? (
          <section className="rounded-2xl bg-[#FFF0F2] p-4 ring-1 ring-[#FB6B7A]/25">
            <div className="flex items-center gap-3"><CircleAlert className="h-5 w-5 text-[#FB6B7A]" /><p className="text-[13px] font-extrabold text-[#020617]">{String(error.message)}</p></div>
          </section>
        ) : null}

        {!data?.preferences.meal_response_enabled ? (
          <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-[#DCE4EE] shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
            <div className="p-5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1]"><Sparkles className="h-5 w-5" /></span>
              <h2 className="mt-4 text-[19px] font-black text-[#020617]">{text.setupTitle}</h2>
              <p className="mt-2 text-[13px] font-semibold leading-5 text-[#64748B]">{text.setupBody}</p>
              <button
                type="button"
                disabled={preferences.isPending}
                onClick={async () => {
                  try {
                    await preferences.mutateAsync({
                      ...DEFAULT_PREFERENCES,
                      meal_response_enabled: true,
                      post_meal_prompts_enabled: true,
                      recommendation_use_enabled: true,
                    });
                    toast.success(text.enable);
                  } catch (mutationError) {
                    toast.error(mutationError instanceof Error ? mutationError.message : text.retry);
                  }
                }}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#020617] px-4 text-[13px] font-black text-white disabled:opacity-50"
              >
                {preferences.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {text.enable}
              </button>
            </div>
            <div className="border-t border-[#E5EAF1] bg-[#F6F8FB] p-4">
              <p className="text-[12px] font-black text-[#020617]">{text.privacy}</p>
              <p className="mt-1 text-[11px] font-semibold leading-4 text-[#64748B]">{text.privacyBody}</p>
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-2">
              <MetricCard icon={<UtensilsCrossed className="h-4 w-4" />} color="text-[#22C7A1] bg-[#EFFFFA]" value={data.eligible_episode_count} label={text.episodes} />
              <MetricCard icon={<MessageCircleMore className="h-4 w-4" />} color="text-[#38BDF8] bg-[#EFF9FF]" value={data.pending_check_ins.length} label={text.checkIns} />
              <MetricCard icon={<Gauge className="h-4 w-4" />} color="text-[#7C83F6] bg-[#F3F4FF]" value={bestEvidence || text.noEvidence} label={text.evidence} />
            </section>

            <section className="rounded-3xl bg-white p-4 ring-1 ring-[#DCE4EE]">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#EFF9FF] text-[#38BDF8]"><HeartPulse className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase text-[#94A3B8]">{text.glucose}</p><p className="mt-0.5 text-[14px] font-black text-[#020617]">{data.glucose_connected ? text.connected : text.notConnected}</p></div>
                <button type="button" onClick={() => navigate("/settings")} className="flex min-h-11 items-center gap-1 rounded-full border border-[#DCE4EE] px-3 text-[11px] font-black text-[#020617]">{text.connect}<ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
              </div>
            </section>

            <MealResponseExperimentPanel
              experiments={data.experiments}
              glucoseConnected={data.glucose_connected}
              isRTL={isRTL}
              onChanged={refetch}
            />

            {data.pending_check_ins.length > 0 ? (
              <section className="rounded-3xl bg-white p-4 ring-1 ring-[#DCE4EE]">
                <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FFF0F2] text-[#FB6B7A]"><MessageCircleMore className="h-5 w-5" /></span><div><h2 className="text-[16px] font-black text-[#020617]">{text.pending}</h2><p className="mt-1 text-[11px] font-semibold leading-4 text-[#64748B]">{text.pendingBody}</p></div></div>
                <div className="mt-4 space-y-2">
                  {data.pending_check_ins.slice(0, 3).map((item) => (
                    <button key={item.consumption_id} type="button" onClick={() => setActiveCheckIn(item)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#F6F8FB] p-2 text-start ring-1 ring-[#E5EAF1]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed className="h-4 w-4 text-[#94A3B8]" />}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-black text-[#020617]">{item.meal_name}</span>
                      <ChevronRight className="h-4 w-4 text-[#94A3B8] rtl:rotate-180" />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="px-1 text-[16px] font-black text-[#020617]">{text.insights}</h2>
              {data.estimates.length === 0 ? (
                <div className="mt-3 rounded-3xl bg-white p-5 text-center ring-1 ring-[#DCE4EE]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#F3F4FF] text-[#7C83F6]"><Activity className="h-5 w-5" /></span><h3 className="mt-3 text-[15px] font-black text-[#020617]">{text.noInsights}</h3><p className="mt-2 text-[12px] font-semibold leading-5 text-[#64748B]">{text.noInsightsBody}</p></div>
              ) : (
                <div className="mt-3 space-y-3">
                  {data.estimates.map((item) => (
                    <article key={item.id} className="rounded-3xl bg-white p-4 ring-1 ring-[#DCE4EE]">
                      <div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#F6F8FB]">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <Gauge className="h-5 w-5 text-[#7C83F6]" />}</span><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-black text-[#020617]">{item.meal_name}</p><div className="mt-1 flex flex-wrap gap-1.5"><span className={cn("rounded-full px-2 py-1 text-[9px] font-black ring-1", evidenceColors[item.evidence_tier])}>{item.evidence_tier}</span><span className="rounded-full bg-[#F6F8FB] px-2 py-1 text-[9px] font-black text-[#64748B]">{text[item.source_kind]}</span></div></div></div>
                      <div className="mt-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase text-[#94A3B8]">{item.outcome}</p><p className="mt-1 text-[24px] font-black text-[#020617]">{item.estimate ?? "—"}<span className="ms-1 text-[11px] text-[#94A3B8]">{item.unit}</span></p>{item.lower_bound !== null && item.upper_bound !== null ? <p className="text-[10px] font-bold text-[#94A3B8]">{item.lower_bound}–{item.upper_bound} {item.unit}</p> : null}</div><div className="text-end"><p className="text-[13px] font-black text-[#22C7A1]">{Math.round(item.confidence_score)}%</p><p className="text-[9px] font-bold uppercase text-[#94A3B8]">{text.confidence}</p><p className="mt-1 text-[10px] font-bold text-[#64748B]">{item.eligible_episode_count} {text.repeats}</p></div></div>
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#E5EAF1] pt-3"><button type="button" onClick={() => feedback.mutate({ estimateId: item.id, rating: "useful" })} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#EFFFFA] text-[11px] font-black text-[#0D9F7F]"><ThumbsUp className="h-4 w-4" />{text.useful}</button><button type="button" onClick={() => feedback.mutate({ estimateId: item.id, rating: "not_accurate" })} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FFF0F2] text-[11px] font-black text-[#FB6B7A]"><ThumbsDown className="h-4 w-4" />{text.inaccurate}</button></div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {data.experiments.length > 0 ? <section><h2 className="px-1 text-[16px] font-black text-[#020617]">{text.experiments}</h2><div className="mt-3 space-y-2">{data.experiments.map((experiment) => <article key={experiment.id} className="rounded-3xl bg-white p-4 ring-1 ring-[#DCE4EE]"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]"><FlaskConical className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black text-[#020617]">{experiment.title}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EDF1F6]"><div className="h-full rounded-full bg-[#7C83F6]" style={{ width: `${Math.min(100, (experiment.completed_repeats / experiment.minimum_repeats) * 100)}%` }} /></div></div>{experiment.next_assignment_label ? <span className="text-[10px] font-black text-[#64748B]">{text.next}: {experiment.next_assignment_label}</span> : null}</div></article>)}</div></section> : null}
          </>
        )}

        {data?.preferences.meal_response_enabled ? <MealResponsePrivacyControls isRTL={isRTL} onChanged={refetch} /> : null}
        <p className="flex items-start gap-2 rounded-2xl bg-white p-3 text-[10px] font-semibold leading-4 text-[#64748B] ring-1 ring-[#DCE4EE]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#22C7A1]" />{text.safety}</p>
      </div>

      {activeCheckIn ? <CheckInDialog item={activeCheckIn} isRTL={isRTL} saving={checkIn.isPending} onClose={() => setActiveCheckIn(null)} onSubmit={async (values) => { try { await checkIn.mutateAsync({ consumptionId: activeCheckIn.consumption_id, promptOffsetMinutes: activeCheckIn.prompt_offset_minutes, ...values }); toast.success(isRTL ? "تم حفظ استجابتك" : "Response saved"); setActiveCheckIn(null); } catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : text.retry); } }} /> : null}
    </main>
  );
}

function MetricCard({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: string | number; label: string }) {
  return <div className="flex min-h-[108px] flex-col items-center justify-center rounded-2xl bg-white p-3 text-center ring-1 ring-[#DCE4EE]"><span className={cn("grid h-8 w-8 place-items-center rounded-full", color)}>{icon}</span><p className="mt-2 max-w-full truncate text-[16px] font-black text-[#020617]">{value}</p><p className="mt-1 text-[9px] font-black uppercase leading-3 text-[#94A3B8]">{label}</p></div>;
}

function CheckInDialog({ item, isRTL, saving, onClose, onSubmit }: { item: PendingMealResponseCheckIn; isRTL: boolean; saving: boolean; onClose: () => void; onSubmit: (values: { satiety: number; energy: number; digestion: number; symptoms: string[]; confounders: string[] }) => Promise<void> }) {
  const [satiety, setSatiety] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [digestion, setDigestion] = useState(0);
  const [confounders, setConfounders] = useState<string[]>([]);
  const labels = isRTL ? { title: "كيف كانت استجابتك؟", satiety: "الشبع", energy: "الطاقة", digestion: "الراحة الهضمية", context: "هل حدث شيء آخر؟", workout: "تمرين", snack: "طعام آخر", stress: "ضغط", medication: "دواء", save: "حفظ التقييم" } : { title: "How did this meal feel?", satiety: "Fullness", energy: "Energy", digestion: "Digestive comfort", context: "Anything else in the window?", workout: "Workout", snack: "Other food", stress: "Stress", medication: "Medication", save: "Save check-in" };
  const contextOptions = [["exercise", labels.workout], ["overlapping_meal", labels.snack], ["other", labels.stress], ["medication_change", labels.medication]] as const;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#020617]/45" dir={isRTL ? "rtl" : "ltr"}><section className="w-full max-w-[430px] rounded-t-3xl bg-white px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 shadow-2xl"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1]"><Activity className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[17px] font-black text-[#020617]">{labels.title}</p><p className="truncate text-[11px] font-bold text-[#94A3B8]">{item.meal_name}</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-[#F6F8FB]"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-4"><Rating label={labels.satiety} value={satiety} onChange={setSatiety} /><Rating label={labels.energy} value={energy} onChange={setEnergy} /><Rating label={labels.digestion} value={digestion} onChange={setDigestion} /><div><p className="text-[12px] font-black text-[#020617]">{labels.context}</p><div className="mt-2 grid grid-cols-2 gap-2">{contextOptions.map(([value, label]) => { const active = confounders.includes(value); return <button key={value} type="button" onClick={() => setConfounders((current) => active ? current.filter((item) => item !== value) : [...current, value])} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-full border text-[11px] font-black", active ? "border-[#7C83F6] bg-[#F3F4FF] text-[#6268D9]" : "border-[#DCE4EE] text-[#64748B]")}>{active ? <Check className="h-3.5 w-3.5" /> : null}{label}</button>; })}</div></div></div><button type="button" disabled={saving || !satiety || !energy || !digestion} onClick={() => void onSubmit({ satiety, energy, digestion, symptoms: [], confounders })} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#020617] text-[13px] font-black text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{labels.save}</button></section></div>;
}

function Rating({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div><div className="flex items-center justify-between"><p className="text-[12px] font-black text-[#020617]">{label}</p><output className="text-[12px] font-black text-[#7C83F6]">{value || "—"}/5</output></div><div className="mt-2 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" onClick={() => onChange(score)} className={cn("min-h-11 rounded-xl border text-[12px] font-black", value === score ? "border-[#020617] bg-[#020617] text-white" : "border-[#DCE4EE] bg-[#F6F8FB] text-[#64748B]")}>{score}</button>)}</div></div>;
}
