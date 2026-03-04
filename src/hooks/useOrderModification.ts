/**
 * Utility to check if an order/scheduled meal can be modified.
 * An order is modifiable if it is in a pending or scheduled state
 * and the scheduled date is in the future.
 */
export const isOrderModifiable = (
  orderStatus: string | null | undefined,
  scheduledDate?: string | null
): boolean => {
  const nonModifiableStatuses = ["delivered", "cancelled", "in_transit", "preparing"];
  if (!orderStatus || nonModifiableStatuses.includes(orderStatus.toLowerCase())) {
    return false;
  }
  if (scheduledDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduled = new Date(scheduledDate);
    scheduled.setHours(0, 0, 0, 0);
    return scheduled >= today;
  }
  return true;
};
