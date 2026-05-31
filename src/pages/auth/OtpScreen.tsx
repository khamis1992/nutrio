import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "back"],
] as const;

interface OtpScreenProps {
  otpDigits: string[];
  otpCountdown: number;
  otpLoading: boolean;
  otpError: string;
  onOtpDigitChange: (digits: string[]) => void;
  onOtpErrorClear: () => void;
  onOtpKey: (key: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
}

export const OtpScreen = ({
  otpDigits,
  otpCountdown,
  otpLoading,
  otpError,
  onOtpDigitChange,
  onOtpErrorClear,
  onOtpKey,
  onVerify,
  onResend,
  onBack,
}: OtpScreenProps) => {
  const { t } = useLanguage();
  const filledCount = otpDigits.filter((d) => d !== "").length;

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const digits = pasted.replace(/\D/g, "").slice(0, 4).split("");
    const padded = digits.concat(Array(4).fill("")).slice(0, 4);
    onOtpDigitChange(padded);
    onOtpErrorClear();
  };

  return (
    <div
      className="fixed inset-0 flex flex-col bg-white"
      style={{ maxWidth: 430, margin: "0 auto" }}
    >
      <div className="flex-1 px-6 pt-6 pb-4">
        {/* Back arrow */}
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>

        {/* Title */}
        <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2">
          {t("enter_otp_code")}
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-10">
          {t("otp_sent_desc")}
        </p>

        {/* OTP Input Fields */}
        <div className="flex justify-center gap-4 mb-6" onPaste={handleOtpPaste}>
          {otpDigits.map((digit, i) => {
            const isActive = digit === "" && otpDigits.slice(0, i).every((d) => d !== "");
            return (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(-1);
                  onOtpErrorClear();
                  const next = [...otpDigits];
                  next[i] = val;
                  onOtpDigitChange(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digit && i > 0) {
                    const prevInput = e.currentTarget.parentElement?.children[i - 1] as HTMLInputElement;
                    prevInput?.focus();
                  }
                }}
                ref={(el) => {
                  if (isActive && el) el.focus();
                }}
                className="w-[72px] h-[72px] rounded-2xl bg-gray-100 text-center text-[28px] font-bold text-[#1a1a1a] border-2 transition-all focus:outline-none"
                style={{ borderColor: isActive ? "hsl(var(--primary))" : "transparent" }}
                aria-label={`${t("otp_digit")} ${i + 1}`}
              />
            );
          })}
        </div>

        {/* Error */}
        {otpError && (
          <p className="text-xs text-destructive text-center mb-4">{otpError}</p>
        )}

        {/* Countdown + resend */}
        <div className="text-center mb-8">
          {otpCountdown > 0 ? (
            <p className="text-sm text-gray-500">
              {t("resend_code_in")}{" "}
              <span className="font-semibold text-primary">{otpCountdown}</span>
              {" "}{t("seconds")}
            </p>
          ) : (
            <button
              type="button"
              onClick={onResend}
              className="text-sm font-semibold text-primary"
            >
              {t("resend_code")}
            </button>
          )}
          {otpCountdown > 0 && (
            <button
              type="button"
              disabled
              className="block mx-auto mt-1 text-sm text-gray-300 cursor-not-allowed"
            >
              {t("resend_code")}
            </button>
          )}
        </div>
      </div>

      {/* Custom numeric keypad */}
      <div className="bg-gray-50 border-t border-gray-100">
        {KEYPAD_ROWS.map((row, ri) => (
          <div key={ri} className="flex">
            {row.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onOtpKey(key)}
                className="flex-1 flex items-center justify-center transition-colors active:bg-gray-200"
                style={{ height: 72, fontSize: key === "back" ? 14 : 26, fontWeight: 500, color: "#1a1a1a" }}
                aria-label={key === "back" ? t("backspace") : key === "*" ? t("asterisk") : `${t("number")} ${key}`}
              >
                {key === "back" ? (
                  <svg width="24" height="18" viewBox="0 0 24 18" fill="none" role="img" aria-label={t("backspace")}>
                    <path d="M9 1L1 9L9 17M1 9H23" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M23 1H10L2 9L10 17H23V1Z" fill="#1a1a1a" fillOpacity="0.08" />
                  </svg>
                ) : key === "*" ? (
                  <span style={{ fontSize: 32 }}>*</span>
                ) : (
                  key
                )}
              </button>
            ))}
          </div>
        ))}

        {/* Verify button */}
        <div className="px-6 pb-8 pt-2">
          <Button
            type="button"
            variant="gradient"
            size="xl"
            className="w-full rounded-2xl font-bold"
            disabled={otpLoading || filledCount < 4}
            onClick={onVerify}
          >
            {otpLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t("verifying")}</> : t("verify_otp")}
          </Button>
        </div>
      </div>
    </div>
  );
};
