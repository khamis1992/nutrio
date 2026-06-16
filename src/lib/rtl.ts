import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════
 * RTL ARROW CONVENTIONS — CRITICAL DISTINCTION:
 * ═══════════════════════════════════════════════════════════
 *
 * There are TWO kinds of arrows with OPPOSITE RTL behavior:
 *
 * 1️⃣ READING FLOW arrows (content navigation: prev/next page, carousel, calendar months)
 *    In RTL (Arabic): "previous" = rightward, "next" = leftward  →  SWAP direction.
 *    Use: getPrevIcon(), getNextIcon(), getNavArrows()
 *
 * 2️⃣ APP NAVIGATION arrows (back button, close, cancel — browser/OS convention)
 *    In ALL languages: "back" = ← (ArrowLeft), "forward" = → (ArrowRight)  →  NEVER SWAP.
 *    Use: getBackIcon() — always returns ArrowLeft.
 *
 * ⚠️ DO NOT use PrevIcon/NextIcon for back/cancel/close buttons.
 *    The swap breaks the universal ← = back convention.
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Returns RTL-aware Previous arrow (for READING FLOW — page/chapter navigation).
 * In RTL (Arabic): Previous = moves right, so icon points right.
 * DO NOT use for back buttons — use getBackIcon() instead.
 */
export function getPrevIcon(isRTL: boolean) {
  return isRTL ? ChevronRight : ChevronLeft;
}

/**
 * Returns RTL-aware Next arrow (for READING FLOW — page/chapter navigation).
 * In RTL (Arabic): Next = moves left, so icon points left.
 * DO NOT use for forward buttons — use ArrowRight directly.
 */
export function getNextIcon(isRTL: boolean) {
  return isRTL ? ChevronLeft : ChevronRight;
}

/**
 * Always returns ArrowLeft (←) — the universal "back" icon.
 * Back/cancel/close buttons should NEVER swap direction in RTL.
 * Every OS/browser/device uses ← for back regardless of language.
 */
export function getBackIcon() {
  return ArrowLeft;
}

/**
 * RTL-aware arrow pair for READING FLOW navigation (prev/next page, carousel, calendar).
 * ⚠️ NOT for back buttons — ArrowPrev still swaps direction. Use getBackIcon() for back.
 */
export function getNavArrows(isRTL: boolean) {
  return {
    PrevIcon: isRTL ? ChevronRight : ChevronLeft,
    NextIcon: isRTL ? ChevronLeft : ChevronRight,
    ArrowPrev: isRTL ? ArrowRight : ArrowLeft,    // ⚠️ swaps — only for reading flow
    ArrowNext: isRTL ? ArrowLeft : ArrowRight,    // ⚠️ swaps — only for reading flow
  };
}

export const RTL_ARIA = {
  previous: (isRTL: boolean) => isRTL ? "السابق" : "Previous",
  next: (isRTL: boolean) => isRTL ? "التالي" : "Next",
  back: (isRTL: boolean) => isRTL ? "رجوع" : "Back",
};
