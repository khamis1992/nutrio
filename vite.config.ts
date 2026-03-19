import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use absolute paths for Vercel web deployment
  // Use relative paths only for Capacitor mobile builds
  base: process.env.VERCEL ? '/' : (mode === 'production' ? './' : '/'),
  server: {
    host: "::",
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
      // Watch for changes in the src directory
      ignored: ['!**/node_modules/**', '!**/dist/**'],
    },
  },
  plugins: [
    react({
      // Improve HMR to prevent hook errors
      devTarget: 'es2020',
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
    include: ['react', 'react-dom', 'react/jsx-dev-runtime'],
    force: true,
  },
  // Optimizations for mobile
  build: {
    outDir: 'dist',
    // Target modern browsers for better performance
    target: 'esnext',
    // Enable sourcemaps for error tracking (Sentry needs these)
    sourcemap: true,
    // Optimize for mobile
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
      },
    },
    // Split chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'charts': ['recharts'],
        },
      },
    },
  },
}));
