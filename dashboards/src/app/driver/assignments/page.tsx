import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
export const dynamic = "force-dynamic";

interface AssignmentRow {
  id: string;
  order_id: string;
  status: string;
}

export default async function DriverAssignments() {
  const auth = await requireRole(["driver", "admin"]);
  if (!auth.allowed) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Unauthorized</h1>
      </main>
    );
  }
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("driver_assignments")
    .select("*, orders(id, status, delivery_scheduled_at, restaurants(name))")
    .eq("driver_id", auth.user!.id)
    .order("assigned_at", { ascending: false })
    .limit(50);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Assignments</h1>
      <ul className="space-y-2">
        {(data as AssignmentRow[] | null) ?.map((a) => (
          <li key={a.id} className="border rounded p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Order #{a.order_id}</div>
                <div className="text-sm text-gray-600">Status: {a.status}</div>
              </div>
              <Link className="text-blue-600 hover:underline" href={`/driver/assignments/${a.id}`}>Open</Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}


