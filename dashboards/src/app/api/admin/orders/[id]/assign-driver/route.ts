import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const BodySchema = z.object({ driver_id: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("admin");
  if (!auth.allowed) return NextResponse.json({ error: auth.reason }, { status: 403 });
  const supabase = createSupabaseServiceClient();
  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // upsert assignment for order
  const orderId = (await params).id;
  // remove previous
  await supabase.from("driver_assignments").delete().eq("order_id", orderId);
  const { error } = await supabase.from("driver_assignments").insert({ order_id: orderId, driver_id: parsed.data.driver_id, status: "assigned" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}


