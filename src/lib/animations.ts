import { Variants, Transition } from "framer-motion";

export const spring = { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.8 };
export const springBouncy = { type: "spring" as const, stiffness: 400, damping: 17, mass: 0.6 };
export const springGentle = { type: "spring" as const, stiffness: 200, damping: 30, mass: 1 };

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

export const pageVariants: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: spring
  }
};

export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.1, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
  }
};

export const glowVariants: Variants = {
  glow: {
    boxShadow: [
      "0 0 0px rgba(251, 146, 60, 0)",
      "0 0 8px rgba(251, 146, 60, 0.4)",
      "0 0 0px rgba(251, 146, 60, 0)"
    ],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
  }
};

export const breatheVariants: Variants = {
  breathe: {
    opacity: [1, 0.85, 1],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
  }
};

export const progressRingVariants: Variants = {
  hidden: { 
    pathLength: 0,
    opacity: 0.3 
  },
  visible: { 
    pathLength: 1,
    opacity: 1,
    transition: { 
      pathLength: { duration: 0.8, ease: "easeOut" },
      opacity: { duration: 0.3 }
    }
  }
};

export const cardVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20, 
    scale: 0.98 
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      ...spring,
      opacity: { duration: 0.2 }
    }
  }
};

export const hapticVariants: Variants = {
  idle: { scale: 1 },
  tap: { scale: 0.98, transition: { duration: 0.1 } }
};

export const buttonVariants: Variants = {
  idle: { scale: 1, boxShadow: "0 12px 24px rgba(6, 150, 88, 0.24)" },
  tap: { 
    scale: 0.95, 
    boxShadow: "0 8px 16px rgba(6, 150, 88, 0.32)",
    transition: { duration: 0.1 } 
  }
};

export const iconButtonVariants: Variants = {
  idle: { scale: 1, rotate: 0 },
  tap: { scale: 0.9, transition: { duration: 0.1 } }
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...spring,
      opacity: { duration: 0.2 }
    }
  }
};

export const successCheckVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.4, ease: "easeOut" },
      opacity: { duration: 0.2 }
    }
  }
};

export const pullToRefreshVariants: Variants = {
  hidden: { y: 0, opacity: 0 },
  pulling: ({ progress }: { progress: number }) => ({
    y: Math.min(progress * 60, 60),
    opacity: Math.min(progress, 1)
  }),
  refreshing: { y: 60, opacity: 1 },
  complete: { y: 0, opacity: 0 }
};

export const gradientShift = {
  initial: { backgroundPosition: "0% 50%" },
  animate: {
    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
    transition: {
      duration: 20,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

export const ambientGlow = {
  initial: { opacity: 0.06 },
  animate: {
    opacity: [0.06, 0.08, 0.06],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const floatVariants: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-2, 2, -2],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const shimmerVariants: Variants = {
  initial: { backgroundPosition: "-200% 0" },
  animate: {
    backgroundPosition: "200% 0",
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "linear"
    }
  }
};