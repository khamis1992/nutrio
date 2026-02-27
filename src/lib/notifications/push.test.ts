/**
 * Push Notification Service Tests
 * Tests for Capacitor push notification integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(true),
    getPlatform: vi.fn().mockReturnValue("ios"),
  },
}));

// Mock PushNotifications
const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();
const mockRegister = vi.fn();
const mockAddListener = vi.fn();

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: (...args: any[]) => mockCheckPermissions(...args),
    requestPermissions: (...args: any[]) => mockRequestPermissions(...args),
    register: (...args: any[]) => mockRegister(...args),
    addListener: (...args: any[]) => mockAddListener(...args),
  },
}));

// Mock Supabase
const mockUpsert = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
    from: vi.fn().mockReturnValue({
      upsert: (...args: any[]) => mockUpsert(...args),
    }),
  },
}));

// Import after mocks
import { pushNotificationService, type PushNotificationData } from "./push";
import { Capacitor } from "@capacitor/core";

describe("Push Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Service Initialization", () => {
    it("returns singleton instance", () => {
      const instance1 = pushNotificationService;
      const instance2 = pushNotificationService;

      expect(instance1).toBe(instance2);
    });
  });

  describe("initialize()", () => {
    it("skips initialization on web platform", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      await pushNotificationService.initialize();

      expect(mockCheckPermissions).not.toHaveBeenCalled();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it("checks permissions on native platform", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "granted" });

      await pushNotificationService.initialize();

      expect(mockCheckPermissions).toHaveBeenCalled();
    });

    it("requests permissions when status is prompt", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "prompt" });
      mockRequestPermissions.mockResolvedValue({ receive: "granted" });

      await pushNotificationService.initialize();

      expect(mockRequestPermissions).toHaveBeenCalled();
    });

    it("registers for push notifications when permission granted", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "granted" });

      await pushNotificationService.initialize();

      expect(mockRegister).toHaveBeenCalled();
    });

    it("does not register if permission denied", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "prompt" });
      mockRequestPermissions.mockResolvedValue({ receive: "denied" });

      await pushNotificationService.initialize();

      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe("Token Registration", () => {
    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "granted" });
    });

    it("saves token to database on registration", async () => {
      const mockToken = "test-fcm-token";
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "registration") {
          callback({ value: mockToken });
        }
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });

      mockUpsert.mockResolvedValue({ error: null });

      await pushNotificationService.initialize();

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "test-user-id",
          token: mockToken,
          platform: "ios",
        }),
        { onConflict: "user_id" }
      );
    });

    it("does not save token if user not authenticated", async () => {
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "registration") {
          callback({ value: "test-token" });
        }
      });

      mockGetUser.mockResolvedValue({ data: { user: null } });

      await pushNotificationService.initialize();

      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("stores token locally on registration", async () => {
      const mockToken = "test-fcm-token";
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "registration") {
          callback({ value: mockToken });
        }
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });
      mockUpsert.mockResolvedValue({ error: null });

      await pushNotificationService.initialize();

      expect(pushNotificationService.getToken()).toBe(mockToken);
    });

    it("handles registration errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "registrationError") {
          callback({ error: "Test error" });
        }
      });

      await pushNotificationService.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Push registration error:",
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Notification Handling", () => {
    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "granted" });
    });

    it("registers listener for push notifications received", async () => {
      await pushNotificationService.initialize();

      expect(mockAddListener).toHaveBeenCalledWith(
        "pushNotificationReceived",
        expect.any(Function)
      );
    });

    it("registers listener for push notification actions", async () => {
      await pushNotificationService.initialize();

      expect(mockAddListener).toHaveBeenCalledWith(
        "pushNotificationActionPerformed",
        expect.any(Function)
      );
    });

    it("registers listener for registration events", async () => {
      await pushNotificationService.initialize();

      expect(mockAddListener).toHaveBeenCalledWith(
        "registration",
        expect.any(Function)
      );
    });
  });

  describe("Notification Navigation", () => {
    const originalLocation = window.location;

    beforeEach(() => {
      // @ts-ignore
      delete window.location;
      window.location = { href: "" } as any;
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it("navigates to tracking page for order_update", async () => {
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "pushNotificationActionPerformed") {
          callback({
            notification: {
              data: {
                type: "order_update",
                orderId: "test-order-123",
              } as PushNotificationData,
            },
          });
        }
      });

      await pushNotificationService.initialize();

      expect(window.location.href).toBe("/tracking?id=test-order-123");
    });

    it("navigates to tracking page for delivery_update", async () => {
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "pushNotificationActionPerformed") {
          callback({
            notification: {
              data: {
                type: "delivery_update",
                orderId: "test-order-456",
              } as PushNotificationData,
            },
          });
        }
      });

      await pushNotificationService.initialize();

      expect(window.location.href).toBe("/tracking?id=test-order-456");
    });

    it("navigates to meals page for promotion", async () => {
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "pushNotificationActionPerformed") {
          callback({
            notification: {
              data: {
                type: "promotion",
                title: "Special Offer!",
              } as PushNotificationData,
            },
          });
        }
      });

      await pushNotificationService.initialize();

      expect(window.location.href).toBe("/meals");
    });

    it("navigates to schedule page for reminder", async () => {
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "pushNotificationActionPerformed") {
          callback({
            notification: {
              data: {
                type: "reminder",
                title: "Don't forget to order!",
              } as PushNotificationData,
            },
          });
        }
      });

      await pushNotificationService.initialize();

      expect(window.location.href).toBe("/schedule");
    });

    it("handles missing orderId gracefully", async () => {
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "pushNotificationActionPerformed") {
          callback({
            notification: {
              data: {
                type: "order_update",
              } as PushNotificationData,
            },
          });
        }
      });

      await pushNotificationService.initialize();

      // Should not navigate if orderId is missing
      expect(window.location.href).toBe("");
    });
  });

  describe("Token Management", () => {
    it("returns null token before initialization", () => {
      expect(pushNotificationService.getToken()).toBeNull();
    });

    it("returns stored token after registration", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "granted" });

      const mockToken = "test-token-123";
      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "registration") {
          callback({ value: mockToken });
        }
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });
      mockUpsert.mockResolvedValue({ error: null });

      await pushNotificationService.initialize();

      expect(pushNotificationService.getToken()).toBe(mockToken);
    });
  });

  describe("Platform Support", () => {
    it("handles iOS platform", async () => {
      vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "granted" });

      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "registration") {
          callback({ value: "ios-token" });
        }
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });
      mockUpsert.mockResolvedValue({ error: null });

      await pushNotificationService.initialize();

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ platform: "ios" }),
        expect.anything()
      );
    });

    it("handles Android platform", async () => {
      vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      mockCheckPermissions.mockResolvedValue({ receive: "granted" });

      mockAddListener.mockImplementation((event: string, callback: Function) => {
        if (event === "registration") {
          callback({ value: "android-token" });
        }
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      });
      mockUpsert.mockResolvedValue({ error: null });

      await pushNotificationService.initialize();

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ platform: "android" }),
        expect.anything()
      );
    });
  });
});
