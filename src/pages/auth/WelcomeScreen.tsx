import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Leaf, Lock, UserPlus } from "lucide-react";

interface WelcomeScreenProps {
  onSwitchView: (view: "signup" | "signin") => void;
}

export const WelcomeScreen = ({ onSwitchView }: WelcomeScreenProps) => {
  const { t } = useLanguage();

  const GoogleIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.04 12.261c0-.815-.073-1.596-.209-2.348H12v4.44h6.24c-.27 1.45-1.09 2.676-2.32 3.497v2.9h3.76c2.2-2.027 3.46-5.015 3.46-8.49Z" fill="#4285F4"/>
      <path d="M12 24c3.24 0 5.96-1.074 7.947-2.917l-3.76-2.9c-1.044.7-2.385 1.114-4.187 1.114-3.215 0-5.94-2.17-6.914-5.09H1.2v3.02C3.176 21.41 7.28 24 12 24Z" fill="#34A853"/>
      <path d="M5.086 14.207A7.2 7.2 0 0 1 4.8 12c0-.765.132-1.505.37-2.207V6.773H1.2A11.96 11.96 0 0 0 0 12c0 1.908.46 3.708 1.2 5.227l3.886-3.02Z" fill="#FBBC05"/>
      <path d="M12 4.727c1.764 0 3.35.607 4.598 1.795l3.448-3.448C17.953 1.18 15.24 0 12 0 7.28 0 3.176 2.59 1.2 6.773l3.972 3.02C6.06 6.897 8.785 4.727 12 4.727Z" fill="#EA4335"/>
    </svg>
  );
  const AppleIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.365 1.43c0 1.085-.43 2.136-1.13 2.9-.857.93-2.258 1.648-3.432 1.552-.12-1.072.472-2.213 1.176-2.95.83-.87 2.287-1.54 3.386-1.502zM20.75 18.12c-.65 1.507-1.43 2.993-2.58 4.314-1.008 1.158-2.27 2.46-3.89 2.46-1.63 0-2.062-.79-3.83-.79-1.794 0-2.26.78-3.867.81-1.632.03-2.864-1.245-3.877-2.405C.93 20.1-.65 15.46 1.82 12.1c1.028-1.45 2.625-2.37 4.46-2.4 1.676-.03 3.26.85 4.28.85 1 0 2.84-1.05 4.79-.9.82.03 3.12.33 4.59 2.5-3.89 2.23-3.27 7.02.8 5.97z"/>
    </svg>
  );
  const FacebookIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.675 0H1.325C.593 0 0 .593 0 1.326v21.348C0 23.406.593 24 1.325 24H12.82V14.706H9.692v-3.61h3.13V8.413c0-3.1 1.894-4.788 4.66-4.788 1.325 0 2.463.099 2.793.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.764v2.314h3.588l-.467 3.61h-3.12V24h6.116C23.407 24 24 23.406 24 22.674V1.326C24 .593 23.407 0 22.675 0Z"/>
    </svg>
  );

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-white dark:bg-gray-950"
      style={{ maxWidth: 430, margin: "0 auto" }}
    >
      {/* ── Hero section ── */}
      <div
        className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
        style={{
          background: "radial-gradient(1200px 600px at 80% -10%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%), linear-gradient(135deg, #0FB56D 0%, #12C88A 55%, #0EBB79 100%)",
          paddingBottom: "2.75rem",
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1], x: [0, 8, 0], y: [0, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", top: -80, right: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }}
        />
        <motion.div
          animate={{ scale: [1, 1.12, 1], x: [0, -12, 0], y: [0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          style={{ position: "absolute", bottom: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }}
        />

        <svg
          aria-hidden
          width="420"
          height="420"
          viewBox="0 0 420 420"
          className="pointer-events-none absolute -right-16 top-12 opacity-60"
          style={{ filter: "blur(0.3px)" }}
        >
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path d="M300 0c40 120-30 210-120 240 70-80 60-170-20-220 70 10 110 0 140-20z" fill="url(#lg1)" />
          <path d="M360 80c20 60-10 110-70 130 40-50 35-105-12-136 42 7 63 0 82-12z" fill="#A7F3D0" opacity="0.5" />
        </svg>
        <svg
          aria-hidden
          width="420"
          height="420"
          viewBox="0 0 420 420"
          className="pointer-events-none absolute -left-24 bottom-6 opacity-60"
          style={{ filter: "blur(0.3px)" }}
        >
          <defs>
            <linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path d="M160 380c-60-10-120-70-130-150 60 80 150 80 210 10-30 80-60 120-80 140z" fill="url(#lg2)" />
        </svg>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-center justify-center mb-8"
          style={{
            width: 100,
            height: 100,
            borderRadius: 28,
            background: "#ffffff",
            boxShadow: "0 22px 50px rgba(0,0,0,0.18)",
          }}
        >
          <Logo size="md" />
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          style={{
            fontSize: 38,
            fontWeight: 800,
            color: "#fff",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: 14,
            letterSpacing: -0.5,
            padding: "0 28px",
          }}
        >
          {t("eat_smart")}<br />{t("live_better")}
        </motion.h1>

        <div className="relative mt-1 mb-2" style={{ height: 16 }}>
          <svg width="160" height="16" viewBox="0 0 160 16" className="mx-auto block">
            <defs>
              <linearGradient id="swg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#A7F3D0" />
                <stop offset="100%" stopColor="#34D399" />
              </linearGradient>
            </defs>
            <path d="M5 11 C 55 2, 105 2, 155 11" stroke="url(#swg)" strokeWidth="6" strokeLinecap="round" fill="none" />
            <circle cx="144" cy="12" r="3" fill="#34D399" />
          </svg>
        </div>

        <motion.p
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
          style={{ fontSize: 17, color: "rgba(255,255,255,0.92)", textAlign: "center", lineHeight: 1.5, padding: "0 36px" }}
        >
          {t("personalized_nutrition_tagline")}
        </motion.p>

        <div className="flex items-center gap-2 mt-4">
          <span className="inline-block w-2 h-2 rounded-full bg-white/95" />
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-300/60" />
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-300/50" />
        </div>
      </div>

      <div className="relative z-20" style={{ marginTop: -22 }}>
        <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-lg border border-emerald-50">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-600">
            <Leaf className="w-5 h-5" />
          </div>
        </div>
      </div>

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 220, delay: 0.05 }}
        className="flex flex-col bg-white dark:bg-gray-900"
        style={{
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
          marginTop: -12,
          zIndex: 10,
          paddingTop: 28,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))",
          boxShadow: "0 -8px 28px rgba(0,0,0,0.06)",
          backgroundImage: "radial-gradient(1200px 100px at 50% -60px, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0) 60%)",
        }}
      >
        <div className="flex flex-col gap-4">
          <Button
            variant="gradient"
            size="xl"
            className="w-full rounded-3xl font-extrabold h-16 text-[17px] shadow-[0_18px_36px_rgba(16,185,129,0.35)]"
            onClick={() => onSwitchView("signup")}
          >
            <span className="flex items-center gap-3">
              <UserPlus className="w-[22px] h-[22px]" />
              {t("create_free_account")}
            </span>
          </Button>

          <button
            type="button"
            onClick={() => onSwitchView("signin")}
            className="w-full rounded-3xl font-semibold h-16 text-[16px] bg-white text-foreground border border-gray-200 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-[0_2px_0_rgba(0,0,0,0.04),_0_10px_22px_rgba(0,0,0,0.05)]"
          >
            <span className="flex items-center justify-center gap-3">
              <Lock className="w-[20px] h-[20px] text-emerald-600" />
              {t("sign_in")}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 mt-6 mb-4">
          <div className="h-px bg-gray-200 flex-1" />
          <span className="text-[12px] text-gray-500">Or continue with</span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>
        <div className="flex items-center justify-center gap-4">
          {[
            { key: "google", icon: GoogleIcon },
            { key: "apple", icon: AppleIcon },
            { key: "facebook", icon: FacebookIcon },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              className="w-12 h-12 rounded-full bg-white border border-gray-200 shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:shadow-md transition-shadow flex items-center justify-center"
              aria-label={s.key}
            >
              {s.icon}
            </button>
          ))}
        </div>

        <p className="mt-7 text-[12px] text-center text-gray-500">
          By continuing, you agree to our
          <span className="mx-1" />
          <Link to="/privacy" className="text-emerald-700 hover:underline">{t("privacy_policy")}</Link>
          <span className="mx-1">|</span>
          <Link to="/terms" className="text-emerald-700 hover:underline">{t("terms")}</Link>
        </p>
      </motion.div>
    </div>
  );
};
