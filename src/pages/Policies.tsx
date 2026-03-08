import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Shield, HelpCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

const Policies = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const policyLinks = [
    {
      icon: FileText,
      titleKey: "terms_of_service_card",
      descriptionKey: "terms_of_service_desc",
      path: "/terms",
    },
    {
      icon: Shield,
      titleKey: "privacy_policy_card",
      descriptionKey: "privacy_policy_desc",
      path: "/privacy",
    },
    {
      icon: HelpCircle,
      titleKey: "faq_card",
      descriptionKey: "faq_desc",
      path: "/faq",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-4 rtl:flex-row-reverse">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{t("policies_legal")}</h1>
            <p className="text-xs text-muted-foreground">{t("policies_subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-3 max-w-2xl mx-auto">
        {policyLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.path}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{t(item.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(item.descriptionKey)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Policies;
