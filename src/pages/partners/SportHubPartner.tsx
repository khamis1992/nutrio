import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Apple,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  getPartnerIntegration,
  recordSportHubClick,
  recordSportHubEvent,
  type PartnerIntegrationRecord,
} from "@/lib/partnerTracking";
import { startSportHubLink, unlinkSportHub } from "@/lib/sporthubIntegration";

const SPORTHUB_REFERRAL_CODE = "NUTRIO15";
const SPORTHUB_BASE_URL = "https://www.sporthubapp.com/";
const SPORTHUB_GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.taswer.sporthub";
const SPORTHUB_APP_STORE_URL = "https://apps.apple.com/us/app/sporthub-app/id6446162502";

function GooglePlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#00A6FF" d="M7.4 5.6c-.5.5-.8 1.3-.8 2.4v32c0 1.1.3 1.9.9 2.4L27 24 7.4 5.6Z" />
      <path fill="#00D37F" d="m27 24 6.5-6.1L10.7 5c-1.2-.7-2.3-.7-3.1-.1L27 24Z" />
      <path fill="#FFCF35" d="m27 24-19.5 19c.8.6 2 .5 3.2-.2l22.8-12.7L27 24Z" />
      <path fill="#FF5A3D" d="m33.5 17.9-6.5 6.1 6.5 6.1 6.2-3.5c2.1-1.2 2.1-4 0-5.2l-6.2-3.5Z" />
    </svg>
  );
}

const buildSportHubUrl = (campaign: string) => {
  const url = new URL(SPORTHUB_BASE_URL);
  url.searchParams.set("source", "nutrio");
  url.searchParams.set("campaign", campaign);
  url.searchParams.set("code", SPORTHUB_REFERRAL_CODE);
  return url.toString();
};

const bookingSteps = [
  {
    title: "Book a venue",
    detail: "Find available courts and facilities across Qatar.",
    Icon: MapPin,
    tone: "bg-[#EEF4FF] text-[#336CFF]",
  },
  {
    title: "Choose time",
    detail: "Pick a slot, join a group, or set a regular booking.",
    Icon: Clock3,
    tone: "bg-[#ECFDF5] text-[#22C7A1]",
  },
  {
    title: "Pay & play",
    detail: "Secure payment and you are all set to play.",
    Icon: Wallet,
    tone: "bg-[#F5F3FF] text-[#7C3AED]",
  },
];


export default function SportHubPartner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { trackEvent, trackPageView } = useAnalytics();
  const [integrationStatus, setIntegrationStatus] = useState<PartnerIntegrationRecord["consent_status"] | "not_linked">(
    "not_linked",
  );
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [integrationSaving, setIntegrationSaving] = useState(false);

  useEffect(() => {
    document.title = "SportHub Partner - Nutrio";
    trackPageView("sporthub_partner_page", { partner: "sporthub", source: "nutrio" });
    trackEvent("sporthub_partner_page_opened", { partner: "sporthub" });
    recordSportHubEvent({
      userId: user?.id,
      campaign: "partner_page_view",
      eventType: "sporthub_partner_page_opened",
    });
  }, [trackEvent, trackPageView, user?.id]);

  useEffect(() => {
    const result = searchParams.get("sporthub_link");
    if (result === "linked") toast.success("SportHub account connected");
    if (result === "failed") toast.error("SportHub connection was not completed");
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const loadIntegration = async () => {
      if (!user?.id) {
        setIntegrationStatus("not_linked");
        setIntegrationLoading(false);
        return;
      }

      setIntegrationLoading(true);
      const integration = await getPartnerIntegration({
        userId: user.id,
        partner: "sporthub",
      });

      if (!isMounted) return;

      setIntegrationStatus(integration?.consent_status ?? "not_linked");
      setIntegrationLoading(false);
    };

    void loadIntegration();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const trackOutbound = async (campaign: string) => {
    trackEvent("sporthub_cta_clicked", {
      partner: "sporthub",
      campaign,
      referral_code: SPORTHUB_REFERRAL_CODE,
    });
    await recordSportHubClick({
      userId: user?.id,
      campaign,
      eventType: "sporthub_cta_clicked",
    });
  };

  const openUrl = async (url: string, campaign: string) => {
    await Promise.race([
      trackOutbound(campaign),
      new Promise((resolve) => window.setTimeout(resolve, 700)),
    ]);
    window.location.href = url;
  };

  const openSportHub = (campaign: string) => {
    void openUrl(buildSportHubUrl(campaign), campaign);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(SPORTHUB_REFERRAL_CODE);
    trackEvent("sporthub_offer_copied", {
      partner: "sporthub",
      referral_code: SPORTHUB_REFERRAL_CODE,
    });
    recordSportHubEvent({
      userId: user?.id,
      campaign: "offer_code_copied",
      eventType: "sporthub_offer_copied",
    });
    toast.success("SportHub offer code copied");
  };

  const requestSportHubLink = async () => {
    if (!user?.id) {
      toast.error("Please sign in to link SportHub");
      return;
    }

    setIntegrationSaving(true);
    try {
      const authorizationUrl = await startSportHubLink("/partners/sporthub");
      setIntegrationStatus("pending");
      trackEvent("sporthub_account_link_requested", { partner: "sporthub" });
      await recordSportHubEvent({
        userId: user.id,
        campaign: "account_linking",
        eventType: "sporthub_account_link_requested",
      });
      window.location.href = authorizationUrl;
    } catch (error) {
      console.error("Could not start SportHub linking", error);
      toast.error("SportHub linking is not available yet");
      setIntegrationSaving(false);
    }
  };

  const revokeSportHubLink = async () => {
    if (!user?.id) return;

    setIntegrationSaving(true);
    try {
      await unlinkSportHub();
    } catch (error) {
      console.error("Could not unlink SportHub", error);
      toast.error("Could not update SportHub link");
      setIntegrationSaving(false);
      return;
    }

    setIntegrationStatus("revoked");
    trackEvent("sporthub_account_unlinked", { partner: "sporthub" });
    await recordSportHubEvent({
      userId: user.id,
      campaign: "account_linking",
      eventType: "sporthub_account_unlinked",
    });
    toast.success("SportHub link revoked");
    setIntegrationSaving(false);
  };

  const skipSportHubLink = () => {
    trackEvent("sporthub_account_link_skipped", { partner: "sporthub" });
    recordSportHubEvent({
      userId: user?.id,
      campaign: "account_linking",
      eventType: "sporthub_account_link_skipped",
    });
    toast("No SportHub data will be shared");
  };

  const isLinked = integrationStatus === "linked";
  const isLinkPending = integrationStatus === "pending";

  return (
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-white pb-28 pt-safe text-[#020617] [-webkit-overflow-scrolling:touch]">
      <header className="sticky top-0 z-30 bg-white/94 backdrop-blur-xl">
        <div className="mx-auto flex h-[104px] max-w-[480px] items-center gap-3 px-4 pt-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[24px] bg-white text-[#020617] shadow-[0_10px_28px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-7 w-7 rtl-flip" strokeWidth={2.5} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[13px] font-black uppercase tracking-[0.28em] text-[#336CFF]">Partner App</p>
            <h1 className="truncate text-[34px] font-black leading-none tracking-[-0.05em]">SportHub</h1>
          </div>
          <button
            type="button"
            onClick={() => openSportHub("header")}
            className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[24px] bg-white text-[#336CFF] shadow-[0_10px_28px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Open SportHub"
          >
            <ExternalLink className="h-7 w-7" strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[480px] space-y-4 px-4 pb-6 pt-2">
        <button
          type="button"
          onClick={() => openSportHub("approved_banner")}
          className="block w-full overflow-hidden rounded-[28px] bg-transparent text-start shadow-[0_18px_36px_rgba(15,23,42,0.10)] ring-1 ring-[#DDE7F4] active:scale-[0.99]"
          aria-label="Open SportHub"
        >
          <img
            src="/sporthub-banner.png"
            alt="Nutrio x SportHub - Book courts, classes and matches"
            className="block h-auto w-full"
          />
        </button>

        <section className="grid grid-cols-2 gap-2 px-0.5">
          <Button
            type="button"
            onClick={() => openUrl(SPORTHUB_APP_STORE_URL, "app_store")}
            variant="outline"
            className="relative h-[48px] w-full justify-center rounded-[18px] border-[#E3E8F0] bg-white px-10 text-[#020617] shadow-[0_10px_22px_rgba(15,23,42,0.06)] hover:bg-white active:scale-[0.98]"
          >
            <Apple className="absolute left-5 h-5 w-5 fill-[#020617] text-[#020617]" strokeWidth={2.2} />
            <span className="whitespace-nowrap text-[12px] font-black tracking-[-0.02em]">App Store</span>
            <ChevronRight className="absolute right-4 h-4 w-4 text-[#334155]" strokeWidth={2.3} />
          </Button>
          <Button
            type="button"
            onClick={() => openUrl(SPORTHUB_GOOGLE_PLAY_URL, "google_play")}
            variant="outline"
            className="relative h-[48px] w-full justify-center rounded-[18px] border-[#E3E8F0] bg-white px-10 text-[#020617] shadow-[0_10px_22px_rgba(15,23,42,0.06)] hover:bg-white active:scale-[0.98]"
          >
            <GooglePlayIcon className="absolute left-5 h-5 w-5" />
            <span className="whitespace-nowrap text-[12px] font-black tracking-[-0.02em]">Google Play</span>
            <ChevronRight className="absolute right-4 h-4 w-4 text-[#334155]" strokeWidth={2.3} />
          </Button>
        </section>

        <button
          type="button"
          onClick={() => openSportHub("sports_view_all")}
          className="-mx-1 block w-[calc(100%+0.5rem)] overflow-hidden rounded-[30px] bg-white text-start shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1] active:scale-[0.99]"
          aria-label="View SportHub sports"
        >
          <img
            src="/sporthub-sports-card.png"
            alt="Sports in Qatar - Choose your play"
            className="block h-auto w-full"
          />
        </button>

        <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#336CFF]">How SportHub works</p>
          <h2 className="mt-1 text-[26px] font-black tracking-[-0.05em]">Book in three taps</h2>
          <div className="mt-5 overflow-hidden rounded-[24px] bg-white ring-1 ring-[#E5EAF1]">
            {bookingSteps.map(({ title, detail, Icon, tone }, index) => (
              <div
                key={title}
                className={cn("flex min-h-[78px] items-center gap-4 bg-white px-3.5 py-3", index > 0 && "border-t border-[#E5EAF1]")}
              >
                <div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-full", tone)}>
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-black tracking-[-0.02em] text-[#020617]">{title}</p>
                  <p className="mt-1 text-[13px] font-bold leading-5 text-[#64748B]">{detail}</p>
                </div>
                <span className="px-2 text-[22px] font-black tracking-[-0.04em] text-[#336CFF]">0{index + 1}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="-mx-1 w-[calc(100%+0.5rem)] overflow-hidden rounded-[30px] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-[#B9F1E4]">
          <img
            src="/sporthub-recovery-layer.png"
            alt="Nutrio recovery layer"
            className="block h-auto w-full"
          />
        </div>

        <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_30px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#EEF4FF] text-[#336CFF]">
              <ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-black tracking-[-0.03em]">Tracked offer code</h2>
              <p className="mt-1 text-[12px] font-bold leading-5 text-[#64748B]">Use this code when SportHub asks for your Nutrio offer.</p>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#F6F8FB] px-4 text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1] active:scale-95"
            >
              <Copy className="h-4 w-4" />
              {SPORTHUB_REFERRAL_CODE}
            </button>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_30px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">Account link</p>
              <h2 className="mt-1 text-[22px] font-black tracking-[-0.04em]">Personalize recovery</h2>
              <p className="mt-2 text-[13px] font-bold leading-6 text-[#64748B]">
                Connect SportHub so Nutrio can adjust meal, hydration, and recovery reminders around your activity.
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em]",
                isLinked ? "bg-[#E9FBF7] text-[#0FAE87]" : isLinkPending ? "bg-[#EFF9FF] text-[#38BDF8]" : "bg-[#F6F8FB] text-[#94A3B8]",
              )}
            >
              {integrationLoading ? "Checking" : isLinked ? "Connected" : isLinkPending ? "Pending" : "Off"}
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            {[
              "Booking time and activity type only.",
              "You can unlink anytime.",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-[18px] bg-[#F6F8FB] px-3 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C7A1]" strokeWidth={2.4} />
                <p className="text-[12px] font-bold leading-5 text-[#64748B]">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <Button
              type="button"
              onClick={requestSportHubLink}
              disabled={integrationLoading || integrationSaving || isLinked}
              className="h-[52px] rounded-[19px] bg-[#22C7A1] text-[13px] font-black text-white hover:bg-[#16B08D] disabled:opacity-70"
            >
              {isLinked ? "SportHub connected" : isLinkPending ? "Continue linking" : "Link SportHub"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={isLinked || isLinkPending ? revokeSportHubLink : skipSportHubLink}
              disabled={integrationLoading || integrationSaving}
              className="h-[52px] rounded-[19px] border-[#E5EAF1] bg-white px-5 text-[13px] font-black text-[#020617] disabled:opacity-50"
            >
              {isLinked || isLinkPending ? "Unlink" : "Not now"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
