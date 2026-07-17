export type SubscriptionStatus = "active" | "pending" | "cancelled" | "expired";

const PLAN_VALUES = ["weekly", "monthly"] as const;
const TIER_VALUES = [
  "weekly",
  "fresh",
  "healthy",
  "elite",
  "basic",
  "standard",
  "premium",
  "vip",
] as const;
const STATUS_VALUES = ["active", "pending", "cancelled", "expired"] as const;

export const normalizeSubscriptionPlan = (value: string | null | undefined) => {
  const normalized = String(value || "").trim().toLowerCase();
  return PLAN_VALUES.includes(normalized as (typeof PLAN_VALUES)[number])
    ? normalized
    : "weekly";
};

export const normalizeSubscriptionTier = (value: string | null | undefined) => {
  const normalized = String(value || "").trim().toLowerCase();
  return TIER_VALUES.includes(normalized as (typeof TIER_VALUES)[number])
    ? normalized
    : "basic";
};

export const normalizeSubscriptionStatus = (
  value: string | null | undefined,
): SubscriptionStatus => {
  const normalized = String(value || "").trim().toLowerCase();
  return STATUS_VALUES.includes(normalized as SubscriptionStatus)
    ? (normalized as SubscriptionStatus)
    : "active";
};

export interface SubscriptionSaveOverrides {
  plan?: string;
  status?: SubscriptionStatus;
  tier?: string;
  mealsPerWeek?: number;
  mealsPerMonth?: number;
  mealsUsedThisWeek?: number;
  mealsUsedThisMonth?: number;
  price?: number;
  endDate?: string | null;
  walletBalance?: number;
}

export interface SubscriptionFormValues {
  selectedPlan: string;
  selectedStatus: string;
  selectedTier: string;
  mealsPerWeek: string;
  mealsPerMonth: string;
  mealsUsedWeek: string;
  mealsUsed: string;
  price: string;
  endDate: string;
  walletBalance: string;
}

export interface AdminSubscriptionWalletArgs {
  p_user_id: string;
  p_subscription_id: string | null;
  p_plan: string;
  p_status: SubscriptionStatus;
  p_tier: string;
  p_meals_per_week: number;
  p_meals_per_month: number;
  p_meals_used_this_week: number;
  p_meals_used_this_month: number;
  p_price: number;
  p_end_date: string | null;
  p_includes_gym: false;
  p_wallet_balance: number;
}

export const getNextSubscriptionEndDate = (
  plan: string,
  from = new Date(),
) => {
  const normalizedPlan = normalizeSubscriptionPlan(plan);
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + (normalizedPlan === "weekly" ? 7 : 30));
  return date.toISOString().slice(0, 10);
};

export const ensureActiveSubscriptionEndDate = ({
  status,
  plan,
  endDate,
  today = new Date(),
}: {
  status: string | null | undefined;
  plan: string;
  endDate: string | null | undefined;
  today?: Date;
}) => {
  if (normalizeSubscriptionStatus(status) !== "active") return endDate || null;
  const todayKey = today.toISOString().slice(0, 10);
  if (!endDate || endDate.slice(0, 10) < todayKey) {
    return getNextSubscriptionEndDate(plan, today);
  }
  return endDate;
};

export const parseSubscriptionNumberInput = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

export const buildAdminSubscriptionWalletArgs = ({
  userId,
  subscriptionId,
  form,
  overrides = {},
}: {
  userId: string;
  subscriptionId: string | null;
  form: SubscriptionFormValues;
  overrides?: SubscriptionSaveOverrides;
}): AdminSubscriptionWalletArgs => ({
  p_user_id: userId,
  p_subscription_id: subscriptionId,
  p_plan: normalizeSubscriptionPlan(overrides.plan ?? form.selectedPlan),
  p_status: normalizeSubscriptionStatus(
    overrides.status ?? form.selectedStatus,
  ),
  p_tier: normalizeSubscriptionTier(overrides.tier ?? form.selectedTier),
  p_meals_per_week:
    overrides.mealsPerWeek ??
    parseSubscriptionNumberInput(form.mealsPerWeek, 5),
  p_meals_per_month:
    overrides.mealsPerMonth ??
    parseSubscriptionNumberInput(form.mealsPerMonth, 20),
  p_meals_used_this_week:
    overrides.mealsUsedThisWeek ??
    parseSubscriptionNumberInput(form.mealsUsedWeek, 0),
  p_meals_used_this_month:
    overrides.mealsUsedThisMonth ??
    parseSubscriptionNumberInput(form.mealsUsed, 0),
  p_price: overrides.price ?? parseSubscriptionNumberInput(form.price, 99),
  p_end_date: ensureActiveSubscriptionEndDate({
    status: overrides.status ?? form.selectedStatus,
    plan: overrides.plan ?? form.selectedPlan,
    endDate: overrides.endDate ?? (form.endDate || null),
  }),
  p_includes_gym: false,
  p_wallet_balance:
    overrides.walletBalance ??
    parseSubscriptionNumberInput(form.walletBalance, 0),
});
