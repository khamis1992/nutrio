// Mock Service Worker setup for API mocking
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const handlers = [
  // Mock Supabase auth endpoints
  http.post("https://test.supabase.co/auth/v1/token", () => {
    return HttpResponse.json({
      access_token: "mock-token",
      user: { id: "test-user-id", email: "test@example.com" },
    });
  }),

  // Mock Supabase database endpoints
  http.get("https://test.supabase.co/rest/v1/*", () => {
    return HttpResponse.json([]);
  }),

  http.post("https://test.supabase.co/rest/v1/*", () => {
    return HttpResponse.json({ id: "test-id" });
  }),
];

export const server = setupServer(...handlers);
