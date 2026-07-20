import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Check, ClipboardCheck, Loader2 } from "lucide-react";
import {
  findActiveCareAssignment,
  getCareAssignmentWorkspace,
  openCareEscalation,
  resolveCareEscalation,
  reviewCarePlan,
} from "@/hooks/useCareTeam";

interface CareGovernancePanelProps {
  coachId: string;
  clientId: string;
  nutritionSnapshot: Record<string, unknown>;
}

type Workspace = Awaited<ReturnType<typeof getCareAssignmentWorkspace>>;

export function CareGovernancePanel({ coachId, clientId, nutritionSnapshot }: CareGovernancePanelProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rationale, setRationale] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const assignment = await findActiveCareAssignment(coachId, clientId);
      setWorkspace(assignment ? await getCareAssignmentWorkspace(assignment.id) : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load care workspace.");
    } finally {
      setLoading(false);
    }
  }, [clientId, coachId]);

  useEffect(() => { void load(); }, [load]);

  const submitReview = async (decision: "approved" | "changes_required") => {
    if (!workspace || rationale.trim().length < 10) return;
    setBusy(true);
    setError(null);
    try {
      await reviewCarePlan({
        assignmentId: workspace.assignment.id,
        planKind: "nutrition_goal",
        planVersion: 1,
        planSnapshot: nutritionSnapshot,
        decision,
        rationale: rationale.trim(),
      });
      setRationale("");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not record the review.");
    } finally {
      setBusy(false);
    }
  };

  const openEscalation = async () => {
    if (!workspace || summary.trim().length < 10) return;
    setBusy(true);
    setError(null);
    try {
      await openCareEscalation({
        assignmentId: workspace.assignment.id,
        category: "scope_question",
        severity: "high",
        summary: summary.trim(),
      });
      setSummary("");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not open the escalation.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex min-h-28 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#7C83F6]" /></div>;
  if (!workspace) return null;

  const openItems = workspace.escalations.filter((item) => item.status === "open" || item.status === "acknowledged");

  return (
    <section className="client-card bg-white p-5 ring-1 ring-[#E5EAF1]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#F3F4FF] text-[#7C83F6]"><BadgeCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">Care governance</p>
          <h2 className="mt-1 text-[16px] font-black text-[#020617]">Review and escalation</h2>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#94A3B8]">Every decision is scoped to this assignment and retained in the audit trail.</p>
        </div>
      </div>

      {workspace.assignment.assignment_type !== "fitness_coaching" && <div className="mt-4 border-t border-[#E5EAF1] pt-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-black text-[#020617]">Nutrition target review</p>
          <span className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[10px] font-black text-[#64748B]">{workspace.reviews.length} recorded</span>
        </div>
        <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={2000} placeholder="Document your rationale (minimum 10 characters)" className="mt-3 min-h-24 w-full resize-none rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-3 text-[12px] font-semibold text-[#020617] outline-none focus:border-[#7C83F6]" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy || rationale.trim().length < 10} onClick={() => void submitReview("approved")} className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-[#22C7A1] text-[12px] font-black text-white disabled:opacity-40"><Check className="h-4 w-4" />Approve</button>
          <button type="button" disabled={busy || rationale.trim().length < 10} onClick={() => void submitReview("changes_required")} className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-[#F3F4FF] text-[12px] font-black text-[#7C83F6] ring-1 ring-[#7C83F6]/20 disabled:opacity-40"><ClipboardCheck className="h-4 w-4" />Request changes</button>
        </div>
      </div>}

      <div className="mt-5 border-t border-[#E5EAF1] pt-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-black text-[#020617]">Escalations</p>
          <span className="rounded-full bg-[#FB6B7A]/10 px-2.5 py-1 text-[10px] font-black text-[#FB6B7A]">{openItems.length} open</span>
        </div>
        {openItems.map((item) => (
          <div key={item.id} className="mt-3 flex items-start gap-3 border-b border-[#E5EAF1] pb-3 last:border-0">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FB6B7A]" />
            <div className="min-w-0 flex-1"><p className="text-[12px] font-black text-[#020617]">{item.summary}</p><p className="mt-1 text-[10px] font-bold uppercase text-[#94A3B8]">{item.severity} · {item.status}</p></div>
            <button type="button" disabled={busy} onClick={() => void resolveCareEscalation(item.id, "acknowledge").then(load)} className="min-h-10 rounded-full bg-[#F6F8FB] px-3 text-[10px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">Acknowledge</button>
          </div>
        ))}
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={1000} placeholder="Describe a scope, safety, or handoff concern" className="mt-3 min-h-20 w-full resize-none rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-3 text-[12px] font-semibold text-[#020617] outline-none focus:border-[#FB6B7A]" />
        <button type="button" disabled={busy || summary.trim().length < 10} onClick={() => void openEscalation()} className="mt-2 min-h-11 w-full rounded-[14px] bg-[#020617] text-[12px] font-black text-white disabled:opacity-40">Open escalation</button>
      </div>
      {error && <p className="mt-3 rounded-[14px] bg-[#FB6B7A]/10 px-3 py-2 text-[11px] font-bold text-[#FB6B7A]">{error}</p>}
    </section>
  );
}
