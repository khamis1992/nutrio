import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const BodySchema = z.object({ status: z.enum(["accepted", "picked_up", "delivered", "rejected"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = createSupabaseServerClient();

  // ensure user is driver on this assignment
  const { data: assignment, error: aErr } = await supabase
    .from("driver_assignments")
    .select("*")
    .eq("id", (await params).id)
    .maybeSingle();
  if (aErr || !assignment) return NextResponse.json({ error: "assignment_not_found" }, { status: 404 });
  if (assignment.driver_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const json = await req.json();
  const parse = BodySchema.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const status = parse.data.status;
  const timestamps: Record<string, string> = {
    accepted: "accepted_at",
    picked_up: "picked_up_at",
    delivered: "delivered_at",
  };

  const update: Record<string, unknown> = { status };
  if (timestamps[status]) update[timestamps[status]] = new Date().toISOString();

  const { error } = await supabase
    .from("driver_assignments")
    .update(update)
    .eq("id", (await params).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // optionally update order status when delivered
  if (status === "delivered") {
    await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", assignment.order_id);
  }

  return NextResponse.json({ ok: true });
}
