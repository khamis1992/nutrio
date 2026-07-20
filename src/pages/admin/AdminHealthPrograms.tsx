import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronRight, ClipboardCheck, FileCheck2, FlaskConical, HeartPulse, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminKpiStrip, AdminPanel, AdminPanelHeader, AdminWorkbenchHeader } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Program = Tables<"health_programs">;
type Version = Tables<"health_program_versions">;
type Gate = Tables<"health_program_review_gates">;
type Meal = Pick<Tables<"meals">, "id" | "name" | "image_url" | "calories" | "protein_g" | "fiber_g" | "fat_g" | "nutrient_completeness_score">;
type Qualification = Tables<"health_program_meal_qualifications">;
type SafetyEvent = Tables<"health_program_safety_events">;

const GATE_LABELS: Record<string, { title: string; helper: string }> = {
  qatar_legal: { title: "Qatar legal scope", helper: "Claims, classification, and non-clinical boundary" },
  licensed_dietitian: { title: "Licensed dietitian", helper: "Nutrition rules and meal attributes" },
  medical_safety: { title: "Medical safety wording", helper: "Warnings and escalation messages" },
  privacy_dpia: { title: "Privacy DPIA", helper: "Special-nature data processing and retention" },
};

const ATTRIBUTE_LABELS: Record<string, string> = {
  small_portion: "Small portion",
  high_protein: "High protein",
  fiber_source: "Fiber source",
  gentle_choice: "Gentle choice",
  hydration_support: "Hydration support",
  lower_fat_option: "Lower-fat option",
};

const ALL_ATTRIBUTES = Object.keys(ATTRIBUTE_LABELS);

export default function AdminHealthPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>([]);
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"governance" | "meals" | "safety">("governance");
  const [search, setSearch] = useState("");
  const [selectedGate, setSelectedGate] = useState<Gate | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [gateForm, setGateForm] = useState({ status: "approved", reviewer: "", evidence: "", note: "" });
  const [mealForm, setMealForm] = useState({ status: "eligible", attributes: [] as string[], rationale: "" });
  const [saving, setSaving] = useState(false);

  const currentProgram = programs[0];
  const currentVersion = versions.find((item) => item.program_id === currentProgram?.id);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [programResult, versionResult, gateResult, mealResult, qualificationResult, safetyResult, enrollmentResult] = await Promise.all([
        supabase.from("health_programs").select("*").order("created_at", { ascending: false }),
        supabase.from("health_program_versions").select("*").order("version", { ascending: false }),
        supabase.from("health_program_review_gates").select("*").order("gate_type"),
        supabase.from("meals").select("id,name,image_url,calories,protein_g,fiber_g,fat_g,nutrient_completeness_score").eq("is_available", true).eq("approval_status", "approved").order("name").limit(100),
        supabase.from("health_program_meal_qualifications").select("*"),
        supabase.from("health_program_safety_events").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("health_program_enrollments").select("id", { count: "exact", head: true }),
      ]);
      for (const result of [programResult, versionResult, gateResult, mealResult, qualificationResult, safetyResult, enrollmentResult]) if (result.error) throw result.error;
      setPrograms(programResult.data ?? []);
      setVersions(versionResult.data ?? []);
      setGates(gateResult.data ?? []);
      setMeals((mealResult.data ?? []) as Meal[]);
      setQualifications(qualificationResult.data ?? []);
      setSafetyEvents(safetyResult.data ?? []);
      setEnrollmentCount(enrollmentResult.count ?? 0);
    } catch (error) {
      console.error("Could not load health program administration:", error);
      toast.error("Could not load health programs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const approvedGates = gates.filter((gate) => gate.program_version_id === currentVersion?.id && gate.status === "approved").length;
  const qualifiedMeals = qualifications.filter((item) => item.program_version_id === currentVersion?.id && item.status === "eligible").length;
  const urgentEvents = safetyEvents.filter((item) => item.severity === "urgent").length;
  const filteredMeals = useMemo(() => meals.filter((meal) => meal.name.toLowerCase().includes(search.trim().toLowerCase())), [meals, search]);

  const openGate = (gate: Gate) => {
    setSelectedGate(gate);
    setGateForm({ status: gate.status === "pending" ? "approved" : gate.status, reviewer: gate.reviewer_name ?? "", evidence: gate.evidence_reference ?? "", note: gate.review_note ?? "" });
  };

  const saveGate = async () => {
    if (!selectedGate) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("review_health_program_gate", {
        p_program_version_id: selectedGate.program_version_id,
        p_gate_type: selectedGate.gate_type,
        p_status: gateForm.status,
        p_reviewer_name: gateForm.reviewer,
        p_evidence_reference: gateForm.evidence,
        p_review_note: gateForm.note || undefined,
      });
      if (error) throw error;
      toast.success("Review gate recorded with audit evidence");
      setSelectedGate(null);
      await loadData();
    } catch (error) {
      console.error("Could not record review gate:", error);
      toast.error(error instanceof Error ? error.message : "Could not record review");
    } finally { setSaving(false); }
  };

  const publishVersion = async () => {
    if (!currentVersion) return;
    try {
      const { error } = await supabase.rpc("publish_health_program_version", { p_program_version_id: currentVersion.id });
      if (error) throw error;
      toast.success("Program protocol published");
      await loadData();
    } catch (error) {
      console.error("Could not publish program protocol:", error);
      toast.error(error instanceof Error ? error.message : "Could not publish protocol");
    }
  };

  const openMeal = (meal: Meal) => {
    const qualification = qualifications.find((item) => item.program_version_id === currentVersion?.id && item.meal_id === meal.id);
    setSelectedMeal(meal);
    setMealForm({ status: qualification?.status ?? "eligible", attributes: qualification?.attributes ?? [], rationale: qualification?.rationale ?? "" });
  };

  const saveMeal = async () => {
    if (!selectedMeal || !currentVersion) return;
    if (mealForm.status === "eligible" && mealForm.attributes.length === 0) { toast.error("Select at least one measurable attribute"); return; }
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.from("health_program_meal_qualifications").upsert({
        program_version_id: currentVersion.id,
        meal_id: selectedMeal.id,
        status: mealForm.status,
        attributes: mealForm.attributes,
        rationale: mealForm.rationale || null,
        reviewed_by: authData.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      }, { onConflict: "program_version_id,meal_id" });
      if (error) throw error;
      toast.success("Meal attributes saved");
      setSelectedMeal(null);
      await loadData();
    } catch (error) {
      console.error("Could not save meal qualification:", error);
      toast.error("Could not save meal review");
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout title="Health Programs" subtitle="Governance, meal attributes, and safety operations">
      <div className="space-y-5 bg-[#F6F8FB] p-3 text-[#020617] sm:p-5">
        <AdminWorkbenchHeader eyebrow="Governed support" title="Health program control" description="Publish only versioned, externally reviewed non-clinical support protocols. Raw customer check-ins are intentionally excluded." icon={HeartPulse} accent="#7C83F6" actions={<Button type="button" variant="outline" onClick={() => void loadData()} disabled={loading} className="min-h-11 rounded-lg border-[#E5EAF1] bg-white font-black"><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh</Button>} />
        <AdminKpiStrip items={[
          { label: "Review gates", value: `${approvedGates}/4`, helper: "Required to publish", icon: FileCheck2, accent: approvedGates === 4 ? "#22C7A1" : "#FB6B7A" },
          { label: "Qualified meals", value: qualifiedMeals, helper: "Versioned attributes", icon: FlaskConical, accent: "#38BDF8" },
          { label: "Enrollments", value: enrollmentCount, helper: "All program states", icon: Users, accent: "#7C83F6" },
          { label: "Urgent events", value: urgentEvents, helper: "Minimal safety codes", icon: ShieldAlert, accent: "#FB6B7A" },
        ]} />

        <div className="flex overflow-x-auto rounded-lg border border-[#E5EAF1] bg-white p-1">
          {([['governance','Governance'],['meals','Meal attributes'],['safety','Safety log']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={cn("min-h-11 flex-1 whitespace-nowrap rounded-md px-4 text-sm font-black", tab === value ? "bg-[#020617] text-white" : "text-[#64748B]")}>{label}</button>)}
        </div>

        {loading ? <div className="grid min-h-64 place-items-center rounded-lg bg-white"><Loader2 className="h-8 w-8 animate-spin text-[#7C83F6]" /></div> : tab === "governance" ? (
          <AdminPanel>
            <AdminPanelHeader title={currentProgram?.name ?? "No program"} eyebrow={`Protocol version ${currentVersion?.version ?? "-"}`} description={currentVersion?.review_note ?? "No protocol version"} actions={currentVersion?.status === "published" ? <span className="rounded-full bg-[#E9FBF6] px-3 py-2 text-xs font-black text-[#0A8F73]">Published</span> : <Button type="button" onClick={() => void publishVersion()} disabled={approvedGates !== 4} className="min-h-11 rounded-lg bg-[#7C83F6] font-black text-white"><ShieldCheck className="mr-2 h-4 w-4" />Publish protocol</Button>} />
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {gates.filter((gate) => gate.program_version_id === currentVersion?.id).map((gate) => { const copy = GATE_LABELS[gate.gate_type]; return <button key={gate.id} type="button" onClick={() => openGate(gate)} className="flex min-h-24 items-start gap-3 rounded-lg border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-left"><span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", gate.status === "approved" ? "bg-[#E9FBF6] text-[#22C7A1]" : gate.status === "rejected" ? "bg-[#FFF1F3] text-[#FB6B7A]" : "bg-white text-[#94A3B8]")}>{gate.status === "approved" ? <CheckCircle2 className="h-5 w-5" /> : <ClipboardCheck className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-black">{copy?.title ?? gate.gate_type}</span><span className="mt-1 block text-xs font-semibold leading-5 text-[#64748B]">{copy?.helper}</span><span className="mt-2 block text-[10px] font-extrabold uppercase text-[#94A3B8]">{gate.status}{gate.reviewer_name ? ` · ${gate.reviewer_name}` : ""}</span></span></button>; })}
            </div>
            <div className="border-t border-[#E5EAF1] bg-[#FFF8ED] p-4 text-sm font-semibold leading-6 text-[#6B5943]"><strong className="font-black text-[#020617]">Database enforced:</strong> changing the protocol to published fails unless all four gates have approved evidence.</div>
          </AdminPanel>
        ) : tab === "meals" ? (
          <AdminPanel>
            <AdminPanelHeader title="Measurable meal attributes" eyebrow="No GLP-1 friendly claim" description="Review only attributes supported by portion and nutrition data." />
            <div className="border-b border-[#E5EAF1] p-3"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search approved meals" className="h-11 rounded-lg border-[#E5EAF1] bg-[#F6F8FB] pl-10" /></div></div>
            <div className="grid gap-2 p-3 xl:grid-cols-2">
              {filteredMeals.map((meal) => { const qualification = qualifications.find((item) => item.program_version_id === currentVersion?.id && item.meal_id === meal.id); return <button key={meal.id} type="button" onClick={() => openMeal(meal)} className="flex min-h-20 items-center gap-3 rounded-lg border border-[#E5EAF1] bg-white p-3 text-left active:bg-[#F6F8FB]"><img src={meal.image_url || "/placeholder.svg"} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{meal.name}</span><span className="mt-1 block text-xs font-semibold text-[#64748B]">{meal.calories ?? "-"} kcal · {meal.protein_g ?? "-"}g protein · {meal.fiber_g ?? "-"}g fiber</span><span className="mt-1 block truncate text-[10px] font-extrabold uppercase text-[#94A3B8]">{qualification ? `${qualification.status} · ${qualification.attributes.map((item) => ATTRIBUTE_LABELS[item] ?? item).join(", ")}` : "Not reviewed"}</span></span><ChevronRight className="h-5 w-5 text-[#94A3B8]" /></button>; })}
            </div>
          </AdminPanel>
        ) : (
          <AdminPanel>
            <AdminPanelHeader title="Minimal safety event log" eyebrow="No raw check-in data" description="Only bounded rule codes and acknowledgement state are visible here." />
            {safetyEvents.length === 0 ? <div className="p-10 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#22C7A1]" /><p className="mt-3 font-black">No safety events recorded</p></div> : <div className="divide-y divide-[#E5EAF1]">{safetyEvents.map((event) => <div key={event.id} className="flex items-start gap-3 p-4"><span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", event.severity === "urgent" ? "bg-[#FFF1F3] text-[#FB6B7A]" : "bg-[#FFF8ED] text-[#F97316]")}><AlertTriangle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black capitalize">{event.severity.replace("_", " ")}</p><span className="rounded-full bg-[#F6F8FB] px-2 py-1 text-[10px] font-extrabold text-[#64748B]">{event.acknowledged_at ? "Acknowledged" : "Not acknowledged"}</span></div><p className="mt-1 text-xs font-semibold text-[#64748B]">{event.rule_codes.join(", ")}</p><p className="mt-1 text-[10px] font-bold text-[#94A3B8]">{new Date(event.created_at).toLocaleString()}</p></div></div>)}</div>}
          </AdminPanel>
        )}
      </div>

      <Dialog open={Boolean(selectedGate)} onOpenChange={(open) => !open && setSelectedGate(null)}><DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>{selectedGate ? GATE_LABELS[selectedGate.gate_type]?.title : "Review gate"}</DialogTitle><DialogDescription>Record an external reviewer and a traceable evidence reference. Every change is appended to the audit history.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid grid-cols-3 gap-2">{["pending","approved","rejected"].map((status) => <button key={status} type="button" onClick={() => setGateForm((current) => ({ ...current, status }))} className={cn("min-h-11 rounded-lg border text-sm font-black capitalize", gateForm.status === status ? "border-[#020617] bg-[#020617] text-white" : "border-[#E5EAF1]")}>{status}</button>)}</div><Input value={gateForm.reviewer} onChange={(event) => setGateForm((current) => ({ ...current, reviewer: event.target.value }))} placeholder="Reviewer name and credential" className="min-h-11 rounded-lg" /><Input value={gateForm.evidence} onChange={(event) => setGateForm((current) => ({ ...current, evidence: event.target.value }))} placeholder="Evidence reference or document ID" className="min-h-11 rounded-lg" /><Textarea value={gateForm.note} onChange={(event) => setGateForm((current) => ({ ...current, note: event.target.value }))} placeholder="Review note" className="min-h-24 rounded-lg" /><Button type="button" onClick={() => void saveGate()} disabled={saving || (gateForm.status !== "pending" && (!gateForm.reviewer.trim() || !gateForm.evidence.trim()))} className="min-h-12 w-full rounded-lg bg-[#020617] font-black text-white">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}Record review</Button></div></DialogContent></Dialog>

      <Dialog open={Boolean(selectedMeal)} onOpenChange={(open) => !open && setSelectedMeal(null)}><DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>{selectedMeal?.name}</DialogTitle><DialogDescription>Assign only attributes supported by the displayed nutrition and portion data.</DialogDescription></DialogHeader>{selectedMeal && <div className="space-y-4"><div className="grid grid-cols-4 gap-2 rounded-lg bg-[#F6F8FB] p-3 text-center">{[["kcal",selectedMeal.calories],["protein",selectedMeal.protein_g],["fiber",selectedMeal.fiber_g],["fat",selectedMeal.fat_g]].map(([label,value]) => <div key={String(label)}><p className="text-base font-black">{value ?? "-"}</p><p className="text-[10px] font-extrabold uppercase text-[#94A3B8]">{label}</p></div>)}</div><div className="grid grid-cols-2 gap-2">{ALL_ATTRIBUTES.map((attribute) => <label key={attribute} className="flex min-h-12 items-center gap-2 rounded-lg border border-[#E5EAF1] p-3"><Checkbox checked={mealForm.attributes.includes(attribute)} onCheckedChange={(checked) => setMealForm((current) => ({ ...current, attributes: checked ? [...current.attributes, attribute] : current.attributes.filter((item) => item !== attribute) }))} /><span className="text-xs font-black">{ATTRIBUTE_LABELS[attribute]}</span></label>)}</div><Textarea value={mealForm.rationale} onChange={(event) => setMealForm((current) => ({ ...current, rationale: event.target.value }))} placeholder="Why these attributes are supported" className="min-h-24 rounded-lg" /><div className="grid grid-cols-3 gap-2">{["review","eligible","rejected"].map((status) => <button key={status} type="button" onClick={() => setMealForm((current) => ({ ...current, status }))} className={cn("min-h-11 rounded-lg border text-sm font-black capitalize", mealForm.status === status ? "border-[#020617] bg-[#020617] text-white" : "border-[#E5EAF1]")}>{status}</button>)}</div><Button type="button" onClick={() => void saveMeal()} disabled={saving} className="min-h-12 w-full rounded-lg bg-[#7C83F6] font-black text-white">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Save meal review</Button></div>}</DialogContent></Dialog>
    </AdminLayout>
  );
}
