import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const BodySchema = z.object({ status: z.enum(["accepted","preparing","ready","out_for_delivery","cancelled"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("restaurant_id").eq("id", (await params).id).maybeSingle();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: link } = await supabase.from("restaurant_users").select("restaurant_id").eq("restaurant_id", order.restaurant_id).eq("user_id", user.id).maybeSingle();
  if (!link) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { error } = await supabase.from("orders").update({ status: parsed.data.status }).eq("id", (await params).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}


