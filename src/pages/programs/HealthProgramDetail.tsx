import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Clock3, Dumbbell, HeartPulse, Loader2, ShieldAlert, ShieldCheck, Utensils, Waves } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useActiveHealthProgram, useEnrollInHealthProgram, useHealthProgram, usePublishedHealthProgramVersion } from "@/hooks/useHealthPrograms";

const CONSENT_NOTICE = "I understand that Nutrio provides non-clinical nutrition, meal, hydration, strength, and self-tracking support. Nutrio does not diagnose, prescribe, recommend a dose, change medication, or replace my prescribing clinician. I consent to the minimum program health data being processed for this support experience.";

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default function HealthProgramDetail() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data: program, isLoading } = useHealthProgram(slug);
  const { data: version, isLoading: versionLoading } = usePublishedHealthProgramVersion(program?.id);
  const { data: activeProgram } = useActiveHealthProgram();
  const enroll = useEnrollInHealthProgram();
  const [adult, setAdult] = useState(false);
  const [prescribed, setPrescribed] = useState(false);
  const [boundary, setBoundary] = useState(false);
  const canEnroll = adult && prescribed && boundary && Boolean(version) && !activeProgram;
  const includes = useMemo(() => asStringArray(program?.includes), [program?.includes]);
  const outcomes = useMemo(() => asStringArray(program?.outcomes), [program?.outcomes]);

  const startProgram = async () => {
    if (!canEnroll || !program) return;
    try {
      await enroll.mutateAsync({ slug: program.slug, noticeSnapshot: CONSENT_NOTICE });
      toast.success("Your support program is ready");
      navigate("/programs/onboarding", { replace: true });
    } catch (error) {
      console.error("Could not enroll in health program:", error);
      toast.error(error instanceof Error ? error.message : "Could not start the program");
    }
  };

  if (isLoading) {
    return <div className="grid min-h-full place-items-center bg-[#F6F8FB]"><Loader2 className="h-7 w-7 animate-spin text-[#7C83F6]" /></div>;
  }
  if (!program) {
    return <div className="grid min-h-full place-items-center bg-[#F6F8FB] p-6 text-center"><div><h1 className="text-xl font-black">Program unavailable</h1><button type="button" onClick={() => navigate("/programs")} className="mt-4 min-h-11 rounded-full bg-[#020617] px-5 font-black text-white">Back to programs</button></div></div>;
  }

  const featureIcons = [Utensils, Waves, Dumbbell, HeartPulse];

  return (
    <main className="min-h-full bg-[#F6F8FB] pb-[calc(104px+env(safe-area-inset-bottom,0px))] text-[#020617]">
      <header className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-white/95 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-full border border-[#E5EAF1] bg-white" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0"><p className="text-[11px] font-extrabold uppercase text-[#7C83F6]">Program details</p><h1 className="truncate text-lg font-black">{program.name}</h1></div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="rounded-lg bg-[#020617] p-5 text-white shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
          <div className="flex items-center justify-between gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#7C83F6] text-white"><HeartPulse className="h-7 w-7" /></span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold"><Clock3 className="h-4 w-4 text-[#38BDF8]" />{program.duration_weeks} weeks</span>
          </div>
          <h2 className="mt-5 text-2xl font-black leading-8">A simple routine around the care you already receive</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/70">{program.short_description}</p>
        </section>

        <section className="rounded-lg border border-[#E5EAF1] bg-white p-4">
          <p className="text-[11px] font-extrabold uppercase text-[#22C7A1]">What is included</p>
          <div className="mt-3 divide-y divide-[#E5EAF1]">
            {includes.map((item, index) => {
              const Icon = featureIcons[index % featureIcons.length];
              return <div key={item} className="flex min-h-14 items-center gap-3 py-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F6F8FB]"><Icon className="h-5 w-5 text-[#7C83F6]" /></span><span className="text-sm font-bold">{item}</span></div>;
            })}
          </div>
        </section>

        <section className="rounded-lg border border-[#E5EAF1] bg-white p-4">
          <p className="text-[11px] font-extrabold uppercase text-[#38BDF8]">What you work toward</p>
          <div className="mt-3 space-y-3">{outcomes.map((item) => <div key={item} className="flex items-start gap-2.5 text-sm font-bold text-[#334155]"><span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#E9FBF6] text-[#22C7A1]"><Check className="h-3 w-3" strokeWidth={3} /></span>{item}</div>)}</div>
        </section>

        <section className="rounded-lg border border-[#FED7DC] bg-[#FFF1F3] p-4">
          <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#FB6B7A]" /><div><h2 className="text-sm font-black">Important medical boundary</h2><p className="mt-1 text-xs font-semibold leading-5 text-[#7A4B55]">{program.boundary_statement} Contact your clinician about medication, dose, persistent symptoms, or health concerns.</p></div></div>
        </section>

        {activeProgram ? (
          <button type="button" onClick={() => navigate(activeProgram.status === "onboarding" ? "/programs/onboarding" : "/programs/current")} className="flex min-h-14 w-full items-center justify-between rounded-lg bg-[#020617] px-4 font-black text-white">Continue your current program<ChevronRight className="h-5 w-5" /></button>
        ) : versionLoading ? (
          <div className="grid min-h-20 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#7C83F6]" /></div>
        ) : version ? (
          <section className="rounded-lg border border-[#E5EAF1] bg-white p-4">
            <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-[#22C7A1]" /><div><h2 className="font-black">Before you start</h2><p className="text-xs font-semibold text-[#64748B]">Confirm each statement yourself.</p></div></div>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#F6F8FB] p-3"><Checkbox checked={adult} onCheckedChange={(value) => setAdult(value === true)} className="mt-0.5" /><span className="text-sm font-bold leading-5">I am 18 or older.</span></label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#F6F8FB] p-3"><Checkbox checked={prescribed} onCheckedChange={(value) => setPrescribed(value === true)} className="mt-0.5" /><span className="text-sm font-bold leading-5">A licensed clinician prescribed my GLP-1 medicine.</span></label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#F6F8FB] p-3"><Checkbox checked={boundary} onCheckedChange={(value) => setBoundary(value === true)} className="mt-0.5" /><span className="text-sm font-bold leading-5">I understand Nutrio does not diagnose, prescribe, or change my medication or dose.</span></label>
            </div>
            <p className="mt-3 text-[11px] font-semibold leading-5 text-[#64748B]">By starting, you consent to the minimum nutrition, activity, and symptom data needed for the program. You can withdraw later.</p>
          </section>
        ) : (
          <section className="rounded-lg border border-[#DDDFFF] bg-[#F3F3FF] p-4 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-[#7C83F6]" /><h2 className="mt-2 font-black">Independent review in progress</h2><p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">Enrollment opens after the nutrition protocol, safety wording, privacy assessment, and Qatar legal scope are approved.</p></section>
        )}
      </div>

      {version && !activeProgram && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5EAF1] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
          <button type="button" disabled={!canEnroll || enroll.isPending} onClick={() => void startProgram()} className="mx-auto flex min-h-14 w-full max-w-2xl items-center justify-center gap-2 rounded-lg bg-[#7C83F6] px-5 font-black text-white disabled:bg-[#CBD1E1] disabled:text-white/80">
            {enroll.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}Start my support program
          </button>
        </div>
      )}
    </main>
  );
}
