import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gym_classes")
    .select("*")
    .eq("gym_id", (await params).gymId)
    .order("start_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  // ensure owner of gym
  const { data: link } = await supabase
    .from("gym_users")
    .select("gym_id")
    .eq("gym_id", (await params).gymId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const payload = { ...body, gym_id: (await params).gymId };
  const { data, error } = await supabase.from("gym_classes").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ class: data });
}
