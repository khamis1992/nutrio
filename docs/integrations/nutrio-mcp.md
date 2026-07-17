# Nutrio MCP Server

Nutrio exposes a read-only MCP endpoint through the authenticated Supabase Edge Function:

```text
https://loepcagitrijlfksawfm.supabase.co/functions/v1/nutrio-mcp
```

## Authentication

Every request must include the signed-in customer's Supabase access token:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
Content-Type: application/json
```

The Edge Function has JWT verification enabled and every database query is also scoped to the authenticated user's ID. Do not use a service-role key in an MCP client.

## Available Tools

| Tool | Purpose | Input |
| --- | --- | --- |
| `nutrition.today` | Today's consumed calories, macros, fiber, and active targets | `{}` |
| `meals.search` | Search available Nutrio meals | `{ "query": "chicken", "limit": 10 }` |
| `schedule.range` | Read scheduled meals for up to 31 days | `{ "from": "2026-07-14", "to": "2026-07-20" }` |
| `activity.recent` | Read recent exercise logs | `{ "limit": 10 }` |

The first version is intentionally read-only. Scheduling, ordering, health-document upload, wallet, and profile mutations are excluded until confirmation and idempotency contracts are defined for external clients.

## MCP Handshake

The server supports JSON-RPC methods `initialize`, `notifications/initialized`, `tools/list`, and `tools/call` using protocol version `2025-03-26`.

Example tool call:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "nutrition.today",
    "arguments": {}
  }
}
```

## Deployment

Apply migrations first, then deploy the function:

```powershell
npx supabase db push
npx supabase functions deploy nutrio-mcp
```

Use a customer session token to test `initialize`, `tools/list`, and each tool. Confirm that a token for one customer cannot return another customer's nutrition, schedule, or activity data.
