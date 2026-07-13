import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "../e2e/config";
import {
  loginAsAdmin,
  loginAsCustomer,
  loginAsDriver,
  loginAsPartner,
} from "../e2e/utils/helpers";

interface PortalSmokeConfig {
  name: string;
  login: (page: Page) => Promise<void>;
  paths: string[];
}

const portals: PortalSmokeConfig[] = [
  {
    name: "customer",
    login: loginAsCustomer,
    paths: [
      "/dashboard",
      "/meals",
      "/schedule",
      "/orders",
      "/tracker",
      "/subscription",
      "/wallet",
      "/profile",
    ],
  },
  {
    name: "partner",
    login: loginAsPartner,
    paths: [
      "/partner",
      "/partner/menu",
      "/partner/orders",
      "/partner/analytics",
      "/partner/payouts",
      "/partner/settings",
    ],
  },
  {
    name: "admin",
    login: loginAsAdmin,
    paths: [
      "/admin",
      "/admin/restaurants",
      "/admin/users",
      "/admin/orders",
      "/admin/subscriptions",
      "/admin/payouts",
      "/admin/settings",
    ],
  },
  {
    name: "driver",
    login: loginAsDriver,
    paths: [
      "/driver",
      "/driver/orders",
      "/driver/history",
      "/driver/earnings",
      "/driver/profile",
    ],
  },
];

for (const portal of portals) {
  test.describe(`${portal.name} portal route smoke tests`, () => {
    test.beforeEach(async ({ page }) => {
      await portal.login(page);
    });

    for (const path of portal.paths) {
      test(`${path} renders without an uncaught page error`, async ({ page }) => {
        const pageErrors: Error[] = [];
        page.on("pageerror", (error) => pageErrors.push(error));

        const response = await page.goto(appUrl(path));
        await page.waitForLoadState("domcontentloaded");

        expect(response?.status()).toBeLessThan(500);
        await expect(page.locator("body")).toBeVisible();
        expect(pageErrors).toEqual([]);
      });
    }
  });
}
