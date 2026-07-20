import process, { loadEnvFile } from "node:process";

import {
  evaluateLaunchReadiness,
  readEvidenceManifest,
} from "./lib/launch-readiness.mjs";

const strict = process.argv.includes("--strict");
const json = process.argv.includes("--json");
const checkEnvironment = !process.argv.includes("--skip-environment");
const manifestArgument = process.argv.find((argument) =>
  argument.startsWith("--evidence="),
);
const envFileArgument = process.argv.find((argument) =>
  argument.startsWith("--env-file="),
);
const envFilePath = envFileArgument?.slice("--env-file=".length);

if (envFilePath) {
  try {
    loadEnvFile(envFilePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unable to load launch environment file: ${message}`);
    process.exit(1);
  }
}
const evidencePath =
  manifestArgument?.slice("--evidence=".length) ||
  process.env.NUTRIO_LAUNCH_EVIDENCE_MANIFEST ||
  "artifacts/launch-evidence/manifest.json";

let evidenceManifest = null;
let manifestError = null;
try {
  evidenceManifest = readEvidenceManifest(evidencePath);
} catch (error) {
  manifestError = error instanceof Error ? error.message : String(error);
}

const result = evaluateLaunchReadiness({ evidenceManifest, checkEnvironment });
if (manifestError) {
  result.globalIssues.push(`Evidence manifest is invalid: ${manifestError}`);
  result.ready = false;
}
if (!evidenceManifest) {
  result.globalIssues.push(`Evidence manifest was not found at ${evidencePath}`);
  result.ready = false;
}

if (json) {
  process.stdout.write(`${JSON.stringify({ evidencePath, ...result }, null, 2)}\n`);
} else {
  console.log(`Nutrio launch readiness: ${result.ready ? "GO" : "NO-GO"}`);
  console.log(`Evidence manifest: ${evidencePath}`);

  for (const issue of result.globalIssues) console.log(`BLOCKER: ${issue}`);
  for (const gate of result.gates) {
    console.log(`${gate.status === "passed" ? "PASS" : "BLOCK"} ${gate.id} - ${gate.owner}`);
    for (const issue of gate.issues) console.log(`  - ${issue}`);
  }
}

if (strict && !result.ready) process.exitCode = 1;
