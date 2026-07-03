import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  HelpCircle,
  Home,
  MessageCircle,
  Package,
  ShieldCheck,
  Truck,
  Utensils,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const FAQ = () => {
  const { t, isRTL } = useLanguage();

  const faqCategories = [
    {
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
  ];

  return (
    <main
      className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#F6F8FB] text-[#020617] [-webkit-overflow-scrolling:touch]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <Link
            to="/contact"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
          </Link>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#22C7A1]">{t("faq_help_center")}</p>
            <h1 className="mt-1 text-[21px] font-black tracking-[-0.03em] text-[#020617]">{t("faq_frequently_asked")}</h1>
          </div>
          <Link
            to="/support"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label={t("faq_submit_ticket")}
          >
            <MessageCircle className="h-5 w-5" />
          </Link>
        </header>

        <section className="mt-5 overflow-hidden rounded-[30px] bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
              <HelpCircle className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[24px] font-black leading-[1.05] tracking-[-0.04em] text-[#020617]">
                {t("faq_find_answers")}
              </h2>
              <p className="mt-2 text-[13px] font-bold leading-5 text-[#64748B]">
                {t("faq_still_questions")}{" "}
                <Link to="/contact" className="font-black text-[#22C7A1]">
                  {t("faq_contact_us")}
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {faqCategories.slice(0, 3).map(({ category, icon: Icon, color, bg }) => (
              <div key={category} className="min-w-0 rounded-[18px] bg-[#F6F8FB] p-2.5 text-center ring-1 ring-[#E5EAF1]">
                <div className={cn("mx-auto flex h-9 w-9 items-center justify-center rounded-full", bg)} style={{ color }}>
                  <Icon className="h-4 w-4" strokeWidth={2.1} />
                </div>
                <p className="mt-2 truncate text-[10px] font-black text-[#020617]">{category}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 space-y-3">
          {faqCategories.map(({ category, questions, icon: Icon, color, bg }, categoryIndex) => (
            <article key={category} className="rounded-[26px] bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1 ring-[#E5EAF1]">
              <div className="mb-2 flex items-center gap-3">
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px]", bg)} style={{ color }}>
                  <Icon className="h-5 w-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    {String(categoryIndex + 1).padStart(2, "0")}
                  </p>
                  <h2 className="truncate text-[15px] font-black text-[#020617]">{category}</h2>
                </div>
                <span className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[10px] font-black text-[#64748B]">
                  {questions.length}
                </span>
              </div>

              <Accordion type="single" collapsible className="space-y-2">
                {questions.map((item, questionIndex) => (
                  <AccordionItem
                    key={item.question}
                    value={`${categoryIndex}-${questionIndex}`}
                    className="rounded-[18px] border border-[#E5EAF1] bg-[#F6F8FB] px-3"
                  >
                    <AccordionTrigger className="min-h-[52px] py-3 text-start text-[13px] font-black leading-5 text-[#020617] hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-[12px] font-bold leading-5 text-[#64748B]">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </article>
          ))}
        </section>

        <section className="mt-4 rounded-[30px] bg-[#020617] p-4 text-white shadow-[0_18px_42px_rgba(2,6,23,0.20)]">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-[#22C7A1]">
              <MessageCircle className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[18px] font-black">{t("faq_still_questions")}</h3>
              <p className="mt-1 text-[12px] font-bold leading-5 text-white/65">{t("faq_support_team")}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/contact">
              <Button className="h-12 w-full rounded-[18px] bg-[#22C7A1] text-[12px] font-black text-white hover:bg-[#18B593]">
                {t("faq_contact_support")}
              </Button>
            </Link>
            <Link to="/support">
              <Button className="h-12 w-full rounded-[18px] bg-white text-[12px] font-black text-[#020617] hover:bg-white/90">
                {t("faq_submit_ticket")}
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
};

export default FAQ;
