import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, HelpCircle, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const CONTACT_CHANNELS = [
  {
    key: "email",
    href: "mailto:support@nutrio.me",
    value: "support@nutrio.me",
    icon: Mail,
    color: "#7C83F6",
    bg: "bg-[#F3F4FF]",
  },
  {
    key: "phone",
    href: "tel:+97440000000",
    value: "+974 4000 0000",
    icon: Phone,
    color: "#22C7A1",
    bg: "bg-[#EFFFFA]",
  },
  {
    key: "location",
    href: "https://maps.google.com/?q=Doha,Qatar",
    value: "Doha, Qatar",
    icon: MapPin,
    color: "#38BDF8",
    bg: "bg-sky-50",
  },
] as const;

const Contact = () => {
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 700));

    toast({
      title: t("contact_success_title"),
      description: t("contact_success_message"),
    });

    setFormData({ name: "", email: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <main
      className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#F6F8FB] text-[#020617] [-webkit-overflow-scrolling:touch]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <Link
            to="/auth"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
          </Link>
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

        <section className="mt-5 overflow-hidden rounded-[30px] bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
              <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[24px] font-black leading-[1.05] tracking-[-0.04em] text-[#020617]">
                {t("contact_title_part1")} {t("contact_title_part2")}
              </h2>
              <p className="mt-2 text-[13px] font-bold leading-5 text-[#64748B]">{t("contact_subtitle")}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[20px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
              <Clock className="h-4 w-4 text-[#22C7A1]" />
              <p className="mt-2 text-[11px] font-black text-[#020617]">{t("contact_hours")}</p>
            </div>
            <Link to="/faq" className="rounded-[20px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1] transition active:scale-[0.98]">
              <HelpCircle className="h-4 w-4 text-[#7C83F6]" />
              <p className="mt-2 text-[11px] font-black text-[#020617]">{t("contact_faq_title")}</p>
            </Link>
          </div>
        </section>

        <section className="mt-4 grid gap-2">
          {CONTACT_CHANNELS.map(({ key, href, value, icon: Icon, color, bg }) => (
            <a
              key={key}
              href={href}
              target={key === "location" ? "_blank" : undefined}
              rel={key === "location" ? "noreferrer" : undefined}
              className="flex min-h-[72px] items-center gap-3 rounded-[24px] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)] ring-1 ring-[#E5EAF1] transition active:scale-[0.99]"
            >
              <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ring-1 ring-black/5", bg)} style={{ color }}>
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-black text-[#020617]">
                  {key === "email" ? t("contact_email_title") : key === "phone" ? t("contact_phone_title") : t("contact_address_title")}
                </span>
                <span className="mt-0.5 block truncate text-[12px] font-bold text-[#64748B]">{value}</span>
              </span>
            </a>
          ))}
        </section>

        <section className="mt-4 rounded-[30px] bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{t("contact_form_title")}</p>
            <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-[#020617]">{t("contact_subject_placeholder")}</h2>
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
      </div>
    </main>
  );
};

export default Contact;
