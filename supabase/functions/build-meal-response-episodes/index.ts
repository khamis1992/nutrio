import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  analyzeMealResponse,
  classifyEvidenceTier,
  deriveExploratoryHeartRateOutcomes,
  deriveNextDayRecoveryContext,
  deriveSelfReportedOutcomes,
  type Confounder,
  type DerivedMealResponseOutcome,
  type EvidenceTier,
  type GlucoseSample,
  type MealTimePrecision,
} from "../../../src/lib/meal-response-analytics.ts";
import {
  authenticateRequest,
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  requirePost,
} from "../_shared/security.ts";

const PROTOCOL_VERSION = "meal-response-episode-v1";
const FEATURE_SCHEMA_VERSION = "meal-response-features-v1";

interface WorkerBody {
  consumption_id?: unknown;
  limit?: unknown;
}

interface ConsumptionRow {
  id: string;
  event_version: number;
  started_consuming_at: string;
  time_precision: MealTimePrecision;
  portion_confirmed_at: string | null;
  consumed_item_snapshot: Record<string, unknown> | null;
  status: string;
  timezone_name: string | null;
}

const boundedLimit = (value: unknown) => Math.max(1, Math.min(25, Math.floor(Number(value) || 10)));
const finite = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const asObject = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {};

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function dbEvidenceTier(tier: EvidenceTier) {
  if (tier === "insufficient") return "insufficient_evidence";
  if (tier === "early") return "early_signal";
  if (tier === "medium") return "moderate";
  return tier;
}

function dateInTimezone(timestamp: string, timezone: string | null, dayOffset = 0) {
  const instant = new Date(new Date(timestamp).getTime() + dayOffset * 24 * 60 * 60_000);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const part = (type: string) => parts.find((value) => value.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

function contextualEligibility(input: {
  hasSelfReport: boolean;
  timePrecision: MealTimePrecision;
  portionConfirmed: boolean;
  nutritionCompleteness: number;
  overlappingMeal: boolean;
  confounderCount: number;
}) {
  if (!input.hasSelfReport) return null;
  if (input.timePrecision === "date_only" || !input.portionConfirmed || input.nutritionCompleteness < 0.8) {
    return "excluded" as const;
  }
  return input.timePrecision !== "exact" || input.overlappingMeal || input.confounderCount > 0
    ? "descriptive_only" as const
    : "eligible" as const;
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    const body = await readJsonBody<WorkerBody>(req, 4 * 1024);
    const service = getServiceClient();
    const userId = principal.user.id;

    const { data: engineSetting, error: engineSettingError } = await service
      .from("platform_settings")
      .select("value")
      .eq("key", "meal-response-engine")
      .maybeSingle();
    if (engineSettingError) throw new HttpError(503, "meal_response_engine_setting_unavailable");
    const engineFlags = asObject(engineSetting?.value);
    if (engineFlags.episode_building_enabled !== true) {
      throw new HttpError(503, "meal_response_episode_building_disabled");
    }

    const { data: preferences, error: preferenceError } = await service
      .from("health_context_preferences")
      .select("meal_response_enabled, glucose_analysis_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (preferenceError) throw new HttpError(503, "meal_response_preferences_unavailable");
    if (!preferences?.meal_response_enabled) throw new HttpError(403, "meal_response_opt_in_required");

    let consumptionQuery = service
      .from("meal_consumptions")
      .select("id, event_version, started_consuming_at, time_precision, portion_confirmed_at, consumed_item_snapshot, status, timezone_name")
      .eq("user_id", userId)
      .in("status", ["full", "partial", "substituted"])
      .not("started_consuming_at", "is", null)
      .lte("started_consuming_at", new Date(Date.now() - 120 * 60_000).toISOString())
      .order("started_consuming_at", { ascending: false })
      .limit(boundedLimit(body.limit));
    if (typeof body.consumption_id === "string" && body.consumption_id) {
      consumptionQuery = consumptionQuery.eq("id", body.consumption_id);
    }
    const { data: consumptionData, error: consumptionError } = await consumptionQuery;
    if (consumptionError) throw new HttpError(503, "meal_consumptions_unavailable");
    const consumptions = (consumptionData || []) as ConsumptionRow[];

    const { data: allRecent } = await service
      .from("meal_consumptions")
      .select("id, started_consuming_at")
      .eq("user_id", userId)
      .not("started_consuming_at", "is", null)
      .gte("started_consuming_at", new Date(Date.now() - 35 * 24 * 60 * 60_000).toISOString());

    const { data: model, error: modelError } = await service
      .from("meal_response_model_registry")
      .select("id")
      .eq("model_name", "deterministic-meal-response")
      .eq("model_version", "rules-v1")
      .single();
    if (modelError || !model) throw new HttpError(503, "meal_response_model_unavailable");

    let built = 0;
    let excluded = 0;
    const failures: Array<{ consumption_id: string; code: string }> = [];

    for (const consumption of consumptions) {
      try {
        const mealAt = new Date(consumption.started_consuming_at).getTime();
        const responseEnd = new Date(mealAt + 180 * 60_000).toISOString();
        const baselineStart = new Date(mealAt - 30 * 60_000).toISOString();
        const { data: glucoseRows, error: glucoseError } = preferences.glucose_analysis_enabled
          ? await service
            .from("wearable_metric_samples")
            .select("start_at, value, unit, provider, quality_flags")
            .eq("user_id", userId)
            .eq("metric_type", "blood_glucose")
            .eq("sync_status", "synced")
            .is("deleted_at", null)
            .gte("start_at", baselineStart)
            .lte("start_at", responseEnd)
            .order("start_at")
          : { data: [], error: null };
        if (glucoseError) throw new Error("glucose_samples_unavailable");

        const { data: heartRateRows, error: heartRateError } = await service
          .from("wearable_metric_samples")
          .select("start_at, value, unit, provider")
          .eq("user_id", userId)
          .eq("metric_type", "heart_rate_sample")
          .eq("sync_status", "synced")
          .is("deleted_at", null)
          .gte("start_at", baselineStart)
          .lte("start_at", new Date(mealAt + 120 * 60_000).toISOString())
          .order("start_at");
        if (heartRateError) throw new Error("heart_rate_samples_unavailable");

        const { data: checkIns, error: checkInError } = await service
          .from("meal_response_check_ins")
          .select("prompt_offset_minutes, satiety, energy, digestive_symptoms, symptom_severity, confounders, submitted_at")
          .eq("user_id", userId)
          .eq("consumption_id", consumption.id);
        if (checkInError) throw new Error("check_ins_unavailable");
        const rawConfounders = [...new Set((checkIns || []).flatMap((row) => row.confounders || []))];
        const confounders = rawConfounders
          .map((value) => value === "cycle_context" ? "menstrual_cycle" : value)
          .filter((value): value is Confounder => [
            "exercise", "caffeine", "alcohol", "illness", "poor_sleep", "travel",
            "fasting", "medication_change", "menstrual_cycle",
          ].includes(value));
        const overlappingMeal = (allRecent || []).some((row) => row.id !== consumption.id
          && Math.abs(new Date(row.started_consuming_at).getTime() - mealAt) < 180 * 60_000);
        const samples: GlucoseSample[] = (glucoseRows || []).map((row) => ({
          timestamp: row.start_at,
          value: finite(row.value),
          unit: row.unit,
          sourceId: row.provider,
        }));
        const selfReportedOutcomes = deriveSelfReportedOutcomes((checkIns || []).map((row) => ({
          promptOffsetMinutes: finite(row.prompt_offset_minutes),
          submittedAt: row.submitted_at,
          satiety: row.satiety,
          energy: row.energy,
          digestiveSymptoms: row.digestive_symptoms,
          symptomSeverity: row.symptom_severity,
        })));
        const heartRateOutcomes = deriveExploratoryHeartRateOutcomes((heartRateRows || []).map((row) => ({
          timestamp: row.start_at,
          value: finite(row.value),
          unit: row.unit,
          sourceId: row.provider,
        })), consumption.started_consuming_at);
        const nextDay = dateInTimezone(consumption.started_consuming_at, consumption.timezone_name, 1);
        const { data: nextDayContext, error: nextDayContextError } = await service
          .from("health_daily_metrics")
          .select("metric_date, sleep_minutes, hrv, resting_heart_rate, source")
          .eq("user_id", userId)
          .eq("metric_date", nextDay)
          .maybeSingle();
        if (nextDayContextError) throw new Error("next_day_context_unavailable");
        const nextDayOutcomes = deriveNextDayRecoveryContext(nextDayContext ? {
          metricDate: nextDayContext.metric_date,
          sleepMinutes: nextDayContext.sleep_minutes,
          hrvMs: nextDayContext.hrv,
          restingHeartRateBpm: nextDayContext.resting_heart_rate,
          source: nextDayContext.source,
        } : null);
        const snapshot = asObject(consumption.consumed_item_snapshot);
        const nutritionCompleteness = finite(snapshot.completeness_score, 1);
        const analysis = analyzeMealResponse({
          mealAt: consumption.started_consuming_at,
          samples,
          postMealMinutes: 180,
          expectedIntervalMinutes: 5,
          timePrecision: consumption.time_precision,
          portionConfirmed: Boolean(consumption.portion_confirmed_at),
          nutritionCompleteness,
          overlappingMeal,
          sourceKnown: samples.every((sample) => Boolean(sample.sourceId)),
          mixedSourcesResolved: new Set(samples.map((sample) => sample.sourceId)).size <= 1,
          confounders,
        });
        const nonCgmEligibility = contextualEligibility({
          hasSelfReport: selfReportedOutcomes.length > 0,
          timePrecision: consumption.time_precision,
          portionConfirmed: Boolean(consumption.portion_confirmed_at),
          nutritionCompleteness,
          overlappingMeal,
          confounderCount: rawConfounders.length,
        });
        const episodeEligibility = analysis.quality.eligibility === "eligible"
          ? "eligible"
          : nonCgmEligibility ?? analysis.quality.eligibility;
        const nonCgmOnly = samples.length === 0 && selfReportedOutcomes.length > 0;
        const episodeExclusionReasons = nonCgmOnly
          ? [
            ...(consumption.time_precision === "date_only" ? ["date_only_meal_time"] : []),
            ...(!consumption.portion_confirmed_at ? ["portion_not_confirmed"] : []),
            ...(nutritionCompleteness < 0.8 ? ["incomplete_nutrition"] : []),
          ]
          : analysis.quality.exclusionReasons;
        const derivedOutcomes = [...selfReportedOutcomes, ...heartRateOutcomes, ...nextDayOutcomes];
        const outcomes = {
          baseline_mg_dl: analysis.baselineMgDl,
          positive_iauc_mg_dl_min: analysis.positiveIAucMgDlMinutes,
          peak_delta_mg_dl: analysis.peak?.peakDeltaMgDl ?? null,
          peak_mg_dl: analysis.peak?.peakValueMgDl ?? null,
          time_to_peak_minutes: analysis.peak?.timeToPeakMinutes ?? null,
          recovery_minutes: analysis.recoveryTimeMinutes,
          confidence_score: analysis.confidence.score,
          ...Object.fromEntries(derivedOutcomes.map((outcome) => [outcome.outcomeType, outcome.value])),
          outcome_metadata: Object.fromEntries(derivedOutcomes.map((outcome) => [outcome.outcomeType, {
            source_kind: outcome.sourceKind,
            association_scope: outcome.associationScope,
            evidence_eligible: outcome.evidenceEligible,
            uncertainty: outcome.uncertainty,
            limitations: outcome.limitations,
          }])),
        };
        const { data: episode, error: episodeError } = await service
          .from("meal_response_episodes")
          .upsert({
            user_id: userId,
            consumption_id: consumption.id,
            consumption_version: consumption.event_version,
            protocol_version: PROTOCOL_VERSION,
            baseline_start_at: baselineStart,
            baseline_end_at: new Date(mealAt - 5 * 60_000).toISOString(),
            response_start_at: consumption.started_consuming_at,
            response_end_at: responseEnd,
            eligibility: episodeEligibility,
            sample_coverage: Math.min(analysis.baselineCoverage.ratio, analysis.postMealCoverage.ratio),
            baseline_sample_count: analysis.baselineCoverage.sampleCount,
            response_sample_count: analysis.postMealCoverage.sampleCount,
            exclusion_reasons: episodeExclusionReasons,
            quality_flags: [
              ...rawConfounders.map((value) => `confounder:${value}`),
              ...(analysis.prepared.mixedUnits ? ["mixed_units_normalized"] : []),
              ...(analysis.prepared.outlierCount ? ["outliers_removed"] : []),
              ...(selfReportedOutcomes.length ? ["self_reported_outcomes_present"] : []),
              ...(heartRateOutcomes.length ? ["heart_rate_exploratory_only"] : []),
              ...(nextDayOutcomes.length ? ["next_day_day_level_association_only"] : []),
            ],
            outcomes,
            superseded_at: null,
          }, { onConflict: "consumption_id,consumption_version,protocol_version" })
          .select("id")
          .single();
        if (episodeError || !episode) throw new Error("episode_write_failed");

        const featureJson = {
          protocol_version: PROTOCOL_VERSION,
          meal_id: snapshot.meal_id || null,
          nutrition: {
            calories: finite(snapshot.calories), protein_g: finite(snapshot.protein_g),
            carbs_g: finite(snapshot.carbs_g), fat_g: finite(snapshot.fat_g), fiber_g: finite(snapshot.fiber_g),
          },
          timing: { precision: consumption.time_precision, hour_utc: new Date(mealAt).getUTCHours() },
          quality: {
            eligibility: episodeEligibility,
            baseline_coverage: analysis.baselineCoverage.ratio,
            post_meal_coverage: analysis.postMealCoverage.ratio,
            confidence_score: analysis.confidence.score,
            non_cgm_sources: {
              self_reported: selfReportedOutcomes.length > 0,
              exploratory_heart_rate: heartRateOutcomes.length > 0,
              next_day_context: nextDayOutcomes.length > 0,
            },
          },
          outcomes,
        };
        const checksum = await sha256(featureJson);
        const { data: feature, error: featureError } = await service
          .from("meal_response_feature_snapshots")
          .upsert({ user_id: userId, episode_id: episode.id, schema_version: FEATURE_SCHEMA_VERSION, feature_json: featureJson, checksum }, { onConflict: "episode_id,schema_version,checksum" })
          .select("id")
          .single();
        if (featureError || !feature) throw new Error("feature_snapshot_write_failed");

        const { data: eligibleEpisodes } = await service
          .from("meal_response_episodes")
          .select("id, outcomes, response_start_at, consumption_id, meal_consumptions!inner(consumed_item_snapshot)")
          .eq("user_id", userId)
          .eq("eligibility", "eligible")
          .is("superseded_at", null);
        const mealId = String(snapshot.meal_id || "");
        const matching = (eligibleEpisodes || []).filter((row) => {
          const joined = Array.isArray(row.meal_consumptions) ? row.meal_consumptions[0] : row.meal_consumptions;
          return String(asObject(asObject(joined).consumed_item_snapshot).meal_id || "") === mealId;
        });
        const glucoseMatches = matching.filter((row) => Number.isFinite(Number(asObject(row.outcomes).peak_delta_mg_dl)));
        const peakValues = glucoseMatches.map((row) => finite(asObject(row.outcomes).peak_delta_mg_dl, NaN)).filter(Number.isFinite);
        const distinctDays = new Set(glucoseMatches.map((row) => String(row.response_start_at).slice(0, 10))).size;
        const directionAgreement = peakValues.length < 2 || peakValues.filter((value) => value >= 0).length / peakValues.length >= 0.8;
        const glucoseEvidence = classifyEvidenceTier({
          eligibleEpisodeCount: glucoseMatches.length,
          distinctDayCount: distinctDays,
          consistentDirection: directionAgreement,
          calibrated: true,
          stable: analysis.confidence.score >= 85,
          confidenceScore: analysis.confidence.score,
        });

        const now = new Date().toISOString();
        const commonLimitations = [
          ...episodeExclusionReasons,
          ...rawConfounders.map((value) => `confounder:${value}`),
          "association_not_causation",
          "not_medical_advice",
        ];
        const glucoseEstimateRows = [
          ["glucose_peak_delta", outcomes.peak_delta_mg_dl, "mg/dL"],
          ["glucose_positive_iauc", outcomes.positive_iauc_mg_dl_min, "mg/dL*min"],
          ["glucose_recovery_time", outcomes.recovery_minutes, "minutes"],
        ].filter(([, value]) => value !== null).map(([outcomeType, value, unit]) => ({
          user_id: userId,
          episode_id: episode.id,
          feature_snapshot_id: feature.id,
          model_id: model.id,
          outcome_type: outcomeType,
          estimate_value: value,
          estimate_unit: unit,
          evidence_tier: dbEvidenceTier(glucoseEvidence.tier),
          source_kind: "measured",
          eligible_episode_count: glucoseMatches.length,
          limitations: [...commonLimitations, glucoseEvidence.claim],
          abstention_reason: glucoseEvidence.tier === "insufficient" ? "insufficient_qualified_repeats" : null,
          data_cutoff_at: now,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
        }));
        const derivedEstimateRows = derivedOutcomes.map((outcome: DerivedMealResponseOutcome) => {
          const outcomeMatches = matching.filter((row) => Number.isFinite(Number(asObject(row.outcomes)[outcome.outcomeType])));
          const outcomeDays = new Set(outcomeMatches.map((row) => String(row.response_start_at).slice(0, 10))).size;
          const evidence = outcome.evidenceEligible
            ? classifyEvidenceTier({
              eligibleEpisodeCount: outcomeMatches.length,
              distinctDayCount: outcomeDays,
              consistentDirection: false,
              calibrated: false,
              stable: false,
              confidenceScore: episodeEligibility === "eligible" ? 65 : 35,
            })
            : { tier: "descriptive" as const, claim: "This is exploratory wellness context and does not establish that the meal caused the observation." };
          return {
            user_id: userId,
            episode_id: episode.id,
            feature_snapshot_id: feature.id,
            model_id: model.id,
            outcome_type: outcome.outcomeType,
            estimate_value: outcome.value,
            estimate_unit: outcome.unit,
            evidence_tier: dbEvidenceTier(evidence.tier),
            source_kind: outcome.sourceKind,
            eligible_episode_count: outcome.evidenceEligible ? outcomeMatches.length : 0,
            limitations: [
              ...commonLimitations,
              ...outcome.uncertainty,
              ...outcome.limitations,
              `association_scope:${outcome.associationScope}`,
              evidence.claim,
            ],
            abstention_reason: evidence.tier === "insufficient" ? "insufficient_qualified_repeats" : null,
            data_cutoff_at: now,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
          };
        });
        const estimateRows = [...glucoseEstimateRows, ...derivedEstimateRows];

        const { data: previousEstimates, error: previousEstimateError } = await service
          .from("meal_response_estimates")
          .select("id")
          .eq("user_id", userId)
          .eq("episode_id", episode.id)
          .eq("model_id", model.id)
          .is("superseded_at", null);
        if (previousEstimateError) throw new Error("current_estimates_unavailable");
        if (estimateRows.length > 0) {
          const { error: estimateError } = await service.from("meal_response_estimates").insert(estimateRows);
          if (estimateError) throw new Error("estimate_write_failed");
        }
        const previousIds = (previousEstimates || []).map((row) => row.id);
        if (previousIds.length > 0) {
          const { error: supersedeError } = await service
            .from("meal_response_estimates")
            .update({ superseded_at: now })
            .in("id", previousIds);
          if (supersedeError) throw new Error("estimate_supersession_failed");
        }

        if (episodeEligibility === "excluded") excluded += 1;
        else built += 1;
      } catch (error) {
        failures.push({ consumption_id: consumption.id, code: error instanceof Error ? error.message : "episode_build_failed" });
      }
    }

    return jsonResponse(req, { success: true, considered: consumptions.length, built, excluded, failures });
  } catch (error) {
    return errorResponse(req, error);
  }
});
