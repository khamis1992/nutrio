import { ArrowLeft, Check, ChevronRight, Clock3, HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useActiveHealthProgram, useHealthPrograms } from "@/hooks/useHealthPrograms";

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default function HealthPrograms() {
  const navigate = useNavigate();
  const { data: programs = [], isLoading } = useHealthPrograms();
  const { data: activeProgram } = useActiveHealthProgram();

  return (
    <main className="min-h-full bg-[#F6F8FB] pb-8 text-[#020617]">
      <header className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-white/95 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#E5EAF1] bg-white active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[11px] font-extrabold uppercase text-[#22C7A1]">Guided support</p>
            <h1 className="text-xl font-black">Health Programs</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {activeProgram && (
          <button
            type="button"
            onClick={() => navigate("/programs/current")}
            className="flex w-full items-center gap-3 rounded-lg bg-[#020617] p-4 text-left text-white shadow-[0_12px_30px_rgba(2,6,23,0.16)] active:scale-[0.99]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10">
              <HeartPulse className="h-6 w-6 text-[#38BDF8]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold uppercase text-[#94A3B8]">Your active program</span>
              <span className="mt-0.5 block truncate text-base font-black">{activeProgram.health_programs.name}</span>
              <span className="mt-1 block text-xs font-semibold text-white/70">Continue today&apos;s plan</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0" />
          </button>
        )}

        <section className="px-1 pt-2">
          <h2 className="text-lg font-black">Choose a clear path</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
            Each program has a duration, outcome, protocol, and explicit safety boundary.
          </p>
        </section>

        {isLoading ? (
          <div className="grid min-h-52 place-items-center rounded-lg bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-[#7C83F6]" />
          </div>
        ) : programs.length === 0 ? (
          <section className="rounded-lg border border-[#E5EAF1] bg-white p-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#7C83F6]" />
            <h2 className="mt-3 font-black">Programs are under review</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
              Programs appear here only after their protocol and safety wording are approved.
            </p>
          </section>
        ) : (
          programs.map((program) => {
            const outcomes = asStringArray(program.outcomes).slice(0, 3);
            return (
              <article key={program.id} className="overflow-hidden rounded-lg border border-[#E5EAF1] bg-white shadow-[0_10px_28px_rgba(2,6,23,0.05)]">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#EEF0FF] text-[#7C83F6]">
                      <HeartPulse className="h-7 w-7" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#E9FBF6] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#0A8F73]">Nutrition + strength</span>
                        <span className="flex items-center gap-1 text-xs font-bold text-[#64748B]">
                          <Clock3 className="h-3.5 w-3.5 text-[#38BDF8]" /> {program.duration_weeks} weeks
                        </span>
                      </div>
                      <h2 className="mt-2 text-lg font-black leading-6">{program.name}</h2>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#64748B]">{program.short_description}</p>
                  <div className="mt-4 space-y-2">
                    {outcomes.map((outcome) => (
                      <div key={outcome} className="flex items-start gap-2 text-sm font-bold text-[#334155]">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#E9FBF6] text-[#22C7A1]">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span>{outcome}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/programs/${program.slug}`)}
                  className="flex min-h-14 w-full items-center justify-between border-t border-[#E5EAF1] bg-[#F6F8FB] px-4 text-sm font-black active:bg-[#EEF0F4]"
                >
                  See program details
                  <ChevronRight className="h-5 w-5 text-[#7C83F6]" />
                </button>
              </article>
            );
          })
        )}

        <section className="rounded-lg border border-[#BFEFE3] bg-[#E9FBF6] p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0A8F73]" />
            <div>
              <h2 className="text-sm font-black">Support, not medical treatment</h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#47645D]">
                Nutrio supports meals, hydration, strength activity, and self-tracking. Medication decisions stay with your clinician.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
