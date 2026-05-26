import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Footprints,
  Dumbbell,
  RefreshCw,
  Smartphone,
  Apple,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useHealthKitIntegration } from "@/hooks/useHealthKitIntegration";
import {
  PLATFORM_LABELS,
  type SyncDataType,
  type HealthPlatform,
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          Connect Health Apps
          {isConnected && (
            <Badge variant="default" className="ml-2 bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">
              Connected
            </Badge>
          )}
          {needsPlugin && (
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-200 text-[10px] bg-amber-50">
              Coming Soon
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isNativePlatform
            ? `Import health data from ${platformLabel} to enhance your nutrition tracking`
            : "Connect fitness wearables for automatic health data syncing"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform detection banner */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {React.createElement(platformIcon, { className: "w-5 h-5 text-primary" })}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isNativePlatform ? platformLabel : "No Health App Detected"}
            </p>
            <p className="text-xs text-muted-foreground">
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
          <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-700 text-sm">Health Plugin Coming Soon</p>
              <p className="text-xs text-amber-600/80 mt-0.5 max-w-xs">
                {platform === "apple_health" 
                  ? "The @capacitor-community/health plugin will be installed in the next app update to enable Apple HealthKit integration."
                  : "The @capacitor-community/google-fit plugin will be installed in the next app update to enable Google Fit integration."}
              </p>
            </div>
            <button
              disabled
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-200/50 text-amber-700 text-xs font-semibold border border-amber-300 cursor-not-allowed opacity-70"
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
                className="flex items-center justify-between min-h-[44px]"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
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

        {/* Sync status and actions */}
        {(isConnected || isSyncing) && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              {isSyncing ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing...
                </span>
              ) : lastSyncTimestamp ? (
                <span className="text-xs text-muted-foreground">
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

