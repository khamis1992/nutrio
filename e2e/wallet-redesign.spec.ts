import { expect, test } from "@playwright/test";

import { appUrl } from "./config";
import { loginAsCustomer } from "./utils/helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("wallet presents real balance, top-up packages, and activity at mobile size", async ({ page }) => {
  test.skip(!process.env.E2E_CUSTOMER_EMAIL || !process.env.E2E_CUSTOMER_PASSWORD, "Customer credentials are required");

  await loginAsCustomer(page);
  await page.goto(appUrl("/wallet"));

  await expect(page.getByText("Available Balance", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a top-up" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide wallet balance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Meals" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invoices" })).toBeVisible();

  const packageButtons = page.locator("button").filter({ hasText: "Added to wallet" });
  await expect(packageButtons.first()).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/wallet-redesign-390.png", fullPage: true });

  await packageButtons.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue to SADAD/ })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/wallet-confirmation-390.png", fullPage: true });
  await page.getByRole("button", { name: "Cancel" }).last().click();

  await page.getByRole("button", { name: /Activity/ }).click();
  await expect(page.getByText("Every top-up, purchase, and refund")).toBeVisible();
  await expect(page.getByRole("button", { name: "Money in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Spent" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/wallet-activity-390.png", fullPage: true });
});
