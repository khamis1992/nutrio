import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuthPage } from "./useAuthPage";
import { WelcomeScreen } from "./WelcomeScreen";
import { SignUpScreen } from "./SignUpScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { SignInScreen } from "./SignInScreen";
import { OnboardingCarousel } from "@/components/auth/OnboardingCarousel";

export const Auth = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const state = useAuthPage();
  const { setView } = state;
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (new URLSearchParams(window.location.search).get("source") === "sporthub") {
      return false;
    }
    return !localStorage.getItem("nutrio_onboarding_seen");
  });

  useEffect(() => {
    if (searchParams.get("source") !== "sporthub") return;

    const payload = {
      source: "sporthub",
      campaign: searchParams.get("campaign") || "sporthub_partner",
      code: searchParams.get("code") || "SPORTHUB15",
      visited_at: new Date().toISOString(),
    };

    localStorage.setItem("nutrio_onboarding_seen", "true");
    localStorage.setItem("nutrio:partner-referral", JSON.stringify(payload));
    setShowOnboarding(false);
    setView("signup");
  }, [searchParams, setView]);

  const handleOnboardingFinish = () => {
    localStorage.setItem("nutrio_onboarding_seen", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <OnboardingCarousel onFinish={handleOnboardingFinish} />;
  }

  if (state.authLoading || state.checkingRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F6F8FB] text-[#020617]">
        <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
        <p className="text-sm font-semibold text-[#64748B]">
          {state.checkingRole ? t("setting_up_account") : t("loading")}
        </p>
      </div>
    );
  }

  if (state.view === "welcome") {
    return (
      <WelcomeScreen
        onSwitchView={(v) => state.setView(v)}
      />
    );
  }

  if (state.view === "signup") {
    return (
      <SignUpScreen
        agreedToTerms={state.agreedToTerms}
        loading={state.loading}
        onToggleTerms={() => state.setAgreedToTerms(!state.agreedToTerms)}
        onBack={() => state.setView("welcome")}
        onSwitchToSignIn={() => state.setView("signin")}
        onSubmit={state.handleSignUp}
      />
    );
  }

  if (state.view === "forgot") {
    return (
      <ForgotPasswordScreen
        forgotEmail={state.forgotEmail}
        forgotLoading={state.forgotLoading}
        forgotSent={state.forgotSent}
        forgotError={state.forgotError}
        onEmailChange={(val) => { state.setForgotEmail(val); state.setForgotError(""); }}
        onErrorClear={() => state.setForgotError("")}
        onBack={() => { state.setView("signin"); state.setForgotEmail(""); state.setForgotSent(false); state.setForgotError(""); }}
        onSubmit={state.handleForgotSubmit}
      />
    );
  }

  return (
    <SignInScreen
      loading={state.loading}
      rememberMe={state.rememberMe}
      initialEmail={state.email}
      onRememberMe={state.setRememberMe}
      onBack={() => state.setView("welcome")}
      onSwitchToSignUp={() => state.setView("signup")}
      onSwitchToForgot={() => state.setView("forgot")}
      onSubmit={state.handleSignIn}
    />
  );
};
