import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

interface DraftData<T = unknown> {
  data: T;
  step: number;
  savedAt: string;
}

interface OnboardingRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftData: DraftData | null;
  onContinue: () => void;
  onStartFresh: () => void;
}

export function OnboardingRecoveryDialog({
  open,
  onOpenChange,
  draftData,
  onContinue,
  onStartFresh,
}: OnboardingRecoveryDialogProps) {
  if (!draftData) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Continue where you left off?</AlertDialogTitle>
          <AlertDialogDescription>
            We found a saved draft from {formatDistanceToNow(new Date(draftData.savedAt))} ago.
            Would you like to continue or start fresh?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStartFresh}>
            Start Fresh
          </AlertDialogCancel>
          <AlertDialogAction onClick={onContinue}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
