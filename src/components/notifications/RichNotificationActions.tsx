import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  getNotificationActions,
  getActionsByNotificationType,
  type NotificationAction,
} from "@/lib/pushNotificationActions";
import { springBouncy } from "@/lib/animations";

interface RichNotificationActionsProps {
  notificationType: string;
  metadata?: Record<string, unknown>;
  compact?: boolean;
  onAction?: (actionId: string) => void;
  className?: string;
}

export function RichNotificationActions({
  notificationType,
  metadata,
  compact = false,
  onAction,
  className = "",
}: RichNotificationActionsProps) {
  const navigate = useNavigate();
  const category = getActionsByNotificationType(notificationType);

  if (!category) return null;

  const actions = getNotificationActions(category);

  if (actions.length === 0) return null;

  return (
    <div
      className={`flex gap-2 mt-2 ${compact ? "flex-wrap" : "flex-wrap"} ${className}`}
    >
      {actions.slice(0, compact ? 2 : actions.length).map((action) => (
        <motion.div
          key={action.id}
          whileTap={{ scale: 0.95 }}
          transition={springBouncy}
        >
          <Button
            variant={action.variant || "default"}
            size={compact ? "sm" : "default"}
            className={`gap-1.5 rounded-xl ${
              compact
                ? "h-8 text-xs px-3 font-medium"
                : "h-9 text-sm px-4 font-semibold"
            }`}
            onClick={() => {
              action.handler(navigate, metadata);
              onAction?.(action.id);
            }}
          >
            <action.icon className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
            {action.label}
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export function getActionVariantClass(action: NotificationAction): string {
  switch (action.variant) {
    case "outline":
      return "border-muted-foreground/20 text-muted-foreground hover:bg-muted";
    case "ghost":
      return "text-muted-foreground hover:bg-muted";
    case "secondary":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    case "destructive":
      return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
    default:
      return "bg-primary text-primary-foreground hover:bg-primary/90";
  }
}
