import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutriofuel.app',
  appName: 'Nutrio',
  webDir: 'dist',
  loggingBehavior: 'none',
  android: {
    allowMixedContent: false,
    minWebViewVersion: 149,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
    errorPath: 'unsupported-webview.html',
  },
  // Plugins configuration
  plugins: {
    SplashScreen: {
      // Keep the native splash visible until the app explicitly hides it
      // via splashScreen.hideFadeOut() in initializeNativeApp().
      // Setting launchAutoHide:false prevents the brief blank screen that
      // appears between the native splash disappearing and React rendering.
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      fadeInDuration: 200,
      fadeOutDuration: 300,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      sound: 'beep.wav',
    },
    NativeBiometric: {
      biometricsTitle: 'Biometric Authentication',
      biometricsSubtitle: 'Unlock with your biometrics',
      biometricsDescription: 'Scan your fingerprint or face to continue',
    },
  },
};

export default config;
