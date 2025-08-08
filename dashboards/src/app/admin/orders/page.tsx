export const dynamic = "force-dynamic";

type Order = { id: string; status: string; total_amount: number | null; created_at: string };

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/admin/orders`, { cache: "no-store" });
  const json = await res.json();
  return (json.orders ?? []) as Order[];
}

export default async function AdminOrdersPage() {
  const orders = await fetchOrders();
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Total</th>
            <th className="p-2 border">Created</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="p-2 border">{o.id.slice(0, 8)}</td>
              <td className="p-2 border">{o.status}</td>
              <td className="p-2 border">{o.total_amount ?? 0}</td>
              <td className="p-2 border">{new Date(o.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}


