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
- Gradle dependency verification runs in strict mode against `android/gradle/verification-metadata.xml`.
- Android release jobs require exactly one APK and one AAB, verify both signatures against the protected keystore certificate, and publish artifact and certificate SHA-256 manifests.
- Android and iOS release versions are supplied by the protected release workflow; CI build numbers are used as monotonically increasing native build identifiers and verified from the built manifest.
- iOS release and publication jobs verify the app code signature against `IOS_DISTRIBUTION_CERT_SHA256`. The publish job downloads the detached checksum, verifies the IPA again on macOS, and uses an immutable versioned release tag.
- Missing APK, AAB, IPA, or checksum files fail the job. Artifact upload failures are not ignored.
- npm audits include production and development dependencies because development tools produce the release binaries.

## Required GitHub Configuration

Configure `Mobile Signing` with required reviewers, deployment branch protection limited to `main`, and no administrator bypass. Keep Android and Apple signing credentials as environment secrets, not repository variables or files.

## Android Provenance Release Blocker

The current Gradle verification metadata was generated from artifacts already
present in a build cache. Its checksums are enforced, but that initial trust set
has not been independently attested and `verify-signatures` remains disabled.
The signed Android workflow therefore fails before opening signing secrets while
this condition remains. Changing the XML flag alone is not an attestation.

Clear the blocker only on a disposable, isolated runner with no restored Gradle
cache:

1. Resolve every release configuration from the approved `google()` and
   `mavenCentral()` repositories.
2. Regenerate checksum and PGP verification metadata, compare every artifact
   with the committed set, and investigate every addition or changed digest.
3. Obtain publisher keys through independently authenticated channels, add the
   reviewed trusted keys, and enable signature verification. Retain SHA-256 for
   artifacts whose publishers provide no usable signature.
4. Run both release tasks with `--dependency-verification=strict`, archive the
   clean-runner logs and metadata diff, and obtain security review approval.

Gradle dependency locking is not enabled because the current Groovy build scripts do not activate locking for every Capacitor subproject. Direct dependency versions are fixed, and strict checksum verification pins the resolved transitive artifacts without changing project build behavior. Enabling lockfiles later requires a reviewed build-script change and a clean Android SDK build that exercises every release configuration.

## Release Verification

1. Confirm the protected environment approval identifies the intended commit.
2. Require `npm audit signatures` and the Swift lock check to pass.
3. Confirm the Gradle provenance blocker has been cleared with reviewed clean-runner evidence.
4. Require the signature-verification step to pass before downloading artifacts.
5. Compare downloaded APK and AAB hashes with `SHA256SUMS`.
6. Record the `SIGNING-MANIFEST.txt` commit and certificate fingerprint in the release evidence record.
7. Reject and rebuild any artifact whose hash or signing certificate differs.
