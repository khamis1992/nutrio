import { Award, Wallet } from "lucide-react";
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

  return (
    <Sheet open={Boolean(unlock)} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-[480px] rounded-t-[28px] border-[#E5EAF1] bg-white px-5 pb-7 pt-6 text-[#020617]"
        closeButtonClassName="right-5 top-5 text-[#94A3B8]"
      >
        {unlock && (
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#EEF0FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
              <Award className="h-10 w-10" strokeWidth={2.2} />
            </div>
            <SheetTitle className="mt-4 text-[22px] font-black tracking-normal text-[#020617]">
              {unlock.name}
            </SheetTitle>
            <SheetDescription className="mx-auto mt-2 max-w-[320px] text-[13px] font-semibold leading-5 text-[#64748B]">
              {unlock.description || t("new_achievement_unlocked")}
            </SheetDescription>

            <div className="mt-5 rounded-[20px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("xp_earned_label")}</p>
              <p className="mt-1 text-[28px] font-black leading-none text-[#020617]">+{unlock.xpReward}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-[16px] border-[#E5EAF1] text-[13px] font-black text-[#020617]"
                onClick={() => onOpenChange(false)}
              >
                {t("later")}
              </Button>
              <Button
                type="button"
                className="h-12 rounded-[16px] bg-[#020617] text-[13px] font-black text-white hover:bg-[#020617]/90"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/rewards");
                }}
              >
                <Wallet className="mr-2 h-4 w-4" strokeWidth={2.2} />
                {t("view_rewards")}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
