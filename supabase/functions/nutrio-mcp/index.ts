import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  getCorsHeaders,
  getSupabasePublishableKey,
  handlePreflight,
  HttpError,
  readBoundedResponseJson,
  readJsonBody,
  requirePost,
} from "../_shared/security.ts";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const REST_RESPONSE_LIMIT = 256 * 1024;

const tools = [
  {
    name: "nutrition.today",
    description:
      "Get today's logged calories, macros, fiber, and active nutrition targets for the authenticated Nutrio user.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "meals.search",
    description: "Search currently available Nutrio meals by name.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 2, maxLength: 80 },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule.range",
    description:
      "List the authenticated user's scheduled meals for a date range of up to 31 days.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", format: "date" },
        to: { type: "string", format: "date" },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "activity.recent",
    description: "Get recent exercise logs for the authenticated Nutrio user.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 30 } },
      additionalProperties: false,
    },
  },
];

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function rpcResult(req: Request, id: JsonRpcRequest["id"], result: unknown) {
  return json(req, { jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(
  req: Request,
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
) {
  return json(req, {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

function qatarDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

async function restQuery(
  supabaseUrl: string,
  table: string,
  params: Record<string, string>,
  headers: Record<string, string>,
) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("database_query_failed");
  return await readBoundedResponseJson<Array<Record<string, unknown>>>(
    response,
    REST_RESPONSE_LIMIT,
  );
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let request: JsonRpcRequest | null = null;
  try {
    requirePost(req);

    let principal;
    try {
      principal = await authenticateRequest(req);
    } catch {
      return rpcError(req, null, -32001, "Unauthorized");
    }

    try {
      await enforceRateLimit(req, "nutrio-mcp", principal.user.id, 180, 3600);
    } catch (error) {
      if (error instanceof HttpError && error.status === 429) {
        return rpcError(req, null, -32002, "Rate limit exceeded");
      }
      throw error;
    }

    request = await readJsonBody<JsonRpcRequest>(req, 16 * 1024);
    if (
      request?.jsonrpc !== "2.0" ||
      typeof request.method !== "string" ||
      request.method.length > 80
    ) {
      return rpcError(req, request?.id, -32600, "Invalid request");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    let publishableKey: string;
    try {
      publishableKey = getSupabasePublishableKey();
    } catch {
      throw new Error("backend_not_configured");
    }
    const authorization = req.headers.get("authorization") || "";
    if (!supabaseUrl) throw new Error("backend_not_configured");
    const headers = {
      apikey: publishableKey,
      Authorization: authorization,
      "Content-Type": "application/json",
    };
    const userId = principal.user.id;

    if (request.method === "initialize") {
      return rpcResult(req, request.id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "nutrio", version: "1.1.0" },
      });
    }
    if (request.method === "notifications/initialized") {
      return new Response(null, { status: 204, headers: getCorsHeaders(req) });
    }
    if (request.method === "tools/list") {
      return rpcResult(req, request.id, { tools });
    }
    if (request.method !== "tools/call") {
      return rpcError(req, request.id, -32601, "Method not found");
    }

    const params = request.params || {};
    const toolName = String(params.name || "").slice(0, 80);
    const args =
      params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {};
    let output: unknown;

    if (toolName === "nutrition.today") {
      const today = qatarDay();
      const [progress, goals] = await Promise.all([
        restQuery(
          supabaseUrl,
          "progress_logs",
          {
            select:
              "calories_consumed,protein_consumed_g,carbs_consumed_g,fat_consumed_g,fiber_consumed_g",
            user_id: `eq.${userId}`,
            log_date: `eq.${today}`,
            limit: "1",
          },
          headers,
        ),
        restQuery(
          supabaseUrl,
          "nutrition_goals",
          {
            select:
              "daily_calorie_target,protein_target_g,carbs_target_g,fat_target_g,fiber_target_g",
            user_id: `eq.${userId}`,
            is_active: "eq.true",
            limit: "1",
          },
          headers,
        ),
      ]);
      output = {
        date: today,
        consumed: progress[0] || null,
        targets: goals[0] || null,
      };
    } else if (toolName === "meals.search") {
      const query = String(args.query || "").trim().slice(0, 80);
      if (query.length < 2) {
        return rpcError(req, request.id, -32602, "Query must contain at least 2 characters");
      }
      output = await restQuery(
        supabaseUrl,
        "meals",
        {
          select:
            "id,name,description,calories,protein_g,carbs_g,fat_g,fiber_g,price,image_url,restaurant_id",
          is_available: "eq.true",
          deleted_at: "is.null",
          name: `ilike.*${query}*`,
          limit: String(clampInteger(args.limit, 10, 1, 20)),
        },
        headers,
      );
    } else if (toolName === "schedule.range") {
      const from = String(args.from || "");
      const to = String(args.to || "");
      const fromDate = new Date(`${from}T00:00:00Z`);
      const toDate = new Date(`${to}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
        Number.isNaN(fromDate.getTime()) ||
        Number.isNaN(toDate.getTime()) ||
        toDate < fromDate ||
        toDate.getTime() - fromDate.getTime() > 31 * 86_400_000
      ) {
        return rpcError(req, request.id, -32602, "Use a valid date range of 31 days or less");
      }
      output = await restQuery(
        supabaseUrl,
        "meal_schedules",
        {
          select:
            "id,scheduled_date,meal_type,delivery_time_slot,is_completed,order_status,meal_id",
          user_id: `eq.${userId}`,
          scheduled_date: `gte.${from}`,
          and: `(scheduled_date.lte.${to})`,
          order: "scheduled_date.asc",
        },
        headers,
      );
    } else if (toolName === "activity.recent") {
      output = await restQuery(
        supabaseUrl,
        "exercise_logs",
        {
          select:
            "id,exercise_type,duration_minutes,calories_burned,intensity,source,date,created_at",
          user_id: `eq.${userId}`,
          order: "date.desc",
          limit: String(clampInteger(args.limit, 10, 1, 30)),
        },
        headers,
      );
    } else {
      return rpcError(req, request.id, -32602, "Unknown tool");
    }

    return rpcResult(req, request.id, {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
      isError: false,
    });
  } catch (error) {
    console.error("Nutrio MCP request failed:", error);
    return rpcError(req, request?.id, -32603, "Internal error");
  }
});
