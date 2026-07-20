import { expect } from "@playwright/test";

import { appUrl } from "../config";
import { test } from "../fixtures/test";

test.describe("System - security and rollback", () => {
  test("protects customer, partner, and driver routes without a session", async ({ page }) => {
    const boundaries = [
      { path: "/dashboard", authPath: /\/auth(?:[/?#]|$)/ },
      { path: "/partner", authPath: /\/partner\/auth(?:[/?#]|$)/ },
      { path: "/driver", authPath: /\/driver\/auth(?:[/?#]|$)/ },
    ];

    for (const boundary of boundaries) {
      await page.goto(appUrl(boundary.path), { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(boundary.authPath);
      await expect(page.locator("main, form").first()).toBeVisible();
    }
  });

  test("does not execute or render an untrusted auth redirect", async ({ page }) => {
    let dialogOpened = false;
    page.on("dialog", async (dialog) => {
      dialogOpened = true;
      await dialog.dismiss();
    });

    const payload = '<script>alert("phase-one-xss")</script>';
    await page.goto(appUrl(`/auth?redirect=${encodeURIComponent(payload)}`), {
      waitUntil: "domcontentloaded",
    });

    expect(dialogOpened).toBe(false);
    await expect(page.locator("script", { hasText: "phase-one-xss" })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(payload);
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("removing the authenticated session revokes protected-route access", async ({
    authenticatedCustomerPage: page,
  }) => {
    await page.goto(appUrl("/profile"), { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/auth(?:[/?#]|$)/);
    await page.getByRole("button", { name: /logout/i }).click();
    await page.waitForURL((url) => /\/nutrio\/?$/.test(url.pathname));
    await page.goto(appUrl("/dashboard"), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth(?:[/?#]|$)/);
  });

  test("phase-one outdoor entry point rolls back to the legacy activity surface", async ({
    authenticatedCustomerPage: page,
  }) => {
    await page.evaluate(() => {
      localStorage.removeItem("nutrio_phase_one_flags");
      localStorage.setItem("nutrio_phase_one_enable_all", "false");
    });
    await page.goto(appUrl("/outdoor-activity"), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/log-activity(?:[/?#]|$)/);

    await page.evaluate(() => localStorage.setItem("nutrio_phase_one_enable_all", "true"));
    await page.goto(appUrl("/outdoor-activity"), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/outdoor-activity(?:[/?#]|$)/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    await page.evaluate(() => {
      localStorage.removeItem("nutrio_phase_one_flags");
      localStorage.setItem("nutrio_phase_one_enable_all", "false");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/log-activity(?:[/?#]|$)/);
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("authenticated markup does not expose the persisted bearer token", async ({
    authenticatedCustomerPage: page,
  }) => {
    await page.goto(appUrl("/profile"), { waitUntil: "domcontentloaded" });
    const accessTokens = await page.evaluate(() => {
      const entries = [...Object.entries(localStorage), ...Object.entries(sessionStorage)];
      for (const [key, rawValue] of entries) {
        if (!key.includes("sb-") || !key.endsWith("-auth-token")) continue;
        const value = JSON.parse(rawValue) as Record<string, unknown> | null;
        const candidate = (value?.currentSession ?? value?.session ?? value) as Record<string, unknown> | null;
        if (typeof candidate?.access_token === "string") return [candidate.access_token];
      }
      return [];
    });

    const markup = await page.locator("html").innerHTML();
    for (const accessToken of accessTokens) expect(markup).not.toContain(accessToken);
    expect(markup).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
    await expect(page.locator('[href^="javascript:"], [src^="javascript:"]')).toHaveCount(0);
  });
});
