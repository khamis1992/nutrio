/**
 * RTL-aware navigation chevron components.
 * Use these instead of bare ChevronLeft/ChevronRight for any
 * directional navigation (prev/next/back) so the arrow direction
 * automatically flips when the app language is Arabic (RTL).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavChevronProps {
  className?: string;
}

/** Shows ‹ in LTR and › in RTL */
export const NavChevronLeft = ({ className }: NavChevronProps) => {
  const { isRTL } = useLanguage();
  return isRTL
    ? <ChevronRight className={cn(className)} />
    : <ChevronLeft className={cn(className)} />;
};

/** Shows › in LTR and ‹ in RTL */
export const NavChevronRight = ({ className }: NavChevronProps) => {
  const { isRTL } = useLanguage();
  return isRTL
    ? <ChevronLeft className={cn(className)} />
    : <ChevronRight className={cn(className)} />;
};
