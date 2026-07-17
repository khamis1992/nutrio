import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Link2,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminKpiStrip,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type PartnerIntegrationAdminRow = {
  id: string;
  user_id: string;
  partner: string;
  consent_status: string;
  external_user_id: string | null;
  linked_at: string | null;
  unlinked_at: string | null;
  last_synced_at: string | null;
  updated_at: string;
  created_at: string;
};

type PartnerReferralAdminRow = {
  id: string;
  user_id: string | null;
  source_app: string;
  target_app: string;
  campaign: string | null;
  status: string;
  clicked_at: string;
  converted_at: string | null;
};

type PartnerEventAdminRow = {
  id: string;
  user_id: string | null;
  partner: string;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown> | null;
};

type SelectLimitBuilder<T> = {
  limit: (count: number) => Promise<{ data: T[] | null; error: Error | null }>;
};

type SelectOrderBuilder<T> = SelectLimitBuilder<T> & {
  order: (
    column: string,
    options: { ascending: boolean },
  ) => SelectLimitBuilder<T>;
};

const partnerAdminDb = supabase as unknown as {
  from: <T>(table: string) => {
    select: (columns: string) => SelectOrderBuilder<T>;
  };
};

const shortId = (value?: string | null) => {
  if (!value) return "Anonymous";
  return `${value.slice(0, 8)}...`;
};

const formatTime = (value?: string | null) => {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-QA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function AdminPartnerIntegrations() {
  const [integrations, setIntegrations] = useState<
    PartnerIntegrationAdminRow[]
  >([]);
  const [referrals, setReferrals] = useState<PartnerReferralAdminRow[]>([]);
  const [events, setEvents] = useState<PartnerEventAdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  const stats = useMemo(() => {
    const sportHubIntegrations = integrations.filter(
      (item) => item.partner === "sporthub",
    );
    const pending = sportHubIntegrations.filter(
      (item) => item.consent_status === "pending",
    ).length;
    const linked = sportHubIntegrations.filter(
      (item) => item.consent_status === "linked",
    ).length;
    const revoked = sportHubIntegrations.filter(
      (item) => item.consent_status === "revoked",
    ).length;
    const clicks = referrals.filter(
      (item) => item.target_app === "sporthub",
    ).length;
    const views = events.filter(
      (item) =>
        item.partner === "sporthub" &&
        item.event_type === "sporthub_card_viewed",
    ).length;
    const signups = referrals.filter(
      (item) =>
        item.source_app === "sporthub" &&
        item.target_app === "nutrio" &&
        item.status === "signed_up",
    ).length;

    return [
      {
        label: "Dashboard views",
        value: views,
        Icon: Activity,
        tone: "text-[#22C7A1] bg-[#22C7A1]/10",
      },
      {
        label: "SportHub clicks",
        value: clicks,
        Icon: MousePointerClick,
        tone: "text-[#38BDF8] bg-[#38BDF8]/10",
      },
      {
        label: "Nutrio signups",
        value: signups,
        Icon: ArrowUpRight,
        tone: "text-[#020617] bg-white",
      },
      {
        label: "Link requests",
        value: pending,
        Icon: Clock3,
        tone: "text-[#7C83F6] bg-[#7C83F6]/10",
      },
      {
        label: "Linked",
        value: linked,
        Icon: CheckCircle2,
        tone: "text-[#22C7A1] bg-[#22C7A1]/10",
      },
      {
        label: "Revoked",
        value: revoked,
        Icon: ShieldCheck,
        tone: "text-[#FB6B7A] bg-[#FB6B7A]/10",
      },
    ];
  }, [events, integrations, referrals]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [integrationsResult, referralsResult, eventsResult] =
        await Promise.all([
          partnerAdminDb
            .from<PartnerIntegrationAdminRow>("partner_integrations")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(24),
          partnerAdminDb
            .from<PartnerReferralAdminRow>("partner_referrals")
            .select("*")
            .order("clicked_at", { ascending: false })
            .limit(24),
          partnerAdminDb
            .from<PartnerEventAdminRow>("partner_events")
            .select("*")
            .order("occurred_at", { ascending: false })
            .limit(30),
        ]);

      if (integrationsResult.error) throw integrationsResult.error;
      if (referralsResult.error) throw referralsResult.error;
      if (eventsResult.error) throw eventsResult.error;

      setIntegrations(integrationsResult.data ?? []);
      setReferrals(referralsResult.data ?? []);
      setEvents(eventsResult.data ?? []);
    } catch (error) {
      console.error("Failed to load partner integration analytics:", error);
      toast.error("Could not load partner integration data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <AdminLayout
      title="Partner Integrations"
      subtitle="Track SportHub linking, referrals, and consent events"
    >
      <div className="space-y-5 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Nutrio x SportHub"
          title="Integration pilot desk"
          icon={Link2}
          accent="#22C7A1"
          description="Monitor user consent, offer clicks, referrals, and integration events before enabling full API sync."
          meta={[
            { label: "Connections", value: integrations.length },
            { label: "Referrals", value: referrals.length },
            { label: "Events", value: events.length },
          ]}
          actions={
            <Button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              variant="outline"
              className="h-12 rounded-full border-[#7C83F6]/30 bg-[#7C83F6]/10 px-5 text-sm font-black text-[#020617] hover:bg-[#7C83F6]/15"
            >
              <RefreshCw
                className={cn("me-2 h-4 w-4", loading && "animate-spin")}
              />
              Refresh
            </Button>
          }
        />

        <AdminKpiStrip
          className="xl:grid-cols-6 2xl:grid-cols-6"
          items={stats.map(({ label, value, Icon, tone }) => ({
            label,
            value,
            icon: Icon,
            accent: tone.includes("#38BDF8")
              ? "#38BDF8"
              : tone.includes("#7C83F6")
                ? "#7C83F6"
                : tone.includes("#FB6B7A")
                  ? "#FB6B7A"
                  : tone.includes("#020617")
                    ? "#7C83F6"
                    : "#22C7A1",
          }))}
        />

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <AdminPanel className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                  Consent
                </p>
                <h3 className="mt-1 text-xl font-black tracking-[-0.03em]">
                  Latest account states
                </h3>
              </div>
              <Link2 className="h-5 w-5 text-[#22C7A1]" />
            </div>

            <div className="mt-4 space-y-3">
              {integrations.length === 0 && (
                <div className="rounded-[22px] bg-[#F6F8FB] p-5 text-sm font-bold text-[#94A3B8]">
                  No account link requests yet.
                </div>
              )}
              {integrations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black capitalize">
                        {item.partner}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#94A3B8]">
                        User {shortId(item.user_id)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em]",
                        item.consent_status === "revoked"
                          ? "bg-[#FB6B7A]/10 text-[#FB6B7A]"
                          : item.consent_status === "linked"
                            ? "bg-[#22C7A1]/10 text-[#22C7A1]"
                            : "bg-[#7C83F6]/10 text-[#7C83F6]",
                      )}
                    >
                      {item.consent_status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs font-bold text-[#94A3B8]">
                    <span>Updated: {formatTime(item.updated_at)}</span>
                    <span>Synced: {formatTime(item.last_synced_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                  Referrals
                </p>
                <h3 className="mt-1 text-xl font-black tracking-[-0.03em]">
                  Recent clicks
                </h3>
              </div>
              <ArrowUpRight className="h-5 w-5 text-[#38BDF8]" />
            </div>

            <div className="mt-4 space-y-3">
              {referrals.length === 0 && (
                <div className="rounded-[22px] bg-[#F6F8FB] p-5 text-sm font-bold text-[#94A3B8]">
                  No SportHub clicks recorded yet.
                </div>
              )}
              {referrals.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-[20px] bg-[#F6F8FB] p-3"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/10 text-[#38BDF8]">
                    <MousePointerClick className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">
                      {item.campaign || "SportHub campaign"}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-[#94A3B8]">
                      {formatTime(item.clicked_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-[#94A3B8]">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </AdminPanel>
        </div>

        <AdminPanel className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                Audit trail
              </p>
              <h3 className="mt-1 text-xl font-black tracking-[-0.03em]">
                Latest partner events
              </h3>
            </div>
            <Activity className="h-5 w-5 text-[#7C83F6]" />
          </div>

          <div className="mt-4 overflow-hidden rounded-[22px] border border-[#E5EAF1]">
            {events.length === 0 ? (
              <div className="bg-[#F6F8FB] p-5 text-sm font-bold text-[#94A3B8]">
                No partner events yet.
              </div>
            ) : (
              events.slice(0, 12).map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "grid gap-2 bg-white p-4 text-sm sm:grid-cols-[1fr_auto_auto]",
                    index !== events.length - 1 && "border-b border-[#E5EAF1]",
                  )}
                >
                  <div>
                    <p className="font-black text-[#020617]">
                      {item.event_type}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-[#94A3B8]">
                      User {shortId(item.user_id)}
                    </p>
                  </div>
                  <p className="text-xs font-black uppercase text-[#22C7A1]">
                    {item.partner}
                  </p>
                  <p className="text-xs font-bold text-[#94A3B8]">
                    {formatTime(item.occurred_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminLayout>
  );
}
