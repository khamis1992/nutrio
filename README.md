# Nutrio Fuel

Healthy meal delivery and nutrition tracking platform for Qatar markets.

## Overview

Nutrio is a React single-page application (SPA) that connects users with healthy meal options from partner restaurants. The platform supports five distinct user portals:

- **Customer Portal** - Browse restaurants, order meals, track nutrition, manage subscriptions
- **Partner Portal** - Restaurant management, menu editing, order fulfillment
- **Admin Portal** - Platform administration, analytics, user management
- **Driver Portal** - Delivery tracking, earnings, route management
- **Fleet Portal** - Fleet management for delivery operations

## Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI** | Tailwind CSS, shadcn/ui, Radix UI |
| **State** | TanStack Query, Zustand |
| **Backend** | Supabase (Auth, Database, Storage, Realtime) |
| **Mobile** | Capacitor (iOS, Android) |
| **Analytics** | PostHog, Sentry |
| **Maps** | Mapbox GL, Leaflet |
| **Payments** | SADAD integration |

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase CLI (`npm install -g supabase`)
- For mobile: Xcode (iOS) or Android Studio

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Fill in your Supabase credentials
# VITE_SUPABASE_URL=your-project-url
# VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Start development server
npm run dev
```

The app runs at `http://localhost:5173/nutrio/`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Test coverage report |
| `npm run preview` | Preview production build |

## Mobile Development

```bash
# Sync Capacitor
npm run cap:sync

# Build and open Android
npm run cap:android

# Build and open iOS
npm run cap:ios

# Run on device
npm run cap:dev:android
npm run cap:dev:ios
```

## E2E Testing

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Specific test suites
npm run test:customer-journey
npm run test:partner-onboarding
npm run test:driver-delivery
npm run test:admin-management
```

## Project Structure

```
nutrio/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ui/              # shadcn/ui primitives
│   │   └── [feature]/       # Feature-specific components
│   ├── contexts/            # React contexts (Auth, Language, Theme)
│   ├── hooks/               # Custom React hooks for data fetching
│   ├── lib/                 # Utilities and helpers
│   ├── pages/               # Route components by portal
│   │   ├── admin/
│   │   ├── partner/
│   │   ├── driver/
│   │   ├── fleet/
│   │   ├── coach/
│   │   └── [public]/
│   ├── customer/            # Customer routes and layout
│   ├── fleet/               # Fleet routes and layout
│   └── integrations/
│       └── supabase/        # Supabase client and types
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   └── migrations/          # Database migrations
└── public/                  # Static assets
```

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/contexts/` | Global state (AuthContext, LanguageContext, AnalyticsContext) |
| `src/hooks/` | TanStack Query hooks for data fetching (useProfile, useSubscription, etc.) |
| `src/lib/` | Utilities (analytics, sentry, capacitor, whatsapp, sadad, currency) |
| `src/components/ui/` | shadcn/ui primitives (add via `npx shadcn-ui add <component>`) |

## Authentication Flow

1. User lands on `/nutrio/auth` (WelcomeScreen → SignInScreen)
2. Supabase Auth handles email/password and OAuth (Google, Apple)
3. AuthContext provides `user`, `userRole`, `profile` to app
4. ProtectedRoute enforces role-based access (`customer`, `partner`, `admin`, `driver`, `fleet`, `coach`)
5. Qatar geo-restriction enforced via IP check on signup

## Configuration

Environment variables (`.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/public key |
| `VITE_SENTRY_DSN` | Optional | Sentry error tracking |
| `VITE_POSTHOG_KEY` | Optional | PostHog analytics |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and data flow
- [SETUP.md](./SETUP.md) - Detailed environment setup
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Coding standards and PR workflow
- [docs/API.md](./docs/API.md) - Supabase schema and Edge Functions

## License

Private - All rights reserved.
