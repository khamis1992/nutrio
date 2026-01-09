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
import type { listenerFunc } from '@capacitor/core';

// Dynamic import for biometric auth (only available in native)
const BiometricAuth = Capacitor.isNativePlatform()
  ? require('capacitor-biometric-auth').BiometricAuth
  : null;

// ========================================
// PLATFORM DETECTION
// ========================================

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isWeb = Capacitor.getPlatform() === 'web';

export const getPlatformInfo = async () => {
  const info = await Device.getInfo();
  return {
    platform: Capacitor.getPlatform(),
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
   * Selection feedback (for sliders, pickers)
   */
  selection: async () => {
    if (isNative) {
      await Haptics.selectionChanged();
    }
  },

  /**
   * Vibrate for custom duration (Android only)
   */
  vibrate: async (duration: number) => {
    if (isAndroid) {
      await Haptics.vibrate({ duration });
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
  setStyle: async (style: Style = Style.Light) => {
    if (isNative) {
      await StatusBar.setStyle({ style });
    }
  },

  /**
   * Set status bar background color (Android)
   */
  setBackgroundColor: async (color: string) => {
    if (isAndroid) {
      await StatusBar.setBackgroundColor({ color });
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
   * Show status bar
   */
  show: async () => {
    if (isNative) {
      await StatusBar.show();
    }
  },

  /**
   * Get status bar info
   */
  getInfo: async () => {
    if (isNative) {
      return await StatusBar.getInfo();
    }
    return null;
  },

  /**
   * Set status bar to overlay content
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
   * Hide splash screen
   */
  hide: async () => {
    if (isNative) {
      await SplashScreen.hide();
    }
  },

  /**
   * Show splash screen
   */
  show: async () => {
    if (isNative) {
      await SplashScreen.show();
    }
  },

  /**
   * Hide splash screen with fade out animation
   */
  hideFadeOut: async (duration = 500) => {
    if (isNative) {
      await SplashScreen.hide({ fadeOutDuration: duration });
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
   * Get keyboard info
   */
  getInfo: async () => {
    if (isNative) {
      return await Keyboard.getInfo();
    }
    return null;
  },

  /**
   * Set keyboard resize mode
   */
  setResizeMode: async (mode: 'ionic' | 'native' | 'body') => {
    if (isNative) {
      await Keyboard.setResizeMode({ mode });
    }
  },

  /**
   * Listen for keyboard show events
   */
  onShow: (callback: listenerFunc) => {
    if (isNative) {
      Keyboard.addListener('keyboardWillShow', callback);
    }
  },

  /**
   * Listen for keyboard hide events
   */
  onHide: (callback: listenerFunc) => {
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
   * Exit app (Android only)
   */
  exitApp: async () => {
    if (isAndroid) {
      App.exitApp();
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
    return { receive: 'never' };
  },

  /**
   * Check current permission status
   */
  checkPermissions: async () => {
    if (isNative) {
      return await PushNotifications.checkPermissions();
    }
    return { receive: 'never' };
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
   * Get token for push notifications
   */
  getToken: async () => {
    if (isNative) {
      // Note: Token is received in the 'registration' event listener
      return null;
    }
    return null;
  },

  /**
   * Listen for registration success
   */
  onRegistration: (callback: (token: string) => void) => {
    if (isNative) {
      PushNotifications.addListener('registration', (token) => {
        callback(token.value);
      });
    }
  },

  /**
   * Listen for registration errors
   */
  onRegistrationError: (callback: (error: any) => void) => {
    if (isNative) {
      PushNotifications.addListener('registrationError', callback);
    }
  },

  /**
   * Listen for incoming push notifications
   */
  onPushNotificationReceived: (callback: (notification: any) => void) => {
    if (isNative) {
      PushNotifications.addListener('pushNotificationReceived', callback);
    }
  },

  /**
   * Listen for push notification actions
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
  cancel: async () => {
    if (isNative) {
      await LocalNotifications.cancel();
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
      const { available } = await BiometricAuth.isAvailable();
      return available;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  },

  /**
   * Get biometric type (fingerprint, face, etc.)
   */
  getBiometricType: async (): Promise<string | null> => {
    if (!isNative) return null;
    try {
      const { biometricType } = await BiometricAuth.isAvailable();
      return biometricType || null;
    } catch (error) {
      console.error('Error getting biometric type:', error);
      return null;
    }
  },

  /**
   * Authenticate user with biometrics
   * @param reason - Reason shown to user (e.g., "Please authenticate to login")
   */
  authenticate: async (reason: string = 'Please authenticate'): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const { success } = await BiometricAuth.authenticate({
        reason,
        title: 'Biometric Authentication',
        subtitle: 'Use your fingerprint or face to continue',
        description: reason,
      });
      return success;
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      // User cancelled or authentication failed
      return false;
    }
  },

  /**
   * Check if biometric credentials are stored
   */
  hasCredentials: async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      // Check if we have stored credentials flag
      const hasStored = localStorage.getItem('biometric_enabled') === 'true';
      return hasStored;
    } catch (error) {
      return false;
    }
  },

  /**
   * Enable biometric login for current user
   */
  enableBiometric: async (email: string) => {
    if (!isNative) return;
    try {
      // Store that this user has enabled biometric
      localStorage.setItem('biometric_enabled', 'true');
      localStorage.setItem('biometric_email', email);
      await haptics.success();
    } catch (error) {
      console.error('Error enabling biometric:', error);
    }
  },

  /**
   * Disable biometric login
   */
  disableBiometric: async () => {
    if (!isNative) return;
    try {
      localStorage.removeItem('biometric_enabled');
      localStorage.removeItem('biometric_email');
    } catch (error) {
      console.error('Error disabling biometric:', error);
    }
  },

  /**
   * Get stored email for biometric login
   */
  getStoredEmail: (): string | null => {
    try {
      return localStorage.getItem('biometric_email');
    } catch (error) {
      return null;
    }
  },
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Initialize app with native settings
 */
export const initializeNativeApp = async () => {
  if (!isNative) return;

  try {
    // Set status bar style
    await statusBar.setStyle(Style.Light);
    await statusBar.setOverlaysWebView(true);

    // Hide splash screen after a delay
    setTimeout(() => {
      splashScreen.hideFadeOut();
    }, 2000);

    // Request notification permissions
    await pushNotifications.checkPermissions();

    console.log('Native app initialized successfully');
  } catch (error) {
    console.error('Error initializing native app:', error);
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
