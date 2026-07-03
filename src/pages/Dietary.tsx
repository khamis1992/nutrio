import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Leaf, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDietTags } from "@/hooks/useDietTags";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Mapping for translation keys
const dietTagTranslationKeys: Record<string, string> = {
  "High-Protein": "high_protein",
  "Low-Carb": "low_carb",
  "Gluten-Free": "gluten_free",
  "Dairy-Free": "dairy_free",
  "Nut-Free": "nut_free",
  "Organic": "organic",
  "Vegetarian": "vegetarian",
  "Vegan": "vegan",
  "Keto": "keto",
};

// For items that might use category_* key as fallback

const Dietary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { dietTags, allergyTags, loading: dietTagsLoading } = useDietTags();
  const [userDietPreferences, setUserDietPreferences] = useState<string[]>([]);
  const [dietaryLoading, setDietaryLoading] = useState(false);

  // Translate tag name
  const getTranslatedTagName = (tagName: string): string => {
    // Normalize tag name: convert to title case with hyphens for lookup
    // e.g., "High Protein" -> "High-Protein", "keto" -> "Keto"
    const normalizeName = (name: string): string => {
      // Handle names with spaces (high protein -> High-Protein)
      if (name.includes(' ')) {
        return name.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('-');
      }
      // Handle camelCase or other formats
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    };
    
    const normalizedTag = normalizeName(tagName);
    
    // First, try direct translation key mapping
    if (dietTagTranslationKeys[normalizedTag]) {
      const translationKey = dietTagTranslationKeys[normalizedTag];
      const translated = t(translationKey);
      // Return translation if found, otherwise return original
      return translated !== translationKey ? translated : tagName;
    }
    
    // For tags without hyphens (Keto, Vegan, Organic, Vegetarian), try category_* key
    const categoryKey = `category_${normalizedTag.toLowerCase()}`;
    const categoryTranslated = t(categoryKey);
    if (categoryTranslated !== categoryKey) {
      return categoryTranslated;
    }
    
    // Return original if no translation found
    return tagName;
  };

  const fetchDietaryData = async () => {
    if (!user) return;
    setDietaryLoading(true);
    try {
      const { data: prefs } = await supabase
        .from("user_dietary_preferences")
        .select("diet_tag_id")
        .eq("user_id", user.id);
      setUserDietPreferences(prefs?.map((p: { diet_tag_id: string }) => p.diet_tag_id) || []);
    } catch {
      toast({ title: t("error"), description: t("failed_load_dietary_preferences"), variant: "destructive" });
    } finally {
      setDietaryLoading(false);
    }
  };

  const toggleDietPreference = async (tagId: string) => {
    if (!user) return;
    const isSelected = userDietPreferences.includes(tagId);
    const previous = [...userDietPreferences];
    
    setUserDietPreferences(prev =>
      isSelected ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );

    try {
      if (isSelected) {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("diet_tag_id", tagId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .insert({ user_id: user.id, diet_tag_id: tagId });
        if (error) throw error;
      }
    } catch {
      setUserDietPreferences(previous);
      toast({ title: t("error"), description: t("failed_update_dietary_preference"), variant: "destructive" });
    }
  };

  const fetchDietaryDataCb = useCallback(fetchDietaryData, [user, toast, t]);
  useEffect(() => {
    fetchDietaryDataCb();
  }, [fetchDietaryDataCb]);

  const isLoading = dietaryLoading || dietTagsLoading;
  const selectedDietCount = dietTags.filter((tag) => userDietPreferences.includes(tag.id)).length;
  const selectedAllergyCount = allergyTags.filter((tag) => userDietPreferences.includes(tag.id)).length;

  return (
    <div className="min-h-screen bg-[#F7FAF8] pb-24">
      <div className="sticky top-0 z-20 bg-[#F7FAF8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[78px] max-w-[430px] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            data-testid="dietary-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.1} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">Nutrio</p>
            <h1 className="truncate text-[23px] font-black leading-tight text-slate-950">{t("dietary_and_allergies")}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[430px] space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[34px] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-4 px-5 pb-5 pt-5">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">
                {t("manage_dietary_preferences")}
              </p>
              <h2 className="mt-2 text-[28px] font-black leading-tight text-slate-950">
                Personalize meals
              </h2>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-500">
                Choose what fits your lifestyle and flag ingredients to avoid.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100">
            <div className="bg-white px-4 py-3">
              <p className="text-[23px] font-black leading-none text-slate-950">{selectedDietCount}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">{t("dietary_preferences")}</p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-[23px] font-black leading-none text-slate-950">{selectedAllergyCount}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">{t("allergies_and_intolerances")}</p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center rounded-[28px] bg-white py-14 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-slate-100">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
          </div>
        ) : (
          <>
            <PreferenceSection
              title={t("dietary_preferences")}
              description={t("select_dietary_styles")}
              icon={<Leaf className="h-5 w-5" />}
              tone="emerald"
              emptyText={t("no_dietary_tags_available")}
            >
              {dietTags.map(tag => {
                const isSelected = userDietPreferences.includes(tag.id);
                const translatedName = getTranslatedTagName(tag.name);
                return (
                  <PreferenceChip
                    key={tag.id}
                    selected={isSelected}
                    label={translatedName}
                    tone="emerald"
                    onClick={() => toggleDietPreference(tag.id)}
                  />
                );
              })}
            </PreferenceSection>

            {allergyTags.length > 0 && (
              <PreferenceSection
                title={t("allergies_and_intolerances")}
                description={t("select_food_allergies")}
                icon={<ShieldAlert className="h-5 w-5" />}
                tone="amber"
              >
                {allergyTags.map(tag => {
                  const isSelected = userDietPreferences.includes(tag.id);
                  const translatedName = getTranslatedTagName(tag.name);
                  return (
                    <PreferenceChip
                      key={tag.id}
                      selected={isSelected}
                      label={translatedName}
                      tone="amber"
                      onClick={() => toggleDietPreference(tag.id)}
                    />
                  );
                })}
              </PreferenceSection>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function PreferenceSection({
  title,
  description,
  icon,
  tone,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber";
  emptyText?: string;
  children: React.ReactNode;
}) {
  const toneClass = tone === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600";

  return (
    <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-slate-100">
      <div className="mb-4 flex items-start gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", toneClass)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] font-black leading-tight text-slate-950">{title}</h3>
          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
      {emptyText && !children ? (
        <p className="text-[13px] font-semibold text-slate-400">{emptyText}</p>
      ) : null}
    </section>
  );
}

function PreferenceChip({
  selected,
  label,
  tone,
  onClick,
}: {
  selected: boolean;
  label: string;
  tone: "emerald" | "amber";
  onClick: () => void;
}) {
  const selectedClass = tone === "emerald"
    ? "bg-emerald-600 text-white shadow-[0_10px_18px_rgba(16,185,129,0.18)]"
    : "bg-amber-500 text-white shadow-[0_10px_18px_rgba(245,158,11,0.18)]";
  const idleClass = tone === "emerald"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-[13px] font-black ring-1 transition-transform active:scale-95",
        selected ? selectedClass : idleClass,
      )}
    >
      {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      {label}
    </button>
  );
}

export default Dietary;
