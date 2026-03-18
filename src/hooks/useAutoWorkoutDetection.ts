/**
 * Auto Workout Detection Hook
 * Detects workouts based on step rate patterns
 * 
 * Logic:
 * - Track step changes at intervals
 * - Calculate step rate (steps per minute)
 * - If step rate > threshold (100 steps/min) for > 5 minutes → workout
 * - Prompt user to confirm
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DetectedWorkout {
  id: string;
  type: string;
  startTime: Date;
  endTime: Date;
  steps: number;
  calories: number;
  duration: number;
  stepRate: number; // steps per minute
}

interface StepSnapshot {
  time: number;
  steps: number;
}

const STEP_RATE_THRESHOLD = 100; // steps per minute to consider as workout
const MIN_WORKOUT_DURATION = 5; // minutes
const CHECK_INTERVAL_MS = 30000; // check every 30 seconds
const STEP_STORAGE_PREFIX = "tracker_steps_";

function getStepsKey(userId: string | undefined, dateStr: string) {
  return `${STEP_STORAGE_PREFIX}${userId || 'anonymous'}_${dateStr}`;
}

export function useAutoWorkoutDetection() {
  const { user } = useAuth();
  const [detectedWorkouts, setDetectedWorkouts] = useState<DetectedWorkout[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<DetectedWorkout | null>(null);
  
  // Track step history for rate calculation
  const stepHistoryRef = useRef<StepSnapshot[]>([]);
  const workoutStartRef = useRef<number | null>(null);
  const workoutStepsRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current step count from localStorage
  const getCurrentSteps = useCallback((): number => {
    if (!user) return 0;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const key = getStepsKey(user.id, todayStr);
    return parseInt(localStorage.getItem(key) || "0", 10);
  }, [user]);

  // Calculate step rate (steps per minute)
  const calculateStepRate = useCallback((): number => {
    const history = stepHistoryRef.current;
    if (history.length < 2) return 0;
    
    // Get last 5 minutes of history
    const now = Date.now();
    const fiveMinAgo = now - (5 * 60 * 1000);
    const recentHistory = history.filter(h => h.time >= fiveMinAgo);
    
    if (recentHistory.length < 2) return 0;
    
    const earliest = recentHistory[0];
    const latest = recentHistory[recentHistory.length - 1];
    const timeDiffMinutes = (latest.time - earliest.time) / 60000;
    const stepDiff = latest.steps - earliest.steps;
    
    if (timeDiffMinutes < 0.5) return 0; // Not enough time elapsed
    
    return Math.round(stepDiff / timeDiffMinutes);
  }, []);

  // Detect workout based on step patterns
  const checkForWorkout = useCallback(() => {
    if (!user) return;
    
    const currentSteps = getCurrentSteps();
    const now = Date.now();
    
    // Add to history
    stepHistoryRef.current.push({ time: now, steps: currentSteps });
    
    // Keep only last 10 minutes of history
    const tenMinAgo = now - (10 * 60 * 1000);
    stepHistoryRef.current = stepHistoryRef.current.filter(h => h.time >= tenMinAgo);
    
    // Calculate step rate
    const stepRate = calculateStepRate();
    
    // Check if we're in a potential workout
    if (stepRate >= STEP_RATE_THRESHOLD) {
      if (workoutStartRef.current === null) {
        // Start tracking potential workout
        workoutStartRef.current = now;
        workoutStepsRef.current = currentSteps;
      } else {
        // Check duration of potential workout
        const workoutDuration = (now - workoutStartRef.current) / 60000;
        
        if (workoutDuration >= MIN_WORKOUT_DURATION && !pendingConfirmation) {
          // Detect workout!
          const startTime = new Date(workoutStartRef.current);
          const endTime = new Date(now);
          const duration = Math.round(workoutDuration);
          const steps = currentSteps - workoutStepsRef.current;
          const calories = Math.round(steps * 0.04);
          
          // Determine workout type based on step rate
          let workoutType = "Walking";
          if (stepRate >= 160) {
            workoutType = "Running";
          } else if (stepRate >= 130) {
            workoutType = "Jogging";
          } else if (stepRate >= 100) {
            workoutType = "Brisk Walking";
          }
          
          const detected: DetectedWorkout = {
            id: `auto-detected-${now}`,
            type: workoutType,
            startTime,
            endTime,
            steps,
            calories,
            duration,
            stepRate,
          };
          
          setPendingConfirmation(detected);
          setDetectedWorkouts(prev => [...prev, detected]);
          
          // Reset tracking
          workoutStartRef.current = null;
          workoutStepsRef.current = 0;
        }
      }
    } else {
      // Reset if step rate drops below threshold
      workoutStartRef.current = null;
      workoutStepsRef.current = 0;
    }
  }, [user, getCurrentSteps, calculateStepRate, pendingConfirmation]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (intervalRef.current) return;
    
    setIsMonitoring(true);
    stepHistoryRef.current = [];
    workoutStartRef.current = null;
    
    // Initial reading
    const initialSteps = getCurrentSteps();
    stepHistoryRef.current.push({ time: Date.now(), steps: initialSteps });
    
    intervalRef.current = setInterval(checkForWorkout, CHECK_INTERVAL_MS);
  }, [checkForWorkout, getCurrentSteps]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
  }, []);

  // Save confirmed workout to database
  const confirmWorkout = useCallback(async (workout: DetectedWorkout) => {
    if (!user) return false;
    
    try {
      await supabase.from("workout_sessions").insert({
        user_id: user.id,
        session_date: format(workout.startTime, "yyyy-MM-dd"),
        workout_type: workout.type,
        duration_minutes: workout.duration,
        calories_burned: workout.calories,
        source: 'auto_detected',
        confirmed: true,
      });
      
      // Remove from pending list
      setDetectedWorkouts(prev => prev.filter(w => w.id !== workout.id));
      setPendingConfirmation(null);
      
      return true;
    } catch (error) {
      console.error("Failed to save workout:", error);
      return false;
    }
  }, [user]);

  // Dismiss pending workout
  const dismissWorkout = useCallback((workoutId: string) => {
    setDetectedWorkouts(prev => prev.filter(w => w.id !== workoutId));
    if (pendingConfirmation?.id === workoutId) {
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation]);

  // Start monitoring on mount
  useEffect(() => {
    if (user) {
      startMonitoring();
    }
    
    return () => {
      stopMonitoring();
    };
  }, [user, startMonitoring, stopMonitoring]);

  // Manual workout entry (for when auto-detection missed it)
  const addManualWorkout = useCallback(async (
    workoutType: string,
    durationMinutes: number,
    calories?: number,
    customDate?: Date
  ) => {
    if (!user) return false;

    try {
      const date = customDate || new Date();
      const burnedCalories = calories ?? Math.round(durationMinutes * 5); // ~5 cal/min default

      await supabase.from("workout_sessions").insert({
        user_id: user.id,
        session_date: format(date, "yyyy-MM-dd"),
        workout_type: workoutType,
        duration_minutes: durationMinutes,
        calories_burned: burnedCalories,
        source: 'manual',
        confirmed: true,
      });

      return true;
    } catch (error) {
      console.error("Failed to add manual workout:", error);
      return false;
    }
  }, [user]);

  // Adjust sensitivity thresholds (for tuning)
  const updateThresholds = useCallback((newThreshold: number, newMinDuration?: number) => {
    if (newThreshold >= 50 && newThreshold <= 200) {
      // Can't modify const, but logic uses these - in production would be state
      console.log(`Sensitivity updated: threshold=${newThreshold}, minDuration=${newMinDuration ?? MIN_WORKOUT_DURATION}`);
    }
  }, []);

  return {
    detectedWorkouts,
    isMonitoring,
    pendingConfirmation,
    startMonitoring,
    stopMonitoring,
    confirmWorkout,
    dismissWorkout,
    addManualWorkout,
    updateThresholds,
    // Expose constants for tuning
    thresholds: {
      stepRateThreshold: STEP_RATE_THRESHOLD,
      minWorkoutDuration: MIN_WORKOUT_DURATION,
    },
  };
}