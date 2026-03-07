import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Phone, 
  MapPin,
  Send,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/contexts/LanguageContext";

const Contact = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: t("contact_success_title"),
      description: t("contact_success_message"),
    });
    
    setFormData({ name: "", email: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/">
            <Logo size="md" />
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t("nav_about")}</Link>
            <Link to="/contact" className="text-sm font-medium text-primary transition-colors">{t("nav_contact")}</Link>
            <Link to="/partner/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t("nav_for_restaurants")}</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">{t("nav_login")}</Button>
            </Link>
            <Link to="/onboarding">
              <Button variant="gradient" size="sm">{t("nav_get_started")}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <Badge variant="soft" className="mb-4">
            <MessageSquare className="w-3 h-3 mr-1" />
            {t("contact_badge")}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            {t("contact_title_part1")}{" "}
            <span className="text-gradient">{t("contact_title_part2")}</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("contact_subtitle")}
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              <Card variant="interactive">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{t("contact_email_title")}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{t("contact_email_description")}</p>
                  <a href="mailto:hello@nutrio.com" className="text-sm text-primary hover:underline">
                    hello@nutrio.com
                  </a>
                </CardContent>
              </Card>

              <Card variant="interactive">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{t("contact_phone_title")}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{t("contact_hours")}</p>
                  <a href="tel:+1-800-NUTRIO" className="text-sm text-primary hover:underline">
                    +1-800-NUTRIO
                  </a>
                </CardContent>
              </Card>

              <Card variant="interactive">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{t("contact_address_title")}</h3>
                  <p className="text-sm text-muted-foreground">
                    123 Health Street<br />
                    San Francisco, CA 94102
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2">
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>{t("contact_form_title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t("contact_name")}</Label>
                        <Input
                          id="name"
                          placeholder={t("contact_name_placeholder")}
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          className="min-h-[44px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("contact_email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={t("contact_email_placeholder")}
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          className="min-h-[44px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">{t("contact_subject")}</Label>
                      <Input
                        id="subject"
                        placeholder={t("contact_subject_placeholder")}
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                        className="min-h-[44px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">{t("contact_message")}</Label>
                      <Textarea
                        id="message"
                        placeholder={t("contact_message_placeholder")}
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                      />
                    </div>

                    <Button 
                      type="submit" 
                      variant="gradient" 
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        t("contact_sending")
                      ) : (
                        <>
                          {t("contact_submit")}
                          <Send className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="py-16 px-4 bg-card/50">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-2xl font-bold mb-4">{t("contact_faq_title")}</h2>
          <p className="text-muted-foreground mb-6">
            {t("contact_faq_description")}
          </p>
          <Link to="/auth">
            <Button variant="outline">
              {t("contact_faq_button")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Logo size="sm" />
            <div className="flex items-center gap-6">
              <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("footer_about")}
              </Link>
              <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("footer_contact")}
              </Link>
              <Link to="/partner/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("footer_partner_portal")}
              </Link>
              <p className="text-sm text-muted-foreground">
                {t("footer_copyright")}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Contact;
