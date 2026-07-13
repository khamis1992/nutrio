import { expect, test } from "../fixtures/test";
import { appUrl } from "../config";

test.describe("Admin authorization", () => {
  test("an authenticated admin can open the admin portal", async ({
    authenticatedAdminPage,
  }) => {
    await authenticatedAdminPage.goto(appUrl("/admin"));

    await expect(authenticatedAdminPage).toHaveURL(/\/admin(?:[/?#]|$)/);
    await expect(authenticatedAdminPage.locator("body")).toBeVisible();
  });

  test("a signed-out user is redirected to customer authentication", async ({
    page,
  }) => {
    await page.goto(appUrl("/admin"));

    await expect(page).toHaveURL(/\/auth(?:[/?#]|$)/);
  });

  test("a customer cannot open the admin portal", async ({
    authenticatedCustomerPage,
  }) => {
    await authenticatedCustomerPage.goto(appUrl("/admin"));

    await expect(authenticatedCustomerPage).not.toHaveURL(
      /\/admin(?:[/?#]|$)/,
    );
    await expect(authenticatedCustomerPage).toHaveURL(
      /\/(?:dashboard|auth)(?:[/?#]|$)/,
    );
  });
});
