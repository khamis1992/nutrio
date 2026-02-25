import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { captureError } from '@/lib/sentry';

interface MealCompletionResult {
  success: boolean;
  error?: string;
  was_already_completed?: boolean;
  nothing_to_undo?: boolean;
}

interface UseMealCompletionReturn {
  completeMeal: (scheduleId: string, nutritionData?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  uncompleteMeal: (scheduleId: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

/**
 * Hook for atomically completing/uncompleting meals
 * Uses the complete_meal_atomic RPC function to prevent race conditions
 * Addresses: SYS-001 (Atomic Meal Completion)
 */
export function useMealCompletion(): UseMealCompletionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const completeMeal = useCallback(async (
    scheduleId: string,
    nutritionData: {
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      fiber_g?: number;
    } = {}
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      const today = new Date().toISOString().split('T')[0];

      // Use type assertion for new RPC function
      const { data, error } = await (supabase.rpc as any)('complete_meal_atomic', {
        p_schedule_id: scheduleId,
        p_user_id: userData.user.id,
        p_log_date: today,
        p_calories: nutritionData.calories || 0,
        p_protein_g: nutritionData.protein_g || 0,
        p_carbs_g: nutritionData.carbs_g || 0,
        p_fat_g: nutritionData.fat_g || 0,
        p_fiber_g: nutritionData.fiber_g || 0,
      });

      if (error) {
        throw error;
      }

      const result = (data as unknown) as MealCompletionResult;

      if (result.success) {
        if (result.was_already_completed) {
          toast({
            title: 'Already completed',
            description: 'This meal was already marked as complete.',
          });
        } else {
          toast({
            title: 'Meal completed! 🎉',
            description: 'Your nutrition has been logged.',
          });
        }
        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to complete meal');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete meal';
      captureError(error instanceof Error ? error : new Error(message), { context: 'useMealCompletion.completeMeal', scheduleId });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const uncompleteMeal = useCallback(async (
    scheduleId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      const today = new Date().toISOString().split('T')[0];

      // Use type assertion for new RPC function
      const { data, error } = await (supabase.rpc as any)('uncomplete_meal_atomic', {
        p_schedule_id: scheduleId,
        p_user_id: userData.user.id,
        p_log_date: today,
      });

      if (error) {
        throw error;
      }

      const result = (data as unknown) as MealCompletionResult;

      if (result.success) {
        if (result.nothing_to_undo) {
          toast({
            title: 'Nothing to undo',
            description: 'This meal was not marked as complete.',
          });
        } else {
          toast({
            title: 'Meal unmarked',
            description: 'Meal completion has been undone.',
          });
        }
        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to uncomplete meal');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to uncomplete meal';
      captureError(error instanceof Error ? error : new Error(message), { context: 'useMealCompletion.uncompleteMeal', scheduleId });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    completeMeal,
    uncompleteMeal,
    isLoading,
  };
}
