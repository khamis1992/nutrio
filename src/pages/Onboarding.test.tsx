import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import Onboarding from "@/pages/Onboarding";
import * as AuthContext from "@/contexts/AuthContext";
import * as ProfileHook from "@/hooks/useProfile";
import * as DietTagsHook from "@/hooks/useDietTags";
import * as ToastHook from "@/hooks/use-toast";
import { createMockUser } from "@/test/factories";

const mockNavigate = vi.fn();
const mockToast = vi.fn();
const mockUpdateProfile = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useProfile", () => ({ useProfile: vi.fn() }));
vi.mock("@/hooks/useDietTags", () => ({ useDietTags: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: vi.fn() }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/contexts/LanguageContext", () => {
  const translations: Record<string, string> = {
    build_muscle: "Build Muscle",
    build_muscle_desc: "Gain lean muscle mass with proper nutrition",
    complete: "Complete",
    extra_active: "Extra Active",
    female: "Female",
    lightly_active: "Lightly Active",
    lose_weight: "Lose Weight",
    lose_weight_desc: "Reduce body fat while maintaining muscle",
    maintain: "Maintain Weight",
    maintain_desc: "Maintain your current weight and improve health",
    male: "Male",
    moderately_active: "Moderately Active",
    onboarding_no_allergies: "No allergies",
    onboarding_no_preferences: "No preferences",
    saving: "Saving...",
    sedentary: "Sedentary",
    very_active: "Very Active",
    continue: "Continue",
  };
  return {
    useLanguage: () => ({
      language: "en",
      isRTL: false,
      setLanguage: vi.fn(),
      t: (key: string) => translations[key] ?? key,
    }),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      upsert: mockUpsert,
    })),
  },
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Onboarding />
      </BrowserRouter>
    </QueryClientProvider>,
  );
};

const selectGoalAndGender = async () => {
  await userEvent.click(screen.getByText("Lose Weight"));
  await userEvent.click(screen.getByTestId("onboarding-continue-btn"));
  await screen.findByText("Male");
  await userEvent.click(screen.getByText("Male"));
  await userEvent.click(screen.getByTestId("onboarding-continue-btn"));
};

const completeMetricSteps = async () => {
  await screen.findByRole("textbox", { name: /how old are you/i });
  expect(screen.getByRole("textbox", { name: /how old are you/i })).toHaveValue("25");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  await screen.findByRole("textbox", { name: /what's your height/i });
  expect(screen.getByRole("textbox", { name: /what's your height/i })).toHaveValue("170");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  await screen.findByRole("textbox", { name: /what's your current weight/i });
  expect(screen.getByRole("textbox", { name: /what's your current weight/i })).toHaveValue("80.0");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  await screen.findByRole("textbox", { name: /what's your target weight/i });
  expect(screen.getByRole("textbox", { name: /what's your target weight/i })).toHaveValue("70.0");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
};

describe("Onboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ data: null, error: null });
    mockUpdateProfile.mockResolvedValue({ data: null, error: null });

    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: createMockUser({ id: "test-user-id" }),
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    vi.mocked(ProfileHook.useProfile).mockReturnValue({
      profile: { user_id: "test-user-id", onboarding_completed: false } as ProfileHook.Profile,
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateProfile: mockUpdateProfile,
    });
    vi.mocked(DietTagsHook.useDietTags).mockReturnValue({
      dietTags: [
        { id: "diet-1", name: "Vegetarian", description: null, category: "diet" },
        { id: "diet-2", name: "Keto", description: null, category: "diet" },
      ],
      allergyTags: [
        { id: "allergy-1", name: "Peanuts", description: null, category: "allergy" },
      ],
      loading: false,
    });
    vi.mocked(ToastHook.useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      loading: vi.fn(),
      promise: vi.fn(),
    });
  });

  it("renders the first step with accessible progress", () => {
    renderPage();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByLabelText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Lose Weight")).toBeInTheDocument();
    expect(screen.getByText("Build Muscle")).toBeInTheDocument();
    expect(screen.getByText("Maintain Weight")).toBeInTheDocument();
  });

  it("requires a goal before continuing", async () => {
    renderPage();
    const continueButton = screen.getByTestId("onboarding-continue-btn");
    expect(continueButton).toBeDisabled();
    await userEvent.click(screen.getByText("Lose Weight"));
    expect(continueButton).toBeEnabled();
  });

  it("moves through gender and the four metric substeps", async () => {
    renderPage();
    await selectGoalAndGender();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    await completeMetricSteps();
    expect(await screen.findByText("Moderately Active")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "80");
  });

  it("reaches dietary preferences after selecting activity", async () => {
    renderPage();
    await selectGoalAndGender();
    await completeMetricSteps();
    await userEvent.click(await screen.findByText("Moderately Active"));
    await userEvent.click(screen.getByTestId("onboarding-continue-btn"));
    expect(await screen.findByText("Vegetarian")).toBeInTheDocument();
    expect(screen.getByText("Keto")).toBeInTheDocument();
    expect(screen.getByText("Peanuts")).toBeInTheDocument();
  });

  it("restores a saved step", async () => {
    localStorage.setItem("nutrio_onboarding_progress", JSON.stringify({
      step: 2,
      data: {
        goal: "lose",
        gender: null,
        age: "25",
        height: "170",
        weight: "80",
        targetWeight: "70",
        activityLevel: null,
        trainingDaysPerWeek: "3",
        foodPreferences: [],
        allergies: [],
      },
    }));
    renderPage();
    expect(await screen.findByText("Male")).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Welcome back!" }));
  });

  it("saves quick-start values using the current profile schema", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("onboarding-quick-start-btn"));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled());
    expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      health_goal: "maintain",
      height_cm: 170,
      current_weight_kg: 75,
      target_weight_kg: 75,
      onboarding_completed: true,
    }));
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "test-user-id",
      goal_type: "maintenance",
    }));
  });

  it("redirects unauthenticated visitors to auth", async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderPage();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/auth"));
  });

  it("redirects users who already completed onboarding", async () => {
    vi.mocked(ProfileHook.useProfile).mockReturnValue({
      profile: { user_id: "test-user-id", onboarding_completed: true } as ProfileHook.Profile,
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateProfile: mockUpdateProfile,
    });
    renderPage();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });

  it("waits for authentication before redirecting", () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderPage();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
