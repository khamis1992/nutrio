import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { recordSportHubClick } from "@/lib/partnerTracking";
import {
  getSportHubActivitySessions,
  getSportHubIntegration,
  syncSportHub,
  type SportHubActivitySession,
} from "@/lib/sporthubIntegration";

type Props = { onActivitiesChanged?: () => void | Promise<void> };

export function SportHubActivityBridge({ onActivitiesChanged }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "not_linked" | "pending" | "linked" | "reauth_required" | "failed">("loading");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SportHubActivitySession[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [integration, activitySessions] = await Promise.all([
        getSportHubIntegration(user.id),
        getSportHubActivitySessions(user.id),
      ]);
      const integrationStatus = integration?.consent_status;
      setStatus(integrationStatus === "linked" || integrationStatus === "pending" || integrationStatus === "reauth_required" || integrationStatus === "failed"
        ? integrationStatus
        : "not_linked");
      setLastSyncedAt(integration?.last_synced_at ?? null);
      setSessions(activitySessions);
    } catch (error) {
      console.error("Could not load SportHub integration", error);
      setStatus("failed");
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const upcoming = useMemo(() => sessions
    .filter((session) => ["booked", "confirmed"].includes(session.status) && new Date(session.starts_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null, [sessions]);

  const openPartner = async () => {
    await recordSportHubClick({ userId: user?.id, campaign: "dashboard_activity_card", eventType: "sporthub_card_clicked" });
    navigate("/partners/sporthub");
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await syncSportHub();
      await load();
      await onActivitiesChanged?.();
      toast.success(result.synced > 0 ? `${result.synced} SportHub activities synced` : "SportHub is up to date");
    } catch (error) {
      console.error("SportHub sync failed", error);
      toast.error("Could not sync SportHub right now");
    } finally {
      setSyncing(false);
    }
  };

  if (status !== "linked") {
    return (
      <button type="button" onClick={() => void openPartner()} className="relative w-full overflow-hidden rounded-[24px] bg-white text-start shadow-[0_8px_24px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] transition active:scale-[0.99]">
        <img src="/sporthub-banner.png" alt="Connect Nutrio with SportHub" className="block h-auto w-full" loading="lazy" />
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black text-[#020617] shadow-sm">
          {status === "loading" ? "Checking" : status === "pending" ? "Continue setup" : status === "reauth_required" ? "Reconnect" : "Connect"}
        </span>
      </button>
    );
  }

  const lastSyncLabel = lastSyncedAt
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(lastSyncedAt))
    : null;

  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_24px_rgba(2,6,23,0.06)] ring-1 ring-[#D7EEE8]">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[#E9FBF7] text-[#22C7A1]"><CheckCircle2 className="h-5 w-5" strokeWidth={2.3} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">SportHub connected</p>
          <p className="mt-0.5 truncate text-[14px] font-black text-[#020617]">{upcoming ? upcoming.activity_type : "Activities sync automatically"}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#94A3B8]">
            {upcoming
              ? `${new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(upcoming.starts_at))}${upcoming.venue_name ? ` · ${upcoming.venue_name}` : ""}`
              : lastSyncLabel ? `Last synced ${lastSyncLabel}` : "Ready for your first SportHub booking"}
          </p>
        </div>
        <button type="button" onClick={() => void sync()} disabled={syncing} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] active:scale-95 disabled:opacity-50" aria-label="Sync SportHub activities">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} strokeWidth={2.2} />
        </button>
      </div>
      <div className="grid grid-cols-2 border-t border-[#E5EAF1]">
        <button type="button" onClick={() => void openPartner()} className="flex h-12 items-center justify-center gap-2 text-[12px] font-black text-[#020617] active:bg-[#F6F8FB]"><CalendarDays className="h-4 w-4 text-[#7C83F6]" /> Manage connection</button>
        <div className="flex h-12 items-center justify-center gap-2 border-l border-[#E5EAF1] text-[12px] font-black text-[#64748B]"><Clock3 className="h-4 w-4 text-[#38BDF8]" /> {sessions.filter((item) => item.status === "completed").length} synced</div>
      </div>
    </section>
  );
}
