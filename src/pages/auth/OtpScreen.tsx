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
      className="fixed inset-0 flex flex-col bg-[#F6F8FB] text-[#020617]"
      style={{ maxWidth: 430, margin: "0 auto" }}
    >
      <div className="flex-1 px-6 pt-6 pb-4">
        {/* Back arrow */}
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5EAF1] bg-white transition-opacity hover:opacity-70"
        >
          <ArrowLeft className="h-5 w-5 text-[#020617]" />
        </button>

        {/* Title */}
        <h1 className="mb-2 text-[26px] font-extrabold leading-tight text-[#020617]">
          {t("enter_otp_code")}
        </h1>
        <p className="mb-10 text-sm font-semibold leading-relaxed text-[#64748B]">
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
                className="h-[72px] w-[72px] rounded-2xl border-2 bg-white text-center text-[28px] font-bold text-[#020617] transition-all focus:outline-none"
                style={{ borderColor: isActive ? "#020617" : "#E5EAF1" }}
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
            <p className="text-sm font-semibold text-[#64748B]">
              {t("resend_code_in")}{" "}
              <span className="font-semibold text-[#020617]">{otpCountdown}</span>
              {" "}{t("seconds")}
            </p>
          ) : (
            <button
              type="button"
              onClick={onResend}
              className="text-sm font-semibold text-[#020617]"
            >
              {t("resend_code")}
            </button>
          )}
          {otpCountdown > 0 && (
            <button
              type="button"
              disabled
              className="mx-auto mt-1 block cursor-not-allowed text-sm text-[#94A3B8]"
            >
              {t("resend_code")}
            </button>
          )}
        </div>
      </div>

      {/* Custom numeric keypad */}
      <div className="border-t border-[#E5EAF1] bg-white">
        {KEYPAD_ROWS.map((row, ri) => (
          <div key={ri} className="flex">
            {row.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onOtpKey(key)}
                className="flex-1 flex items-center justify-center transition-colors active:bg-[#F6F8FB]"
                style={{ height: 72, fontSize: key === "back" ? 14 : 26, fontWeight: 500, color: "#020617" }}
                aria-label={key === "back" ? t("backspace") : key === "*" ? t("asterisk") : `${t("number")} ${key}`}
              >
                {key === "back" ? (
                  <svg width="24" height="18" viewBox="0 0 24 18" fill="none" role="img" aria-label={t("backspace")}>
                    <path d="M9 1L1 9L9 17M1 9H23" stroke="#020617" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M23 1H10L2 9L10 17H23V1Z" fill="#020617" fillOpacity="0.08" />
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
            className="w-full rounded-2xl bg-[#020617] font-bold text-white shadow-none hover:bg-[#111827]"
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
