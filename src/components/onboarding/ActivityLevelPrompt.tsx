import { useState } from "react";
import { X, Check, Activity } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

interface ActivityLevelPromptProps {
  onClose: () => void;
  t: (key: string) => string;
}

const levels: { id: ActivityLevel; titleKey: string; descKey: string }[] = [
  { id: "sedentary", titleKey: "sedentary", descKey: "sedentary_desc" },
  { id: "light", titleKey: "lightly_active", descKey: "lightly_active_desc" },
  { id: "moderate", titleKey: "moderately_active", descKey: "moderately_active_desc" },
  { id: "active", titleKey: "very_active", descKey: "very_active_desc" },
  { id: "very_active", titleKey: "extra_active", descKey: "extra_active_desc" },
];

export const ActivityLevelPrompt = ({ onClose, t }: ActivityLevelPromptProps) => {
  const { updateProfile } = useProfile();
  const { toast } = useToast();
  const [level, setLevel] = useState<ActivityLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!level) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (updateProfile as any)({ activity_level: level });
      toast({ title: "Activity level saved", description: "We'll use this for more accurate calorie calculations." });
      onClose();
    } catch {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300, mass: 0.8 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-background dark:bg-gray-900 rounded-t-3xl max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: "max(80px, env(safe-area-inset-bottom, 80px))" }}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div
              className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-5 cursor-pointer"
              onClick={onClose}
              role="presentation"
            />
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-muted dark:bg-gray-800 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground dark:text-white mb-2">
              Set your activity level
            </h2>
            <p className="text-sm text-muted-foreground dark:text-gray-400 px-2">
              Help us calculate accurate calorie burn — what's your activity level?
            </p>
          </div>

          <div className="space-y-2 mb-6">
            {levels.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`w-full p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 text-left ${
                  level === l.id
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-border dark:border-gray-700 hover:border-primary/30"
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                  level === l.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                }`}>
                  {level === l.id && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground dark:text-white">{t(l.titleKey)}</p>
                  <p className="text-xs text-muted-foreground dark:text-gray-400">{t(l.descKey)}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-muted-foreground dark:text-gray-400 hover:bg-muted dark:hover:bg-gray-800 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleSave}
              disabled={!level || saving}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
