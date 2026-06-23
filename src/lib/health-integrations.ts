import { Apple, Smartphone, type LucideIcon } from "lucide-react";

export type ExternalHealthProviderId =
  | "apple_health"
  | "google_fit";

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
    name: "Google Fit / Health Connect",
    status: "available",
    icon: Smartphone,
    accent: "#22C7A1",
    descriptionKey: "health_provider_google_desc",
    signals: ["Steps", "Calories", "Workouts"],
  },
];

export function getProviderStatusKey(status: ExternalHealthProviderStatus) {
  if (status === "available") return "health_provider_available";
  if (status === "planned") return "health_provider_planned";
  return "health_provider_reference";
}
