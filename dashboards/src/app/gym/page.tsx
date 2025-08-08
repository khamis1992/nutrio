import { requireRole } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GymDashboard() {
  const auth = await requireRole(["gym_owner", "admin"]);
  if (!auth.allowed) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Unauthorized</h1>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Gym Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/gym/classes" className="border rounded p-4 hover:bg-gray-50">
          Classes
        </Link>
        <Link href="/gym/bookings" className="border rounded p-4 hover:bg-gray-50">
          Bookings
        </Link>
        <Link href="/gym/settings" className="border rounded p-4 hover:bg-gray-50">
          Settings
        </Link>
      </div>
    </main>
  );
}


