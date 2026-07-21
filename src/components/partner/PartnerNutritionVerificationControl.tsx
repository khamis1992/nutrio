import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
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

export type VerificationTier =
  | "recipe_standardized"
  | "dietitian_reviewed"
  | "lab_tested";

export interface PartnerVerificationStatus {
  meal_id: string;
  nutrition_version: number;
  completeness_score: number;
  verification: {
    tier: VerificationTier;
    verified_at: string;
    expires_at: string;
    public_summary: string;
  } | null;
  latest_request: {
    id: string;
    tier: VerificationTier;
    status: "pending" | "needs_info" | "approved" | "rejected" | "withdrawn" | "superseded";
    nutrition_version: number;
    review_notes: string | null;
    created_at: string;
  } | null;
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult>;

function isStatus(value: unknown): value is PartnerVerificationStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.meal_id === "string" && typeof row.nutrition_version === "number";
}

export function usePartnerNutritionVerificationStatuses(enabled: boolean) {
  const [statuses, setStatuses] = useState<PartnerVerificationStatus[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await callRpc(
      "partner_list_meal_nutrition_verification_statuses",
    );
    if (error) {
      console.error("Could not load partner verification statuses", error.message);
      return;
    }
    setStatuses(Array.isArray(data) ? data.filter(isStatus) : []);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byMeal = useMemo(
    () => new Map(statuses.map((status) => [status.meal_id, status])),
    [statuses],
  );
  return { byMeal, refresh };
}

const tierCopy: Record<VerificationTier, string> = {
  recipe_standardized: "Standardized recipe",
  dietitian_reviewed: "Dietitian reviewed",
  lab_tested: "Lab tested",
};

export function PartnerNutritionVerificationControl({
  mealId,
  mealName,
  nutritionVersion,
  completenessScore,
  sourceReference,
  status,
  onChanged,
}: {
  mealId: string;
  mealName: string;
  nutritionVersion: number;
  completenessScore: number;
  sourceReference: string;
  status?: PartnerVerificationStatus;
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<VerificationTier>("recipe_standardized");
  const [evidence, setEvidence] = useState(sourceReference);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status?.verification) {
    return (
      <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#ECFDF8] px-3 text-xs font-black text-[#047857]">
        <BadgeCheck className="h-3.5 w-3.5" /> Nutrio Verified
      </span>
    );
  }

  const request = status?.latest_request;
  if (request?.status === "pending") {
    return (
      <span
        className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#7C83F6]/10 px-3 text-xs font-black text-[#5B63D3]"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Verification pending
      </span>
    );
  }

  const eligible = completenessScore >= 100 && sourceReference.trim().length > 0;

  const submit = async () => {
    if (!eligible) return;
    setSubmitting(true);
    try {
      const isResubmission = request?.status === "needs_info";
      const { error } = await callRpc(
        isResubmission
          ? "resubmit_meal_nutrition_verification_request"
          : "request_meal_nutrition_verification",
        isResubmission
          ? {
              p_request_id: request.id,
              p_evidence_reference: evidence,
              p_partner_notes: notes || null,
            }
          : {
              p_meal_id: mealId,
              p_tier: tier,
              p_evidence_reference: evidence,
              p_partner_notes: notes || null,
            },
      );
      if (error) throw new Error(error.message || "Verification request failed");
      toast.success(isResubmission ? "Verification information resubmitted" : "Verification request sent");
      setOpen(false);
      await onChanged();
    } catch (error) {
      console.error("Could not request Nutrio verification", error);
      toast.error(error instanceof Error ? error.message : "Could not send request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!eligible}
        title={eligible ? "Request Nutrio verification" : "Complete nutrition data and its source first"}
        className={`inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-xs font-black disabled:opacity-55 ${
          request?.status === "needs_info"
            ? "bg-[#FFF8ED] text-[#9A5700]"
            : "bg-[#F6F8FB] text-[#64748B]"
        }`}
      >
        <ShieldCheck className="h-3.5 w-3.5 text-[#22C7A1]" />
        {request?.status === "needs_info" ? "More info needed" : "Verify nutrition"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-[24px] border-[#E5EAF1] bg-white text-[#020617]">
          <DialogHeader>
            <DialogTitle>Verify {mealName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-[16px] bg-[#F6F8FB] p-3 text-xs font-bold text-[#64748B]">
              Nutrition version {nutritionVersion} · {completenessScore}% complete
            </div>
            {request?.status === "needs_info" && request.review_notes && (
              <div className="rounded-[16px] bg-[#FFF8ED] p-3 text-xs font-bold text-[#9A5700]">
                Reviewer: {request.review_notes}
              </div>
            )}
            {request?.status !== "needs_info" && <div className="space-y-2">
              <Label>Verification level</Label>
              <Select value={tier} onValueChange={(value: VerificationTier) => setTier(value)}>
                <SelectTrigger className="min-h-11 rounded-[14px] bg-[#F6F8FB]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tierCopy).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
            <div className="space-y-2">
              <Label htmlFor={`verification-evidence-${mealId}`}>Evidence reference</Label>
              <Input
                id={`verification-evidence-${mealId}`}
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                placeholder="Recipe, label, dietitian, or lab reference"
                className="min-h-11 rounded-[14px] bg-[#F6F8FB]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`verification-notes-${mealId}`}>Notes for reviewer</Label>
              <Textarea
                id={`verification-notes-${mealId}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={1000}
                className="min-h-24 rounded-[14px] bg-[#F6F8FB]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="min-h-11 rounded-[14px]">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !eligible || (tier !== "recipe_standardized" && evidence.trim().length < 3)}
              className="min-h-11 rounded-[14px] bg-[#020617] text-white"
            >
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="me-2 h-4 w-4" />}
              {request?.status === "needs_info" ? "Resubmit information" : "Send for review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
