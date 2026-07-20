import { Badge } from "@/components/ui/badge";
import type { SubscriptionFreeze } from "@/types/retention";

interface FreezesDataTableProps {
  freezes: SubscriptionFreeze[];
}

export function FreezesDataTable({ freezes }: FreezesDataTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Subscription</th>
            <th className="px-4 py-3">Dates</th>
            <th className="px-4 py-3">Days</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {freezes.map((freeze) => (
            <tr key={freeze.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{freeze.user_id}</td>
              <td className="px-4 py-3 text-slate-600">{freeze.subscription_id}</td>
              <td className="px-4 py-3 text-slate-600">
                {freeze.freeze_start_date} to {freeze.freeze_end_date}
              </td>
              <td className="px-4 py-3 text-slate-600">{freeze.freeze_days}</td>
              <td className="px-4 py-3">
                <Badge variant="outline">{freeze.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
