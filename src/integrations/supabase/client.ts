// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

// Note: This file has manual modifications for realtime and capacitor storage
// Do not regenerate without preserving these changes
import type { Database } from './types';
import { Preferences } from '@capacitor/preferences';
import { isNative } from '@/lib/capacitor';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Guard: prevent crash if env vars are missing (e.g. APK built without secrets configured)
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    '[Nutrio] Missing Supabase configuration. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in your build environment. ' +
    'Current values - URL: ' + SUPABASE_URL + ', KEY: ' + SUPABASE_PUBLISHABLE_KEY
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