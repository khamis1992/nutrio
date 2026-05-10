import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    try {
      if (isSelected) {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("diet_tag_id", tagId);
        if (error) throw error;
        setUserDietPreferences(prev => prev.filter(id => id !== tagId));
      } else {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .insert({ user_id: user.id, diet_tag_id: tagId });
        if (error) throw error;
        setUserDietPreferences(prev => [...prev, tagId]);
      }
      toast({
        title: isSelected ? t("removed") : t("added"),
        description: isSelected ? t("dietary_preference_removed") : t("dietary_preference_added"),
      });
    } catch {
      toast({ title: t("error"), description: t("failed_update_dietary_preference"), variant: "destructive" });
    }
  };

  const fetchDietaryDataCb = useCallback(fetchDietaryData, [user, toast, t]);
  useEffect(() => {
    fetchDietaryDataCb();
  }, [fetchDietaryDataCb]);

  const isLoading = dietaryLoading || dietTagsLoading;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 pt-safe">
        <div className="flex items-center gap-3 px-4 py-4 rtl:flex-row-reverse">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{t("dietary_and_allergies")}</h1>
            <p className="text-xs text-muted-foreground">{t("manage_dietary_preferences")}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Dietary Preferences */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("dietary_preferences")}</CardTitle>
                <CardDescription>{t("select_dietary_styles")}</CardDescription>
              </CardHeader>
              <CardContent>
                {dietTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("no_dietary_tags_available")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dietTags.map(tag => {
                      const isSelected = userDietPreferences.includes(tag.id);
                      const translatedName = getTranslatedTagName(tag.name);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleDietPreference(tag.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all duration-200",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {translatedName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Allergies & Intolerances */}
            {allergyTags.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("allergies_and_intolerances")}</CardTitle>
                  <CardDescription>{t("select_food_allergies")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {allergyTags.map(tag => {
                      const isSelected = userDietPreferences.includes(tag.id);
                      const translatedName = getTranslatedTagName(tag.name);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleDietPreference(tag.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all duration-200",
                            isSelected
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {translatedName}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Dietary;
