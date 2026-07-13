import { expect, test } from "../fixtures/test";
import { appUrl } from "../config";

test.describe("Driver authorization", () => {
  test("the driver authentication page is available", async ({ page }) => {
    await page.goto(appUrl("/driver/auth"));

    await expect(page).toHaveURL(/\/driver\/auth(?:[/?#]|$)/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("a signed-out user is redirected to driver authentication", async ({
    page,
  }) => {
    await page.goto(appUrl("/driver"));

    await expect(page).toHaveURL(/\/driver\/auth(?:[/?#]|$)/);
  });

  test("an authenticated driver can open the driver portal", async ({
    authenticatedDriverPage,
  }) => {
    await authenticatedDriverPage.goto(appUrl("/driver"));

    await expect(authenticatedDriverPage).toHaveURL(/\/driver(?:[/?#]|$)/);
    await expect(authenticatedDriverPage.locator("body")).toBeVisible();
  });

  test("a customer cannot open the driver portal", async ({
    authenticatedCustomerPage,
  }) => {
    await authenticatedCustomerPage.goto(appUrl("/driver"));

    await expect(authenticatedCustomerPage).not.toHaveURL(
      /\/driver(?:[/?#]|$)/,
    );
    await expect(authenticatedCustomerPage).toHaveURL(
      /\/(?:dashboard|auth)(?:[/?#]|$)/,
    );
  });
});
