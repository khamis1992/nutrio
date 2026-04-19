import { Variants } from "framer-motion";

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