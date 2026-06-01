/**
 * Resolve a public asset path correctly for both web and Capacitor (native).
 *
 * On Capacitor (Android/iOS) the Vite build uses `base: './'` so all assets
 * are served from `https://localhost/` — a path like `/nutrio/logo.png` would
 * 404 because there is no `/nutrio/` prefix on the native WebView.
 *
 * On Vercel (web) the build uses `base: '/nutrio/'` so assets are served from
 * `/nutrio/` — a bare `/logo.png` would 404 there.
 *
 * This helper returns the correct absolute URL for a public asset regardless
 * of the deployment environment.
 *
 * Usage:
 *   import { assetPath } from '@/lib/asset-path';
 *   <img src={assetPath('/logo.png')} />
 *
 * @param path - Path relative to the public directory, starting with `/`
 */
export function assetPath(path: string): string {
  // import.meta.env.BASE_URL is set by Vite to the configured base at build time:
  //   - './' for Capacitor builds (VERCEL env var not set)
  //   - '/nutrio/' for Vercel web builds
  // We strip the trailing slash from BASE_URL and prepend it to the path.
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  // path always starts with '/', so concatenation is safe
  return base + path;
}
