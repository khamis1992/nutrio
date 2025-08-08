import { requireRole } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RestaurantDashboard() {
  const auth = await requireRole(["restaurant_owner", "admin"]);
  if (!auth.allowed) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Unauthorized</h1>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Restaurant Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/restaurant/orders" className="border rounded p-4 hover:bg-gray-50">
          Orders
        </Link>
        <Link href="/restaurant/meals" className="border rounded p-4 hover:bg-gray-50">
          Meals
        </Link>
        <Link href="/restaurant/settings" className="border rounded p-4 hover:bg-gray-50">
          Settings
        </Link>
      </div>
    </main>
  );
}


