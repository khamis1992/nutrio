# Task Plan: Nutrio x SportHub Production Integration

## Goal
Complete the Nutrio side of the SportHub integration and deliver a developer-ready handoff document for SportHub.

## Phases
- [x] Phase 1: Audit current schemas, activity flow, authentication, and deployment conventions
- [x] Phase 2: Design secure linking, webhook, event normalization, and sync contracts
- [x] Phase 3: Implement database migration and server-side Edge Functions
- [x] Phase 4: Implement typed client integration and Activity UI states
- [x] Phase 5: Add automated tests and run quality checks
- [x] Phase 6: Create and verify SportHub developer handoff document

## Key Questions
1. Which Nutrio activity table and fields should receive completed SportHub sessions?
2. How can account linking be completed securely without exposing partner secrets?
3. What exact API and webhook contract must SportHub implement?

## Decisions Made
- Nutrio will own OAuth state generation, token exchange, webhook verification, and activity normalization server-side.
- Client code may request linking or revocation but may not declare an integration linked.
- Webhooks must be idempotent and traceable to a linked external user.
- SportHub bookings are stored separately; only completed sessions project into `workout_sessions`.
- OAuth credentials are encrypted by an Edge Function key before database storage.

## Errors Encountered
- DOCX render could not write to `C:\tmp`; rerendering into the workspace QA directory.
- Vitest/esbuild could not traverse its configuration path inside the sandbox; rerunning the focused test with approved elevated execution.
- Vite had the same sandbox configuration-path restriction; rerunning the production build with approved elevated execution.
- Supabase dry-run found unrelated historical local migrations missing from the remote history. No database changes were applied; deployment must use an isolated/approved migration sequence.
- DOCX visual rendering was unavailable because LibreOffice is not installed; structural generation completed and the Markdown source remains the canonical contract.

## Status
**Implementation complete** - Code, migration, UI, tests, production build, and SportHub handoff are ready. Production activation awaits SportHub credentials and an approved Supabase migration deployment.
