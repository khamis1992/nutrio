export type Language = "en" | "ar";
export type TranslationMap = Record<string, string>;

// IMPORTANT: Do NOT use /* @vite-ignore */ on the dynamic imports below.
// Without that comment, Vite statically analyses both branches and emits
// en.json and ar.json as separate async chunks in dist/assets/.
// With @vite-ignore, Vite skips the import entirely — the JSON files are
// never copied to dist, so the runtime fetch fails and LanguageProvider
// stays in its loading state forever, producing a blank white screen on APK.
export async function loadTranslations(language: Language): Promise<TranslationMap> {
  if (language === "ar") {
    const module = await import("./ar.json");
    return module.default as TranslationMap;
  }
  const module = await import("./en.json");
  return module.default as TranslationMap;
}
