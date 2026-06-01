// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

// Note: This file has manual modifications for realtime and capacitor storage
// Do not regenerate without preserving these changes
import type { Database } from './types';
import { Preferences } from '@capacitor/preferences';
import { isNative } from '@/lib/capacitor';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Log a warning if Supabase config is missing, but DO NOT throw.
// Throwing at module level causes a white screen on Capacitor APK builds
// because it crashes React before the first render — error boundaries
// can't catch module-evaluation errors. Instead we fall back to placeholder
// values so the app renders and the user sees a meaningful error state.
// Common scenario: .env is gitignored and GitHub Secrets are not configured.
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    '[Nutrio] Missing Supabase configuration — app will start with placeholder values. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your build environment. ' +
    'Add them as GitHub Secrets for APK builds (Settings → Secrets and variables → Actions).'
  );
}

// Custom storage adapter for Capacitor that uses native Preferences.
// The `isAsyncStorage: true` flag is required by Supabase v2 when using
// an async storage backend (like Capacitor Preferences). Without this flag,
// Supabase may treat the adapter as synchronous and mishandle session reads,
// which can result in a perpetual loading state and a blank screen on launch.
const capacitorStorage = {
  isAsyncStorage: true as const,
  getItem: async (key: string): Promise<string | null> => {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key, value });
    } catch {
      // Silently fail — session will be lost on restart but app won't crash
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await Preferences.remove({ key });
    } catch {
      // Silently fail
    }
  },
};

const storage = isNative ? capacitorStorage : localStorage;

export const supabase = createClient<Database>(
  SUPABASE_URL ?? 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY ?? 'placeholder-key',
  {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        headers: {
          'x-custom-header': 'nutrio',
        },
      },
    },
  }
);