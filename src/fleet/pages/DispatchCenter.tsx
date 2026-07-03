import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Route, Zap } from "lucide-react";
import OrderManagement from "./OrderManagement";
import RouteOptimization from "./RouteOptimization";
import AutoDispatchSettings from "./AutoDispatchSettings";

type Tab = "live" | "bulk" | "rules";

const C = {
  ink: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  protein: "#7C83F6",
  progress: "#22C7A1",
  water: "#38BDF8",
  fat: "#FB6B7A",
};

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
    <div className="space-y-5 bg-[#F6F8FB] px-1 pb-8 text-[#020617] sm:px-0">
      <div className="overflow-hidden rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#7C83F6]">
              <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
              Fleet Dispatch
            </div>
            <h1 className="mt-3 text-[26px] font-black leading-tight text-[#020617]">Dispatch Center</h1>
            <p className="mt-1 max-w-[34rem] text-sm font-semibold leading-6 text-[#64748B]">
              Manage live assignments, route batches, and automatic rules from one operational hub.
            </p>
          </div>
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#020617] text-white sm:flex">
            <Package className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const accent = tab.id === "live" ? C.progress : tab.id === "bulk" ? C.protein : C.fat;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className="group flex min-h-[104px] items-start gap-3 rounded-[24px] bg-white p-4 text-left ring-1 ring-[#E5EAF1] transition duration-200 hover:-translate-y-0.5 hover:ring-[#CBD5E1]"
              style={{
                border: isActive ? `1px solid ${accent}` : "1px solid transparent",
                boxShadow: isActive ? `0 18px 42px ${accent}22` : "0 12px 30px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: isActive ? accent : C.panel,
                  color: isActive ? "#FFFFFF" : accent,
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[15px] font-black text-[#020617]">
                  {tab.label}
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#94A3B8]">
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
