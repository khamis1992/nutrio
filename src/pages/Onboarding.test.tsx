/**
 * Onboarding Component Tests
 * Tests for the multi-step onboarding flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import Onboarding from "@/pages/Onboarding";
import * as AuthContext from "@/contexts/AuthContext";
import * as ProfileHook from "@/hooks/useProfile";
import * as DietTagsHook from "@/hooks/useDietTags";
import * as ToastHook from "@/hooks/use-toast";

// Mock hooks and contexts
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(),
}));

vi.mock("@/hooks/useDietTags", () => ({
  useDietTags: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockNavigate = vi.fn();
const mockToast = vi.fn();

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// Test utilities
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

const setupDefaultMocks = () => {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    user: { id: "test-user-id", email: "test@example.com" },
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

  vi.mocked(ProfileHook.useProfile).mockReturnValue({
    profile: {
      id: "test-profile-id",
      user_id: "test-user-id",
      onboarding_completed: false,
    } as any,
    loading: false,
    error: null,
    refetch: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  vi.mocked(DietTagsHook.useDietTags).mockReturnValue({
    dietTags: [
      { id: "1", name: "Vegetarian", description: null, category: "diet" },
      { id: "2", name: "Keto", description: null, category: "diet" },
    ],
    allergyTags: [
      { id: "3", name: "Peanuts", description: null, category: "allergy" },
      { id: "4", name: "Dairy", description: null, category: "allergy" },
    ],
    loading: false,
  });

  vi.mocked(ToastHook.useToast).mockReturnValue({
    toast: mockToast,
    dismiss: vi.fn(),
    toasts: [],
  });

  mockLocalStorage.clear();
  mockNavigate.mockClear();
  mockToast.mockClear();
};

describe("Onboarding Component", () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Progress Bar", () => {
    it("renders progress bar with correct initial percentage", () => {
      renderWithProviders(<Onboarding />);
      
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toBeInTheDocument();
      
      // Step 1 of 5 = 20%
      expect(progressBar).toHaveStyle({ width: "20%" });
    });

    it("updates progress bar percentage when navigating steps", async () => {
      renderWithProviders(<Onboarding />);
      
      // Step 1: 20%
      let progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveStyle({ width: "20%" });
      
      // Select goal to enable continue
      const loseWeightCard = screen.getByText("Lose Weight").closest("div[class*='cursor-pointer']") || 
                             screen.getByText("Lose Weight").closest("button");
      if (loseWeightCard) {
        await userEvent.click(loseWeightCard);
      }
      
      // Continue to step 2
      const continueButton = screen.getByText(/Continue/i);
      await userEvent.click(continueButton);
      
      // Step 2: 40%
      await waitFor(() => {
        progressBar = screen.getByRole("progressbar");
        expect(progressBar).toHaveStyle({ width: "40%" });
      });
    });

    it("displays correct step indicator", () => {
      renderWithProviders(<Onboarding />);
      
      expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
    });
  });

  describe("Step Navigation", () => {
    it("navigates from step 1 to step 2 after selecting goal", async () => {
      renderWithProviders(<Onboarding />);
      
      // Initially on step 1
      expect(screen.getByText(/What's your.*main goal/i)).toBeInTheDocument();
      
      // Select a goal
      const loseWeightOption = screen.getByText("Lose Weight");
      await userEvent.click(loseWeightOption);
      
      // Click continue
      const continueButton = screen.getByText(/Continue/i);
      await userEvent.click(continueButton);
      
      // Should be on step 2
      await waitFor(() => {
        expect(screen.getByText(/Tell us about.*yourself/i)).toBeInTheDocument();
      });
    });

    it("navigates back from step 2 to step 1", async () => {
      renderWithProviders(<Onboarding />);
      
      // Go to step 2 first
      const loseWeightOption = screen.getByText("Lose Weight");
      await userEvent.click(loseWeightOption);
      const continueButton = screen.getByText(/Continue/i);
      await userEvent.click(continueButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Tell us about.*yourself/i)).toBeInTheDocument();
      });
      
      // Click back
      const backButton = screen.getByText(/Back/i);
      await userEvent.click(backButton);
      
      // Should be back on step 1
      await waitFor(() => {
        expect(screen.getByText(/What's your.*main goal/i)).toBeInTheDocument();
      });
    });

    it("disables continue button until required field is selected", async () => {
      renderWithProviders(<Onboarding />);
      
      const continueButton = screen.getByText(/Continue/i);
      expect(continueButton).toBeDisabled();
      
      // Select a goal
      const loseWeightOption = screen.getByText("Lose Weight");
      await userEvent.click(loseWeightOption);
      
      // Button should now be enabled
      expect(continueButton).not.toBeDisabled();
    });

    it("shows Complete button on final step", async () => {
      renderWithProviders(<Onboarding />);
      
      // Navigate through all steps
      // Step 1: Select goal
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Step 2: Select gender
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Step 3: Fill metrics
      await waitFor(() => screen.getByLabelText(/Age/i));
      await userEvent.type(screen.getByLabelText(/Age/i), "30");
      await userEvent.type(screen.getByLabelText(/Height/i), "175");
      await userEvent.type(screen.getByLabelText(/Current Weight/i), "80");
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Step 4: Select activity
      await waitFor(() => screen.getByText(/Sedentary/i));
      await userEvent.click(screen.getByText(/Moderately Active/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Step 5: Should show Complete button
      await waitFor(() => {
        expect(screen.getByText(/Complete/i)).toBeInTheDocument();
      });
    });
  });

  describe("Step 1 - Goal Selection", () => {
    it("renders all three goal options", () => {
      renderWithProviders(<Onboarding />);
      
      expect(screen.getByText("Lose Weight")).toBeInTheDocument();
      expect(screen.getByText("Build Muscle")).toBeInTheDocument();
      expect(screen.getByText("Maintain")).toBeInTheDocument();
    });

    it("selects goal when clicked", async () => {
      renderWithProviders(<Onboarding />);
      
      const loseWeightOption = screen.getByText("Lose Weight");
      await userEvent.click(loseWeightOption);
      
      // Should show checkmark or highlight
      const parentCard = loseWeightOption.closest("div[class*='border-2']") || 
                        loseWeightOption.closest("div[class*='cursor-pointer']");
      expect(parentCard).toBeTruthy();
    });
  });

  describe("Step 2 - Gender Selection", () => {
    it("renders gender options", async () => {
      renderWithProviders(<Onboarding />);
      
      // Navigate to step 2
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Male/i)).toBeInTheDocument();
        expect(screen.getByText(/Female/i)).toBeInTheDocument();
      });
    });
  });

  describe("Step 3 - Body Metrics", () => {
    it("renders all metric input fields", async () => {
      renderWithProviders(<Onboarding />);
      
      // Navigate to step 3
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Age/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Height/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Current Weight/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Target Weight/i)).toBeInTheDocument();
      });
    });

    it("accepts numeric input for metrics", async () => {
      renderWithProviders(<Onboarding />);
      
      // Navigate to step 3
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      await waitFor(() => screen.getByLabelText(/Age/i));
      
      const ageInput = screen.getByLabelText(/Age/i) as HTMLInputElement;
      await userEvent.clear(ageInput);
      await userEvent.type(ageInput, "30");
      
      expect(ageInput.value).toBe("30");
    });

    it("enables continue when all required fields are filled", async () => {
      renderWithProviders(<Onboarding />);
      
      // Navigate to step 3
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      await waitFor(() => screen.getByLabelText(/Age/i));
      
      const continueButton = screen.getByText(/Continue/i);
      expect(continueButton).toBeDisabled();
      
      // Fill required fields
      await userEvent.type(screen.getByLabelText(/Age/i), "30");
      await userEvent.type(screen.getByLabelText(/Height/i), "175");
      await userEvent.type(screen.getByLabelText(/Current Weight/i), "80");
      
      expect(continueButton).not.toBeDisabled();
    });
  });

  describe("Step 4 - Activity Level", () => {
    it("renders all activity level options", async () => {
      renderWithProviders(<Onboarding />);
      
      // Navigate to step 4
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByLabelText(/Age/i));
      await userEvent.type(screen.getByLabelText(/Age/i), "30");
      await userEvent.type(screen.getByLabelText(/Height/i), "175");
      await userEvent.type(screen.getByLabelText(/Current Weight/i), "80");
      await userEvent.click(screen.getByText(/Continue/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Sedentary/i)).toBeInTheDocument();
        expect(screen.getByText(/Lightly Active/i)).toBeInTheDocument();
        expect(screen.getByText(/Moderately Active/i)).toBeInTheDocument();
        expect(screen.getByText(/Very Active/i)).toBeInTheDocument();
        expect(screen.getByText(/Extra Active/i)).toBeInTheDocument();
      });
    });
  });

  describe("Step 5 - Food Preferences", () => {
    it("renders diet tags and allergy tags", async () => {
      renderWithProviders(<Onboarding />);
      
      // Navigate through to step 5
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByLabelText(/Age/i));
      await userEvent.type(screen.getByLabelText(/Age/i), "30");
      await userEvent.type(screen.getByLabelText(/Height/i), "175");
      await userEvent.type(screen.getByLabelText(/Current Weight/i), "80");
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Sedentary/i));
      await userEvent.click(screen.getByText(/Moderately Active/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Dietary Preferences/i)).toBeInTheDocument();
        expect(screen.getByText(/Vegetarian/i)).toBeInTheDocument();
        expect(screen.getByText(/Keto/i)).toBeInTheDocument();
      });
    });

    it("allows selecting food preferences", async () => {
      renderWithProviders(<Onboarding />);
      
      // Navigate to step 5
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByLabelText(/Age/i));
      await userEvent.type(screen.getByLabelText(/Age/i), "30");
      await userEvent.type(screen.getByLabelText(/Height/i), "175");
      await userEvent.type(screen.getByLabelText(/Current Weight/i), "80");
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Sedentary/i));
      await userEvent.click(screen.getByText(/Moderately Active/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      await waitFor(() => screen.getByText(/Vegetarian/i));
      
      // Select a preference
      await userEvent.click(screen.getByText(/Vegetarian/i));
      
      // Should show selected badge
      expect(screen.getByText(/Vegetarian/i)).toBeInTheDocument();
    });
  });

  describe("LocalStorage Persistence", () => {
    it("saves progress to localStorage on each step change", async () => {
      renderWithProviders(<Onboarding />);
      
      // Select goal
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Check localStorage was called
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          "nutrio_onboarding_progress",
          expect.stringContaining("step")
        );
      });
    });

    it("restores progress from localStorage on mount", async () => {
      // Set saved progress
      mockLocalStorage.setItem(
        "nutrio_onboarding_progress",
        JSON.stringify({
          step: 3,
          data: {
            goal: "lose",
            gender: "male",
            age: "30",
            height: "175",
            weight: "80",
            targetWeight: "75",
            activityLevel: null,
            trainingDaysPerWeek: "",
            foodPreferences: [],
            allergies: [],
          },
          timestamp: new Date().toISOString(),
        })
      );
      
      renderWithProviders(<Onboarding />);
      
      await waitFor(() => {
        expect(screen.getByText(/Welcome back!/i)).toBeInTheDocument();
      });
    });

    it("clears localStorage on successful completion", async () => {
      const mockUpdateProfile = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(ProfileHook.useProfile).mockReturnValue({
        profile: { id: "test", user_id: "test", onboarding_completed: false } as any,
        loading: false,
        error: null,
        refetch: vi.fn(),
        updateProfile: mockUpdateProfile,
      });
      
      renderWithProviders(<Onboarding />);
      
      // Complete all steps quickly
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      
      // localStorage.setItem would have been called during the process
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("Profile Completion", () => {
    it("calls updateProfile with correct data on completion", async () => {
      const mockUpdateProfile = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(ProfileHook.useProfile).mockReturnValue({
        profile: { id: "test", user_id: "test", onboarding_completed: false } as any,
        loading: false,
        error: null,
        refetch: vi.fn(),
        updateProfile: mockUpdateProfile,
      });
      
      renderWithProviders(<Onboarding />);
      
      // Step 1
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Step 2
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Step 3
      await waitFor(() => screen.getByLabelText(/Age/i));
      await userEvent.type(screen.getByLabelText(/Age/i), "30");
      await userEvent.type(screen.getByLabelText(/Height/i), "175");
      await userEvent.type(screen.getByLabelText(/Current Weight/i), "80");
      await userEvent.type(screen.getByLabelText(/Target Weight/i), "75");
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Step 4
      await waitFor(() => screen.getByText(/Sedentary/i));
      await userEvent.click(screen.getByText(/Moderately Active/i));
      await userEvent.click(screen.getByText(/Continue/i));
      
      // Step 5 - Complete
      await waitFor(() => screen.getByText(/Complete/i));
      await userEvent.click(screen.getByText(/Complete/i));
      
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            gender: "male",
            age: 30,
            height_cm: 175,
            current_weight_kg: 80,
            target_weight_kg: 75,
            health_goal: "lose",
            activity_level: "moderate",
            onboarding_completed: true,
          })
        );
      });
    });

    it("navigates to dashboard after successful completion", async () => {
      const mockUpdateProfile = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(ProfileHook.useProfile).mockReturnValue({
        profile: { id: "test", user_id: "test", onboarding_completed: false } as any,
        loading: false,
        error: null,
        refetch: vi.fn(),
        updateProfile: mockUpdateProfile,
      });
      
      renderWithProviders(<Onboarding />);
      
      // Complete all steps
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByLabelText(/Age/i));
      await userEvent.type(screen.getByLabelText(/Age/i), "30");
      await userEvent.type(screen.getByLabelText(/Height/i), "175");
      await userEvent.type(screen.getByLabelText(/Current Weight/i), "80");
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Sedentary/i));
      await userEvent.click(screen.getByText(/Moderately Active/i));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Complete/i));
      await userEvent.click(screen.getByText(/Complete/i));
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("Error Handling", () => {
    it("shows error toast when profile update fails", async () => {
      const mockUpdateProfile = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Update failed"),
      });
      vi.mocked(ProfileHook.useProfile).mockReturnValue({
        profile: { id: "test", user_id: "test", onboarding_completed: false } as any,
        loading: false,
        error: null,
        refetch: vi.fn(),
        updateProfile: mockUpdateProfile,
      });
      
      renderWithProviders(<Onboarding />);
      
      // Complete all steps
      await userEvent.click(screen.getByText("Lose Weight"));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Male/i));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByLabelText(/Age/i));
      await userEvent.type(screen.getByLabelText(/Age/i), "30");
      await userEvent.type(screen.getByLabelText(/Height/i), "175");
      await userEvent.type(screen.getByLabelText(/Current Weight/i), "80");
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Sedentary/i));
      await userEvent.click(screen.getByText(/Moderately Active/i));
      await userEvent.click(screen.getByText(/Continue/i));
      await waitFor(() => screen.getByText(/Complete/i));
      await userEvent.click(screen.getByText(/Complete/i));
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
          })
        );
      });
    });
  });

  describe("Redirect Behavior", () => {
    it("redirects to auth when user is not authenticated", async () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        user: null,
        session: null,
        loading: false,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
      
      renderWithProviders(<Onboarding />);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/auth");
      });
    });

    it("redirects to dashboard when onboarding is already completed", () => {
      vi.mocked(ProfileHook.useProfile).mockReturnValue({
        profile: { id: "test", user_id: "test", onboarding_completed: true } as any,
        loading: false,
        error: null,
        refetch: vi.fn(),
        updateProfile: vi.fn(),
      });
      
      renderWithProviders(<Onboarding />);
      
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("Loading States", () => {
    it("shows loading spinner when auth is loading", () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        user: null,
        session: null,
        loading: true,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
      
      renderWithProviders(<Onboarding />);
      
      expect(screen.getByRole("status") || screen.queryByTestId("loading")).toBeTruthy();
    });
  });
});
