import type { AutoDispatchRule } from "@/fleet/services/orderDispatch";
import type { DispatchOrderRecord } from "@/fleet/services/orderDispatch";
import type { DispatchRecommendation } from "./dispatchRecommendations";

export interface AutoDispatchAction {
  orderId: string;
  driverId: string;
  ruleName: string;
  reason: string;
}

/**
 * Evaluates all enabled rules against the current dispatch queue.
 * Returns at most one action per order (first matching rule wins).
 */
export function evaluateAutoDispatchRules(
  rules: AutoDispatchRule[],
  orders: DispatchOrderRecord[],
  recommendationMap: Map<string, DispatchRecommendation[]>,
  now: number
): AutoDispatchAction[] {
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) return [];

  const actions: AutoDispatchAction[] = [];
  const handledOrderIds = new Set<string>();

  for (const rule of enabledRules) {
    for (const order of orders) {
      if (handledOrderIds.has(order.id)) continue;
      if (order.status !== rule.triggerStatus) continue;
      // Skip orders that already have a driver assigned
      if (order.assignedDriverId) continue;

      const elapsedMinutes = (now - new Date(order.createdAt).getTime()) / 60000;
      if (elapsedMinutes < rule.minWaitMinutes) continue;

      const recommendations = recommendationMap.get(order.id) ?? [];
      const top = recommendations[0];
      if (!top) continue;
      if (top.distanceKm == null || top.distanceKm > rule.maxDriverDistanceKm) continue;
      if (top.isOverloaded) continue;
      // Don't auto-assign to a low-reliability driver
      if (top.reliabilityTier === "red") continue;

      actions.push({
        orderId: order.id,
        driverId: top.driverId,
        ruleName: rule.label,
        reason: `Auto-assigned by rule "${rule.label}": waited ${Math.round(elapsedMinutes)} min, driver ${top.distanceKm.toFixed(1)} km away`,
      });

      handledOrderIds.add(order.id);
    }
  }

  return actions;
}
