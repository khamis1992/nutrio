/**
 * Capacitor Native Features Wrapper
 *
 * This file provides safe access to Capacitor plugins
 * with graceful fallbacks when running in web browser.
 */

import { Capacitor } from '@capacitor/core';
import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';

// ========================================
// PLATFORM DETECTION
// ========================================

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isWeb = Capacitor.getPlatform() === 'web';

export const getPlatformInfo = async () => {
  const info = await Device.getInfo();
  const currentPlatform = Capacitor.getPlatform();
  return {
    currentPlatform,
    isNative,
    isIOS,
    isAndroid,
    isWeb,
    ...info,
  };
};

// ========================================
// HAPTIC FEEDBACK
// ========================================

export const haptics = {
  /**
   * Light impact for subtle feedback
   */
  light: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  },

  /**
   * Medium impact for general feedback
   */
  medium: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  },

  /**
   * Heavy impact for important feedback
   */
  heavy: async () => {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  },

  /**
   * Success notification vibration
   */
  success: async () => {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    }
  },

  /**
   * Warning notification vibration
   */
  warning: async () => {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Warning });
    }
  },

  /**
   * Error notification vibration
   */
  error: async () => {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Error });
    }
  },

  /**
   * Selection changed vibration (for pickers/sliders)
   */
  selection: async () => {
    if (isNative) {
      await Haptics.selectionChanged();
    }
  },

  /**
   * Vibrate with custom duration (Android only)
   */
  vibrate: async (duration: number = 300) => {
    if (isNative && isAndroid) {
      // Use notification pattern for vibration
      await Haptics.notification({ type: NotificationType.Success });
    }
  },
};

// ========================================
// STATUS BAR
// ========================================

export const statusBar = {
  /**
   * Set status bar style
   */
  setStyle: async (style: Style) => {
    if (isNative) {
      await StatusBar.setStyle({ style });
    }
  },

  /**
   * Set status bar background color
   */
  setBackgroundColor: async (color: string) => {
    if (isNative) {
      await StatusBar.setBackgroundColor({ color });
    }
  },

  /**
   * Show status bar
   */
  show: async () => {
    if (isNative) {
      await StatusBar.show();
    }
  },

  /**
   * Hide status bar
   */
  hide: async () => {
    if (isNative) {
      await StatusBar.hide();
    }
  },

  /**
   * Set overlay mode
   */
  setOverlaysWebView: async (overlay: boolean) => {
    if (isNative) {
      await StatusBar.setOverlaysWebView({ overlay });
    }
  },
};

// ========================================
// SPLASH SCREEN
// ========================================

export const splashScreen = {
  /**
   * Show splash screen
   */
  show: async () => {
    if (isNative) {
      await SplashScreen.show({
        autoHide: false,
      });
    }
  },

  /**
   * Hide splash screen
   */
  hide: async () => {
    if (isNative) {
      await SplashScreen.hide();
    }
  },

  /**
   * Hide splash screen with fade out animation
   */
  hideFadeOut: async (fadeOutDuration: number = 300) => {
    if (isNative) {
      await SplashScreen.hide({
        fadeOutDuration,
      });
    }
  },
};

// ========================================
// KEYBOARD
// ========================================

export const keyboard = {
  /**
   * Show keyboard
   */
  show: async () => {
    if (isNative) {
      await Keyboard.show();
    }
  },

  /**
   * Hide keyboard
   */
  hide: async () => {
    if (isNative) {
      await Keyboard.hide();
    }
  },

  /**
   * Set keyboard resize mode
   */
  setResizeMode: async (mode: 'none' | 'native' | 'body') => {
    if (isNative) {
      // Cast to any to bypass strict type checking - these are valid values
      await Keyboard.setResizeMode({ mode: mode as any });
    }
  },

  /**
   * Listen for keyboard show events
   */
  onShow: (callback: () => void) => {
    if (isNative) {
      Keyboard.addListener('keyboardWillShow', callback);
    }
  },

  /**
   * Listen for keyboard hide events
   */
  onHide: (callback: () => void) => {
    if (isNative) {
      Keyboard.addListener('keyboardWillHide', callback);
    }
  },
};

// ========================================
// APP STATE & URL
// ========================================

export const app = {
  /**
   * Get current URL
   */
  getUrl: async () => {
    if (isNative) {
      return await App.getLaunchUrl();
    }
    return null;
  },

  /**
   * Get app state info
   */
  getState: async () => {
    if (isNative) {
      return await App.getState();
    }
    return null;
  },

  /**
   * Listen for app state changes (active/inactive)
   */
  onAppStateChange: (callback: (state: { isActive: boolean }) => void) => {
    if (isNative) {
      App.addListener('appStateChange', callback);
    }
  },

  /**
   * Listen for app URL open events
   */
  onUrlOpen: (callback: (data: { url: string }) => void) => {
    if (isNative) {
      App.addListener('appUrlOpen', callback);
    }
  },

  /**
   * Exit the app (Android only)
   */
  exitApp: async () => {
    if (isNative) {
      await App.exitApp();
    }
  },
};

// ========================================
// PUSH NOTIFICATIONS
// ========================================

export const pushNotifications = {
  /**
   * Request permission for push notifications
   */
  requestPermissions: async () => {
    if (isNative) {
      return await PushNotifications.requestPermissions();
    }
    return { receive: 'denied' } as const;
  },

  /**
   * Check current permission status
   */
  checkPermissions: async () => {
    if (isNative) {
      return await PushNotifications.checkPermissions();
    }
    return { receive: 'denied' } as const;
  },

  /**
   * Register for push notifications
   */
  register: async () => {
    if (isNative) {
      await PushNotifications.register();
    }
  },

  /**
   * Get delivered notifications
   */
  getDeliveredNotifications: async () => {
    if (isNative) {
      return await PushNotifications.getDeliveredNotifications();
    }
    return { notifications: [] };
  },

  /**
   * Remove delivered notifications
   */
  removeDeliveredNotifications: async (notifications: any[]) => {
    if (isNative) {
      await PushNotifications.removeDeliveredNotifications({ notifications });
    }
  },

  /**
   * Remove all delivered notifications
   */
  removeAllDeliveredNotifications: async () => {
    if (isNative) {
      await PushNotifications.removeAllDeliveredNotifications();
    }
  },

  /**
   * Listen for push notification received
   */
  onPushNotificationReceived: (callback: (notification: any) => void) => {
    if (isNative) {
      PushNotifications.addListener('pushNotificationReceived', callback);
    }
  },

  /**
   * Listen for push notification token
   */
  onPushNotificationToken: (callback: (token: any) => void) => {
    if (isNative) {
      PushNotifications.addListener('registration', callback);
    }
  },

  /**
   * Listen for push notification action performed
   */
  onPushNotificationActionPerformed: (callback: (action: any) => void) => {
    if (isNative) {
      PushNotifications.addListener('pushNotificationActionPerformed', callback);
    }
  },
};

// ========================================
// LOCAL NOTIFICATIONS
// ========================================

export const localNotifications = {
  /**
   * Schedule a local notification
   */
  schedule: async (notifications: any[]) => {
    if (isNative) {
      return await LocalNotifications.schedule({ notifications });
    }
    return null;
  },

  /**
   * Cancel pending notifications
   */
  cancel: async (options?: { notifications: { id: number }[] }) => {
    if (isNative) {
      // Handle undefined case
      const cancelOptions = options ?? { notifications: [] };
      await LocalNotifications.cancel(cancelOptions as any);
    }
  },

  /**
   * Get list of pending notifications
   */
  getPending: async () => {
    if (isNative) {
      return await LocalNotifications.getPending();
    }
    return { notifications: [] };
  },

  /**
   * Register for action types
   */
  registerActionTypes: async (actionTypes: any[]) => {
    if (isNative) {
      await LocalNotifications.registerActionTypes({ types: actionTypes });
    }
  },

  /**
   * Listen for notification action performed
   */
  onActionPerformed: (callback: (notification: any) => void) => {
    if (isNative) {
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        callback(action.notification);
      });
    }
  },
};

// ========================================
// BIOMETRIC AUTHENTICATION
// ========================================

export const biometricAuth = {
  /**
   * Check if biometric authentication is available
   */
  isAvailable: async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  },

  /**
   * Get the type of biometric authentication available
   */
  getBiometricType: async (): Promise<string> => {
    if (!isNative) return '';
    try {
      const result = await NativeBiometric.isAvailable();
      // Compare against BiometryType enum values
      const biometryType = result.biometryType;
      if (biometryType === BiometryType.FACE_ID) return 'Face ID';
      if (biometryType === BiometryType.TOUCH_ID) return 'Touch ID';
      if (biometryType === BiometryType.FINGERPRINT) return 'Fingerprint';
      return 'Biometric';
    } catch {
      return '';
    }
  },

  /**
   * Authenticate user with biometrics
   */
  authenticate: async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      // verifyIdentity returns void on success, throws on failure
      await NativeBiometric.verifyIdentity({
        reason: 'Please authenticate to continue',
        title: 'Biometric Authentication',
        subtitle: 'Unlock with your biometrics',
        description: 'Scan your fingerprint or face to continue',
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Set credentials for biometric login (stores email/password securely)
   */
  setCredentials: async (email: string, password: string): Promise<void> => {
    if (!isNative) return;
    try {
      await NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: 'com.nutriofuel.app',
      });
    } catch (error) {
      console.error('Error setting biometric credentials:', error);
    }
  },

  /**
   * Get stored credentials for biometric login
   */
  getCredentials: async (): Promise<{ username: string; password: string } | null> => {
    if (!isNative) return null;
    try {
      const credentials = await NativeBiometric.getCredentials({
        server: 'com.nutriofuel.app',
      });
      return {
        username: credentials.username,
        password: credentials.password,
      };
    } catch {
      return null;
    }
  },

  /**
   * Delete stored credentials
   */
  deleteCredentials: async (): Promise<void> => {
    if (!isNative) return;
    try {
      await NativeBiometric.deleteCredentials({
        server: 'com.nutriofuel.app',
      });
    } catch (error) {
      console.error('Error deleting biometric credentials:', error);
    }
  },

  /**
   * Check if credentials are stored
   */
  hasCredentials: async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const credentials = await NativeBiometric.getCredentials({
        server: 'com.nutriofuel.app',
      });
      return !!credentials.username;
    } catch {
      return false;
    }
  },
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Initialize app with native settings.
 *
 * IMPORTANT: The splash screen is NOT hidden here immediately. Instead, we
 * hide it after a short delay to ensure React has had time to render the
 * first meaningful frame. This prevents the blank white screen that appears
 * when the native splash hides before the WebView has painted anything.
 *
 * The capacitor.config.ts sets launchAutoHide:false so the native splash
 * stays visible until we explicitly call hideFadeOut() below.
 */
export const initializeNativeApp = async () => {
  if (!isNative) return;

  try {
    // Set status bar style — do NOT overlay so content stays below the status bar
    await statusBar.setStyle(Style.Light);
    await statusBar.setOverlaysWebView(false);

    // Give React ~500ms to render the first frame before hiding the native
    // splash screen. This prevents the blank white flash between the splash
    // and the first rendered UI.
    setTimeout(async () => {
      try {
        await splashScreen.hideFadeOut(300);
      } catch (e) {
        console.warn('Could not hide splash screen:', e);
      }
    }, 500);

    // Request notification permissions (non-blocking)
    pushNotifications.checkPermissions().catch((err) =>
      console.warn('Push notification permission check failed:', err)
    );

    console.log('Native app initialized successfully');
  } catch (error) {
    console.error('Error initializing native app:', error);
    // Ensure splash is hidden even if initialization fails
    try { await splashScreen.hideFadeOut(300); } catch {}
  }
};

/**
 * Show haptic feedback for UI actions
 */
export const hapticFeedback = {
  buttonPress: () => haptics.light(),
  success: () => haptics.success(),
  error: () => haptics.error(),
  warning: () => haptics.warning(),
  tabSwitch: () => haptics.selection(),
  cardPress: () => haptics.medium(),
  importantAction: () => haptics.heavy(),
};

export default {
  isNative,
  isIOS,
  isAndroid,
  isWeb,
  getPlatformInfo,
  haptics,
  statusBar,
  splashScreen,
  keyboard,
  app,
  pushNotifications,
  localNotifications,
  biometricAuth,
  initializeNativeApp,
  hapticFeedback,
};
