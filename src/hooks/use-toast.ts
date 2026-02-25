// Toast hook - Standardized on Sonner
// This file provides backward-compatible API while using Sonner internally

import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show a toast notification using Sonner
 * Maintains backward compatibility with previous Radix-based API
 */
function toast(options: ToastOptions) {
  const { title, description, variant = "default", duration, action } = options;

  const message = description ? `${title}\n${description}` : title;

  switch (variant) {
    case "destructive":
      return sonnerToast.error(title, {
        description,
        duration,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    case "success":
      return sonnerToast.success(title, {
        description,
        duration,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    default:
      return sonnerToast(message, {
        description: title && description ? undefined : description,
        duration,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
  }
}

/**
 * Hook for using toast (backward compatible)
 * Now just returns the toast function since Sonner handles state internally
 */
function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
    success: sonnerToast.success,
    error: sonnerToast.error,
    info: sonnerToast.info,
    warning: sonnerToast.warning,
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
  };
}

// Direct exports for convenience
export { useToast, toast, sonnerToast as sonner };
export default useToast;
