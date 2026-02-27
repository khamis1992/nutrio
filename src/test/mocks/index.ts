/**
 * Shared mocks for testing
 * Import these in your test files to mock common dependencies
 */

import { vi } from "vitest";

// Mock User
export const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
  },
};

// Mock Profile
export const mockProfile = {
  id: "test-profile-id",
  user_id: "test-user-id",
  full_name: "Test User",
  avatar_url: null,
  gender: "male" as const,
  age: 30,
  height_cm: 175,
  current_weight_kg: 75,
  target_weight_kg: 70,
  health_goal: "lose" as const,
  activity_level: "moderate" as const,
  daily_calorie_target: 2000,
  protein_target_g: 150,
  carbs_target_g: 200,
  fat_target_g: 65,
  onboarding_completed: false,
  referral_code: "TEST123",
  referral_rewards_earned: 0,
  referred_by: null,
  affiliate_balance: 0,
  total_affiliate_earnings: 0,
  affiliate_tier: null,
  streak_days: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock Diet Tags
export const mockDietTags = [
  { id: "1", name: "Vegetarian", description: "No meat", category: "diet" as const },
  { id: "2", name: "Vegan", description: "No animal products", category: "diet" as const },
  { id: "3", name: "Gluten Free", description: "No gluten", category: "allergy" as const },
  { id: "4", name: "Dairy Free", description: "No dairy", category: "allergy" as const },
];

// Mock Supabase Client
export const createMockSupabaseClient = () => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signUp: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signIn: vi.fn().mockResolvedValue({ data: { session: { user: mockUser } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
});

// Mock Auth Context
export const createMockAuthContext = (overrides = {}) => ({
  user: mockUser,
  session: null,
  loading: false,
  signUp: vi.fn().mockResolvedValue({ error: null }),
  signIn: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// Mock Profile Hook
export const createMockProfileHook = (overrides = {}) => ({
  profile: mockProfile,
  loading: false,
  error: null,
  refetch: vi.fn(),
  updateProfile: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
  ...overrides,
});

// Mock Diet Tags Hook
export const createMockDietTagsHook = (overrides = {}) => ({
  dietTags: mockDietTags.filter(t => t.category !== "allergy"),
  allergyTags: mockDietTags.filter(t => t.category === "allergy"),
  loading: false,
  ...overrides,
});

// Mock Toast Hook
export const createMockToast = () => ({
  toast: vi.fn(),
  dismiss: vi.fn(),
  toasts: [],
});

// Mock Navigate
export const mockNavigate = vi.fn();

// Mock LocalStorage
export const createMockLocalStorage = (initialData: Record<string, string> = {}) => {
  const storage = { ...initialData };
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    }),
  };
};

// Setup all mocks
export const setupCommonMocks = () => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Mock window.location
  Object.defineProperty(window, "location", {
    writable: true,
    value: { origin: "http://localhost:8080" },
  });
  
  // Mock window.scrollTo
  window.scrollTo = vi.fn();
};
