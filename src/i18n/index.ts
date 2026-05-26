export type Language = "en" | "ar";
export type TranslationMap = Record<string, string>;

export async function loadTranslations(language: Language): Promise<TranslationMap> {
  const module = await import(`./${language}.json`);
  return module.default;
}
