import { defineConfig, devices } from "@playwright/test";

import { TEST_BASE_URL } from "./e2e/config";

const isLocalTarget = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(
  TEST_BASE_URL,
);

if (isLocalTarget && process.env.ALLOW_LOCAL_LAUNCH_GATE !== "1") {
  throw new Error(
    "The launch gate requires a deployed PLAYWRIGHT_BASE_URL. Set ALLOW_LOCAL_LAUNCH_GATE=1 only for local pre-deployment verification.",
  );
}

export default defineConfig({
  testDir: "./e2e/launch",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: "line",
  use: {
    baseURL: `${TEST_BASE_URL}/`,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "launch-chromium",
      testIgnore: /session-revocation\.spec\.ts/,
      teardown: "session-revocation",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "session-revocation",
      testMatch: /session-revocation\.spec\.ts/,
    },
  ],
});
