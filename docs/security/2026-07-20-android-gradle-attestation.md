# Android Gradle Provenance Attestation

Date: 2026-07-20  
Scope: Android release dependency graph for APK and AAB assembly

## Procedure

1. Installed the official Android command-line tools and verified the published
   archive SHA-256 before extraction.
2. Installed platform-tools, platform 36, and build-tools 36.0.0, and accepted
   the Android SDK licenses.
3. Created an isolated Android project copy and an empty Gradle home with no
   restored dependency cache.
4. Resolved release configurations and generated SHA-256 plus PGP verification
   metadata.
5. Exported the fetched publisher keys as an armored, reviewable keyring.
6. Confirmed that every one of the 398 prior SHA-256 entries remains present in
   the regenerated metadata. No prior checksum was missing.
7. Copied the Capacitor Android modules into a second isolated workspace so
   Gradle could compile without junction/file-lock interference.
8. Built both `assembleRelease` and `bundleRelease` with
   `--dependency-verification=strict --max-workers=1` and a disposable two-day
   RSA attestation key.

## Committed Trust Set

| Evidence | Value |
|---|---|
| Verification metadata SHA-256 | `19C39803D5B89F377A19A6C45A916F0DCB7490997A2E80739B06EBC86EA39F1A` |
| Armored keyring SHA-256 | `AC6A93BFB463766614B9006B26EAB3B6773574189D4207A6A4CFB743105E6154` |
| Components | 378 |
| Artifacts | 654 |
| SHA-256 entries | 652 |
| Trusted-key rules | 70 |
| Unavailable/ignored key IDs | 15 |
| Signature verification | Enabled |
| Prior checksums missing | 0 |

The 15 ignored IDs are keys Gradle could not retrieve from any configured key
server. They are not treated as trusted keys; corresponding artifacts remain
protected by committed SHA-256 values. The armored keyring, rather than the
binary export, is committed so reviewers can inspect publisher identities.

## Strict Build Evidence

The isolated strict build completed 738 Android tasks and produced:

| Artifact | Size | SHA-256 |
|---|---:|---|
| Attestation APK | 240,596,009 bytes | `8F2D5EAFAE3C7855FB2431864B8A36C3D695702905D303B2E127F95E7904A5CA` |
| Attestation AAB | 218,634,322 bytes | `015AC4D2ABDEC540F21025274FFF80FC5C4153D8AC18EF15C5DAC8ECFC16E99F` |

The APK signature verified with Android Signature Scheme v2. The AAB was signed
by the same disposable attestation certificate. These files are build evidence,
not publishable release artifacts, and the attestation private key is not part
of the repository.

## Remaining Release Evidence

- Run the protected GitHub workflow with the production Android keystore.
- Verify the APK and AAB certificate against the protected keystore fingerprint.
- Retain `SHA256SUMS` and `SIGNING-MANIFEST.txt` from that workflow.
- Install the production-signed APK on one Samsung and one stock Android device
  and complete the native accessibility, safe-area, keyboard, back, deep-link,
  notification, and offline-replay matrix.

Any dependency, repository, plugin, Gradle, or Android Gradle Plugin change
requires a fresh isolated attestation before release.
