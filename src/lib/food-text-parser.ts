import type { FoodProviderRegistry, FoodSearchItem } from "@/lib/food-providers";

export type FoodAmountUnit = "serving" | "piece" | "cup" | "gram" | "milliliter";

export interface ParsedFoodPhrase {
  raw: string;
  query: string;
  amount: number;
  unit: FoodAmountUnit;
}

export interface ResolvedFoodPhrase extends ParsedFoodPhrase {
  candidates: FoodSearchItem[];
  selectedId: string | null;
  confidence: "high" | "medium" | "low";
  quantity: number;
  usesServingEstimate: boolean;
}

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

const FOOD_ALIASES: Array<[RegExp, string]> = [
  [/(?<!\p{L})(?:أرز|ارز|رز)(?!\p{L})/giu, "rice"],
  [/(?<!\p{L})(?:دجاج|فراخ)(?!\p{L})/giu, "chicken"],
  [/(?<!\p{L})(?:بيض|بيضة|بيضتين)(?!\p{L})/giu, "egg"],
  [/(?<!\p{L})(?:خبز|عيش)(?!\p{L})/giu, "bread"],
  [/(?<!\p{L})(?:سلطة|سلطه)(?!\p{L})/giu, "salad"],
  [/(?<!\p{L})(?:تونة|تونه)(?!\p{L})/giu, "tuna"],
  [/(?<!\p{L})شوفان(?!\p{L})/giu, "oats"],
  [/(?<!\p{L})(?:زبادي|لبن رائب)(?!\p{L})/giu, "yogurt"],
  [/(?<!\p{L})(?:حليب|لبن)(?!\p{L})/giu, "milk"],
  [/(?<!\p{L})(?:تفاح|تفاحة)(?!\p{L})/giu, "apple"],
  [/(?<!\p{L})(?:موز|موزة)(?!\p{L})/giu, "banana"],
  [/(?<!\p{L})(?:بطاطس|بطاطا)(?!\p{L})/giu, "potato"],
  [/(?<!\p{L})(?:لحم|لحمة)(?!\p{L})/giu, "beef"],
  [/(?<!\p{L})(?:سمك|سمكة)(?!\p{L})/giu, "fish"],
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, a: 1, an: 1, two: 2, three: 3,
  واحد: 1, واحدة: 1, حبة: 1, حبه: 1,
  اثنان: 2, اثنين: 2, اثنتان: 2, اثنتين: 2, حبتين: 2,
  ثلاثة: 3, ثلاث: 3,
};

const UNIT_PATTERNS: Array<{ pattern: RegExp; unit: FoodAmountUnit }> = [
  { pattern: /^(?:g|gram|grams|غ|غم|جرام|جرامات)$/iu, unit: "gram" },
  { pattern: /^(?:ml|milliliter|milliliters|مل|مليلتر)$/iu, unit: "milliliter" },
  { pattern: /^(?:cup|cups|كوب|أكواب|اكواب)$/iu, unit: "cup" },
  { pattern: /^(?:piece|pieces|pc|pcs|حبة|حبه|حبات|قطعة|قطعه|قطع)$/iu, unit: "piece" },
  { pattern: /^(?:serving|servings|portion|portions|حصة|حصه|حصص)$/iu, unit: "serving" },
];

const INTRO_WORDS = /^(?:(?:i\s+)?(?:ate|had|eaten|logged)|(?:أكلت|اكلت|تناولت|فطرت|تعشيت|تغديت))\s+/iu;
const MEAL_WORDS = /\b(?:for\s+)?(?:breakfast|lunch|dinner|snack|الفطور|فطور|الغداء|غداء|العشاء|عشاء)\b/giu;

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] ?? digit);
}

function normalizeQuery(value: string) {
  let query = value;
  for (const [pattern, replacement] of FOOD_ALIASES) query = query.replace(pattern, replacement);
  return query.replace(/\s+/g, " ").trim();
}

function getUnit(token: string | undefined): FoodAmountUnit | null {
  if (!token) return null;
  return UNIT_PATTERNS.find(({ pattern }) => pattern.test(token))?.unit ?? null;
}

function parseClause(rawClause: string): ParsedFoodPhrase | null {
  let clause = normalizeDigits(rawClause)
    .replace(INTRO_WORDS, "")
    .replace(MEAL_WORDS, "")
    .replace(/^(?:with|plus|and|مع|و)\s+/iu, "")
    .trim();
  if (!clause) return null;

  let amount = 1;
  let unit: FoodAmountUnit = "serving";
  if (/^(?:بيضتين|بيضان)(?:\s|$)/u.test(clause)) {
    amount = 2;
    unit = "piece";
  }
  const numeric = clause.match(/^(\d+(?:[.,]\d+)?)\s*/u);
  if (numeric) {
    amount = Math.max(0.1, Number(numeric[1].replace(",", ".")) || 1);
    clause = clause.slice(numeric[0].length).trim();
    const possibleUnit = clause.split(/\s+/)[0];
    const parsedUnit = getUnit(possibleUnit);
    if (parsedUnit) {
      unit = parsedUnit;
      clause = clause.slice(possibleUnit.length).trim();
    }
  } else {
    const firstToken = clause.split(/\s+/)[0].toLocaleLowerCase();
    if (NUMBER_WORDS[firstToken]) {
      amount = NUMBER_WORDS[firstToken];
      clause = clause.slice(firstToken.length).trim();
      const possibleUnit = clause.split(/\s+/)[0];
      const parsedUnit = getUnit(possibleUnit);
      if (parsedUnit) {
        unit = parsedUnit;
        clause = clause.slice(possibleUnit.length).trim();
      } else if (["حبة", "حبه", "حبتين"].includes(firstToken)) {
        unit = "piece";
      }
    }
  }

  clause = clause.replace(/^(?:of|من)\s+/iu, "").trim();
  const query = normalizeQuery(clause);
  if (query.length < 2) return null;
  return { raw: rawClause.trim(), query, amount, unit };
}

export function parseFoodTextInput(text: string): ParsedFoodPhrase[] {
  const normalized = normalizeDigits(text).trim();
  if (!normalized) return [];

  return normalized
    .split(/\s*(?:,|،|;|؛|\n|\s+\+\s+|\s+and\s+|\s+plus\s+|\s+و\s+|\s+و(?=[\p{L}\d])|\s+مع\s+)\s*/iu)
    .map(parseClause)
    .filter((item): item is ParsedFoodPhrase => item !== null)
    .slice(0, 8);
}

function tokenSet(value: string) {
  return new Set(value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

function matchConfidence(query: string, candidate: FoodSearchItem | undefined) {
  if (!candidate) return "low" as const;
  const normalizedQuery = query.toLocaleLowerCase();
  const normalizedName = candidate.name.toLocaleLowerCase();
  if (normalizedName === normalizedQuery || normalizedName.startsWith(`${normalizedQuery} `)) return "high" as const;

  const queryTokens = tokenSet(normalizedQuery);
  const nameTokens = tokenSet(normalizedName);
  const matched = [...queryTokens].filter((token) => nameTokens.has(token)).length;
  return matched >= Math.max(1, Math.ceil(queryTokens.size * 0.6)) ? "medium" as const : "low" as const;
}

export async function resolveFoodText(
  text: string,
  registry: Pick<FoodProviderRegistry, "search">,
): Promise<ResolvedFoodPhrase[]> {
  const phrases = parseFoodTextInput(text);
  return Promise.all(phrases.map(async (phrase) => {
    const candidates = await registry.search(phrase.query, 6);
    const selected = candidates[0];
    const usesServingEstimate = phrase.unit === "gram" || phrase.unit === "milliliter" || phrase.unit === "cup";
    return {
      ...phrase,
      candidates,
      selectedId: selected?.id ?? null,
      confidence: usesServingEstimate ? "low" : matchConfidence(phrase.query, selected),
      quantity: phrase.unit === "serving" || phrase.unit === "piece" ? phrase.amount : 1,
      usesServingEstimate,
    };
  }));
}
