import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const MealInput = z.object({ name: z.string().min(1), description: z.string().optional(), price: z.number().nonnegative().optional(), image_url: z.string().url().optional(), available: z.boolean().optional() });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: links } = await supabase.from("restaurant_users").select("restaurant_id").eq("user_id", user.id);
  const ids = (links ?? []).map((l: { restaurant_id: string }) => l.restaurant_id);
  if (ids.length === 0) return NextResponse.json({ meals: [] });
  const { data, error } = await supabase.from("meals").select("*").in("restaurant_id", ids).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meals: data });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: link } = await supabase.from("restaurant_users").select("restaurant_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!link) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = MealInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { error } = await supabase.from("meals").insert({ ...parsed.data, restaurant_id: link.restaurant_id, available: parsed.data.available ?? true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const body = await req.json();
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { data: meal } = await supabase.from("meals").select("restaurant_id").eq("id", id).maybeSingle();
  if (!meal) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: link } = await supabase.from("restaurant_users").select("restaurant_id").eq("restaurant_id", meal.restaurant_id).eq("user_id", user.id).maybeSingle();
  if (!link) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = MealInput.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { error } = await supabase.from("meals").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
