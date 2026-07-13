import { motion } from "framer-motion";
import { Award, Sparkles, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BadgeUnlockNotice } from "@/hooks/useBadgeChecker";

interface RewardUnlockSheetProps {
  unlock: BadgeUnlockNotice | null;
  onOpenChange: (open: boolean) => void;
}

export function RewardUnlockSheet({ unlock, onOpenChange }: RewardUnlockSheetProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const xpReward = unlock?.xpReward ?? 0;

  return (
    <Sheet open={Boolean(unlock)} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[calc(100dvh-5.5rem)] max-w-[480px] overflow-hidden rounded-t-[30px] border-[#E5EAF1] bg-white px-5 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] pt-4 text-[#020617] shadow-[0_-24px_70px_rgba(2,6,23,0.20)]"
        closeButtonClassName="right-5 top-7 grid h-9 w-9 place-items-center rounded-full bg-[#F6F8FB] text-[#94A3B8] opacity-100 ring-1 ring-[#E5EAF1] hover:text-[#020617]"
      >
        {unlock && (
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[#E5EAF1]" />

            <motion.div
              className="relative mx-auto mt-1 flex h-[74px] w-[74px] items-center justify-center rounded-[24px] bg-[#EEF0FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20"
              initial={{ scale: 0.74, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 18, delay: 0.06 }}
            >
              <motion.span
                className="absolute inset-0 rounded-[24px] bg-[#7C83F6]/14"
                animate={{ scale: [1, 1.22, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
              <Award className="relative h-9 w-9" strokeWidth={2.25} />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-[#22C7A1]" strokeWidth={2.3} />
            </motion.div>

            <SheetTitle className="mt-4 text-[23px] font-black tracking-normal text-[#020617]">
              {unlock.name}
            </SheetTitle>
            <SheetDescription className="mx-auto mt-1.5 max-w-[310px] text-[13px] font-semibold leading-5 text-[#64748B]">
              {unlock.description || t("new_achievement_unlocked")}
            </SheetDescription>

            <motion.div
              className="mt-5 overflow-hidden rounded-[22px] bg-[#F8FAFC] p-4 ring-1 ring-[#E5EAF1]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.16 }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("xp_earned_label")}</p>
              <motion.p
                className="mt-1 text-[30px] font-black leading-none text-[#020617]"
                initial={{ scale: 0.86 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.22 }}
              >
                +{xpReward}
              </motion.p>
            </motion.div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-[16px] border-[#E5EAF1] bg-white text-[13px] font-black text-[#020617] shadow-[0_10px_24px_rgba(2,6,23,0.04)]"
                onClick={() => onOpenChange(false)}
              >
                {t("later")}
              </Button>
              <Button
                type="button"
                className="h-12 rounded-[16px] bg-[#020617] text-[13px] font-black text-white shadow-[0_14px_30px_rgba(2,6,23,0.22)] hover:bg-[#020617]/90"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/rewards");
                }}
              >
                <Wallet className="mr-2 h-4 w-4" strokeWidth={2.2} />
                {t("view_rewards")}
              </Button>
            </div>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  );
}
