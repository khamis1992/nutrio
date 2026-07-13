import { useState } from "react";
import { X, Check, Leaf, AlertTriangle } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useDietTags } from "@/hooks/useDietTags";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface FirstMealPrefsPromptProps {
  onClose: () => void;
}

export const FirstMealPrefsPrompt = ({ onClose }: FirstMealPrefsPromptProps) => {
  const { profile, updateProfile } = useProfile();
  const { dietTags, allergyTags, loading: dietTagsLoading } = useDietTags();
  const { toast } = useToast();
  const { t } = useLanguage();
  const mealPreferences = profile as (typeof profile & {
    food_preferences?: string[] | null;
    allergies?: string[] | null;
  });
  const [prefs, setPrefs] = useState<string[]>(mealPreferences?.food_preferences ?? []);
  const [allergies, setAllergies] = useState<string[]>(mealPreferences?.allergies ?? []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (updateProfile as any)({
        food_preferences: prefs,
        allergies: allergies,
      });
      toast({ title: t("preferences_saved_title") || "Preferences saved", description: t("preferences_saved_desc") || "We'll use these to find meals you'll love." });
      onClose();
    } catch {
      toast({ title: t("preferences_save_failed") || "Could not save", description: t("try_again") || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={handleSkip}
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
              <Leaf className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground dark:text-white mb-2">
              {t("find_meals_youll_love") || "Find meals you'll love"}
            </h2>
            <p className="text-sm text-muted-foreground dark:text-gray-400 px-2">
              {t("set_dietary_prefs_desc") || "Help us personalize your meal recommendations — set your dietary preferences"}
            </p>
          </div>

          {dietTagsLoading ? (
            <div className="space-y-2 mb-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {dietTags.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-muted-foreground dark:text-gray-400 uppercase tracking-wide mb-2 px-1">
                    {t("food_preferences_label") || "Food Preferences"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dietTags.map((tag) => {
                      const selected = prefs.includes(tag.name);
                      return (
                        <button
                          key={tag.id}
                          onClick={() =>
                            setPrefs((p) =>
                              selected ? p.filter((n) => n !== tag.name) : [...p, tag.name]
                            )
                          }
                          className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                            selected
                              ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 border-2"
                              : "bg-muted dark:bg-gray-800 text-muted-foreground dark:text-gray-400 border-2 border-transparent"
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {allergyTags.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                    <p className="text-xs font-semibold text-muted-foreground dark:text-gray-400 uppercase tracking-wide">
                      {t("allergies_label") || "Allergies"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allergyTags.map((tag) => {
                      const selected = allergies.includes(tag.name);
                      return (
                        <button
                          key={tag.id}
                          onClick={() =>
                            setAllergies((a) =>
                              selected ? a.filter((n) => n !== tag.name) : [...a, tag.name]
                            )
                          }
                          className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                            selected
                              ? "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-700 dark:text-red-300 border-2"
                              : "bg-muted dark:bg-gray-800 text-muted-foreground dark:text-gray-400 border-2 border-transparent"
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSkip}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-muted-foreground dark:text-gray-400 hover:bg-muted dark:hover:bg-gray-800 transition-colors"
            >
              {t("not_now") || "Not now"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {saving ? (t("saving") || "Saving...") : t("save_preferences") || "Save Preferences"}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
