import { useState } from "react";
import { Building2, CheckCircle2, ShieldCheck, Utensils } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCorporateBenefit } from "@/hooks/useCorporateBenefit";

export function CorporateBenefitCard() {
  const { language, isRTL } = useLanguage();
  const benefit = useCorporateBenefit();
  const [aggregateConsent, setAggregateConsent] = useState(false);
  const item = benefit.data;
  if (benefit.isLoading || benefit.isError || !item?.membership_id) return null;
  const ar = language === "ar";

  return (
    <section dir={isRTL ? "rtl" : "ltr"} className="mt-5 overflow-hidden rounded-2xl border border-[#DDE4EE] bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF9FF] text-[#38BDF8]">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7C83F6]">{ar ? "ميزة جهة العمل" : "WORKPLACE BENEFIT"}</p>
          <h2 className="mt-1 truncate text-base font-black text-[#020617]">{item.organization_name}</h2>
          {item.status === "active" ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#0A8F73]">
              <CheckCircle2 className="h-4 w-4" />
              {ar ? `${item.remaining_allowance ?? 0} وجبة متبقية هذا الشهر` : `${item.remaining_allowance ?? 0} sponsored meals left this month`}
            </p>
          ) : (
            <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
              {ar ? "لديك أهلية لوجبات مدعومة. فعّلها قبل استخدامها." : "You are eligible for sponsored meals. Activate the benefit before using it."}
            </p>
          )}
        </div>
        <Utensils className="h-5 w-5 shrink-0 text-[#22C7A1]" />
      </div>

      {item.status === "eligible" && (
        <div className="border-t border-[#E5EAF1] bg-[#F6F8FB] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox checked={aggregateConsent} onCheckedChange={(value) => setAggregateConsent(value === true)} />
            <span className="text-[11px] font-semibold leading-5 text-[#64748B]">
              {ar
                ? "أوافق على مشاركة أرقام استخدام مجمعة فقط مع الجهة الراعية، دون الوجبات أو الأهداف أو البيانات الصحية الفردية."
                : "Allow aggregate utilization counts only. Individual meals, goals, and health data are never shared with the sponsor."}
            </span>
          </label>
          <button
            type="button"
            onClick={() => benefit.accept.mutate({ membershipId: item.membership_id!, aggregateConsent })}
            disabled={benefit.accept.isPending}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#020617] text-xs font-black text-white disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" /> {ar ? "تفعيل الميزة" : "Activate benefit"}
          </button>
        </div>
      )}
    </section>
  );
}
