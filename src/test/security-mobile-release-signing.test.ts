import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const androidWorkflow = readRepoFile(
  ".github/workflows/build-android-release.yml",
);
const androidBuild = readRepoFile("android/app/build.gradle");
const iosWorkflow = readRepoFile(".github/workflows/build-ios.yml");

describe("mobile release identity and signing", () => {
  it("derives Android versions from the protected release workflow", () => {
    expect(androidBuild).toContain('System.getenv("NUTRIO_VERSION_CODE")');
    expect(androidBuild).toContain('System.getenv("NUTRIO_VERSION_NAME")');
    expect(androidWorkflow).toContain("NUTRIO_VERSION_CODE=$GITHUB_RUN_NUMBER");
    expect(androidWorkflow).toContain("manifest version-name");
    expect(androidWorkflow).toContain("manifest version-code");
  });

  it("verifies iOS signature, certificate, version, and checksum before publishing", () => {
    expect(iosWorkflow).toContain("IOS_DISTRIBUTION_CERT_SHA256");
    expect(iosWorkflow.match(/codesign --verify --deep --strict/g)?.length).toBeGreaterThanOrEqual(2);
    expect(iosWorkflow).toContain("CFBundleShortVersionString");
    expect(iosWorkflow).toContain("shasum -a 256 --check SHA256SUMS");
    expect(iosWorkflow).toContain("ios-v${{ inputs.release_version }}-${{ github.run_number }}");
    expect(iosWorkflow).not.toContain("tag_name: latest-ios-release");
  });
});
