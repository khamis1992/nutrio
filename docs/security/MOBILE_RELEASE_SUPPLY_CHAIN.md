# Mobile Release Supply Chain

## Enforced Controls

- Signed Android and iOS releases run only in the protected `Mobile Signing` environment.
- The release commit must equal the current `origin/main` commit. iOS repeats this check immediately before any signing secret is opened.
- All GitHub Actions are pinned to immutable commit SHAs.
- npm dependencies are installed with lifecycle scripts disabled. CI runs the
  advisory and registry-signature audits before `npm rebuild` permits verified
  package lifecycle scripts to execute.
- The iOS workspace commits `Package.resolved` and pins
  `capacitor-swift-pm` 8.0.0 to revision
  `596259033e94829dffc552a40e7129262122995e`. GitHub's
  [official 8.0.0 release](https://github.com/ionic-team/capacitor-swift-pm/releases/tag/8.0.0)
  identifies that revision. Xcode builds use
  `-disableAutomaticPackageResolution` and fail if the lock is missing.
- Production database and Edge workflows download only
  `supabase_2.109.1_linux_amd64.tar.gz` and verify the SHA-256 published
  in the [official v2.109.1 release assets](https://github.com/supabase/cli/releases/expanded_assets/v2.109.1),
  `36d87b7fe6b4bcfe89ac47a4354e526cff22480224de426d7b370f6934556976`,
  before extraction or execution.
- The Android Gradle 8.14.3 distribution and wrapper JAR are checked against the official Gradle SHA-256 values.
- Gradle dependency verification runs in strict mode against
  `android/gradle/verification-metadata.xml` and the reviewable armored keyring
  `android/gradle/verification-keyring.keys`.
- Android release jobs require exactly one APK and one AAB, verify both signatures against the protected keystore certificate, and publish artifact and certificate SHA-256 manifests.
- Android and iOS release versions are supplied by the protected release workflow; CI build numbers are used as monotonically increasing native build identifiers and verified from the built manifest.
- iOS release and publication jobs verify the app code signature against `IOS_DISTRIBUTION_CERT_SHA256`. The publish job downloads the detached checksum, verifies the IPA again on macOS, and uses an immutable versioned release tag.
- Missing APK, AAB, IPA, or checksum files fail the job. Artifact upload failures are not ignored.
- npm audits include production and development dependencies because development tools produce the release binaries.

## Required GitHub Configuration

Configure `Mobile Signing` with required reviewers, deployment branch protection limited to `main`, and no administrator bypass. Keep Android and Apple signing credentials as environment secrets, not repository variables or files.

## Android Provenance Attestation

The Gradle trust set was regenerated on 2026-07-20 from an empty, isolated
Gradle home. Signature verification is enabled, the armored publisher keyring is
committed for review, and SHA-256 remains pinned for artifacts without an
available usable signature. Every checksum in the prior metadata remains in the
attested set; no prior digest changed or disappeared.

Both `assembleRelease` and `bundleRelease` completed with
`--dependency-verification=strict` and an isolated two-day attestation key. That
key and its artifacts were never copied into the repository and are not release
credentials. The protected workflow must repeat both builds with the real
`Mobile Signing` key and verify its certificate before publication.

The recorded procedure, hashes, counts, and residual key-server limitations are
in `docs/security/2026-07-20-android-gradle-attestation.md`. Any dependency or
Android Gradle Plugin change invalidates that review and requires a fresh
isolated regeneration and strict APK/AAB replay.

Gradle dependency locking is not enabled because the current Groovy build scripts do not activate locking for every Capacitor subproject. Direct dependency versions are fixed, and strict checksum verification pins the resolved transitive artifacts without changing project build behavior. Enabling lockfiles later requires a reviewed build-script change and a clean Android SDK build that exercises every release configuration.

## Release Verification

1. Confirm the protected environment approval identifies the intended commit.
2. Require `npm audit signatures` and the Swift lock check to pass.
3. Confirm the committed Gradle metadata and armored keyring match the reviewed
   attestation and that strict verification passes.
4. Require the signature-verification step to pass before downloading artifacts.
5. Compare downloaded APK and AAB hashes with `SHA256SUMS`.
6. Record the `SIGNING-MANIFEST.txt` commit and certificate fingerprint in the release evidence record.
7. Reject and rebuild any artifact whose hash or signing certificate differs.
