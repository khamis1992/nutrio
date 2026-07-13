import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Clock, HelpCircle, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useContactSettings } from "@/hooks/useContactSettings";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const Contact = () => {
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { settings: contactSettings } = useContactSettings();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const contactChannels = [
    {
      key: "email",
      href: `mailto:${contactSettings.support_email}`,
      value: contactSettings.support_email,
      icon: Mail,
      color: "#7C83F6",
      bg: "bg-[#F3F4FF]",
    },
    {
      key: "phone",
      href: `tel:${contactSettings.phone.replace(/[^+\d]/g, "")}`,
      value: contactSettings.phone,
      icon: Phone,
      color: "#22C7A1",
      bg: "bg-[#EFFFFA]",
    },
    {
      key: "location",
      href: contactSettings.map_url,
      value: isRTL ? contactSettings.address_ar : contactSettings.address_en,
      icon: MapPin,
      color: "#38BDF8",
      bg: "bg-sky-50",
    },
  ] as const;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const body = [
      `${t("contact_name")}: ${formData.name}`,
      `${t("contact_email")}: ${formData.email}`,
      "",
      formData.message,
    ].join("\n");
    window.location.href = `mailto:${contactSettings.support_email}?subject=${encodeURIComponent(formData.subject)}&body=${encodeURIComponent(body)}`;
    toast({ title: t("contact_email_ready_title"), description: t("contact_email_ready_message") });
    setIsSubmitting(false);
  };

  return (
    <main
      className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#F6F8FB] text-[#020617] [-webkit-overflow-scrolling:touch]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label={t("back")}
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#22C7A1]">{t("contact_badge")}</p>
            <h1 className="mt-1 text-[21px] font-black tracking-[-0.03em] text-[#020617]">{t("contact_us")}</h1>
          </div>
          <Link
            to="/faq"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label={t("contact_faq_button")}
          >
            <HelpCircle className="h-5 w-5" />
          </Link>
        </header>

        <section className="mt-5 overflow-hidden rounded-[26px] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
              <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[22px] font-black leading-[1.15] text-[#020617]">
                {t("contact_title_part1")} {t("contact_title_part2")}
              </h2>
              <p className="mt-2 text-[13px] font-bold leading-5 text-[#64748B]">{t("contact_subtitle")}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#F6F8FB] px-3 py-2.5 ring-1 ring-[#E5EAF1]">
            <Clock className="h-4 w-4 shrink-0 text-[#22C7A1]" />
            <p className="min-w-0 flex-1 text-[11px] font-bold text-[#64748B]">
              {isRTL ? contactSettings.hours_ar : contactSettings.hours_en}
            </p>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2">
          {contactChannels.map(({ key, href, value, icon: Icon, color, bg }) => (
            <a
              key={key}
              href={href}
              target={key === "location" ? "_blank" : undefined}
              rel={key === "location" ? "noreferrer" : undefined}
              aria-label={`${key}: ${value}`}
              className="flex min-h-[112px] min-w-0 flex-col items-center justify-center rounded-[20px] bg-white p-2 text-center shadow-[0_8px_20px_rgba(15,23,42,0.045)] ring-1 ring-[#E5EAF1] transition active:scale-[0.97]"
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5", bg)} style={{ color }}>
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="mt-2 block w-full min-w-0">
                <span className="block truncate text-[11px] font-black text-[#020617]">
                  {key === "email" ? t("contact_email_title") : key === "phone" ? t("contact_phone_title") : t("contact_address_title")}
                </span>
                <span className="mt-0.5 block truncate text-[9px] font-bold text-[#94A3B8]">{value}</span>
              </span>
            </a>
          ))}
        </section>

        {user ? (
          <section className="mt-4 rounded-[26px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-black text-[#020617]">{t("support_center_title")}</h2>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748B]">{t("support_subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/support")}
              className="mt-4 flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#020617] px-4 text-[13px] font-black text-white shadow-[0_12px_24px_rgba(2,6,23,0.16)] active:scale-[0.98]"
            >
              {t("submit_a_ticket")}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </section>
        ) : (
        <section className="mt-4 rounded-[26px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{t("contact_form_title")}</p>
            <h2 className="mt-1 text-[19px] font-black text-[#020617]">{t("contact_subject_placeholder")}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[12px] font-black text-[#020617]">{t("contact_name")}</Label>
                <Input
                  id="name"
                  placeholder={t("contact_name_placeholder")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="h-12 rounded-[18px] border-[#E5EAF1] bg-[#F6F8FB] text-[14px] font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[12px] font-black text-[#020617]">{t("contact_email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("contact_email_placeholder")}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-12 rounded-[18px] border-[#E5EAF1] bg-[#F6F8FB] text-[14px] font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-[12px] font-black text-[#020617]">{t("contact_subject")}</Label>
              <Input
                id="subject"
                placeholder={t("contact_subject_placeholder")}
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                className="h-12 rounded-[18px] border-[#E5EAF1] bg-[#F6F8FB] text-[14px] font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-[12px] font-black text-[#020617]">{t("contact_message")}</Label>
              <Textarea
                id="message"
                placeholder={t("contact_message_placeholder")}
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                className="min-h-[132px] rounded-[20px] border-[#E5EAF1] bg-[#F6F8FB] text-[14px] font-bold"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-14 w-full rounded-[22px] bg-[#22C7A1] text-[15px] font-black text-white shadow-[0_14px_30px_rgba(34,199,161,0.28)] hover:bg-[#18B593]"
            >
              {isSubmitting ? t("contact_sending") : (
                <>
                  {t("contact_submit")}
                  <Send className={cn("h-4 w-4", isRTL ? "mr-2 rotate-180" : "ml-2")} />
                </>
              )}
            </Button>
          </form>
        </section>
        )}
      </div>
    </main>
  );
};

export default Contact;
