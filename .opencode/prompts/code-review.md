When reviewing code changes in the Nutrio project, always check:

## Mandatory Checks
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] No console errors in development
- [ ] All Supabase queries check for errors: `if (error) throw error;`
- [ ] Imports use `@/` aliases instead of relative paths (`../../../`)

## Pattern Compliance
- [ ] Components follow existing patterns in `src/components/`
- [ ] Hooks use TanStack Query pattern like in `src/hooks/`
- [ ] Auth checks use `useAuth()` from `src/contexts/AuthContext.tsx`
- [ ] Protected routes use `ProtectedRoute` wrapper

## Security
- [ ] No sensitive data exposure
- [ ] Proper role-based access controls implemented
- [ ] Input validation for all user inputs

## Performance
- [ ] Proper memoization where needed
- [ ] Lazy loading for large components
- [ ] Efficient database queries

## Nutrio-Specific Guidelines
- [ ] Mobile-first responsive design
- [ ] Follow design tokens for colors, spacing, etc.
- [ ] Use shadcn/ui components when available
- [ ] Implement proper loading states
- [ ] Handle offline scenarios gracefully (Capacitor)