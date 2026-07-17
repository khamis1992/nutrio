# Mobile Release Supply Chain

## Enforced Controls

- Signed Android and iOS releases run only in the protected `Mobile Signing` environment.
- The release commit must equal the current `origin/main` commit. iOS repeats this check immediately before any signing secret is opened.
- All GitHub Actions are pinned to immutable commit SHAs.
- The Android Gradle 8.14.3 distribution and wrapper JAR are checked against the official Gradle SHA-256 values.
- Gradle dependency verification runs in strict mode against `android/gradle/verification-metadata.xml`.
- Android release jobs require exactly one APK and one AAB, verify both signatures against the protected keystore certificate, and publish artifact and certificate SHA-256 manifests.
- Missing APK, AAB, IPA, or checksum files fail the job. Artifact upload failures are not ignored.
- npm audits include production and development dependencies because development tools produce the release binaries.

## Required GitHub Configuration

Configure `Mobile Signing` with required reviewers, deployment branch protection limited to `main`, and no administrator bypass. Keep Android and Apple signing credentials as environment secrets, not repository variables or files.

## Dependency Verification Residual

The verification metadata was generated offline from the dependency artifacts already present in the build cache and is now enforced by checksum. This prevents an unnoticed artifact change, but the initial checksum set has not been independently attested against every upstream publisher signature. Before the first production release, regenerate and compare the metadata on an isolated trusted runner, investigate every changed hash, and add publisher signature verification where upstream artifacts provide usable signatures.

Gradle dependency locking is not enabled because the current Groovy build scripts do not activate locking for every Capacitor subproject. Direct dependency versions are fixed, and strict checksum verification pins the resolved transitive artifacts without changing project build behavior. Enabling lockfiles later requires a reviewed build-script change and a clean Android SDK build that exercises every release configuration.

## Release Verification

1. Confirm the protected environment approval identifies the intended commit.
2. Require the signature-verification step to pass before downloading artifacts.
3. Compare downloaded APK and AAB hashes with `SHA256SUMS`.
4. Record the `SIGNING-MANIFEST.txt` commit and certificate fingerprint in the release evidence record.
5. Reject and rebuild any artifact whose hash or signing certificate differs.
