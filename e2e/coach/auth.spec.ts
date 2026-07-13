import { expect, test } from "../fixtures/test";
import { appUrl } from "../config";

test.describe("Coach authorization", () => {
  test("a signed-out user is redirected to customer authentication", async ({
    page,
  }) => {
    await page.goto(appUrl("/coach"));
    await expect(page).toHaveURL(/\/auth(?:[/?#]|$)/);
  });

  test("an authenticated coach can open the coach portal", async ({
    authenticatedCoachPage,
  }) => {
    await authenticatedCoachPage.goto(appUrl("/coach"));
    await expect(authenticatedCoachPage).toHaveURL(/\/coach(?:[/?#]|$)/);
    await expect(authenticatedCoachPage.locator("body")).toBeVisible();
  });

  test("a customer cannot open the coach portal", async ({
    authenticatedCustomerPage,
  }) => {
    await authenticatedCustomerPage.goto(appUrl("/coach"));
    await expect(authenticatedCustomerPage).not.toHaveURL(
      /\/coach(?:[/?#]|$)/,
    );
  });
});
