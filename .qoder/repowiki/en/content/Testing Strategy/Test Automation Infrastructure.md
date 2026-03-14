# Test Automation Infrastructure

<cite>
**Referenced Files in This Document**
- [ci-cd.yml](file://.github/workflows/ci-cd.yml)
- [playwright.config.ts](file://playwright.config.ts)
- [package.json](file://package.json)
- [vitest.config.ts](file://vitest.config.ts)
- [run-all-portals.sh](file://scripts/run-all-portals.sh)
- [run-cross-portal-tests.sh](file://scripts/run-cross-portal-tests.sh)
- [run-cross-portal-tests.bat](file://scripts/run-cross-portal-tests.bat)
- [launch-ui-mode.sh](file://scripts/launch-ui-mode.sh)
- [launch-ui-mode.bat](file://scripts/launch-ui-mode.bat)
- [README.md](file://e2e/cross-portal/README.md)
- [TEST-REPORT.md](file://e2e/TEST-REPORT.md)
- [TEST-RUN-REPORT.md](file://e2e/TEST-RUN-REPORT.md)
- [helpers.ts](file://e2e/utils/helpers.ts)
- [performance-benchmark.ts](file://scripts/performance-benchmark.ts)
- [load-test-k6.js](file://scripts/load-test-k6.js)
- [load-test-config.yml](file://tests/load-test-config.yml)
- [setup.ts](file://src/test/setup.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document describes the complete test automation infrastructure for the Nutrio project, covering continuous integration and deployment (CI/CD), automated test execution, and test result management. It explains the shell scripts for running different test suites, UI mode launching, and test environment setup. It documents GitHub Actions workflows for automated testing, test result reporting, and failure notifications. It also covers test execution scheduling, parallel test running, resource management, test data cleanup, environment isolation, and test artifact management. Finally, it outlines integration with reporting tools, notifications, and test result aggregation for stakeholders.

## Project Structure
The test automation system spans multiple layers:
- CI/CD workflows orchestrated via GitHub Actions
- Playwright-based end-to-end (E2E) tests with cross-portal orchestration
- Vitest-based unit tests with coverage
- Shell scripts for local test execution and UI mode
- Performance and load testing utilities
- Test utilities and helpers for environment setup and assertions

```mermaid
graph TB
subgraph "CI/CD"
A[".github/workflows/ci-cd.yml"]
end
subgraph "Testing Frameworks"
B["Playwright Config<br/>playwright.config.ts"]
C["Vitest Config<br/>vitest.config.ts"]
D["Package Scripts<br/>package.json"]
end
subgraph "Shell Scripts"
E["run-all-portals.sh"]
F["run-cross-portal-tests.sh"]
G["run-cross-portal-tests.bat"]
H["launch-ui-mode.sh"]
I["launch-ui-mode.bat"]
end
subgraph "Test Suites"
J["Cross-Portal Tests<br/>e2e/cross-portal/"]
K["E2E Reports<br/>e2e/TEST-*.md"]
L["Unit Tests<br/>src/**/*"]
end
subgraph "Utilities"
M["Test Helpers<br/>e2e/utils/helpers.ts"]
N["Setup Mocks<br/>src/test/setup.ts"]
O["Performance Benchmarks<br/>scripts/performance-benchmark.ts"]
P["k6 Load Tests<br/>scripts/load-test-k6.js"]
Q["Artillery Load Config<br/>tests/load-test-config.yml"]
end
A --> B
A --> C
D --> B
D --> C
E --> B
F --> B
G --> B
H --> B
I --> B
J --> B
K --> B
L --> C
M --> J
N --> C
O --> J
P --> J
Q --> J
```

**Diagram sources**
- [ci-cd.yml:1-197](file://.github/workflows/ci-cd.yml#L1-L197)
- [playwright.config.ts:1-92](file://playwright.config.ts#L1-L92)
- [vitest.config.ts:1-28](file://vitest.config.ts#L1-L28)
- [package.json:7-43](file://package.json#L7-L43)
- [run-all-portals.sh:1-22](file://scripts/run-all-portals.sh#L1-L22)
- [run-cross-portal-tests.sh:1-79](file://scripts/run-cross-portal-tests.sh#L1-L79)
- [run-cross-portal-tests.bat:1-62](file://scripts/run-cross-portal-tests.bat#L1-L62)
- [launch-ui-mode.sh:1-106](file://scripts/launch-ui-mode.sh#L1-L106)
- [launch-ui-mode.bat:1-99](file://scripts/launch-ui-mode.bat#L1-L99)
- [README.md:1-460](file://e2e/cross-portal/README.md#L1-L460)
- [TEST-REPORT.md:1-215](file://e2e/TEST-REPORT.md#L1-L215)
- [TEST-RUN-REPORT.md:1-202](file://e2e/TEST-RUN-REPORT.md#L1-L202)
- [helpers.ts:1-239](file://e2e/utils/helpers.ts#L1-L239)
- [setup.ts:1-70](file://src/test/setup.ts#L1-L70)
- [performance-benchmark.ts:1-280](file://scripts/performance-benchmark.ts#L1-L280)
- [load-test-k6.js:1-129](file://scripts/load-test-k6.js#L1-L129)
- [load-test-config.yml:1-173](file://tests/load-test-config.yml#L1-L173)

**Section sources**
- [ci-cd.yml:1-197](file://.github/workflows/ci-cd.yml#L1-L197)
- [playwright.config.ts:1-92](file://playwright.config.ts#L1-L92)
- [vitest.config.ts:1-28](file://vitest.config.ts#L1-L28)
- [package.json:7-43](file://package.json#L7-L43)

## Core Components
- CI/CD pipeline with quality checks, unit tests, builds, and deployments
- Playwright configuration for E2E tests with reporters, tracing, screenshots, and video
- Vitest configuration for unit tests with coverage and setup files
- Shell scripts for cross-portal test execution and UI mode
- Test helpers for authentication, navigation, assertions, and utilities
- Performance and load testing tools for benchmarking and stress testing

Key capabilities:
- Automated test execution in CI with coverage and artifacts
- Local parallel execution and UI mode for debugging
- Cross-portal orchestration with isolated browser contexts
- Performance benchmarking and load testing configurations

**Section sources**
- [ci-cd.yml:14-197](file://.github/workflows/ci-cd.yml#L14-L197)
- [playwright.config.ts:13-92](file://playwright.config.ts#L13-L92)
- [vitest.config.ts:4-27](file://vitest.config.ts#L4-L27)
- [package.json:7-43](file://package.json#L7-L43)
- [helpers.ts:8-26](file://e2e/utils/helpers.ts#L8-L26)

## Architecture Overview
The test automation architecture integrates CI/CD, test frameworks, and local execution tools. CI orchestrates quality checks, unit tests, builds, and deployments. Locally, developers use Playwright and Vitest with shell scripts and helpers for rapid feedback. Cross-portal tests leverage isolated browser contexts to simulate multi-user, multi-portal workflows.

```mermaid
sequenceDiagram
participant Dev as "Developer"
participant Scripts as "Shell Scripts"
participant PW as "Playwright"
participant VT as "Vitest"
participant CI as "GitHub Actions"
participant Repo as "Repository"
Dev->>Scripts : Run cross-portal tests
Scripts->>PW : Execute E2E tests
PW->>Repo : Access test files and helpers
Dev->>Scripts : Launch UI mode
Scripts->>PW : Start UI mode with reporters
Dev->>VT : Run unit tests
VT->>Repo : Access setup and mocks
CI->>Repo : Pull latest code
CI->>VT : Run unit tests with coverage
CI->>PW : Run E2E tests with reporters
CI->>Repo : Upload artifacts (coverage, reports)
```

**Diagram sources**
- [run-cross-portal-tests.sh:17-33](file://scripts/run-cross-portal-tests.sh#L17-L33)
- [launch-ui-mode.sh:51-100](file://scripts/launch-ui-mode.sh#L51-L100)
- [playwright.config.ts:28-33](file://playwright.config.ts#L28-L33)
- [vitest.config.ts:9-19](file://vitest.config.ts#L9-L19)
- [ci-cd.yml:43-110](file://.github/workflows/ci-cd.yml#L43-L110)

## Detailed Component Analysis

### CI/CD Pipeline (GitHub Actions)
The CI pipeline performs:
- Code quality checks (ESLint, TypeScript type check)
- Unit tests with coverage
- Build production bundle
- Deployments to staging and production environments
- Security audit with npm audit and audit-ci

```mermaid
flowchart TD
Start([Push/Pull Request]) --> Quality["Quality Checks<br/>ESLint + Type Check"]
Quality --> UnitTests["Unit Tests<br/>Vitest + Coverage"]
UnitTests --> Build["Build Application<br/>Vite Production"]
Build --> DeployStaging{"Branch is develop?"}
Build --> DeployProd{"Branch is main?"}
DeployStaging --> |Yes| Staging["Deploy to Staging (Vercel)"]
DeployProd --> |Yes| Prod["Deploy to Production (Vercel)"]
DeployStaging --> |No| End([End])
DeployProd --> |No| End
Staging --> End
Prod --> End
```

**Diagram sources**
- [ci-cd.yml:3-197](file://.github/workflows/ci-cd.yml#L3-L197)

**Section sources**
- [ci-cd.yml:14-197](file://.github/workflows/ci-cd.yml#L14-L197)

### Playwright Configuration and Cross-Portal Tests
Playwright is configured for:
- Test directory, parallelization, retries, and worker limits
- HTML and JSON reporters with trace, screenshot, and video collection
- Projects for Chromium and optional cross-browser testing
- Local dev server hook for test execution

Cross-portal tests orchestrate:
- Isolated browser contexts per portal
- Parallel login and navigation
- Simultaneous actions across portals
- Utilities for login, navigation, assertions, and screenshots

```mermaid
sequenceDiagram
participant Test as "Cross-Portal Spec"
participant PW as "Playwright"
participant Ctx as "Browser Contexts"
participant Utils as "Helpers"
Test->>PW : Create contexts for 4 portals
PW->>Ctx : customerContext, adminContext, partnerContext, driverContext
Test->>Utils : loginAllPortals(pages)
Utils->>Ctx : Parallel login across contexts
Test->>Ctx : Navigate all to dashboards
Ctx->>Test : Verify state changes
Test->>Utils : Take screenshots on failure
```

**Diagram sources**
- [playwright.config.ts:56-82](file://playwright.config.ts#L56-L82)
- [README.md:134-186](file://e2e/cross-portal/README.md#L134-L186)
- [helpers.ts:56-95](file://e2e/utils/helpers.ts#L56-L95)

**Section sources**
- [playwright.config.ts:13-92](file://playwright.config.ts#L13-L92)
- [README.md:1-460](file://e2e/cross-portal/README.md#L1-L460)
- [helpers.ts:1-239](file://e2e/utils/helpers.ts#L1-L239)

### Vitest Configuration and Unit Tests
Vitest is configured with:
- Global environment and jsdom
- Setup files for mocking
- Coverage reporting (text, json, html)
- Path aliases and include patterns

```mermaid
classDiagram
class VitestConfig {
+test.globals : true
+test.environment : "jsdom"
+test.setupFiles : ["./src/test/setup.ts"]
+test.coverage : providers + reporters + excludes
+resolve.alias["@"] : path.resolve("./src")
}
class SetupMocks {
+mock import.meta.env
+mock matchMedia
+mock IntersectionObserver
+mock ResizeObserver
+mock scrollTo
+suppress console errors
}
VitestConfig --> SetupMocks : "uses"
```

**Diagram sources**
- [vitest.config.ts:4-27](file://vitest.config.ts#L4-L27)
- [setup.ts:1-70](file://src/test/setup.ts#L1-L70)

**Section sources**
- [vitest.config.ts:1-28](file://vitest.config.ts#L1-L28)
- [setup.ts:1-70](file://src/test/setup.ts#L1-L70)

### Shell Scripts for Test Execution and UI Mode
Local execution scripts:
- Cross-portal runner (Linux/macOS and Windows)
- UI mode launcher with menu-driven choices
- All-portals parallel execution

```mermaid
flowchart TD
Menu["UI Mode Launcher"] --> Choice{"User Choice"}
Choice --> |1| OrderLifecycle["Run Order Lifecycle"]
Choice --> |2| WalletPayments["Run Wallet & Payments"]
Choice --> |3| AllTests["Run All Cross-Portal Tests"]
Choice --> |4| QuickDemo["Run Quick Demo"]
Choice --> |5| Exit["Exit"]
Runner["Cross-Portal Runner"] --> Test1["Order Lifecycle"]
Runner --> Test2["Partner Onboarding"]
Runner --> Test3["Driver Delivery"]
Runner --> Test4["Admin Management"]
Runner --> Test5["Customer Journey"]
```

**Diagram sources**
- [launch-ui-mode.sh:31-100](file://scripts/launch-ui-mode.sh#L31-L100)
- [launch-ui-mode.bat:14-99](file://scripts/launch-ui-mode.bat#L14-L99)
- [run-cross-portal-tests.sh:17-33](file://scripts/run-cross-portal-tests.sh#L17-L33)
- [run-cross-portal-tests.bat:15-43](file://scripts/run-cross-portal-tests.bat#L15-L43)

**Section sources**
- [run-all-portals.sh:1-22](file://scripts/run-all-portals.sh#L1-L22)
- [run-cross-portal-tests.sh:1-79](file://scripts/run-cross-portal-tests.sh#L1-L79)
- [run-cross-portal-tests.bat:1-62](file://scripts/run-cross-portal-tests.bat#L1-L62)
- [launch-ui-mode.sh:1-106](file://scripts/launch-ui-mode.sh#L1-L106)
- [launch-ui-mode.bat:1-99](file://scripts/launch-ui-mode.bat#L1-L99)

### Test Utilities and Environment Setup
Test helpers centralize:
- Test user credentials and portal URLs
- Wait utilities and element interactions
- Authentication flows per portal
- Assertions, navigation, uploads, scrolling, and viewport helpers
- Screenshot capture and retry logic

```mermaid
classDiagram
class TestHelpers {
+TEST_USERS : customer, admin, partner, driver
+URLS : base + portal routes
+loginAsCustomer(page)
+loginAsAdmin(page)
+loginAsPartner(page)
+loginAsDriver(page)
+logout(page)
+fillForm(page, data)
+navigateTo(page, path)
+expectToast(page, message)
+expectUrl(page, pattern)
+takeScreenshot(page, name)
+retry(operation, maxRetries, delay)
}
```

**Diagram sources**
- [helpers.ts:8-239](file://e2e/utils/helpers.ts#L8-L239)

**Section sources**
- [helpers.ts:1-239](file://e2e/utils/helpers.ts#L1-L239)

### Performance and Load Testing
Performance benchmarking:
- Measures RPC and query response times with percentiles
- Validates targets and logs pass/fail status
- Handles expected errors in test environments

Load testing:
- k6 script for Supabase RPC under load with thresholds
- Artillery YAML for sustained load scenarios and reporting

```mermaid
flowchart TD
PB["Performance Benchmark"] --> RPC["RPC Benchmarks"]
PB --> Query["Query Benchmarks"]
PB --> Stats["Calculate Avg/Min/Max/P95/P99"]
PB --> Report["Print Results"]
K6["k6 Load Test"] --> Targets["Target Supabase RPCs"]
K6 --> Metrics["Track Trends + Error Rate"]
K6 --> Thresholds["Enforce SLIs"]
Art["Artillery Config"] --> Scenarios["Multiple User Scenarios"]
Art --> Thresholds2["Response Time + Error Rate Targets"]
Art --> Reports["JSON + HTML Reports"]
```

**Diagram sources**
- [performance-benchmark.ts:20-264](file://scripts/performance-benchmark.ts#L20-L264)
- [load-test-k6.js:20-116](file://scripts/load-test-k6.js#L20-L116)
- [load-test-config.yml:9-173](file://tests/load-test-config.yml#L9-L173)

**Section sources**
- [performance-benchmark.ts:1-280](file://scripts/performance-benchmark.ts#L1-L280)
- [load-test-k6.js:1-129](file://scripts/load-test-k6.js#L1-L129)
- [load-test-config.yml:1-173](file://tests/load-test-config.yml#L1-L173)

## Dependency Analysis
The test automation stack exhibits clear separation of concerns:
- CI/CD depends on package scripts and test configurations
- Playwright depends on test helpers and cross-portal specs
- Vitest depends on setup mocks and unit test files
- Shell scripts depend on Playwright commands and environment variables
- Performance and load testing depend on Supabase connectivity and environment variables

```mermaid
graph LR
CI[".github/workflows/ci-cd.yml"] --> Scripts["package.json scripts"]
Scripts --> PW["playwright.config.ts"]
Scripts --> VT["vitest.config.ts"]
PW --> Helpers["e2e/utils/helpers.ts"]
PW --> Specs["e2e/cross-portal/*.spec.ts"]
VT --> Setup["src/test/setup.ts"]
PW --> Reports["HTML + JSON Reports"]
VT --> Coverage["Coverage Reports"]
Perf["scripts/performance-benchmark.ts"] --> Supabase["Supabase RPC/Queries"]
LoadK6["scripts/load-test-k6.js"] --> Supabase
LoadArt["tests/load-test-config.yml"] --> Reports
```

**Diagram sources**
- [ci-cd.yml:43-110](file://.github/workflows/ci-cd.yml#L43-L110)
- [package.json:7-43](file://package.json#L7-L43)
- [playwright.config.ts:13-92](file://playwright.config.ts#L13-L92)
- [vitest.config.ts:4-27](file://vitest.config.ts#L4-L27)
- [helpers.ts:1-239](file://e2e/utils/helpers.ts#L1-L239)
- [performance-benchmark.ts:1-280](file://scripts/performance-benchmark.ts#L1-L280)
- [load-test-k6.js:1-129](file://scripts/load-test-k6.js#L1-L129)
- [load-test-config.yml:1-173](file://tests/load-test-config.yml#L1-L173)

**Section sources**
- [ci-cd.yml:1-197](file://.github/workflows/ci-cd.yml#L1-L197)
- [package.json:7-43](file://package.json#L7-L43)
- [playwright.config.ts:1-92](file://playwright.config.ts#L1-L92)
- [vitest.config.ts:1-28](file://vitest.config.ts#L1-L28)
- [helpers.ts:1-239](file://e2e/utils/helpers.ts#L1-L239)

## Performance Considerations
- Parallelization: Playwright workers are limited in CI to reduce contention; adjust locally for speed.
- Retries: CI enables retries for flaky tests; consider adding retry logic in flaky steps.
- Resource management: Use isolated browser contexts to prevent cross-test interference.
- Coverage: Unit test coverage is enabled; ensure meaningful coverage thresholds.
- Reporting: HTML and JSON reporters provide actionable insights; archive artifacts for historical analysis.
- Load testing: k6 and Artillery provide realistic load scenarios; tune thresholds and ramp schedules.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Test credentials not working: Ensure test users exist in the database and credentials are correct.
- UI selectors mismatch: Update selectors to use stable identifiers (e.g., data-testid) and align with actual UI.
- Route mismatches: Align test URLs with actual application routes; fix 404 errors.
- Dialogs blocking interactions: Add logic to close overlays before clicking.
- Missing test data: Provision test users, restaurants, orders, and subscriptions.
- Authentication failures: Verify login flows and redirect expectations.

```mermaid
flowchart TD
Start(["Test Failure"]) --> AuthFail{"Login Failed?"}
AuthFail --> |Yes| CreateUser["Create test user in DB"]
AuthFail --> |No| SelMismatch{"Selectors OK?"}
SelMismatch --> |No| UpdateSel["Add data-testid + update selectors"]
SelMismatch --> |Yes| RouteMismatch{"Routes match?"}
RouteMismatch --> |No| FixRoutes["Align test URLs with app routes"]
RouteMismatch --> |Yes| Dialogs{"Overlays blocking?"}
Dialogs --> |Yes| CloseDialogs["Add overlay dismissal logic"]
Dialogs --> |No| TestData{"Test data provisioned?"}
TestData --> |No| SeedData["Seed test data"]
TestData --> |Yes| Investigate["Investigate remaining failures"]
```

**Section sources**
- [TEST-REPORT.md:35-134](file://e2e/TEST-REPORT.md#L35-L134)
- [TEST-RUN-REPORT.md:22-152](file://e2e/TEST-RUN-REPORT.md#L22-L152)
- [helpers.ts:8-26](file://e2e/utils/helpers.ts#L8-L26)

## Conclusion
The test automation infrastructure combines robust CI/CD workflows, Playwright-based cross-portal E2E tests, Vitest unit tests, and performance/load testing tools. It supports local parallel execution, UI mode debugging, and comprehensive reporting. By addressing current issues (credentials, selectors, routes, and test data), the system can achieve reliable, repeatable, and scalable automated testing aligned with stakeholder needs.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Test Execution Commands and Scripts
- Run all cross-portal tests: `npx playwright test e2e/cross-portal/`
- Run with UI mode: `npx playwright test --ui`
- Run specific workflow: `npx playwright test e2e/cross-portal/order-lifecycle.spec.ts`
- Run with headed mode: `npx playwright test --headed`
- Show report: `npx playwright show-report`
- Run unit tests: `npm run test:run`
- Run unit tests with coverage: `npm run test:coverage`
- Run all portals in parallel: `./scripts/run-all-portals.sh`

**Section sources**
- [README.md:187-271](file://e2e/cross-portal/README.md#L187-L271)
- [package.json:27-42](file://package.json#L27-L42)

### Environment Variables and Secrets
- CI environment variables: Node.js version
- Build secrets: Supabase URL/key, Sentry DSN, PostHog key
- Local environment: BASE_URL for Playwright; ensure dev server is running on port 8080

**Section sources**
- [ci-cd.yml:9-101](file://.github/workflows/ci-cd.yml#L9-L101)
- [playwright.config.ts:37-53](file://playwright.config.ts#L37-L53)

### Artifact and Report Management
- Coverage reports: Uploaded as artifacts in CI
- Playwright HTML and JSON reports: Generated locally and in CI
- Load test results: JSON and HTML outputs for analysis

**Section sources**
- [ci-cd.yml:65-71](file://.github/workflows/ci-cd.yml#L65-L71)
- [load-test-config.yml:136-141](file://tests/load-test-config.yml#L136-L141)