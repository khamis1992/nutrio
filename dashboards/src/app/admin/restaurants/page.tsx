import Link from "next/link";
export const dynamic = "force-dynamic";

type Restaurant = {
  id: string;
  name: string;
  active: boolean;
  rating: number | null;
};

async function fetchRestaurants(): Promise<Restaurant[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/admin/restaurants`, {
    cache: "no-store",
  });
  const json = await res.json();
  return (json.restaurants ?? []) as Restaurant[];
}

export default async function AdminRestaurantsPage() {
  const restaurants = await fetchRestaurants();
  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Restaurants</h1>
        <Link href="/admin/restaurants/new" className="px-3 py-2 border rounded">New Restaurant</Link>
      </div>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Active</th>
            <th className="p-2 border">Rating</th>
          </tr>
        </thead>
        <tbody>
          {restaurants.map((r) => (
            <tr key={r.id} className="border">
              <td className="p-2 border">{r.name}</td>
              <td className="p-2 border">{r.active ? "Yes" : "No"}</td>
              <td className="p-2 border">{r.rating ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
