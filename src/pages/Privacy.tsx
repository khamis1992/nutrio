import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const Privacy = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl sm:max-w-4xl">
        <div className="flex justify-start rtl:flex-row-reverse">
          <Link to="/policies">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2 rtl-flip-back" />
              {t("back_to_policies")}
            </Button>
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8">{t("privacy_title")}</h1>
        <p className="text-muted-foreground mb-8">{t("privacy_last_updated")}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_intro_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("privacy_intro_text")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_info_collect_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t("privacy_info_collect_text")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>{t("privacy_info_collect_item_1")}</li>
              <li>{t("privacy_info_collect_item_2")}</li>
              <li>{t("privacy_info_collect_item_3")}</li>
              <li>{t("privacy_info_collect_item_4")}</li>
              <li>{t("privacy_info_collect_item_5")}</li>
              <li>{t("privacy_info_collect_item_6")}</li>
              <li>{t("privacy_info_collect_item_7")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_info_use_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t("privacy_info_use_text")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>{t("privacy_info_use_item_1")}</li>
              <li>{t("privacy_info_use_item_2")}</li>
              <li>{t("privacy_info_use_item_3")}</li>
              <li>{t("privacy_info_use_item_4")}</li>
              <li>{t("privacy_info_use_item_5")}</li>
              <li>{t("privacy_info_use_item_6")}</li>
              <li>{t("privacy_info_use_item_7")}</li>
              <li>{t("privacy_info_use_item_8")}</li>
              <li>{t("privacy_info_use_item_9")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_sharing_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t("privacy_sharing_text")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>{t("privacy_sharing_item_1").split(':')[0]}:</strong> {t("privacy_sharing_item_1").split(':')[1]}</li>
              <li><strong>{t("privacy_sharing_item_2").split(':')[0]}:</strong> {t("privacy_sharing_item_2").split(':')[1]}</li>
              <li><strong>{t("privacy_sharing_item_3").split(':')[0]}:</strong> {t("privacy_sharing_item_3").split(':')[1]}</li>
              <li><strong>{t("privacy_sharing_item_4").split(':')[0]}:</strong> {t("privacy_sharing_item_4").split(':')[1]}</li>
              <li><strong>{t("privacy_sharing_item_5").split(':')[0]}:</strong> {t("privacy_sharing_item_5").split(':')[1]}</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              {t("privacy_sharing_no_sell")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_security_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("privacy_security_text")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_retention_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("privacy_retention_text")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_rights_title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t("privacy_rights_text")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>{t("privacy_rights_item_1")}</li>
              <li>{t("privacy_rights_item_2")}</li>
              <li>{t("privacy_rights_item_3")}</li>
              <li>{t("privacy_rights_item_4")}</li>
              <li>{t("privacy_rights_item_5")}</li>
              <li>{t("privacy_rights_item_6")}</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              {t("privacy_rights_contact")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_cookies_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("privacy_cookies_text")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_children_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("privacy_children_text")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_changes_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("privacy_changes_text")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t("privacy_contact_title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("privacy_contact_text")}
            </p>
            <div className="mt-4 text-muted-foreground">
              <p>{t("privacy_contact_email")}</p>
              <p>{t("privacy_contact_address")}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
