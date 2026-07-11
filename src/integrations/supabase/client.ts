// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

// Note: This file has manual modifications for realtime and capacitor storage
// Do not regenerate without preserving these changes
import type { Database } from './types';
import { Preferences } from '@capacitor/preferences';
import { isNative } from '@/lib/capacitor';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PLACEHOLDER_SUPABASE_URL = 'https://placeholder.supabase.co';

const getSupabaseConfigError = () => {
  const url = typeof SUPABASE_URL === 'string' ? SUPABASE_URL.trim() : '';
  const key = typeof SUPABASE_PUBLISHABLE_KEY === 'string' ? SUPABASE_PUBLISHABLE_KEY.trim() : '';

  if (!url || !key) {
    return 'Supabase is not configured. Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.';
  }

  if (url.includes('placeholder') || url.includes('your-supabase-project')) {
    return 'Supabase URL is still using a placeholder. Set VITE_SUPABASE_URL to your real Supabase project URL, then restart the dev server.';
  }

  try {
    const parsed = new URL(url);
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isSupabase = parsed.hostname.endsWith('.supabase.co');

    if (!isHttp || (!isLocal && !isSupabase)) {
      return 'Supabase URL is invalid. Use a Supabase project URL like https://project-ref.supabase.co or a local Supabase URL.';
    }
  } catch {
    return 'Supabase URL is invalid. Check VITE_SUPABASE_URL in your environment and restart the dev server.';
  }

  if (key.includes('placeholder') || key.includes('your-supabase-publishable-key')) {
    return 'Supabase publishable key is still using a placeholder. Set VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.';
  }

  return null;
};

export const supabaseConfigError = getSupabaseConfigError();
export const isSupabaseConfigured = supabaseConfigError === null;

const guardedFetch: typeof fetch = (input, init) => {
  if (supabaseConfigError) {
    return Promise.reject(new Error(supabaseConfigError));
  }

  return fetch(input, init);
};

// Log a warning if Supabase config is missing, but DO NOT throw.
// Throwing at module level causes a white screen on Capacitor APK builds
// because it crashes React before the first render — error boundaries
// can't catch module-evaluation errors. Instead we fall back to placeholder
// values so the app renders and the user sees a meaningful error state.
// Common scenario: .env is gitignored and GitHub Secrets are not configured.
if (supabaseConfigError) {
  console.warn(
    `[Nutrio] ${supabaseConfigError} ` +
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

// Smart storage adapter for web:
// - If "remember_me" flag is set in localStorage → use localStorage (session persists across browser restarts)
// - Otherwise → use sessionStorage (session ends when browser/tab is closed)
// This implements true "Remember Me" behaviour without requiring a different Supabase client instance.
const webSmartStorage = {
  getItem: (key: string): string | null => {
    try {
      // Always check localStorage first (covers "remember me" users and existing sessions)
      const local = localStorage.getItem(key);
      if (local) return local;
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      const rememberMe = localStorage.getItem('nutrio_remember_me') === 'true';
      if (rememberMe) {
        localStorage.setItem(key, value);
        // Clean up sessionStorage copy if it exists
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        // Clean up localStorage copy so old sessions don't linger
        localStorage.removeItem(key);
      }
    } catch {
      // Silently fail
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  },
};

const storage = isNative ? capacitorStorage : webSmartStorage;

export const supabase = createClient<Database>(
  isSupabaseConfigured ? SUPABASE_URL : PLACEHOLDER_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY ?? 'placeholder-key',
  {
    global: {
      fetch: guardedFetch,
    },
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
