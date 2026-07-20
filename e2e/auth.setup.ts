import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup, type Page } from "@playwright/test";
import {
  hasAdminTotpSecret,
  hasTestUser,
  type TestRole,
} from "./config";
import {
  loginAsAdmin,
  loginAsCoach,
  loginAsCustomer,
  loginAsDriver,
  loginAsFleet,
  loginAsPartner,
} from "./utils/helpers";

setup.setTimeout(120000);

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const authDirectory = path.join(currentDirectory, ".auth");
fs.mkdirSync(authDirectory, { recursive: true });

const roleSetups: Array<{
  role: TestRole;
  login: (page: Page) => Promise<void>;
}> = [
  { role: "customer", login: loginAsCustomer },
  { role: "admin", login: loginAsAdmin },
  { role: "partner", login: loginAsPartner },
  { role: "driver", login: loginAsDriver },
  { role: "fleet", login: loginAsFleet },
  { role: "coach", login: loginAsCoach },
];

for (const roleSetup of roleSetups) {
  setup(`authenticate ${roleSetup.role}`, async ({ page }) => {
    setup.skip(
      !hasTestUser(roleSetup.role),
      `Missing ${roleSetup.role} E2E credentials.`,
    );
    setup.skip(
      roleSetup.role === "admin" && !hasAdminTotpSecret(),
      "Missing admin E2E TOTP secret; skipping admin storage state.",
    );
    await roleSetup.login(page);
    await page.context().storageState({
      path: path.join(authDirectory, `${roleSetup.role}.json`),
    });
  });
}
