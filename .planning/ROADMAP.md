# Arabic Translation Project - Phase 1 Roadmap

## Project Reference

**Nutrio Fuel Arabic Translation - Profile Page (Phase 1)**

This roadmap delivers Arabic language support for the Profile page by replacing hardcoded English strings with translation keys, enabling seamless language switching between English and Arabic.

### Core Value
Users can seamlessly switch between English and Arabic languages on the Profile page, with all text properly localized and accessible through the translation context.

### Current Focus
Phase 1: Profile page Arabic translation implementation and validation.

### Active Requirements
- TRANS-01: Add missing translation keys for Profile page error/success messages
- TRANS-02: Replace hardcoded English strings in Profile page component with translation key references
- TRANS-03: Verify Arabic text renders correctly for RTL language support
- TRANS-04: Test language switching works without breaking existing functionality
- TRANS-05: Profile page displays correctly in both English and Arabic

---

## Phases

- [ ] **Phase 1: Translation Keys** - Add missing translation keys for Profile page messages
- [ ] **Phase 2: Profile Implementation** - Replace hardcoded strings with translation keys in Profile page
- [ ] **Phase 3: RTL Verification** - Verify Arabic text renders correctly for RTL support
- [ ] **Phase 4: Language Switching** - Validate language switching works without breaking functionality
- [ ] **Phase 5: Cross-Language Coverage** - Ensure Profile page displays correctly in both languages

---

## Phase Details

### Phase 1: Translation Keys

**Goal**: Add missing translation keys for Profile page error/success messages needed for TRANS-02 implementation.

**Depends on**: Nothing (first phase)

**Requirements**: TRANS-01

**Success Criteria**:
1. All required translation keys for Profile page error/success messages exist in the `en` translation dictionary of LanguageContext.tsx
2. Each new key has a corresponding Arabic translation in the `ar` dictionary
3. Translation keys are properly organized under the "Profile page extensions" section of LanguageContext.tsx
4. No duplicate translation keys exist for Profile page specific messages

**Plans:**
- [x] 01-01-PLAN.md — Add missing translation keys for Profile page error/success messages

---

### Phase 2: Profile Implementation

**Goal**: Replace all hardcoded English strings in the Profile page component with translation key references.

**Depends on**: Phase 1 (translation keys must exist before implementation)

**Requirements**: TRANS-02

**Success Criteria**:
1. All user-facing text in Profile.tsx uses `t()` function calls instead of hardcoded English strings
2. All translation keys used in Profile.tsx are present in the language context (completed in Phase 1)
3. No English strings remain hardcoded in Profile.tsx (verified by search for common English phrases not wrapped in t() calls)
4. Profile page renders correctly with English language selection

**Plans**: TBD

---

### Phase 3: RTL Verification

**Goal**: Verify that Arabic text renders correctly with proper RTL layout support on the Profile page.

**Depends on**: Phase 2 (Profile page must use translation keys before RTL can be tested)

**Requirements**: TRANS-03

**Success Criteria**:
1. Arabic text displays correctly without overlapping or clipping
2. RTL layout is applied when Arabic language is selected (text-align: right, icon positions swapped)
3. Form fields and input placeholders render correctly in Arabic
4. Buttons and action items align properly in RTL layout
5. No English text leakage when Arabic is selected

**Plans**: TBD

---

### Phase 4: Language Switching

**Goal**: Validate that language switching between English and Arabic works without breaking existing Profile page functionality.

**Depends on**: Phase 3 (RTL verification must pass before language switching can be fully tested)

**Requirements**: TRANS-04

**Success Criteria**:
1. Language can be switched from English to Arabic and back without page reload
2. All Profile page functionality works in both languages (tabs, accordions, forms)
3. No console errors appear when switching between English and Arabic
4. Form inputs, buttons, and interactive elements function correctly in both languages
5. Saved profile data persists across language switches

**Plans**: TBD

---

### Phase 5: Cross-Language Coverage

**Goal**: Ensure Profile page displays correctly and completely in both English and Arabic languages.

**Depends on**: Phase 4 (language switching must be validated before final coverage verification)

**Requirements**: TRANS-05

**Success Criteria**:
1. All Profile page sections display in English when language is set to "English"
2. All Profile page sections display in Arabic when language is set to "Arabic"
3. No English text appears in Arabic view or vice versa
4. RTL layout is properly applied for Arabic and LTR for English
5. Profile page loading state displays appropriate text in both languages

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1 - Translation Keys | 1/1 | Planned | - |
| 2 - Profile Implementation | 0/0 | Not started | - |
| 3 - RTL Verification | 0/0 | Not started | - |
| 4 - Language Switching | 0/0 | Not started | - |
| 5 - Cross-Language Coverage | 0/0 | Not started | - |

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRANS-01 | Phase 1 | Pending |
| TRANS-02 | Phase 2 | Pending |
| TRANS-03 | Phase 3 | Pending |
| TRANS-04 | Phase 4 | Pending |
| TRANS-05 | Phase 5 | Pending |

---

*Roadmap created for Nutrio Fuel Arabic Translation Project - Phase 1*
