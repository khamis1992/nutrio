import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type { Factor } from "@supabase/supabase-js";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  restrictWebSessionToCurrentTab,
  supabase,
} from "@/integrations/supabase/client";
import { assetPath } from "@/lib/asset-path";

type GateStage =
  | "loading"
  | "load-error"
  | "setup"
  | "enroll"
  | "verify"
  | "verified";

type VerifiedTotpFactor = Factor<"totp", "verified">;

type EnrollmentDetails = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type RpcResponse = {
  error: { message: string } | null;
};

type MfaErrorDetails = {
  code?: string;
  status?: number;
  message?: string;
};

type PrivilegedPortal = "admin" | "fleet";

type PrivilegedMfaGateProps = {
  children: ReactNode;
  portal: PrivilegedPortal;
};

const ARABIC_INDIC_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
const EASTERN_ARABIC_DIGITS = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9";

function normalizeTotpCode(value: string): string {
  return Array.from(value)
    .map((character) => {
      const arabicIndicIndex = ARABIC_INDIC_DIGITS.indexOf(character);
      if (arabicIndicIndex >= 0) return String(arabicIndicIndex);

      const easternArabicIndex = EASTERN_ARABIC_DIGITS.indexOf(character);
      if (easternArabicIndex >= 0) return String(easternArabicIndex);

      return character;
    })
    .join("")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function getQrCodeSource(qrCode: string): string {
  if (qrCode.startsWith("data:image/")) return qrCode;
  if (qrCode.trimStart().startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
  }
  return `data:image/svg+xml;utf-8,${qrCode}`;
}

function getMfaErrorDetails(error: unknown): MfaErrorDetails {
  if (!error || typeof error !== "object") return {};

  const candidate = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
  };
  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    message:
      typeof candidate.message === "string"
        ? candidate.message.toLowerCase()
        : undefined,
  };
}

function getMfaErrorMessage(error: unknown): string {
  const { code, status, message } = getMfaErrorDetails(error);

  switch (code) {
    case "mfa_verification_failed":
    case "mfa_verification_rejected":
      return "This code does not match the selected authenticator. Use the newest code and make sure automatic date and time is enabled on your phone.";
    case "mfa_challenge_expired":
      return "That verification request expired. Wait for the next code and try again.";
    case "over_request_rate_limit":
      return "Too many verification attempts were made. Wait one minute, then use a new code.";
    case "mfa_factor_not_found":
      return "This authenticator is no longer linked to your account. Refresh the list and choose another one.";
    case "mfa_ip_address_mismatch":
      return "Your network changed during verification. Stay on the same connection, refresh, and try again.";
    case "mfa_totp_verify_not_enabled":
      return "Authenticator verification is not enabled for this project. An authorized operator must enable TOTP verification in Supabase Auth settings.";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "Your sign-in session expired. Sign out, sign in again, then enter a fresh code.";
    case "mfa_session_not_elevated":
      return "The code was accepted, but the protected session could not be activated. Refresh the page and enter the newest code again.";
    default:
      if (
        status === 422 ||
        message?.includes("invalid totp") ||
        message?.includes("verification code")
      ) {
        return "This code does not match the selected authenticator. Use the newest code and make sure automatic date and time is enabled on your phone.";
      }
      if (status === 429) {
        return "Too many verification attempts were made. Wait one minute, then use a new code.";
      }
      return "We could not verify this code. Refresh your authenticators and try the newest code again.";
  }
}

function getFactorLabel(factor: VerifiedTotpFactor, index: number): string {
  const name = factor.friendly_name?.trim() || `Authenticator ${index + 1}`;
  const timestamp = Date.parse(factor.updated_at || factor.created_at);
  if (Number.isNaN(timestamp)) return name;

  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
  return `${name} - linked ${date}`;
}

async function recordMfaVerification(portal: PrivilegedPortal): Promise<void> {
  const invoke = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
  ) => PromiseLike<RpcResponse>;
  const functionName = portal === "admin"
    ? "admin_record_mfa_verification"
    : "fleet_record_mfa_verification";
  const { error } = await invoke(functionName);
  if (error) {
    // The new AAL2 session remains valid even if the optional evidence write
    // is temporarily unavailable. Do not force the administrator into a loop.
    console.warn("Could not record the privileged MFA verification event", error.message);
  }
}

function PrivilegedMfaGate({ children, portal }: PrivilegedMfaGateProps) {
  const { signOut } = useAuth();
  const [stage, setStage] = useState<GateStage>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [totpFactors, setTotpFactors] = useState<VerifiedTotpFactor[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentDetails | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFleetPortal = portal === "fleet";
  const portalLabel = isFleetPortal ? "fleet operations" : "administration";

  const loadTotpFactors = useCallback(async () => {
    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    const verifiedTotp = [...factors.totp].sort(
      (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
    );
    setTotpFactors(verifiedTotp);
    setFactorId((currentFactorId) => {
      if (verifiedTotp.some((factor) => factor.id === currentFactorId)) {
        return currentFactorId;
      }
      return verifiedTotp[0]?.id ?? null;
    });
    return verifiedTotp;
  }, []);

  const inspectAssurance = useCallback(async () => {
    setStage("loading");
    setError(null);

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;

    if (assurance.currentLevel === "aal2") {
      setStage("verified");
      return;
    }

    const verifiedTotp = await loadTotpFactors();
    if (verifiedTotp.length > 0) {
      setStage("verify");
      return;
    }

    setFactorId(null);
    setStage("setup");
  }, [loadTotpFactors]);

  useEffect(() => {
    let active = true;

    // Privileged sessions must not survive a browser restart, even when the
    // user selected "Remember me" before the app knew they were an admin.
    restrictWebSessionToCurrentTab();

    void inspectAssurance().catch((loadError) => {
      if (!active) return;
      console.error("Unable to inspect admin MFA assurance", loadError);
      setError("We could not verify this session. Check your connection and try again.");
      setStage("load-error");
    });

    return () => {
      active = false;
    };
  }, [inspectAssurance]);

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      if (factors.totp.length > 0) {
        await loadTotpFactors();
        setStage("verify");
        return;
      }

      // An interrupted setup cannot be resumed because its secret is not
      // returned again. Remove only stale, unverified TOTP factors.
      for (const factor of factors.all) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          const { error: removeError } = await supabase.auth.mfa.unenroll({
            factorId: factor.id,
          });
          if (removeError) throw removeError;
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: isFleetPortal
          ? "Nutrio Fleet Authenticator"
          : "Nutrio Admin Authenticator",
        issuer: "Nutrio",
      });
      if (enrollError) throw enrollError;

      const details = {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      };
      setEnrollment(details);
      setFactorId(details.factorId);
      setStage("enroll");
    } catch (enrollFailure) {
      console.error("Admin MFA enrollment failed", enrollFailure);
      setError("Authenticator setup failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const refreshAuthenticators = async () => {
    setBusy(true);
    setError(null);
    setCode("");
    try {
      const verifiedTotp = await loadTotpFactors();
      if (verifiedTotp.length === 0) {
        setStage("setup");
        setFactorId(null);
        return;
      }
      setStage("verify");
      toast.success("Authenticator list refreshed");
    } catch (refreshError) {
      const details = getMfaErrorDetails(refreshError);
      console.warn("Could not refresh admin authenticators", details);
      setError("We could not refresh your authenticators. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (stage === "verify") {
        const verifiedTotp = await loadTotpFactors();
        if (!verifiedTotp.some((factor) => factor.id === factorId)) {
          setStage(verifiedTotp.length > 0 ? "verify" : "setup");
          throw Object.assign(new Error("MFA factor not found"), {
            code: "mfa_factor_not_found",
          });
        }
      }

      const { data: verification, error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (verifyError) throw verifyError;

      // challengeAndVerify returns the newly elevated access token. Check that
      // exact token instead of immediately rereading storage, which can still
      // expose the previous AAL1 session while auth subscribers are updating.
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
          verification.access_token,
        );
      if (assuranceError || assurance.currentLevel !== "aal2") {
        throw assuranceError ?? Object.assign(
          new Error("AAL2 was not established for the verified session"),
          { code: "mfa_session_not_elevated" },
        );
      }

      await recordMfaVerification(portal);
      setCode("");
      setEnrollment(null);
      setStage("verified");
      toast.success(isFleetPortal
        ? "Fleet operator identity verified"
        : "Administrator identity verified");
    } catch (verificationError) {
      const details = getMfaErrorDetails(verificationError);
      console.warn("Admin MFA verification failed", details);
      setCode("");
      setError(getMfaErrorMessage(verificationError));
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!enrollment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      toast.success("Setup key copied");
    } catch {
      toast.error("Could not copy the setup key");
    }
  };

  if (stage === "verified") return <>{children}</>;

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-6 flex items-center justify-center">
          <img
            src={assetPath("/logo.png")}
            alt="Nutrio"
            className="h-16 w-auto object-contain"
          />
        </div>

        <section className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_20px_55px_rgba(2,6,23,0.10)]">
          <header className="border-b border-[#E2E8F0] px-6 py-6 sm:px-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#E7FAF5] text-[#0EA884]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mb-1 text-xs font-bold uppercase text-[#0EA884]">
              Protected {portalLabel}
            </p>
            <h1 className="text-2xl font-bold text-[#020617]">
              Verify it is really you
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              {isFleetPortal
                ? "Fleet dispatch, driver data, and payouts require a second factor. Password access alone cannot unlock elevated fleet access."
                : "Admin data and actions require a second factor. Password access alone cannot unlock this portal."}
            </p>
          </header>

          <div className="px-6 py-6 sm:px-8">
            {stage === "loading" ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-[#64748B]">
                <Loader2 className="h-6 w-6 animate-spin text-[#22C7A1]" />
                <p className="text-sm font-medium">Checking session assurance...</p>
              </div>
            ) : null}

            {stage === "load-error" ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-[#64748B]">
                  Nutrio could not load the security factors for this session. No
                  privileged access has been granted.
                </p>
                <Button
                  type="button"
                  className="h-12 w-full bg-[#020617] hover:bg-[#0F172A]"
                  onClick={() => void inspectAssurance()}
                  disabled={busy}
                >
                  <RefreshCw className={busy ? "animate-spin" : undefined} />
                  Check again
                </Button>
              </div>
            ) : null}

            {stage === "setup" ? (
              <div className="space-y-5">
                <div className="flex gap-4 rounded-lg border border-[#DCE5EF] bg-[#F8FAFC] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#7C83F6] shadow-sm">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-[#020617]">Set up an authenticator</h2>
                    <p className="mt-1 text-sm leading-5 text-[#64748B]">
                      Use Google Authenticator, Microsoft Authenticator, 1Password,
                      or another TOTP app.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="h-12 w-full bg-[#020617] hover:bg-[#0F172A]"
                  onClick={() => void startEnrollment()}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
                  Set up authenticator
                </Button>
              </div>
            ) : null}

            {stage === "enroll" && enrollment ? (
              <div className="space-y-5">
                <div className="mx-auto w-fit rounded-lg border border-[#DCE5EF] bg-white p-3 shadow-sm">
                  <img
                    src={getQrCodeSource(enrollment.qrCode)}
                    alt="Authenticator setup QR code"
                    className="h-48 w-48"
                  />
                </div>
                <div>
                  <p className="text-center text-sm font-semibold text-[#020617]">
                    Scan the code, then enter the six-digit number
                  </p>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#DCE5EF] bg-[#F8FAFC] p-2 pl-3">
                    <code className="min-w-0 flex-1 break-all text-xs font-semibold text-[#334155]">
                      {enrollment.secret}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Copy setup key"
                      onClick={() => void copySecret()}
                    >
                      <Copy />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#94A3B8]">
                    This QR code and setup key are security credentials. Never share
                    or screenshot them.
                  </p>
                </div>
              </div>
            ) : null}

            {(stage === "verify" || stage === "enroll") ? (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyCode();
                }}
              >
                {stage === "verify" ? (
                  <div className="space-y-4 rounded-lg border border-[#DCE5EF] bg-[#F8FAFC] p-4">
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#22C7A1] shadow-sm">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-[#020617]">Authenticator code</h2>
                        <p className="mt-1 text-sm leading-5 text-[#64748B]">
                          Open the matching Nutrio entry in your authenticator app.
                        </p>
                      </div>
                    </div>

                    {totpFactors.length > 1 ? (
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase text-[#64748B]">
                          Choose authenticator
                        </span>
                        <span className="relative block">
                          <select
                            value={factorId ?? ""}
                            onChange={(event) => {
                              setFactorId(event.target.value);
                              setCode("");
                              setError(null);
                            }}
                            className="h-12 w-full appearance-none rounded-lg border border-[#DCE5EF] bg-white px-3 pr-10 text-sm font-semibold text-[#020617] outline-none transition focus:border-[#22C7A1] focus:ring-2 focus:ring-[#22C7A1]/20"
                          >
                            {totpFactors.map((factor, index) => (
                              <option key={factor.id} value={factor.id}>
                                {getFactorLabel(factor, index)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                        </span>
                      </label>
                    ) : (
                      <p className="rounded-lg border border-[#DCE5EF] bg-white px-3 py-2 text-xs font-semibold text-[#475569]">
                        Using {totpFactors[0] ? getFactorLabel(totpFactors[0], 0) : "your linked authenticator"}
                      </p>
                    )}

                    <div className="flex items-start gap-2 text-xs leading-5 text-[#64748B]">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#38BDF8]" />
                      <p>
                        Codes change every 30 seconds. Use the newest code and keep
                        automatic date and time enabled on your phone.
                      </p>
                    </div>
                  </div>
                ) : null}
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#334155]">
                    Six-digit code
                  </span>
                  <Input
                    value={code}
                    onChange={(event) => {
                      setCode(normalizeTotpCode(event.target.value));
                      setError(null);
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoFocus
                    className="h-14 text-center font-mono text-xl tracking-[0.35em]"
                    aria-invalid={Boolean(error)}
                  />
                </label>
                <Button
                  type="submit"
                  className="h-12 w-full bg-[#020617] hover:bg-[#0F172A]"
                  disabled={busy || code.length !== 6}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Check />}
                  Verify and continue
                </Button>
                {stage === "verify" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full text-[#475569]"
                    onClick={() => void refreshAuthenticators()}
                    disabled={busy}
                  >
                    <RefreshCw className={busy ? "animate-spin" : undefined} />
                    Refresh authenticators
                  </Button>
                ) : null}
              </form>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-[#FB6B7A]/30 bg-[#FFF1F3] px-4 py-3 text-sm font-medium text-[#B4233A]"
              >
                {error}
              </div>
            ) : null}
          </div>

          <footer className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4 sm:px-8">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <ShieldCheck className="h-4 w-4 text-[#22C7A1]" />
              Every privileged verification is auditable
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
            >
              <LogOut />
              Sign out
            </Button>
          </footer>
        </section>
      </div>
    </main>
  );
}

export function AdminMfaGate({ children }: { children: ReactNode }) {
  return <PrivilegedMfaGate portal="admin">{children}</PrivilegedMfaGate>;
}

export function FleetMfaGate({ children }: { children: ReactNode }) {
  return <PrivilegedMfaGate portal="fleet">{children}</PrivilegedMfaGate>;
}
