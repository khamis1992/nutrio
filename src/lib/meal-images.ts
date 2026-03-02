/**
 * Meal Images Utility
 * Provides random food images for meals that don't have an image_url
 */

// Collection of high-quality food images from Unsplash
const FOOD_IMAGES = [
  // Healthy bowls and salads
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&auto=format&fit=crop",
  // Grilled proteins
  "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&auto=format&fit=crop",
  // Mediterranean
  "https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&auto=format&fit=crop",
  // Asian healthy
  "https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?w=800&auto=format&fit=crop",
  // Breakfast
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&auto=format&fit=crop",
  // Seafood
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=800&auto=format&fit=crop",
  // Vegetarian/Vegan
  "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop",
  // Smoothies and drinks
  "https://images.unsplash.com/photo-1553530979-7ee52a2670c4?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800&auto=format&fit=crop",
  // Wraps and sandwiches
  "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop",
  // Pasta (healthy versions)
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop",
  // Buddha bowls
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop",
  // Grain bowls
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop",
  // Sushi/Poke
  "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?w=800&auto=format&fit=crop",
  // Mexican healthy
  "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&auto=format&fit=crop",
  // Soup
  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop",
  // Snacks
  "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800&auto=format&fit=crop",
];

/**
 * Get a random food image URL
 * Returns a deterministic image based on the meal ID if provided
 */
export function getRandomFoodImage(mealId?: string): string {
  if (mealId) {
    // Use the meal ID to generate a consistent image for the same meal
    let hash = 0;
    for (let i = 0; i < mealId.length; i++) {
      const char = mealId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % FOOD_IMAGES.length;
    return FOOD_IMAGES[index];
  }
  // Return a truly random image
  return FOOD_IMAGES[Math.floor(Math.random() * FOOD_IMAGES.length)];
}

/**
 * Get a random food image URL for a specific meal type
 */
export function getMealTypeImage(mealType: string, mealId?: string): string {
  const type = mealType.toLowerCase();
  
  // Meal type specific images
  const typeImages: Record<string, string[]> = {
    breakfast: [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
    ],
    lunch: [
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800&auto=format&fit=crop",
    ],
    dinner: [
      "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop",
    ],
    snack: [
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1553530979-7ee52a2670c4?w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800&auto=format&fit=crop",
    ],
  };
  
  const images = typeImages[type] || FOOD_IMAGES;
  
  if (mealId) {
    let hash = 0;
    for (let i = 0; i < mealId.length; i++) {
      const char = mealId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const index = Math.abs(hash) % images.length;
    return images[index];
  }
  
  return images[Math.floor(Math.random() * images.length)];
}

/**
 * Get meal image with fallback to random food image
 * This is the main function to use when displaying meal images
 */
export function getMealImage(imageUrl: string | null | undefined, mealId?: string, mealType?: string): string {
  // If there's an actual image URL, use it
  if (imageUrl && imageUrl.trim() !== "") {
    return imageUrl;
  }

  // Otherwise, get a random food image based on meal type or generic
  if (mealType) {
    return getMealTypeImage(mealType, mealId);
  }

  return getRandomFoodImage(mealId);
}

// Restaurant images from Unsplash
const RESTAURANT_IMAGES = [
  // Modern restaurant interiors and exteriors
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550966871-3ed3c47e2ce2?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1482049016gy-d81d0a9f1a1d?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1560611588-163f295eb145?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1578474843222-4f3dca3dc9b2?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494346480775-936a9f0d0877?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1564759224907-65b6c0c74e0e?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1535850452425-140ee4a8dbae?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1502301103665-0b95cc738daf?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555992336-fb0d29498b13?w=400&auto=format&fit=crop",
];

/**
 * Get a random restaurant image URL
 * Returns a deterministic image based on the restaurant ID if provided
 */
export function getRandomRestaurantImage(restaurantId?: string): string {
  if (restaurantId) {
    // Use the restaurant ID to generate a consistent image for the same restaurant
    let hash = 0;
    for (let i = 0; i < restaurantId.length; i++) {
      const char = restaurantId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const index = Math.abs(hash) % RESTAURANT_IMAGES.length;
    return RESTAURANT_IMAGES[index];
  }
  // Return a truly random image
  return RESTAURANT_IMAGES[Math.floor(Math.random() * RESTAURANT_IMAGES.length)];
}

/**
 * Get restaurant image with fallback to random restaurant image
 * This is the main function to use when displaying restaurant images
 */
export function getRestaurantImage(imageUrl: string | null | undefined, restaurantId?: string): string {
  // If there's an actual image URL, use it
  if (imageUrl && imageUrl.trim() !== "") {
    return imageUrl;
  }

  // Otherwise, get a random restaurant image
  return getRandomRestaurantImage(restaurantId);
}
