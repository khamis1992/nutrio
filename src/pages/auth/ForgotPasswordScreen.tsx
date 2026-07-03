import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ForgotPasswordScreenProps {
  forgotEmail: string;
  forgotLoading: boolean;
  forgotError: string;
  onEmailChange: (value: string) => void;
  onErrorClear: () => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ForgotPasswordScreen = ({
  forgotEmail,
  forgotLoading,
  forgotError,
  onEmailChange,
  onErrorClear,
  onBack,
  onSubmit,
}: ForgotPasswordScreenProps) => {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#F6F8FB] text-[#020617]"
      style={{ maxWidth: 430, margin: "0 auto" }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        {/* Back arrow */}
        <button
          type="button"
          data-testid="forgot-back-btn"
          onClick={onBack}
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5EAF1] bg-white transition-opacity hover:opacity-70"
        >
          <ArrowLeft className="h-5 w-5 text-[#020617]" />
        </button>

        {/* Title */}
        <h1 className="mb-1 text-[22px] font-extrabold leading-tight text-[#020617]">
          {t("forgot_password")}
        </h1>
        <p className="mb-6 text-sm font-semibold leading-relaxed text-[#64748B]">
          {t("forgot_password_desc")}
        </p>

        {/* Form */}
        <form id="forgot-form" onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <Label htmlFor="forgot-email" className="text-sm font-semibold text-[#020617]">
              {t("registered_email")}
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#38BDF8]" />
              <Input
                id="forgot-email"
                data-testid="forgot-email-input"
                type="email"
                placeholder={t("email_placeholder")}
                value={forgotEmail}
                onChange={(e) => { onEmailChange(e.target.value); onErrorClear(); }}
                className={`h-12 rounded-2xl border border-[#E5EAF1] bg-white pl-11 text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-1 focus-visible:ring-[#020617] ${forgotError ? "ring-1 ring-[#FB6B7A]" : ""}`}
                required
                disabled={forgotLoading}
                autoComplete="email"
              />
            </div>
            {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
          </div>
          <div className="pt-3" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <Button
              type="submit"
              data-testid="forgot-submit-btn"
              variant="gradient"
              size="lg"
              className="w-full rounded-2xl bg-[#020617] font-bold text-white shadow-none hover:bg-[#111827]"
              disabled={forgotLoading}
            >
              {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t("sending")}</> : t("send_otp_code")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
