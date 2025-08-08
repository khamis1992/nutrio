import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateDriver = z.object({ user_id: z.string().uuid(), phone: z.string().optional(), vehicle_type: z.string().optional() });
const UpdateDriver = z.object({ status: z.enum(["inactive","active"]).optional(), phone: z.string().optional(), vehicle_type: z.string().optional() });

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.allowed) return NextResponse.json({ error: auth.reason }, { status: 403 });
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("drivers").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drivers: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if (!auth.allowed) return NextResponse.json({ error: auth.reason }, { status: 403 });
  const body = await req.json();
  const parsed = CreateDriver.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("drivers").insert({ user_id: parsed.data.user_id, phone: parsed.data.phone, vehicle_type: parsed.data.vehicle_type, status: "inactive" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole("admin");
  if (!auth.allowed) return NextResponse.json({ error: auth.reason }, { status: 403 });
  const body = await req.json();
  const parsed = UpdateDriver.safeParse(body);
  if (!parsed.success || !(body && body.user_id)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("drivers").update(parsed.data).eq("user_id", body.user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
