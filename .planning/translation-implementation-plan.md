# Hybrid Translation Implementation Plan

## Overview
Multi-language support for Nutrio Fuel meals using Azure Translator API with partner review workflow.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Partner Portal │────▶│  Azure Translator  │────▶│   PostgreSQL    │
│  (Creates Meal) │     │  (Auto-translate)  │     │  (Translations) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                                   │
         │              ┌──────────────────┐                │
         └─────────────▶│  Partner Review  │◄───────────────┘
                        │  (Approve/Edit)  │
                        └──────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  Customer App    │
                        │  (Show in AR/EN) │
                        └──────────────────┘
```

## Implementation Phases

### Phase 1: Database (High Priority)
1. Create `meal_translations` table
2. Add `primary_language` to `meals` table
3. Create indexes and RLS policies
4. Migrate existing meals

### Phase 2: Azure Translator Edge Function (High Priority)
1. Create Edge Function for translation
2. Handle Azure API authentication
3. Implement caching and error handling
4. Add rate limiting

### Phase 3: Partner Portal Integration (High Priority)
1. Auto-translate on meal creation
2. Add translation review UI
3. Show translation status badges
4. Allow manual translation editing

### Phase 4: Customer Experience (High Priority)
1. Create translation hook
2. Update meal display components
3. Handle fallback to primary language
4. Show translation quality indicators

### Phase 5: Admin Dashboard (Medium Priority)
1. Translation coverage metrics
2. Bulk translation tools
3. Quality monitoring

### Phase 6: Testing & Optimization (High Priority)
1. End-to-end flow testing
2. Performance optimization
3. Edge case handling

## Cost Estimates

| Phase | Azure Cost | Dev Time |
|-------|-----------|----------|
| Phase 1-2 | $0 (2M free chars) | 2-3 days |
| Phase 3-4 | $0-$30/month | 3-4 days |
| Phase 5-6 | $0-$50/month | 2-3 days |
| **Total** | **$0-$50/month** | **7-10 days** |

## Success Criteria

- [ ] All meals have Arabic translations within 24 hours of creation
- [ ] Partners can review/edit translations
- [ ] Customers see meals in their preferred language
- [ ] Fallback to English when Arabic unavailable
- [ ] Translation quality score > 80%
- [ ] Page load time impact < 100ms

## Files to Create/Modify

### Database
- `supabase/migrations/20260307_add_meal_translations.sql`
- `supabase/migrations/20260307_add_user_language_preference.sql`

### Edge Functions
- `supabase/functions/translate-meal/index.ts`
- `supabase/functions/translate-meal/.env.example`

### React Components
- `src/components/TranslationReviewDialog.tsx`
- `src/components/LanguageSwitcher.tsx`
- `src/components/TranslationStatusBadge.tsx`

### Hooks
- `src/hooks/useMealTranslation.ts`
- `src/hooks/useUserLanguage.ts`

### Services
- `src/services/translationService.ts`

### Updated Files
- `src/pages/partner/PartnerMenu.tsx` (add translation UI)
- `src/pages/customer/MealDetails.tsx` (use translations)
- `src/contexts/AuthContext.tsx` (add language preference)
