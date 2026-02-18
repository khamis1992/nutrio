# NutrioFuel Codebase Mapping - GSD Documentation Set

**Generated:** 2025-02-14
**Status:** Complete

## Documentation Structure

This comprehensive codebase mapping follows the GSD (Guided Software Development) methodology and provides complete visibility into the NutrioFuel application architecture.

### Quick Navigation

**Start Here:**
- [README.md](./README.md) - **30-minute overview** of the entire codebase (start here)

**Detailed Documents:**
- [STACK.md](./STACK.md) - Technology stack, frameworks, dependencies
- [INTEGRATIONS.md](./INTEGRATIONS.md) - External services, APIs, third-party integrations
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design, data flow, patterns
- [STRUCTURE.md](./STRUCTURE.md) - File organization, directory layout, where to find things
- [CONVENTIONS.md](./CONVENTIONS.md) - Coding standards, patterns, style guide
- [TESTING.md](./TESTING.md) - Testing approach, patterns (and gaps)
- [CONCERNS.md](./CONCERNS.md) - Technical debt, known issues, risks

## What This Tells You

### For New Developers
- **README.md** → Get oriented in 30 minutes
- **STRUCTURE.md** → Learn where files are located
- **CONVENTIONS.md** → Understand how to write code
- **ARCHITECTURE.md** → Grasp the system design

### For Feature Development
- **ARCHITECTURE.md** → Understand data flow and layers
- **STRUCTURE.md** → Know where to add new code
- **CONVENTIONS.md** → Follow existing patterns
- **CONCERNS.md** → Avoid introducing more tech debt

### For Maintenance/Refactoring
- **CONCERNS.md** → See what needs fixing
- **ARCHITECTURE.md** → Understand impact of changes
- **TESTING.md** → See what's not tested (high risk areas)
- **CONVENTIONS.md** → Maintain consistency

### For DevOps/Deployment
- **STACK.md** → See runtime requirements
- **INTEGRATIONS.md** → Understand external dependencies
- **ARCHITECTURE.md** → Know system boundaries

## Codebase Statistics

| Metric | Value |
|--------|-------|
| **Total Pages** | 40+ route components |
| **Components** | 100+ React components |
| **UI Library** | 60+ shadcn/ui components |
| **Custom Hooks** | 15+ data hooks |
| **Database Tables** | 30+ tables |
| **User Portals** | 3 (Customer, Partner, Admin) |
| **Native Platforms** | 2 (Android, iOS) |
| **Test Coverage** | 0% (not configured) |

## Quick Reference

### Technology Stack
- **Frontend:** React 18.3 + TypeScript 5.8
- **Build:** Vite 5.4
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL)
- **Mobile:** Capacitor 8.0
- **State:** TanStack Query + React Context

### Key Directories
```
src/
├── pages/          # Route components (40+ files)
├── components/     # React components (100+ files)
│   └── ui/        # shadcn/ui library (60+ files)
├── hooks/         # Custom hooks (15+ files)
├── contexts/      # AuthContext
├── lib/           # Utilities
└── integrations/  # Supabase client
```

### Three User Portals
1. **Customer** (`/dashboard`, `/meals`, `/schedule`)
2. **Partner** (`/partner/*`)
3. **Admin** (`/admin/*`)

### Important Files to Understand First
1. `src/App.tsx` - All routes
2. `src/contexts/AuthContext.tsx` - Authentication
3. `src/pages/Dashboard.tsx` - Main page pattern
4. `src/integrations/supabase/types.ts` - Database schema

## Using This Documentation

### Scenario 1: "I'm new to the project"
1. Read [README.md](./README.md) (30 min)
2. Skim [ARCHITECTURE.md](./ARCHITECTURE.md)
3. Review [CONVENTIONS.md](./CONVENTIONS.md) before coding

### Scenario 2: "I need to add a feature"
1. Check [STRUCTURE.md](./STRUCTURE.md) to know where to put files
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand data flow
3. Follow [CONVENTIONS.md](./CONVENTIONS.md) for code style
4. Check [CONCERNS.md](./CONCERNS.md) for areas to avoid

### Scenario 3: "I need to fix a bug"
1. Use [STRUCTURE.md](./STRUCTURE.md) to locate the file
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) to understand context
3. Check [CONCERNS.md](./CONCERNS.md) for known issues in that area
4. Review [TESTING.md](./TESTING.md) to see if tests exist (they don't)

### Scenario 4: "I need to deploy this"
1. Review [STACK.md](./STACK.md) for runtime requirements
2. Check [INTEGRATIONS.md](./INTEGRATIONS.md) for external dependencies
3. Verify environment variables (see INTEGRATIONS.md)

### Scenario 5: "I need to refactor something"
1. Read [CONCERNS.md](./CONCERNS.md) for tech debt context
2. Check [TESTING.md](./TESTING.md) - be aware there are no tests
3. Follow [CONVENTIONS.md](./CONVENTIONS.md) to maintain consistency
4. Use [ARCHITECTURE.md](./ARCHITECTURE.md) to understand system impact

## Maintenance

**Last Updated:** 2025-02-14

**When to Update:**
- After major architectural changes
- When new dependencies are added
- After directory restructuring
- When new patterns are established
- After addressing items in CONCERNS.md

**How to Update:**
1. Re-run this mapping analysis
2. Update the date in each document
3. Revise the relevant sections
4. Keep the structure consistent

## Document Metadata

| Document | Lines | Focus | Audience |
|----------|-------|-------|----------|
| README.md | 350+ | Overview | Everyone |
| STACK.md | 175+ | Technology | DevOps, Developers |
| INTEGRATIONS.md | 150+ | External Services | DevOps, Backend |
| ARCHITECTURE.md | 200+ | System Design | Developers |
| STRUCTURE.md | 225+ | File Organization | Developers |
| CONVENTIONS.md | 175+ | Code Standards | Developers |
| TESTING.md | 115+ | Testing | QA, Developers |
| CONCERNS.md | 275+ | Issues/Risks | Tech Leads |

## Related Documentation

Additional project documentation (root level):
- `README.md` - Project README
- `NUTRIOFUEL_ARCHITECTURE_DIAGRAMS.md` - Visual architecture diagrams
- `NATIVE_MOBILE_ANALYSIS_REPORT.md` - Mobile app details
- `GITHUB_ACTIONS_SETUP.md` - CI/CD configuration

---

**Documentation Version:** 1.0
**Generated By:** GSD Codebase Mapper
**Methodology:** Guided Software Development (GSD)
