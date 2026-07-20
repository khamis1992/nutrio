import { expect, type Locator, type Page } from "@playwright/test";

import { appUrl } from "../config";
import { test } from "../fixtures/test";

const PHASE_ONE_FLAGS = [
  "phase1-consumption-lifecycle",
  "phase1-micronutrients",
  "phase1-ranking-v2",
  "phase1-wearable-normalization",
  "phase1-outdoor-recording",
  "phase1-training-enhancements",
  "phase1-cooperative-challenges",
  "phase1-health-context",
];

const PHASE_ONE_SURFACES = [
  "/schedule",
  "/progress",
  "/recommendations",
  "/log-activity",
  "/outdoor-activity",
  "/workout-history",
  "/rewards",
  "/profile",
];

const localeCases = [
  { language: "en", direction: "ltr", width: 360 },
  { language: "ar", direction: "rtl", width: 390 },
] as const;

async function configurePhaseOne(page: Page, language: "en" | "ar") {
  await page.evaluate(
    ({ flags, locale }) => {
      localStorage.setItem("nutrio_language", locale);
      localStorage.setItem("nutrio_phase_one_flags", JSON.stringify(flags));
    },
    { flags: PHASE_ONE_FLAGS, locale: language },
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual(expect.objectContaining({ clientWidth: page.viewportSize()?.width }));

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectSemanticPage(page: Page, direction: "ltr" | "rtl") {
  await expect(page.locator("html")).toHaveAttribute("dir", direction);
  await expect(page.locator("html")).toHaveAttribute("lang", direction === "rtl" ? "ar" : "en");
  await expect.soft(page.locator("main").first(), "page exposes a main landmark").toBeVisible();
  await expect.soft(page.getByRole("heading").first(), "page exposes a heading").toBeVisible();

  const unnamedInteractiveElements = await page.locator(
    'main button:visible, main a[href]:visible, main input:visible, main select:visible, main textarea:visible',
  ).evaluateAll((elements) => elements.filter((element) => {
    const label = element.getAttribute("aria-label")?.trim();
    const labelledBy = element.getAttribute("aria-labelledby")?.trim();
    const text = element.textContent?.trim();
    const title = element.getAttribute("title")?.trim();
    const input = element as HTMLInputElement;
    return !label && !labelledBy && !text && !title && !input.placeholder;
  }).length);
  expect.soft(unnamedInteractiveElements, "visible controls have an accessible name").toBe(0);
}

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "Expected a visible mobile control").not.toBeNull();
  // Chromium can report a CSS 44px box as 43.99999 at fractional DPRs.
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.99);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.99);
}

test.describe("System - authenticated phase-one mobile", () => {
  test.setTimeout(120_000);

  for (const locale of localeCases) {
    for (const path of PHASE_ONE_SURFACES) {
      test(`${locale.language} ${path} fits ${locale.width}px and exposes semantic controls`, async ({
        authenticatedCustomerPage: page,
      }) => {
        await page.setViewportSize({ width: locale.width, height: 844 });
        await configurePhaseOne(page, locale.language);
        await page.goto(appUrl(path), { waitUntil: "domcontentloaded" });
        await expect(page).not.toHaveURL(/\/auth(?:[/?#]|$)/);
        await expectNoHorizontalOverflow(page);
        await expectSemanticPage(page, locale.direction);

        const firstControl = page.locator("main button:visible, main a[href]:visible").first();
        if (await firstControl.count()) await expectTouchTarget(firstControl);
      });
    }
  }

  test("dashboard stays within the mobile performance budget", async ({ authenticatedCustomerPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await configurePhaseOne(page, "en");

    const startedAt = Date.now();
    await page.goto(appUrl("/dashboard"), { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible();
    const interactiveMs = Date.now() - startedAt;
    const transferredBytes = await page.evaluate(() => performance.getEntriesByType("resource")
      .reduce((total, entry) => total + (entry as PerformanceResourceTiming).transferSize, 0));

    expect(interactiveMs, "authenticated dashboard interactive budget").toBeLessThan(8_000);
    expect(transferredBytes, "dashboard transferred-resource budget").toBeLessThan(8 * 1024 * 1024);
  });

  test("an interrupted outdoor request recovers its private local checkpoint", async ({
    authenticatedCustomerPage: page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await configurePhaseOne(page, "en");
    const userId = await page.evaluate(() => {
      const entries = [...Object.entries(localStorage), ...Object.entries(sessionStorage)];
      for (const [key, rawValue] of entries) {
        if (!key.includes("sb-") || !key.endsWith("-auth-token")) continue;
        const value = JSON.parse(rawValue) as Record<string, unknown> | null;
        const candidate = (value?.currentSession ?? value?.session ?? value) as Record<string, unknown> | null;
        const user = candidate?.user as { id?: string } | undefined;
        if (user?.id) return user.id;
      }
      throw new Error("Authenticated Supabase user was not found in browser storage.");
    });

    await page.evaluate((id) => {
      const now = Date.now();
      localStorage.setItem(`CapacitorStorage.nutrio_outdoor_activity_v1_${id}`, JSON.stringify({
        version: 1,
        localSessionId: "e2e-interrupted-session",
        userId: id,
        activityType: "walking",
        status: "recording",
        startedAt: now - 60_000,
        completedAt: null,
        lastResumedAt: now - 60_000,
        activeElapsedMs: 60_000,
        distanceM: 125,
        elevationGainM: 0,
        points: [],
        autoPauseEnabled: true,
        autoPaused: false,
        lowSpeedSince: null,
        routeVisibility: "private",
        calorieSource: "gps_met_estimate",
        errorMessage: null,
      }));
    }, userId);

    await page.route("**/rest/v1/**", (route) => route.abort("internetdisconnected"));
    await page.goto(appUrl("/outdoor-activity"), { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/auth(?:[/?#]|$)/);
    await expect(page.getByRole("button", { name: /recover/i })).toBeVisible();
    await expect(page.getByText(/0\.13/)).toBeVisible();
    await page.getByRole("button", { name: /recover/i }).click({ timeout: 5_000 });
    // Recovery is intentionally paused so tracking cannot resume in the
    // background without an explicit customer action.
    await expect(page.getByRole("button", { name: /resume/i })).toBeVisible();
  });
});
