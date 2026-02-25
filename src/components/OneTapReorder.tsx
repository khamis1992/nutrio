import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useReorder, type OrderItem } from "@/hooks/useReorder";
import { Repeat, ChevronRight, ShoppingCart, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface OneTapReorderProps {
  orderId: string;
  items: OrderItem[];
  orderTotal: number;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  showPreview?: boolean;
}

export function OneTapReorder({
  orderId,
  items,
  orderTotal,
  variant = "outline",
  size = "default",
  className = "",
  showPreview = true,
}: OneTapReorderProps) {
  const { isReordering, reorder } = useReorder();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const navigate = useNavigate();

  const handleReorderClick = async () => {
    if (showPreview && items.length > 1) {
      setShowConfirmDialog(true);
    } else {
      // Direct reorder for single item or no preview
      const success = await reorder(orderId, {
        showToast: true,
        navigateToCheckout: true,
      });

      if (success) {
        navigate("/checkout");
      }
    }
  };

  const handleConfirmReorder = async (modify: boolean) => {
    setShowConfirmDialog(false);

    if (modify) {
      // Add to cart without navigating
      const success = await reorder(orderId, {
        showToast: true,
        navigateToCheckout: false,
      });

      if (success) {
        navigate("/checkout");
      }
    } else {
      // Direct checkout with same items
      const success = await reorder(orderId, {
        showToast: true,
        navigateToCheckout: true,
      });

      if (success) {
        navigate("/checkout");
      }
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleReorderClick}
        disabled={isReordering}
        className={className}
      >
        {isReordering ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Adding...
          </>
        ) : (
          <>
            <Repeat className="mr-2 h-4 w-4" />
            Order Again
          </>
        )}
      </Button>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reorder Items</DialogTitle>
            <DialogDescription>
              Would you like to order the same items again?
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[300px] mt-4">
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.meal_name}
                      className="w-12 h-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-muted-foreground/20 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.meal_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity} × {item.price.toFixed(2)} QAR
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{orderTotal.toFixed(2)} QAR</span>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row mt-4">
            <Button
              variant="outline"
              onClick={() => handleConfirmReorder(true)}
              className="w-full sm:w-auto"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Modify Order
            </Button>
            <Button
              onClick={() => handleConfirmReorder(false)}
              className="w-full sm:w-auto"
            >
              <Repeat className="mr-2 h-4 w-4" />
              Reorder Same
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact version for list views
interface OneTapReorderCompactProps {
  orderId: string;
  onReorder?: () => void;
}

export function OneTapReorderCompact({ orderId, onReorder }: OneTapReorderCompactProps) {
  const { isReordering, reorder } = useReorder();
  const navigate = useNavigate();

  const handleClick = async () => {
    const success = await reorder(orderId, {
      showToast: true,
      navigateToCheckout: true,
    });

    if (success) {
      onReorder?.();
      navigate("/checkout");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isReordering}
      className="text-primary hover:text-primary hover:bg-primary/10"
    >
      <Repeat className="mr-1 h-4 w-4" />
      {isReordering ? "Adding..." : "Reorder"}
    </Button>
  );
}

// Button for order detail page
interface OrderAgainButtonProps {
  orderId: string;
  orderStatus: string;
  items: OrderItem[];
  orderTotal: number;
  className?: string;
}

export function OrderAgainButton({
  orderId,
  orderStatus,
  items,
  orderTotal,
  className = "",
}: OrderAgainButtonProps) {
  const { isReordering, reorder } = useReorder();
  const navigate = useNavigate();

  // Only show for completed/delivered orders
  if (!["completed", "delivered"].includes(orderStatus)) {
    return null;
  }

  const handleClick = async () => {
    const success = await reorder(orderId, {
      showToast: true,
      navigateToCheckout: true,
    });

    if (success) {
      navigate("/checkout");
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isReordering}
      className={`bg-emerald-600 hover:bg-emerald-700 text-white ${className}`}
      size="lg"
    >
      <Repeat className="mr-2 h-5 w-5" />
      {isReordering ? "Adding to Cart..." : "Order Again"}
    </Button>
  );
}
