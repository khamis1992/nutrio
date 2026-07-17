import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SUPABASE_ORIGIN = "https://loepcagitrijlfksawfm.supabase.co";
const SUPABASE_WS_ORIGIN = "wss://loepcagitrijlfksawfm.supabase.co";
const SUPABASE_CLI_SHA256 =
  "36d87b7fe6b4bcfe89ac47a4354e526cff22480224de426d7b370f6934556976";
const CAPACITOR_SWIFT_REVISION =
  "596259033e94829dffc552a40e7129262122995e";

function readRepositoryFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function cspDirective(policy: string, name: string) {
  const directive = policy
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry === name || entry.startsWith(`${name} `));

  return directive?.split(/\s+/).slice(1) ?? [];
}

function htmlCsp() {
  const html = readRepositoryFile("index.html");
  const match = html.match(
    /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/,
  );
  expect(match).not.toBeNull();
  return match?.[1] ?? "";
}

function vercelCsp() {
  const config = JSON.parse(readRepositoryFile("vercel.json")) as {
    headers: Array<{
      headers: Array<{ key: string; value: string }>;
    }>;
  };
  const policy = config.headers
    .flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;
  expect(policy).toBeTruthy();
  return policy ?? "";
}

function expectPinnedActions(workflow: string) {
  const references = [
    ...workflow.matchAll(/^\s*uses:\s*[^\s]+@([^\s#]+)/gm),
  ].map(([, reference]) => reference);

  expect(references.length).toBeGreaterThan(0);
  for (const reference of references) {
    expect(reference).toMatch(/^[a-f0-9]{40}$/);
  }
}

function expectVerifiedSupabaseCli(workflow: string) {
  expect(workflow).toContain("SUPABASE_CLI_VERSION: '2.109.1'");
  expect(workflow).toContain(`SUPABASE_CLI_SHA256: '${SUPABASE_CLI_SHA256}'`);
  expect(workflow).toContain(
    "supabase_${SUPABASE_CLI_VERSION}_linux_amd64.tar.gz",
  );
  expect(workflow).not.toContain("supabase/setup-cli@");
  expect(workflow).not.toMatch(/npm install[^\n]*supabase/);

  const checksumIndex = workflow.indexOf("sha256sum --check --strict");
  const extractionIndex = workflow.indexOf("tar --extract --gzip");
  const versionCheckIndex = workflow.indexOf("--version)");
  expect(checksumIndex).toBeGreaterThan(0);
  expect(extractionIndex).toBeGreaterThan(checksumIndex);
  expect(versionCheckIndex).toBeGreaterThan(extractionIndex);
}

describe("CSP and supply-chain release controls", () => {
  it("keeps executable CSP sources self-only and uses an explicit egress allowlist", () => {
    const expectedConnectSources = [
      "'self'",
      SUPABASE_ORIGIN,
      SUPABASE_WS_ORIGIN,
      "https://us.i.posthog.com",
      "https://api.mapbox.com",
      "https://events.mapbox.com",
      "https://www.googleapis.com",
      "https://nominatim.openstreetmap.org",
    ];

    for (const policy of [htmlCsp(), vercelCsp()]) {
      expect(cspDirective(policy, "script-src")).toEqual(["'self'"]);
      expect(cspDirective(policy, "script-src")).not.toEqual(
        expect.arrayContaining(["'unsafe-inline'", "'unsafe-eval'", "blob:"]),
      );
      expect(cspDirective(policy, "object-src")).toEqual(["'none'"]);
      expect(cspDirective(policy, "frame-src")).toEqual([
        "https://www.openstreetmap.org",
      ]);
      expect(cspDirective(policy, "connect-src")).toEqual(
        expectedConnectSources,
      );
      expect(
        cspDirective(policy, "connect-src").some((source) => source.includes("*")),
      ).toBe(false);
    }

    expect(cspDirective(vercelCsp(), "frame-ancestors")).toEqual(["'none'"]);
    expect(cspDirective(htmlCsp(), "frame-ancestors")).toEqual([]);
  });

  it("binds the development server to loopback unless explicitly overridden", () => {
    const viteConfig = readRepositoryFile("vite.config.ts");
    expect(viteConfig).toContain(
      "host: process.env.VITE_DEV_HOST?.trim() || '127.0.0.1'",
    );
    expect(viteConfig).not.toContain("host: true");
  });

  it("locks Capacitor SwiftPM to the official 8.0.0 revision", () => {
    const lock = JSON.parse(
      readRepositoryFile(
        "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
      ),
    ) as {
      pins: Array<{
        identity: string;
        location: string;
        state: { revision: string; version: string };
      }>;
    };
    const workflow = readRepositoryFile(".github/workflows/build-ios.yml");
    const pin = lock.pins.find((entry) => entry.identity === "capacitor-swift-pm");

    expect(pin).toEqual({
      identity: "capacitor-swift-pm",
      kind: "remoteSourceControl",
      location: "https://github.com/ionic-team/capacitor-swift-pm.git",
      state: {
        revision: CAPACITOR_SWIFT_REVISION,
        version: "8.0.0",
      },
    });
    expect(workflow.match(/-disableAutomaticPackageResolution/g)).toHaveLength(2);
    expect(workflow.match(/Verify locked Swift package revision/g)).toHaveLength(2);
    expect(workflow).toContain(CAPACITOR_SWIFT_REVISION);
  });

  it("verifies the Supabase CLI archive before extraction or execution", () => {
    expectVerifiedSupabaseCli(
      readRepositoryFile(".github/workflows/database-migration.yml"),
    );
    expectVerifiedSupabaseCli(
      readRepositoryFile(".github/workflows/deploy-edge-functions.yml"),
    );
  });

  it("audits npm signatures before package lifecycle scripts run", () => {
    const iosWorkflow = readRepositoryFile(".github/workflows/build-ios.yml");
    const androidWorkflow = readRepositoryFile(
      ".github/workflows/build-android-release.yml",
    );
    const securityWorkflow = readRepositoryFile(
      ".github/workflows/supply-chain-security.yml",
    );

    expect(iosWorkflow.match(/npm ci --ignore-scripts/g)).toHaveLength(2);
    expect(iosWorkflow.match(/npm audit signatures/g)).toHaveLength(2);
    for (const workflow of [androidWorkflow, securityWorkflow]) {
      expect(workflow).toContain("npm ci --ignore-scripts");
      expect(workflow.indexOf("npm audit signatures")).toBeGreaterThan(
        workflow.indexOf("npm ci --ignore-scripts"),
      );
      expect(workflow.indexOf("npm rebuild")).toBeGreaterThan(
        workflow.indexOf("npm audit signatures"),
      );
      expectPinnedActions(workflow);
    }
  });

  it("blocks Android signing until Gradle publisher trust is attested", () => {
    const workflow = readRepositoryFile(
      ".github/workflows/build-android-release.yml",
    );
    const documentation = readRepositoryFile(
      "docs/security/MOBILE_RELEASE_SUPPLY_CHAIN.md",
    );

    const blockerIndex = workflow.indexOf(
      "Require attested Gradle publisher signatures",
    );
    const signingSecretIndex = workflow.indexOf("Decode keystore");
    expect(blockerIndex).toBeGreaterThan(0);
    expect(signingSecretIndex).toBeGreaterThan(blockerIndex);
    expect(workflow).toContain("<verify-signatures>true</verify-signatures>");
    expect(workflow).toContain("<trusted-key([ >])");
    expect(documentation).toContain("Android Provenance Release Blocker");
    expect(documentation).toContain("Changing the XML flag alone is not an attestation");
  });
});
