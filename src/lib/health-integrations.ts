import { Activity, Apple, FileUp, Scale, Smartphone, Watch, type LucideIcon } from "lucide-react";

export type ExternalHealthProviderId =
  | "apple_health"
  | "google_fit"
  | "sporthub"
  | "file_import"
  | "body_scale"
  | "future_wearables";

export type ExternalHealthProviderStatus = "available" | "planned" | "reference";

export interface ExternalHealthProvider {
  id: ExternalHealthProviderId;
  name: string;
  status: ExternalHealthProviderStatus;
  icon: LucideIcon;
  accent: string;
  descriptionKey: string;
  signals: string[];
  integrationMode: "native" | "oauth" | "file" | "reference";
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
    integrationMode: "native",
  },
  {
    id: "google_fit",
    name: "Google Fit / Health Connect",
    status: "available",
    icon: Smartphone,
    accent: "#22C7A1",
    descriptionKey: "health_provider_google_desc",
    signals: ["Steps", "Calories", "Workouts"],
    integrationMode: "native",
  },
  {
    id: "sporthub",
    name: "SportHub",
    status: "available",
    icon: Activity,
    accent: "#0EA5E9",
    descriptionKey: "connect_activity_apps_desc",
    signals: ["Activities", "Calories", "Workouts"],
    integrationMode: "oauth",
  },
  {
    id: "file_import",
    name: "Historical file import",
    status: "available",
    icon: FileUp,
    accent: "#7C83F6",
    descriptionKey: "connect_activity_apps_desc",
    signals: ["GPX", "TCX", "FIT"],
    integrationMode: "file",
  },
  {
    id: "body_scale",
    name: "Body scale",
    status: "reference",
    icon: Scale,
    accent: "#14B8A6",
    descriptionKey: "connect_activity_apps_desc",
    signals: ["Weight", "Body fat", "Body water"],
    integrationMode: "reference",
  },
  {
    id: "future_wearables",
    name: "Garmin / WHOOP / Oura / Fitbit",
    status: "reference",
    icon: Watch,
    accent: "#F97316",
    descriptionKey: "connect_activity_apps_desc",
    signals: ["Sleep", "Readiness", "Recovery"],
    integrationMode: "reference",
  },
];

export function getProviderStatusKey(status: ExternalHealthProviderStatus) {
  if (status === "available") return "health_provider_available";
  if (status === "planned") return "health_provider_planned";
  return "health_provider_reference";
}
