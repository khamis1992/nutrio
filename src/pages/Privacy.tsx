import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasAnalyticsConsent, setAnalyticsConsent } from "@/lib/analytics";

const Privacy = () => {
  const { t, language } = useLanguage();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(hasAnalyticsConsent);

  const updateAnalyticsConsent = async (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    await setAnalyticsConsent(enabled);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl sm:max-w-4xl">
        <div className="flex justify-start rtl:flex-row-reverse">
          <Link to="/policies">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("back_to_policies")}
            </Button>
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8">{t("privacy_title")}</h1>
        <p className="text-muted-foreground mb-8">{t("privacy_last_updated")}</p>

        <section className="mb-8 flex items-start gap-3 rounded-[8px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#22C7A1] ring-1 ring-[#E5EAF1]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <label className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="block font-extrabold text-[#020617]">
                {language === "ar" ? "تحليلات الاستخدام الاختيارية" : "Optional usage analytics"}
              </span>
              <span className="mt-1 block text-sm leading-5 text-[#64748B]">
                {language === "ar"
                  ? "متوقفة افتراضيًا. عند تفعيلها نرسل أحداث استخدام منزوعة البيانات الحساسة، ولا نسجل الجلسة أو محتوى التقارير الصحية."
                  : "Off by default. When enabled, Nutrio sends sanitized usage events only; session replay and health-report content remain disabled."}
              </span>
            </span>
            <Switch
              className="mt-1 shrink-0"
              checked={analyticsEnabled}
              onCheckedChange={(enabled) => void updateAnalyticsConsent(enabled)}
              aria-label={language === "ar" ? "السماح بتحليلات الاستخدام" : "Allow usage analytics"}
            />
          </label>
        </section>

        <div className="prose prose-neutral max-w-none space-y-8">
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

          <section className="rounded-[8px] border border-[#DDDFFF] bg-white p-5">
            <h2 className="text-2xl font-semibold mb-4 text-[#020617]">
              {language === "ar" ? "بيانات برامج الدعم الصحي" : "Health support program data"}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === "ar"
                ? "إذا انضممت إلى برنامج دعم صحي، نعالج الحد الأدنى اللازم من بيانات خط البداية، والتغذية، والترطيب، والنشاط، وتسجيل الأعراض الذاتي لتقديم البرنامج. هذه بيانات ذات طبيعة خاصة، وليست تشخيصاً طبياً أو وصفة علاجية."
                : "If you join a health support program, we process the minimum baseline, nutrition, hydration, activity, and self-reported symptom data needed to provide it. This is special-nature data; it is not a medical diagnosis or prescription."}
            </p>
            <ul className="mt-4 list-disc space-y-2 ps-5 text-muted-foreground">
              <li>{language === "ar" ? "لا نشارك الإجابات الخاصة أو الأعراض مع المطاعم أو شركاء التوصيل." : "Private answers and symptoms are not shared with restaurants or delivery partners."}</li>
              <li>{language === "ar" ? "لا نرسل محتوى البرنامج الصحي إلى أدوات تحليلات الاستخدام." : "Health-program content is excluded from usage analytics."}</li>
              <li>{language === "ar" ? "يمكنك إيقاف البرنامج أو سحب الموافقة أو تصدير بياناتك أو حذف بيانات البرنامج نهائياً." : "You can pause or leave the program, withdraw future processing consent, export your data, or permanently delete program data."}</li>
              <li>{language === "ar" ? "قرارات الدواء والجرعة والأعراض الطبية تبقى مع طبيبك المرخص." : "Medication, dose, and clinical symptom decisions remain with your licensed clinician."}</li>
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
