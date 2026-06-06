export interface Ingredient {
  id: string;
  name: string;
  category: "protein" | "vegetable" | "grain" | "fruit" | "dairy" | "oil" | "snack" | "supplement";
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  price_qar: number;
  unit: string;
  unit_size: number;
  image_url: string;
  in_stock: boolean;
}

const STORAGE_KEY = "nutrio_ingredient_catalog";

const DEFAULT_CATALOG: Ingredient[] = [
  { id: "chicken_breast", name: "Chicken Breast", category: "protein", calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, price_qar: 25, unit: "g", unit_size: 500, image_url: "🍗", in_stock: true },
  { id: "salmon", name: "Atlantic Salmon", category: "protein", calories_per_100g: 208, protein_per_100g: 20, carbs_per_100g: 0, fat_per_100g: 13, price_qar: 45, unit: "g", unit_size: 300, image_url: "🐟", in_stock: true },
  { id: "eggs", name: "Free-Range Eggs", category: "protein", calories_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1.1, fat_per_100g: 11, price_qar: 18, unit: "piece", unit_size: 12, image_url: "🥚", in_stock: true },
  { id: "whey_protein", name: "Whey Protein (Vanilla)", category: "supplement", calories_per_100g: 380, protein_per_100g: 80, carbs_per_100g: 8, fat_per_100g: 4, price_qar: 120, unit: "scoop", unit_size: 30, image_url: "💪", in_stock: true },
  { id: "spinach", name: "Baby Spinach", category: "vegetable", calories_per_100g: 23, protein_per_100g: 2.9, carbs_per_100g: 3.6, fat_per_100g: 0.4, price_qar: 12, unit: "g", unit_size: 250, image_url: "🥬", in_stock: true },
  { id: "avocado", name: "Avocado", category: "fruit", calories_per_100g: 160, protein_per_100g: 2, carbs_per_100g: 8.5, fat_per_100g: 14.7, price_qar: 8, unit: "piece", unit_size: 1, image_url: "🥑", in_stock: true },
  { id: "tomato", name: "Cherry Tomatoes", category: "vegetable", calories_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2, price_qar: 10, unit: "g", unit_size: 300, image_url: "🍅", in_stock: true },
  { id: "brown_rice", name: "Brown Rice", category: "grain", calories_per_100g: 123, protein_per_100g: 2.7, carbs_per_100g: 25.6, fat_per_100g: 1, price_qar: 15, unit: "g", unit_size: 1000, image_url: "🍚", in_stock: true },
  { id: "quinoa", name: "Quinoa", category: "grain", calories_per_100g: 120, protein_per_100g: 4.4, carbs_per_100g: 21.3, fat_per_100g: 1.9, price_qar: 22, unit: "g", unit_size: 500, image_url: "🌾", in_stock: true },
  { id: "olive_oil", name: "Extra Virgin Olive Oil", category: "oil", calories_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100, price_qar: 35, unit: "ml", unit_size: 500, image_url: "🫒", in_stock: true },
  { id: "protein_bar", name: "Protein Bar (Chocolate)", category: "snack", calories_per_100g: 380, protein_per_100g: 33, carbs_per_100g: 35, fat_per_100g: 12, price_qar: 15, unit: "piece", unit_size: 1, image_url: "🍫", in_stock: true },
  { id: "almonds", name: "Raw Almonds", category: "snack", calories_per_100g: 579, protein_per_100g: 21, carbs_per_100g: 21.6, fat_per_100g: 49.9, price_qar: 30, unit: "g", unit_size: 200, image_url: "🥜", in_stock: true },
  { id: "creatine", name: "Creatine Monohydrate", category: "supplement", calories_per_100g: 0, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0, price_qar: 80, unit: "scoop", unit_size: 5, image_url: "⚡", in_stock: true },
  { id: "multivitamin", name: "Daily Multivitamin", category: "supplement", calories_per_100g: 0, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0, price_qar: 65, unit: "piece", unit_size: 30, image_url: "💊", in_stock: true },
];

export function getCatalog(): Ingredient[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CATALOG));
  return DEFAULT_CATALOG;
}

export function getIngredient(id: string): Ingredient | undefined {
  return getCatalog().find((i) => i.id === id);
}

export function getByCategory(category: Ingredient["category"]): Ingredient[] {
  return getCatalog().filter((i) => i.category === category);
}
