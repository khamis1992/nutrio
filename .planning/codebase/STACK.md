# Technology Stack

**Analysis Date:** 2025-02-14

## Languages

**Primary:**
- TypeScript [5.8.3] - All source files (`.ts`, `.tsx`)
- JavaScript - Build dependencies and Node.js modules

**Secondary:**
- Python 3.x - Build/reporting scripts (e.g., `create_report.py`)
- SQL - Supabase database schema and functions

## Runtime

**Environment:**
- Node.js [v22.x] - Development runtime
- Browser - ES2020+ support targeted

**Package Manager:**
- npm (via package-lock.json present)
- Lockfile: present (package-lock.json, 291KB)

## Frameworks

**Core:**
- React [18.3.1] - UI framework with hooks
- React Router [6.30.1] - Client-side routing
- Vite [5.4.19] - Build tool and dev server

**Mobile:**
- Capacitor [8.0.0] - Native app wrapper
  - @capacitor/android, @capacitor/ios
  - @capacitor/core, @capacitor/cli
  - @capacitor/app, @capacitor/device
  - @capacitor/haptics, @capacitor/keyboard
  - @capacitor/local-notifications, @capacitor/push-notifications
  - @capacitor/splash-screen, @capacitor/status-bar
  - @capgo/capacitor-native-biometric [8.0.3]

**UI:**
- Radix UI - Headless component primitives (@radix-ui/*)
- shadcn/ui - Component library built on Radix
- Tailwind CSS [3.4.17] - Utility-first CSS
- Lucide React [0.462.0] - Icon library
- Recharts [2.15.4] - Charting library

**State Management:**
- TanStack Query [5.83.0] - Server state management
- React Context API - Client state (AuthContext)

**Forms & Validation:**
- React Hook Form [7.61.1]
- Zod [3.25.76] - Schema validation
- @hookform/resolvers [3.10.0]

**Testing:**
- None configured (no test framework detected in project)

**Build/Dev:**
- @vitejs/plugin-react-swc [3.11.0] - Fast React refresh
- Terser [5.44.1] - JavaScript minification
- Autoprefixer [10.4.21]
- PostCSS [8.5.6]
- ESLint [9.32.0] - Linting
- TypeScript ESLint [8.38.0]

## Key Dependencies

**Backend Integration:**
- @supabase/supabase-js [2.89.0] - Supabase client (auth, database, storage)
- class-variance-authority [0.7.1] - Component variant utilities
- clsx [2.1.1], tailwind-merge [2.6.0] - Class name utilities

**Utilities:**
- date-fns [3.6.0] - Date manipulation
- sonner [1.7.4] - Toast notifications
- next-themes [0.3.0] - Theme/dark mode support

**UI Components:**
- cmdk [1.1.1] - Command palette
- embla-carousel-react [8.6.0] - Carousel/slider
- input-otp [1.4.2] - OTP input
- react-resizable-panels [2.1.9] - Resizable layouts
- vaul [0.9.9] - Drawer/sheet component
- react-day-picker [8.10.1] - Calendar date picker

## Configuration

**Environment:**
- Environment variables via `.env` file
- Required vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Configured through Vite's env system

**Build:**
- `vite.config.ts` - Vite configuration
  - Base path: `./` (production), `/` (development)
  - Dev server: port 8080
  - Build target: ESNext
  - Code splitting configured for vendors
  - Terser minification (drops console in production)

**TypeScript:**
- `tsconfig.json` - Project references setup
- `tsconfig.app.json` - Application code
- `tsconfig.node.json` - Build scripts
- Path alias: `@/*` → `./src/*`
- Strict mode disabled (noImplicitAny: false)

**Styling:**
- `tailwind.config.ts` - Tailwind configuration
- `postcss.config.js` - PostCSS processing
- CSS variables for theming (HSL color system)
- Custom animations and keyframes

**Linting:**
- `eslint.config.js` - Flat config format
- React hooks and refresh plugins enabled

## Platform Requirements

**Development:**
- Node.js 22.x or later
- npm or compatible package manager
- Modern browser with ES2020+ support
- For mobile: Android Studio (Android) / Xcode (iOS)

**Production:**
- Any modern browser (Chrome, Firefox, Safari, Edge)
- Supabase project (free tier compatible)
- For mobile apps:
  - Android API 21+ (Lollipop)
  - iOS 12+
- Static hosting (Vercel, Netlify, etc.) or any CDN

---

*Stack analysis: 2025-02-14*
