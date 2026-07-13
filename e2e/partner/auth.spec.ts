import { expect, test } from "../fixtures/test";
import { appUrl } from "../config";

test.describe("Partner authorization", () => {
  test("the partner authentication page is available", async ({ page }) => {
    await page.goto(appUrl("/partner/auth"));

    await expect(page).toHaveURL(/\/partner\/auth(?:[/?#]|$)/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("a signed-out user is redirected to partner authentication", async ({
    page,
  }) => {
    await page.goto(appUrl("/partner"));

    await expect(page).toHaveURL(/\/partner\/auth(?:[/?#]|$)/);
  });

  test("an authenticated partner can open the partner portal", async ({
    authenticatedPartnerPage,
  }) => {
    await authenticatedPartnerPage.goto(appUrl("/partner"));

    await expect(authenticatedPartnerPage).toHaveURL(
      /\/partner(?:\/pending-approval)?(?:[/?#]|$)/,
    );
    await expect(authenticatedPartnerPage.locator("body")).toBeVisible();
  });

  test("a customer cannot open the partner portal", async ({
    authenticatedCustomerPage,
  }) => {
    await authenticatedCustomerPage.goto(appUrl("/partner"));

    await expect(authenticatedCustomerPage).not.toHaveURL(
      /\/partner(?:[/?#]|$)/,
    );
    await expect(authenticatedCustomerPage).toHaveURL(
      /\/(?:dashboard|auth)(?:[/?#]|$)/,
    );
  });
});
