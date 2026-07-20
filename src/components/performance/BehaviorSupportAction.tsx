import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Clock3, HelpCircle, Sparkles, X } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { type BehaviorBarrier, useBehaviorSupport } from "@/hooks/useBehaviorSupport";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    eyebrow: "ONE SMALL STEP",
    why: "What may get in the way?",
    saved: "Thanks. We will adapt the next suggestion.",
    done: "Done",
    barriers: { time: "Time", choice: "Too many choices", energy: "Low energy", hunger: "Hunger", routine: "Routine", none: "Nothing" },
  },
  ar: {
    eyebrow: "خطوة صغيرة واحدة",
    why: "ما الذي قد يعيقك؟",
    saved: "شكراً. سنكيّف الاقتراح القادم.",
    done: "تم",
    barriers: { time: "الوقت", choice: "كثرة الخيارات", energy: "طاقة منخفضة", hunger: "الجوع", routine: "الروتين", none: "لا شيء" },
  },
} as const;

const BARRIERS: BehaviorBarrier[] = ["time", "choice", "energy", "hunger", "routine", "none"];

export function BehaviorSupportAction() {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const copy = COPY[language === "ar" ? "ar" : "en"];
  const support = useBehaviorSupport("dashboard");
  const shownRef = useRef<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const item = support.data;

  useEffect(() => {
    if (!item?.available || !item.intervention_id || shownRef.current === item.intervention_id) return;
    shownRef.current = item.intervention_id;
    support.recordEvent.mutate({ interventionId: item.intervention_id, event: "shown" });
  }, [item?.available, item?.intervention_id, support.recordEvent]);

  if (!item?.available || !item.intervention_id || !item.title || !item.body) return null;

  const act = () => {
    support.recordEvent.mutate({ interventionId: item.intervention_id!, event: "acted" });
    if (item.action_route) navigate(item.action_route);
  };

  const chooseBarrier = (barrier: BehaviorBarrier) => {
    support.submitReflection.mutate({ barrier }, {
      onSuccess: () => {
        setSaved(true);
        window.setTimeout(() => setReflecting(false), 900);
      },
    });
  };

  return (
    <div className="mt-4 rounded-2xl bg-white/90 p-3 ring-1 ring-slate-200" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3F4] text-[#FB6B7A]">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#FB6B7A]">{copy.eyebrow}</p>
          <h3 className="mt-0.5 text-[14px] font-black leading-5 text-[#020617]">{item.title}</h3>
          <p className="mt-1 text-[11px] font-semibold leading-[17px] text-[#64748B]">{item.body}</p>
        </div>
        <button
          type="button"
          onClick={() => support.recordEvent.mutate({ interventionId: item.intervention_id!, event: "dismissed" })}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#94A3B8] active:scale-95"
          aria-label={language === "ar" ? "إخفاء الاقتراح" : "Dismiss suggestion"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {reflecting ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#020617]">
            <HelpCircle className="h-4 w-4 text-[#7C83F6]" /> {saved ? copy.saved : copy.why}
          </p>
          {!saved && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {BARRIERS.map((barrier) => (
                <button
                  key={barrier}
                  type="button"
                  onClick={() => chooseBarrier(barrier)}
                  disabled={support.submitReflection.isPending}
                  className="min-h-10 shrink-0 rounded-full bg-[#F6F8FB] px-3 text-[10px] font-extrabold text-[#475569] ring-1 ring-slate-200 active:scale-95 disabled:opacity-50"
                >
                  {copy.barriers[barrier]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[1fr_44px] gap-2">
          <button
            type="button"
            onClick={act}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#020617] px-4 text-[11px] font-black text-white active:scale-[0.98]"
          >
            {item.action_label}
            <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
          </button>
          <button
            type="button"
            onClick={() => setReflecting(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6F8FB] text-[#475569] ring-1 ring-slate-200 active:scale-95"
            title={copy.why}
            aria-label={copy.why}
          >
            <Clock3 className="h-4 w-4 text-[#7C83F6]" />
          </button>
        </div>
      )}

      {item.status === "completed" && <Check className="mt-2 h-4 w-4 text-[#22C7A1]" aria-label={copy.done} />}
    </div>
  );
}
