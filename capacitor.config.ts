import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutriofuel.app',
  appName: 'Nutrio',
  webDir: 'dist',
  server: {
    // In development, you can proxy to your Vite dev server
    // In production, it serves the built files
    androidScheme: 'https',
    cleartext: true,
    // Allow navigation to Supabase and other external services
    allowNavigation: [
      'supabase.co',
      '*.supabase.co',
    ],
  },
  // Plugins configuration
  plugins: {
    SplashScreen: {
      launchShowDuration: 300,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
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
