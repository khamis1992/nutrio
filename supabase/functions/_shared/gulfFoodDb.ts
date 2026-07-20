// Curated Khaleeji/Gulf dish nutrition reference used to verify AI photo
// estimates before falling back to USDA (which has poor coverage of regional
// dishes). Values are per 100g of the prepared dish, compiled from published
// GCC food-composition references; `source` tracks provenance so entries can
// be upgraded to QNAS-verified data as the qnas-proxy integration matures.

export interface GulfDishPer100g {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface GulfDish {
  id: string;
  name_en: string;
  name_ar: string;
  aliases: string[];
  per_100g: GulfDishPer100g;
  typical_serving_g: number;
  category: "main" | "side" | "breakfast" | "dessert" | "drink" | "bread";
  source: "curated_v1" | "qnas_verified";
}

export interface GulfDishMatch {
  dish: GulfDish;
  match_confidence: number;
}

export const GULF_FOOD_DB: GulfDish[] = [
  {
    id: "machboos-chicken",
    name_en: "Chicken Machboos",
    name_ar: "مجبوس دجاج",
    aliases: ["machboos", "majboos", "machbous", "kabsa", "chicken kabsa", "kabsah", "مجبوس", "كبسة", "كبسة دجاج", "مكبوس"],
    per_100g: { calories: 150, protein_g: 9, carbs_g: 18, fat_g: 4.5 },
    typical_serving_g: 350,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "machboos-lamb",
    name_en: "Lamb Machboos",
    name_ar: "مجبوس لحم",
    aliases: ["lamb machboos", "lamb kabsa", "meat machboos", "مجبوس لحم", "كبسة لحم"],
    per_100g: { calories: 165, protein_g: 8.5, carbs_g: 17, fat_g: 7 },
    typical_serving_g: 350,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "machboos-shrimp",
    name_en: "Shrimp Machboos",
    name_ar: "مجبوس ربيان",
    aliases: ["shrimp machboos", "prawn machboos", "rubyan", "machboos rubyan", "مجبوس ربيان", "كبسة روبيان"],
    per_100g: { calories: 140, protein_g: 8, carbs_g: 19, fat_g: 3.5 },
    typical_serving_g: 350,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "harees",
    name_en: "Harees",
    name_ar: "هريس",
    aliases: ["harees", "harissa wheat", "hareesa", "jareesh harees", "هريس", "الهريس"],
    per_100g: { calories: 120, protein_g: 6, carbs_g: 15, fat_g: 4 },
    typical_serving_g: 250,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "thareed",
    name_en: "Thareed",
    name_ar: "ثريد",
    aliases: ["thareed", "tharid", "thereed", "fatteh stew", "ثريد", "الثريد", "مرقوقة ثريد"],
    per_100g: { calories: 110, protein_g: 6, carbs_g: 13, fat_g: 3.5 },
    typical_serving_g: 300,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "margoog",
    name_en: "Margoog",
    name_ar: "مرقوق",
    aliases: ["margoog", "marqooq", "margooga", "marqouq", "مرقوق", "مرقوقة"],
    per_100g: { calories: 95, protein_g: 5, carbs_g: 13, fat_g: 2.5 },
    typical_serving_g: 300,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "madrouba",
    name_en: "Madrouba",
    name_ar: "مضروبة",
    aliases: ["madrouba", "madhrouba", "mathrooba", "مضروبة", "المضروبة"],
    per_100g: { calories: 115, protein_g: 6.5, carbs_g: 14, fat_g: 3.5 },
    typical_serving_g: 300,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "saloona",
    name_en: "Saloona",
    name_ar: "صالونة",
    aliases: ["saloona", "salona", "salonah", "gulf stew", "صالونة", "صالونه"],
    per_100g: { calories: 85, protein_g: 7, carbs_g: 6, fat_g: 3.5 },
    typical_serving_g: 250,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "mandi-chicken",
    name_en: "Chicken Mandi",
    name_ar: "مندي دجاج",
    aliases: ["mandi", "chicken mandi", "mandy rice", "مندي", "مندي دجاج"],
    per_100g: { calories: 160, protein_g: 10, carbs_g: 17, fat_g: 5.5 },
    typical_serving_g: 350,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "madfoon-lamb",
    name_en: "Lamb Madfoon",
    name_ar: "مدفون لحم",
    aliases: ["madfoon", "madfun", "haneeth", "hanith", "مدفون", "حنيذ"],
    per_100g: { calories: 180, protein_g: 11, carbs_g: 15, fat_g: 8 },
    typical_serving_g: 350,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "ghuzi",
    name_en: "Ghuzi",
    name_ar: "قوزي",
    aliases: ["ghuzi", "ghouzi", "quzi", "qoozi", "ouzi", "قوزي", "غوزي"],
    per_100g: { calories: 175, protein_g: 10, carbs_g: 16, fat_g: 7.5 },
    typical_serving_g: 400,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "biryani-chicken",
    name_en: "Chicken Biryani",
    name_ar: "برياني دجاج",
    aliases: ["biryani", "chicken biryani", "biriani", "برياني", "برياني دجاج"],
    per_100g: { calories: 155, protein_g: 9, carbs_g: 18, fat_g: 5 },
    typical_serving_g: 350,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "sayadieh",
    name_en: "Sayadieh",
    name_ar: "صيادية",
    aliases: ["sayadieh", "sayadiyah", "fish rice", "sayyadiyeh", "صيادية", "صيادية سمك"],
    per_100g: { calories: 145, protein_g: 9.5, carbs_g: 17, fat_g: 4 },
    typical_serving_g: 300,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "jareesh",
    name_en: "Jareesh",
    name_ar: "جريش",
    aliases: ["jareesh", "jarish", "gerish", "جريش", "الجريش"],
    per_100g: { calories: 110, protein_g: 5.5, carbs_g: 15, fat_g: 3 },
    typical_serving_g: 250,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "maqluba",
    name_en: "Maqluba",
    name_ar: "مقلوبة",
    aliases: ["maqluba", "maqlooba", "makloubeh", "maqlouba", "مقلوبة"],
    per_100g: { calories: 140, protein_g: 7, carbs_g: 17, fat_g: 5 },
    typical_serving_g: 300,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "mansaf",
    name_en: "Mansaf",
    name_ar: "منسف",
    aliases: ["mansaf", "منسف"],
    per_100g: { calories: 180, protein_g: 11, carbs_g: 15, fat_g: 8 },
    typical_serving_g: 350,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "shawarma-chicken",
    name_en: "Chicken Shawarma Sandwich",
    name_ar: "شاورما دجاج",
    aliases: ["shawarma", "chicken shawarma", "shawerma", "شاورما", "شاورما دجاج", "شاورما لحم"],
    per_100g: { calories: 215, protein_g: 13, carbs_g: 20, fat_g: 9 },
    typical_serving_g: 250,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "shish-tawook",
    name_en: "Shish Tawook",
    name_ar: "شيش طاووق",
    aliases: ["shish tawook", "tawook", "shish taouk", "شيش طاووق", "طاووق"],
    per_100g: { calories: 150, protein_g: 22, carbs_g: 3, fat_g: 5.5 },
    typical_serving_g: 200,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "kofta-kebab",
    name_en: "Kofta Kebab",
    name_ar: "كفتة",
    aliases: ["kofta", "kufta", "kofta kebab", "kebab", "كفتة", "كباب"],
    per_100g: { calories: 230, protein_g: 17, carbs_g: 4, fat_g: 16 },
    typical_serving_g: 200,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "falafel",
    name_en: "Falafel",
    name_ar: "فلافل",
    aliases: ["falafel", "felafel", "taamiya", "فلافل", "طعمية"],
    per_100g: { calories: 333, protein_g: 13, carbs_g: 32, fat_g: 18 },
    typical_serving_g: 100,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "hummus",
    name_en: "Hummus",
    name_ar: "حمص",
    aliases: ["hummus", "houmous", "hommos", "حمص", "متبل حمص"],
    per_100g: { calories: 166, protein_g: 8, carbs_g: 14, fat_g: 10 },
    typical_serving_g: 100,
    category: "side",
    source: "curated_v1",
  },
  {
    id: "moutabal",
    name_en: "Moutabal",
    name_ar: "متبل",
    aliases: ["moutabal", "mutabbal", "baba ghanoush", "baba ganoush", "متبل", "بابا غنوج"],
    per_100g: { calories: 130, protein_g: 3, carbs_g: 8, fat_g: 10 },
    typical_serving_g: 100,
    category: "side",
    source: "curated_v1",
  },
  {
    id: "tabbouleh",
    name_en: "Tabbouleh",
    name_ar: "تبولة",
    aliases: ["tabbouleh", "tabouleh", "tabbouli", "تبولة"],
    per_100g: { calories: 120, protein_g: 3, carbs_g: 13, fat_g: 7 },
    typical_serving_g: 150,
    category: "side",
    source: "curated_v1",
  },
  {
    id: "fattoush",
    name_en: "Fattoush",
    name_ar: "فتوش",
    aliases: ["fattoush", "fatoush", "fattouch", "فتوش"],
    per_100g: { calories: 90, protein_g: 2, carbs_g: 10, fat_g: 5 },
    typical_serving_g: 200,
    category: "side",
    source: "curated_v1",
  },
  {
    id: "warak-enab",
    name_en: "Stuffed Vine Leaves",
    name_ar: "ورق عنب",
    aliases: ["warak enab", "waraq enab", "stuffed vine leaves", "stuffed grape leaves", "dolma", "ورق عنب", "دولمة"],
    per_100g: { calories: 150, protein_g: 4, carbs_g: 20, fat_g: 6 },
    typical_serving_g: 150,
    category: "side",
    source: "curated_v1",
  },
  {
    id: "samboosa",
    name_en: "Samboosa",
    name_ar: "سمبوسة",
    aliases: ["samboosa", "sambousek", "samosa", "sambosa", "سمبوسة", "سمبوسك"],
    per_100g: { calories: 280, protein_g: 7, carbs_g: 28, fat_g: 15 },
    typical_serving_g: 60,
    category: "side",
    source: "curated_v1",
  },
  {
    id: "mutabbaq",
    name_en: "Mutabbaq",
    name_ar: "مطبق",
    aliases: ["mutabbaq", "murtabak", "mutabbag", "مطبق"],
    per_100g: { calories: 250, protein_g: 8, carbs_g: 30, fat_g: 11 },
    typical_serving_g: 150,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "dal-adas",
    name_en: "Lentil Dal",
    name_ar: "عدس",
    aliases: ["dal", "daal", "adas", "lentil stew", "lentil soup", "عدس", "شوربة عدس", "دال"],
    per_100g: { calories: 90, protein_g: 5, carbs_g: 12, fat_g: 2.5 },
    typical_serving_g: 250,
    category: "main",
    source: "curated_v1",
  },
  {
    id: "balaleet",
    name_en: "Balaleet",
    name_ar: "بلاليط",
    aliases: ["balaleet", "balaleit", "balalit", "sweet vermicelli", "بلاليط"],
    per_100g: { calories: 220, protein_g: 6, carbs_g: 32, fat_g: 8 },
    typical_serving_g: 200,
    category: "breakfast",
    source: "curated_v1",
  },
  {
    id: "khubz-regag",
    name_en: "Regag Bread",
    name_ar: "خبز رقاق",
    aliases: ["regag", "ragag", "raqaq", "khubz regag", "رقاق", "خبز رقاق"],
    per_100g: { calories: 300, protein_g: 8, carbs_g: 60, fat_g: 3 },
    typical_serving_g: 40,
    category: "bread",
    source: "curated_v1",
  },
  {
    id: "chapati",
    name_en: "Chapati",
    name_ar: "جباتي",
    aliases: ["chapati", "chapatti", "chabati", "جباتي", "شباتي"],
    per_100g: { calories: 300, protein_g: 8, carbs_g: 46, fat_g: 9 },
    typical_serving_g: 80,
    category: "bread",
    source: "curated_v1",
  },
  {
    id: "luqaimat",
    name_en: "Luqaimat",
    name_ar: "لقيمات",
    aliases: ["luqaimat", "logaimat", "lgeimat", "luqemat", "awameh", "لقيمات", "عوامة"],
    per_100g: { calories: 330, protein_g: 4, carbs_g: 52, fat_g: 12 },
    typical_serving_g: 100,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "khanfaroosh",
    name_en: "Khanfaroosh",
    name_ar: "خنفروش",
    aliases: ["khanfaroosh", "khanfroosh", "خنفروش"],
    per_100g: { calories: 320, protein_g: 6, carbs_g: 45, fat_g: 13 },
    typical_serving_g: 80,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "um-ali",
    name_en: "Um Ali",
    name_ar: "أم علي",
    aliases: ["um ali", "umm ali", "om ali", "أم علي", "ام علي"],
    per_100g: { calories: 230, protein_g: 6, carbs_g: 28, fat_g: 11 },
    typical_serving_g: 150,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "kunafa",
    name_en: "Kunafa",
    name_ar: "كنافة",
    aliases: ["kunafa", "knafeh", "kunafah", "konafa", "كنافة"],
    per_100g: { calories: 350, protein_g: 6, carbs_g: 42, fat_g: 18 },
    typical_serving_g: 120,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "basbousa",
    name_en: "Basbousa",
    name_ar: "بسبوسة",
    aliases: ["basbousa", "basboosa", "harissa cake", "hareeseh dessert", "بسبوسة", "هريسة حلى"],
    per_100g: { calories: 330, protein_g: 5, carbs_g: 50, fat_g: 13 },
    typical_serving_g: 100,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "mahalabia",
    name_en: "Mahalabia",
    name_ar: "مهلبية",
    aliases: ["mahalabia", "muhallebi", "mahalabiya", "مهلبية"],
    per_100g: { calories: 120, protein_g: 3.5, carbs_g: 18, fat_g: 4 },
    typical_serving_g: 150,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "halwa-omani",
    name_en: "Omani Halwa",
    name_ar: "حلوى عمانية",
    aliases: ["omani halwa", "halwa", "halva", "حلوى", "حلوى عمانية"],
    per_100g: { calories: 400, protein_g: 2, carbs_g: 65, fat_g: 15 },
    typical_serving_g: 60,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "batheeth",
    name_en: "Batheeth",
    name_ar: "بثيث",
    aliases: ["batheeth", "bthith", "بثيث"],
    per_100g: { calories: 380, protein_g: 5, carbs_g: 60, fat_g: 14 },
    typical_serving_g: 80,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "aseeda",
    name_en: "Aseeda",
    name_ar: "عصيدة",
    aliases: ["aseeda", "asida", "aseedah", "عصيدة"],
    per_100g: { calories: 250, protein_g: 4, carbs_g: 45, fat_g: 6 },
    typical_serving_g: 150,
    category: "dessert",
    source: "curated_v1",
  },
  {
    id: "dates",
    name_en: "Dates",
    name_ar: "تمر",
    aliases: ["dates", "tamr", "khalas dates", "sukkari dates", "medjool", "تمر", "رطب", "تمور"],
    per_100g: { calories: 280, protein_g: 2.5, carbs_g: 75, fat_g: 0.4 },
    typical_serving_g: 30,
    category: "side",
    source: "curated_v1",
  },
  {
    id: "karak-tea",
    name_en: "Karak Tea",
    name_ar: "شاي كرك",
    aliases: ["karak", "karak tea", "chai karak", "karak chai", "كرك", "شاي كرك"],
    per_100g: { calories: 60, protein_g: 1.5, carbs_g: 9, fat_g: 2 },
    typical_serving_g: 200,
    category: "drink",
    source: "curated_v1",
  },
  {
    id: "arabic-coffee",
    name_en: "Arabic Coffee",
    name_ar: "قهوة عربية",
    aliases: ["arabic coffee", "gahwa", "qahwa", "gulf coffee", "قهوة عربية", "قهوة"],
    per_100g: { calories: 2, protein_g: 0.1, carbs_g: 0.4, fat_g: 0 },
    typical_serving_g: 60,
    category: "drink",
    source: "curated_v1",
  },
  {
    id: "laban",
    name_en: "Laban Drink",
    name_ar: "لبن",
    aliases: ["laban", "laban drink", "buttermilk drink", "ayran", "لبن", "لبن شرب"],
    per_100g: { calories: 40, protein_g: 3, carbs_g: 4.5, fat_g: 1 },
    typical_serving_g: 250,
    category: "drink",
    source: "curated_v1",
  },
];

const MATCH_THRESHOLD = 0.75;

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    // Strip Arabic diacritics (tashkeel + tatweel).
    .replace(/[ً-ْـ]/g, "")
    // Normalize alef/teh-marbuta/alef-maqsura variants.
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    // Keep latin letters, digits, and Arabic letters; everything else → space.
    .replace(/[^a-z0-9؀-ۿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeName(value).split(" ").filter((word) =>
    word.length > 1 || /[؀-ۿ]/.test(word)
  );
}

/**
 * Match a detected food name (English or Arabic, any transliteration in the
 * alias list) against the curated Gulf dish database.
 *
 * Scoring: exact normalized alias match → 1.0; alias fully contained in the
 * name → 0.9; otherwise token-overlap ratio of the best alias. Matches below
 * MATCH_THRESHOLD are rejected.
 */
export function matchGulfDish(name: string): GulfDishMatch | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const nameTokens = new Set(tokenize(name));

  let best: GulfDishMatch | null = null;
  for (const dish of GULF_FOOD_DB) {
    const candidates = [dish.name_en, dish.name_ar, ...dish.aliases];
    let dishScore = 0;

    for (const candidate of candidates) {
      const candidateNormalized = normalizeName(candidate);
      if (!candidateNormalized) continue;

      if (candidateNormalized === normalized) {
        dishScore = 1;
        break;
      }
      if (
        normalized.includes(candidateNormalized) ||
        candidateNormalized.includes(normalized)
      ) {
        dishScore = Math.max(dishScore, 0.9);
        continue;
      }

      const candidateTokens = tokenize(candidate);
      if (!candidateTokens.length || !nameTokens.size) continue;
      let overlap = 0;
      for (const token of candidateTokens) {
        if (nameTokens.has(token)) overlap += 1;
      }
      dishScore = Math.max(dishScore, overlap / candidateTokens.length);
    }

    if (dishScore >= MATCH_THRESHOLD && (!best || dishScore > best.match_confidence)) {
      best = { dish, match_confidence: Math.round(dishScore * 100) / 100 };
    }
  }

  return best;
}

/** Dish names surfaced to the vision model so it labels regional dishes properly. */
export function gulfDishPromptNames(limit = 30): string {
  return GULF_FOOD_DB.slice(0, limit).map((dish) => dish.name_en).join(", ");
}
