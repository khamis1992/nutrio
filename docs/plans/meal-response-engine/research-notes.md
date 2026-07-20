# Research Notes: Nutrio Meal Response Engine

## Evidence base

### Personalized postprandial response

- Zeevi et al., *Cell* (2015): a model combining meal, clinical, activity, and
  microbiome inputs predicted personalized postprandial glycemic response.
  Source: https://pubmed.ncbi.nlm.nih.gov/26590418/
- Berry et al., PREDICT 1, *Nature Medicine* (2020): 1,002 participants showed
  substantial person-specific variation; glucose was evaluated over 0-2 hours
  and triglycerides over longer windows. Meal composition alone did not explain
  all response variation.
  Source: https://www.nature.com/articles/s41591-020-0934-0
- Mendes-Soares et al., *JAMA Network Open* (2019): a personalized glycemic
  model transferred to a US cohort and outperformed simple carbohydrate or
  calorie rules, but required rich individual data.
  Source: https://pubmed.ncbi.nlm.nih.gov/30735238/
- Howard et al. found that duplicate free-living meals can produce unreliable
  within-person CGM rankings. A single exposure cannot support a confident
  personal claim.
  Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC10371100/
- CGM device agreement is imperfect for meal ranking; device provenance and
  uncertainty must be retained.
  Source: https://pubmed.ncbi.nlm.nih.gov/35134821/

### Repeated personal experiments

- N-of-1 nutrition trials use repeated, counterbalanced interventions and
  washout/control periods to estimate a person's response rather than infer it
  from one observation.
  Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC7494402/
- Bayesian hierarchical models can combine individual repeated trials while
  borrowing strength from population evidence without replacing the personal
  estimate.
  Sources:
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC2963698/
  - https://onlinelibrary.wiley.com/doi/10.1002/sim.8873
- Ecological momentary assessment can capture within-person hunger, fullness,
  cravings, and appetite close to the event, reducing retrospective recall.
  Source: https://pubmed.ncbi.nlm.nih.gov/25614760/

### Evaluation and uncertainty

- FDA/IMDRF Good Machine Learning Practice requires representative datasets,
  independent train/test separation, human factors, clinically relevant
  performance, monitoring, and total-lifecycle controls.
  Source: https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles
- TRIPOD+AI provides transparent reporting requirements for prediction models.
  Source: https://www.bmj.com/content/385/bmj-2023-078378
- DECIDE-AI emphasizes staged real-world evaluation, human interaction, error
  cases, bias, and deployment context.
  Source: https://www.nature.com/articles/s41591-022-01772-9
- Conformal prediction can provide calibrated per-prediction uncertainty, but
  calibration must respect user groups and temporal distribution shift.
  Source: https://link.springer.com/article/10.1007/s41666-021-00113-8

## Platform and interoperability findings

### iOS

- HealthKit exposes dietary energy, sleep, blood glucose, heart rate, and other
  samples with granular user permissions.
  Sources:
  - https://developer.apple.com/documentation/healthkit/data-types
  - https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/bloodglucose
- Anchored queries return incremental additions and deletions and can support
  background updates. Sync anchors must be stored per data type.
  Source: https://developer.apple.com/documentation/healthkit/executing-anchored-object-queries
- HealthKit requires per-type permission, purpose descriptions, and a privacy
  policy. Permission denial can appear as absence of data.
  Source: https://developer.apple.com/documentation/healthkit/protecting-user-privacy

### Android

- Health Connect supports nutrition, sleep, activity, HRV, blood glucose, and
  provenance metadata through granular permissions.
  Source: https://developer.android.com/health-and-fitness/health-connect/data-types
- Incremental sync uses per-type change tokens, includes updates/deletions, and
  must recover from token expiry and interrupted foreground/background sync.
  Source: https://developer.android.com/health-and-fitness/health-connect/sync-data
- Google Play requires a Health Apps declaration, prominent disclosure,
  minimum necessary permissions, encryption, consent, and prohibits health data
  use for ads or unrelated commercial exploitation.
  Source: https://support.google.com/googleplay/android-developer/answer/12991134

### Direct CGM and standards

- Dexcom offers an official OAuth 2.0 REST API to authorized Digital Health
  Partners for estimated glucose values and events.
  Sources:
  - https://developer.dexcom.com/docs
  - https://developer.dexcom.com/docs/dexcom/authentication/
- The installed `@capgo/capacitor-health@8.6.8` supports `bloodGlucose` on both
  iOS and Android and returns source and platform identifiers. Nutrio's wrapper
  currently exposes only steps, heart rate, workouts, sleep, and recovery, so
  glucose still needs to be wired into permissions, normalization, and sync.
  The plugin's generic `readSamples()` API does not expose HealthKit anchored
  changes or Health Connect change tokens/deletions. The MVP can use an
  overlapping read window plus deduplication; production-grade incremental sync
  should add a native cursor/change extension or use an official direct CGM API.
  Sources:
  - https://capgo.app/docs/plugins/health/
  - Local definitions: `node_modules/@capgo/capacitor-health/dist/esm/definitions.d.ts`
- FHIR R5 `NutritionIntake` is an event resource for consumed food and nutrients;
  `Observation` is appropriate for measurements. Nutrio can expose a future
  interoperability adapter without forcing its internal schema to mirror FHIR.
  Sources:
  - https://fhir.hl7.org/fhir/nutritionintake.html
  - https://www.hl7.org/fhir/observation.html

## Privacy and regulatory findings

- Qatar Law No. 13 of 2016 classifies health and physical or psychological
  condition data as special-nature personal data and requires purpose
  limitation, security, user information, access/correction/deletion processes,
  breach controls, and a regulatory permission path for processing this class.
  Sources:
  - https://encyclop.sjc.gov.qa/lawlib/Images/criminal/laws/13-2016/1.htm
  - https://mot.gov.qa/en/news/motc-releases-guidelines-personal-data-privacy-protection-law
- FDA's 2026 general-wellness policy distinguishes low-risk lifestyle support
  from software intended to diagnose, treat, mitigate, or prevent disease.
  Source: https://www.fda.gov/media/90652/download
- WHO guidance requires autonomy, informed consent, transparency, safety,
  accountability, inclusiveness, and continuous evaluation for AI in health.
  Source: https://www.who.int/publications/i/item/9789240029200

## Product benchmark findings

- ZOE separates food/meal scoring from measured or predicted glucose, fat, and
  microbiome response and bases personalization on a large research cohort.
  Source: https://zoe.com/whitepapers/overview
- Levels explains glucose response per meal and possible contributing factors.
  Source: https://support.levels.com/article/545-about-meal-scores
- Dexcom/CGM-based competitors depend on sensor access; predictive products
  without a CGM rely on population models and should not be presented as a
  direct measurement.

## Decisions for Nutrio

1. Keep three outputs separate: nutrition quality, observed personal response,
   and confidence/evidence.
2. Use the immutable `meal_consumptions.nutrition_snapshot` and actual consumed
   time/portion as the meal exposure source of truth.
3. Use a dedicated high-frequency physiological sample store; daily wearable
   aggregates are insufficient for post-meal windows.
4. A single meal produces a descriptive episode only. Personal advice requires
   repeated eligible episodes or a validated population model with explicit
   low-confidence labeling.
5. Glucose can be analyzed at meal level; sleep and next-day recovery remain
   day-pattern outcomes unless a repeated controlled protocol supports stronger
   attribution.
6. Numerical inference must be deterministic/statistical. An LLM may translate
   approved structured findings but must not calculate effects or invent causes.
7. Automatic adaptation is allowed only for low-risk meal ranking. Nutrition
   target changes continue to require user confirmation.
8. Production launch is blocked until Qatar privacy/regulatory counsel confirms
   the special-health-data processing and consent path.
