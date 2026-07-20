# Nutrio GLP-1 Nutrition & Strength Support

## Decision

Nutrio will launch a non-clinical nutrition and lifestyle support program for adults who attest that a licensed clinician has already prescribed their GLP-1 medicine. Nutrio does not determine medication eligibility, prescribe, titrate, stop, or diagnose.

Customer-facing name:

> GLP-1 Nutrition & Strength Support

Required boundary statement:

> Nutrio supports meals, hydration, strength activity, and self-tracking. It does not replace your prescribing clinician and does not provide diagnosis, medication, or dose advice.

## Evidence baseline

- WHO recommends structured healthy-diet and physical-activity support alongside clinician-prescribed GLP-1 therapy.
- The 2025 ACLM/ASN/OMA/TOS advisory prioritizes baseline nutrition assessment, gastrointestinal tolerability, nutrient-dense food, micronutrient adequacy, protein, strength training, activity, sleep, stress, and social support.
- Qatar DHP telemedicine rules reserve diagnosis, treatment plans, counselling/therapy, and patient monitoring to eligible licensed practitioners operating through licensed facilities.
- Health, physical, and psychological information is special-nature personal data under Qatar Law No. 13 of 2016.

The implementation therefore separates wellness support from clinical care and uses explicit consent, data minimization, server-side safety messaging, and auditable protocol versions.

## Allowed and prohibited capabilities

### Nutrio may

- Curate meals by measurable attributes such as small portion, high protein, fiber source, gentle choice, hydration support, and lower-fat option.
- Provide general educational content and configurable meal swaps.
- Let users set and track meals, water, fiber, protein, activity, sleep, and self-reported symptoms.
- Offer general strength plans with substitutions and conservative progression.
- Produce a user-controlled report for sharing with an external clinician.
- Display non-diagnostic safety messages directing users to their prescriber or emergency care.

### Nutrio must not

- Recommend starting, selecting, stopping, or changing a medicine or dose.
- Interpret symptoms, labs, or weight changes as a diagnosis.
- Claim that a meal or program treats obesity, diabetes, or medication side effects.
- Present an unlicensed Nutrio staff member as a clinician or dietitian.
- provide individualized telemedicine until Nutrio contracts with a licensed healthcare facility and DHP-licensed practitioners.

## Product architecture

### Program catalog

Programs are first-class, versioned products. Each program has a clear outcome, duration, inclusions, eligibility statement, service boundary, and current published protocol.

The first program is an eight-week GLP-1 nutrition and strength support journey. Additional High Protein Strength and Calorie Smart Weight programs can reuse the same platform after content review.

### Enrollment

Enrollment requires:

1. Adult attestation.
2. Attestation that the medicine was prescribed by a licensed clinician.
3. Acknowledgement that Nutrio does not manage medication or diagnosis.
4. Explicit, versioned consent for the minimum health data needed by the program.

No dose is requested. Medication name remains in the existing private medication system and is not copied into analytics events.

### Daily experience

The active-program screen shows one calm daily plan:

- next meal or meal-planning task;
- hydration check;
- protein or fiber check;
- strength session on planned days;
- optional appetite, energy, and digestive check-in.

Tasks are evidence-based when an existing Nutrio record can prove completion and manually acknowledged otherwise.

### Meal qualification

Nutrio must not use an unqualified `GLP-1 friendly` badge. A reviewed meal can show only the attributes proven by its nutrition data and portion definition. Qualification stores the protocol version, attributes, rationale, reviewer, and expiry date.

### Symptom support and escalation

Check-ins are private and non-diagnostic. Server-side rules classify the response only to choose one of three messages:

- `routine`: continue tracking and use general meal-comfort guidance;
- `contact_clinician`: contact the prescribing clinician for persistent or disruptive symptoms;
- `urgent`: seek urgent medical care for a declared red flag.

Urgent declarations include severe persistent abdominal pain, inability to keep fluids down, breathing or swallowing difficulty, face/tongue swelling, fainting, and sudden vision change. The app never labels a condition.

### Administration

Admins manage program copy, protocol versions, publication state, and meal qualification. They can view enrollment counts and minimal safety-event codes. Raw check-ins, notes, medication records, and baselines are not exposed in the general admin UI.

## Data protection controls

- All program tables use RLS.
- Raw baselines and check-ins are owner-readable only.
- Consent is append-only and versioned.
- Safety events contain a bounded rule code, not free text.
- No health payload is sent to PostHog, Sentry breadcrumbs, push payloads, or restaurant systems.
- Restaurants receive only the selected meal/order requirements.
- Export and deletion flows must include all program-owned data.
- Retention: check-ins remain while enrollment is active and for the user-visible history period; deletion requests remove or anonymize program data according to the approved policy.

## Release gates

1. Qatar legal review of product wording and app classification.
2. DHP-licensed dietitian review of nutrition rules and meal attributes.
3. Medical review of safety wording without creating an in-app medical service.
4. Data protection impact assessment and consent approval.
5. RLS and RPC security tests.
6. Accessibility and 375px mobile visual test.
7. No sensitive-data analytics test.
8. Pilot with feature flag and incident review before broad release.

Until the first four external review gates are signed, the program remains in `draft` and cannot be enrolled in production.

## Implementation status: 20 July 2026

Completed in Nutrio:

- versioned program catalog, protocol, enrollment, consent, baseline, check-in, task, meal-qualification, safety, and review-gate data model;
- owner-only RLS for raw baselines and check-ins, with no general admin access;
- server-side routine/contact-clinician/urgent message classification;
- mandatory private onboarding before an enrollment becomes active;
- customer catalog, details, eligibility consent, onboarding, daily journey, pause/withdraw, progress report, and permanent program-data deletion;
- admin governance, evidence references, publication gates, measurable meal-attribute review, and minimal safety-event operations;
- health-program data in authenticated export and owner deletion flows;
- explicit removal of anonymous execute privileges from all health-program RPCs;
- automated SQL/security contract tests, TypeScript validation, lint, and production build.

Production remains intentionally locked because the four external review gates are pending. Nutrio must not enter reviewer names or evidence references without receiving the corresponding signed review. The handover checklist is in `docs/handovers/2026-07-20-glp1-program-external-review-pack.md`.
