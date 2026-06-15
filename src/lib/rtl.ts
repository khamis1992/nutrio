import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Returns RTL-aware Previous/Back arrow component.
 * In RTL (Arabic): Previous = moves right visually, so icon points right.
 */
export function getPrevIcon(isRTL: boolean) {
  return isRTL ? ChevronRight : ChevronLeft;
}

/**
 * Returns RTL-aware Next/Forward arrow component.
 * In RTL (Arabic): Next = moves left visually, so icon points left.
 */
export function getNextIcon(isRTL: boolean) {
  return isRTL ? ChevronLeft : ChevronRight;
}

/**
 * RTL-aware arrow pair for navigation
 */
export function getNavArrows(isRTL: boolean) {
  return {
    PrevIcon: isRTL ? ChevronRight : ChevronLeft,
    NextIcon: isRTL ? ChevronLeft : ChevronRight,
    ArrowPrev: isRTL ? ArrowRight : ArrowLeft,
    ArrowNext: isRTL ? ArrowLeft : ArrowRight,
  };
}

export const RTL_ARIA = {
  previous: (isRTL: boolean) => isRTL ? "السابق" : "Previous",
  next: (isRTL: boolean) => isRTL ? "التالي" : "Next",
  back: (isRTL: boolean) => isRTL ? "رجوع" : "Back",
};
