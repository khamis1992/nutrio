import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileWarning,
  Link2,
  Loader2,
  LockKeyhole,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  AdminDialogContent,
  AdminEmptyState,
  AdminPanel,
  AdminPanelHeader,
  AdminSheetContent,
} from "@/components/admin/AdminPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
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
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  formatSha256Checksum,
  verifyPreparedEvidencePackage,
} from "@/lib/security-incident-evidence";
import { cn } from "@/lib/utils";

type IncidentSeverity = "low" | "medium" | "high" | "critical";
type IncidentStatus = "open" | "investigating" | "contained" | "recovered" | "closed";

export type IncidentSeedEvent = {
  eventId: string;
  eventType: string;
  severity: string;
  occurredAt: string;
  nonce: number;
};

type SecurityIncident = {
  id: string;
  case_number: string;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  opened_by: string;
  assigned_to: string | null;
  detected_at: string;
  closed_at: string | null;
  external_reference: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  sealed_at?: string | null;
  sealed_by?: string | null;
  seal_hash?: string | null;
  seal_version?: number | null;
  evidence_count: number | string;
  timeline_count: number | string;
};

type IncidentDetail = {
  incident: SecurityIncident;
  timeline: Array<{
    id: string;
    sequence_number: number | string;
    action: string;
    note: string | null;
    actor_user_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
    previous_hash: string;
    event_hash: string;
    calculated_event_hash?: string;
    expected_previous_hash?: string;
    hash_matches?: boolean;
    previous_hash_matches?: boolean;
  }>;
  evidence: Array<{
    event_id: string;
    event_sequence: number | string;
    event_type: string;
    severity: string;
    outcome: string;
    occurred_at: string;
    ip_address: string | null;
    actor_user_id: string | null;
    request_id: string | null;
    session_fingerprint: string | null;
    event_hash_snapshot: string;
    current_event_hash: string;
    snapshot_matches: boolean;
    link_hash: string;
    calculated_link_hash?: string;
    calculated_event_hash?: string;
    link_hash_matches?: boolean;
    event_snapshot_matches?: boolean;
    event_hash_matches?: boolean;
  }>;
  custody?: Array<{
    id: string;
    custody_sequence: number | string;
    action: "export_prepared" | "transferred";
    package_sha256: string;
    byte_length: number | string | null;
    filename: string | null;
    recipient_type: string | null;
    external_reference: string | null;
    actor_user_id: string;
    created_at: string;
    previous_hash: string;
    custody_hash: string;
    hash_matches?: boolean;
    previous_hash_matches?: boolean;
  }>;
  integrity?: {
    valid: boolean;
    timeline_valid: boolean;
    evidence_valid: boolean;
    timeline_count: number | string;
    expected_timeline_count: number | string;
    timeline_hash_invalid_count: number | string;
    timeline_chain_invalid_count: number | string;
    evidence_count: number | string;
    expected_evidence_count: number | string;
    evidence_invalid_count: number | string;
    custody_valid?: boolean;
    custody_invalid_count?: number | string;
    seal_valid?: boolean;
  };
};

type RpcResponse = {
  data: unknown;
  error: { message: string } | null;
};

const severityClass: Record<IncidentSeverity, string> = {
  critical: "border-[#FB6B7A]/30 bg-[#FFF1F3] text-[#C92A42]",
  high: "border-[#F97316]/30 bg-[#FFF7ED] text-[#C2410C]",
  medium: "border-[#7C83F6]/30 bg-[#F2F1FF] text-[#5B61D9]",
  low: "border-[#38BDF8]/30 bg-[#EFFAFF] text-[#0284C7]",
};

const statusLabel: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  contained: "Contained",
  recovered: "Recovered",
  closed: "Closed",
};

async function callRpc<T>(name: string, parameters?: Record<string, unknown>): Promise<T> {
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>;
  const { data, error } = await invoke(name, parameters);
  if (error) throw new Error(error.message);
  return data as T;
}

function downloadFile(contents: BlobPart, type: string, filename: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function SecurityIncidentPanel({ seedEvent }: { seedEvent?: IncidentSeedEvent | null }) {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | IncidentStatus>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("high");
  const [initialEventId, setInitialEventId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [nextStatus, setNextStatus] = useState<IncidentStatus>("investigating");
  const [nextSeverity, setNextSeverity] = useState<IncidentSeverity>("high");
  const [investigationNote, setInvestigationNote] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [linkEventId, setLinkEventId] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [recipientType, setRecipientType] = useState("authority");
  const [transferReference, setTransferReference] = useState("");

  const loadIncidents = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const rows = await callRpc<SecurityIncident[]>("admin_list_security_incidents", {
        p_status: statusFilter === "all" ? null : statusFilter,
        p_limit: 100,
      });
      setIncidents(rows || []);
    } catch (error) {
      console.error("Failed to load security incidents", error);
      toast.error("Incident cases could not be loaded");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  const loadDetail = useCallback(async (incidentId: string) => {
    setDetailLoading(true);
    try {
      const value = await callRpc<IncidentDetail>("admin_get_security_incident", {
        p_incident_id: incidentId,
      });
      setDetail(value);
      setNextStatus(value.incident.status);
      setNextSeverity(value.incident.severity);
      setExternalReference(value.incident.external_reference || "");
    } catch (error) {
      console.error("Failed to load incident", error);
      toast.error("Incident details could not be loaded");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    if (!seedEvent) return;
    const normalizedSeverity = ["critical", "high", "medium", "low"].includes(
      seedEvent.severity,
    )
      ? (seedEvent.severity as IncidentSeverity)
      : "high";
    setTitle(`Investigate ${seedEvent.eventType.replace(/[._-]+/g, " ")}`.slice(0, 160));
    setSummary(
      `Security event ${seedEvent.eventId} occurred at ${seedEvent.occurredAt}. Review the sealed event, correlate request and provider records, and document containment decisions.`,
    );
    setSeverity(normalizedSeverity);
    setInitialEventId(seedEvent.eventId);
    setCreateOpen(true);
  }, [seedEvent]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [loadDetail, selectedId]);

  const counts = useMemo(() => ({
    active: incidents.filter((incident) => incident.status !== "closed").length,
    critical: incidents.filter(
      (incident) => incident.severity === "critical" && incident.status !== "closed",
    ).length,
  }), [incidents]);

  const createIncident = async () => {
    if (title.trim().length < 3 || summary.trim().length < 10) {
      toast.error("Add a clear title and investigation summary");
      return;
    }
    if (initialEventId && !/^[0-9a-f-]{36}$/i.test(initialEventId)) {
      toast.error("The linked event ID is invalid");
      return;
    }

    setCreating(true);
    try {
      const created = await callRpc<SecurityIncident>("admin_create_security_incident", {
        p_title: title.trim(),
        p_summary: summary.trim(),
        p_severity: severity,
        p_event_ids: initialEventId ? [initialEventId] : [],
      });
      toast.success(`${created.case_number} opened`);
      setCreateOpen(false);
      setTitle("");
      setSummary("");
      setInitialEventId("");
      await loadIncidents(true);
      setSelectedId(created.id);
    } catch (error) {
      console.error("Failed to create incident", error);
      toast.error(error instanceof Error ? error.message : "Incident could not be created");
    } finally {
      setCreating(false);
    }
  };

  const updateIncident = async () => {
    if (!detail) return;
    if (nextStatus === "closed" && investigationNote.trim().length < 10) {
      toast.error("A closure note of at least 10 characters is required");
      return;
    }
    setUpdating(true);
    try {
      await callRpc("admin_update_security_incident", {
        p_incident_id: detail.incident.id,
        p_status: nextStatus,
        p_severity: nextSeverity,
        p_assigned_to: null,
        p_note: investigationNote.trim() || null,
        p_external_reference: externalReference.trim() || null,
        p_expected_version: detail.incident.version,
      });
      toast.success("Incident timeline updated");
      setInvestigationNote("");
      await Promise.all([loadDetail(detail.incident.id), loadIncidents(true)]);
    } catch (error) {
      console.error("Failed to update incident", error);
      toast.error(error instanceof Error ? error.message : "Incident update failed");
    } finally {
      setUpdating(false);
    }
  };

  const linkEvidence = async () => {
    if (!detail || !/^[0-9a-f-]{36}$/i.test(linkEventId.trim())) {
      toast.error("Enter a valid security event ID");
      return;
    }
    setUpdating(true);
    try {
      await callRpc("admin_link_security_incident_event", {
        p_incident_id: detail.incident.id,
        p_event_id: linkEventId.trim(),
        p_note: linkNote.trim() || null,
        p_expected_version: detail.incident.version,
      });
      setLinkEventId("");
      setLinkNote("");
      toast.success("Sealed event linked to the case");
      await Promise.all([loadDetail(detail.incident.id), loadIncidents(true)]);
    } catch (error) {
      console.error("Failed to link evidence", error);
      toast.error(error instanceof Error ? error.message : "Evidence could not be linked");
    } finally {
      setUpdating(false);
    }
  };

  const exportPackage = async () => {
    if (!detail) return;
    setExporting(true);
    try {
      const response = await callRpc<unknown>("admin_prepare_security_incident_export", {
        p_incident_id: detail.incident.id,
        p_expected_version: detail.incident.version,
      });
      const prepared = await verifyPreparedEvidencePackage(response);
      downloadFile(prepared.content, prepared.media_type, prepared.filename);
      downloadFile(
        formatSha256Checksum(prepared.sha256, prepared.filename),
        "text/plain;charset=utf-8",
        `${prepared.filename}.sha256`,
      );
      await loadDetail(detail.incident.id);
      toast.success(
        prepared.integrity?.valid === false
          ? "Evidence preserved with an integrity warning and verified checksum"
          : "Server-prepared evidence package and verified checksum exported",
      );
    } catch (error) {
      console.error("Failed to export incident", error);
      toast.error("Evidence package could not be exported");
    } finally {
      setExporting(false);
    }
  };

  const sealIncident = async () => {
    if (!detail) return;
    setSealing(true);
    try {
      await callRpc("admin_seal_security_incident", {
        p_incident_id: detail.incident.id,
        p_expected_version: detail.incident.version,
      });
      toast.success("Incident sealed. Its final state can no longer be changed.");
      await Promise.all([loadDetail(detail.incident.id), loadIncidents(true)]);
    } catch (error) {
      console.error("Failed to seal incident", error);
      toast.error(error instanceof Error ? error.message : "Incident could not be sealed");
    } finally {
      setSealing(false);
    }
  };

  const recordEvidenceTransfer = async () => {
    if (!detail) return;
    const latestPackage = [...(detail.custody || [])]
      .reverse()
      .find((entry) => entry.action === "export_prepared");
    if (!latestPackage) {
      toast.error("Export an evidence package before recording a handoff");
      return;
    }
    if (transferReference.trim().length < 3) {
      toast.error("Add the receiving authority, archive, or provider reference");
      return;
    }
    setTransferring(true);
    try {
      await callRpc("admin_record_incident_evidence_transfer", {
        p_incident_id: detail.incident.id,
        p_package_sha256: latestPackage.package_sha256,
        p_recipient_type: recipientType,
        p_external_reference: transferReference.trim(),
      });
      setTransferReference("");
      toast.success("Evidence handoff added to the custody chain");
      await loadDetail(detail.incident.id);
    } catch (error) {
      console.error("Failed to record evidence transfer", error);
      toast.error(error instanceof Error ? error.message : "Evidence handoff could not be recorded");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <>
      <AdminPanel>
        <AdminPanelHeader
          eyebrow="Incident response"
          title="Investigation cases"
          description="Promote suspicious events into a documented, hash-chained case file."
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void loadIncidents(true)}
                disabled={refreshing}
                className="h-11 w-11 rounded-[14px]"
                aria-label="Refresh incident cases"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-11 rounded-[14px] bg-[#020617] px-4 font-black text-white hover:bg-[#172033]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Open case
              </Button>
            </div>
          }
        />

        <div className="grid gap-3 border-b border-[#E5EAF1] bg-[#F8FAFC] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap gap-2 text-xs font-bold text-[#64748B]">
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-[#E5EAF1]">
              {counts.active} active
            </span>
            <span className="rounded-full bg-[#FFF1F3] px-3 py-1.5 text-[#C92A42] ring-1 ring-[#FB6B7A]/25">
              {counts.critical} critical
            </span>
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | IncidentStatus)}
          >
            <SelectTrigger className="min-h-11 w-full rounded-[14px] bg-white sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cases</SelectItem>
              {Object.entries(statusLabel).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="grid min-h-32 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#22C7A1]" />
            </div>
          ) : incidents.length === 0 ? (
            <AdminEmptyState
              icon={CheckCircle2}
              title="No incident cases in this view"
              description="Suspicious events remain searchable above and can be promoted into a case when investigation is needed."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {incidents.map((incident) => (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => setSelectedId(incident.id)}
                  className="min-w-0 rounded-[16px] border border-[#E5EAF1] bg-white p-4 text-left transition hover:border-[#7C83F6]/35 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C83F6]"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border",
                      severityClass[incident.severity],
                    )}>
                      <FileWarning className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-[#64748B]">
                          {incident.case_number}
                        </span>
                        <Badge variant="outline" className={severityClass[incident.severity]}>
                          {incident.severity}
                        </Badge>
                        <Badge variant="outline" className="border-[#E5EAF1] bg-[#F6F8FB] text-[#475569]">
                          {statusLabel[incident.status]}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm font-black text-[#020617]">
                        {incident.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#64748B]">
                        {incident.summary}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold text-[#94A3B8]">
                        <span>{Number(incident.evidence_count)} evidence items</span>
                        <span>{Number(incident.timeline_count)} timeline entries</span>
                        <span>{formatDistanceToNow(new Date(incident.updated_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </AdminPanel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <AdminDialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#020617]">Open security case</DialogTitle>
            <DialogDescription>
              Record what triggered the investigation. The case and linked evidence become part of the custody trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="incident-title">Case title</Label>
              <Input
                id="incident-title"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, 160))}
                placeholder="Unauthorized admin access attempt"
                className="min-h-11 rounded-[14px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-summary">Initial assessment</Label>
              <Textarea
                id="incident-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value.slice(0, 5000))}
                placeholder="Describe what was observed, affected systems, and immediate actions."
                className="min-h-28 rounded-[14px]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={(value) => setSeverity(value as IncidentSeverity)}>
                  <SelectTrigger className="min-h-11 rounded-[14px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-event">Initial event ID (optional)</Label>
                <Input
                  id="incident-event"
                  value={initialEventId}
                  onChange={(event) => setInitialEventId(event.target.value.trim())}
                  placeholder="UUID from event ledger"
                  className="min-h-11 rounded-[14px] font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="min-h-11 rounded-[14px]">
              Cancel
            </Button>
            <Button
              onClick={() => void createIncident()}
              disabled={creating}
              className="min-h-11 rounded-[14px] bg-[#020617] font-black text-white"
            >
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
              Open case
            </Button>
          </DialogFooter>
        </AdminDialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <AdminSheetContent size="xl">
          {detailLoading && !detail ? (
            <div className="grid min-h-80 place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></div>
          ) : detail ? (
            <>
              <SheetHeader className="border-b border-[#E5EAF1] p-5 text-left">
                <div className="pr-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-black text-[#64748B]">{detail.incident.case_number}</span>
                    <Badge variant="outline" className={severityClass[detail.incident.severity]}>{detail.incident.severity}</Badge>
                    <Badge variant="outline">{statusLabel[detail.incident.status]}</Badge>
                    {detail.incident.sealed_at && (
                      <Badge className="border-[#22C7A1]/25 bg-[#EAFBF6] text-[#0B8F70]">
                        <LockKeyhole className="mr-1 h-3 w-3" /> Sealed
                      </Badge>
                    )}
                  </div>
                  <SheetTitle className="mt-2 text-xl font-black text-[#020617]">{detail.incident.title}</SheetTitle>
                  <SheetDescription className="mt-1 leading-5">{detail.incident.summary}</SheetDescription>
                </div>
              </SheetHeader>

              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void exportPackage()}
                    disabled={exporting}
                    className="min-h-11 rounded-[14px] bg-[#020617] font-black text-white"
                  >
                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export evidence
                  </Button>
                  {detail.incident.status === "closed" && !detail.incident.sealed_at && (
                    <Button
                      variant="outline"
                      onClick={() => void sealIncident()}
                      disabled={sealing || detail.evidence.length === 0 || detail.integrity?.valid !== true}
                      className="min-h-11 rounded-[14px] border-[#22C7A1]/35 font-black text-[#0B8F70]"
                    >
                      {sealing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                      Seal final case
                    </Button>
                  )}
                </div>

                {detail.incident.sealed_at && (
                  <div className="rounded-[16px] border border-[#22C7A1]/25 bg-[#EAFBF6] p-4">
                    <div className="flex items-start gap-3">
                      <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#0B8F70]" />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#020617]">Final case state is sealed</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                          No status, evidence, assignment, or timeline changes are allowed. New exports and their external handoffs remain append-only custody records.
                        </p>
                        <p className="mt-2 break-all font-mono text-[9px] text-[#0B8F70]">
                          {detail.incident.seal_hash}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "flex items-start gap-3 rounded-[16px] border p-4",
                    detail.integrity?.valid === true
                      ? "border-[#22C7A1]/25 bg-[#EAFBF6] text-[#0B8F70]"
                      : "border-[#FB6B7A]/30 bg-[#FFF1F3] text-[#A61B34]",
                  )}
                >
                  {detail.integrity?.valid === true ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-black">
                      {detail.integrity?.valid === true
                        ? "Case custody verified server-side"
                        : "Case custody integrity warning"}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 opacity-80">
                      {detail.integrity?.valid === true
                        ? "Every timeline, evidence, custody, and final case seal recomputes successfully."
                        : "One or more timeline or evidence values failed recomputation. Preserve provider records and investigate before relying on this case package."}
                    </p>
                  </div>
                </div>

                <AdminPanel>
                  <AdminPanelHeader title="Case controls" eyebrow={`Version ${detail.incident.version}`} />
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select disabled={Boolean(detail.incident.sealed_at)} value={nextStatus} onValueChange={(value) => setNextStatus(value as IncidentStatus)}>
                        <SelectTrigger className="min-h-11 rounded-[14px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select disabled={Boolean(detail.incident.sealed_at)} value={nextSeverity} onValueChange={(value) => setNextSeverity(value as IncidentSeverity)}>
                        <SelectTrigger className="min-h-11 rounded-[14px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="incident-reference">Authority or provider reference</Label>
                      <Input
                        id="incident-reference"
                        value={externalReference}
                        onChange={(event) => setExternalReference(event.target.value.slice(0, 300))}
                        placeholder="NCSA/Q-CERT ticket or provider case number"
                        disabled={Boolean(detail.incident.sealed_at)}
                        className="min-h-11 rounded-[14px]"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="incident-note">Investigation note</Label>
                      <Textarea
                        id="incident-note"
                        value={investigationNote}
                        onChange={(event) => setInvestigationNote(event.target.value.slice(0, 10000))}
                        placeholder="Record findings, containment steps, decisions, and handoffs."
                        disabled={Boolean(detail.incident.sealed_at)}
                        className="min-h-24 rounded-[14px]"
                      />
                    </div>
                    <Button
                      onClick={() => void updateIncident()}
                      disabled={updating || Boolean(detail.incident.sealed_at)}
                      className="min-h-11 rounded-[14px] bg-[#22C7A1] font-black text-[#020617] sm:col-span-2"
                    >
                      {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add to timeline
                    </Button>
                  </div>
                </AdminPanel>

                <AdminPanel>
                  <AdminPanelHeader title="Linked evidence" eyebrow={`${detail.evidence.length} sealed events`} />
                  <div className="space-y-3 p-4">
                    {!detail.incident.sealed_at && <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={linkEventId}
                        onChange={(event) => setLinkEventId(event.target.value.trim())}
                        placeholder="Security event UUID"
                        className="min-h-11 rounded-[14px] font-mono text-xs"
                      />
                      <Input
                        value={linkNote}
                        onChange={(event) => setLinkNote(event.target.value.slice(0, 2000))}
                        placeholder="Why this event is relevant"
                        className="min-h-11 rounded-[14px]"
                      />
                      <Button variant="outline" onClick={() => void linkEvidence()} disabled={updating} className="min-h-11 rounded-[14px]">
                        <Link2 className="mr-2 h-4 w-4" /> Link
                      </Button>
                    </div>}

                    {detail.evidence.length === 0 ? (
                      <p className="rounded-[14px] bg-[#F6F8FB] p-4 text-xs font-semibold text-[#64748B]">No events linked yet.</p>
                    ) : detail.evidence.map((event) => (
                      <div key={event.event_id} className="rounded-[14px] border border-[#E5EAF1] p-3">
                        <div className="flex items-start gap-3">
                          {event.snapshot_matches ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22C7A1]" />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FB6B7A]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-xs font-black text-[#020617]">{event.event_type}</p>
                            <p className="mt-1 text-[10px] font-bold text-[#94A3B8]">
                              #{String(event.event_sequence)} - {format(new Date(event.occurred_at), "MMM d, yyyy HH:mm:ss")} - {event.outcome}
                            </p>
                            {(event.actor_user_id || event.request_id || event.session_fingerprint) && (
                              <p className="mt-1 break-all font-mono text-[9px] text-[#64748B]">
                                {[event.actor_user_id, event.request_id, event.session_fingerprint]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            )}
                            <p className="mt-2 break-all font-mono text-[9px] text-[#64748B]">{event.event_hash_snapshot}</p>
                            {!event.snapshot_matches && (
                              <p className="mt-2 text-[10px] font-black text-[#C92A42]">
                                {[
                                  event.link_hash_matches === false && "link hash",
                                  event.event_snapshot_matches === false && "event snapshot",
                                  event.event_hash_matches === false && "event content seal",
                                ].filter(Boolean).join(", ")} verification failed
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AdminPanel>

                <AdminPanel>
                  <AdminPanelHeader title="Case timeline" eyebrow="Append-only hash chain" />
                  <div className="space-y-0 px-4 pb-4">
                    {detail.timeline.map((entry, index) => (
                      <div key={entry.id} className="relative flex gap-3 border-l border-[#DCE3EC] py-3 pl-5 first:pt-1 last:pb-1">
                        <span className={cn(
                          "absolute -left-1.5 top-4 h-3 w-3 rounded-full ring-4 ring-white",
                          entry.hash_matches === true && entry.previous_hash_matches === true
                            ? "bg-[#7C83F6]"
                            : "bg-[#FB6B7A]",
                        )} />
                        {entry.hash_matches === true && entry.previous_hash_matches === true ? (
                          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FB6B7A]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-black text-[#020617]">{entry.action.replace(/_/g, " ")}</p>
                            <span className="text-[9px] font-bold text-[#94A3B8]">{format(new Date(entry.created_at), "MMM d, HH:mm:ss")}</span>
                          </div>
                          {entry.note && <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5 text-[#64748B]">{entry.note}</p>}
                          <p className="mt-1 break-all font-mono text-[8px] text-[#CBD5E1]">chain {index + 1}: {entry.event_hash}</p>
                          {(entry.hash_matches !== true || entry.previous_hash_matches !== true) && (
                            <p className="mt-1 text-[10px] font-black text-[#C92A42]">
                              Server-side timeline recomputation failed
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AdminPanel>

                <AdminPanel>
                  <AdminPanelHeader
                    title="Evidence custody"
                    eyebrow={`${detail.custody?.length || 0} immutable records`}
                    description="Exports and external handoffs are chained independently from the sealed case."
                  />
                  <div className="space-y-3 p-4">
                    {(detail.custody || []).length === 0 ? (
                      <p className="rounded-[14px] bg-[#F6F8FB] p-4 text-xs font-semibold text-[#64748B]">
                        Export the first evidence package to begin its custody chain.
                      </p>
                    ) : (detail.custody || []).map((entry) => (
                      <div key={entry.id} className="rounded-[14px] border border-[#E5EAF1] p-3">
                        <div className="flex items-start gap-3">
                          {entry.hash_matches === true && entry.previous_hash_matches === true ? (
                            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#22C7A1]" />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FB6B7A]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-black text-[#020617]">
                                {entry.action === "export_prepared" ? "Evidence package prepared" : `Transferred to ${entry.recipient_type?.replace(/_/g, " ")}`}
                              </p>
                              <span className="text-[9px] font-bold text-[#94A3B8]">
                                {format(new Date(entry.created_at), "MMM d, HH:mm:ss")}
                              </span>
                            </div>
                            {entry.filename && <p className="mt-1 text-[10px] font-bold text-[#64748B]">{entry.filename} - {String(entry.byte_length)} bytes</p>}
                            {entry.external_reference && <p className="mt-1 text-[10px] font-bold text-[#64748B]">Reference: {entry.external_reference}</p>}
                            <p className="mt-2 break-all font-mono text-[9px] text-[#94A3B8]">SHA-256 {entry.package_sha256}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(detail.custody || []).some((entry) => entry.action === "export_prepared") && (
                      <div className="grid gap-2 border-t border-[#E5EAF1] pt-3 sm:grid-cols-[180px_1fr_auto]">
                        <Select value={recipientType} onValueChange={setRecipientType}>
                          <SelectTrigger className="min-h-11 rounded-[14px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="authority">Authority</SelectItem>
                            <SelectItem value="external_archive">External archive</SelectItem>
                            <SelectItem value="provider">Provider</SelectItem>
                            <SelectItem value="legal_counsel">Legal counsel</SelectItem>
                            <SelectItem value="internal_security">Internal security</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={transferReference}
                          onChange={(event) => setTransferReference(event.target.value.slice(0, 300))}
                          placeholder="Receipt, case, or archive object reference"
                          className="min-h-11 rounded-[14px]"
                        />
                        <Button
                          variant="outline"
                          onClick={() => void recordEvidenceTransfer()}
                          disabled={transferring}
                          className="min-h-11 rounded-[14px] font-black"
                        >
                          {transferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Record handoff
                        </Button>
                      </div>
                    )}
                  </div>
                </AdminPanel>

                <div className="rounded-[16px] border border-[#F59E0B]/25 bg-[#FFFBEB] p-4 text-xs font-semibold leading-5 text-[#92400E]">
                  IP addresses, user agents, and timestamps are correlation evidence, not proof of a person&apos;s identity. Preserve provider logs and involve Q-CERT/NCSA or law enforcement for attribution.
                </div>
              </div>
            </>
          ) : null}
        </AdminSheetContent>
      </Sheet>
    </>
  );
}
