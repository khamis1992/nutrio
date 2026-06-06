import { type Ingredient, getIngredient } from "./ingredientCatalog";

export interface CartItem {
  ingredient: Ingredient;
  quantity: number;
}

const STORAGE_KEY = "nutrio_cart";

export function getCart(): CartItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch { /* fall through */ } }
  return [];
}

function saveCart(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(ingredientId: string, quantity: number = 1): CartItem[] {
  const ing = getIngredient(ingredientId);
  if (!ing) return getCart();
  const cart = getCart();
  const existing = cart.find((ci) => ci.ingredient.id === ingredientId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ingredient: ing, quantity });
  }
  saveCart(cart);
  return cart;
}

export function removeFromCart(ingredientId: string): CartItem[] {
  const cart = getCart().filter((ci) => ci.ingredient.id !== ingredientId);
  saveCart(cart);
  return cart;
}

export function updateCartQuantity(ingredientId: string, quantity: number): CartItem[] {
  if (quantity <= 0) return removeFromCart(ingredientId);
  const cart = getCart();
  const existing = cart.find((ci) => ci.ingredient.id === ingredientId);
  if (existing) {
    existing.quantity = quantity;
  }
  saveCart(cart);
  return cart;
}

export function addRecipeIngredientsToCart(ingredientIds: Array<{ id: string; name: string }>): CartItem[] {
  for (const { id } of ingredientIds) {
    addToCart(id, 1);
  }
  return getCart();
}

export function getCartTotal(): number {
  return getCart().reduce((sum, ci) => sum + ci.ingredient.price_qar * ci.quantity, 0);
}

export function getCartCount(): number {
  return getCart().reduce((sum, ci) => sum + ci.quantity, 0);
}

export function clearCart(): void {
  localStorage.removeItem(STORAGE_KEY);
}
