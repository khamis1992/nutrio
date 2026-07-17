export const shouldShowSubscriptionReactivation = (
  source: string | null,
  status: string | null | undefined,
) => (
  source === "reactivation" &&
  ["expired", "pending", "cancelled"].includes(String(status || "").toLowerCase())
);
