import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarCheck2, CheckCircle2, Flame, ShieldCheck, Utensils } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/contexts/AnalyticsContext";

const SPORTHUB_TO_NUTRIO_CODE = "SPORTHUB15";

const buildAuthUrl = (campaign: string) => {
  const params = new URLSearchParams({
    source: "sporthub",
    campaign,
    code: SPORTHUB_TO_NUTRIO_CODE,
  });

  return `/auth?${params.toString()}`;
};

export default function SportHubWelcome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trackEvent, trackPageView } = useAnalytics();
  const campaign = searchParams.get("campaign") || "sporthub_partner";
  const sportHubUser = searchParams.get("sporthub_user");

  useEffect(() => {
    document.title = "SportHub Offer - Nutrio";

    const payload = {
      source: "sporthub",
      campaign,
      code: SPORTHUB_TO_NUTRIO_CODE,
      sporthub_user: sportHubUser,
      visited_at: new Date().toISOString(),
    };

    localStorage.setItem("nutrio:partner-referral", JSON.stringify(payload));
    trackPageView("sporthub_to_nutrio_welcome", payload);
    trackEvent("sporthub_to_nutrio_landing_opened", payload);
  }, [campaign, sportHubUser, trackEvent, trackPageView]);

  const startNutrio = () => {
    trackEvent("sporthub_to_nutrio_signup_clicked", {
      source: "sporthub",
      campaign,
      code: SPORTHUB_TO_NUTRIO_CODE,
    });
    navigate(buildAuthUrl(campaign));
  };

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#F6F8FB] px-4 py-5 text-[#020617]">
      <div className="mx-auto flex min-h-[calc(100dvh-40px)] max-w-[480px] flex-col">
        <section className="overflow-hidden rounded-[34px] border border-[#CDEFE7] bg-white shadow-[0_22px_52px_rgba(2,6,23,0.08)]">
          <div className="relative bg-[#F7FFFC] p-5">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#DDF7F0]" />
            <div className="absolute bottom-6 right-8 h-24 w-24 rounded-full bg-[#EFF9FF]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[26px] bg-[#22C7A1] text-white shadow-[0_18px_32px_rgba(34,199,161,0.25)]">
                <Utensils className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <span className="rounded-full bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#22C7A1] ring-1 ring-[#DCEFEB]">
                {SPORTHUB_TO_NUTRIO_CODE}
              </span>
            </div>

            <div className="relative mt-6">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#22C7A1]">SportHub x Nutrio</p>
              <h1 className="mt-2 text-[36px] font-black leading-[1.02] tracking-[-0.06em]">
                Fuel your next session
              </h1>
              <p className="mt-3 text-[15px] font-bold leading-7 text-[#64748B]">
                Get healthy meals planned around training days, recovery, and your weekly routine in Qatar.
              </p>
            </div>

            <div className="relative mt-6 rounded-[26px] border border-[#E5EAF1] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[20px] bg-[#FFF3EA] text-[#F97316]">
                  <Flame className="h-6 w-6 fill-current" />
                </div>
                <div>
                  <p className="text-[24px] font-black leading-none tracking-[-0.04em]">15% off</p>
                  <p className="mt-1 text-[12px] font-bold text-[#64748B]">first Nutrio meal plan</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3">
          {[
            { Icon: CalendarCheck2, title: "Plan training meals", detail: "Match meals with SportHub activity days.", color: "bg-[#EFF9FF] text-[#38BDF8]" },
            { Icon: CheckCircle2, title: "Recover smarter", detail: "Protein, calories, and hydration stay visible.", color: "bg-[#F3F4FF] text-[#7C83F6]" },
            { Icon: ShieldCheck, title: "Private by default", detail: "No SportHub data is used without your consent.", color: "bg-[#E9FBF7] text-[#22C7A1]" },
          ].map(({ Icon, title, detail, color }) => (
            <div key={title} className="flex items-center gap-3 rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.045)]">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${color}`}>
                <Icon className="h-5 w-5" strokeWidth={2.3} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-black">{title}</p>
                <p className="mt-1 text-[12px] font-bold leading-5 text-[#64748B]">{detail}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="mt-auto pt-5">
          <Button
            type="button"
            onClick={startNutrio}
            className="h-[60px] w-full rounded-[22px] bg-[#020617] text-[14px] font-black uppercase tracking-[0.12em] text-white shadow-[0_18px_38px_rgba(2,6,23,0.18)] hover:bg-[#020617] active:scale-[0.99]"
          >
            Start with Nutrio
            <ArrowRight className="ms-2 h-5 w-5" />
          </Button>
          <button
            type="button"
            onClick={() => navigate("/meals")}
            className="mt-3 h-14 w-full rounded-[22px] border border-[#DDE5EE] bg-white text-[14px] font-black text-[#020617] shadow-[0_12px_28px_rgba(2,6,23,0.04)] active:scale-[0.99]"
          >
            Browse meals first
          </button>
        </div>
      </div>
    </main>
  );
}
