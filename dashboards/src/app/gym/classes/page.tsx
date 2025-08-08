export const dynamic = "force-dynamic";

type GymClass = { id: string; title: string; start_at: string; end_at: string; capacity: number };

async function fetchClasses(gymId: string): Promise<GymClass[]> {
  const res = await fetch(`/api/gym/${gymId}/classes`, { cache: "no-store" });
  const json = await res.json();
  return (json.classes ?? []) as GymClass[];
}

export default async function GymClassesPage() {
  const defaultGymId = "00000000-0000-0000-0000-000000000000"; // replace when wiring owner panel
  const classes = await fetchClasses(defaultGymId);
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Classes</h1>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">Title</th>
            <th className="p-2 border">Start</th>
            <th className="p-2 border">End</th>
            <th className="p-2 border">Capacity</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id}>
              <td className="p-2 border">{c.title}</td>
              <td className="p-2 border">{new Date(c.start_at).toLocaleString()}</td>
              <td className="p-2 border">{new Date(c.end_at).toLocaleString()}</td>
              <td className="p-2 border">{c.capacity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}


