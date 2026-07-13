import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  HelpCircle,
  Home,
  MessageCircle,
  Package,
  Search,
  ShieldCheck,
  Truck,
  Utensils,
  X,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const FAQ = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("getting-started");

  const faqCategories = useMemo(
    () => [
      {
        id: "getting-started",
        category: t("faq_category_getting_started"),
        icon: Home,
        color: "#22C7A1",
        bg: "bg-[#EFFFFA]",
        questions: [
          { question: t("faq_getting_started_q1"), answer: t("faq_getting_started_a1") },
          { question: t("faq_getting_started_q2"), answer: t("faq_getting_started_a2") },
          { question: t("faq_getting_started_q3"), answer: t("faq_getting_started_a3") },
        ],
      },
      {
        id: "pricing",
        category: t("faq_category_pricing"),
        icon: CreditCard,
        color: "#7C83F6",
        bg: "bg-[#F3F4FF]",
        questions: [
          { question: t("faq_pricing_q1"), answer: t("faq_pricing_a1") },
          { question: t("faq_pricing_q2"), answer: t("faq_pricing_a2") },
          { question: t("faq_pricing_q3"), answer: t("faq_pricing_a3") },
          { question: t("faq_pricing_q4"), answer: t("faq_pricing_a4") },
        ],
      },
      {
        id: "meals",
        category: t("faq_category_meals"),
        icon: Utensils,
        color: "#FB6B7A",
        bg: "bg-[#FFF0F2]",
        questions: [
          { question: t("faq_meals_q1"), answer: t("faq_meals_a1") },
          { question: t("faq_meals_q2"), answer: t("faq_meals_a2") },
          { question: t("faq_meals_q3"), answer: t("faq_meals_a3") },
          { question: t("faq_meals_q4"), answer: t("faq_meals_a4") },
          { question: t("faq_meals_q5"), answer: t("faq_meals_a5") },
        ],
      },
      {
        id: "delivery",
        category: t("faq_category_delivery"),
        icon: Truck,
        color: "#38BDF8",
        bg: "bg-sky-50",
        questions: [
          { question: t("faq_delivery_q1"), answer: t("faq_delivery_a1") },
          { question: t("faq_delivery_q2"), answer: t("faq_delivery_a2") },
          { question: t("faq_delivery_q3"), answer: t("faq_delivery_a3") },
          { question: t("faq_delivery_q4"), answer: t("faq_delivery_a4") },
        ],
      },
      {
        id: "nutrition",
        category: t("faq_category_nutrition"),
        icon: Package,
        color: "#22C7A1",
        bg: "bg-[#EFFFFA]",
        questions: [
          { question: t("faq_nutrition_q1"), answer: t("faq_nutrition_a1") },
          { question: t("faq_nutrition_q2"), answer: t("faq_nutrition_a2") },
          { question: t("faq_nutrition_q3"), answer: t("faq_nutrition_a3") },
          { question: t("faq_nutrition_q4"), answer: t("faq_nutrition_a4") },
        ],
      },
      {
        id: "account",
        category: t("faq_category_account"),
        icon: ShieldCheck,
        color: "#020617",
        bg: "bg-slate-100",
        questions: [
          { question: t("faq_account_q1"), answer: t("faq_account_a1") },
          { question: t("faq_account_q2"), answer: t("faq_account_a2") },
          { question: t("faq_account_q3"), answer: t("faq_account_a3") },
          { question: t("faq_account_q4"), answer: t("faq_account_a4") },
        ],
      },
    ],
    [t],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchResults = useMemo(
    () =>
      faqCategories.flatMap((category) =>
        category.questions
          .filter(
            ({ question, answer }) =>
              question.toLocaleLowerCase().includes(normalizedQuery) ||
              answer.toLocaleLowerCase().includes(normalizedQuery),
          )
          .map((item) => ({ ...item, category })),
      ),
    [faqCategories, normalizedQuery],
  );

  const activeCategory =
    faqCategories.find((category) => category.id === selectedCategory) ?? faqCategories[0];
  const visibleQuestions = normalizedQuery
    ? searchResults
    : activeCategory.questions.map((item) => ({ ...item, category: activeCategory }));

  return (
    <main
      className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#F6F8FB] text-[#020617] [-webkit-overflow-scrolling:touch]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col pb-[max(28px,env(safe-area-inset-bottom))]">
        <header className="sticky top-0 z-20 border-b border-[#E5EAF1]/80 bg-[#F6F8FB]/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition active:scale-95"
              aria-label={t("back")}
            >
              <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#22C7A1]">
                {t("faq_help_center")}
              </p>
              <h1 className="mt-0.5 whitespace-nowrap text-[17px] font-extrabold text-[#020617]">
                {t("faq_frequently_asked")}
              </h1>
            </div>
            <Link
              to="/support"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition active:scale-95"
              aria-label={t("faq_submit_ticket")}
            >
              <MessageCircle className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <div className="px-4">
          <section className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1]">
                <HelpCircle className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="text-[24px] font-extrabold leading-tight">{t("faq_find_answers")}</h2>
                <p className="mt-1 text-[13px] font-medium text-[#64748B]">{t("faq_verified_note")}</p>
              </div>
            </div>

            <label className="relative mt-4 block">
              <Search
                className={cn("absolute top-1/2 h-5 w-5 -translate-y-1/2 text-[#94A3B8]", isRTL ? "right-4" : "left-4")}
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("faq_search_placeholder")}
                className={cn(
                  "h-13 w-full rounded-2xl border border-[#E5EAF1] bg-white py-3 text-[14px] font-semibold text-[#020617] shadow-[0_8px_24px_rgba(15,23,42,0.04)] outline-none transition placeholder:font-medium placeholder:text-[#94A3B8] focus:border-[#22C7A1] focus:ring-4 focus:ring-[#22C7A1]/10",
                  isRTL ? "pl-12 pr-12" : "pl-12 pr-12",
                )}
                aria-label={t("faq_search_placeholder")}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={cn("absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#64748B]", isRTL ? "left-2" : "right-2")}
                  aria-label={t("clear")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </section>

          {!normalizedQuery && (
            <nav className="-mx-4 mt-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t("faq_browse_topics")}>
              <div className="flex w-max gap-2">
                {faqCategories.map(({ id, category, icon: Icon, color, bg }) => {
                  const isActive = id === activeCategory.id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedCategory(id)}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[12px] font-extrabold ring-1 transition active:scale-[0.98]",
                        isActive
                          ? "bg-[#020617] text-white ring-[#020617] shadow-[0_8px_20px_rgba(2,6,23,0.15)]"
                          : "bg-white text-[#475569] ring-[#E5EAF1]",
                      )}
                      aria-pressed={isActive}
                    >
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", isActive ? "bg-white/12" : bg)} style={{ color: isActive ? "white" : color }}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                      {category}
                    </button>
                  );
                })}
              </div>
            </nav>
          )}

          <section className="mt-4">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#94A3B8]">
                  {normalizedQuery ? t("faq_search_results") : t("faq_browse_topics")}
                </p>
                <h2 className="mt-1 text-[18px] font-extrabold">
                  {normalizedQuery ? `“${query.trim()}”` : activeCategory.category}
                </h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#64748B] ring-1 ring-[#E5EAF1]">
                {visibleQuestions.length}
              </span>
            </div>

            {visibleQuestions.length > 0 ? (
              <Accordion type="single" collapsible className="mt-3 overflow-hidden rounded-2xl border border-[#E5EAF1] bg-white px-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                {visibleQuestions.map((item, index) => (
                  <AccordionItem
                    key={`${item.category.id}-${item.question}`}
                    value={`${item.category.id}-${index}`}
                    className="border-[#E5EAF1] last:border-b-0"
                  >
                    <AccordionTrigger className="min-h-[62px] gap-3 py-4 text-start text-[14px] font-extrabold leading-5 text-[#020617] hover:no-underline">
                      <span className="flex min-w-0 items-center gap-3">
                        {normalizedQuery && (
                          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", item.category.bg)} style={{ color: item.category.color }}>
                            <item.category.icon className="h-4 w-4" />
                          </span>
                        )}
                        <span>{item.question}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 pe-6 text-[13px] font-medium leading-6 text-[#64748B]">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="mt-3 rounded-2xl border border-[#E5EAF1] bg-white px-5 py-8 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[16px] font-extrabold">{t("faq_no_results")}</h3>
                <p className="mx-auto mt-1 max-w-[280px] text-[13px] font-medium leading-5 text-[#64748B]">{t("faq_no_results_desc")}</p>
              </div>
            )}
          </section>

          <section className="mt-5 rounded-2xl border border-[#D9F3EA] bg-[#EFFFFA] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#22C7A1] shadow-sm">
                <MessageCircle className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-extrabold">{t("faq_still_questions")}</h3>
                <p className="mt-0.5 text-[12px] font-medium leading-5 text-[#64748B]">{t("faq_support_team")}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link to="/contact" className="flex h-12 items-center justify-center rounded-2xl bg-white text-[12px] font-extrabold text-[#020617] ring-1 ring-[#DCE5EE] transition active:scale-[0.98]">
                {t("faq_contact_support")}
              </Link>
              <Link to="/support" className="flex h-12 items-center justify-center rounded-2xl bg-[#22C7A1] text-[12px] font-extrabold text-white shadow-[0_8px_20px_rgba(34,199,161,0.22)] transition active:scale-[0.98]">
                {t("faq_submit_ticket")}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default FAQ;
