export type HealthTag =
  | "heart-healthy"
  | "iron-rich"
  | "low-glycemic"
  | "vitamin-d-rich"
  | "b12-rich"
  | "anti-inflammatory"
  | "high-protein"
  | "low-sodium"
  | "bone-healthy"
  | "energy-boosting";

export interface MealNutritionData {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  ingredients: string | null;
  name: string;
  description: string | null;
  category: string;
}

const HEART_HEALTHY_MAX_FAT = 15;
const HEART_HEALTHY_MIN_FIBER = 5;
const HEART_HEALTHY_MAX_SATURATED_INGREDIENTS = ["beef fat", "lard", "butter"];
const HEART_HEALTHY_GOOD_INGREDIENTS = ["salmon", "tuna", "mackerel", "sardine", "oats", "avocado", "olive oil", "walnu", "almond", "chia", "flax"];

const IRON_RICH_FOODS = ["liver", "beef", "lamb", "spinach", "lentil", "kale", "chickpea", "tofu", "pumpkin seed", "dark chocolate", "red meat"];
const LOW_GLYCEMIC_GOOD = ["broccoli", "cauliflower", "leafy green", "egg", "fish", "chicken", "tofu", "avocado", "nut", "seed", "berry", "bean", "lentil"];
const VITAMIN_D_FOODS = ["salmon", "tuna", "mackerel", "sardine", "egg yolk", "milk", "yogurt", "mushroom", "fortified"];
const B12_FOODS = ["beef", "liver", "salmon", "tuna", "egg", "milk", "yogurt", "cheese", "chicken", "lamb"];
const ANTI_INFLAMMATORY_FOODS = ["turmeric", "ginger", "berry", "blueber", "strawber", "salmon", "spinach", "kale", "olive oil", "avocado", "tomato", "garlic", "green tea"];
const BONE_HEALTHY_FOODS = ["milk", "yogurt", "cheese", "almond", "broccoli", "kale", "spinach", "sardine", "tofu", "fig", "sesame"];
const LOW_SODIUM_AVOID = ["soy sauce", "salted", "cured", "smoked", "processed cheese", "pickle", "bacon", "ham", "sausage"];
const ENERGY_FOODS = ["oats", "banana", "egg", "spinach", "sweet potato", "bean", "lentil", " almond", "quinoa", "dark chocolate"];

const HIGH_PROTEIN_MIN = 20;
const LOW_GLYCEMIC_MAX_CARB = 30;
const HIGH_PROTEIN_MIN_PER_CAL = 0.08;

function containsAny(text: string, foods: string[]): boolean {
  return foods.some(f => text.includes(f));
}

export function computeMealHealthTags(meal: MealNutritionData): HealthTag[] {
  const tags: HealthTag[] = [];
  const ingredientsText = (meal.ingredients || "").toLowerCase();
  const searchText = `${ingredientsText} ${meal.name.toLowerCase()} ${(meal.description || "").toLowerCase()}`;

  if ((meal.protein_g || 0) >= HIGH_PROTEIN_MIN) {
    tags.push("high-protein");
  } else if (meal.calories && meal.calories > 0 && (meal.protein_g || 0) / meal.calories >= HIGH_PROTEIN_MIN_PER_CAL) {
    tags.push("high-protein");
  }

  if ((meal.fat_g || 99) <= HEART_HEALTHY_MAX_FAT && (meal.fiber_g || 0) >= HEART_HEALTHY_MIN_FIBER) {
    const hasBadFat = containsAny(searchText, HEART_HEALTHY_MAX_SATURATED_INGREDIENTS);
    if (!hasBadFat) tags.push("heart-healthy");
  }
  if (containsAny(searchText, HEART_HEALTHY_GOOD_INGREDIENTS)) {
    if (!tags.includes("heart-healthy")) tags.push("heart-healthy");
  }

  if (containsAny(searchText, IRON_RICH_FOODS)) {
    tags.push("iron-rich");
  }

  if ((meal.carbs_g || 99) <= LOW_GLYCEMIC_MAX_CARB && (meal.fiber_g || 0) >= 4) {
    tags.push("low-glycemic");
  }
  if (containsAny(searchText, LOW_GLYCEMIC_GOOD) && (meal.carbs_g || 999) <= 40) {
    if (!tags.includes("low-glycemic")) tags.push("low-glycemic");
  }

  if (containsAny(searchText, VITAMIN_D_FOODS)) {
    tags.push("vitamin-d-rich");
  }

  if (containsAny(searchText, B12_FOODS)) {
    tags.push("b12-rich");
  }

  if (containsAny(searchText, ANTI_INFLAMMATORY_FOODS)) {
    tags.push("anti-inflammatory");
  }

  if (containsAny(searchText, BONE_HEALTHY_FOODS)) {
    tags.push("bone-healthy");
  }

  if (!containsAny(searchText, LOW_SODIUM_AVOID)) {
    tags.push("low-sodium");
  }

  if (containsAny(searchText, ENERGY_FOODS)) {
    tags.push("energy-boosting");
  }

  return tags;
}

const MARKER_TAG_MAP: Record<string, HealthTag[]> = {
  "vitamin d": ["vitamin-d-rich", "bone-healthy"],
  "ldl": ["heart-healthy", "anti-inflammatory"],
  "total cholesterol": ["heart-healthy"],
  "triglycerides": ["heart-healthy", "low-glycemic"],
  "glucose": ["low-glycemic", "high-protein"],
  "hba1c": ["low-glycemic", "high-protein", "anti-inflammatory"],
  "fasting glucose": ["low-glycemic", "high-protein"],
  "hemoglobin": ["iron-rich", "energy-boosting"],
  "iron": ["iron-rich", "energy-boosting"],
  "ferritin": ["iron-rich", "energy-boosting"],
  "vitamin b12": ["b12-rich", "energy-boosting"],
  "crp": ["anti-inflammatory", "heart-healthy"],
  "esr": ["anti-inflammatory"],
  "tsh": ["energy-boosting", "bone-healthy"],
  "calcium": ["bone-healthy"],
  "vitamin b": ["b12-rich", "energy-boosting"],
  "folate": ["energy-boosting", "iron-rich"],
  "folic acid": ["energy-boosting", "iron-rich"],
};

export function getAbnormalMarkerTags(markerName: string): HealthTag[] {
  const key = markerName.toLowerCase().trim();
  return MARKER_TAG_MAP[key] || [];
}