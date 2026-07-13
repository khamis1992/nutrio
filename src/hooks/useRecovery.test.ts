import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { cancelRecoveryBooking, createRecoveryBooking } from "@/hooks/useRecovery";

describe("recovery booking contracts", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("lets the server derive the customer and credit cost", async () => {
    const booking = {
      id: "booking-1",
      qr_code: "NR-SECURE",
      credits_used: 2,
    };
    rpc.mockResolvedValue({ data: booking, error: null });

    const result = await createRecoveryBooking({
      partnerId: "partner-1",
      serviceName: "Deep Tissue Massage",
      bookingDate: "2026-07-20",
      bookingTime: "15:00",
    });

    expect(rpc).toHaveBeenCalledWith("create_recovery_booking", {
      p_partner_id: "partner-1",
      p_service_name: "Deep Tissue Massage",
      p_booking_date: "2026-07-20",
      p_booking_time: "15:00",
      p_notes: null,
    });
    expect(result).toEqual(booking);
  });

  it("cancels through the atomic server contract", async () => {
    rpc.mockResolvedValue({
      data: { success: true, already_cancelled: false },
      error: null,
    });

    const result = await cancelRecoveryBooking("booking-1");

    expect(rpc).toHaveBeenCalledWith("cancel_recovery_booking", {
      p_booking_id: "booking-1",
    });
    expect(result.success).toBe(true);
  });

  it("surfaces database failures without a direct-write fallback", async () => {
    const error = new Error("INSUFFICIENT_RECOVERY_CREDITS");
    rpc.mockResolvedValue({ data: null, error });

    await expect(createRecoveryBooking({
      partnerId: "partner-1",
      serviceName: "Cryotherapy",
      bookingDate: "2026-07-20",
      bookingTime: "15:00",
    })).rejects.toBe(error);

    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
