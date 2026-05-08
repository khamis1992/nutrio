import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Op =
  | { op: "create"; payload: CreatePaymentInput }
  | { op: "status"; payload: { paymentId: string } }
  | { op: "refund"; payload: { paymentId: string; amount?: number } };

interface CreatePaymentInput {
  amount: number;
  orderId: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  successUrl: string;
  failureUrl: string;
  callbackUrl: string;
}

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400, headers: corsHeaders });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const apiUrl = Deno.env.get("SADAD_API_URL") ?? "https://api.sadad.qa";
    const merchantId = Deno.env.get("SADAD_MERCHANT_ID");
    const secretKey = Deno.env.get("SADAD_SECRET_KEY");
    if (!merchantId || !secretKey) {
      console.error("Sadad credentials not configured");
      return Response.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders });
    }

    const body = (await req.json().catch(() => null)) as Op | null;
    if (!body || typeof body.op !== "string") {
      return badRequest("Missing op");
    }

    const sadadHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
    };

    if (body.op === "create") {
      const p = body.payload;
      if (!p || typeof p.amount !== "number" || p.amount <= 0 || !p.orderId) {
        return badRequest("Invalid create payload");
      }
      const sadadReq = {
        merchant_id: merchantId,
        amount: p.amount,
        currency: "QAR",
        order_id: p.orderId,
        customer_id: user.id,
        customer_email: p.customerEmail,
        customer_phone: p.customerPhone,
        callback_url: p.callbackUrl,
        success_url: p.successUrl,
        failure_url: p.failureUrl,
        description: p.description ?? "Wallet Top-up",
      };

      const r = await fetch(`${apiUrl}/v1/payments`, {
        method: "POST",
        headers: sadadHeaders,
        body: JSON.stringify(sadadReq),
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error("Sadad create failed:", r.status, errText);
        return Response.json({ error: "Sadad API error" }, { status: 502, headers: corsHeaders });
      }
      const data = await r.json();
      return Response.json(
        { payment_id: data.payment_id, payment_url: data.payment_url, status: data.status, expiry_time: data.expiry_time },
        { headers: corsHeaders }
      );
    }

    if (body.op === "status") {
      const id = body.payload?.paymentId;
      if (!id) return badRequest("Missing paymentId");
      const r = await fetch(`${apiUrl}/v1/payments/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (!r.ok) return Response.json({ error: "Status lookup failed" }, { status: 502, headers: corsHeaders });
      const data = await r.json();
      return Response.json(data, { headers: corsHeaders });
    }

    if (body.op === "refund") {
      const id = body.payload?.paymentId;
      if (!id) return badRequest("Missing paymentId");

      const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "staff"])
        .maybeSingle();
      if (!roleData) {
        return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
      }

      const r = await fetch(`${apiUrl}/v1/payments/${encodeURIComponent(id)}/refund`, {
        method: "POST",
        headers: sadadHeaders,
        body: JSON.stringify({ amount: body.payload.amount }),
      });
      if (!r.ok) return Response.json({ error: "Refund failed" }, { status: 502, headers: corsHeaders });
      const data = await r.json();
      return Response.json(data, { headers: corsHeaders });
    }

    return badRequest("Unknown op");
  } catch (err) {
    console.error("sadad-payment error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});
