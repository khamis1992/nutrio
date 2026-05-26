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
      className="fixed inset-0 flex flex-col bg-white"
      style={{ maxWidth: 430, margin: "0 auto" }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        {/* Back arrow */}
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>

        {/* Title */}
        <h1 className="text-[22px] font-extrabold text-gray-900 leading-tight mb-1">
          {t("forgot_password")}
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          {t("forgot_password_desc")}
        </p>

        {/* Form */}
        <form id="forgot-form" onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <Label htmlFor="forgot-email" className="text-sm font-semibold text-gray-800">
              {t("registered_email")}
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="forgot-email"
                type="email"
                placeholder="your@email.com"
                value={forgotEmail}
                onChange={(e) => { onEmailChange(e.target.value); onErrorClear(); }}
                className={`h-12 pl-11 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${forgotError ? "ring-1 ring-destructive" : ""}`}
                required
                disabled={forgotLoading}
                autoComplete="email"
              />
            </div>
            {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
          </div>
        </form>
      </div>

      {/* Fixed bottom button */}
      <div className="px-6 pt-3 bg-white border-t border-gray-100" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <Button
          type="submit"
          form="forgot-form"
          variant="gradient"
          size="lg"
          className="w-full rounded-2xl font-bold"
          disabled={forgotLoading}
        >
          {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t("sending")}</> : t("send_otp_code")}
        </Button>
      </div>
    </div>
  );
};
