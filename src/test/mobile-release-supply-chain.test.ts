import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readRepositoryFile(path: string) {
  return readFileSync(resolve(path), "utf8");
}

function expectPinnedActions(workflow: string) {
  const actionReferences = [...workflow.matchAll(/^\s*uses:\s*[^\s]+@([^\s#]+)/gm)].map(
    ([, reference]) => reference,
  );

  expect(actionReferences.length).toBeGreaterThan(0);
  for (const reference of actionReferences) {
    expect(reference).toMatch(/^[a-f0-9]{40}$/);
  }
}

describe("mobile release supply-chain controls", () => {
  it("fails closed unless Android artifacts are signed, identified, and checksummed", () => {
    const workflow = readRepositoryFile(".github/workflows/build-android-release.yml");

    expect(workflow).toContain("environment: Mobile Signing");
    expect(workflow).toContain('$GITHUB_SHA" != "$(git rev-parse origin/main)');
    expect(workflow).toContain("npm audit --audit-level=high");
    expect(workflow).toContain("--dependency-verification=strict");
    expect(workflow).toContain("apksigner");
    expect(workflow).toContain("jarsigner -verify");
    expect(workflow).toContain("APK signer mismatch");
    expect(workflow).toContain("AAB signer mismatch");
    expect(workflow).toContain("SHA256SUMS");
    expect(workflow).not.toContain("continue-on-error: true");
    expect(workflow.match(/if-no-files-found:\s*error/g)).toHaveLength(3);
    expectPinnedActions(workflow);
  });

  it("pins the Gradle wrapper and verifies resolved dependency artifacts", () => {
    const wrapper = readRepositoryFile("android/gradle/wrapper/gradle-wrapper.properties");
    const metadata = readRepositoryFile("android/gradle/verification-metadata.xml");

    expect(wrapper).toContain("gradle-8.14.3-all.zip");
    expect(wrapper).toContain(
      "distributionSha256Sum=ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c",
    );
    expect(metadata).toContain("<verify-metadata>true</verify-metadata>");
    expect(metadata).toContain("<sha256 value=");
    expect(metadata.match(/<component /g)?.length ?? 0).toBeGreaterThan(200);
  });

  it("revalidates exact current main immediately before iOS signing secrets", () => {
    const workflow = readRepositoryFile(".github/workflows/build-ios.yml");
    const revalidationIndex = workflow.indexOf("Revalidate release commit before signing");
    const signingImportIndex = workflow.indexOf("Import Apple signing assets");

    expect(workflow).toContain("environment: Mobile Signing");
    expect(workflow.match(/\$GITHUB_SHA" != "\$\(git rev-parse origin\/main\)/g)).toHaveLength(2);
    expect(revalidationIndex).toBeGreaterThan(0);
    expect(signingImportIndex).toBeGreaterThan(revalidationIndex);
    expect(workflow.slice(revalidationIndex, signingImportIndex)).not.toMatch(/secrets\./);
    expect(workflow).toContain("npm audit --audit-level=high");
    expect(workflow).toContain("if-no-files-found: error");
    expectPinnedActions(workflow);
  });
});
