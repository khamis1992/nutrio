import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface GuestLoginPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  signUpLabel?: string;
}

export const GuestLoginPrompt = ({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  signUpLabel,
}: GuestLoginPromptProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const resolvedTitle = title ?? t("sign_in_required");
  const resolvedDescription = description ?? t("sign_in_required_desc");
  const resolvedActionLabel = actionLabel ?? t("sign_in");
  const resolvedSignUpLabel = signUpLabel ?? t("create_account");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <LogIn className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">{resolvedTitle}</DialogTitle>
          <DialogDescription className="text-sm">{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          <Button
            className="w-full h-11 rounded-xl"
            onClick={() => {
              onOpenChange(false);
              navigate("/auth");
            }}
          >
            <LogIn className="w-4 h-4 mr-2" />
            {resolvedActionLabel}
          </Button>
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl"
            onClick={() => {
              onOpenChange(false);
              navigate("/auth?tab=signup");
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {resolvedSignUpLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface LoginPromptConfig {
  title: string;
  description: string;
  actionLabel: string;
  signUpLabel: string;
}

export const useGuestLoginPrompt = () => {
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptConfig, setLoginPromptConfig] = useState<LoginPromptConfig>({
    title: "",
    description: "",
    actionLabel: "",
    signUpLabel: "",
  });

  const promptLogin = useCallback((config?: Partial<LoginPromptConfig>) => {
    if (config) {
      setLoginPromptConfig(prev => ({ ...prev, ...config }));
    }
    setShowLoginPrompt(true);
  }, []);

  return { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig };
};
