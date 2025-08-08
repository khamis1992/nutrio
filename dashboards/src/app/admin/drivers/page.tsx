export const dynamic = "force-dynamic";

type Driver = { user_id: string; status: string; phone: string | null; vehicle_type: string | null };

async function fetchDrivers(): Promise<Driver[]> {
  const res = await fetch(`/api/admin/drivers`, { cache: "no-store" });
  const json = await res.json();
  return (json.drivers ?? []) as Driver[];
}

export default async function AdminDriversPage() {
  const drivers = await fetchDrivers();
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Drivers</h1>
      <form action="/api/admin/drivers" method="post" className="flex gap-2">
        <input name="user_id" placeholder="User ID (UUID)" className="border px-2 py-1 rounded w-96" />
        <input name="phone" placeholder="Phone" className="border px-2 py-1 rounded" />
        <input name="vehicle_type" placeholder="Vehicle" className="border px-2 py-1 rounded" />
        <button className="px-3 py-1 border rounded">Add Driver</button>
      </form>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">User</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Phone</th>
            <th className="p-2 border">Vehicle</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.user_id}>
              <td className="p-2 border">{d.user_id.slice(0,8)}</td>
              <td className="p-2 border">{d.status}</td>
              <td className="p-2 border">{d.phone ?? '-'}</td>
              <td className="p-2 border">{d.vehicle_type ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
