import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AdjustmentRecommendation {
  new_calories: number;
  new_protein: number;
  new_carbs: number;
  new_fat: number;
  reason: string;
  confidence: number;
  plateau_detected: boolean;
  suggested_action: string;
}

export interface WeightPrediction {
  date: string;
  predicted_weight: number;
  confidence_lower: number;
  confidence_upper: number;
}

export interface AdaptiveGoalSettings {
  auto_adjust_enabled: boolean;
  adjustment_frequency: 'weekly' | 'biweekly' | 'monthly';
  min_calorie_floor: number;
  max_calorie_ceiling: number;
}

export interface AdjustmentHistoryItem {
  id: string;
  adjustment_date: string;
  previous_calories: number;
  new_calories: number;
  reason: string;
  weight_change_kg: number | null;
  adherence_rate: number;
  plateau_detected: boolean;
  ai_confidence: number;
  applied: boolean;
}

interface UseAdaptiveGoalsReturn {
  recommendation: AdjustmentRecommendation | null;
  predictions: WeightPrediction[];
  settings: AdaptiveGoalSettings | null;
  adjustmentHistory: AdjustmentHistoryItem[];
  loading: boolean;
  settingsLoading: boolean;
  historyLoading: boolean;
  hasUnviewedAdjustment: boolean;
  fetchRecommendation: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  applyAdjustment: (adjustmentId: string) => Promise<boolean>;
  dismissAdjustment: () => Promise<void>;
  updateSettings: (updates: Partial<AdaptiveGoalSettings>) => Promise<boolean>;
  analyzeNow: () => Promise<void>;
}

export const useAdaptiveGoals = (): UseAdaptiveGoalsReturn => {
  const { user } = useAuth();
  const [recommendation, setRecommendation] = useState<AdjustmentRecommendation | null>(null);
  const [predictions, setPredictions] = useState<WeightPrediction[]>([]);
  const [settings, setSettings] = useState<AdaptiveGoalSettings | null>(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasUnviewedAdjustment, setHasUnviewedAdjustment] = useState(false);
  
  // Track if edge function is available to avoid repeated failed calls
  const functionAvailableRef = useRef<boolean | null>(null);

  // Fetch user's adaptive goal settings
  const fetchSettings = useCallback(async () => {
    if (!user) return;

    try {
      setSettingsLoading(true);
      const { data, error } = await supabase
        .from("adaptive_goal_settings")
        .select("auto_adjust_enabled, adjustment_frequency, min_calorie_floor, max_calorie_ceiling")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings(data);
      } else {
        // Create default settings if none exist
        const defaultSettings = {
          user_id: user.id,
          auto_adjust_enabled: true,
          adjustment_frequency: 'weekly',
          min_calorie_floor: 1200,
          max_calorie_ceiling: 4000
        };
        
        const { data: newSettings, error: insertError } = await supabase
          .from("adaptive_goal_settings")
          .insert(defaultSettings)
          .select()
          .single();
        
        if (insertError) {
          // Handle duplicate key error - settings were created by trigger or concurrent request
          if (insertError.code === '23505') {
            // Fetch the existing settings
            const { data: existingSettings, error: fetchError } = await supabase
              .from("adaptive_goal_settings")
              .select("auto_adjust_enabled, adjustment_frequency, min_calorie_floor, max_calorie_ceiling")
              .eq("user_id", user.id)
              .maybeSingle();
            
            if (fetchError) throw fetchError;
            if (existingSettings) {
              setSettings(existingSettings);
            }
          } else {
            throw insertError;
          }
        } else {
          setSettings(newSettings);
        }
      }
    } catch (err) {
      console.error("Error fetching adaptive settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  }, [user]);

  // Fetch latest recommendation and predictions
  const fetchRecommendation = useCallback(async () => {
    if (!user) return;
    
    // Skip if we already know the function is not available
    if (functionAvailableRef.current === false) {
      return;
    }

    try {
      setLoading(true);
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke("adaptive-goals", {
        body: { user_id: user.id, dry_run: true }
      });

      if (error) {
        // Silently fail if function not deployed (CORS error)
        if (error.message?.includes('CORS') || error.message?.includes('Failed to send') || error.message?.includes('net::ERR')) {
          functionAvailableRef.current = false;
          console.warn("Adaptive goals function not deployed yet - feature disabled");
          return;
        }
        throw error;
      }
      
      // Function is available
      functionAvailableRef.current = true;
      
      if (data?.recommendation) {
        setRecommendation(data.recommendation);
      }
      
      if (data?.predictions) {
        setPredictions(data.predictions);
      }
    } catch (err) {
      console.error("Error fetching recommendation:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch adjustment history
  const fetchHistory = useCallback(async () => {
    if (!user) return;

    try {
      setHistoryLoading(true);
      const { data, error } = await supabase
        .from("goal_adjustment_history")
        .select("id, adjustment_date, previous_calories, new_calories, reason, weight_change_kg, adherence_rate, plateau_detected, ai_confidence, applied")
        .eq("user_id", user.id)
        .order("adjustment_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setAdjustmentHistory(data || []);
    } catch (err) {
      console.error("Error fetching adjustment history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  // Check for unviewed adjustments
  const checkUnviewedAdjustment = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("has_unviewed_adjustment, ai_suggested_calories, ai_suggestion_confidence")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      
      setHasUnviewedAdjustment(data?.has_unviewed_adjustment || false);
      
      // If there's an unviewed adjustment, fetch the latest from history
      if (data?.has_unviewed_adjustment) {
        const { data: latestAdjustment } = await supabase
          .from("goal_adjustment_history")
          .select("new_calories, new_macros, reason, plateau_detected, ai_confidence")
          .eq("user_id", user.id)
          .eq("applied", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (latestAdjustment) {
          setRecommendation({
            new_calories: latestAdjustment.new_calories,
            new_protein: latestAdjustment.new_macros?.protein || 0,
            new_carbs: latestAdjustment.new_macros?.carbs || 0,
            new_fat: latestAdjustment.new_macros?.fat || 0,
            reason: latestAdjustment.reason,
            confidence: latestAdjustment.ai_confidence || 0.7,
            plateau_detected: latestAdjustment.plateau_detected || false,
            suggested_action: "Review and apply the suggested changes"
          });
        }
      }
    } catch (err) {
      console.error("Error checking unviewed adjustments:", err);
    }
  }, [user]);

  // Apply an adjustment
  const applyAdjustment = async (adjustmentId: string): Promise<boolean> => {
    if (!user || !recommendation) return false;

    try {
      // Update profile with new targets
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          daily_calorie_target: recommendation.new_calories,
          protein_target_g: recommendation.new_protein,
          carbs_target_g: recommendation.new_carbs,
          fat_target_g: recommendation.new_fat,
          last_goal_adjustment_date: new Date().toISOString().split('T')[0],
          has_unviewed_adjustment: false
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Mark adjustment as applied
      const { error: historyError } = await supabase
        .from("goal_adjustment_history")
        .update({ applied: true })
        .eq("id", adjustmentId);

      if (historyError) throw historyError;

      setHasUnviewedAdjustment(false);
      toast.success("Adjustment applied successfully!");
      
      // Refresh history
      await fetchHistory();
      
      return true;
    } catch (err) {
      console.error("Error applying adjustment:", err);
      toast.error("Failed to apply adjustment");
      return false;
    }
  };

  // Dismiss an adjustment without applying
  const dismissAdjustment = async (): Promise<void> => {
    if (!user) return;

    try {
      await supabase
        .from("profiles")
        .update({ has_unviewed_adjustment: false })
        .eq("user_id", user.id);

      setHasUnviewedAdjustment(false);
      toast.info("Adjustment dismissed");
    } catch (err) {
      console.error("Error dismissing adjustment:", err);
    }
  };

  // Update adaptive goal settings
  const updateSettings = async (updates: Partial<AdaptiveGoalSettings>): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("adaptive_goal_settings")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, ...updates } : null);
      toast.success("Settings updated");
      return true;
    } catch (err) {
      console.error("Error updating settings:", err);
      toast.error("Failed to update settings");
      return false;
    }
  };

  // Trigger analysis now (not dry run)
  const analyzeNow = async (): Promise<void> => {
    if (!user) return;
    
    // Check if function is available
    if (functionAvailableRef.current === false) {
      toast.info("AI analysis not available yet. Deploy edge functions to enable this feature.");
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke("adaptive-goals", {
        body: { user_id: user.id, dry_run: false }
      });

      if (error) {
        // Handle function not deployed
        if (error.message?.includes('CORS') || error.message?.includes('Failed to send') || error.message?.includes('net::ERR')) {
          functionAvailableRef.current = false;
          console.warn("Adaptive goals function not deployed yet");
          toast.info("AI analysis not available yet. Deploy edge functions to enable this feature.");
          return;
        }
        throw error;
      }
      
      // Function is available
      functionAvailableRef.current = true;
      
      if (data?.adjustment_id) {
        toast.success("Analysis complete! New recommendation available.");
        setHasUnviewedAdjustment(true);
        if (data?.recommendation) {
          setRecommendation(data.recommendation);
        }
        if (data?.predictions) {
          setPredictions(data.predictions);
        }
        await fetchHistory();
      } else {
        toast.info("Analysis complete. No changes needed at this time.");
      }
    } catch (err) {
      console.error("Error running analysis:", err);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchRecommendation();
      fetchHistory();
      checkUnviewedAdjustment();
    }
  }, [user, fetchSettings, fetchRecommendation, fetchHistory, checkUnviewedAdjustment]);

  return {
    recommendation,
    predictions,
    settings,
    adjustmentHistory,
    loading,
    settingsLoading,
    historyLoading,
    hasUnviewedAdjustment,
    fetchRecommendation,
    fetchSettings,
    fetchHistory,
    applyAdjustment,
    dismissAdjustment,
    updateSettings,
    analyzeNow
  };
};
