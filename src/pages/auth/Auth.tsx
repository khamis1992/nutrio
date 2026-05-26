import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuthPage } from "./useAuthPage";
import { WelcomeScreen } from "./WelcomeScreen";
import { SignUpScreen } from "./SignUpScreen";
import { OtpScreen } from "./OtpScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { SignInScreen } from "./SignInScreen";
import { OnboardingCarousel } from "@/components/auth/OnboardingCarousel";

export const Auth = () => {
  const { t } = useLanguage();
  const state = useAuthPage();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("nutrio_onboarding_seen");
  });

  const handleOnboardingFinish = () => {
    localStorage.setItem("nutrio_onboarding_seen", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <OnboardingCarousel onFinish={handleOnboardingFinish} />;
  }

  if (state.authLoading || state.checkingRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
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

  if (state.view === "otp") {
    return (
      <OtpScreen
        otpDigits={state.otpDigits}
        otpCountdown={state.otpCountdown}
        otpLoading={state.otpLoading}
        otpError={state.otpError}
        onOtpDigitChange={state.setOtpDigits}
        onOtpErrorClear={() => state.setOtpError("")}
        onOtpKey={state.handleOtpKey}
        onVerify={state.handleOtpVerify}
        onResend={state.handleResendOtp}
        onBack={() => { state.setView("forgot"); state.setForgotSent(false); if (state.countdownRef.current) clearInterval(state.countdownRef.current); }}
      />
    );
  }

  if (state.view === "forgot") {
    return (
      <ForgotPasswordScreen
        forgotEmail={state.forgotEmail}
        forgotLoading={state.forgotLoading}
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
      biometricAvailable={state.biometricAvailable}
      biometricType={state.biometricType}
      biometricLoading={state.biometricLoading}
      enableBiometric={state.enableBiometric}
      rememberMe={state.rememberMe}
      initialEmail={state.email}
      onBiometricLogin={state.handleBiometricLogin}
      onEnableBiometric={state.setEnableBiometric}
      onRememberMe={state.setRememberMe}
      onBack={() => state.setView("welcome")}
      onSwitchToSignUp={() => state.setView("signup")}
      onSwitchToForgot={() => state.setView("forgot")}
      onSubmit={state.handleSignIn}
    />
  );
};
