# External Integrations

**Analysis Date:** 2025-02-14

## APIs & External Services

**Authentication:**
- Supabase Auth - User authentication and session management
  - SDK: @supabase/supabase-js
  - Auth methods: Email/password sign-in and sign-up
  - Session persistence: localStorage
  - Auto-refresh enabled
  - Env vars: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

**Database:**
- Supabase PostgreSQL - Managed PostgreSQL database
  - Client: Supabase JS client v2.89.0
  - Connection: Automatic via SDK
  - Realtime subscriptions: Available but not extensively used
  - Row Level Security (RLS): Enabled on Supabase

**File Storage:**
- Supabase Storage - Meal images, restaurant logos, user avatars
  - Client: Supabase JS client
  - Buckets: meals, restaurants, avatars (implied from usage)
  - Public URL generation for images

**Push Notifications:**
- Capacitor Push Notifications - Native push notifications
  - Provider: Firebase/FCM (Android), APNs (iOS)
  - Plugin: @capacitor/push-notifications
  - Local notifications: @capacitor/local-notifications

**Biometric Auth:**
- @capgo/capacitor-native-biometric - Biometric authentication (native apps)
  - Fingerprint/Face ID support
  - Plugin: @capgo/capacitor-native-biometric v8.0.3

## Data Storage

**Databases:**
- Supabase PostgreSQL (managed)
  - Connection: Supabase client auto-configuration
  - ORM/client: Supabase JS client (not a traditional ORM)
  - Type-safe queries via generated TypeScript types
  - Database functions: `get_user_role`, `has_role`, `generate_partner_payout`, etc.

**File Storage:**
- Supabase Storage
  - Buckets:
    - meals (meal images)
    - restaurants (logos)
    - avatars (user profile photos)
  - Public access enabled for images
  - Upload functionality in components (MealImageUpload, LogoUpload)

**Caching:**
- TanStack Query (React Query) - Server state caching
  - Cache duration: Configured per query
  - Stale-while-revalidate pattern
  - Background refetching enabled

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: Custom React Context (AuthContext.tsx)
  - Session management: Supabase client with localStorage persistence
  - Auth state listener: `onAuthStateChange`
  - Methods:
    - `signUp(email, password, fullName)` - User registration
    - `signIn(email, password)` - User login
    - `signOut()` - User logout
  - Protected routes: ProtectedRoute component
  - Redirects: /auth for unauthenticated users

**User Roles:**
- Custom role system via Supabase database
  - Roles: user, partner, admin
  - Storage: `user_roles` table
  - Authorization: Database function `has_role(_role, _user_id)`
  - Role checking: Component-level (RoleIndicator, route guards)

## Monitoring & Observability

**Error Tracking:**
- None configured (no Sentry or similar service)

**Logs:**
- Console-based logging
- Development: Console logs preserved
- Production: Console logs dropped via Terser

**Analytics:**
- None detected (no Google Analytics, Mixpanel, etc.)

## CI/CD & Deployment

**Hosting:**
- Platform-agnostic (static build)
- Recommended: Vercel, Netlify, or any static host
- Build output: `dist/` directory

**CI Pipeline:**
- GitHub Actions (configured in `.github/`)
- Scripts in `package.json`:
  - `npm run dev` - Development server
  - `npm run build` - Production build
  - `npm run build:dev` - Development build
  - `npm run lint` - ESLint check
  - `npm run preview` - Preview production build
  - `npm run cap:sync` - Sync Capacitor
  - `npm run cap:android` - Build and open Android
  - `npm run cap:ios` - Build and open iOS
  - `npm run cap:dev:android` - Run on Android device
  - `npm run cap:dev:ios` - Run on iOS device

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anonymous/public key

**Secrets location:**
- `.env` file (root directory, not committed)
- No secrets in client code (all VITE_ prefixed for build-time injection)

## Webhooks & Callbacks

**Incoming:**
- Supabase Auth callbacks
  - Email confirmation redirects to `/dashboard`
  - Password reset redirects
- No custom webhook endpoints detected

**Outgoing:**
- No external webhook calls detected
- Database functions handle internal logic
- No payment processor integrations (Stripe references in DB but not implemented)

---

*Integration audit: 2025-02-14*
