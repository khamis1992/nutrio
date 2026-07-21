import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  FlaskConical,
  Loader2,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type ReviewDecision = "approved" | "needs_info" | "rejected";
type SampleOutcome = "pass" | "fail" | "inconclusive";

interface VerificationRequest {
  id: string;
  meal_id: string;
  meal_name: string;
  restaurant_name: string;
  tier: string;
  nutrition_version: number;
  evidence_reference: string | null;
  partner_notes: string | null;
  status: "pending" | "needs_info";
  created_at: string;
}

interface CurrentVerification {
  id: string;
  meal_id: string;
  meal_name: string;
  restaurant_name: string;
  tier: string;
  nutrition_version: number;
  public_summary: string;
  verified_at: string;
  expires_at: string;
  next_sample_due_at: string;
  is_expired: boolean;
  sample_due: boolean;
}

interface OperationsPayload {
  requests: VerificationRequest[];
  current: CurrentVerification[];
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult>;

function readOperations(value: unknown): OperationsPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { requests: [], current: [] };
  }
  const payload = value as Record<string, unknown>;
  return {
    requests: Array.isArray(payload.requests)
      ? (payload.requests as VerificationRequest[])
      : [],
    current: Array.isArray(payload.current)
      ? (payload.current as CurrentVerification[])
      : [],
  };
}

function tierLabel(tier: string) {
  if (tier === "dietitian_reviewed") return "Dietitian reviewed";
  if (tier === "lab_tested") return "Lab tested";
  return "Standardized recipe";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-QA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function NutritionVerificationOperations() {
  const [payload, setPayload] = useState<OperationsPayload>({ requests: [], current: [] });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reviewing, setReviewing] = useState<VerificationRequest | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>("approved");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState("90");
  const [operating, setOperating] = useState<CurrentVerification | null>(null);
  const [operation, setOperation] = useState<"sample" | "suspend">("sample");
  const [sampleOutcome, setSampleOutcome] = useState<SampleOutcome>("pass");
  const [operationNotes, setOperationNotes] = useState("");
  const [variance, setVariance] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await callRpc("admin_get_nutrition_verification_operations");
      if (error) throw new Error(error.message || "Could not load verification operations");
      setPayload(readOperations(data));
    } catch (error) {
      console.error("Could not load Nutrio Verified operations", error);
      toast.error("Could not load verification operations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(
    () => ({
      pending: payload.requests.filter((request) => request.status === "pending").length,
      needsInfo: payload.requests.filter((request) => request.status === "needs_info").length,
      current: payload.current.filter((verification) => !verification.is_expired).length,
      samplesDue: payload.current.filter((verification) => verification.sample_due).length,
    }),
    [payload],
  );

  const openReview = (request: VerificationRequest) => {
    setReviewing(request);
    setDecision("approved");
    setSummary("");
    setNotes("");
    setValidDays(request.tier === "lab_tested" ? "365" : request.tier === "dietitian_reviewed" ? "180" : "90");
  };

  const submitReview = async () => {
    if (!reviewing) return;
    setProcessing(true);
    try {
      const { error } = await callRpc("admin_review_meal_nutrition_verification", {
        p_request_id: reviewing.id,
        p_decision: decision,
        p_public_summary: decision === "approved" ? summary : null,
        p_review_notes: notes || null,
        p_valid_days: decision === "approved" ? Number(validDays) : null,
      });
      if (error) throw new Error(error.message || "Review failed");
      toast.success(decision === "approved" ? "Meal is Nutrio Verified" : "Review sent to partner");
      setReviewing(null);
      await refresh();
    } catch (error) {
      console.error("Could not review verification request", error);
      toast.error(error instanceof Error ? error.message : "Review failed");
    } finally {
      setProcessing(false);
    }
  };

  const submitOperation = async () => {
    if (!operating) return;
    setProcessing(true);
    try {
      const rpc = operation === "suspend"
        ? "admin_suspend_meal_nutrition_verification"
        : "admin_record_meal_nutrition_verification_sample";
      const args = operation === "suspend"
        ? { p_verification_id: operating.id, p_reason: operationNotes }
        : {
            p_verification_id: operating.id,
            p_outcome: sampleOutcome,
            p_observed_variance: variance.trim() ? { summary: variance.trim() } : {},
            p_notes: operationNotes,
          };
      const { error } = await callRpc(rpc, args);
      if (error) throw new Error(error.message || "Operation failed");
      toast.success(operation === "suspend" ? "Verification suspended" : "Sample recorded");
      setOperating(null);
      await refresh();
    } catch (error) {
      console.error("Could not update verification", error);
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="space-y-4 rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(2,6,23,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#ECFDF8] text-[#22C7A1]">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#22C7A1]">Trust operations</p>
            <h2 className="text-lg font-black text-[#020617]">Nutrio Verified</h2>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading} className="min-h-11 rounded-[14px]">
          <RefreshCw className={`me-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Pending review", stats.pending, "#7C83F6"],
          ["Needs info", stats.needsInfo, "#FB6B7A"],
          ["Current claims", stats.current, "#22C7A1"],
          ["Samples due", stats.samplesDue, "#38BDF8"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-[14px] bg-[#F6F8FB] p-3">
            <p className="text-[10px] font-black uppercase text-[#94A3B8]">{label}</p>
            <p className="mt-1 text-xl font-black" style={{ color: String(color) }}>{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid min-h-28 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#7C83F6]" /></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#020617]">Review queue</h3>
              <span className="text-xs font-bold text-[#94A3B8]">{payload.requests.length} requests</span>
            </div>
            <div className="space-y-2">
              {payload.requests.length === 0 ? (
                <p className="rounded-[14px] bg-[#F6F8FB] p-4 text-center text-xs font-bold text-[#94A3B8]">No verification requests.</p>
              ) : payload.requests.map((request) => (
                <article key={request.id} className="rounded-[16px] border border-[#E5EAF1] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#020617]">{request.meal_name}</p>
                      <p className="truncate text-xs font-bold text-[#94A3B8]">{request.restaurant_name} · v{request.nutrition_version}</p>
                    </div>
                    <span className="rounded-full bg-[#7C83F6]/10 px-2.5 py-1 text-[10px] font-black text-[#5B63D3]">{tierLabel(request.tier)}</span>
                  </div>
                  {request.evidence_reference && <p className="mt-2 truncate text-xs font-semibold text-[#64748B]">Evidence: {request.evidence_reference}</p>}
                  <Button type="button" onClick={() => openReview(request)} className="mt-3 min-h-11 w-full rounded-[14px] bg-[#020617] text-white">
                    <ClipboardCheck className="me-2 h-4 w-4" /> Review request
                  </Button>
                </article>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#020617]">Current and sampling</h3>
              <span className="text-xs font-bold text-[#94A3B8]">{payload.current.length} claims</span>
            </div>
            <div className="space-y-2">
              {payload.current.length === 0 ? (
                <p className="rounded-[14px] bg-[#F6F8FB] p-4 text-center text-xs font-bold text-[#94A3B8]">No active claims.</p>
              ) : payload.current.map((verification) => (
                <article key={verification.id} className="rounded-[16px] border border-[#E5EAF1] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#020617]">{verification.meal_name}</p>
                      <p className="truncate text-xs font-bold text-[#94A3B8]">{verification.restaurant_name} · {tierLabel(verification.tier)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${verification.sample_due ? "bg-[#FFF8ED] text-[#9A5700]" : "bg-[#ECFDF8] text-[#047857]"}`}>
                      {verification.sample_due ? "Sample due" : `Until ${formatDate(verification.expires_at)}`}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={() => { setOperating(verification); setOperation("sample"); setOperationNotes(""); }} className="min-h-11 rounded-[14px]">
                      <FlaskConical className="me-2 h-4 w-4 text-[#38BDF8]" /> Record sample
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setOperating(verification); setOperation("suspend"); setOperationNotes(""); }} className="min-h-11 rounded-[14px] text-[#B4233A]">
                      <PauseCircle className="me-2 h-4 w-4" /> Suspend
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="max-w-lg rounded-[24px]">
          <DialogHeader><DialogTitle>Review nutrition verification</DialogTitle></DialogHeader>
          {reviewing && <div className="space-y-4">
            <div className="rounded-[14px] bg-[#F6F8FB] p-3 text-sm font-black text-[#020617]">{reviewing.meal_name}<span className="block text-xs font-bold text-[#94A3B8]">{tierLabel(reviewing.tier)} · version {reviewing.nutrition_version}</span></div>
            <div className="space-y-2"><Label>Decision</Label><Select value={decision} onValueChange={(value: ReviewDecision) => setDecision(value)}><SelectTrigger className="min-h-11 rounded-[14px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approved">Approve</SelectItem><SelectItem value="needs_info">Request more information</SelectItem><SelectItem value="rejected">Reject</SelectItem></SelectContent></Select></div>
            {decision === "approved" && <>
              <div className="space-y-2"><Label>Customer-facing verification summary</Label><Textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={300} placeholder="Explain exactly what was verified." className="min-h-24 rounded-[14px]" /></div>
              <div className="space-y-2"><Label>Validity in days</Label><Input type="number" min={7} max={365} value={validDays} onChange={(event) => setValidDays(event.target.value)} className="min-h-11 rounded-[14px]" /></div>
            </>}
            <div className="space-y-2"><Label>{decision === "approved" ? "Private review notes" : "Reason for partner"}</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} className="min-h-24 rounded-[14px]" /></div>
          </div>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setReviewing(null)} className="min-h-11 rounded-[14px]">Cancel</Button><Button type="button" onClick={() => void submitReview()} disabled={processing || (decision === "approved" && summary.trim().length < 10) || (decision !== "approved" && notes.trim().length < 3)} className="min-h-11 rounded-[14px] bg-[#020617] text-white">{processing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="me-2 h-4 w-4" />}Save decision</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(operating)} onOpenChange={(open) => !open && setOperating(null)}>
        <DialogContent className="max-w-md rounded-[24px]">
          <DialogHeader><DialogTitle>{operation === "sample" ? "Record verification sample" : "Suspend verification"}</DialogTitle></DialogHeader>
          {operating && <div className="space-y-4">
            <div className="rounded-[14px] bg-[#F6F8FB] p-3 text-sm font-black text-[#020617]">{operating.meal_name}<span className="block text-xs font-bold text-[#94A3B8]"><CalendarClock className="me-1 inline h-3 w-3" />Expires {formatDate(operating.expires_at)}</span></div>
            {operation === "sample" && <><div className="space-y-2"><Label>Outcome</Label><Select value={sampleOutcome} onValueChange={(value: SampleOutcome) => setSampleOutcome(value)}><SelectTrigger className="min-h-11 rounded-[14px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pass">Pass</SelectItem><SelectItem value="fail">Fail and suspend</SelectItem><SelectItem value="inconclusive">Inconclusive</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Observed variance</Label><Input value={variance} onChange={(event) => setVariance(event.target.value)} placeholder="e.g. protein within 4%" className="min-h-11 rounded-[14px]" /></div></>}
            <div className="space-y-2"><Label>{operation === "sample" ? "Sample notes" : "Suspension reason"}</Label><Textarea value={operationNotes} onChange={(event) => setOperationNotes(event.target.value)} maxLength={1000} className="min-h-24 rounded-[14px]" /></div>
          </div>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOperating(null)} className="min-h-11 rounded-[14px]">Cancel</Button><Button type="button" onClick={() => void submitOperation()} disabled={processing || operationNotes.trim().length < 3} className="min-h-11 rounded-[14px] bg-[#020617] text-white">{processing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : operation === "sample" ? <FlaskConical className="me-2 h-4 w-4" /> : <PauseCircle className="me-2 h-4 w-4" />}Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
