import { expect, test } from "@playwright/test";

import { appUrl } from "./config";
import { loginAsCoach, loginAsCustomer } from "./utils/helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("customer sees only coach-assigned exercises in coach programs", async ({ page }) => {
  test.skip(!process.env.E2E_CUSTOMER_EMAIL || !process.env.E2E_CUSTOMER_PASSWORD, "Customer credentials are required");

  await loginAsCustomer(page);
  await page.goto(appUrl("/dashboard/activity"));
  await expect(page.getByText("Nutrio movement library")).toHaveCount(0);

  await page.goto(appUrl("/coach-programs"));
  await expect(page.getByRole("heading", { name: "My coach plan" })).toBeVisible();
  await page.getByRole("button", { name: /Exercises/ }).click();
  await expect(page.getByText("Your movement library")).toBeVisible();
  await expect(page.getByText("Selected by your coach")).toBeVisible();
  await expect(page.getByText("3/4 Sit-up")).toBeVisible();
  await expect(page.locator('img[src*=".gif"]').first()).toBeVisible();
  await page.getByRole("button", { name: /View 3\/4 Sit-up|Preview 3\/4 Sit-up/ }).first().click();
  await expect(page.getByText("How to perform")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await page.screenshot({ path: "test-results/coach-programs-exercises-390.png", fullPage: true });

  let scheduleRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/rpc/schedule_meals_atomic")) scheduleRequests += 1;
  });
  await page.getByRole("button", { name: /Meals/ }).click();
  const activatePlan = page.getByRole("button", { name: /Activate plan/ }).first();
  await expect(activatePlan).toBeVisible();
  await activatePlan.click();
  await expect(page).toHaveURL(/\/subscription$/);
  expect(scheduleRequests).toBe(0);
});

test("customer sees the redesigned guided workout with real movement details", async ({ page }) => {
  test.skip(!process.env.E2E_CUSTOMER_EMAIL || !process.env.E2E_CUSTOMER_PASSWORD, "Customer credentials are required");

  await loginAsCustomer(page);
  await page.goto(appUrl("/coach-programs/workout/b2fdda47-3203-4497-bbc9-977786f96889/day/1"));

  await expect(page.getByRole("heading", { name: "Day 1 workout" })).toBeVisible();
  await expect(page.getByText("3/4 Sit-up")).toBeVisible();
  await expect(page.getByText("45° Side Bend")).toBeVisible();
  await expect(page.locator('img[src*=".gif"]')).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Start workout" })).toBeVisible();

  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/guided-workout-preview-390.png", fullPage: true });

  await page.getByRole("button", { name: "View instructions" }).first().click();
  await expect(page.getByText("How to perform")).toBeVisible();
  await expect(page.locator('img[src*=".gif"]').last()).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/guided-workout-instructions-390.png", fullPage: true });
});

test("coach can browse the programming library", async ({ page }) => {
  test.skip(!process.env.E2E_COACH_EMAIL || !process.env.E2E_COACH_PASSWORD, "Coach credentials are required");

  await loginAsCoach(page);
  await expect(page.getByText("Browse 1,324 exercises")).toBeVisible();
  await page.getByText("Browse 1,324 exercises").click();
  await expect(page.getByRole("heading", { name: "Programming library" })).toBeVisible();

  const search = page.getByPlaceholder("Search 1,324 exercises");
  await search.fill("bodyweight squat");
  await expect(page.getByText(/bodyweight squat/i).first()).toBeVisible();
  await expect(page.locator('img[src*=".gif"]').first()).toBeVisible();
  await page.waitForTimeout(600);

  await page.screenshot({ path: "test-results/exercise-library-coach-390.png", fullPage: true });
});

test("coach client workspace is light, scrollable, and exposes workout creation", async ({ page }) => {
  test.skip(!process.env.E2E_COACH_EMAIL || !process.env.E2E_COACH_PASSWORD, "Coach credentials are required");

  await loginAsCoach(page);
  await page.goto(appUrl("/coach/client/bf1ed066-936c-4504-8aa4-5b03af5f6605"));
  await expect(page.getByText("Athlete profile")).toBeVisible();

  const hero = page.getByText("Athlete profile").locator("xpath=ancestor::section[1]");
  await expect(hero).toHaveCSS("background-color", "rgb(255, 255, 255)");

  const scroller = page.locator("main");
  const scrollMetrics = await scroller.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await scroller.evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "test-results/coach-client-overview-390.png", fullPage: true });

  await page.getByRole("button", { name: "Plans" }).click();
  await page.getByRole("button", { name: /Workouts/ }).click();
  await expect(page.getByRole("button", { name: "Create Workout Plan" })).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/coach-client-plans-390.png", fullPage: true });
});
