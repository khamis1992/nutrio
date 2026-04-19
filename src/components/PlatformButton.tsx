import { isIOS, isAndroid } from "@/lib/capacitor";
import { cn } from "@/lib/utils";
import { motion, useAnimation } from "framer-motion";
import { ReactNode } from "react";

interface PlatformButtonProps {
  children: ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "float";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
}

/**
 * PlatformButton - Native mobile button with platform-specific ripple effects
 * iOS: spring ripple with subtle bounce
 * Android: Material 3 ripple with fade out
 * Web: fallback to CSS animation
 */
export function PlatformButton({
  children,
  variant = "default",
  size = "default",
  className,
  onClick,
  disabled = false,
  loading = false,
  full = false,
}: PlatformButtonProps) {
  const controls = useAnimation();
  
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'web';
  
  // Platform-specific styles
  const platformStyles = {
    ios: {
      borderRadius: 12,
      minHeight: 48,
      rippleColor: 'rgba(255,255,255,0.3)',
      activeScale: 0.96,
    },
    android: {
      borderRadius: 8,
      minHeight: 48,
      rippleColor: 'rgba(0,0,0,0.1)',
      activeScale: 0.98,
    },
    web: {
      borderRadius: 12,
      minHeight: 48,
      rippleColor: 'rgba(255,255,255,0.3)',
      activeScale: 0.96,
    },
  };
  
  const styles = platformStyles[platform];
  
  const handlePress = async () => {
    // Platform-specific haptic feedback
    try {
      if (isIOS) {
        await import("@/lib/capacitor").then(m => m.haptics.selection());
      } else if (isAndroid) {
        await import("@/lib/capacitor").then(m => m.haptics.light());
      } else {
        // Web fallback
      }
    } catch (err) {
      console.error("Haptic feedback failed:", err);
    }
    
    // Platform-specific animation trigger
    await controls.start({
      scale: [1, styles.activeScale, 1],
      transition: {
        duration: 0.3,
        type: "spring",
        stiffness: platform === 'ios' ? 400 : 300,
        damping: 25,
        mass: 1,
      },
    });
    
    onClick?.();
  };

  const buttonSizes = {
    default: "h-12 px-6 py-3",
    sm: "h-10 px-4 py-2 text-sm",
    lg: "h-14 px-8 py-4 text-lg",
    icon: "h-12 w-12 p-2",
    float: "h-16 w-16",
  };

  const variantStyles = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };

  const combinedClassName = cn(
    "inline-flex items-center justify-center rounded-[12px] font-medium transition-all duration-200 touch-none",
    platform === 'ios' ? "active:opacity-80" : "active:opacity-60",
    buttonSizes[size],
    variantStyles[variant],
    full ? "w-full" : "",
    className
  );

  return (
    <motion.button
      className={combinedClassName}
      disabled={disabled || loading}
      onClick={handlePress}
      animate={controls}
      whileTap={{ scale: styles.activeScale }}
      style={{
        borderRadius: styles.borderRadius,
        minHeight: styles.minHeight,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{children}</span>
        </div>
      ) : (
        children
      )}
    </motion.button>
  );
}

// Pre-styled button variants for common use cases
export function PlatformButtonPrimary({ children, ...props }: PlatformButtonProps) {
  return <PlatformButton variant="default" size="default" {...props}>{children}</PlatformButton>;
}

export function PlatformButtonSmall({ children, ...props }: PlatformButtonProps) {
  return <PlatformButton variant="default" size="sm" {...props}>{children}</PlatformButton>;
}

export function PlatformButtonLarge({ children, ...props }: PlatformButtonProps) {
  return <PlatformButton variant="default" size="lg" {...props}>{children}</PlatformButton>;
}

export function PlatformButtonOutline({ children, ...props }: PlatformButtonProps) {
  return <PlatformButton variant="outline" size="default" {...props}>{children}</PlatformButton>;
}

export function PlatformButtonDestructive({ children, ...props }: PlatformButtonProps) {
  return <PlatformButton variant="destructive" size="default" {...props}>{children}</PlatformButton>;
}
