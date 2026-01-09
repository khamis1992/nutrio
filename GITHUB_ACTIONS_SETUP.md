# GitHub Actions for Android APK Builds

This repository includes automated workflows for building Android APK files using GitHub Actions.

---

## 📋 Available Workflows

### 1. **Build Android APK** (`.github/workflows/build-android-apk.yml`)

**Triggers:**
- Push to `main` or `develop` branch
- Pull request to `main` or `develop` branch
- Manual trigger (workflow dispatch)

**Builds:**
- Debug APK (default)
- Release APK (when manually selected)

**Usage:**
1. Go to **Actions** tab in your GitHub repository
2. Select **"Build Android APK"**
3. Click **"Run workflow"**
4. Choose build type: `debug` or `release`
5. Download the APK from the artifacts section

---

### 2. **Build Android Release** (`.github/workflows/build-android-release.yml`)

**Triggers:**
- Git tag push (e.g., `git tag v1.0.0 && git push --tags`)
- Manual trigger (workflow dispatch)

**Builds:**
- Release APK (for direct installation)
- Release AAB (for Play Store submission)

**Usage:**
```bash
# Create and push a new version tag
git tag v1.0.0
git push origin v1.0.0
```

The workflow will automatically build both APK and AAB files.

---

## 🚀 Quick Start

### Option 1: Automatic Build on Push

Simply push your code to the `main` branch:

```bash
git add .
git commit -m "Update app"
git push origin main
```

The workflow will automatically build a debug APK.

---

### Option 2: Manual Build with Workflow Dispatch

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Select **"Build Android APK"** from the left sidebar
4. Click **"Run workflow"** button
5. Select branch
6. Choose build type: `debug` or `release`
7. Click **"Run workflow"**

---

### Option 3: Tag-based Release Build

```bash
# Create a new version tag
git tag v1.0.0 -m "Release version 1.0.0"

# Push the tag to trigger the release build
git push origin v1.0.0
```

This will build both APK and AAB files with proper versioning.

---

## 🔐 Setting Up Signed Builds (Optional)

For production releases, you can set up automatic APK signing.

### Step 1: Generate a Keystore

Run this command on your machine:

```bash
keytool -genkey -v -keystore release.keystore -alias nutrio-fuel -keyalg RSA -keysize 2048 -validity 10000
```

**Important:** Store the keystore file and passwords securely!

### Step 2: Convert Keystore to Base64

```bash
# On Linux/Mac
base64 -i release.keystore | pbcopy

# On Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) | Set-Clipboard
```

### Step 3: Add GitHub Secrets

Go to your repository **Settings → Secrets and variables → Actions** and add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `ANDROID_KEYSTORE_BASE64` | Base64 encoded keystore file | `VGVzdCBrZXlz...` |
| `ANDROID_KEY_ALIAS` | Key alias name | `nutrio-fuel` |
| `ANDROID_KEY_PASSWORD` | Key password | `your-password` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | `your-password` |

### Step 4: Update Android Build Configuration

Edit `android/app/build.gradle` to use signing config:

```gradle
android {
    signingConfigs {
        release {
            if (System.getenv("KEYSTORE_FILE")) {
                storeFile file(System.getenv("KEYSTORE_FILE"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 📥 Downloading Built APKs

### From GitHub Actions

1. Go to the **Actions** tab
2. Click on the workflow run
3. Scroll down to the **Artifacts** section
4. Download the APK file

### Direct Artifact Links

After a build completes, you can download artifacts from:
```
https://github.com/YOUR_USERNAME/nutrio-fuel-main/actions/workflows/build-android-apk.yml
```

---

## 🛠 Workflow Configuration

### Environment Variables

You can customize these variables in the workflow files:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_VERSION` | `20` | Node.js version |
| `JAVA_VERSION` | `17` | Java version for Gradle |

### Build Types

| Type | Description | Use Case |
|------|-------------|----------|
| `debug` | Debug build with logging | Development, testing |
| `release` | Release build minified | Production, beta testing |

---

## 📊 Build Information

Each build includes:

- ✅ Automatic dependency caching
- ✅ Parallel build steps
- ✅ Artifact retention (30-90 days)
- ✅ Build summary with APK info
- ✅ Version tagging support

---

## 🔧 Troubleshooting

### Build Fails

**Check:**
1. Node.js version compatibility
2. Java version (should be 17)
3. Gradle wrapper permissions
4. Android SDK installation

### Common Issues

**Issue:** "Permission denied (gradlew)"
```bash
# Solution is already in workflow
chmod +x android/gradlew
```

**Issue:** "Out of memory"
```gradle
# Add to android/gradle.properties
org.gradle.jvmargs=-Xmx2048m
```

**Issue:** "Build timeout"
- Check build logs for errors
- Verify all dependencies are installed
- Check web app build is successful

---

## 📱 Testing the APK

### Install on Android Device

1. Download the APK from GitHub Actions
2. Transfer to your Android device
3. Enable **"Install unknown apps"** in settings
4. Open the APK file to install

### Install on Emulator

```bash
# Using Android Emulator
adb install app-debug.apk

# Or via Android Studio
# Drag and drop APK to emulator
```

---

## 🚀 Deployment to Play Store

### Using AAB File

1. Download the AAB artifact
2. Go to [Google Play Console](https://play.google.com/console)
3. Create a new release
4. Upload the AAB file
5. Complete the release information
6. Submit for review

### Automated Upload (Optional)

You can extend the workflow to automatically upload to Play Store using:

- [Google Play Publisher CLI](https://github.com/Triple-T/gradle-play-publisher)
- [Fastlane](https://fastlane.tools/)
- GitHub Actions with Play Publisher

---

## 📝 Best Practices

1. **Tag your releases:** Use semantic versioning (v1.0.0, v1.1.0, etc.)
2. **Test before release:** Always test debug APK first
3. **Keep secrets secure:** Never commit keystore or passwords
4. **Monitor build times:** Optimize if builds take too long
5. **Review artifacts:** Download and test APK before distribution

---

## 🔗 Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Android App Bundles](https://developer.android.com/guide/app-bundle)
- [Play Console](https://play.google.com/console)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)

---

## 💡 Tips

- **Debug builds** are faster and include logging - use for development
- **Release builds** are smaller and optimized - use for production
- **AAB files** are required for Play Store submission
- **APK files** can be shared directly for testing

---

## 🎯 Quick Commands

```bash
# Trigger debug build
git push origin main

# Trigger release build with tag
git tag v1.0.0 && git push origin v1.0.0

# Manual trigger: Use GitHub UI → Actions → Run workflow
```
