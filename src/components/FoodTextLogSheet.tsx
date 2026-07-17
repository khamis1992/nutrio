import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  MessageSquareText,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveFoodText, type ResolvedFoodPhrase } from "@/lib/food-text-parser";
import { createFoodProviderRegistry } from "@/lib/food-providers";
import { logMealItemsResilient } from "@/lib/meal-log-service";

interface FoodTextLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogComplete?: () => void;
}

const copy = {
  en: {
    title: "Describe your meal",
    subtitle: "Write naturally. You will review every match before it is logged.",
    placeholder: "e.g. I ate 2 eggs, chicken salad and one cup of rice",
    examples: ["2 eggs and toast", "Chicken salad, one serving", "كوب رز و 150 غ دجاج"],
    analyze: "Find foods",
    analyzing: "Finding matches...",
    review: "Review matches",
    reviewHint: "Nutrition comes from your history and the Nutrio catalog.",
    noMatch: "No catalog match",
    remove: "Remove item",
    servingEstimate: "The entered measurement has no serving weight in the catalog. Review the serving multiplier.",
    lowConfidence: "Check this match before logging.",
    servingMultiplier: "Serving multiplier",
    total: "Meal total",
    log: "Log reviewed meal",
    logging: "Logging meal...",
    back: "Edit text",
    empty: "Describe at least one food.",
    noResolved: "No foods were matched. Try shorter food names or use Quick add.",
    saved: "Meal logged",
    failed: "Could not log this meal",
  },
  ar: {
    title: "صف وجبتك",
    subtitle: "اكتب بطريقتك الطبيعية، ثم راجع كل عنصر قبل تسجيله.",
    placeholder: "مثال: أكلت بيضتين وسلطة دجاج وكوب رز",
    examples: ["بيضتين وخبز", "سلطة دجاج، حصة واحدة", "كوب رز و 150 غ دجاج"],
    analyze: "البحث عن الأطعمة",
    analyzing: "جاري مطابقة الأطعمة...",
    review: "راجع النتائج",
    reviewHint: "القيم مأخوذة من سجلك ومن كتالوج Nutrio.",
    noMatch: "لا توجد مطابقة في الكتالوج",
    remove: "حذف العنصر",
    servingEstimate: "وزن الحصة غير متوفر لهذا القياس. راجع معامل الحصة قبل التسجيل.",
    lowConfidence: "تحقق من هذه المطابقة قبل التسجيل.",
    servingMultiplier: "معامل الحصة",
    total: "إجمالي الوجبة",
    log: "تسجيل الوجبة بعد المراجعة",
    logging: "جاري تسجيل الوجبة...",
    back: "تعديل النص",
    empty: "اكتب طعاماً واحداً على الأقل.",
    noResolved: "لم نجد أطعمة مطابقة. استخدم أسماء أقصر أو الإضافة السريعة.",
    saved: "تم تسجيل الوجبة",
    failed: "تعذر تسجيل الوجبة",
  },
};

function getSelectedCandidate(item: ResolvedFoodPhrase) {
  return item.candidates.find((candidate) => candidate.id === item.selectedId) ?? null;
}

function formatAmount(item: ResolvedFoodPhrase) {
  const labels = {
    serving: "serving",
    piece: "piece",
    cup: "cup",
    gram: "g",
    milliliter: "ml",
  };
  return `${item.amount} ${labels[item.unit]}`;
}

export function FoodTextLogSheet({ open, onOpenChange, onLogComplete }: FoodTextLogSheetProps) {
  const { user } = useAuth();
  const { language, isRTL } = useLanguage();
  const text = copy[language];
  const [input, setInput] = useState("");
  const [items, setItems] = useState<ResolvedFoodPhrase[]>([]);
  const [view, setView] = useState<"input" | "review">("input");
  const [busy, setBusy] = useState(false);

  const registry = useMemo(
    () => user?.id ? createFoodProviderRegistry(user.id) : null,
    [user?.id],
  );

  const selected = useMemo(
    () => items.flatMap((item) => {
      const candidate = getSelectedCandidate(item);
      return candidate ? [{ item, candidate }] : [];
    }),
    [items],
  );

  const totals = useMemo(() => selected.reduce((sum, { item, candidate }) => ({
    calories: sum.calories + Math.round(candidate.calories * item.quantity),
    protein: sum.protein + Math.round(candidate.protein_g * item.quantity),
    carbs: sum.carbs + Math.round(candidate.carbs_g * item.quantity),
    fat: sum.fat + Math.round(candidate.fat_g * item.quantity),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [selected]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !busy) {
      setInput("");
      setItems([]);
      setView("input");
    }
    onOpenChange(nextOpen);
  };

  const analyze = async () => {
    if (!registry || !input.trim()) {
      toast.error(text.empty);
      return;
    }
    setBusy(true);
    try {
      const resolved = await resolveFoodText(input, registry);
      if (resolved.length === 0) {
        toast.error(text.empty);
        return;
      }
      setItems(resolved);
      setView("review");
    } catch (error) {
      console.error("Failed to parse food text:", error);
      toast.error(text.failed);
    } finally {
      setBusy(false);
    }
  };

  const updateItem = (index: number, change: Partial<ResolvedFoodPhrase>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const logMeal = async () => {
    if (!user?.id || selected.length === 0) {
      toast.error(text.noResolved);
      return;
    }
    setBusy(true);
    try {
      const result = await logMealItemsResilient({
        userId: user.id,
        source: "natural_language",
        items: selected.map(({ item, candidate }) => ({
          name: candidate.name,
          calories: candidate.calories,
          protein_g: candidate.protein_g,
          carbs_g: candidate.carbs_g,
          fat_g: candidate.fat_g,
          fiber_g: candidate.fiber_g,
          sugar_g: candidate.sugar_g,
          sodium_mg: candidate.sodium_mg,
          image_url: candidate.image_url,
          quantity: item.quantity,
        })),
      });
      if (result.persisted) {
        toast.success(text.saved, { description: `${result.calories} kcal` });
      } else {
        toast.success(language === "ar" ? "حُفظت دون اتصال" : "Saved offline");
      }
      onLogComplete?.();
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to log natural-language meal:", error);
      toast.error(text.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        dir={isRTL ? "rtl" : "ltr"}
        className="z-[1301] flex h-[92dvh] flex-col overflow-hidden rounded-t-[28px] border-0 bg-white p-0 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">{text.title}</SheetTitle>
        <header className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E8FBF6] text-[#12A987] ring-1 ring-[#22C7A1]/20">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-black text-[#020617]">{text.title}</h2>
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">{text.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {view === "input" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-slate-200/80">
                <textarea
                  autoFocus
                  value={input}
                  maxLength={500}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={text.placeholder}
                  className="min-h-36 w-full resize-none bg-transparent px-2 py-1 text-[17px] font-bold leading-relaxed text-[#020617] outline-none placeholder:text-slate-400"
                />
                <div className="flex items-center justify-between px-2 pt-2 text-[11px] font-bold text-slate-400">
                  <span>{language === "ar" ? "حتى 8 عناصر" : "Up to 8 items"}</span>
                  <span>{input.length}/500</span>
                </div>
              </div>

              <p className="mb-3 mt-5 text-[11px] font-extrabold uppercase text-slate-400">
                {language === "ar" ? "جرّب مثالاً" : "Try an example"}
              </p>
              <div className="flex flex-wrap gap-2">
                {text.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setInput(example)}
                    className="min-h-10 rounded-full bg-white px-4 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                  >
                    {example}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex gap-3 rounded-2xl bg-[#FFF8ED] p-4 text-[#8A4B08] ring-1 ring-orange-100">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7A00]" />
                <p className="text-xs font-semibold leading-relaxed">
                  {language === "ar"
                    ? "يمكنك ذكر العدد أو الحصة أو الوزن. لن يُسجل أي شيء قبل أن تراجع النتائج."
                    : "Include counts, servings, or weights. Nothing is logged until you review the matches."}
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
              <Button
                type="button"
                disabled={busy || !input.trim()}
                onClick={analyze}
                className="h-[52px] w-full rounded-full bg-[#020617] text-[15px] font-extrabold text-white hover:bg-slate-800"
              >
                {busy ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Sparkles className="me-2 h-5 w-5 text-[#55E0BD]" />}
                {busy ? text.analyzing : text.analyze}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-[#020617]">{text.review}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">{text.reviewHint}</p>
                </div>
                <button type="button" onClick={() => setView("input")} className="shrink-0 text-xs font-extrabold text-[#12A987]">
                  {text.back}
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const candidate = getSelectedCandidate(item);
                  const needsReview = item.confidence === "low" || item.usesServingEstimate;
                  return (
                    <article key={`${item.raw}-${index}`} className="rounded-[20px] bg-white p-4 ring-1 ring-slate-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-400">“{item.raw}”</p>
                          <p className="mt-1 text-[11px] font-extrabold uppercase text-[#12A987]">{formatAmount(item)}</p>
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label={text.remove}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {item.candidates.length > 0 ? (
                        <div className="relative mt-3">
                          <select
                            aria-label={language === "ar" ? "اختر الطعام المطابق" : "Choose matching food"}
                            value={item.selectedId ?? ""}
                            onChange={(event) => updateItem(index, { selectedId: event.target.value, confidence: "medium" })}
                            className="h-12 w-full appearance-none rounded-xl border-0 bg-[#F6F8FB] px-3 pe-10 text-sm font-extrabold text-[#020617] outline-none ring-1 ring-slate-200"
                          >
                            {item.candidates.map((option) => (
                              <option key={option.id} value={option.id}>{option.name} · {Math.round(option.calories)} kcal</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
                          <AlertCircle className="h-4 w-4 shrink-0" /> {text.noMatch}
                        </div>
                      )}

                      {candidate && (
                        <>
                          <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-50 p-2.5 text-center">
                            {[
                              [Math.round(candidate.calories * item.quantity), "kcal"],
                              [Math.round(candidate.protein_g * item.quantity), "P"],
                              [Math.round(candidate.carbs_g * item.quantity), "C"],
                              [Math.round(candidate.fat_g * item.quantity), "F"],
                            ].map(([value, label]) => (
                              <div key={label}>
                                <p className="text-sm font-black text-[#020617]">{value}</p>
                                <p className="text-[9px] font-extrabold uppercase text-slate-400">{label}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-slate-500">{text.servingMultiplier}</span>
                            <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                              <button type="button" onClick={() => updateItem(index, { quantity: Math.max(0.25, Number((item.quantity - 0.25).toFixed(2))) })} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm" aria-label="Decrease serving">
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-10 text-center text-sm font-black text-[#020617]">{item.quantity}×</span>
                              <button type="button" onClick={() => updateItem(index, { quantity: Math.min(10, Number((item.quantity + 0.25).toFixed(2))) })} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm" aria-label="Increase serving">
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {candidate && needsReview && (
                        <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-[11px] font-semibold leading-relaxed text-amber-800">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {item.usesServingEstimate ? text.servingEstimate : text.lowConfidence}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>

              {selected.length > 0 && (
                <section className="mt-5 rounded-[22px] bg-[#07142E] p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase text-[#55E0BD]">{text.total}</p>
                      <p className="mt-1 text-3xl font-black">{totals.calories} <span className="text-xs font-bold text-slate-400">kcal</span></p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#22C7A1] text-[#07142E]"><Check className="h-5 w-5" /></span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 border-t border-white/10 pt-3 text-center">
                    <p className="text-sm font-black">{totals.protein}g <span className="block text-[9px] uppercase text-slate-400">Protein</span></p>
                    <p className="border-x border-white/10 text-sm font-black">{totals.carbs}g <span className="block text-[9px] uppercase text-slate-400">Carbs</span></p>
                    <p className="text-sm font-black">{totals.fat}g <span className="block text-[9px] uppercase text-slate-400">Fat</span></p>
                  </div>
                </section>
              )}
            </div>

            <div className="border-t border-slate-100 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
              <Button
                type="button"
                disabled={busy || selected.length === 0}
                onClick={logMeal}
                className="h-[52px] w-full rounded-full bg-[#020617] text-[15px] font-extrabold text-white hover:bg-slate-800"
              >
                {busy ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Check className="me-2 h-5 w-5 text-[#55E0BD]" />}
                {busy ? text.logging : text.log}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default FoodTextLogSheet;
