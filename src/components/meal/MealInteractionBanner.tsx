import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, Info, Pill, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMealMedicineCheck } from "@/hooks/useMealMedicineCheck";
import { useUserMedications } from "@/hooks/useMealMedicineCheck";
import { cn } from "@/lib/utils";

interface MealInteractionBannerProps {
  mealId: string;
}

const severityConfig = {
  severe: {
    icon: ShieldX,
    bg: "bg-red-50",
    border: "ring-red-200",
    text: "text-red-800",
    label: "Severe Interaction",
    labelColor: "bg-red-200 text-red-800",
  },
  moderate: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "ring-amber-200",
    text: "text-amber-800",
    label: "Moderate Interaction",
    labelColor: "bg-amber-200 text-amber-800",
  },
  mild: {
    icon: Info,
    bg: "bg-yellow-50",
    border: "ring-yellow-200",
    text: "text-yellow-800",
    label: "Mild Interaction",
    labelColor: "bg-yellow-200 text-yellow-800",
  },
};

export function MealInteractionBanner({ mealId }: MealInteractionBannerProps) {
  const navigate = useNavigate();
  const { data: interactions = [], isLoading: loading } = useMealMedicineCheck(mealId);
  const { medications, loading: medsLoading } = useUserMedications();

  if (loading || medsLoading) return null;

  const hasInteractions = interactions.length > 0;
  const noMedications = medications.length === 0;

  if (noMedications) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[28px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F0F9FF] text-[#38BDF8]">
            <Pill className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Medicine Check</p>
            <h2 className="text-[20px] font-black text-slate-950">Medication interactions</h2>
            <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
              Add your medications to check if this meal conflicts with them.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/medications", { state: { openAddMedication: true } })}
              className="mt-3 rounded-full text-[11px] font-black"
            >
              Add medications
            </Button>
          </div>
        </div>
      </motion.section>
    );
  }

  if (!hasInteractions) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[28px] border-2 border-emerald-200 bg-emerald-50/50 p-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] font-black text-emerald-800">No interactions found</p>
            <p className="text-[11px] font-semibold text-emerald-600">
              This meal does not conflict with your medications.
            </p>
          </div>
        </div>
      </motion.section>
    );
  }

  const topSeverity = interactions.reduce(
    (max, i) => (i.severity === "severe" ? "severe" : i.severity === "moderate" && max !== "severe" ? "moderate" : max),
    "mild" as "mild" | "moderate" | "severe"
  );

  const config = severityConfig[topSeverity];
  const SeverityIcon = config.icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-[28px] p-5 ring-1", config.bg, config.border)}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", config.bg)}>
          <SeverityIcon className={cn("h-5 w-5", config.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", config.text)}>Medicine Check</p>
          <h2 className="text-[20px] font-black text-slate-950">
            {interactions.length} interaction{interactions.length > 1 ? "s" : ""} detected
          </h2>
        </div>
      </div>

      <div className="space-y-3">
        {interactions.map((interaction) => {
          const sev = severityConfig[interaction.severity];
          const SevIcon = sev.icon;

          return (
            <div
              key={interaction.interaction_id}
              className={cn("rounded-2xl p-4 ring-1", sev.bg, sev.border)}
            >
              <div className="mb-2 flex items-center gap-2">
                <SevIcon className={cn("h-4 w-4", sev.text)} />
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase", sev.labelColor)}>
                  {sev.label}
                </span>
              </div>

              <p className="text-[13px] font-black text-slate-950">
                <span className="underline decoration-dotted">{interaction.medication_name}</span>
                {" "}↔{" "}
                <span className="underline decoration-dotted">{interaction.food_ingredient}</span>
              </p>

              <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-600">
                {interaction.description}
              </p>

              <div className="mt-2 rounded-xl bg-white/60 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Recommendation</p>
                <p className="mt-0.5 text-[12px] font-bold text-slate-700">{interaction.recommendation}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/medications")}
        className="mt-3 rounded-full text-[11px] font-black text-slate-500"
      >
        Manage medications
      </Button>
    </motion.section>
  );
}
