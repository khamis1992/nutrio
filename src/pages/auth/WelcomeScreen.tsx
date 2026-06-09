import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Leaf, Lock, UserPlus } from "lucide-react";

interface WelcomeScreenProps { onSwitchView: (view: "signup" | "signin") => void; }

export const WelcomeScreen = ({ onSwitchView }: WelcomeScreenProps) => {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white dark:bg-gray-950" style={{ maxWidth: 430, margin: "0 auto" }}>
      {/* ── Hero ── */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden flex-1" style={{ background: "radial-gradient(1200px 600px at 80% -10%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%), linear-gradient(135deg, #0FB56D 0%, #12C88A 55%, #0EBB79 100%)", paddingBottom: "2.75rem" }}>
        <motion.div animate={{ scale: [1, 1.08, 1], x: [0, 8, 0], y: [0, 10, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", top: -80, right: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <motion.div animate={{ scale: [1, 1.12, 1], x: [0, -12, 0], y: [0, -10, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }} style={{ position: "absolute", bottom: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <svg aria-hidden width="420" height="420" viewBox="0 0 420 420" className="pointer-events-none absolute -right-16 top-12 opacity-60" style={{ filter: "blur(0.3px)" }}><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.9" /><stop offset="100%" stopColor="#34D399" stopOpacity="0.55" /></linearGradient></defs><path d="M300 0c40 120-30 210-120 240 70-80 60-170-20-220 70 10 110 0 140-20z" fill="url(#lg1)" /><path d="M360 80c20 60-10 110-70 130 40-50 35-105-12-136 42 7 63 0 82-12z" fill="#A7F3D0" opacity="0.5" /></svg>
        <svg aria-hidden width="420" height="420" viewBox="0 0 420 420" className="pointer-events-none absolute -left-24 bottom-6 opacity-60" style={{ filter: "blur(0.3px)" }}><defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.9" /><stop offset="100%" stopColor="#34D399" stopOpacity="0.55" /></linearGradient></defs><path d="M160 380c-60-10-120-70-130-150 60 80 150 80 210 10-30 80-60 120-80 140z" fill="url(#lg2)" /></svg>

        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex items-center justify-center mb-8" style={{ width: 100, height: 100, borderRadius: 28, background: "#ffffff", boxShadow: "0 22px 50px rgba(0,0,0,0.18)" }}><Logo size="md" /></motion.div>
        <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }} style={{ fontSize: 38, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.1, marginBottom: 14, letterSpacing: -0.5, padding: "0 28px" }}>{t("eat_smart")}<br />{t("live_better")}</motion.h1>
        <div className="relative mt-1 mb-2" style={{ height: 16 }}><svg width="160" height="16" viewBox="0 0 160 16" className="mx-auto block"><defs><linearGradient id="swg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#A7F3D0" /><stop offset="100%" stopColor="#34D399" /></linearGradient></defs><path d="M5 11 C 55 2, 105 2, 155 11" stroke="url(#swg)" strokeWidth="6" strokeLinecap="round" fill="none" /><circle cx="144" cy="12" r="3" fill="#34D399" /></svg></div>
        <motion.p initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }} style={{ fontSize: 17, color: "rgba(255,255,255,0.92)", textAlign: "center", lineHeight: 1.5, padding: "0 36px" }}>{t("personalized_nutrition_tagline")}</motion.p>
        <div className="flex items-center gap-2 mt-4"><span className="inline-block w-2 h-2 rounded-full bg-white/95" /><span className="inline-block w-2 h-2 rounded-full bg-emerald-300/60" /><span className="inline-block w-2 h-2 rounded-full bg-emerald-300/50" /></div>
      </div>

      {/* Leaf connector */}
      <div className="relative z-20" style={{ marginTop: -22 }}><div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100"><div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-600"><Leaf className="w-5 h-5" /></div></div></div>

      {/* Bottom card */}
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 24, stiffness: 220, delay: 0.05 }} className="flex flex-col bg-white dark:bg-gray-900" style={{ borderTopLeftRadius: 36, borderTopRightRadius: 36, marginTop: -12, zIndex: 10, paddingTop: 28, paddingLeft: 20, paddingRight: 20, paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))", boxShadow: "0 -4px 16px rgba(0,0,0,0.04)", backgroundImage: "radial-gradient(1200px 100px at 50% -60px, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0) 60%)" }}>
        <div className="flex flex-col gap-4">
          <Button variant="gradient" size="xl" className="w-full rounded-3xl font-extrabold h-16 text-[17px] shadow-[0_8px_24px_rgba(16,185,129,0.3)]" onClick={() => onSwitchView("signup")}>
            <span className="flex items-center gap-3"><UserPlus className="w-[22px] h-[22px]" />{t("create_free_account")}</span>
          </Button>
          <button type="button" onClick={() => onSwitchView("signin")} className="w-full rounded-3xl font-semibold h-16 text-[16px] bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <span className="flex items-center justify-center gap-3"><Lock className="w-[20px] h-[20px] text-emerald-600" />{t("sign_in")}</span>
          </button>
        </div>

        <p className="mt-6 text-[12px] text-center text-slate-400">By continuing, you agree to our <span className="mx-1" /><Link to="/privacy" className="text-emerald-600 hover:underline">{t("privacy_policy")}</Link><span className="mx-1">|</span><Link to="/terms" className="text-emerald-600 hover:underline">{t("terms")}</Link></p>
      </motion.div>
    </div>
  );
};
