# Nutrio Development Enforcement System

This directory contains tools and configurations to enforce Nutrio development best practices automatically.

## What's Included

### 🛡️ Automated Checks
- **Pre-commit hooks** - Runs checks before each commit
- **Pattern enforcement** - Ensures code follows established patterns
- **TypeScript validation** - Strict type checking
- **Linting** - Code style enforcement

### 📋 Development Guides
- **CHECKLIST.md** - Comprehensive development checklist
- **prompts/code-review.md** - Code review guidelines
- **templates/component-template.tsx** - Component boilerplate

### ⚙️ Scripts
- **scripts/enforce-patterns.js** - Pattern validation tool
- **start.js** - Development environment initializer

## How to Use

### 1. Run Development Checks
```bash
# Run all checks at once
npm run check:all

# Run individual checks
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run test         # Tests
npm run check        # Pattern enforcement
```

### 2. Pre-commit Hook
The pre-commit hook automatically runs when you commit:
- TypeScript validation
- ESLint checks
- Supabase error handling validation

### 3. Development Workflow
Before starting work:
```bash
node .opencode/start.js
```

This will show you the development guidelines and checks.

## Key Rules Enforced

1. **Import Patterns** - Use `@/` aliases instead of relative paths
2. **Supabase Error Handling** - All queries must check `if (error)`
3. **Type Safety** - Strict TypeScript with no implicit any
4. **Code Style** - Follow existing patterns in the codebase
5. **Testing** - New features should include tests

## Portal Awareness

Remember the four main portals:
- **Customer** - Main consumer app (`/dashboard`, `/meals`, etc.)
- **Partner** - Restaurant management (`/partner/*`)
- **Admin** - Platform management (`/admin/*`)
- **Driver** - Delivery operations (`/driver/*`)

Each has its own UI patterns and access controls.

## Configuration

The system is configured in `.opencode/config.json` and uses:
- Standard ESLint and TypeScript settings from the project
- Pre-commit hooks via `.opencode/hooks/pre-commit`
- Pattern enforcement via `.opencode/scripts/enforce-patterns.js`

For questions about development practices, refer to `AGENTS.md` in the project root.