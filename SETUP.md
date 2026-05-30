# Development Setup

This guide covers setting up the Nutrio development environment from scratch.

## Prerequisites

### Required

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ or **yarn** 4+
- **Git** 2.30+
- **Supabase account** (https://supabase.com)

### Optional (for mobile)

- **Xcode** 15+ (iOS development)
- **Android Studio** Hedgehog+ (Android development)

## Environment Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd nutrio

# Install dependencies
npm install
```

### 2. Environment Variables

Copy the example file and fill in values:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Sentry (optional)
VITE_SENTRY_DSN=https://your-sentry-dsn

# PostHog (optional)
VITE_POSTHOG_KEY=your-posthog-key

# Capacitor (for mobile)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

### 3. Supabase Setup

#### Create Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization and set name/password
4. Wait for project to be provisioned

#### Get Credentials

1. Go to **Settings** → **API**
2. Copy **Project URL** → `VITE_SUPABASE_URL`
3. Copy **anon/public key** → `VITE_SUPABASE_PUBLISHABLE_KEY`

#### Apply Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref <your-project-ref>

# Push migrations
supabase db push

# Generate TypeScript types
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### 4. Start Development Server

```bash
npm run dev
```

The app runs at `http://localhost:5173/nutrio/`

## Development Workflow

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (hot reload) |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Test coverage report |
| `npm run preview` | Preview production build |

### Verify Before Commit

```bash
# Always run both checks before committing
npm run lint; npm run typecheck
```

## Project Configuration

### Vite (`vite.config.ts`)

- Path alias `@/` → `src/`
- React SWC plugin for fast builds
- Sourcemap for debugging
- Manual chunk splitting for better caching

### TypeScript (`tsconfig.json`)

- Strict mode enabled
- Path mapping for `@/*` imports
- React 18 JSX transform

### Tailwind CSS (`tailwind.config.js`)

- Custom theme (colors, fonts)
- shadcn/ui preset
- Responsive design utilities

### ESLint (`eslint.config.js`)

- React hooks rules
- TypeScript strict rules
- React refresh plugin

## IDE Setup

### VSCode Extensions

Install these recommended extensions:

```
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Explorer
- GitLens
- Supabase
```

### VSCode Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## Database Development

### Migrations

Create new migration:

```bash
supabase migration new your_migration_name
```

Edit the generated file in `supabase/migrations/`:

```sql
-- Example: Add new column
ALTER TABLE profiles ADD COLUMN phone VARCHAR(20);
```

Apply migrations:

```bash
supabase db push
```

### Local Development

For local Supabase:

```bash
# Start local Supabase (Postgres, Auth, Storage)
supabase start

# This outputs credentials for local dev:
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# Anon key: eyJ...

# Update .env for local dev
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<local-anon-key>
```

Stop local Supabase:

```bash
supabase stop
```

## Edge Functions Development

Edge Functions run on Deno runtime.

### Structure

```
supabase/functions/
├── _shared/              # Shared utilities
│   └── rateLimiter.ts
├── send-email/
│   └── index.ts
└── smart-meal-allocator/
    └── index.ts
```

### Local Testing

```bash
# Serve Edge Functions locally
supabase functions serve

# Test specific function
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-email' \
  --header 'Authorization: Bearer <anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{"to":"test@example.com","subject":"Test"}'
```

### Deploy

```bash
supabase functions deploy send-email
```

## Mobile Development

### Capacitor Setup

```bash
# Add platforms
npx cap add android
npx cap add ios

# Sync after build
npm run build
npx cap sync
```

### iOS Development

```bash
# Open in Xcode
npx cap open ios

# Run on simulator
npx cap run ios

# Run on device
npx cap run ios --device
```

### Android Development

```bash
# Open in Android Studio
npx cap open android

# Run on emulator
npx cap run android

# Run on device
npx cap run android --device
```

### Native Plugins

The app uses these Capacitor plugins:

- `@capacitor/camera` - Photo capture
- `@capacitor/push-notifications` - Push notifications
- `@capacitor/local-notifications` - Local notifications
- `@capacitor/geolocation` - GPS tracking
- `@capacitor/biometrics` - Fingerprint/Face ID
- `@capacitor/preferences` - Native storage

## Testing

### Unit Tests (Vitest)

```bash
# Run all tests
npm run test:run

# Watch mode
npm run test

# Coverage
npm run test:coverage
```

Test files follow pattern: `*.test.ts(x)` or `*.spec.ts(x)`

### E2E Tests (Playwright)

```bash
# Install Playwright browsers
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific suite
npm run test:customer-journey

# Interactive mode
npm run test:e2e:ui
```

## Troubleshooting

### Common Issues

#### "Missing Supabase configuration"

- Ensure `.env` file exists with correct variables
- Restart dev server after `.env` changes

#### "Module not found"

```bash
# Clear caches and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript errors

```bash
# Regenerate Supabase types
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

#### Capacitor blank screen

- Check capacitor.config.ts base URL
- Ensure VITE_SUPABASE_URL is not localhost for production builds

### Windows-Specific

This repository uses **PowerShell**. Use `;` instead of `&&`:

```powershell
# Correct
npm run lint; npm run typecheck

# WRONG (Bash syntax won't work)
npm run lint && npm run typecheck
```

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Read [CONTRIBUTING.md](./CONTRIBUTING.md) for coding standards
- Read [docs/API.md](./docs/API.md) for database schema