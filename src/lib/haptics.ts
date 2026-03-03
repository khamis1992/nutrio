import { Haptics as CapacitorHaptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export const Haptics = {
  async impact(options: { style: "light" | "medium" | "heavy" }) {
    try {
      const styleMap: Record<string, ImpactStyle> = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      
      await CapacitorHaptics.impact({ style: styleMap[options.style] });
    } catch {
      // Haptics not available (web or no support)
    }
  },

  async notification(options: { type: "success" | "warning" | "error" }) {
    try {
      const typeMap: Record<string, NotificationType> = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      
      await CapacitorHaptics.notification({ type: typeMap[options.type] });
    } catch {
      // Haptics not available
    }
  },

  async vibrate() {
    try {
      await CapacitorHaptics.vibrate();
    } catch {
      // Haptics not available
    }
  },
};
