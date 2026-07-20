import { ArrowLeft, ChevronRight, Loader2, ShieldCheck, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useActiveHealthProgram, useHealthProgramMeals } from "@/hooks/useHealthPrograms";

const labels: Record<string, string> = {
  small_portion: "Smaller portion",
  high_protein: "High protein",
  fiber_source: "Fiber source",
  gentle_choice: "Gentle choice",
  hydration_support: "Hydration support",
  lower_fat_option: "Lower-fat option",
};

export default function HealthProgramMeals() {
  const navigate = useNavigate();
  const { data: enrollment, isLoading: enrollmentLoading } = useActiveHealthProgram();
  const { data: qualifications = [], isLoading } = useHealthProgramMeals(enrollment?.program_version_id);

  if (enrollmentLoading || isLoading) return <div className="grid min-h-full place-items-center bg-[#F6F8FB]"><Loader2 className="h-7 w-7 animate-spin text-[#7C83F6]" /></div>;

  return (
    <main className="min-h-full bg-[#F6F8FB] pb-8 text-[#020617]">
      <header className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-white/95 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button type="button" onClick={() => navigate("/programs/current")} className="grid h-11 w-11 place-items-center rounded-full border border-[#E5EAF1] bg-white" aria-label="Back to my program"><ArrowLeft className="h-5 w-5" /></button>
          <div><p className="text-[11px] font-extrabold uppercase text-[#22C7A1]">Reviewed choices</p><h1 className="text-lg font-black">Choose your next meal</h1></div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="rounded-lg border border-[#DDDFFF] bg-white p-4">
          <div className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-[#7C83F6]" /><div><h2 className="font-black">Attributes, not medical claims</h2><p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">These meals were reviewed against the current nutrition protocol. The labels describe measurable meal properties and do not treat symptoms or replace clinician advice.</p></div></div>
        </section>

        {qualifications.length === 0 ? (
          <section className="rounded-lg border border-[#E5EAF1] bg-white p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#F3F3FF] text-[#7C83F6]"><Utensils className="h-6 w-6" /></span>
            <h2 className="mt-4 text-lg font-black">Meal review is still in progress</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">You can still browse Nutrio meals. Use your personal plan and contact your clinician when symptoms affect eating or drinking.</p>
            <button type="button" onClick={() => navigate("/meals")} className="mt-4 min-h-12 rounded-lg bg-[#020617] px-5 font-black text-white">Browse all meals</button>
          </section>
        ) : (
          <div className="space-y-3">
            {qualifications.map((qualification) => {
              const meal = qualification.meals;
              if (!meal) return null;
              return (
                <button key={qualification.id} type="button" onClick={() => navigate(`/meals/${meal.id}`)} className="flex min-h-[108px] w-full items-center gap-3 rounded-lg border border-[#E5EAF1] bg-white p-3 text-left shadow-[0_8px_20px_rgba(2,6,23,0.04)] active:scale-[0.99]">
                  {meal.image_url ? <img src={meal.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-[#F3F3FF] text-[#7C83F6]"><Utensils className="h-6 w-6" /></span>}
                  <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-black leading-5">{meal.name}</span><span className="mt-1 block text-xs font-bold text-[#64748B]">{Math.round(meal.calories ?? 0)} kcal · {Math.round(meal.protein_g ?? 0)}g protein</span><span className="mt-2 flex flex-wrap gap-1.5">{qualification.attributes.slice(0, 3).map((attribute) => <span key={attribute} className="rounded-full bg-[#E9FBF6] px-2 py-1 text-[10px] font-extrabold text-[#08765F]">{labels[attribute] ?? attribute}</span>)}</span></span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#94A3B8]" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
