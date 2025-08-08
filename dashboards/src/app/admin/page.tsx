import { requireRole } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await requireRole("admin");
  if (!auth.allowed) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Unauthorized</h1>
        <p className="mt-2">You do not have access to this page.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/restaurants" className="border rounded p-4 hover:bg-gray-50">
          Manage Restaurants
        </Link>
        <Link href="/admin/meals" className="border rounded p-4 hover:bg-gray-50">
          Manage Meals
        </Link>
        <Link href="/admin/orders" className="border rounded p-4 hover:bg-gray-50">
          Manage Orders
        </Link>
        <Link href="/admin/drivers" className="border rounded p-4 hover:bg-gray-50">
          Manage Drivers
        </Link>
        <Link href="/admin/gyms" className="border rounded p-4 hover:bg-gray-50">
          Manage Gyms & Classes
        </Link>
        <Link href="/admin/subscriptions" className="border rounded p-4 hover:bg-gray-50">
          Manage Subscriptions
        </Link>
      </div>
    </main>
  );
}


