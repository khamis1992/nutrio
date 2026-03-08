import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const Terms = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl sm:max-w-4xl">
        <div className="flex justify-start rtl:flex-row-reverse">
          <Link to="/policies">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("back")}
            </Button>
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8">{t("terms_of_service")}</h1>
        <p className="text-muted-foreground mb-8">{t("terms_last_updated")}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_acceptance_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_acceptance_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_description_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_description_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_registration_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t("terms_registration_desc")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>{t("terms_registration_req1")}</li>
              <li>{t("terms_registration_req2")}</li>
              <li>{t("terms_registration_req3")}</li>
              <li>{t("terms_registration_req4")}</li>
              <li>{t("terms_registration_req5")}</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              {t("terms_registration_note")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_subscriptions_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t("terms_subscriptions_41")}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t("terms_subscriptions_42")}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t("terms_subscriptions_43")}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_subscriptions_44")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_orders_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t("terms_orders_51")}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t("terms_orders_52")}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_orders_53")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_health_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t("terms_health_61")}
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t("terms_health_62")}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_health_63")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_conduct_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t("terms_conduct_desc")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>{t("terms_conduct_req1")}</li>
              <li>{t("terms_conduct_req2")}</li>
              <li>{t("terms_conduct_req3")}</li>
              <li>{t("terms_conduct_req4")}</li>
              <li>{t("terms_conduct_req5")}</li>
              <li>{t("terms_conduct_req6")}</li>
              <li>{t("terms_conduct_req7")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_ip_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_ip_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_liability_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_liability_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_warranties_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_warranties_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_indemnification_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_indemnification_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_dispute_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_dispute_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_law_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_law_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_severability_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_severability_desc")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("terms_contact_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("terms_contact_desc")}
            </p>
            <div className="mt-4 text-muted-foreground">
              <p>{t("terms_email")}</p>
              <p>{t("terms_address")}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
