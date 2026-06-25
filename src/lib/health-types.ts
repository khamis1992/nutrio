export interface WorkoutData {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  calories: number;
  duration: number;
  confirmed?: boolean;
  source?: "manual" | "google_fit" | "apple_health" | "garmin" | "auto_detected";
}

export interface HealthData {
  steps?: number;
  caloriesBurned?: number;
  activeMinutes?: number;
  workouts?: WorkoutData[];
  sleepHours?: number;
  heartRate?: number;
  restingHeartRate?: number;
  hrv?: number;
  sleepMinutes?: number;
  respiratoryRate?: number;
  spo2?: number;
  date: string;
}
