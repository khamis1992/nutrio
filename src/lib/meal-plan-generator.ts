import { supabase } from "@/integrations/supabase/client";
import { getMealImage } from "@/lib/meal-images";

export interface MealPlanMeal {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  price: number | null;
  restaurant_name: string | null;
  meal_type: string | null;
  rating: number | null;
  image_url: string | null;
  tags: string[] | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
}

export interface MealPlanDay {
  day: string;
  date: string;
  breakfast: MealPlanMeal | null;
  lunch: MealPlanMeal | null;
  dinner: MealPlanMeal | null;
  snack: MealPlanMeal | null;
  dailyCalories: number;
  dailyProtein: number;
  dailyPrice: number;
}

interface MealFromDB {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  price: number | null;
  image_url: string | null;
  rating: number | null;
  restaurant_id: string | null;
  meal_type: string | null;
  vendor: string | null;
  // Supabase returns a joined object (not array) for many-to-one relations
  restaurants: { name: string } | { name: string }[] | null;
}

function getRestaurantName(meal: MealFromDB): string {
  const r = meal.restaurants;
  if (!r) return meal.vendor || "Partner Restaurant";
  if (Array.isArray(r)) return r[0]?.name || meal.vendor || "Partner Restaurant";
  return r.name || meal.vendor || "Partner Restaurant";
}

/**
 * Generates a 7-day meal plan from available partner restaurants
 * Aligned with user's nutrition targets
 */
export async function generateWeeklyMealPlan(
  calorieTarget: number = 2000,
  proteinTarget: number = 120
): Promise<MealPlanDay[]> {
  try {
    // Fetch available meals with nutrition info and restaurant details
    const { data: mealsData, error: mealsError } = await supabase
      .from('meals')
      .select(`
        *,
        restaurants(name)
      `)
      .eq('is_available', true)
      .not('calories', 'is', null)
      .not('price', 'is', null)
      .order('rating', { ascending: false })
      .limit(200);

    if (mealsError) throw mealsError;

    const meals = (mealsData as MealFromDB[]) || [];

    if (meals.length === 0) {
      return [];
    }

    // Categorize meals by type
    const breakfastMeals = meals.filter(m => 
      m.meal_type?.toLowerCase().includes('breakfast') || 
      m.name.toLowerCase().includes('breakfast') ||
      m.name.toLowerCase().includes('eggs') ||
      m.name.toLowerCase().includes('oatmeal') ||
      m.name.toLowerCase().includes('pancake') ||
      m.name.toLowerCase().includes('croissant') ||
      m.calories! < 600
    );

    const lunchMeals = meals.filter(m => 
      m.meal_type?.toLowerCase().includes('lunch') ||
      m.name.toLowerCase().includes('salad') ||
      m.name.toLowerCase().includes('sandwich') ||
      m.name.toLowerCase().includes('wrap') ||
      m.name.toLowerCase().includes('bowl') ||
      (m.calories! >= 400 && m.calories! <= 800)
    );

    const dinnerMeals = meals.filter(m => 
      m.meal_type?.toLowerCase().includes('dinner') ||
      m.name.toLowerCase().includes('chicken') ||
      m.name.toLowerCase().includes('steak') ||
      m.name.toLowerCase().includes('fish') ||
      m.name.toLowerCase().includes('pasta') ||
      m.name.toLowerCase().includes('rice') ||
      m.name.toLowerCase().includes('grilled') ||
      m.calories! >= 500
    );

    const snackMeals = meals.filter(m => 
      m.meal_type?.toLowerCase().includes('snack') ||
      m.calories! < 300
    );

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    // Calculate NEXT week's start (next Sunday)
    const daysUntilNextSunday = 7 - today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysUntilNextSunday);

    const mealPlan: MealPlanDay[] = [];

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);

      const breakfast = selectOptimalMeal(breakfastMeals, calorieTarget * 0.25, proteinTarget * 0.25);
      const lunch = selectOptimalMeal(lunchMeals, calorieTarget * 0.35, proteinTarget * 0.35);
      const dinner = selectOptimalMeal(dinnerMeals, calorieTarget * 0.30, proteinTarget * 0.30);
      const snack = selectOptimalMeal(snackMeals, calorieTarget * 0.10, proteinTarget * 0.10);

      const dayMeals = [breakfast, lunch, dinner, snack].filter(Boolean) as MealFromDB[];

      mealPlan.push({
        day: days[i],
        date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        breakfast: breakfast ? mapMealToPlan(breakfast) : null,
        lunch: lunch ? mapMealToPlan(lunch) : null,
        dinner: dinner ? mapMealToPlan(dinner) : null,
        snack: snack ? mapMealToPlan(snack) : null,
        dailyCalories: dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0),
        dailyProtein: dayMeals.reduce((sum, m) => sum + (m.protein_g || 0), 0),
        dailyPrice: dayMeals.reduce((sum, m) => sum + (m.price || 0), 0),
      });
    }

    return mealPlan;
  } catch (error) {
    console.error("Error generating meal plan:", error);
    return [];
  }
}

/**
 * Selects an optimal meal that best matches the target macros
 * Prioritizes higher-rated meals and better macro alignment
 */
function selectOptimalMeal(
  meals: MealFromDB[],
  targetCalories: number,
  targetProtein: number
): MealFromDB | null {
  if (meals.length === 0) return null;

  // Score each meal based on:
  // 1. Rating (40%)
  // 2. Calorie alignment (30%)
  // 3. Protein alignment (20%)
  // 4. Variety (10%) - prefer different restaurants

  const scoredMeals = meals.map(meal => {
    const ratingScore = ((meal.rating || 4) / 5) * 35;

    const calorieDiff = Math.abs((meal.calories || 0) - targetCalories);
    const calorieScore = Math.max(0, 25 - (calorieDiff / targetCalories) * 25);

    const proteinDiff = Math.abs((meal.protein_g || 0) - targetProtein);
    const proteinScore = Math.max(0, 20 - (proteinDiff / Math.max(targetProtein, 1)) * 20);

    // Strongly prefer meals that have an image — they'll look better in the PDF
    const imageScore = meal.image_url ? 20 : 0;

    const totalScore = ratingScore + calorieScore + proteinScore + imageScore + 10;

    return { meal, score: totalScore };
  });

  // Sort by score and pick from top 10 to add variety
  scoredMeals.sort((a, b) => b.score - a.score);
  const topMeals = scoredMeals.slice(0, Math.min(10, scoredMeals.length));
  
  return topMeals[Math.floor(Math.random() * topMeals.length)].meal;
}

function mapMealToPlan(meal: MealFromDB): MealPlanMeal {
  const restaurantName = getRestaurantName(meal);
  return {
    id: meal.id,
    name: meal.name,
    description: meal.description,
    calories: meal.calories,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g,
    price: meal.price,
    restaurant_name: restaurantName,
    meal_type: meal.meal_type,
    rating: meal.rating,
    image_url: meal.image_url,
    tags: null,
    is_vegetarian: null,
    is_vegan: null,
    is_gluten_free: null,
  };
}

/**
 * Detects image format from URL or base64 data
 */
export function getImageFormat(imageUrl: string): 'JPEG' | 'PNG' | 'WEBP' {
  if (!imageUrl) return 'JPEG';
  const url = imageUrl.toLowerCase();
  if (url.includes('data:image/png')) return 'PNG';
  if (url.includes('data:image/webp')) return 'WEBP';
  if (url.includes('.png')) return 'PNG';
  if (url.includes('.webp')) return 'WEBP';
  return 'JPEG'; // Default to JPEG
}

/**
 * Extracts bucket name and path from any Supabase public/signed storage URL.
 * Works regardless of bucket name.
 */
function extractStoragePath(imageUrl: string): { bucket: string; path: string } | null {
  const patterns = [
    /\/object\/public\/([^/?]+)\/(.+?)(\?.*)?$/,
    /\/object\/sign\/([^/?]+)\/(.+?)(\?.*)?$/,
  ];

  for (const pattern of patterns) {
    const match = imageUrl.match(pattern);
    if (match) {
      return { bucket: match[1], path: match[2] };
    }
  }

  return null;
}

/**
 * Converts a Blob to a JPEG data URL via canvas.
 * Handles any browser-decodable format (WebP, PNG, AVIF, etc.).
 */
function blobToJpegDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = Math.min(img.naturalWidth || 400, 400);
        const h = Math.min(img.naturalHeight || 400, 400);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(objectUrl); resolve(null); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const jpeg = canvas.toDataURL('image/jpeg', 0.80);
        URL.revokeObjectURL(objectUrl);
        resolve(jpeg);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
    img.src = objectUrl;
  });
}

/**
 * Loads an image and returns a JPEG data URL for PDF embedding.
 *
 * Strategy (in order):
 *   1. If already a JPEG data URL → return as-is
 *   2. If any data URL → decode and re-encode as JPEG via canvas
 *   3. Supabase SDK download (no CORS issues — uses API auth headers)
 *   4. Direct fetch with CORS mode
 *   5. <img crossOrigin> → canvas (browser-level CORS)
 *
 * Each strategy has its own timeout. Total per image: max ~10 seconds.
 */
export async function loadImageAsBase64(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:image/jpeg')) return imageUrl;

  if (imageUrl.startsWith('data:')) {
    return blobToJpegDataUrl(await (await fetch(imageUrl)).blob());
  }

  // --- Strategy 1: Supabase SDK download (bypasses CORS entirely) ---
  const storageInfo = extractStoragePath(imageUrl);
  if (storageInfo) {
    try {
      const { data, error } = await supabase.storage
        .from(storageInfo.bucket)
        .download(storageInfo.path);
      if (!error && data) {
        const jpeg = await blobToJpegDataUrl(data);
        if (jpeg) return jpeg;
      }
    } catch { /* fall through */ }
  }

  // --- Strategy 2: Direct fetch ---
  try {
    const res = await fetch(imageUrl, { mode: 'cors', headers: { Accept: 'image/*' } });
    if (res.ok) {
      const blob = await res.blob();
      const jpeg = await blobToJpegDataUrl(blob);
      if (jpeg) return jpeg;
    }
  } catch { /* fall through */ }

  // --- Strategy 3: <img crossOrigin> → canvas (last resort) ---
  const bustUrl = imageUrl + (imageUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 8000);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.naturalWidth || 400, 400);
        canvas.height = Math.min(img.naturalHeight || 400, 400);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.80));
      } catch { resolve(null); }
    };
    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = bustUrl;
  });
}

/**
 * Loads all meal images for a meal plan — in parallel for speed.
 * Uses getMealImage() for fallback to stock photos (same as the app UI).
 * Deduplicates by meal ID so each image is loaded only once.
 */
export async function loadMealPlanImages(mealPlan: MealPlanDay[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();

  // Collect unique meals — use getMealImage for fallback just like the app does
  const uniqueMeals = new Map<string, string>();
  for (const day of mealPlan) {
    for (const [type, meal] of Object.entries({
      breakfast: day.breakfast,
      lunch: day.lunch,
      dinner: day.dinner,
      snack: day.snack,
    })) {
      if (meal && !uniqueMeals.has(meal.id)) {
        const url = getMealImage(meal.image_url, meal.id, type);
        uniqueMeals.set(meal.id, url);
      }
    }
  }

  // Load all images in parallel (each has its own 8s timeout)
  const entries = Array.from(uniqueMeals.entries());
  const results = await Promise.all(
    entries.map(async ([id, url]) => {
      const base64 = await loadImageAsBase64(url);
      return [id, base64] as const;
    })
  );

  for (const [id, base64] of results) {
    if (base64) imageMap.set(id, base64);
  }

  return imageMap;
}

/**
 * Calculates meal plan statistics
 */
export function calculateMealPlanStats(mealPlan: MealPlanDay[]) {
  if (mealPlan.length === 0) {
    return {
      avgCalories: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFat: 0,
      totalPrice: 0,
      mealsPlanned: 0,
    };
  }

  const totals = mealPlan.reduce((acc, day) => ({
    calories: acc.calories + day.dailyCalories,
    protein: acc.protein + day.dailyProtein,
    price: acc.price + day.dailyPrice,
    meals: acc.meals + [day.breakfast, day.lunch, day.dinner, day.snack].filter(Boolean).length,
  }), { calories: 0, protein: 0, price: 0, meals: 0 });

  return {
    avgCalories: Math.round(totals.calories / 7),
    avgProtein: Math.round(totals.protein / 7),
    totalPrice: totals.price,
    mealsPlanned: totals.meals,
    pricePerDay: Math.round(totals.price / 7),
  };
}
