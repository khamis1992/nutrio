import { expect, test } from "../fixtures/test";
import { appUrl } from "../config";

test.describe("Fleet authorization", () => {
  test("the fleet authentication page is available", async ({ page }) => {
    await page.goto(appUrl("/fleet/login"));
    await expect(page).toHaveURL(/\/fleet\/login(?:[/?#]|$)/);
  });

  test("a signed-out user is redirected to fleet authentication", async ({
    page,
  }) => {
    await page.goto(appUrl("/fleet"));
    await expect(page).toHaveURL(/\/fleet\/login(?:[/?#]|$)/);
  });

  test("an authenticated fleet manager can open the fleet portal", async ({
    authenticatedFleetPage,
  }) => {
    await authenticatedFleetPage.goto(appUrl("/fleet"));
    await expect(authenticatedFleetPage).toHaveURL(/\/fleet(?:[/?#]|$)/);
    await expect(authenticatedFleetPage.locator("body")).toBeVisible();
  });

  test("a customer cannot open the fleet portal", async ({
    authenticatedCustomerPage,
  }) => {
    await authenticatedCustomerPage.goto(appUrl("/fleet"));
    await expect(authenticatedCustomerPage).not.toHaveURL(
      /\/fleet(?:[/?#]|$)/,
    );
  });
});
