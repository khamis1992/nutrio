import { motion } from "framer-motion";
import {
  Users,
  TrendingDown,
  TrendingUp,
  Minus,
  Flame,
  Target,
  CalendarCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachClients, type ClientCompliance } from "@/hooks/useCoachClients";
import { cn } from "@/lib/utils";

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 26 } },
};

function ComplianceCard({
  client,
  index,
}: {
  client: ClientCompliance;
  index: number;
}) {
  const weightIcon =
    client.weightTrend === null
      ? null
      : client.weightTrend < 0
      ? { Icon: TrendingDown, color: "text-emerald-500", bg: "bg-emerald-50" }
      : client.weightTrend > 0
      ? { Icon: TrendingUp, color: "text-red-500", bg: "bg-red-50" }
      : { Icon: Minus, color: "text-slate-400", bg: "bg-slate-50" };

  const adherenceColor =
    client.adherencePct >= 80
      ? "text-emerald-600"
      : client.adherencePct >= 50
      ? "text-amber-600"
      : "text-red-500";

  const macroColor =
    client.macroHitRate >= 80
      ? "text-emerald-600"
      : client.macroHitRate >= 50
      ? "text-amber-600"
      : "text-red-500";

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.06 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Client header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0 overflow-hidden">
          {client.avatar_url ? (
            <img src={client.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-emerald-700">
              {(client.full_name || "U")[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">
            {client.full_name || "Unnamed Client"}
          </h3>
          <p className="text-[11px] text-gray-400">
            {client.goal_type || "General Health"}
            {client.daysTrackedThisWeek > 0 &&
              ` · ${client.daysTrackedThisWeek}d tracked`}
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300" />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 divide-x divide-gray-50">
        {/* Adherence */}
        <div className="px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CalendarCheck className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <p className={`text-lg font-extrabold ${adherenceColor}`}>
            {client.adherencePct}%
          </p>
          <p className="text-[10px] text-gray-400 font-medium">Adherence</p>
        </div>

        {/* Macros */}
        <div className="px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <p className={`text-lg font-extrabold ${macroColor}`}>
            {client.macroHitRate}%
          </p>
          <p className="text-[10px] text-gray-400 font-medium">Macro Hit</p>
        </div>

        {/* Weight */}
        <div className="px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            {weightIcon ? (
              <weightIcon.Icon className={cn("w-3.5 h-3.5", weightIcon.color)} />
            ) : (
              <Minus className="w-3.5 h-3.5 text-gray-300" />
            )}
          </div>
          <p className="text-lg font-extrabold text-gray-900">
            {client.weightTrend !== null
              ? `${client.weightTrend > 0 ? "+" : ""}${client.weightTrend.toFixed(1)}`
              : "-"}
          </p>
          <p className="text-[10px] text-gray-400 font-medium">7d Δ kg</p>
        </div>
      </div>

      {/* Streak bar */}
      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50 flex items-center gap-2 rounded-b-2xl">
        <Flame className="w-4 h-4 text-amber-500" />
        <span className="text-[12px] font-bold text-gray-700">
          {client.streakDays}-day streak
        </span>
        {client.weightLastKg !== null && (
          <span className="text-[11px] text-gray-400 ml-auto">
            {client.weightLastKg.toFixed(1)} kg
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const { clients, loading, refresh } = useCoachClients(user?.id);
  const coachId = user?.id;

  const generateInviteCode = async () => {
    if (!coachId) return;
    const code = `NUTR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const { data, error } = await supabase.auth.getUser();
    if (error) return;

    const clientName = prompt("Enter client's name or email to identify them:");
    if (!clientName) return;

    try {
      await supabase.from("coach_client_assignments").insert({
        coach_id: coachId,
        invite_code: code,
        status: "pending",
      });
      alert(`Invite code: ${code}\nShare this with ${clientName}.`);
      refresh();
    } catch (err) {
      console.error("Error creating invite:", err);
    }
  };

  const activeClients = clients.filter((c) => c.daysTrackedThisWeek > 0);
  const atRiskClients = clients.filter((c) => c.adherencePct < 50 && c.daysTrackedThisWeek >= 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Your Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            {clients.length} client{clients.length !== 1 ? "s" : ""}{" "}
            · {activeClients.length} active this week
          </p>
        </div>
        <button
          onClick={generateInviteCode}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Invite Client
        </button>
      </div>

      {/* At-risk alert */}
      {atRiskClients.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-5 shadow-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            {atRiskClients.length} client{atRiskClients.length > 1 ? "s" : ""} at risk of falling off
          </p>
        </div>
      )}

      {/* Client grid */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No clients yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            Send an invite code to your first client. They'll accept it in their
            profile settings and you'll start seeing their compliance data here.
          </p>
          <button
            onClick={generateInviteCode}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Invite First Client
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client, i) => (
            <ComplianceCard key={client.id} client={client} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
