# GLP-1 Nutrition & Strength Support: External Review Pack

## Purpose

Nutrio has implemented a non-clinical nutrition, hydration, general strength, and private self-tracking program for adults who confirm that a licensed clinician already prescribed their GLP-1 medicine.

The program is technically complete but intentionally locked. It cannot accept enrollments until four independent reviews are recorded in the Nutrio admin portal and the database publication gate approves the protocol.

## Scope reviewers are approving

Nutrio may:

- organize meals by measurable nutrition and portion attributes;
- support protein, fiber, hydration, and general resistance-activity habits;
- collect private user-entered appetite, energy, digestive-comfort, and warning-sign check-ins;
- show predetermined non-diagnostic guidance to contact a prescriber or urgent care;
- generate a user-controlled progress PDF for sharing externally.

Nutrio does not:

- prescribe, recommend, stop, or change a medicine or dose;
- determine whether a user should take GLP-1 medicine;
- diagnose or interpret a symptom, laboratory result, or weight change;
- provide a clinician consultation, medical monitoring service, or treatment plan;
- send private program answers to restaurants, delivery partners, or analytics tools.

## Required approvals

### 1. Qatar legal scope

Reviewer: Qatar-qualified counsel familiar with health-service and data-protection regulation.

Review:

- customer-facing program name, claims, eligibility wording, and disclaimers;
- whether the implemented experience remains a wellness support product;
- escalation wording and use of “clinician”, “program”, and “support”;
- privacy notice, consent, withdrawal, export, and deletion language;
- whether any additional Ministry or DHP approval is required before launch.

Deliverable: signed opinion or controlled memorandum reference.

### 2. Licensed dietitian protocol review

Reviewer: appropriately licensed dietitian with GLP-1 nutrition competence.

Review:

- baseline questions and eight-week nutrition structure;
- meal attributes: small portion, high protein, fiber source, gentle choice, hydration support, lower-fat option;
- protein, fiber, hydration, nutrient-density, and meal-comfort education;
- meal qualification rationale and review/expiry process;
- wording that avoids treatment claims.

Deliverable: approved protocol version and reviewed meal-qualification standard.

### 3. Medical safety wording

Reviewer: licensed physician or qualified medication-safety clinician. This review does not create an in-app medical service.

Review:

- predetermined “contact your prescribing clinician” criteria;
- urgent warning-sign list and the exact user messages;
- confirmation that Nutrio does not name a diagnosis or suggest a medication action;
- emergency wording appropriate for users in Qatar;
- incident escalation and content-review cadence.

Deliverable: approved safety matrix and message set.

### 4. Privacy DPIA

Reviewer: Nutrio data-protection owner or Qatar privacy counsel.

Review:

- legal basis and explicit, versioned consent;
- data minimization, purpose limitation, retention, export, and deletion;
- owner-only RLS for baselines and raw check-ins;
- restricted admin view of bounded safety codes only;
- exclusion from PostHog, Sentry breadcrumbs, restaurant, and delivery payloads;
- incident response and processor register.

Deliverable: signed DPIA reference and approved consent notice version.

## Evidence available in Nutrio

- Product and safety design: `docs/plans/2026-07-20-glp1-nutrition-strength-support-design.md`
- Database model and RLS: migrations beginning `20260720190000_health_support_programs.sql`
- Publication review gates: `20260720191000_health_program_review_gates.sql`
- Private onboarding requirement: `20260720192000_health_program_onboarding.sql`
- Explicit anonymous RPC revocation: `20260720200000_harden_health_program_rpc_grants.sql`
- Database release test: `supabase/tests/health-program-release-gate.sql`
- Application security contract test: `src/lib/health-program-security.test.ts`

## Approval recording procedure

1. An authorized Nutrio administrator opens **Admin > Operations > Health Programs**.
2. The administrator records reviewer name, evidence reference, decision, and note for each gate.
3. Evidence remains in the controlled legal/compliance repository; the database stores its reference, not the full document.
4. Only when all four gates are approved can the administrator publish the protocol.
5. Any protocol change creates a new version and repeats the gate process before publication.

## Current release status

- Catalog preview: published for internal discovery.
- Protocol version 1: draft.
- External gates: pending.
- Customer enrollment: blocked at the database layer.
- Clinical partnership: none; no clinical feature is enabled.

