import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

const FAQ = () => {
  const { t } = useLanguage();

  const faqCategories = [
    {
      category: t("faq_category_getting_started"),
      questions: [
        {
          question: t("faq_getting_started_q1"),
          answer: t("faq_getting_started_a1"),
        },
        {
          question: t("faq_getting_started_q2"),
          answer: t("faq_getting_started_a2"),
        },
        {
          question: t("faq_getting_started_q3"),
          answer: t("faq_getting_started_a3"),
        },
      ],
    },
    {
      category: t("faq_category_pricing"),
      questions: [
        {
          question: t("faq_pricing_q1"),
          answer: t("faq_pricing_a1"),
        },
        {
          question: t("faq_pricing_q2"),
          answer: t("faq_pricing_a2"),
        },
        {
          question: t("faq_pricing_q3"),
          answer: t("faq_pricing_a3"),
        },
        {
          question: t("faq_pricing_q4"),
          answer: t("faq_pricing_a4"),
        },
      ],
    },
    {
      category: t("faq_category_meals"),
      questions: [
        {
          question: t("faq_meals_q1"),
          answer: t("faq_meals_a1"),
        },
        {
          question: t("faq_meals_q2"),
          answer: t("faq_meals_a2"),
        },
        {
          question: t("faq_meals_q3"),
          answer: t("faq_meals_a3"),
        },
        {
          question: t("faq_meals_q4"),
          answer: t("faq_meals_a4"),
        },
        {
          question: t("faq_meals_q5"),
          answer: t("faq_meals_a5"),
        },
      ],
    },
    {
      category: t("faq_category_delivery"),
      questions: [
        {
          question: t("faq_delivery_q1"),
          answer: t("faq_delivery_a1"),
        },
        {
          question: t("faq_delivery_q2"),
          answer: t("faq_delivery_a2"),
        },
        {
          question: t("faq_delivery_q3"),
          answer: t("faq_delivery_a3"),
        },
        {
          question: t("faq_delivery_q4"),
          answer: t("faq_delivery_a4"),
        },
      ],
    },
    {
      category: t("faq_category_nutrition"),
      questions: [
        {
          question: t("faq_nutrition_q1"),
          answer: t("faq_nutrition_a1"),
        },
        {
          question: t("faq_nutrition_q2"),
          answer: t("faq_nutrition_a2"),
        },
        {
          question: t("faq_nutrition_q3"),
          answer: t("faq_nutrition_a3"),
        },
        {
          question: t("faq_nutrition_q4"),
          answer: t("faq_nutrition_a4"),
        },
      ],
    },
    {
      category: t("faq_category_account"),
      questions: [
        {
          question: t("faq_account_q1"),
          answer: t("faq_account_a1"),
        },
        {
          question: t("faq_account_q2"),
          answer: t("faq_account_a2"),
        },
        {
          question: t("faq_account_q3"),
          answer: t("faq_account_a3"),
        },
        {
          question: t("faq_account_q4"),
          answer: t("faq_account_a4"),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-start rtl:flex-row-reverse">
          <Link to="/profile">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("back_to_profile")}
            </Button>
          </Link>
        </div>

        <div className="text-center mb-12">
          <Badge variant="soft" className="mb-4">
            <HelpCircle className="w-3 h-3 mr-1" />
            {t("faq_help_center")}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">{t("faq_frequently_asked")}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("faq_find_answers")}{" "}
            <Link to="/contact" className="text-primary hover:underline ml-1">
              {t("faq_contact_us")}
            </Link>
          </p>
        </div>

        <div className="space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary font-bold">
                  {categoryIndex + 1}
                </span>
                {category.category}
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {category.questions.map((item, questionIndex) => (
                  <AccordionItem
                    key={questionIndex}
                    value={`${categoryIndex}-${questionIndex}`}
                    className="border rounded-lg px-3 sm:px-4 py-2 bg-card"
                  >
                    <AccordionTrigger className="text-left hover:no-underline py-3">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        <div className="mt-12 p-8 bg-muted/50 rounded-2xl text-center">
          <h3 className="text-xl font-semibold mb-2">{t("faq_still_questions")}</h3>
          <p className="text-muted-foreground mb-4">{t("faq_support_team")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact">
              <Button variant="default">{t("faq_contact_support")}</Button>
            </Link>
            <Link to="/support">
              <Button variant="outline">{t("faq_submit_ticket")}</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
