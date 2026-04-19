/**
 * Platform-Specific Design Tokens for Native Mobile Experience
 * 
 * This file defines design tokens that differ between iOS and Android
 * to create authentic native mobile experiences.
 */

import { isIOS, isAndroid } from '@/lib/capacitor';

// ========================================
// TOUCH TARGET SIZES (iOS HIG vs Material Design)
// ========================================

export const touchTargets = {
  /**
   * iOS Human Interface Guidelines: 44pt minimum
   * But smaller is acceptable for secondary actions
   */
  ios: {
    minimum: 44,        // 44x44 min for primary actions
    secondary: 40,      // 40x40 for secondary
    small: 32,          // 32x32 for icon-only small actions
    large: 56,          // 56x56 for large touch areas
  },
  /**
   * Material Design: 48dp minimum
   * Consistent touch target size
   */
  android: {
    minimum: 48,       // 48x48 standard touch target
    secondary: 44,     // 44x44 for compact
    small: 36,         // 36x36 for small icons
    large: 64,         // 64x64 for large touch areas
  },
  /**
   * Web fallback (use iOS as default)
   */
  web: {
    minimum: 44,
    secondary: 40,
    small: 32,
    large: 56,
  },
};

/**
 * Get platform-appropriate touch target size
 */
export const getTouchTargetSize = (type: 'minimum' | 'secondary' | 'small' | 'large' = 'minimum') => {
  if (isIOS) return touchTargets.ios[type];
  if (isAndroid) return touchTargets.android[type];
  return touchTargets.web[type];
};

/**
 * Get responsive class based on platform
 */
export const getTouchClass = (type: 'minimum' | 'secondary' | 'small' | 'large' = 'minimum') => {
  const size = getTouchTargetSize(type);
  return `w-[${size}px] h-[${size}px]`;
};

// ========================================
// CORNER RADIUS (iOS HIG vs Material Design)
// ========================================

export const cornerRadius = {
  /**
   * iOS Human Interface Guidelines: 10-16px for cards
   * Smaller, subtle rounding for native feel
   */
  ios: {
    Card: 12,
    Modal: 16,
    Button: 12,
    Badge: 10,
    Avatar: 12,
    Sheet: 14,
    Dialog: 18,
    Navigation: 10,
    BottomSheet: 24,
  },
  /**
   * Material Design: 4-12px for cards
   * More rounded for floating elements
   */
  android: {
    Card: 4,
    Modal: 8,
    Button: 8,
    Badge: 16,
    Avatar: 4,
    Sheet: 8,
    Dialog: 12,
    Navigation: 8,
    BottomSheet: 16,
  },
  /**
   * Web fallback (use iOS as default)
   */
  web: {
    Card: 12,
    Modal: 16,
    Button: 12,
    Badge: 10,
    Avatar: 12,
    Sheet: 14,
    Dialog: 18,
    Navigation: 10,
    BottomSheet: 24,
  },
};

/**
 * Get platform-appropriate corner radius
 */
export const getRadius = (type: keyof typeof cornerRadius.ios = 'Card') => {
  if (isIOS) return cornerRadius.ios[type];
  if (isAndroid) return cornerRadius.android[type];
  return cornerRadius.web[type];
};

/**
 * Get responsive rounded class based on platform
 */
export const getRadiusClass = (type: keyof typeof cornerRadius.ios = 'Card') => {
  const radius = getRadius(type);
  return `rounded-[${radius}px]`;
};

// ========================================
// ANIMATION TOKENS (Platform-Specific)
// ========================================

export const animations = {
  /**
   * iOS Spring Animation (Apple's HIG standard)
   * spring.stiffness: 400-2000
   * spring.damping: 20-30
   * spring.mass: 1
   * bounce: minimal (0.1-0.3)
   */
  ios: {
    spring: {
      stiffness: 400,
      damping: 25,
      mass: 1,
    },
    /**
     * iOS spring easing curve
     * Similar to UIKit's easeInOutBack
     */
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    /**
     * iOS transition durations
     */
    durations: {
      SHORT: 200,
      MEDIUM: 300,
      LONG: 500,
    },
  },
  /**
   * Material Design (Android)
   * Standard cubic-bezier for Material 3
   */
  android: {
    spring: {
      stiffness: 300,
      damping: 30,
      mass: 1,
    },
    /**
     * Material 3 standard easing
     * cubic-bezier(0.2, 0.0, 0, 1.0) - entrance
     * cubic-bezier(0.3, 0.0, 0.8, 0.15) - exit
     */
    easing: 'cubic-bezier(0.2, 0.0, 0, 1.0)',
    /**
     * Material transition durations
     */
    durations: {
      SHORT: 150,
      MEDIUM: 250,
      LONG: 400,
    },
  },
  /**
   * Web fallback (use iOS as default)
   */
  web: {
    spring: {
      stiffness: 400,
      damping: 25,
      mass: 1,
    },
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    durations: {
      SHORT: 200,
      MEDIUM: 300,
      LONG: 500,
    },
  },
};

/**
 * Get platform-appropriate animation configuration
 */
export const getAnimationConfig = (type: 'spring' | 'easing' | 'durations' = 'spring') => {
  if (isIOS) return animations.ios[type];
  if (isAndroid) return animations.android[type];
  return animations.web[type];
};

/**
 * Get animation duration in ms
 */
export const getDuration = (durationType: 'SHORT' | 'MEDIUM' | 'LONG' = 'MEDIUM') => {
  const durations = { SHORT: 200, MEDIUM: 300, LONG: 500 };
  return durations[durationType];
};

// ========================================
// PROGRESS INDICATOR STYLES (Platform-Specific)
// ========================================

export const progressBarStyles = {
  /**
   * iOS native progress indicator
   * Ring with spring animation, minimal decoration
   */
  ios: {
    strokeWidth: 6,
    trackColor: '#F3F4F6',
    indicatorColor: '#111827',
    indicatorColorWarning: '#F59E0B',
    indicatorColorDanger: '#EF4444',
    size: {
      small: 48,
      medium: 64,
      large: 80,
    },
  },
  /**
   * Android Material circular progress
   * Indeterminate spinning, thick stroke
   */
  android: {
    strokeWidth: 4,
    trackColor: 'rgba(0,0,0,0.1)',
    indicatorColor: '#10B981',
    indicatorColorWarning: '#F59E0B',
    indicatorColorDanger: '#EF4444',
    size: {
      small: 40,
      medium: 48,
      large: 64,
    },
  },
  /**
   * Web fallback (use iOS as default)
   */
  web: {
    strokeWidth: 6,
    trackColor: '#F3F4F6',
    indicatorColor: '#111827',
    indicatorColorWarning: '#F59E0B',
    indicatorColorDanger: '#EF4444',
    size: {
      small: 48,
      medium: 64,
      large: 80,
    },
  },
};

/**
 * Get platform-appropriate progress bar style
 */
export const getProgressBarStyle = (
  key: keyof typeof progressBarStyles.ios | 'size',
  size?: 'small' | 'medium' | 'large'
) => {
  if (isIOS) {
    if (size && key === 'size') return progressBarStyles.ios.size[size];
    return progressBarStyles.ios[key as keyof typeof progressBarStyles.ios];
  }
  if (isAndroid) {
    if (size && key === 'size') return progressBarStyles.android.size[size];
    return progressBarStyles.android[key as keyof typeof progressBarStyles.android];
  }
  if (size && key === 'size') return progressBarStyles.web.size[size];
  return progressBarStyles.web[key as keyof typeof progressBarStyles.web];
};

// ========================================
// BOTTOM NAVIGATION STYLES (Platform-Specific)
// ========================================

export const bottomNavStyles = {
  /**
   * iOS Bottom Navigation
   * Smaller, compact, consistent tab bar height
   */
  ios: {
    height: 83, // 49px nav + 34px home indicator safe area
    safeBottom: 'max(14px, env(safe-area-inset-bottom))',
    itemPaddingX: 8,
    itemPaddingY: 4,
    iconSize: 24,
    fontSize: 10,
  },
  /**
   * Android Bottom Navigation
   * Larger, more spacious, consistent with Material 3
   */
  android: {
    height: 88, // 56px nav + 32px bottom nav padding
    safeBottom: '32px',
    itemPaddingX: 12,
    itemPaddingY: 8,
    iconSize: 24,
    fontSize: 12,
  },
  /**
   * Web fallback (use iOS as default)
   */
  web: {
    height: 83,
    safeBottom: 'max(14px, env(safe-area-inset-bottom))',
    itemPaddingX: 8,
    itemPaddingY: 4,
    iconSize: 24,
    fontSize: 10,
  },
};

/**
 * Get platform-appropriate bottom navigation style
 */
export const getBottomNavStyle = (key: keyof typeof bottomNavStyles.ios) => {
  if (isIOS) return bottomNavStyles.ios[key];
  if (isAndroid) return bottomNavStyles.android[key];
  return bottomNavStyles.web[key];
};

// ========================================
// DIALOG / SHEET STYLES (Platform-Specific)
// ========================================

export const sheetStyles = {
  /**
   * iOS Bottom Sheet
   * 60-70% of screen height, grab handle, rounded corners
   */
  ios: {
    maxHeight: '70vh',
    cornerRadius: 14,
    hasGrabHandle: true,
    grabHandleSize: 'w-12 h-1.5',
    dragIndicator: 'bg-gray-300',
  },
  /**
   * Android Material Bottom Sheet
   * Full or 80% height, material rounding
   */
  android: {
    maxHeight: '80vh',
    cornerRadius: 16,
    hasGrabHandle: false,
    grabHandleSize: 'w-10 h-1 bg-gray-400 rounded-full',
    dragIndicator: 'bg-gray-400',
  },
  /**
   * Web fallback (use iOS as default)
   */
  web: {
    maxHeight: '70vh',
    cornerRadius: 14,
    hasGrabHandle: true,
    grabHandleSize: 'w-12 h-1.5',
    dragIndicator: 'bg-gray-300',
  },
};

/**
 * Get platform-appropriate sheet style
 */
export const getSheetStyle = (key: keyof typeof sheetStyles.ios) => {
  if (isIOS) return sheetStyles.ios[key];
  if (isAndroid) return sheetStyles.android[key];
  return sheetStyles.web[key];
};

// ========================================
// PLATFORM UTILITY HOOK
// ========================================

/**
 * Hook to get current platform
 */
export const usePlatform = () => {
  return {
    isNative: true,
    isIOS,
    isAndroid,
    isWeb: !isIOS && !isAndroid,
  };
};

/**
 * Hook to get runtime platform-specific values
 */
export const usePlatformDesignTokens = () => {
  const platform = usePlatform();
  
  return {
    platform,
    touchTarget: getTouchTargetSize(),
    cornerRadius: getRadius(),
    animationConfig: getAnimationConfig(),
    progressBarStyle: getProgressBarStyle('strokeWidth'),
    bottomNav: getBottomNavStyle('height'),
  };
};

// ========================================
// EXPORT ALL DESIGN TOKENS
// ========================================

export const designTokens = {
  touchTargets,
  cornerRadius,
  animations,
  progressBarStyles,
  bottomNavStyles,
  sheetStyles,
  getTouchTargetSize,
  getRadius,
  getAnimationConfig,
  getDuration,
  getProgressBarStyle,
  getBottomNavStyle,
  getSheetStyle,
  usePlatform,
  usePlatformDesignTokens,
};

export default designTokens;
