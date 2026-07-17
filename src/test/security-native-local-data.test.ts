import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("native and shared-device local data security", () => {
  it("purges the legacy biometric password record without reading it", () => {
    const capacitorSource = readRepoFile("src/lib/capacitor.ts");
    const authPageSource = readRepoFile("src/pages/auth/useAuthPage.ts");

    expect(capacitorSource).toContain("purgeLegacyCredentials");
    expect(capacitorSource).toContain("server: 'com.nutriofuel.app'");
    expect(capacitorSource).not.toMatch(
      /biometricAuth\s*=\s*\{[\s\S]*?(?:setCredentials|getCredentials)\s*:/,
    );
    expect(authPageSource).not.toContain("credentials.password");
    expect(authPageSource).not.toMatch(
      /setCredentials\s*\(\s*values\.email\s*,\s*values\.password\s*\)/,
    );
  });

  it("namespaces onboarding health drafts by the signed-in user", () => {
    const onboardingSource = readRepoFile("src/pages/Onboarding.tsx");

    expect(onboardingSource).toContain(
      "`${LEGACY_ONBOARDING_STORAGE_KEY}:${userId}`",
    );
    expect(onboardingSource).toContain(
      "`${LEGACY_AUTOSAVE_KEY}:${userId}`",
    );
    expect(onboardingSource).toContain(
      "localStorage.removeItem(LEGACY_ONBOARDING_STORAGE_KEY)",
    );
    expect(onboardingSource).toContain(
      "localStorage.removeItem(LEGACY_AUTOSAVE_KEY)",
    );
  });

  it("isolates local nutrition caches by user and clears ephemeral data on sign out", () => {
    const recipes = readRepoFile("src/lib/recipeStore.ts");
    const steps = readRepoFile("src/lib/stepStore.ts");
    const templates = readRepoFile("src/lib/schedule-templates.ts");
    const auth = readRepoFile("src/contexts/AuthContext.tsx");

    expect(recipes).toContain("nutrio:recipes:v2:");
    expect(steps).toContain("nutrio:step-data:v2:");
    expect(templates).toContain("nutrio:schedule-templates:v2:");
    expect(recipes).toContain("localStorage.removeItem(LEGACY_STORAGE_KEY)");
    expect(steps).toContain("localStorage.removeItem(LEGACY_STORAGE_KEY)");
    expect(auth).toContain("clearOfflineMutationsForUser(signingOutUserId)");
    expect(auth).toContain("clearCachedHealthData(signingOutUserId)");
    expect(auth).toContain("deactivateForUser(signingOutUserId)");
  });
});
