import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminMfaGate, FleetMfaGate } from "@/components/admin/AdminMfaGate";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  restrictWebSessionToCurrentTab: vi.fn(),
  supabase: {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(),
        listFactors: vi.fn(),
        challengeAndVerify: vi.fn(),
        enroll: vi.fn(),
        unenroll: vi.fn(),
      },
    },
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/asset-path", () => ({
  assetPath: (path: string) => path,
}));

const olderFactor = {
  id: "factor-older",
  factor_type: "totp" as const,
  status: "verified" as const,
  friendly_name: "Office phone",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const newerFactor = {
  id: "factor-newer",
  factor_type: "totp" as const,
  status: "verified" as const,
  friendly_name: "Personal phone",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

const mfa = supabase.auth.mfa;

function mockFactors() {
  vi.mocked(mfa.listFactors).mockResolvedValue({
    data: {
      all: [olderFactor, newerFactor],
      totp: [olderFactor, newerFactor],
      phone: [],
      webauthn: [],
    },
    error: null,
  });
}

describe("AdminMfaGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ signOut: vi.fn() } as never);
    vi.mocked(mfa.getAuthenticatorAssuranceLevel)
      .mockResolvedValueOnce({
        data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
        error: null,
      })
      .mockResolvedValue({
        data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
        error: null,
      });
    vi.mocked(mfa.challengeAndVerify).mockResolvedValue({
      data: { access_token: "verified-aal2-token" } as never,
      error: null,
    });
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    mockFactors();
  });

  it("selects the newest authenticator but lets the administrator choose another", async () => {
    render(
      <AdminMfaGate>
        <div>Admin portal</div>
      </AdminMfaGate>,
    );

    const factorSelect = await screen.findByRole("combobox", {
      name: /choose authenticator/i,
    });
    expect(factorSelect).toHaveValue("factor-newer");

    fireEvent.change(factorSelect, { target: { value: "factor-older" } });
    fireEvent.change(screen.getByLabelText(/six-digit code/i), {
      target: { value: "١٢٣٤٥٦" },
    });
    expect(screen.getByLabelText(/six-digit code/i)).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    await waitFor(() => {
      expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
        factorId: "factor-older",
        code: "123456",
      });
    });
    expect(await screen.findByText("Admin portal")).toBeInTheDocument();
  });

  it("explains how to resolve a rejected TOTP code", async () => {
    vi.mocked(mfa.challengeAndVerify).mockResolvedValueOnce({
      data: null,
      error: {
        name: "AuthApiError",
        message: "Invalid TOTP code",
        status: 422,
      } as never,
    });

    render(
      <AdminMfaGate>
        <div>Admin portal</div>
      </AdminMfaGate>,
    );

    await screen.findByRole("combobox", { name: /choose authenticator/i });
    fireEvent.change(screen.getByLabelText(/six-digit code/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(
      await screen.findByText(/does not match the selected authenticator/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/automatic date and time/i)).toHaveLength(2);
  });

  it("checks AAL2 against the session returned by MFA verification", async () => {
    vi.mocked(mfa.getAuthenticatorAssuranceLevel).mockReset();
    vi.mocked(mfa.getAuthenticatorAssuranceLevel).mockImplementation(
      async (accessToken?: string) => ({
        data: {
          currentLevel: accessToken === "verified-aal2-token" ? "aal2" : "aal1",
          nextLevel: "aal2",
          currentAuthenticationMethods: [],
        },
        error: null,
      }),
    );

    render(
      <AdminMfaGate>
        <div>Admin portal</div>
      </AdminMfaGate>,
    );

    await screen.findByRole("combobox", { name: /choose authenticator/i });
    fireEvent.change(screen.getByLabelText(/six-digit code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(await screen.findByText("Admin portal")).toBeInTheDocument();
    expect(mfa.getAuthenticatorAssuranceLevel).toHaveBeenLastCalledWith(
      "verified-aal2-token",
    );
  });

  it("distinguishes a rate limit from a wrong authenticator code", async () => {
    vi.mocked(mfa.challengeAndVerify).mockResolvedValueOnce({
      data: null,
      error: {
        name: "AuthApiError",
        message: "Too many requests",
        status: 429,
        code: "over_request_rate_limit",
      } as never,
    });

    render(
      <AdminMfaGate>
        <div>Admin portal</div>
      </AdminMfaGate>,
    );

    await screen.findByRole("combobox", { name: /choose authenticator/i });
    fireEvent.change(screen.getByLabelText(/six-digit code/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(await screen.findByText(/too many verification attempts/i)).toBeInTheDocument();
  });

  it("records fleet super-admin verification with the fleet audit RPC", async () => {
    render(
      <FleetMfaGate>
        <div>Fleet portal</div>
      </FleetMfaGate>,
    );

    expect(await screen.findByText(/protected fleet operations/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/six-digit code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(await screen.findByText("Fleet portal")).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith("fleet_record_mfa_verification");
  });
});
