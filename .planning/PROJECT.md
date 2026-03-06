# Nutrio Fuel - Arabic Translation

## What This Is

Nutrio Fuel is a healthy meal delivery and nutrition tracking platform for Qatar. This project adds Arabic language support by translating all hardcoded English text to use translation keys, enabling users to switch between English and Arabic languages.

## Core Value

Users can seamlessly switch between English and Arabic languages on the Profile page, with all text properly localized and accessible through the translation context.

## Requirements

### Validated

- ✓ Existing English language support is functional - existing
- ✓ Translation keys for English/Arabic exist in LanguageContext - existing

### Active

- [ ] **TRANS-01**: Add missing translation keys for Profile page error/success messages (e.g., "Error", "Removed", "Added", "Profile updated", etc.)
- [ ] **TRANS-02**: Replace hardcoded English strings in Profile page component with translation key references
- [ ] **TRANS-03**: Verify Arabic text renders correctly for RTL language support
- [ ] **TRANS-04**: Test language switching works without breaking existing functionality
- [ ] **TRANS-05**: Profile page displays correctly in both English and Arabic

### Out of Scope

- Other pages translation - Deferred to subsequent phases after Profile page is complete

## Context

- The app uses React with TypeScript
- LanguageContext.tsx exists and manages language state
- Translation keys are already defined for English with corresponding Arabic translations
- The issue is that Profile page and other components have hardcoded English strings that need to be replaced with translation key references
- Arabic language requires RTL (Right-to-Left) layout support
- Testing will be manual initially (user visits localhost:5173/profile)

## Constraints

- **Tech Stack**: React 18.3, TypeScript 5.8, Supabase backend
- **Mobile**: Capacitor-based iOS/Android app
- **Approach**: Translation keys/context pattern (like existing localization)
- **Test Strategy**: Manual testing first (profile page), automated tests later

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Translation keys pattern | Consistent with existing localization, scalable across all pages | ✓ Good - maintainable approach |
| Profile page first | Smallest scope for MVP, easier to verify | ✓ Good - focused iteration |
| Manual testing initially | Faster for early validation, automated tests added later | — Pending |
| RTL support required | Arabic requires right-to-left layout | ✓ Good - proper internationalization |
---

*Last updated: 2026-03-06 - Roadmap created for Phase 1*
