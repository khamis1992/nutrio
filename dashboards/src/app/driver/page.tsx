import { requireRole } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DriverHome() {
  const auth = await requireRole(["driver", "admin"]);
  if (!auth.allowed) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Unauthorized</h1>
      </main>
    );
  }
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Driver PWA</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/driver/assignments" className="border rounded p-4 hover:bg-gray-50">
          My Assignments
        </Link>
        <Link href="/driver/profile" className="border rounded p-4 hover:bg-gray-50">
          Profile
        </Link>
      </div>
    </main>
  );
}


