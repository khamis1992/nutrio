import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { parseDocument } from "yaml";

function parseCondition(condition) {
  const source = String(condition || "")
    .replace(/^\s*\$\{\{/, "")
    .replace(/\}\}\s*$/, "")
    .trim();
  const tokens = [];
  let atom = "";
  let quote = null;

  const flushAtom = () => {
    const value = atom.trim();
    if (value) tokens.push({ type: "atom", value });
    atom = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      atom += character;
      if (character === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      atom += character;
      continue;
    }

    const pair = source.slice(index, index + 2);
    if (pair === "&&" || pair === "||") {
      flushAtom();
      tokens.push({ type: pair });
      index += 1;
      continue;
    }
    if (character === "!" || character === "(" || character === ")") {
      flushAtom();
      tokens.push({ type: character });
      continue;
    }
    atom += character;
  }
  flushAtom();

  let cursor = 0;
  const parsePrimary = () => {
    const token = tokens[cursor];
    if (!token) throw new Error("Unexpected end of workflow condition");
    if (token.type === "!") {
      cursor += 1;
      return { type: "not", child: parsePrimary() };
    }
    if (token.type === "(") {
      cursor += 1;
      const child = parseOr();
      if (tokens[cursor]?.type !== ")") throw new Error("Unclosed workflow condition group");
      cursor += 1;
      return child;
    }
    if (token.type !== "atom") throw new Error(`Unexpected token ${token.type}`);
    cursor += 1;
    return { type: "atom", value: token.value };
  };
  const parseAnd = () => {
    let node = parsePrimary();
    while (tokens[cursor]?.type === "&&") {
      cursor += 1;
      node = { type: "and", left: node, right: parsePrimary() };
    }
    return node;
  };
  const parseOr = () => {
    let node = parseAnd();
    while (tokens[cursor]?.type === "||") {
      cursor += 1;
      node = { type: "or", left: node, right: parseAnd() };
    }
    return node;
  };

  const tree = parseOr();
  if (cursor !== tokens.length) throw new Error("Unsupported workflow condition syntax");
  return tree;
}

function conditionRequiresCurrentMain(condition) {
  let tree;
  try {
    tree = parseCondition(condition);
  } catch {
    return false;
  }

  const guaranteesMain = (node) => {
    if (node.type === "atom") {
      return /^github\.ref\s*==\s*['"]refs\/heads\/main['"]$/.test(node.value.trim());
    }
    if (node.type === "and") {
      return guaranteesMain(node.left) || guaranteesMain(node.right);
    }
    if (node.type === "or") {
      return guaranteesMain(node.left) && guaranteesMain(node.right);
    }
    return false;
  };

  return guaranteesMain(tree);
}

function parseWorkflow(content) {
  const document = parseDocument(content);
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("; "));
  }
  return document.toJS();
}

function containsSecretReference(value) {
  return /\$\{\{\s*secrets\./.test(JSON.stringify(value ?? null));
}

function auditTrustedE2EWorkflow(content, { environment, jobName }) {
  const errors = [];
  let workflow;
  try {
    workflow = parseWorkflow(content);
  } catch (error) {
    return [`Workflow YAML cannot be parsed: ${error.message}`];
  }

  if (workflow?.permissions?.contents !== "read") {
    errors.push("Workflow default permissions must be contents: read.");
  }

  const job = workflow?.jobs?.[jobName];
  if (!job) return [`Missing expected secret-backed job: ${jobName}`];
  if (!conditionRequiresCurrentMain(job.if)) {
    errors.push(`${jobName} can reach secrets without requiring refs/heads/main on every path.`);
  }
  if (job.environment !== environment) {
    errors.push(`${jobName} must use the protected ${environment} environment.`);
  }
  if (containsSecretReference(job.env)) {
    errors.push(`${jobName} must not expose secrets through job-level env.`);
  }

  const steps = Array.isArray(job.steps) ? job.steps : [];
  const checkoutIndex = steps.findIndex((step) =>
    String(step?.uses || "").startsWith("actions/checkout@"),
  );
  const lifecycleIndex = steps.findIndex((step) => /\bnpm\s+ci\b/.test(String(step?.run || "")));
  const verificationIndex = steps.findIndex((step) => {
    const run = String(step?.run || "");
    return (
      /git fetch[^\n]*origin main/.test(run) &&
      /GITHUB_SHA/.test(run) &&
      /git rev-parse origin\/main/.test(run) &&
      /git rev-parse HEAD/.test(run) &&
      /!=/.test(run)
    );
  });

  const checkout = steps[checkoutIndex];
  if (
    checkoutIndex < 0 ||
    checkout?.with?.ref !== "refs/heads/main" ||
    Number(checkout?.with?.["fetch-depth"]) !== 0
  ) {
    errors.push(`${jobName} must explicitly checkout refs/heads/main with full history.`);
  }
  if (verificationIndex <= checkoutIndex || lifecycleIndex <= verificationIndex) {
    errors.push(`${jobName} must verify exact origin/main before npm ci.`);
  }

  for (const step of steps) {
    if (!containsSecretReference(step)) continue;
    const run = String(step?.run || "");
    if (!/playwright|test:e2e:launch/.test(run)) {
      errors.push(`${jobName} exposes a secret outside its Playwright execution step.`);
    }
  }

  return errors;
}

const fixtureModeIndex = process.argv.indexOf("--check-e2e-workflow");
if (fixtureModeIndex >= 0) {
  const fixturePath = process.argv[fixtureModeIndex + 1];
  const jobName = process.argv[fixtureModeIndex + 2];
  const environment = process.argv[fixtureModeIndex + 3];
  const errors = auditTrustedE2EWorkflow(readFileSync(fixturePath, "utf8"), {
    environment,
    jobName,
  });
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log("Trusted E2E workflow policy passed.");
  process.exit(0);
}

const root = process.cwd();
const failures = [];

function gitFiles(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
}

function read(file) {
  return readFileSync(file, "utf8");
}

function fail(message) {
  failures.push(message);
}

const trackedFiles = new Set(gitFiles(["ls-files", "-z"]));
const workingFiles = gitFiles(["ls-files", "-co", "--exclude-standard", "-z"]).filter(
  (file) => existsSync(file),
);

const repositorySecretPatterns = [
  [
    "private key",
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{80,10000}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ],
  ["GitHub token", /\b(?:gh[oprsu]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{16,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["npm access token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["SendGrid API key", /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
];

const secretScanFiles = workingFiles.filter((file) => {
  if (file === "scripts/security-static-audit.mjs") return false;
  if (/^(?:dist|coverage|playwright-report)\//.test(file)) return false;
  if (/\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|mp4|mov|bin|wasm)$/i.test(file)) {
    return false;
  }

  try {
    const stats = statSync(file);
    return stats.isFile() && stats.size <= 2 * 1024 * 1024;
  } catch {
    return false;
  }
});

for (const file of secretScanFiles) {
  let content;
  try {
    content = read(file);
  } catch {
    continue;
  }

  for (const [label, pattern] of repositorySecretPatterns) {
    if (pattern.test(content)) {
      fail(`Possible ${label} committed in ${file}`);
    }
  }

  for (const token of content.matchAll(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g)) {
    try {
      const payload = JSON.parse(Buffer.from(token[0].split(".")[1], "base64url").toString("utf8"));
      if (payload?.role === "service_role") {
        fail(`Supabase service-role JWT committed in ${file}`);
      }
    } catch {
      // Ignore strings that resemble JWTs but do not contain a valid JSON payload.
    }
  }
}

for (const file of trackedFiles) {
  const lower = file.toLowerCase();
  const basename = lower.split("/").at(-1) ?? "";
  const isSafeEnvTemplate = /(example|sample|template)/.test(basename);

  if ((basename === ".env" || basename.startsWith(".env.")) && !isSafeEnvTemplate) {
    fail(`Tracked environment file: ${file}`);
  }

  if (/\.(pem|key|p12|pfx|jks|keystore|mobileprovision)$/.test(lower)) {
    fail(`Tracked private signing material: ${file}`);
  }
}

const sourceFiles = workingFiles.filter(
  (file) =>
    (file.startsWith("src/") || file.startsWith("public/")) &&
    /\.(?:[cm]?[jt]sx?|html|json|svg)$/.test(file),
);

for (const file of sourceFiles) {
  const content = read(file);

  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(content)) {
    fail(`Dynamic code execution found in ${file}`);
  }

  if (
    content.includes("dangerouslySetInnerHTML") &&
    !content.includes("DOMPurify.sanitize")
  ) {
    fail(`Unsanitized dangerouslySetInnerHTML found in ${file}`);
  }

  if (
    /new\s+Blob\s*\(\s*\[[^\]]*(?:html|htmlString)[^\]]*\][\s\S]{0,120}text\/html/i.test(content) &&
    !content.includes("DOMPurify.sanitize")
  ) {
    fail(`Unsanitized generated HTML document found in ${file}`);
  }

  if (/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|DATABASE_URL/.test(content)) {
    fail(`Server-only secret name referenced by client asset ${file}`);
  }

  if (
    /(?:sk-(?:live|test|proj)-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/.test(
      content,
    )
  ) {
    fail(`Credential-shaped value found in client asset ${file}`);
  }

  if (
    /\.from\(["'](?:blood-reports|ticket-attachments|coach-photos|coach-attachments|fleet-documents)["']\)[\s\S]{0,180}?\.upload\s*\(/.test(
      content,
    )
  ) {
    fail(`Sensitive bucket upload bypasses the scanning gateway in ${file}`);
  }
}

const edgeFiles = workingFiles.filter(
  (file) => file.startsWith("supabase/functions/") && file.endsWith(".ts"),
);
for (const file of edgeFiles) {
  const content = read(file);
  if (/Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(content)) {
    fail(`Wildcard Edge Function CORS policy found in ${file}`);
  }
  if (
    file !== "supabase/functions/_shared/supabaseKeys.ts" &&
    /Deno\.env\.get\(["']SUPABASE_(?:SERVICE_ROLE|ANON)_KEY["']\)/.test(content)
  ) {
    fail(`Edge Function bypasses the centralized rotatable-key resolver in ${file}`);
  }
}

const smartAllocatorPath = "supabase/functions/smart-meal-allocator/index.ts";
if (existsSync(smartAllocatorPath)) {
  const content = read(smartAllocatorPath);
  if (
    !/MAX_VARIATIONS\s*=\s*[1-9]/.test(content) ||
    !/Number\.isInteger\(generate_variations\)/.test(content) ||
    !/generate_variations\s*>\s*MAX_VARIATIONS/.test(content) ||
    !/MAX_ALLOCATION_RUNTIME_MS/.test(content)
  ) {
    fail("Smart meal allocation must enforce bounded variations and an execution budget.");
  }
}

const supabaseKeyResolver = "supabase/functions/_shared/supabaseKeys.ts";
if (
  !existsSync(supabaseKeyResolver) ||
  !/SUPABASE_SECRET_KEYS/.test(read(supabaseKeyResolver)) ||
  !/SUPABASE_PUBLISHABLE_KEYS/.test(read(supabaseKeyResolver))
) {
  fail("The centralized Supabase key resolver must prefer named publishable and secret keys.");
}

const configPath = "supabase/config.toml";
if (existsSync(configPath)) {
  const config = read(configPath);
  let currentFunction = null;
  const unauthenticatedFunctions = [];

  for (const line of config.split(/\r?\n/)) {
    const section = line.match(/^\[functions\.([A-Za-z0-9_-]+)]$/);
    if (section) {
      currentFunction = section[1];
      continue;
    }
    if (currentFunction && /^verify_jwt\s*=\s*false\s*$/.test(line.trim())) {
      unauthenticatedFunctions.push(currentFunction);
    }
  }

  const requiredControls = {
    "send-meal-reminders": [/requireInternalSecret\s*\(/],
    "send-commission-notification": [/requireAdminOrInternal\s*\(/],
    "send-milestone-notification": [/requireAdminOrInternal\s*\(/],
    "send-monthly-affiliate-report": [/requireAdminOrInternal\s*\(/],
    "send-tier-upgrade-notification": [/requireAdminOrInternal\s*\(/],
    "send-affiliate-welcome": [/requireAdminOrInternal\s*\(/],
    "check-ip-location": [/enforceRateLimit\s*\(/],
    "process-subscription-renewal": [
      /requireInternalSecret\s*\(/,
      /authenticateRequest\s*\(/,
      /enforceRateLimit\s*\(/,
    ],
    "cleanup-expired-rollovers": [/requireAdminOrInternal\s*\(/],
    "sporthub-webhook": [/verifySignature\s*\(/, /recordRejectedWebhook\s*\(/],
    "sporthub-oauth-callback": [/consume_partner_oauth_state/, /enforceRateLimit\s*\(/],
    "sadad-payment": [/async function authenticate\s*\(/, /verifyChecksum\s*\(/, /enforceRateLimit\s*\(/],
    "send-push-notification": [/requireInternalSecret\s*\(/, /requireSelfOrAdmin\s*\(/, /enforceRateLimit\s*\(/],
    "send-whatsapp-proxy": [/requireInternalSecret\s*\(/, /authenticateRequest\s*\(/, /enforceRateLimit\s*\(/],
    "process-whatsapp-notifications": [/requireAdminOrInternal\s*\(/, /enforceRateLimit\s*\(/],
    "subscription-recovery-cron": [/requireAdminOrInternal\s*\(/, /enforceRateLimit\s*\(/],
    "send-invoice-email": [/requireInternalSecret\s*\(/, /authenticateRequest\s*\(/, /enforceRateLimit\s*\(/],
    "send-email": [/requireInternalSecret\s*\(/, /authenticateRequest\s*\(/, /enforceRateLimit\s*\(/],
    "auto-assign-driver": [/requireAdminOrInternal\s*\(/, /enforceRateLimit\s*\(/],
    "security-log-maintenance": [/requireAdminOrInternal\s*\(/],
    "adaptive-goals": [/requireInternalSecret\s*\(/, /requireSelfOrAdmin\s*\(/, /enforceRateLimit\s*\(/],
    "adaptive-goals-batch": [/requireAdminOrInternal\s*\(/, /enforceRateLimit\s*\(/],
    "ai-router": [/authenticateRequest\s*\(/, /enforceRateLimit\s*\(/],
    "nutrio-mcp": [/authenticateRequest\s*\(/, /enforceRateLimit\s*\(/],
    "fleet-payouts": [/authenticateRequest\s*\(/, /enforceRateLimit\s*\(/],
  };

  for (const functionName of unauthenticatedFunctions) {
    const indexPath = `supabase/functions/${functionName}/index.ts`;
    if (!existsSync(indexPath)) {
      fail(`verify_jwt=false function has no index.ts: ${functionName}`);
      continue;
    }
    const content = read(indexPath);
    const controls = requiredControls[functionName];
    if (!controls) {
      fail(`verify_jwt=false function is missing from the explicit control matrix: ${functionName}`);
      continue;
    }
    const missingControl = controls.find((control) => !control.test(content));
    if (missingControl) {
      fail(`verify_jwt=false function lacks a required compensating control: ${functionName}`);
    }
  }

  console.log(
    `Checked ${unauthenticatedFunctions.length} explicitly unauthenticated Edge Functions.`,
  );
}

const manualBloodWorkSql = "supabase/migrations/MANUAL_APPLY_BLOOD_WORK_STORAGE_AND_FK_FIX.sql";
if (existsSync(manualBloodWorkSql)) {
  const content = read(manualBloodWorkSql);
  if (
    /public\s*=\s*true/i.test(content) ||
    /CREATE\s+POLICY\s+["']?Public read access for blood reports/i.test(content) ||
    /CREATE\s+POLICY[\s\S]{0,180}ON\s+storage\.objects\s+FOR\s+(?:INSERT|UPDATE)[\s\S]{0,260}blood-reports/i.test(content)
  ) {
    fail("Manual blood-work migration would expose a sensitive storage bucket.");
  }
}

const capacitorConfigPath = "capacitor.config.ts";
if (existsSync(capacitorConfigPath)) {
  const content = read(capacitorConfigPath);
  if (/cleartext\s*:\s*true/.test(content)) {
    fail("Capacitor WebView permits cleartext traffic.");
  }
  if (/allowNavigation\s*:/.test(content)) {
    fail("Capacitor WebView has an in-app external navigation allowlist.");
  }
  const minimumWebView = content.match(/minWebViewVersion\s*:\s*(\d+)/)?.[1];
  if (!minimumWebView || Number(minimumWebView) < 149) {
    fail("Capacitor Android must reject WebView versions below the approved security baseline (149).");
  }
  if (!/errorPath\s*:\s*['\"]unsupported-webview\.html['\"]/.test(content)) {
    fail("Capacitor requires a local unsupported-WebView error page.");
  }
}

const viteConfigPath = "vite.config.ts";
if (existsSync(viteConfigPath)) {
  const content = read(viteConfigPath);
  if (/@vitejs\/plugin-legacy|chrome\s*>=\s*52|android\s*>=\s*5/i.test(content)) {
    fail("Obsolete browser compatibility bundles are enabled in Vite.");
  }
  if (!/target\s*:\s*['\"]es2020['\"]/.test(content)) {
    fail("Vite must retain the reviewed ES2020 mobile build target.");
  }
}

const androidManifestPath = "android/app/src/main/AndroidManifest.xml";
if (existsSync(androidManifestPath)) {
  const content = read(androidManifestPath);
  if (!/android:usesCleartextTraffic\s*=\s*['\"]false['\"]/.test(content)) {
    fail("Android manifest must explicitly disable cleartext traffic.");
  }
}

const androidFilePaths = "android/app/src/main/res/xml/file_paths.xml";
if (existsSync(androidFilePaths) && /<external-path\b/.test(read(androidFilePaths))) {
  fail("Android FileProvider exposes the shared external-storage root.");
}

for (const file of workingFiles.filter((item) => item.startsWith(".github/workflows/"))) {
  const content = read(file);
  if (content.includes('Authorization: Bearer $SUPABASE_ANON_KEY')) {
    fail(`Publishable key is incorrectly used as a bearer identity in ${file}`);
  }

  for (const line of content.split(/\r?\n/)) {
    const action = line.match(/\buses:\s*([^\s#]+)@([^\s#]+)/);
    if (!action || action[1].startsWith("./")) continue;
    if (!/^[0-9a-f]{40}$/i.test(action[2])) {
      fail(`GitHub Action is not pinned to a full commit SHA in ${file}: ${action[1]}`);
    }
  }
}

const ciWorkflowPath = ".github/workflows/ci-cd.yml";
if (existsSync(ciWorkflowPath)) {
  const content = read(ciWorkflowPath);
  for (const error of auditTrustedE2EWorkflow(content, {
    environment: "Trusted E2E",
    jobName: "e2e",
  })) {
    fail(`CI E2E workflow: ${error}`);
  }
  if (
    /(?:test-results|playwright-report)\//.test(content) ||
    !/--trace=off/.test(content) ||
    !/--reporter=line/.test(content)
  ) {
    fail("Trusted CI E2E must disable traces and avoid uploading authenticated browser artifacts.");
  }
}

const productionLaunchWorkflowPath = ".github/workflows/production-launch-gate.yml";
if (existsSync(productionLaunchWorkflowPath)) {
  for (const error of auditTrustedE2EWorkflow(read(productionLaunchWorkflowPath), {
    environment: "Production",
    jobName: "launch-gate",
  })) {
    fail(`Production launch workflow: ${error}`);
  }

  const content = read(productionLaunchWorkflowPath);
  if (
    /(?:test-results|playwright-report)\//.test(content) ||
    !/production-evidence\/launch-summary\.txt/.test(content)
  ) {
    fail("Production launch artifacts must contain only the redacted summary.");
  }
}

const productionPlaywrightConfigPath = "playwright.launch.config.ts";
if (existsSync(productionPlaywrightConfigPath)) {
  const content = read(productionPlaywrightConfigPath);
  if (
    !/trace:\s*["']off["']/.test(content) ||
    !/video:\s*["']off["']/.test(content) ||
    !/screenshot:\s*["']off["']/.test(content)
  ) {
    fail("Production Playwright must disable traces, videos, and screenshots.");
  }
}

const androidDebugWorkflowPath = ".github/workflows/build-android-apk.yml";
if (existsSync(androidDebugWorkflowPath)) {
  const content = read(androidDebugWorkflowPath);
  if (
    /assembleRelease|bundleRelease|latest-release|name:\s*publish\b/i.test(content) ||
    /contents:\s*write/.test(content)
  ) {
    fail("The Android APK workflow must remain debug-only and unable to publish releases.");
  }
}

const androidReleaseWorkflowPath = ".github/workflows/build-android-release.yml";
if (existsSync(androidReleaseWorkflowPath)) {
  const content = read(androidReleaseWorkflowPath);
  if (
    !/environment:\s*Mobile Signing/.test(content) ||
    !/"\$GITHUB_SHA" != "\$\(git rev-parse origin\/main\)"/.test(content) ||
    /continue-on-error:\s*true/.test(content) ||
    !/apksigner[\s\S]{0,120}verify/.test(content) ||
    !/jarsigner\s+-verify/.test(content) ||
    !/SHA256SUMS/.test(content) ||
    !/if-no-files-found:\s*error/.test(content)
  ) {
    fail("Android signing must be protected, fail closed, verify signatures, and publish checksums.");
  }
}

const iosReleaseWorkflowPath = ".github/workflows/build-ios.yml";
if (existsSync(iosReleaseWorkflowPath)) {
  const content = read(iosReleaseWorkflowPath);
  const protectedJobs = content.match(/environment:\s*Mobile Signing/g)?.length ?? 0;
  if (
    protectedJobs < 2 ||
    !/github\.event_name == 'workflow_dispatch'[\s\S]{0,160}inputs\.build_type == 'release'[\s\S]{0,160}github\.ref == 'refs\/heads\/main'/.test(content) ||
    !/Revalidate release commit before signing[\s\S]{0,420}"\$GITHUB_SHA" != "\$\(git rev-parse origin\/main\)"/.test(content)
  ) {
    fail("iOS signing and publishing must require a protected manual release from main.");
  }
}

const codeqlWorkflowPath = ".github/workflows/codeql.yml";
if (!existsSync(codeqlWorkflowPath)) {
  fail("The required CodeQL security-analysis workflow is missing.");
} else {
  const content = read(codeqlWorkflowPath);
  if (!/language:\s*[\s\S]*javascript-typescript[\s\S]*actions/.test(content)) {
    fail("CodeQL must analyze both JavaScript/TypeScript and GitHub Actions workflows.");
  }
  if (!/queries:\s*security-extended/.test(content)) {
    fail("CodeQL must retain the security-extended query suite.");
  }
}

if (failures.length > 0) {
  console.error("Security static audit failed:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `Security static audit passed (${trackedFiles.size} tracked files, ${sourceFiles.length} client assets, ${secretScanFiles.length} secret-scanned files).`,
);
