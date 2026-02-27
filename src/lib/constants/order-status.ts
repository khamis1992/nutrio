// Unified order status definitions
export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    description: string;
    icon: string;
    color: string;
    customerVisible: boolean;
  }
> = {
  [ORDER_STATUS.PENDING]: {
    label: "Order Placed",
    description: "Waiting for restaurant confirmation",
    icon: "Package",
    color: "bg-yellow-500",
    customerVisible: true,
  },
  [ORDER_STATUS.CONFIRMED]: {
    label: "Confirmed",
    description: "Restaurant has accepted your order",
    icon: "CheckCircle2",
    color: "bg-blue-500",
    customerVisible: true,
  },
  [ORDER_STATUS.PREPARING]: {
    label: "Preparing",
    description: "Your meal is being prepared",
    icon: "ChefHat",
    color: "bg-orange-500",
    customerVisible: true,
  },
  [ORDER_STATUS.READY]: {
    label: "Ready for Pickup",
    description: "Waiting for driver assignment",
    icon: "Box",
    color: "bg-purple-500",
    customerVisible: true,
  },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: {
    label: "Out for Delivery",
    description: "Your driver is on the way",
    icon: "Truck",
    color: "bg-indigo-500",
    customerVisible: true,
  },
  [ORDER_STATUS.DELIVERED]: {
    label: "Delivered",
    description: "Enjoy your meal!",
    icon: "CheckCheck",
    color: "bg-green-500",
    customerVisible: true,
  },
  [ORDER_STATUS.CANCELLED]: {
    label: "Cancelled",
    description: "This order was cancelled",
    icon: "XCircle",
    color: "bg-red-500",
    customerVisible: true,
  },
};

// Status progression for timeline
export const ORDER_TIMELINE = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export const getStatusIndex = (status: OrderStatus): number => {
  const index = ORDER_TIMELINE.indexOf(status as Exclude<OrderStatus, "cancelled">);
  return index;
};

export const isStatusPast = (currentStatus: OrderStatus, checkStatus: OrderStatus): boolean => {
  return getStatusIndex(currentStatus) > getStatusIndex(checkStatus);
};

export const isStatusCurrent = (currentStatus: OrderStatus, checkStatus: OrderStatus): boolean => {
  return currentStatus === checkStatus;
};

export const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
  const currentIndex = getStatusIndex(currentStatus);
  if (currentIndex === -1 || currentIndex >= ORDER_TIMELINE.length - 1) return null;
  return ORDER_TIMELINE[currentIndex + 1];
};

export const getEstimatedTimeForStatus = (status: OrderStatus): string => {
  const estimates: Record<OrderStatus, string> = {
    [ORDER_STATUS.PENDING]: "5-10 min for confirmation",
    [ORDER_STATUS.CONFIRMED]: "15-25 min for preparation",
    [ORDER_STATUS.PREPARING]: "10-20 min remaining",
    [ORDER_STATUS.READY]: "5-10 min for driver pickup",
    [ORDER_STATUS.OUT_FOR_DELIVERY]: "15-30 min for delivery",
    [ORDER_STATUS.DELIVERED]: "",
    [ORDER_STATUS.CANCELLED]: "",
  };
  return estimates[status] || "";
};
