import { Activity, Apple, BarChart3, Dumbbell, Smartphone, type LucideIcon } from "lucide-react";

export type ExternalHealthProviderId =
  | "apple_health"
  | "google_fit"
  | "garmin_connect"
  | "training_peaks"
  | "athlytic";

export type ExternalHealthProviderStatus = "available" | "planned" | "reference";

export interface ExternalHealthProvider {
  id: ExternalHealthProviderId;
  name: string;
  status: ExternalHealthProviderStatus;
  icon: LucideIcon;
  accent: string;
  descriptionKey: string;
  signals: string[];
}

export const EXTERNAL_HEALTH_PROVIDERS: ExternalHealthProvider[] = [
  {
    id: "apple_health",
    name: "Apple Health",
    status: "available",
    icon: Apple,
    accent: "#020617",
    descriptionKey: "health_provider_apple_desc",
    signals: ["Steps", "Heart rate", "Sleep", "Workouts"],
  },
  {
    id: "google_fit",
    name: "Google Fit",
    status: "available",
    icon: Smartphone,
    accent: "#22C7A1",
    descriptionKey: "health_provider_google_desc",
    signals: ["Steps", "Calories", "Workouts"],
  },
  {
    id: "garmin_connect",
    name: "Garmin Connect",
    status: "planned",
    icon: Activity,
    accent: "#38BDF8",
    descriptionKey: "health_provider_garmin_desc",
    signals: ["Training load", "HRV", "Sleep", "Body Battery"],
  },
  {
    id: "training_peaks",
    name: "TrainingPeaks",
    status: "planned",
    icon: BarChart3,
    accent: "#7C83F6",
    descriptionKey: "health_provider_trainingpeaks_desc",
    signals: ["Plan compliance", "Fatigue", "Fitness"],
  },
  {
    id: "athlytic",
    name: "Athlytic",
    status: "reference",
    icon: Dumbbell,
    accent: "#FB6B7A",
    descriptionKey: "health_provider_athlytic_desc",
    signals: ["Recovery model", "Exertion", "Trends"],
  },
];

export function getProviderStatusKey(status: ExternalHealthProviderStatus) {
  if (status === "available") return "health_provider_available";
  if (status === "planned") return "health_provider_planned";
  return "health_provider_reference";
}
