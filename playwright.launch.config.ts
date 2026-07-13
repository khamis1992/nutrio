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
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/launch-results.json" }],
    ["junit", { outputFile: "test-results/launch-results.xml" }],
  ],
  use: {
    baseURL: `${TEST_BASE_URL}/`,
    trace: "on",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "launch-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
