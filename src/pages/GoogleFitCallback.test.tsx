import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabase } from "@/integrations/supabase/client";

import GoogleFitCallback from "./GoogleFitCallback";

vi.mock("@/services/health/googleFit", () => ({
  getGoogleFitRedirectUri: () => "https://nutrio.test/google-fit/callback",
}));

const invoke = vi.mocked(supabase.functions.invoke);

function renderCallback(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/google-fit/callback${query}`]}>
      <Routes>
        <Route path="/auth/google-fit/callback" element={<GoogleFitCallback />} />
        <Route path="/tracker" element={<div>Tracker</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GoogleFitCallback", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockClear();
    invoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("rejects a callback without state", async () => {
    sessionStorage.setItem("google_oauth_state", "expected-state");
    sessionStorage.setItem("google_code_verifier", "v".repeat(64));

    renderCallback("?code=authorization-code");

    expect(await screen.findByText("Security check failed. Please try again.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("google_oauth_state")).toBeNull();
    expect(sessionStorage.getItem("google_code_verifier")).toBeNull();
  });

  it("rejects a callback when no locally stored state exists", async () => {
    sessionStorage.setItem("google_code_verifier", "v".repeat(64));

    renderCallback("?code=authorization-code&state=unexpected-state");

    expect(await screen.findByText("Security check failed. Please try again.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a callback with mismatched state", async () => {
    sessionStorage.setItem("google_oauth_state", "expected-state");
    sessionStorage.setItem("google_code_verifier", "v".repeat(64));

    renderCallback("?code=authorization-code&state=unexpected-state");

    expect(await screen.findByText("Security check failed. Please try again.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a callback when the PKCE verifier is missing", async () => {
    sessionStorage.setItem("google_oauth_state", "expected-state");

    renderCallback("?code=authorization-code&state=expected-state");

    expect(await screen.findByText("Security check failed. Please try again.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("exchanges the code only when state and PKCE verifier are valid", async () => {
    const codeVerifier = "v".repeat(64);
    sessionStorage.setItem("google_oauth_state", "expected-state");
    sessionStorage.setItem("google_code_verifier", codeVerifier);

    renderCallback("?code=authorization-code&state=expected-state");

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("google-fit-token", {
        body: {
          code: "authorization-code",
          codeVerifier,
          redirectUri: "https://nutrio.test/google-fit/callback",
        },
      });
    });
    expect(await screen.findByText("Successfully connected to Google Fit!")).toBeInTheDocument();
    expect(sessionStorage.getItem("google_oauth_state")).toBeNull();
    expect(sessionStorage.getItem("google_code_verifier")).toBeNull();
  });
});
