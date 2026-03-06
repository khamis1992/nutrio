# Phase 1: Translation Keys - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add missing translation keys for Profile page error/success messages. Profile.tsx contains hardcoded English strings in toast notifications for profile updates, password changes, dietary preference toggles, and other user actions. These messages need translation keys in both English and Arabic dictionaries of LanguageContext.tsx, then Profile.tsx should use the `t()` function to reference these keys instead of hardcoded strings.

</domain>

<decisions>
## Implementation Decisions

### Key naming convention
- snake_case naming (e.g., `profile_updated`, `password_too_short`)
- No prefix needed - keys are already scoped within LanguageContext
- Grouped by page section rather than alphabetically or by functionality
- Consistent with existing translation key pattern in LanguageContext.tsx

### Section placement
- Section header: "Profile keys"
- Placed after existing `profile_*` keys in both English and Arabic dictionaries
- English and Arabic keys in same section - consistent order between languages
- Organized by page section (profile info, password, dietary preferences, etc.)

### RTL layout approach
- Global RTL applied via CSS class on html element - single toggle for entire app
- Use logical properties (start/end) instead of left/right for CSS positioning
- RTL applies at page level - LanguageContext `isRTL` toggle controls flow
- Profile page automatically mirrors when Arabic language is selected

### Claude's Discretion
- Exact line number in LanguageContext.tsx for Profile keys section (verify via grep)
- Specific key names not yet finalized from the analysis (need to match what Profile.tsx actually uses)
- Error message tone ( formal vs descriptive ) - choose standard pattern used elsewhere in codebase
- Exact test verification commands for build/lint/typecheck

</decisions>

<specifics>
## Specific Ideas

- Follow existing `LanguageContext.tsx` structure - keys start around line 7 (en) and 762 (ar)
- Profile section should come after `profile_*` keys (around line 607 in current file)
- Use existing pattern: `key: "English value"` followed by `key: "Arabic value"` in same section
- RTL class toggle already exists in LanguageContext via `isRTL` boolean and `dir="rtl"` attribute
- Use Tailwind's `start`/`end` utilities for RTL-compatible positioning

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LanguageContext.tsx` (src/contexts/LanguageContext.tsx) - Contains `translations` object with `en` and `ar` dictionaries, `useLanguage` hook, `isRTL` boolean, `t()` function
- `Profile.tsx` (src/pages/Profile.tsx) - Page component that needs translation key integration
- shadcn/ui components - Available for standard UI patterns, no custom RTL handling needed
- `LanguageContext` already manages `language` state (en/ar) with `setLanguage()` and `isRTL` flip

### Established Patterns
- Translation keys use snake_case naming convention
- Both `en` and `ar` dictionaries share same keys with different values
- RTL toggle via `isRTL` boolean that adds `dir="rtl"` to html element
- Toast notifications use `t()` function for localization (already implemented in most of Profile.tsx)

### Integration Points
- Profile.tsx imports `useLanguage` from `@/contexts/LanguageContext`
- All existing Profile.tsx text uses `t()` function except error/success toast messages
- LanguageContext provides `t(key)` function that falls back to key if not found
- RTL is controlled by `isRTL` which changes `dir="rtl"` attribute on html element

</code_context>

<deferred>
## Deferred Ideas

- Profile page RTL testing verification - deferred to Phase 3 (RTL Verification)
- Language switching validation - deferred to Phase 4 (Language Switching)
- Cross-language coverage verification - deferred to Phase 5 (Cross-Language Coverage)

</deferred>

---

*Phase: 01-translation-keys*
*Context gathered: 2026-03-06*
