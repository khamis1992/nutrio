import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";
import { posthog } from "posthog-js";

export interface OrderItem {
  meal_id: string;
  meal_name: string;
  quantity: number;
  price: number;
  image_url?: string;
  restaurant_id?: string;
  restaurant_name?: string;
}

export interface OrderForReorder {
  id: string;
  items: OrderItem[];
  total_amount: number;
  delivery_address?: string;
  delivery_notes?: string;
  created_at: string;
}

interface UseReorderReturn {
  isReordering: boolean;
  reorder: (orderId: string, options?: ReorderOptions) => Promise<boolean>;
  addToCart: (items: OrderItem[]) => Promise<boolean>;
}

interface ReorderOptions {
  preserveDeliveryAddress?: boolean;
  showToast?: boolean;
  navigateToCheckout?: boolean;
}

export function useReorder(): UseReorderReturn {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isReordering, setIsReordering] = useState(false);

  const addToCart = useCallback(
    async (items: OrderItem[]): Promise<boolean> => {
      if (!user) {
        toast.error("Please sign in to add items to cart");
        return false;
      }

      try {
        // Get current cart
        const { data: cart, error: cartError } = await supabase
          .from("carts")
          .select("id, items")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cartError) throw cartError;

        // Prepare cart items
        const cartItems = items.map((item) => ({
          meal_id: item.meal_id,
          meal_name: item.meal_name,
          quantity: item.quantity,
          price: item.price,
          image_url: item.image_url,
          restaurant_id: item.restaurant_id,
          restaurant_name: item.restaurant_name,
          added_at: new Date().toISOString(),
        }));

        if (cart) {
          // Merge with existing cart items
          const existingItems = (cart.items || []) as any[];
          const mergedItems = [...existingItems];

          for (const newItem of cartItems) {
            const existingIndex = mergedItems.findIndex(
              (item) => item.meal_id === newItem.meal_id
            );
            if (existingIndex >= 0) {
              // Update quantity if item already exists
              mergedItems[existingIndex].quantity += newItem.quantity;
              mergedItems[existingIndex].added_at = newItem.added_at;
            } else {
              mergedItems.push(newItem);
            }
          }

          // Update cart
          const { error: updateError } = await supabase
            .from("carts")
            .update({
              items: mergedItems,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cart.id);

          if (updateError) throw updateError;
        } else {
          // Create new cart
          const { error: createError } = await supabase.from("carts").insert({
            user_id: user.id,
            items: cartItems,
          });

          if (createError) throw createError;
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add to cart";
        captureError(err instanceof Error ? err : new Error(message), {
          context: "useReorder.addToCart",
        });
        return false;
      }
    },
    [user]
  );

  const reorder = useCallback(
    async (orderId: string, options: ReorderOptions = {}): Promise<boolean> => {
      const {
        preserveDeliveryAddress = false,
        showToast = true,
        navigateToCheckout = false,
      } = options;

      if (!user) {
        toast.error("Please sign in to reorder");
        return false;
      }

      setIsReordering(true);

      try {
        // Fetch order details with items
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select(
            `
            *,
            order_items (
              meal_id,
              quantity,
              price,
              meals (name, image_url, restaurant_id),
              restaurants (name)
            )
          `
          )
          .eq("id", orderId)
          .eq("user_id", user.id)
          .single();

        if (orderError) throw orderError;

        if (!order) {
          toast.error("Order not found");
          return false;
        }

        // Transform order items
        const items: OrderItem[] = (order.order_items || [])
          .map((item: any) => ({
            meal_id: item.meal_id,
            meal_name: item.meals?.name || "Unknown Meal",
            quantity: item.quantity,
            price: item.price,
            image_url: item.meals?.image_url,
            restaurant_id: item.meals?.restaurant_id,
            restaurant_name: item.restaurants?.name,
          }))
          .filter((item) => item.meal_id); // Filter out items without meal_id

        if (items.length === 0) {
          toast.error("No items available for reorder");
          return false;
        }

        // Add to cart
        const added = await addToCart(items);

        if (!added) {
          toast.error("Failed to add items to cart");
          return false;
        }

        // Track analytics
        posthog.capture("one_tap_reorder", {
          user_id: user.id,
          order_id: orderId,
          item_count: items.length,
          total_amount: order.total_amount,
          preserve_delivery_address: preserveDeliveryAddress,
        });

        if (showToast) {
          toast.success(`${items.length} items added to cart`, {
            description: navigateToCheckout
              ? "Taking you to checkout..."
              : "Go to checkout to complete your order",
            action: navigateToCheckout
              ? undefined
              : {
                  label: "Checkout",
                  onClick: () => navigate("/checkout"),
                },
          });
        }

        // Navigate to checkout if requested
        if (navigateToCheckout) {
          navigate("/checkout");
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reorder";
        captureError(err instanceof Error ? err : new Error(message), {
          context: "useReorder.reorder",
          orderId,
        });
        toast.error(message);
        return false;
      } finally {
        setIsReordering(false);
      }
    },
    [user, navigate, addToCart]
  );

  return {
    isReordering,
    reorder,
    addToCart,
  };
}

// Helper function to check if an order is eligible for reorder
export function isOrderEligibleForReorder(order: {
  status: string;
  order_items?: any[];
}): boolean {
  // Only completed or delivered orders can be reordered
  if (!["completed", "delivered"].includes(order.status)) {
    return false;
  }

  // Must have items
  if (!order.order_items || order.order_items.length === 0) {
    return false;
  }

  return true;
}
