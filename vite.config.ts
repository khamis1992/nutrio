import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use '/nutrio/' as the base path ONLY for Vercel web deployment.
  // For Capacitor mobile builds (APK/IPA) we MUST use './' (relative paths)
  // because the WebView loads assets from the local file:// / https://localhost
  // origin — a hardcoded '/nutrio/' prefix makes every asset request 404 and
  // the app shows a blank white screen.
  base: process.env.VERCEL ? '/nutrio/' : './',
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    // Allow access from local network for mobile testing
    strictPort: true,
    // Improve HMR reliability
    hmr: {
      overlay: false,
      timeout: 5000,
    },
    watch: {
      // Ignore node_modules, dist, and native build output dirs to reduce load
      ignored: ['**/node_modules/**', '**/dist/**', '**/ios/**', '**/android/**'],
    },
  },
  plugins: [
    {
      name: 'nutrio-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Redirect bare root to /nutrio/ so React Router's basename matches.
          // Without this, visiting http://localhost:5173/ produces a blank page
          // and the warning: "Router basename=/nutrio is not able to match URL /"
          if (req.url === '/' || req.url === '') {
            res.writeHead(301, { Location: '/nutrio/' });
            res.end();
            return;
          }
          if (req.url === '/nutrio') {
            res.writeHead(301, { Location: '/nutrio/' });
            res.end();
            return;
          }
          if (req.url === '/favicon.ico') {
            res.writeHead(301, { Location: '/nutrio/favicon.svg' });
            res.end();
            return;
          }
          next();
        });
      },
    },
    react({
      devTarget: 'es2020',
    }),
    // Transpile modern JS for older Android WebViews.
    // Without this, Capacitor APKs can show a white screen on devices
    // whose WebView doesn't support optional chaining, nullish coalescing,
    // or dynamic import (common on Samsung / older Android).
    // NOTE: Do NOT set build.target alongside this plugin — the legacy plugin
    // controls the output target automatically. Setting 'esnext' in build.target
    // causes a conflict warning and may produce incorrect bundles.
    legacy({
      targets: ['chrome >= 52', 'android >= 5'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      modernPolyfills: true,
    }),
    mode === "development" && componentTagger(),
    // Sentry plugin for source maps (only in production AND only when auth token is available)
    // Without this guard, the build fails silently when SENTRY_AUTH_TOKEN is not set
    mode === 'production' && !!process.env.SENTRY_AUTH_TOKEN && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Don't fail the build if Sentry upload fails
      errorHandler: (err) => { console.warn('[Sentry] Source map upload failed:', err.message); },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    exclude: [
      '@capacitor-community/google-fit',
      '@perfood/capacitor-healthkit',
      'tesseract.js',
    ],
  },
  // Optimizations for mobile
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    // NOTE: Do NOT set build.target here — @vitejs/plugin-legacy controls the
    // target automatically. Setting 'esnext' here causes the legacy plugin to
    // emit a warning and may produce incorrect output for older Android WebViews.
    // Enable sourcemaps for error tracking (Sentry needs these)
    sourcemap: true,
    // Optimize for mobile
    minify: 'terser',
    terserOptions: {
      compress: {
        // Strip dev-noise consoles in prod, but keep warn/error for Sentry breadcrumbs
        pure_funcs: mode === 'production'
          ? ['console.log', 'console.debug', 'console.info', 'console.trace']
          : [],
      },
    },
    // Split chunks for better caching
    rollupOptions: {
      external: [
        '@perfood/capacitor-healthkit',
        '@capacitor-community/google-fit',
      ],
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'charts': ['recharts'],
          // NOTE: 'dashboard' chunk was removed — it created a circular dependency
          // (dashboard -> ui-vendor -> dashboard) that caused module loading to fail
          // on Android WebView. Vite/Rollup will split Dashboard automatically.
          'meals': ['./src/pages/Meals.tsx'],
        },
      },
    },
  },
}));
