import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const LAUNCH_EVIDENCE_SCHEMA_VERSION = 2;

export const LAUNCH_GATES = [
  {
    id: "supabase-security",
    title: "Supabase migration and platform security",
    owner: "Supabase project owner",
    maxAgeDays: 14,
    requiredEnvironment: [],
    requiredArtifacts: [
      "migration-entry",
      "nutrio-verified-pgtap",
      "security-advisor-export",
      "auth-settings-evidence",
    ],
  },
  {
    id: "android-real-devices",
    title: "Android APK and real-device verification",
    owner: "Mobile release engineer",
    maxAgeDays: 14,
    requiredEnvironment: [],
    requiredArtifacts: [
      "apk-build-log",
      "samsung-device-run",
      "stock-android-device-run",
      "accessibility-and-safe-area-evidence",
    ],
  },
  {
    id: "six-portal-identities",
    title: "Six-portal authenticated launch journey",
    owner: "QA and Security",
    maxAgeDays: 7,
    requiredEnvironment: [
      "E2E_CUSTOMER_EMAIL",
      "E2E_CUSTOMER_PASSWORD",
      "E2E_ADMIN_EMAIL",
      "E2E_ADMIN_PASSWORD",
      "E2E_ADMIN_TOTP_SECRET",
      "E2E_PARTNER_EMAIL",
      "E2E_PARTNER_PASSWORD",
      "E2E_DRIVER_EMAIL",
      "E2E_DRIVER_PASSWORD",
      "E2E_FLEET_EMAIL",
      "E2E_FLEET_PASSWORD",
      "E2E_COACH_EMAIL",
      "E2E_COACH_PASSWORD",
    ],
    requiredArtifacts: ["six-portal-playwright-report", "session-revocation-report"],
  },
  {
    id: "sadad-financial-concurrency",
    title: "SADAD and subscription financial concurrency",
    owner: "Payments engineer and Finance",
    maxAgeDays: 30,
    requiredEnvironment: [
      "RUN_REAL_SUPABASE_INTEGRATION",
      "SADAD_MERCHANT_ID",
      "SADAD_SECRET_KEY",
      "SADAD_WEBSITE",
      "SADAD_CALLBACK_URL",
    ],
    requiredArtifacts: [
      "sadad-callback-replay-report",
      "wallet-before-after-snapshot",
      "subscription-concurrency-report",
    ],
  },
  {
    id: "glp1-governance",
    title: "GLP-1 legal, clinical, and privacy governance",
    owner: "Product, Legal, Privacy, and Clinical Operations",
    maxAgeDays: 365,
    requiredEnvironment: [],
    requiredArtifacts: [
      "qatar-legal-approval",
      "licensed-dietitian-approval",
      "medical-safety-wording-approval",
      "dpia-approval",
    ],
  },
  {
    id: "meal-response-provider",
    title: "Meal Response provider and pilot validation",
    owner: "Health integrations and Clinical Operations",
    maxAgeDays: 90,
    requiredEnvironment: [],
    requiredArtifacts: [
      "direct-provider-device-report",
      "disconnect-and-deletion-report",
      "pilot-calibration-report",
    ],
  },
  {
    id: "supplier-operations",
    title: "Supplier quality and operational ownership",
    owner: "Operations",
    maxAgeDays: 30,
    requiredEnvironment: [],
    requiredArtifacts: [
      "aal2-supplier-snapshot",
      "incident-owner-roster",
      "sla-and-escalation-matrix",
    ],
  },
];

const SENSITIVE_FEATURE_FLAGS = [
  "competitive-family-accounts",
  "competitive-corporate-benefits",
];

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function splitFlags(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readEvidenceManifest(path) {
  if (!path) return null;
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateEvidenceEntry(gate, entry, now) {
  if (!entry || entry.status !== "passed") {
    return [`Missing passed evidence for ${gate.id}`];
  }

  const issues = [];
  if (!String(entry.approvedBy ?? "").trim()) {
    issues.push(`Gate ${gate.id} is missing approvedBy`);
  }
  if (!validTimestamp(entry.approvedAt)) {
    issues.push(`Gate ${gate.id} is missing a valid approvedAt`);
  } else {
    const approvedAt = Date.parse(entry.approvedAt);
    const ageDays = (now.getTime() - approvedAt) / 86_400_000;
    if (ageDays < 0) issues.push(`Gate ${gate.id} approval is dated in the future`);
    if (ageDays > gate.maxAgeDays) {
      issues.push(`Gate ${gate.id} approval is older than ${gate.maxAgeDays} days`);
    }
  }

  const artifacts = Array.isArray(entry.artifacts) ? entry.artifacts : [];
  const artifactIds = new Set(artifacts.map((artifact) => artifact?.id));
  issues.push(...gate.requiredArtifacts
    .filter((artifactId) => !artifactIds.has(artifactId))
    .map((artifactId) => `Missing artifact ${artifactId}`));

  for (const artifact of artifacts) {
    if (
      !artifact?.id ||
      !/^[a-z][a-z0-9+.-]*:\/\//i.test(String(artifact?.uri ?? "")) ||
      !validTimestamp(artifact?.recordedAt) ||
      !/^[a-f0-9]{64}$/i.test(String(artifact?.sha256 ?? ""))
    ) {
      issues.push(
        `Artifact ${artifact?.id ?? "unknown"} requires a URI, recordedAt, and SHA-256`,
      );
    }
  }

  return issues;
}

export function evaluateLaunchReadiness({
  env = process.env,
  evidenceManifest = null,
  checkEnvironment = true,
  expectedReleaseSha = env.GITHUB_SHA || env.NUTRIO_RELEASE_SHA || null,
  now = new Date(),
  migrationExists = existsSync(
    resolve("supabase/migrations/20260720249000_harden_nutrio_verified_view.sql"),
  ),
} = {}) {
  const globalIssues = [];
  if (!migrationExists) {
    globalIssues.push("Required local migration 20260720249000 is missing");
  }

  if (isTruthy(env.VITE_PHASE_ONE_ENABLE_ALL)) {
    globalIssues.push("VITE_PHASE_ONE_ENABLE_ALL must be disabled for release review");
  }

  const forcedFlags = splitFlags(env.VITE_PHASE_ONE_FLAGS);
  for (const flag of SENSITIVE_FEATURE_FLAGS) {
    if (forcedFlags.includes(flag)) {
      globalIssues.push(`Sensitive feature flag ${flag} must remain default-off`);
    }
  }

  if (
    evidenceManifest &&
    evidenceManifest.schemaVersion !== LAUNCH_EVIDENCE_SCHEMA_VERSION
  ) {
    globalIssues.push(
      `Evidence manifest schemaVersion must be ${LAUNCH_EVIDENCE_SCHEMA_VERSION}`,
    );
  }

  if (evidenceManifest && !validTimestamp(evidenceManifest.generatedAt)) {
    globalIssues.push("Evidence manifest requires a valid generatedAt timestamp");
  }
  if (
    evidenceManifest &&
    expectedReleaseSha &&
    evidenceManifest.releaseSha !== expectedReleaseSha
  ) {
    globalIssues.push("Evidence manifest releaseSha does not match the release commit");
  }

  const gates = LAUNCH_GATES.map((gate) => {
    const issues = [];
    if (checkEnvironment) {
      for (const variable of gate.requiredEnvironment) {
        if (!String(env[variable] ?? "").trim()) {
          issues.push(`Missing environment variable ${variable}`);
        }
      }

      if (
        gate.id === "sadad-financial-concurrency" &&
        !isTruthy(env.RUN_REAL_SUPABASE_INTEGRATION)
      ) {
        issues.push("RUN_REAL_SUPABASE_INTEGRATION must explicitly equal 1/true/on");
      }
    }

    issues.push(
      ...validateEvidenceEntry(gate, evidenceManifest?.gates?.[gate.id], now),
    );

    return {
      id: gate.id,
      title: gate.title,
      owner: gate.owner,
      status: issues.length === 0 ? "passed" : "blocked",
      issues,
    };
  });

  return {
    ready: globalIssues.length === 0 && gates.every((gate) => gate.status === "passed"),
    globalIssues,
    gates,
  };
}
