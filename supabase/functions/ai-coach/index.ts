import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getClientIp,
  getServiceClient,
  getSupabasePublishableKey,
  handlePreflight,
  HttpError,
  jsonResponse,
  readBoundedResponseJson,
  readJsonBody,
  requirePost,
} from "../_shared/security.ts";

type CoachAction = "list" | "messages" | "send" | "archive" | "list_memories" | "delete_memory";

interface CoachRequest {
  action: CoachAction;
  conversationId?: string;
  memoryId?: string;
  message?: string;
  locale?: "ar" | "en";
  requestId?: string;
}

interface RouterResponse { content?: unknown }
interface CoachModelResponse {
  reply?: unknown;
  conversation_summary?: unknown;
  memory_updates?: unknown;
}

interface MemoryUpdate {
  type: "preference" | "routine" | "constraint" | "goal" | "context";
  content: string;
  confidence: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROUTER_RESPONSE_LIMIT = 96 * 1024;
const MEMORY_TYPES = new Set(["preference", "routine", "constraint", "goal", "context"]);
const CONSENT_POLICY_VERSION = "2026-07-health-ai-v1";

function cleanText(value: unknown, maxLength: number): string {
  return Array.from(String(value ?? ""))
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function requireUuid(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new HttpError(400, errorCode);
  return value;
}

function normalizeModelResponse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(502, "invalid_ai_response");
  }
  const response = value as CoachModelResponse;
  const reply = cleanText(response.reply, 8000);
  const summary = cleanText(response.conversation_summary, 4000);
  if (!reply) throw new HttpError(502, "invalid_ai_response");

  const memories: MemoryUpdate[] = Array.isArray(response.memory_updates)
    ? response.memory_updates.slice(0, 5).flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const record = entry as Record<string, unknown>;
      const type = cleanText(record.type, 30);
      const content = cleanText(record.content, 600);
      const confidence = Number(record.confidence);
      if (!MEMORY_TYPES.has(type) || !content || !Number.isFinite(confidence)) return [];
      return [{
        type: type as MemoryUpdate["type"],
        content,
        confidence: Math.max(0, Math.min(1, confidence)),
      }];
    })
    : [];
  return { reply, summary, memories };
}

function parseModelResponse(content: string): unknown {
  const trimmed = content.trim();
  const candidate = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new HttpError(502, "invalid_ai_response");
  }
}

async function loadConversation(userId: string, conversationId: string) {
  const { data, error } = await getServiceClient()
    .from("ai_coach_conversations")
    .select("id,user_id,title,summary,locale,last_message_at,created_at,updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new HttpError(503, "coach_conversation_lookup_failed");
  if (!data) throw new HttpError(404, "coach_conversation_not_found");
  return data;
}

async function loadNutritionContext(userId: string) {
  const service = getServiceClient();
  const startDate = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const mealStartDate = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);
  const [profileResult, goalResult, progressResult, waterResult, mealsResult] = await Promise.all([
    service.from("profiles")
      .select("health_goal,current_weight_kg,target_weight_kg,daily_calorie_target,protein_target_g,carbs_target_g,fat_target_g")
      .eq("user_id", userId).maybeSingle(),
    service.from("nutrition_goals")
      .select("goal_type,daily_calorie_target,protein_target_g,carbs_target_g,fat_target_g,target_weight_kg")
      .eq("user_id", userId).eq("is_active", true).maybeSingle(),
    service.from("progress_logs")
      .select("log_date,calories_consumed,protein_consumed_g,carbs_consumed_g,fat_consumed_g")
      .eq("user_id", userId).gte("log_date", startDate).order("log_date", { ascending: true }),
    service.from("water_entries").select("log_date,amount_ml")
      .eq("user_id", userId).gte("log_date", startDate),
    service.from("nutrition_logs").select("date,meal_type,calories,protein,skipped")
      .eq("user_id", userId).gte("date", mealStartDate).order("date", { ascending: false }).limit(12),
  ]);
  if ([profileResult, goalResult, progressResult, waterResult, mealsResult].some((result) => result.error)) {
    throw new HttpError(503, "coach_context_unavailable");
  }

  const profile = profileResult.data;
  const goal = goalResult.data;
  const waterByDate = new Map<string, number>();
  for (const entry of waterResult.data ?? []) {
    waterByDate.set(entry.log_date, (waterByDate.get(entry.log_date) ?? 0) + Number(entry.amount_ml ?? 0));
  }
  return {
    goal: goal?.goal_type ?? profile?.health_goal ?? "general health",
    calorieTarget: goal?.daily_calorie_target ?? profile?.daily_calorie_target ?? null,
    proteinTargetG: goal?.protein_target_g ?? profile?.protein_target_g ?? null,
    carbsTargetG: goal?.carbs_target_g ?? profile?.carbs_target_g ?? null,
    fatTargetG: goal?.fat_target_g ?? profile?.fat_target_g ?? null,
    currentWeightKg: profile?.current_weight_kg ?? null,
    targetWeightKg: goal?.target_weight_kg ?? profile?.target_weight_kg ?? null,
    lastSevenDays: (progressResult.data ?? []).map((entry) => ({
      date: entry.log_date,
      calories: entry.calories_consumed,
      proteinG: entry.protein_consumed_g,
      carbsG: entry.carbs_consumed_g,
      fatG: entry.fat_consumed_g,
      waterMl: waterByDate.get(entry.log_date) ?? 0,
    })),
    recentMeals: (mealsResult.data ?? []).map((entry) => ({
      date: entry.date,
      mealType: entry.meal_type,
      calories: entry.calories,
      proteinG: entry.protein,
      skipped: Boolean(entry.skipped),
    })),
  };
}

async function handleList(userId: string, req: Request) {
  const { data, error } = await getServiceClient().from("ai_coach_conversations")
    .select("id,title,locale,last_message_at,created_at,updated_at")
    .eq("user_id", userId).is("archived_at", null)
    .order("last_message_at", { ascending: false }).limit(30);
  if (error) throw new HttpError(503, "coach_conversations_unavailable");
  return jsonResponse(req, { conversations: data ?? [] });
}

async function handleMessages(userId: string, conversationId: string, req: Request) {
  await loadConversation(userId, conversationId);
  const { data, error } = await getServiceClient().from("ai_coach_messages")
    .select("id,conversation_id,role,content,created_at")
    .eq("conversation_id", conversationId).eq("user_id", userId)
    .order("created_at", { ascending: true }).limit(100);
  if (error) throw new HttpError(503, "coach_messages_unavailable");
  return jsonResponse(req, { messages: data ?? [] });
}

async function handleMemories(userId: string, req: Request) {
  const { data, error } = await getServiceClient().from("ai_coach_memories")
    .select("id,memory_type,content,confidence,last_confirmed_at,created_at")
    .eq("user_id", userId).order("last_confirmed_at", { ascending: false }).limit(50);
  if (error) throw new HttpError(503, "coach_memories_unavailable");
  return jsonResponse(req, { memories: data ?? [] });
}

async function handleSend(userId: string, authHeader: string, body: CoachRequest, req: Request) {
  const service = getServiceClient();
  const requestId = requireUuid(body.requestId, "invalid_request_identifier");
  const message = cleanText(body.message, 1600);
  const locale = body.locale === "ar" ? "ar" : "en";
  if (!message) throw new HttpError(400, "coach_message_required");

  const { data: consent, error: consentError } = await service
    .from("ai_data_consents")
    .select("status,policy_version")
    .eq("user_id", userId)
    .eq("purpose", "nutrition_coaching")
    .maybeSingle();
  if (consentError) throw new HttpError(503, "consent_check_failed");
  if (consent?.status !== "granted" || consent.policy_version !== CONSENT_POLICY_VERSION) {
    throw new HttpError(403, "health_ai_consent_required");
  }

  const { data: duplicateAssistant, error: duplicateAssistantError } = await service
    .from("ai_coach_messages")
    .select("id,conversation_id,role,content,created_at")
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .eq("role", "assistant")
    .maybeSingle();
  if (duplicateAssistantError) throw new HttpError(503, "coach_message_lookup_failed");
  if (duplicateAssistant) {
    const duplicateConversation = await loadConversation(userId, duplicateAssistant.conversation_id);
    return jsonResponse(req, {
      conversation: duplicateConversation,
      message: duplicateAssistant,
      duplicate: true,
    });
  }

  const { data: existingUserMessage, error: existingUserMessageError } = await service
    .from("ai_coach_messages")
    .select("id,conversation_id,role,content,created_at")
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .eq("role", "user")
    .maybeSingle();
  if (existingUserMessageError) throw new HttpError(503, "coach_message_lookup_failed");

  let conversation = existingUserMessage
    ? await loadConversation(userId, existingUserMessage.conversation_id)
    : body.conversationId
      ? await loadConversation(userId, requireUuid(body.conversationId, "invalid_conversation_identifier"))
      : null;
  if (!conversation) {
    const result = await service.from("ai_coach_conversations")
      .insert({ user_id: userId, locale, title: message.slice(0, 80) })
      .select("id,user_id,title,summary,locale,last_message_at,created_at,updated_at").single();
    if (result.error || !result.data) throw new HttpError(503, "coach_conversation_create_failed");
    conversation = result.data;
  }

  const [historyResult, memoriesResult, nutritionContext] = await Promise.all([
    service.from("ai_coach_messages").select("role,content,created_at,request_id")
      .eq("conversation_id", conversation.id).eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(12),
    service.from("ai_coach_memories").select("memory_type,content")
      .eq("user_id", userId).order("last_confirmed_at", { ascending: false }).limit(20),
    loadNutritionContext(userId),
  ]);
  if (historyResult.error || memoriesResult.error) throw new HttpError(503, "coach_context_unavailable");

  const savedUserMessage = existingUserMessage ?? await (async () => {
    const result = await service.from("ai_coach_messages")
      .insert({ conversation_id: conversation.id, user_id: userId, role: "user", content: message, request_id: requestId })
      .select("id,conversation_id,role,content,created_at").single();
    if (result.error || !result.data) throw new HttpError(503, "coach_message_save_failed");
    return result.data;
  })();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new HttpError(503, "backend_not_configured");
  let routerResponse: Response;
  try {
    routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: { apikey: getSupabasePublishableKey(), Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "nutrition_coach",
        requestId: crypto.randomUUID(),
        input: {
          locale,
          message,
          conversationSummary: conversation.summary,
          recentMessages: (historyResult.data ?? [])
            .filter((entry) => entry.request_id !== requestId)
            .reverse()
            .map(({ role, content, created_at }) => ({ role, content, created_at })),
          memories: (memoriesResult.data ?? []).map((memory) => ({ type: memory.memory_type, content: memory.content })),
          nutritionContext,
        },
      }),
      signal: AbortSignal.timeout(35_000),
    });
  } catch {
    throw new HttpError(502, "coach_response_unavailable");
  }
  const routerData = await readBoundedResponseJson<RouterResponse>(routerResponse, ROUTER_RESPONSE_LIMIT).catch(() => null);
  if (!routerResponse.ok || typeof routerData?.content !== "string") {
    throw new HttpError(routerResponse.status === 429 ? 429 : 502, "coach_response_unavailable");
  }

  const model = normalizeModelResponse(parseModelResponse(routerData.content));
  const assistantResult = await service.from("ai_coach_messages")
    .insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: "assistant",
      content: model.reply,
      request_id: requestId,
      metadata: { provider: "ai-router" },
    })
    .select("id,conversation_id,role,content,created_at").single();
  if (assistantResult.error || !assistantResult.data) throw new HttpError(503, "coach_response_save_failed");

  if (model.memories.length > 0) {
    const now = new Date().toISOString();
    const { error } = await service.from("ai_coach_memories").upsert(
      model.memories.map((memory) => ({
        user_id: userId,
        memory_type: memory.type,
        content: memory.content,
        confidence: memory.confidence,
        source_conversation_id: conversation.id,
        source_message_id: savedUserMessage.id,
        last_confirmed_at: now,
        updated_at: now,
      })),
      { onConflict: "user_id,memory_type,content" },
    );
    if (error) console.error("Unable to persist AI Coach memory", error.message);
  }

  const updatedResult = await service.from("ai_coach_conversations")
    .update({ summary: model.summary, locale, last_message_at: assistantResult.data.created_at })
    .eq("id", conversation.id).eq("user_id", userId)
    .select("id,title,locale,last_message_at,created_at,updated_at").single();
  if (updatedResult.error) console.error("Unable to update AI Coach conversation");

  return jsonResponse(req, {
    conversation: updatedResult.data ?? conversation,
    userMessage: savedUserMessage,
    message: assistantResult.data,
    memoriesAdded: model.memories.length,
  });
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    const authHeader = req.headers.get("authorization") ?? "";
    const clientIp = getClientIp(req) || "unknown";
    await Promise.all([
      enforceRateLimit(req, "ai-coach:user", principal.user.id, 80, 60 * 60),
      enforceRateLimit(req, "ai-coach:ip", clientIp, 100, 60 * 60),
    ]);
    const body = await readJsonBody<CoachRequest>(req, 12 * 1024);
    if (!body.action) throw new HttpError(400, "coach_action_required");

    if (body.action === "list") return await handleList(principal.user.id, req);
    if (body.action === "list_memories") return await handleMemories(principal.user.id, req);
    if (body.action === "messages") {
      return await handleMessages(principal.user.id, requireUuid(body.conversationId, "invalid_conversation_identifier"), req);
    }
    if (body.action === "send") return await handleSend(principal.user.id, authHeader, body, req);
    if (body.action === "archive") {
      const conversationId = requireUuid(body.conversationId, "invalid_conversation_identifier");
      await loadConversation(principal.user.id, conversationId);
      const { error } = await getServiceClient().from("ai_coach_conversations")
        .update({ archived_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", principal.user.id);
      if (error) throw new HttpError(503, "coach_conversation_archive_failed");
      return jsonResponse(req, { success: true });
    }
    if (body.action === "delete_memory") {
      const memoryId = requireUuid(body.memoryId, "invalid_memory_identifier");
      const { error } = await getServiceClient().from("ai_coach_memories")
        .delete().eq("id", memoryId).eq("user_id", principal.user.id);
      if (error) throw new HttpError(503, "coach_memory_delete_failed");
      return jsonResponse(req, { success: true });
    }
    throw new HttpError(400, "unsupported_coach_action");
  } catch (error) {
    return errorResponse(req, error);
  }
});
