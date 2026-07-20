import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, Loader2, Users, AlertCircle, BadgeCheck, ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminEmptyState,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { reviewCareProfessionalApplication } from "@/hooks/useCareTeam";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  bio: string;
  specialties: string[];
  qualifications: string | null;
  status: string;
  created_at: string;
  professional_type: "dietitian" | "fitness_coach" | "wellness_coach";
  license_authority: string | null;
  license_number: string | null;
  license_jurisdiction: string;
  license_expires_on: string | null;
  requested_scope: string | null;
  languages: string[];
}

const ACTION_OPTIONS = [
  ["view_macros", "Macros"],
  ["view_weight", "Weight"],
  ["view_hydration", "Hydration"],
  ["view_meal_adherence", "Meal adherence"],
  ["view_workouts", "Workouts"],
  ["view_health_context", "Health context"],
  ["view_labs", "Lab reports"],
  ["view_meal_response", "Meal response"],
  ["approve_nutrition_plan", "Approve nutrition plans"],
  ["approve_training_plan", "Approve training plans"],
  ["send_guidance", "Secure guidance"],
  ["schedule_sessions", "Schedule sessions"],
] as const;

type ReviewDecision = "approved" | "needs_info" | "rejected";

export default function AdminCoachApprovals() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>("approved");
  const [displayTitle, setDisplayTitle] = useState("");
  const [scopeStatement, setScopeStatement] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [allowedActions, setAllowedActions] = useState<string[]>([]);
  const [responseSlaHours, setResponseSlaHours] = useState(24);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data: apps } = await supabase
        .from("coach_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (!apps?.length) {
        setApplications([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(apps.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      // Get emails via auth admin (may fail without admin rights, fallback gracefully)
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      setApplications(
        (apps as unknown as Application[]).map((a) => ({
          id: a.id,
          user_id: a.user_id,
          full_name: profileMap.get(a.user_id)?.full_name || "Unknown",
          email: null,
          bio: a.bio || "",
          specialties: a.specialties || [],
          qualifications: a.qualifications,
          status: a.status,
          created_at: a.created_at,
          professional_type: a.professional_type || "wellness_coach",
          license_authority: a.license_authority,
          license_number: a.license_number,
          license_jurisdiction: a.license_jurisdiction || "QA",
          license_expires_on: a.license_expires_on,
          requested_scope: a.requested_scope,
          languages: a.languages || ["en"],
        })),
      );
    } catch (err) {
      console.error("Error fetching coach applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const openReview = (app: Application, nextDecision: ReviewDecision) => {
    const nutrition = app.professional_type === "dietitian";
    setReviewing(app);
    setDecision(nextDecision);
    setDisplayTitle(nutrition ? "Licensed Dietitian" : app.professional_type === "fitness_coach" ? "Verified Fitness Coach" : "Verified Wellness Coach");
    setScopeStatement(app.requested_scope || "");
    setAdminNote("");
    setResponseSlaHours(24);
    setAllowedActions(nutrition
      ? ["view_macros", "view_weight", "view_hydration", "view_meal_adherence", "view_health_context", "view_labs", "view_meal_response", "approve_nutrition_plan", "send_guidance", "schedule_sessions"]
      : ["view_macros", "view_weight", "view_hydration", "view_meal_adherence", "view_workouts", "approve_training_plan", "send_guidance", "schedule_sessions"]);
  };

  const submitReview = async () => {
    if (!reviewing) return;
    setProcessingId(reviewing.id);
    try {
      await reviewCareProfessionalApplication({
        applicationId: reviewing.id,
        decision,
        displayTitle: displayTitle.trim(),
        scopeStatement: scopeStatement.trim(),
        allowedActions,
        adminNote: adminNote.trim(),
        responseSlaMinutes: responseSlaHours * 60,
        escalationSlaMinutes: Math.max(responseSlaHours * 120, 60),
      });

      toast({
        title: decision === "approved" ? "Professional verified" : decision === "needs_info" ? "More information requested" : "Application rejected",
        description: `${reviewing.full_name}'s application was updated atomically.`,
      });
      setApplications((prev) =>
        prev.map((app) => (app.id === reviewing.id ? { ...app, status: decision } : app)),
      );
      setReviewing(null);
    } catch (err) {
      toast({
        title: "Failed",
        description:
          err instanceof Error ? err.message : "Could not record this review.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const pending = applications.filter((a) => a.status === "pending");
  const processed = applications.filter((a) => a.status !== "pending");

  if (loading) {
    return (
      <AdminLayout
        title="Coach Applications"
        subtitle="Review coach applicants and approve qualified profiles"
      >
        <div className="flex h-96 items-center justify-center bg-[#F6F8FB]">
          <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Coach Applications"
      subtitle={`${pending.length} pending review`}
    >
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Coach control"
          title="Coach application review"
          icon={Users}
          accent="#22C7A1"
          description="Review applicant profiles, specialties, qualifications, and approve qualified coaches for the coaching marketplace."
          meta={[
            { label: "Pending review", value: pending.length },
            { label: "Total applications", value: applications.length },
            {
              label: "Approved",
              value: applications.filter((app) => app.status === "approved")
                .length,
            },
          ]}
        />

        {applications.length === 0 ? (
          <AdminEmptyState
            icon={Users}
            title="No applications"
            description="Coach applications will appear here for review."
          />
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <AdminPanel className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-[#FB6B7A]" />
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Pending ({pending.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {pending.map((app) => (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 rounded-[26px] bg-[#F6F8FB] p-5 shadow-[0_10px_26px_rgba(2,6,23,0.035)] ring-1 ring-[#E5EAF1] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_38px_rgba(2,6,23,0.065)]"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <h3 className="text-lg font-black text-[#020617]">
                            {app.full_name}
                          </h3>
                          <p className="text-xs font-semibold text-[#94A3B8]">
                            Applied{" "}
                            {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openReview(app, "approved")}
                            disabled={processingId === app.id}
                            className="flex min-h-11 items-center gap-1 rounded-full border border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 text-xs font-black text-[#020617] transition-opacity hover:bg-[#22C7A1]/15 disabled:opacity-50"
                          >
                            {processingId === app.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => openReview(app, "rejected")}
                            disabled={processingId === app.id}
                            className="flex min-h-11 items-center gap-1 rounded-full border border-[#FB6B7A]/20 bg-white px-4 text-xs font-black text-[#FB6B7A] transition-colors hover:bg-[#FB6B7A]/10 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                      <p className="rounded-2xl bg-white p-4 text-sm font-medium leading-6 text-[#020617]">
                        {app.bio}
                      </p>
                      {app.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {app.specialties.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-[#7C83F6]/10 px-2.5 py-1 text-[10px] font-black text-[#7C83F6]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {app.qualifications && (
                        <p className="rounded-2xl bg-white px-4 py-3 text-xs font-semibold italic text-[#94A3B8]">
                          {app.qualifications}
                        </p>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E5EAF1]">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Credential</p>
                          <p className="mt-2 text-sm font-black text-[#020617]">{app.license_authority || "Missing authority"}</p>
                          <p className="mt-1 text-xs font-semibold text-[#64748B]">{app.license_number || "Missing number"} · {app.license_jurisdiction}</p>
                          <p className="mt-1 text-xs font-semibold text-[#64748B]">Expires {app.license_expires_on ? new Date(app.license_expires_on).toLocaleDateString() : "not provided"}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E5EAF1]">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Requested scope</p>
                          <p className="mt-2 text-xs font-semibold leading-5 text-[#020617]">{app.requested_scope || "No scope statement provided."}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AdminPanel>
            )}

            {/* Processed */}
            {processed.length > 0 && (
              <AdminPanel className="p-5">
                <h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Processed
                </h2>
                <div className="space-y-2">
                  {processed.map((app) => (
                    <div
                      key={app.id}
                      className="flex flex-col gap-3 rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-[#020617]">
                          {app.full_name}
                        </h3>
                        <p className="text-xs font-medium text-[#94A3B8]">
                          {new Date(app.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${
                          app.status === "approved"
                            ? "bg-[#22C7A1]/10 text-[#22C7A1]"
                            : "bg-[#FB6B7A]/10 text-[#FB6B7A]"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              </AdminPanel>
            )}
          </>
        )}
      </div>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-[28px] border-[#E5EAF1] bg-white text-[#020617]">
          <DialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#22C7A1]/10 text-[#22C7A1]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <DialogTitle className="pt-2 text-xl font-black">Credential review</DialogTitle>
            <DialogDescription className="font-semibold text-[#64748B]">
              Record a traceable decision. Approval grants only the actions selected below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {(["approved", "needs_info", "rejected"] as ReviewDecision[]).map((value) => (
                <button key={value} type="button" onClick={() => setDecision(value)} className={cn("min-h-11 rounded-[14px] px-2 text-[11px] font-black ring-1", decision === value ? "bg-[#020617] text-white ring-[#020617]" : "bg-[#F6F8FB] text-[#64748B] ring-[#E5EAF1]")}>{value.replace("_", " ")}</button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="care-title">Public title</Label><Input id="care-title" value={displayTitle} onChange={(event) => setDisplayTitle(event.target.value)} className="min-h-11 rounded-[14px]" /></div>
              <div className="space-y-2"><Label htmlFor="care-sla">Response SLA (hours)</Label><Input id="care-sla" type="number" min={1} max={72} value={responseSlaHours} onChange={(event) => setResponseSlaHours(Number(event.target.value))} className="min-h-11 rounded-[14px]" /></div>
            </div>

            <div className="space-y-2"><Label htmlFor="care-scope">Approved scope statement</Label><Textarea id="care-scope" value={scopeStatement} onChange={(event) => setScopeStatement(event.target.value)} rows={4} className="resize-none rounded-[14px]" /></div>

            {decision === "approved" && (
              <div className="space-y-2">
                <Label>Allowed actions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTION_OPTIONS.map(([value, label]) => {
                    const active = allowedActions.includes(value);
                    return <button key={value} type="button" onClick={() => setAllowedActions((current) => active ? current.filter((item) => item !== value) : [...current, value])} className={cn("min-h-11 rounded-[14px] px-3 text-left text-[11px] font-black ring-1", active ? "bg-[#7C83F6]/10 text-[#5B63DD] ring-[#7C83F6]/25" : "bg-[#F6F8FB] text-[#94A3B8] ring-[#E5EAF1]")}><BadgeCheck className="mr-1.5 inline h-3.5 w-3.5" />{label}</button>;
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2"><Label htmlFor="care-note">Review note</Label><Textarea id="care-note" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Evidence checked, missing information, or reason for rejection" rows={3} className="resize-none rounded-[14px]" /></div>

            <button type="button" onClick={() => void submitReview()} disabled={Boolean(processingId) || (decision === "approved" && (displayTitle.trim().length < 3 || scopeStatement.trim().length < 20 || allowedActions.length === 0)) || (decision !== "approved" && adminNote.trim().length < 3)} className="min-h-12 w-full rounded-[16px] bg-[#020617] text-sm font-black text-white shadow-[0_12px_28px_rgba(2,6,23,0.16)] disabled:opacity-40">
              {processingId ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : <><Check className="mr-2 inline h-4 w-4" />Record decision</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
