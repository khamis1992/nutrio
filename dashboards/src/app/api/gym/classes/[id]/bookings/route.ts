import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: klass } = await supabase.from("gym_classes").select("gym_id").eq("id", (await params).id).maybeSingle();
  if (!klass) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: link } = await supabase.from("gym_users").select("gym_id").eq("gym_id", klass.gym_id).eq("user_id", user.id).maybeSingle();
  if (!link) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data, error } = await supabase.from("gym_bookings").select("*").eq("class_id", (await params).id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data });
}
