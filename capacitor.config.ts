import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutrio.app',
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
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#22c55e',
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
  },
};

export default config;
