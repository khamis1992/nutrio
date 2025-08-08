import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.allowed) return NextResponse.json({ error: auth.reason }, { status: 403 });
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("restaurants").select("*").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ restaurants: data });
}


