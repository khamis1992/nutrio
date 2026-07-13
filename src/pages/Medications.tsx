import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Pill, Loader2, Plus, Trash2, FlaskRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUserMedications } from "@/hooks/useMealMedicineCheck";
import { toast } from "sonner";

const COMMON_MEDICATIONS = [
  { name: "Atorvastatin", ingredient: "atorvastatin" },
  { name: "Metformin", ingredient: "metformin" },
  { name: "Lisinopril", ingredient: "lisinopril" },
  { name: "Levothyroxine", ingredient: "levothyroxine" },
  { name: "Amlodipine", ingredient: "amlodipine" },
  { name: "Metronidazole", ingredient: "metronidazole" },
  { name: "Warfarin", ingredient: "warfarin" },
  { name: "Insulin", ingredient: "insulin" },
  { name: "Prednisone", ingredient: "prednisone" },
  { name: "Omeprazole", ingredient: "omeprazole" },
  { name: "Sertraline", ingredient: "sertraline" },
  { name: "Fluoxetine", ingredient: "fluoxetine" },
];

const frequencyOptions = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "Three times daily" },
  { value: "as_needed", label: "As needed" },
  { value: "weekly", label: "Weekly" },
];

const Medications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { medications, loading, addMedication, deleteMedication, isAdding } = useUserMedications();
  const [addOpen, setAddOpen] = useState(() => {
    const state = location.state as { openAddMedication?: boolean } | null;
    return Boolean(state?.openAddMedication);
  });
  const [name, setName] = useState("");
  const [ingredient, setIngredient] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const saving = isAdding;
  const handleAdd = async () => {
    if (!name.trim() || !ingredient.trim() || !user) return;

    try {
      await addMedication({
        userId: user.id,
        medicationName: name.trim(),
        activeIngredient: ingredient.trim().toLowerCase(),
        dosage: dosage.trim() || undefined,
        frequency: frequency || undefined,
      });
      toast.success("Medication added");
      setAddOpen(false);
      setName("");
      setIngredient("");
      setDosage("");
      setFrequency("");
    } catch {
      toast.error("Failed to add medication");
    }
  };

  const handleQuickAdd = async (med: { name: string; ingredient: string }) => {
    if (!user) return;

    const exists = medications.some(
      (m) => m.active_ingredient.toLowerCase() === med.ingredient.toLowerCase()
    );
    if (exists) {
      toast.error(`${med.name} is already in your list`);
      return;
    }

    try {
      await addMedication({
        userId: user.id,
        medicationName: med.name,
        activeIngredient: med.ingredient,
      });
      toast.success(`${med.name} added`);
    } catch {
      toast.error("Failed to add medication");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await deleteMedication(id);
    } catch {
      toast.error("Failed to remove medication");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-24 text-[#020617]">
      <header className="sticky top-0 z-40 border-b border-[#E5EAF1] bg-white/95 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-950"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-[18px] font-black text-[#020617]">Medications</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <p className="text-[12px] font-semibold leading-relaxed text-slate-500">
          Add your medications so we can check your meals for potential food-drug interactions.
        </p>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="w-full rounded-full text-[13px] font-black">
              <Plus className="mr-1.5 h-4 w-4" />
              Add medication
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[32px] p-6">
            <DialogHeader>
              <DialogTitle className="text-[20px] font-black">Add medication</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Medication name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Atorvastatin"
                  className="rounded-2xl border-slate-200 px-4 py-5 text-[14px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Active ingredient
                </Label>
                <Input
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                  placeholder="e.g. atorvastatin"
                  className="rounded-2xl border-slate-200 px-4 py-5 text-[14px]"
                />
                <p className="text-[10px] font-semibold text-slate-400">
                  This is used to check against food interactions.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Dosage (optional)
                  </Label>
                  <Input
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 10mg"
                    className="rounded-2xl border-slate-200 px-4 py-5 text-[14px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Frequency (optional)
                  </Label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-950 outline-none focus:ring-2 focus:ring-slate-950/20"
                  >
                    <option value="">Select</option>
                    {frequencyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                onClick={handleAdd}
                disabled={!name.trim() || !ingredient.trim() || saving}
                className="w-full rounded-full text-[13px] font-black"
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save medication
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : medications.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Your medications ({medications.length})
            </p>
            {medications.map((med) => (
              <motion.div
                key={med.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F9FF] text-[#38BDF8]">
                  <FlaskRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-black text-slate-950">{med.medication_name}</p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    {med.active_ingredient}
                    {med.dosage ? ` · ${med.dosage}` : ""}
                    {med.frequency ? ` · ${t(med.frequency)}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(med.id)}
                  disabled={deletingId === med.id}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                  aria-label={`Remove ${med.medication_name}`}
                >
                  {deletingId === med.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-white p-8 text-center shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Pill className="h-7 w-7 text-slate-400" />
            </div>
            <h2 className="text-[18px] font-black text-slate-950">No medications yet</h2>
            <p className="mt-2 text-[13px] font-semibold text-slate-500">
              Add your medications to get food-drug interaction warnings on every meal.
            </p>
          </div>
        )}

        {medications.length === 0 && !loading && (
          <div className="rounded-[28px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Quick add
            </p>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">
              Common medications we can check:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {COMMON_MEDICATIONS.map((med) => (
                <button
                  key={med.ingredient}
                  onClick={() => handleQuickAdd(med)}
                  disabled={saving}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
                >
                  + {med.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Medications;
