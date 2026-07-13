import { useMemo } from "react";
import { useAnalytics } from "@/contexts/AnalyticsContext";

type ExperimentVariant = "control" | "variant_b" | "variant_c";

interface Experiment<T extends string = ExperimentVariant> {
  key: string;
  variants: readonly T[];
  defaultVariant: T;
}

export const EXPERIMENTS = {
  widget_ordering: {
    key: "widget-ordering",
    variants: ["control", "adaptive_first"] as const,
    defaultVariant: "control",
  },
  meal_card_layout: {
    key: "meal-card-layout",
    variants: ["grid", "list", "carousel"] as const,
    defaultVariant: "grid",
  },
  push_cadence: {
    key: "push-cadence",
    variants: ["twice_daily", "meal_time_only", "once_daily"] as const,
    defaultVariant: "twice_daily",
  },
  checkout_flow: {
    key: "checkout-flow",
    variants: ["multi_step", "single_page", "progress_bar"] as const,
    defaultVariant: "multi_step",
  },
  reorder_placement: {
    key: "reorder-placement",
    variants: ["dashboard_only", "dashboard_and_banner"] as const,
    defaultVariant: "dashboard_only",
  },
  filter_ui: {
    key: "filter-ui",
    variants: ["bottom_sheet", "inline_chips"] as const,
    defaultVariant: "bottom_sheet",
  },
} as const;

export function useExperiment<T extends string>(
  experiment: Experiment<T>
): T {
  const { getExperimentVariant } = useAnalytics();

  const variant = useMemo(() => {
    const remoteVariant = getExperimentVariant(experiment.key);
    if (remoteVariant && (experiment.variants as readonly string[]).includes(remoteVariant)) {
      return remoteVariant as T;
    }
    return experiment.defaultVariant;
  }, [getExperimentVariant, experiment]);

  return variant;
}

export function useWidgetOrderingVariant() {
  return useExperiment(EXPERIMENTS.widget_ordering);
}

export function useMealCardLayoutVariant() {
  return useExperiment(EXPERIMENTS.meal_card_layout);
}

export function usePushCadenceVariant() {
  return useExperiment(EXPERIMENTS.push_cadence);
}

export function useCheckoutFlowVariant() {
  return useExperiment(EXPERIMENTS.checkout_flow);
}

export function useReorderPlacementVariant() {
  return useExperiment(EXPERIMENTS.reorder_placement);
}

export function useFilterUIVariant() {
  return useExperiment(EXPERIMENTS.filter_ui);
}

export type { ExperimentVariant };
