import { useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, ChevronDown, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type VerificationTier =
  | "recipe_standardized"
  | "dietitian_reviewed"
  | "lab_tested";

interface MealVerification {
  meal_id: string;
  tier: VerificationTier;
  nutrition_version: number;
  public_summary: string;
  verified_at: string;
  expires_at: string;
  nutrition_source: string | null;
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args: Record<string, unknown>,
) => Promise<RpcResult>;

function isMealVerification(value: unknown): value is MealVerification {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.meal_id === "string" &&
    typeof row.tier === "string" &&
    typeof row.nutrition_version === "number" &&
    typeof row.public_summary === "string" &&
    typeof row.verified_at === "string" &&
    typeof row.expires_at === "string"
  );
}

export function NutrioVerifiedBadge({ mealId }: { mealId: string }) {
  const { isRTL } = useLanguage();
  const [verification, setVerification] = useState<MealVerification | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    void callRpc("get_current_meal_nutrition_verification", {
      p_meal_id: mealId,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Could not load Nutrio Verified claim", error.message);
        return;
      }
      setVerification(isMealVerification(data) ? data : null);
    });
    return () => {
      active = false;
    };
  }, [mealId]);

  if (!verification) return null;

  const tierLabels: Record<VerificationTier, { en: string; ar: string }> = {
    recipe_standardized: { en: "Standardized recipe", ar: "وصفة موحدة" },
    dietitian_reviewed: { en: "Dietitian reviewed", ar: "مراجعة اختصاصي تغذية" },
    lab_tested: { en: "Lab tested", ar: "مختبرة مخبرياً" },
  };
  const tier = tierLabels[verification.tier] ?? tierLabels.recipe_standardized;
  const expiry = new Intl.DateTimeFormat(isRTL ? "ar-QA" : "en-QA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(verification.expires_at));

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      className="mt-3 overflow-hidden rounded-[17px] border border-[#22C7A1]/30 bg-[#ECFDF8]"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-start"
        aria-expanded={expanded}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#22C7A1] shadow-sm">
          <BadgeCheck className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-black text-[#020617]">
            {isRTL ? "موثقة من Nutrio" : "Nutrio Verified"}
          </span>
          <span className="block truncate text-[10px] font-bold text-[#64748B]">
            {isRTL ? tier.ar : tier.en} · {isRTL ? "الإصدار" : "version"}{" "}
            {verification.nutrition_version}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[#64748B] transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#22C7A1]/20 bg-white px-3 py-3">
          <p className="text-[11px] font-semibold leading-5 text-[#64748B]">
            {verification.public_summary}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[12px] bg-[#F6F8FB] px-3 py-2">
              <p className="flex items-center gap-1 text-[9px] font-black uppercase text-[#94A3B8]">
                <ShieldCheck className="h-3 w-3 text-[#7C83F6]" />
                {isRTL ? "المستوى" : "Level"}
              </p>
              <p className="mt-1 text-[10px] font-black text-[#020617]">
                {isRTL ? tier.ar : tier.en}
              </p>
            </div>
            <div className="rounded-[12px] bg-[#F6F8FB] px-3 py-2">
              <p className="flex items-center gap-1 text-[9px] font-black uppercase text-[#94A3B8]">
                <CalendarClock className="h-3 w-3 text-[#38BDF8]" />
                {isRTL ? "صالحة حتى" : "Valid until"}
              </p>
              <p className="mt-1 text-[10px] font-black text-[#020617]">{expiry}</p>
            </div>
          </div>
          <p className="mt-2 text-[9px] font-semibold leading-4 text-[#94A3B8]">
            {isRTL
              ? "يرتبط التحقق بهذه النسخة من الوصفة والقيم الغذائية، ويُزال تلقائياً عند تغييرها."
              : "Verification is bound to this recipe and nutrition version and is removed automatically when either changes."}
          </p>
        </div>
      )}
    </section>
  );
}
