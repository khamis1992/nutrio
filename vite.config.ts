import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use relative paths for Capacitor
  base: mode === 'production' ? './' : '/',
  server: {
    host: "::",
    port: 8080,
    // Allow access from local network for mobile testing
    strictPort: true,
    watch: {
      // Watch for changes in the src directory
      ignored: ['!**/node_modules/**', '!**/dist/**'],
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimizations for mobile
  build: {
    outDir: 'dist',
    // Target modern browsers for better performance
    target: 'esnext',
    // Enable sourcemaps for debugging
    sourcemap: mode === 'development',
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
