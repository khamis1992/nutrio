import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type TestRole =
  | "customer"
  | "admin"
  | "partner"
  | "driver"
  | "fleet"
  | "coach";

function loadEnvFile(fileName: string): void {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

for (const fileName of [".env.e2e", ".env.local", ".env"]) {
  loadEnvFile(fileName);
}

export const TEST_BASE_URL = (
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BASE_URL ||
  "http://127.0.0.1:5173/nutrio"
).replace(/\/+$/, "");

export function appUrl(path = ""): string {
  const normalizedPath = path.replace(/^\/+/, "");
  return normalizedPath ? `${TEST_BASE_URL}/${normalizedPath}` : TEST_BASE_URL;
}

const ROLE_ENV_KEYS: Record<TestRole, { email: string; password: string }> = {
  customer: { email: "E2E_CUSTOMER_EMAIL", password: "E2E_CUSTOMER_PASSWORD" },
  admin: { email: "E2E_ADMIN_EMAIL", password: "E2E_ADMIN_PASSWORD" },
  partner: { email: "E2E_PARTNER_EMAIL", password: "E2E_PARTNER_PASSWORD" },
  driver: { email: "E2E_DRIVER_EMAIL", password: "E2E_DRIVER_PASSWORD" },
  fleet: { email: "E2E_FLEET_EMAIL", password: "E2E_FLEET_PASSWORD" },
  coach: { email: "E2E_COACH_EMAIL", password: "E2E_COACH_PASSWORD" },
};

export function getTestUser(role: TestRole): { email: string; password: string } {
  const keys = ROLE_ENV_KEYS[role];
  const email = process.env[keys.email]?.trim();
  const password = process.env[keys.password];

  if (!email || !password) {
    throw new Error(
      `Missing ${role} E2E credentials. Configure ${keys.email} and ${keys.password} in the test environment, or create .env.e2e from .env.e2e.example.`,
    );
  }

  return { email, password };
}

export function hasTestUser(role: TestRole): boolean {
  const keys = ROLE_ENV_KEYS[role];
  return Boolean(process.env[keys.email]?.trim() && process.env[keys.password]);
}

export function hasAdminTotpSecret(): boolean {
  return Boolean(process.env.E2E_ADMIN_TOTP_SECRET?.trim());
}
