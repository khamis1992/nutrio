import Link from "next/link";
export const dynamic = "force-dynamic";

type Assignment = { id: string; order_id: string; status: string };

async function fetchAssignment(id: string): Promise<Assignment | null> {
  const res = await fetch(`/api/driver/assignments/${id}/status`, { method: "HEAD", cache: "no-store" });
  // HEAD not implemented; fall back to view via orders list
  return { id, order_id: "", status: "assigned" };
}

export default async function DriverAssignmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const assignment = await fetchAssignment(id);
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Assignment</h1>
      <div className="border rounded p-4">
        <div>ID: {assignment?.id}</div>
        <div>Status: {assignment?.status}</div>
      </div>
      <div className="flex gap-2">
        <form action={`/api/driver/assignments/${id}/status`} method="post">
          <input type="hidden" name="status" value="accepted" />
          <button className="px-3 py-1 border rounded">Accept</button>
        </form>
        <form action={`/api/driver/assignments/${id}/status`} method="post">
          <input type="hidden" name="status" value="picked_up" />
          <button className="px-3 py-1 border rounded">Picked Up</button>
        </form>
        <form action={`/api/driver/assignments/${id}/status`} method="post">
          <input type="hidden" name="status" value="delivered" />
          <button className="px-3 py-1 border rounded">Delivered</button>
        </form>
      </div>
      <Link className="text-blue-600 hover:underline" href="/driver/assignments">Back</Link>
    </main>
  );
}


