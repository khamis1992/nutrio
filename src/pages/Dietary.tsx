import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDietTags } from "@/hooks/useDietTags";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const Dietary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { dietTags, allergyTags, loading: dietTagsLoading } = useDietTags();
  const [userDietPreferences, setUserDietPreferences] = useState<string[]>([]);
  const [dietaryLoading, setDietaryLoading] = useState(false);

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
      toast({ title: "Error", description: "Failed to load dietary preferences", variant: "destructive" });
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
        title: isSelected ? "Removed" : "Added",
        description: `Dietary preference ${isSelected ? "removed" : "added"}`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to update dietary preference", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchDietaryData();
  }, [user]);

  const isLoading = dietaryLoading || dietTagsLoading;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Dietary & Allergies</h1>
            <p className="text-xs text-muted-foreground">Manage your dietary preferences and intolerances</p>
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
                <CardTitle className="text-base">Dietary Preferences</CardTitle>
                <CardDescription>Select the dietary styles that match your lifestyle</CardDescription>
              </CardHeader>
              <CardContent>
                {dietTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dietary tags available</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dietTags.map(tag => {
                      const isSelected = userDietPreferences.includes(tag.id);
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
                          {tag.name}
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
                  <CardTitle className="text-base">Allergies & Intolerances</CardTitle>
                  <CardDescription>Select any food allergies or intolerances you have</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {allergyTags.map(tag => {
                      const isSelected = userDietPreferences.includes(tag.id);
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
                          {tag.name}
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
