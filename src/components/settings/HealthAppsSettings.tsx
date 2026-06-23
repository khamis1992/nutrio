import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Footprints, Dumbbell, RefreshCw, Smartphone, Apple, HelpCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHealthKitIntegration } from "@/hooks/useHealthKitIntegration";
import { EXTERNAL_HEALTH_PROVIDERS, getProviderStatusKey } from "@/lib/health-integrations";
import {
  PLATFORM_LABELS,
  type SyncDataType,
} from "@/lib/healthKit";

const DATA_TYPES: { key: SyncDataType; label: string; icon: typeof Heart; description: string }[] = [
  {
    key: "steps",
    label: "Sync Steps",
    icon: Footprints,
    description: "Import daily step count from your device",
  },
  {
    key: "heart_rate",
    label: "Sync Heart Rate",
    icon: Heart,
    description: "Track resting and active heart rate data",
  },
  {
    key: "workouts",
    label: "Sync Workouts",
    icon: Dumbbell,
    description: "Import completed workouts and activities",
  },
];

export function HealthAppsSettings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    platform,
    isAvailable,
    isConnected,
    enabledTypes,
    lastSyncTimestamp,
    isSyncing,
    toggleDataType,
    disconnect,
    syncData,
    formatLastSync,
  } = useHealthKitIntegration();

  const platformIcon = platform === "apple_health" ? Apple : Smartphone;
  const platformLabel = PLATFORM_LABELS[platform];
  const isNativePlatform = platform !== "none";
  const needsPlugin = !isAvailable && isNativePlatform;

  return (
    <Card className="overflow-hidden rounded-[28px] border-[#E5EAF1] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <CardHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB]">
        <CardTitle className="flex flex-wrap items-center gap-2 text-[#020617]">
          <Smartphone className="h-5 w-5 text-[#020617]" />
          {t("connect_health_apps")}
          {isConnected && (
            <Badge variant="default" className="border-[#22C7A1]/30 bg-[#22C7A1]/10 text-[10px] text-[#047857]">
              {t("connected")}
            </Badge>
          )}
          {needsPlugin && (
            <Badge variant="outline" className="border-[#F97316]/25 bg-[#FFF7ED] text-[10px] text-[#F97316]">
              {t("health_provider_planned")}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="font-semibold text-[#64748B]">
          {isNativePlatform
            ? `Import health data from ${platformLabel} to enhance your nutrition tracking`
            : "Connect fitness wearables for automatic health data syncing"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform detection banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#020617] text-white">
            {React.createElement(platformIcon, { className: "w-5 h-5" })}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#020617]">
              {isNativePlatform ? platformLabel : "No Health App Detected"}
            </p>
            <p className="text-xs font-semibold text-[#64748B]">
              {isNativePlatform
                ? needsPlugin
                  ? "Plugin installation required for native sync"
                  : `${platformLabel} is available on this device`
                : "Health sync is available on iOS and Android devices"}
            </p>
          </div>
        </div>

        {/* Coming soon notice when plugin is missing */}
        {needsPlugin && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#F97316]/25 bg-[#FFF7ED] p-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
              <HelpCircle className="h-6 w-6 text-[#F97316]" />
            </div>
            <div>
              <p className="text-sm font-black text-[#020617]">Health Plugin Coming Soon</p>
              <p className="mt-0.5 max-w-xs text-xs font-semibold text-[#64748B]">
                {platform === "apple_health" 
                  ? "The @capacitor-community/health plugin will be installed in the next app update to enable Apple HealthKit integration."
                  : "The @capacitor-community/google-fit plugin will be installed in the next app update to enable Google Fit integration."}
              </p>
            </div>
            <button
              disabled
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-[#F97316]/25 bg-white px-4 py-2 text-xs font-black text-[#F97316] opacity-70"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Documentation
            </button>
          </div>
        )}

        {/* Data type toggles */}
        <div className="space-y-3">
          {DATA_TYPES.map(({ key, label, icon: Icon, description }) => {
            const isEnabled = enabledTypes.includes(key);
            return (
              <div
                key={key}
                className="flex min-h-[52px] items-center justify-between"
              >
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#020617]">{label}</p>
                    <p className="line-clamp-1 text-xs font-semibold text-[#64748B]">{description}</p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => toggleDataType(key, checked)}
                  disabled={!isNativePlatform || !user || needsPlugin}
                  aria-label={label}
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-[#E5EAF1] pt-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("performance_sources")}</p>
            <p className="mt-1 text-sm font-black text-[#020617]">{t("connect_more_sources")}</p>
          </div>
          <div className="grid gap-2">
            {EXTERNAL_HEALTH_PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              const isCurrent = platform === provider.id;
              return (
                <div key={provider.id} className="flex items-center gap-3 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-[#E5EAF1]"
                    style={{ color: provider.accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-[#020617]">{provider.name}</p>
                      {isCurrent && <span className="rounded-full bg-[#22C7A1]/10 px-2 py-0.5 text-[9px] font-black uppercase text-[#047857]">{t("active")}</span>}
                    </div>
                    <p className="line-clamp-1 text-xs font-semibold text-[#64748B]">{t(provider.descriptionKey)}</p>
                    <div className="mt-2 flex gap-1 overflow-x-auto">
                      {provider.signals.slice(0, 3).map((signal) => (
                        <span key={signal} className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#64748B] ring-1 ring-[#E5EAF1]">
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-transparent text-[10px] font-black"
                    style={{
                      backgroundColor: `${provider.accent}14`,
                      color: provider.accent,
                    }}
                  >
                    {t(getProviderStatusKey(provider.status))}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sync status and actions */}
        {(isConnected || isSyncing) && (
          <div className="flex items-center justify-between border-t border-[#E5EAF1] pt-2">
            <div>
              {isSyncing ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing...
                </span>
              ) : lastSyncTimestamp ? (
                <span className="text-xs font-semibold text-[#64748B]">
                  Last synced: {formatLastSync()}
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => syncData()}
                disabled={isSyncing}
                className="h-8 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
                Sync Now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnect}
                className="h-8 text-xs text-destructive hover:text-destructive"
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
