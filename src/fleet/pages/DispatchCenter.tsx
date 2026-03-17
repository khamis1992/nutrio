import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Route, Zap } from "lucide-react";
import OrderManagement from "./OrderManagement";
import RouteOptimization from "./RouteOptimization";
import AutoDispatchSettings from "./AutoDispatchSettings";

type Tab = "live" | "bulk" | "rules";

const TABS: { id: Tab; label: string; icon: typeof Package; description: string }[] = [
  {
    id: "live",
    icon: Package,
    label: "Live Queue",
    description: "Dispatch one order at a time as they arrive",
  },
  {
    id: "bulk",
    icon: Route,
    label: "Bulk Assign",
    description: "Plan and assign many orders at once",
  },
  {
    id: "rules",
    icon: Zap,
    label: "Auto Rules",
    description: "Let the system assign orders automatically",
  },
];

export default function DispatchCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "live";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Dispatch Center</h1>
        <p className="text-muted-foreground">
          Manage all order assignments from one place.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-start gap-3 flex-1 rounded-xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className={`font-semibold text-sm ${isActive ? "text-primary" : ""}`}>
                  {tab.label}
                </p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "live" && <OrderManagement />}
        {activeTab === "bulk" && <RouteOptimization />}
        {activeTab === "rules" && <AutoDispatchSettings />}
      </div>
    </div>
  );
}
