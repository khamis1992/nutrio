# Nutrio Development Checklist

## Before Starting Work
- [ ] Understand which portal you're working on (customer/partner/admin/driver)
- [ ] Check existing similar implementations in src/
- [ ] Review AGENTS.md for development guidelines

## Code Implementation

### Component Development
- [ ] Use TypeScript interfaces for props
- [ ] Use `@/` imports instead of relative paths
- [ ] Implement proper error handling
- [ ] Add loading states for async operations
- [ ] Follow existing component patterns in src/components/

### Data Fetching
- [ ] Use existing hooks in src/hooks/ when possible
- [ ] Create new hooks following TanStack Query patterns
- [ ] Always check for Supabase errors: `if (error) throw error;`
- [ ] Handle loading and error states properly

### Authentication & Authorization
- [ ] Use `useAuth()` from `src/contexts/AuthContext.tsx`
- [ ] Wrap protected routes with `ProtectedRoute`
- [ ] Check appropriate user roles for actions
- [ ] Handle session timeouts with `SessionTimeoutManager`

## Code Quality Checks

### TypeScript
```bash
npm run typecheck
```
- [ ] No type errors
- [ ] Strict TypeScript settings pass

### Linting
```bash
npm run lint
```
- [ ] No linting errors
- [ ] Follow established code style

### Testing
```bash
npm run test
```
- [ ] Component tests pass
- [ ] New functionality covered by tests

## Supabase Integration
- [ ] All queries check for errors with `if (error) throw error;`
- [ ] Use appropriate RLS policies
- [ ] Follow existing database interaction patterns

## Mobile Considerations
- [ ] Responsive design for all screen sizes
- [ ] Touch targets minimum 44px
- [ ] Offline handling with Capacitor when appropriate

## Security
- [ ] No sensitive data in logs or client code
- [ ] Validate all user inputs
- [ ] Proper authentication checks
- [ ] Sanitize user-generated content

## Performance
- [ ] Memoize expensive calculations
- [ ] Implement proper loading states
- [ ] Avoid unnecessary re-renders
- [ ] Lazy load components when appropriate

## Before Committing
```bash
# Run all checks
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run test       # Tests
npm run build      # Production build check
```

- [ ] All checks pass
- [ ] Code follows existing patterns
- [ ] Commit message follows conventional format
- [ ] Changes reviewed for breaking impacts

## Portal-Specific Considerations

### Customer Portal (/dashboard, /meals, etc.)
- [ ] Mobile-first UI design
- [ ] Progressive enhancement approach
- [ ] Smooth onboarding experience

### Partner Portal (/partner/*)
- [ ] Business-focused UI components
- [ ] Analytics and reporting patterns
- [ ] Restaurant management workflows

### Admin Portal (/admin/*)
- [ ] Data-heavy UI patterns
- [ ] Bulk operation handling
- [ ] Audit trail considerations

### Driver Portal (/driver/*)
- [ ] Location-based features
- [ ] Real-time notifications
- [ ] Offline capability awareness

Remember: When in doubt, check existing implementations in the same directory!