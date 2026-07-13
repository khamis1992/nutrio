/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Language, TranslationMap } from "@/i18n";
import { loadTranslations } from "@/i18n";

export type { Language } from "@/i18n";

// ─── Static fallback keys (most critical UI strings) ──────────────────────────
const FALLBACK: Record<Language, TranslationMap> = {
  en: { nav_home: "Home", loading: "Loading...", error: "Error", retry: "Retry" },
  ar: { nav_home: "الرئيسية", loading: "جاري التحميل...", error: "خطأ", retry: "إعادة المحاولة" },
};

// ─── Loading Spinner ──────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "#f8fafc",
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: "4px solid #e2e8f0",
        borderTopColor: "#6366f1",
        borderRadius: "50%",
        animation: "nutrio-spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes nutrio-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────
export type TranslationKey = string;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
  isRTL: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return (localStorage.getItem("nutrio_language") as Language) || "en";
    } catch {
      return "en";
    }
  });

  const [translations, setTranslations] = useState<TranslationMap | null>(null);
  const isRTL = language === "ar";

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("nutrio_language", lang);
    } catch (e) {
      console.warn("[LanguageContext] Failed to save language preference:", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setTranslations(null);
    loadTranslations(language).then((mod) => {
      if (!cancelled) setTranslations(mod);
    }).catch((err) => {
      console.error("[LanguageContext] Failed to load translations:", err);
      if (!cancelled) setTranslations(FALLBACK[language]);
    });
    return () => { cancelled = true; };
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", language);
    if (isRTL) {
      document.documentElement.classList.add("rtl");
    } else {
      document.documentElement.classList.remove("rtl");
    }
  }, [language, isRTL]);

  if (!translations) {
    return <LoadingSpinner />;
  }

  const t = (key: TranslationKey | string, params?: Record<string, string | number>): string => {
    let translation = translations[key] ?? key;
    const values = {
      year: new Date().getFullYear(),
      ...params,
    };

    Object.entries(values).forEach(([paramKey, paramValue]) => {
      translation = translation.split(`{${paramKey}}`).join(String(paramValue));
    });

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLanguage() {
  return useContext(LanguageContext);
}
