# Contributing

Development standards and PR workflow for the Nutrio project.

## Code Style

### Import Order

Organize imports in this order:

```tsx
// 1. React and React-related
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

// 3. Local imports with @ alias
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// 4. Relative imports
import { ActionButtons } from './ActionButtons';
import type { MealPlan } from './types';
```

### TypeScript

- **Strict mode** is enabled - no implicit `any`
- Use explicit return types for functions
- Prefer interfaces for object shapes, types for unions/primitives

```tsx
// Good
interface Profile {
  id: string;
  email: string;
  role: 'customer' | 'partner' | 'admin';
}

function formatName(user: Profile): string {
  return user.email.split('@')[0];
}

// Avoid
function process(data: any) { // ❌ implicit any
  return data;
}
```

### React Components

- Use function components with hooks
- Keep components under 200 lines - extract when larger
- Use `cn()` utility for conditional classes

```tsx
// Component structure
interface Props {
  title: string;
  onClose?: () => void;
}

export function Modal({ title, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={cn(
      "fixed inset-0 bg-black/50",
      isOpen ? "block" : "hidden"
    )}>
      <h2>{title}</h2>
    </div>
  );
}
```

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `MealCard.tsx` |
| Hooks | camelCase with `use` prefix | `useProfile.ts` |
| Utilities | camelCase | `analytics.ts` |
| Constants | SCREAMING_SNAKE_CASE | `API_ENDPOINTS` |
| Types | PascalCase | `type OrderStatus = ...` |
| Interfaces | PascalCase | `interface Profile { ... }` |

### File Organization

```
src/
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   │   └── button.tsx
│   └── feature/
│       ├── Component.tsx      # Main component
│       ├── Component.test.tsx # Tests
│       └── types.ts           # Local types
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useProfile.ts
│   └── useProfile.test.ts
├── lib/
│   ├── analytics.ts
│   └── utils.ts               # cn() utility
└── pages/
    └── Dashboard.tsx
```

## Git Workflow

### Branch Naming

```
feature/PROJ-123-add-meal-filtering
fix/PROJ-456-fix-login-redirect
refactor/PROJ-789-consolidate-hooks
docs/readme-update
```

### Commit Messages

Use present tense, lowercase:

```
add meal filtering by diet tag
fix login redirect on private routes
refactor useProfile hook for caching
update readme with mobile setup
```

**Format:**
- First line: brief summary (50 chars max)
- Body: explain why and what (optional)
- Footer: reference issues (optional)

### Pull Request Process

1. **Create branch** from `main`:
   ```bash
   git checkout -b feature/PROJ-123-add-meal-filtering
   ```

2. **Make changes** and verify:
   ```bash
   npm run lint; npm run typecheck
   ```

3. **Run tests**:
   ```bash
   npm run test:run
   ```

4. **Commit changes**:
   ```bash
   git add .
   git commit -m "add meal filtering by diet tag"
   ```

5. **Push and create PR**:
   ```bash
   git push origin feature/PROJ-123-add-meal-filtering
   ```

6. **PR Description** must include:
   - What changed and why
   - How to test
   - Screenshots (for UI changes)
   - Related issues

### Code Review

**Reviewers check:**
- [ ] Code follows style guide
- [ ] TypeScript has no errors
- [ ] Tests pass
- [ ] No console.log in production code
- [ ] Responsive design works on mobile
- [ ] Accessibility (ARIA labels, keyboard nav)

**Author responsibilities:**
- Respond to all comments
- Make requested changes or justify why not
- Keep PR scope focused (one feature/fix)

## Testing

### Unit Tests

Use Vitest with React Testing Library:

```tsx
// useProfile.test.ts
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useProfile } from './useProfile';

describe('useProfile', () => {
  it('returns user profile', async () => {
    // Setup mock
    vi.mock('@/contexts/AuthContext', () => ({
      useAuth: () => ({ user: { id: '123' } })
    }));
    
    // Test
    const { result } = renderHook(() => useProfile());
    
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
```

### E2E Tests

Use Playwright for cross-portal workflows:

```typescript
// customer-journey.spec.ts
test('customer can order a meal', async ({ page }) => {
  await page.goto('/nutrio/auth');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL(/\/dashboard/);
  await page.click('[data-testid="meals-tab"]');
  // ... continue assertions
});
```

## Common Patterns

### Data Fetching

Use TanStack Query hooks:

```tsx
// hooks/useOrders.ts
export function useOrders(userId: string) {
  return useQuery({
    queryKey: ['orders', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_schedules')
        .select('*, meals(*), branches(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
```

### Mutations

Use mutation hooks for create/update/delete:

```tsx
// hooks/useCreateOrder.ts
export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (order: CreateOrderInput) => {
      const { data, error } = await supabase
        .from('meal_schedules')
        .insert(order)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order created');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });
}
```

### Realtime Subscriptions

```tsx
// hooks/useRealtimeOrders.ts
export function useRealtimeOrders(userId: string) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const channel = supabase
      .channel(`orders:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meal_schedules',
          filter: `user_id=eq.${userId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
```

### Toast Notifications

Use Sonner for all user notifications:

```tsx
import { toast } from 'sonner';

// Success
toast.success('Order created successfully');

// Error
toast.error('Failed to create order');

// Loading
const id = toast.loading('Processing...');
// Later: toast.success(id, 'Done!');

// Action button
toast.message('Item deleted', {
  action: {
    label: 'Undo',
    onClick: () => restoreItem()
  }
});
```

## Windows-Specific Notes

Use PowerShell syntax. Use `;` instead of `&&`:

```powershell
# Correct
npm run lint; npm run typecheck

# WRONG (Bash syntax won't work)
npm run lint && npm run typecheck
```

## Debugging

### React DevTools

Install the browser extension to inspect:
- Component hierarchy
- Props and state
- Context values
- Query cache (TanStack Query DevTools)

### Supabase Dashboard

Use the dashboard to:
- View table data
- Run SQL queries
- Check Edge Function logs
- Monitor Realtime subscriptions

### Console Logging

Use `console.error` for debugging, never in production:

```tsx
// Development only
if (import.meta.env.DEV) {
  console.error('Debug info:', data);
}
```

## Deployment

### Build

```bash
npm run build
```

Output in `dist/` directory.

### Environment Variables

**Never** commit `.env` or secrets. Ensure production has:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SENTRY_DSN` (optional)
- `VITE_POSTHOG_KEY` (optional)

### Mobile Builds

```bash
# iOS App Store
npm run cap:ios
# Open Xcode → Archive → Upload

# Android Play Store
npm run cap:android
# Open Android Studio → Build → Upload
```

## Never Push Without Permission

**Important:** Never commit or push changes unless explicitly asked by the user.

Always show diffs and wait for approval before committing.

## See Also

- [README.md](./README.md) - Project overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [SETUP.md](./SETUP.md) - Environment setup
- [docs/API.md](./docs/API.md) - Database schema