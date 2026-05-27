import { useState } from "react";
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
  Check,
  X,
  Bell,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachClients, type ClientCompliance } from "@/hooks/useCoachClients";
import { InviteClientModal } from "@/components/coach/InviteClientModal";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const { clients, pending, loading, refresh, handleAccept, handleReject } = useCoachClients(user?.id);
  const coachId = user?.id;
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const onAccept = async (assignmentId: string) => {
    setAcceptingId(assignmentId);
    try {
      await handleAccept(assignmentId);
      toast({ title: "Request accepted", description: "Client is now connected." });
    } catch {
      toast({ title: "Failed", description: "Could not accept request. Try again.", variant: "destructive" });
    } finally {
      setAcceptingId(null);
    }
  };

  const onReject = async (assignmentId: string) => {
    setRejectingId(assignmentId);
    try {
      await handleReject(assignmentId);
      toast({ title: "Request declined", description: "The request has been removed." });
    } catch {
      toast({ title: "Failed", description: "Could not reject request. Try again.", variant: "destructive" });
    } finally {
      setRejectingId(null);
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
          onClick={() => setInviteModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Invite Client
        </button>
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-extrabold text-gray-700">
              Pending Requests ({pending.length})
            </h2>
          </div>
          <div className="space-y-2">
            {pending.map((req) => (
              <div
                key={req.assignmentId}
                className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {req.avatarUrl ? (
                    <img src={req.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-amber-700">
                      {(req.fullName || "?")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{req.fullName}</p>
                  <p className="text-[11px] text-amber-600">Wants to connect with you</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAccept(req.assignmentId)}
                    disabled={acceptingId === req.assignmentId || rejectingId === req.assignmentId}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {acceptingId === req.assignmentId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Accept
                  </button>
                  <button
                    onClick={() => onReject(req.assignmentId)}
                    disabled={acceptingId === req.assignmentId || rejectingId === req.assignmentId}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {rejectingId === req.assignmentId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            Send an invite code to your first client. They&#39;ll accept it in their
            profile settings and you&#39;ll start seeing their compliance data here.
          </p>
          <button
            onClick={() => setInviteModalOpen(true)}
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

      {/* Invite Modal */}
      <InviteClientModal
        coachId={coachId || ""}
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInviteCreated={refresh}
      />
    </div>
  );
}
