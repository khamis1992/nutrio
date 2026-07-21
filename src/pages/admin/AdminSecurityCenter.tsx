import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Database,
  ExternalLink,
  FileScan,
  FileJson,
  FileSpreadsheet,
  Fingerprint,
  Globe2,
  Hash,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiStrip,
  AdminListSkeleton,
  AdminPanel,
  AdminPanelHeader,
  AdminSheetContent,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import {
  SecurityIncidentPanel,
  type IncidentSeedEvent,
} from "@/components/admin/SecurityIncidentPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";
import {
  formatSha256Checksum,
  verifyPreparedEvidencePackage,
} from "@/lib/security-incident-evidence";
import { cn } from "@/lib/utils";

type SecuritySeverity = "info" | "low" | "medium" | "high" | "critical";
type TimeRange = "24h" | "7d" | "30d" | "90d";
type NumericValue = number | string;

type SecurityEvent = {
  sequence_number: NumericValue;
  event_id: string;
  occurred_at: string;
  event_type: string;
  category: string;
  severity: SecuritySeverity;
  source: string;
  outcome: string;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_type: string;
  action: string | null;
  resource_type: string | null;
  resource_id: string | null;
  request_id: string | null;
  correlation_id: string | null;
  session_fingerprint: string | null;
  ip_address: string | null;
  country_code: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  previous_hash: string;
  event_hash: string;
  evidence_signature: string | null;
  signature_key_id: string | null;
  total_count: NumericValue;
};

type SecurityOverview = {
  total?: NumericValue;
  critical?: NumericValue;
  high?: NumericValue;
  denied_or_blocked?: NumericValue;
  failures?: NumericValue;
  unique_ips?: NumericValue;
  last_event_at?: string | null;
  latest_anchor?: {
    anchor_date?: string;
    anchor_hash?: string;
    last_sequence?: NumericValue;
    last_hash?: string;
    event_count?: NumericValue;
    external_receipt_count?: NumericValue;
    legacy_receipt_count?: NumericValue;
    latest_receipt_at?: string | null;
    receipt_fresh?: boolean;
    anchor_fresh?: boolean;
  } | null;
};

type IntegrityResult = {
  valid: boolean;
  checked: NumericValue;
  invalid_count?: NumericValue;
  event_invalid_count?: NumericValue;
  anchor_invalid_count?: NumericValue;
  anchor_state_invalid_count?: NumericValue;
  receipt_invalid_count?: NumericValue;
  anchors_checked?: NumericValue;
  anchor_ranges_checked?: NumericValue;
  complete?: boolean;
  verification_scope?: "full" | "bounded";
  total_events?: NumericValue;
  requested_limit?: NumericValue;
  historical_unanchored_count?: NumericValue;
  first_invalid_receipt?: string | null;
  first_invalid_sequence?: NumericValue | null;
  first_invalid_anchor?: string | null;
  start_sequence?: NumericValue;
  end_sequence?: NumericValue;
  anchored_through_sequence?: NumericValue | null;
  unanchored_count?: NumericValue;
  coverage?: "empty" | "unanchored" | "partially_anchored" | "fully_anchored" | "invalid";
};

type PostureStatus = "pass" | "warning" | "fail";

type SecurityPostureCheck = {
  id: string;
  label: string;
  status: PostureStatus;
  count: NumericValue;
  summary: string;
  items: unknown[];
};

type SecurityPosture = {
  generated_at: string;
  release_version?: string;
  status: "healthy" | "review" | "action_required";
  failure_count: NumericValue;
  warning_count: NumericValue;
  checks: SecurityPostureCheck[];
};

type RpcResponse = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

const PAGE_SIZE = 100;

const severityStyles: Record<
  SecuritySeverity,
  { label: string; className: string; iconClassName: string }
> = {
  critical: {
    label: "Critical",
    className: "border-[#FB6B7A]/35 bg-[#FFF1F3] text-[#C92A42]",
    iconClassName: "bg-[#FFF1F3] text-[#FB6B7A] ring-[#FB6B7A]/25",
  },
  high: {
    label: "High",
    className: "border-[#F97316]/30 bg-[#FFF7ED] text-[#C2410C]",
    iconClassName: "bg-[#FFF7ED] text-[#F97316] ring-[#F97316]/25",
  },
  medium: {
    label: "Medium",
    className: "border-[#7C83F6]/30 bg-[#F2F1FF] text-[#5B61D9]",
    iconClassName: "bg-[#F2F1FF] text-[#7C83F6] ring-[#7C83F6]/25",
  },
  low: {
    label: "Low",
    className: "border-[#38BDF8]/30 bg-[#EFFAFF] text-[#0284C7]",
    iconClassName: "bg-[#EFFAFF] text-[#38BDF8] ring-[#38BDF8]/25",
  },
  info: {
    label: "Info",
    className: "border-[#E5EAF1] bg-[#F6F8FB] text-[#64748B]",
    iconClassName: "bg-[#F6F8FB] text-[#94A3B8] ring-[#E5EAF1]",
  },
};

const rangeLabels: Record<TimeRange, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

async function callAdminRpc<T>(
  functionName: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    parameters?: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>;
  const { data, error } = await invoke(functionName, args);

  if (error) throw new Error(error.message);
  return data as T;
}

function toNumber(value: NumericValue | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function getRangeStart(range: TimeRange) {
  const now = Date.now();
  const durations: Record<TimeRange, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  return new Date(now - durations[range]).toISOString();
}

function humanize(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : format(date, "MMM d, yyyy · HH:mm:ss");
}

function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DetailField({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  copyable?: boolean;
}) {
  const shownValue = value || "Not captured";

  const copyValue = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="min-w-0 border-b border-[#E5EAF1] py-3 last:border-b-0">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
        {label}
      </p>
      <div className="mt-1 flex items-start gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 break-all text-sm font-bold text-[#020617]",
            mono && "font-mono text-xs leading-5",
            !value && "text-[#94A3B8]",
          )}
        >
          {shownValue}
        </p>
        {copyable && value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={copyValue}
            className="h-9 w-9 shrink-0 rounded-[12px] text-[#64748B] hover:bg-[#F6F8FB]"
            aria-label={`Copy ${label}`}
          >
            <ClipboardCopy className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

const postureTone: Record<PostureStatus, { label: string; className: string }> = {
  pass: {
    label: "Protected",
    className: "border-[#22C7A1]/25 bg-[#EAFBF6] text-[#0B8F70]",
  },
  warning: {
    label: "Review",
    className: "border-[#F59E0B]/25 bg-[#FFF8E8] text-[#A16207]",
  },
  fail: {
    label: "Action required",
    className: "border-[#FB6B7A]/30 bg-[#FFF1F3] text-[#C92A42]",
  },
};

function postureIcon(checkId: string) {
  if (checkId.includes("storage") || checkId.includes("upload")) return FileScan;
  if (checkId.includes("rls") || checkId.includes("definer")) return Database;
  return LockKeyhole;
}

function SecurityPosturePanel({ posture }: { posture: SecurityPosture | null }) {
  if (!posture) return null;

  const overall = posture.status === "healthy"
    ? { label: "Controls healthy", className: postureTone.pass.className }
    : posture.status === "review"
      ? { label: "Review recommended", className: postureTone.warning.className }
      : { label: "Action required", className: postureTone.fail.className };

  return (
    <AdminPanel>
      <AdminPanelHeader
        eyebrow="Live control validation"
        title="Security posture"
        description={`Checked ${formatTimestamp(posture.generated_at)}${
          posture.release_version ? ` · Controls ${posture.release_version}` : ""
        }`}
        actions={
          <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-xs font-black", overall.className)}>
            {overall.label}
          </span>
        }
      />
      <div className="grid md:grid-cols-2">
        {posture.checks.map((check) => {
          const tone = postureTone[check.status];
          const Icon = postureIcon(check.id);
          const details = (check.items || []).slice(0, 2).map((item) =>
            typeof item === "string" ? item : JSON.stringify(item),
          );

          return (
            <div
              key={check.id}
              className="flex min-w-0 gap-3 border-b border-[#E5EAF1] p-4 last:border-b-0 md:odd:border-r"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-black text-[#020617]">{check.label}</p>
                  <span className={cn("rounded-full border px-2 py-1 text-[10px] font-black", tone.className)}>
                    {tone.label}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                  {check.summary}
                </p>
                {details.length > 0 && (
                  <p className="mt-1 truncate font-mono text-[10px] text-[#94A3B8]" title={details.join(" · ")}>
                    {details.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AdminPanel>
  );
}

export default function AdminSecurityCenter() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [overview, setOverview] = useState<SecurityOverview>({});
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [incidentSeedEvent, setIncidentSeedEvent] = useState<IncidentSeedEvent | null>(null);
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [range, setRange] = useState<TimeRange>("7d");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalCount = events.length ? toNumber(events[0].total_count) : 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const buildSearchArgs = useCallback(
    (offset: number, limit: number) => ({
      p_severity: severity === "all" ? null : severity,
      p_category: category === "all" ? null : category,
      p_outcome: outcome === "all" ? null : outcome,
      p_search: search.trim() || null,
      p_from: getRangeStart(range),
      p_to: new Date().toISOString(),
      p_limit: limit,
      p_offset: offset,
    }),
    [category, outcome, range, search, severity],
  );

  const loadSecurityData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [eventRows, overviewData, integrityData, postureData] = await Promise.all([
          callAdminRpc<SecurityEvent[]>(
            "admin_search_security_events",
            buildSearchArgs(page * PAGE_SIZE, PAGE_SIZE),
          ),
          callAdminRpc<SecurityOverview>("admin_security_overview", {
            p_since: getRangeStart(range),
          }),
          callAdminRpc<IntegrityResult>("admin_verify_security_event_chain", {
            p_limit: 0,
          }),
          callAdminRpc<SecurityPosture>("admin_security_posture").catch((postureError) => {
            console.error("Security posture checks are unavailable:", postureError);
            return null;
          }),
        ]);

        setEvents(eventRows || []);
        setOverview(overviewData || {});
        setIntegrity(integrityData || null);
        setPosture(postureData);
      } catch (loadError) {
        console.error("Failed to load security center:", loadError);
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Security data could not be loaded";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildSearchArgs, page, range],
  );

  useEffect(() => {
    void loadSecurityData();
  }, [loadSecurityData]);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const activeFilterCount = useMemo(
    () =>
      [severity, category, outcome].filter((value) => value !== "all").length +
      (search ? 1 : 0),
    [category, outcome, search, severity],
  );

  const resetFilters = () => {
    setSeverity("all");
    setCategory("all");
    setOutcome("all");
    setSearchDraft("");
    setSearch("");
    setPage(0);
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setSearch(searchDraft.trim());
  };

  const exportEvidence = async (formatType: "csv" | "json") => {
    setExporting(formatType);

    try {
      const exportedAt = new Date();
      const filters = {
        severity: severity === "all" ? null : severity,
        category: category === "all" ? null : category,
        outcome: outcome === "all" ? null : outcome,
        search: search || null,
        range,
        from: getRangeStart(range),
        to: exportedAt.toISOString(),
      };

      if (formatType === "json") {
        let beforeSequence: number | null = null;
        let pages = 0;
        let exportedEvents = 0;
        let totalEvents = 0;
        do {
          const response = await callAdminRpc<unknown>(
            "admin_prepare_security_export_page",
            {
              p_filters: filters,
              p_limit: 1500,
              p_before_sequence: beforeSequence,
            },
          );
          const prepared = await verifyPreparedEvidencePackage(response);
          downloadBlob(prepared.content, prepared.media_type, prepared.filename);
          downloadBlob(
            formatSha256Checksum(prepared.sha256, prepared.filename),
            "text/plain;charset=utf-8",
            `${prepared.filename}.sha256`,
          );
          pages += 1;
          exportedEvents += prepared.event_count;
          totalEvents = prepared.total_count;
          beforeSequence = prepared.has_more
            ? Number(prepared.next_before_sequence)
            : null;
          if (pages >= 100 && beforeSequence !== null) {
            throw new Error("The export exceeds 100 evidence parts. Use a narrower date range.");
          }
        } while (beforeSequence !== null);

        toast.success(
          `${exportedEvents.toLocaleString()} of ${totalEvents.toLocaleString()} events exported in ${pages} verified ${pages === 1 ? "part" : "parts"}`,
        );
      } else {
        const response = await callAdminRpc<unknown>("admin_prepare_security_export", {
          p_format: formatType,
          p_filters: filters,
          p_limit: 5000,
        });
        const prepared = await verifyPreparedEvidencePackage(response);
        downloadBlob(prepared.content, prepared.media_type, prepared.filename);
        downloadBlob(
          formatSha256Checksum(prepared.sha256, prepared.filename),
          "text/plain;charset=utf-8",
          `${prepared.filename}.sha256`,
        );
        toast.success(
          prepared.truncated
            ? `${prepared.event_count.toLocaleString()} of ${prepared.total_count.toLocaleString()} matching rows exported to CSV. Use JSON for a complete anchored export.`
            : `${prepared.event_count.toLocaleString()} security events exported with a verified checksum`,
        );
      }
      void loadSecurityData(true);
    } catch (exportError) {
      console.error("Failed to export security evidence:", exportError);
      toast.error(
        exportError instanceof Error
          ? exportError.message
          : "Evidence export failed",
      );
    } finally {
      setExporting(null);
    }
  };

  const highRiskCount =
    toNumber(overview.critical) + toNumber(overview.high);
  const externalReceiptCount = toNumber(
    overview.latest_anchor?.external_receipt_count,
  );
  const receiverAcknowledgementFresh = Boolean(
    overview.latest_anchor?.receipt_fresh && overview.latest_anchor?.anchor_fresh,
  );
  const fullVerificationComplete = Boolean(
    integrity?.complete && integrity.verification_scope === "full",
  );
  const integrityLabel = !integrity
    ? "Pending"
    : !fullVerificationComplete
      ? "Verification incomplete"
    : !integrity.valid
      ? "Mismatch detected"
      : integrity.coverage === "fully_anchored"
        ? "Full ledger verified"
        : integrity.coverage === "partially_anchored"
          ? "Full scan valid / recent events pending"
          : integrity.coverage === "unanchored"
            ? "Full scan valid / no anchor yet"
            : "Valid";

  return (
    <AdminLayout
      title="Security Center"
      subtitle="Monitor threats, preserve evidence, and investigate security events"
    >
      <div className="space-y-4 bg-[#F6F8FB] text-[#020617] sm:space-y-5">
        <AdminWorkbenchHeader
          eyebrow="Security operations"
          title="Security Center"
          icon={ShieldCheck}
          accent="#22C7A1"
          description="Investigate privileged activity and blocked requests from one tamper-evident evidence trail."
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadSecurityData(true)}
                disabled={refreshing}
                className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-white font-extrabold text-[#020617]"
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
                />
                Refresh
              </Button>
              <Button
                asChild
                className="min-h-11 rounded-[14px] bg-[#020617] font-extrabold text-white hover:bg-[#172033]"
              >
                <a
                  href="https://ncsa.gov.qa/en/reporting"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Report incident
                </a>
              </Button>
            </>
          }
          meta={[
            {
              label: "Ledger integrity",
              value: integrity ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-2",
                    !integrity.valid || !fullVerificationComplete
                      ? "text-[#D63851]"
                      : integrity.coverage === "fully_anchored"
                        ? "text-[#0B9B79]"
                        : "text-[#B45309]",
                  )}
                >
                  {integrity.valid && fullVerificationComplete && integrity.coverage === "fully_anchored" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : integrity.valid ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <ShieldX className="h-4 w-4" />
                  )}
                  {integrityLabel}
                </span>
              ) : (
                "Pending"
              ),
            },
            {
              label: "Events verified",
              value: integrity ? toNumber(integrity.checked).toLocaleString() : "-",
            },
            {
              label: "Latest anchor",
              value: overview.latest_anchor?.anchor_date
                ? `${overview.latest_anchor.anchor_date} / ${
                    externalReceiptCount > 0 && receiverAcknowledgementFresh
                      ? "receiver acknowledged"
                      : externalReceiptCount > 0
                        ? "acknowledgement stale"
                        : "database only"
                  }`
                : "Not created yet",
            },
          ]}
        />

        <AdminKpiStrip
          items={[
            {
              label: `Events · ${rangeLabels[range]}`,
              value: toNumber(overview.total).toLocaleString(),
              helper: overview.last_event_at
                ? `latest ${formatDistanceToNow(new Date(overview.last_event_at), {
                    addSuffix: true,
                  })}`
                : "no events",
              icon: Activity,
              accent: "#38BDF8",
            },
            {
              label: "High risk",
              value: highRiskCount.toLocaleString(),
              helper: `${toNumber(overview.critical)} critical`,
              icon: ShieldAlert,
              accent: "#FB6B7A",
            },
            {
              label: "Denied or blocked",
              value: toNumber(overview.denied_or_blocked).toLocaleString(),
              helper: `${toNumber(overview.failures)} failures`,
              icon: Ban,
              accent: "#7C83F6",
            },
            {
              label: "Unique source IPs",
              value: toNumber(overview.unique_ips).toLocaleString(),
              helper: "restricted evidence",
              icon: Globe2,
              accent: "#22C7A1",
            },
          ]}
        />

        <SecurityPosturePanel posture={posture} />

        <SecurityIncidentPanel seedEvent={incidentSeedEvent} />

        {integrity && (!integrity.valid || !fullVerificationComplete) && (
          <section className="flex flex-col gap-3 rounded-[18px] border border-[#FB6B7A]/35 bg-[#FFF1F3] p-4 sm:flex-row sm:items-center">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white text-[#D63851] ring-1 ring-[#FB6B7A]/25">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-[#A61B34]">Evidence integrity alert</p>
              <p className="mt-0.5 text-sm font-semibold leading-5 text-[#B73A50]">
                {!fullVerificationComplete
                  ? "The verification did not cover the complete evidence ledger."
                  : toNumber(integrity.historical_unanchored_count) > 0
                    ? `${toNumber(integrity.historical_unanchored_count).toLocaleString()} committed historical events are outside every anchor.`
                    : toNumber(integrity.event_invalid_count) > 0
                      ? `An event seal first differs at sequence ${String(integrity.first_invalid_sequence || "unknown")}.`
                      : toNumber(integrity.receipt_invalid_count) > 0
                        ? `An external acknowledgement seal is invalid (${integrity.first_invalid_receipt || "unknown receipt"}).`
                        : `An anchor first differs at ${integrity.first_invalid_anchor || "an unknown date"}.`} {" "}
                Preserve provider logs and begin the incident response procedure now.
              </p>
            </div>
          </section>
        )}

        {integrity?.valid &&
          (integrity.coverage !== "fully_anchored" ||
            externalReceiptCount === 0 ||
            !receiverAcknowledgementFresh) && (
            <section className="flex flex-col gap-3 rounded-[18px] border border-[#F59E0B]/30 bg-[#FFFBEB] p-4 sm:flex-row sm:items-center">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white text-[#B45309] ring-1 ring-[#F59E0B]/25">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-[#92400E]">Evidence anchoring needs attention</p>
                <p className="mt-0.5 text-sm font-semibold leading-5 text-[#A16207]">
                  {integrity.coverage === "unanchored"
                    ? "Event seals are valid, but no completed range anchor exists yet."
                    : toNumber(integrity.unanchored_count) > 0
                      ? `${toNumber(integrity.unanchored_count).toLocaleString()} recent events are waiting for the next anchor.`
                      : "The latest range anchor is valid."} {" "}
                  {externalReceiptCount === 0
                    ? "No receiver-generated off-site acknowledgement is recorded, so there is no independent comparison point."
                    : receiverAcknowledgementFresh
                      ? "A fresh receiver-generated acknowledgement is present."
                      : "The latest receiver acknowledgement or anchor is stale and must not be treated as current protection."}
                </p>
              </div>
            </section>
          )}

        <AdminFilterBar
          title={activeFilterCount ? `${activeFilterCount} filters active` : "Event filters"}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void exportEvidence("csv")}
                disabled={Boolean(exporting) || loading || totalCount === 0}
                className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-white font-extrabold text-[#020617]"
              >
                {exporting === "csv" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-[#22C7A1]" />
                )}
                CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void exportEvidence("json")}
                disabled={Boolean(exporting) || loading || totalCount === 0}
                className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-white font-extrabold text-[#020617]"
              >
                {exporting === "json" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileJson className="mr-2 h-4 w-4 text-[#7C83F6]" />
                )}
                JSON
              </Button>
            </>
          }
        >
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_150px_160px_150px_150px_auto]">
            <form onSubmit={handleSearch} className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="IP, request ID, user or resource"
                className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8]"
              />
              <button type="submit" className="sr-only">
                Search events
              </button>
            </form>
            <Select
              value={severity}
              onValueChange={(value) => {
                setSeverity(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-bold">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-bold">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="authentication">Authentication</SelectItem>
                <SelectItem value="authorization">Authorization</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="data_change">Data change</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="edge_function">Edge function</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="detection">Detection</SelectItem>
                <SelectItem value="incident">Incident</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={outcome}
              onValueChange={(value) => {
                setOutcome(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-bold">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={range}
              onValueChange={(value) => {
                setRange(value as TimeRange);
                setPage(0);
              }}
            >
              <SelectTrigger className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-bold">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(rangeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              onClick={resetFilters}
              disabled={!activeFilterCount}
              className="min-h-11 rounded-[14px] font-extrabold text-[#64748B]"
            >
              Clear
            </Button>
          </div>
        </AdminFilterBar>

        <AdminPanel>
          <AdminPanelHeader
            eyebrow="Forensic evidence"
            title="Security event ledger"
            description={
              totalCount
                ? `${totalCount.toLocaleString()} matching events · newest first`
                : "Privileged and security-sensitive activity"
            }
            actions={
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E5EAF1] bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#64748B]">
                <Fingerprint className="h-3.5 w-3.5 text-[#7C83F6]" />
                Append-only evidence
              </span>
            }
          />

          {loading ? (
            <AdminListSkeleton rows={6} />
          ) : error ? (
            <AdminEmptyState
              icon={ShieldX}
              title="Security ledger is unavailable"
              description={
                <>
                  {error}. Confirm migration <code>20260716120000</code> is deployed,
                  then retry.
                </>
              }
              action={
                <Button
                  type="button"
                  onClick={() => void loadSecurityData()}
                  className="rounded-[14px] bg-[#020617] font-extrabold text-white"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              }
            />
          ) : events.length === 0 ? (
            <AdminEmptyState
              icon={ShieldCheck}
              title="No matching security events"
              description="No events match this period and filter set. Clear filters or widen the time range."
              action={
                activeFilterCount ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFilters}
                    className="rounded-[14px] border-[#E5EAF1] font-extrabold"
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          ) : (
            <div>
              {events.map((event) => {
                const style = severityStyles[event.severity] || severityStyles.info;
                return (
                  <button
                    key={event.event_id}
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="grid w-full gap-3 border-b border-[#E5EAF1] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[#F6F8FB] sm:grid-cols-[auto_minmax(0,1fr)_minmax(180px,0.55fr)_auto] sm:items-center sm:px-5"
                  >
                    <span
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-[14px] ring-1",
                        style.iconClassName,
                      )}
                    >
                      {event.outcome === "blocked" || event.outcome === "denied" ? (
                        <Ban className="h-5 w-5" />
                      ) : event.severity === "critical" || event.severity === "high" ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <Activity className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[#020617]">
                        {humanize(event.event_type)}
                      </span>
                      <span className="mt-1 block truncate text-xs font-semibold text-[#94A3B8]">
                        {event.resource_type || humanize(event.category)}
                        {event.resource_id ? ` · ${event.resource_id}` : ""}
                      </span>
                    </span>
                    <span className="min-w-0 text-xs font-semibold text-[#64748B]">
                      <span className="flex items-center gap-1.5 truncate">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                        {event.actor_role || event.actor_type}
                        {event.ip_address ? ` · ${event.ip_address}` : ""}
                      </span>
                      <span className="mt-1 block text-[#94A3B8]">
                        {formatTimestamp(event.occurred_at)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 sm:justify-end">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
                          style.className,
                        )}
                      >
                        {style.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !error && totalCount > PAGE_SIZE && (
            <div className="flex flex-col gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs font-bold text-[#64748B]">
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  className="h-10 w-10 rounded-[13px] border-[#E5EAF1] bg-white"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="grid min-w-20 place-items-center rounded-[13px] border border-[#E5EAF1] bg-white px-3 text-xs font-black text-[#020617]">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="h-10 w-10 rounded-[13px] border-[#E5EAF1] bg-white"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </AdminPanel>

        <section className="grid gap-3 rounded-[18px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_28px_rgba(2,6,23,0.035)] lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[#EFFAFF] text-[#0284C7] ring-1 ring-[#38BDF8]/25">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-[#020617]">Evidence handling notice</p>
              <p className="mt-1 max-w-4xl text-xs font-semibold leading-5 text-[#64748B]">
                IP addresses, device agents, request IDs, and timestamps are technical
                evidence. They help correlation, but identifying a person may require
                provider records and cooperation from the competent authorities. Preserve
                original exports and do not edit them.
              </p>
            </div>
          </div>
          <div className="rounded-[14px] bg-[#F6F8FB] px-4 py-3 text-xs font-bold text-[#64748B] ring-1 ring-[#E5EAF1]">
            Qatar incident hotline: <span className="font-black text-[#020617]">16555</span>
          </div>
        </section>
      </div>

      <Sheet
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <AdminSheetContent size="xl">
          {selectedEvent && (
            <>
              <SheetHeader className="border-b border-[#E5EAF1] bg-white p-5 text-left">
                <div className="flex items-start gap-3 pr-8">
                  <div
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-[14px] ring-1",
                      severityStyles[selectedEvent.severity].iconClassName,
                    )}
                  >
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Event #{String(selectedEvent.sequence_number)}
                    </p>
                    <SheetTitle className="mt-1 break-words text-xl font-black text-[#020617]">
                      {humanize(selectedEvent.event_type)}
                    </SheetTitle>
                    <SheetDescription className="mt-1 font-semibold text-[#64748B]">
                      {formatTimestamp(selectedEvent.occurred_at)} · {humanize(selectedEvent.outcome)}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4 p-4 sm:p-5">
                <Button
                  type="button"
                  onClick={() => {
                    setIncidentSeedEvent({
                      eventId: selectedEvent.event_id,
                      eventType: selectedEvent.event_type,
                      severity: selectedEvent.severity,
                      occurredAt: selectedEvent.occurred_at,
                      nonce: Date.now(),
                    });
                    setSelectedEvent(null);
                  }}
                  className="min-h-11 w-full rounded-[14px] bg-[#020617] font-black text-white hover:bg-[#172033]"
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Open investigation case from this event
                </Button>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Severity", severityStyles[selectedEvent.severity].label],
                    ["Category", humanize(selectedEvent.category)],
                    ["Source", humanize(selectedEvent.source)],
                    ["Outcome", humanize(selectedEvent.outcome)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[14px] border border-[#E5EAF1] bg-white p-3"
                    >
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        {label}
                      </p>
                      <p className="mt-1 truncate text-xs font-black text-[#020617]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <AdminPanel>
                  <AdminPanelHeader title="Actor and request" eyebrow="Attribution" />
                  <div className="px-4">
                    <DetailField label="Actor user ID" value={selectedEvent.actor_user_id} mono copyable />
                    <DetailField
                      label="Actor role"
                      value={selectedEvent.actor_role || selectedEvent.actor_type}
                    />
                    <DetailField label="IP address · restricted" value={selectedEvent.ip_address} mono copyable />
                    <DetailField label="Country" value={selectedEvent.country_code} />
                    <DetailField label="Request ID" value={selectedEvent.request_id} mono copyable />
                    <DetailField label="Correlation ID" value={selectedEvent.correlation_id} mono copyable />
                    <DetailField label="Session fingerprint" value={selectedEvent.session_fingerprint} mono copyable />
                    <DetailField label="User agent" value={selectedEvent.user_agent} />
                  </div>
                </AdminPanel>

                <AdminPanel>
                  <AdminPanelHeader title="Affected resource" eyebrow="Scope" />
                  <div className="px-4">
                    <DetailField label="Action" value={selectedEvent.action} />
                    <DetailField label="Resource type" value={selectedEvent.resource_type} mono />
                    <DetailField label="Resource ID" value={selectedEvent.resource_id} mono copyable />
                  </div>
                </AdminPanel>

                <AdminPanel>
                  <AdminPanelHeader
                    title="Evidence integrity"
                    eyebrow="SHA-256 row seal"
                    actions={
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF8] px-2.5 py-1 text-[10px] font-black text-[#0B9B79] ring-1 ring-[#22C7A1]/25">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Sealed
                      </span>
                    }
                  />
                  <div className="px-4">
                    <DetailField label="Event hash" value={selectedEvent.event_hash} mono copyable />
                    <DetailField
                      label="Seal mode"
                      value={
                        selectedEvent.previous_hash === "INDEPENDENT"
                          ? "Independent row seal · covered by range anchors"
                          : selectedEvent.previous_hash
                      }
                      mono
                    />
                    <DetailField label="Evidence signature" value={selectedEvent.evidence_signature} mono copyable />
                    <DetailField label="Signature key ID" value={selectedEvent.signature_key_id} mono />
                  </div>
                </AdminPanel>

                <AdminPanel>
                  <AdminPanelHeader title="Sanitized metadata" eyebrow="Context" />
                  <div className="p-4">
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-[14px] border border-[#E5EAF1] bg-[#020617] p-4 font-mono text-[11px] leading-5 text-[#E2E8F0]">
                      {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                    </pre>
                  </div>
                </AdminPanel>

                <div className="rounded-[16px] border border-[#38BDF8]/25 bg-[#EFFAFF] p-4">
                  <div className="flex items-start gap-3">
                    <Hash className="mt-0.5 h-5 w-5 shrink-0 text-[#0284C7]" />
                    <p className="text-xs font-semibold leading-5 text-[#0369A1]">
                      Keep the event hash, request ID, timestamps, and original export
                      together when opening an incident case. Avoid screenshots as the only
                      copy of evidence. An IP address or device string supports correlation,
                      but does not by itself prove a person&apos;s identity.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </AdminSheetContent>
      </Sheet>
    </AdminLayout>
  );
}
