import { format } from "date-fns";

import type { RetentionAuditLog } from "@/types/retention";

interface AuditLogsTableProps {
  logs: RetentionAuditLog[];
}

export function AuditLogsTable({ logs }: AuditLogsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Triggered By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3 text-slate-600">
                {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
              </td>
              <td className="px-4 py-3 font-medium text-slate-900">{log.action_type}</td>
              <td className="px-4 py-3 text-slate-600">{log.user_id}</td>
              <td className="px-4 py-3 text-slate-600">{log.triggered_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
