import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, TrendingDown, TrendingUp, Minus, Flame, Target,
  CalendarCheck, ArrowRight, Loader2, AlertCircle, UserPlus,
  Check, X, Bell, ChevronRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachClients, type ClientCompliance } from "@/hooks/useCoachClients";
import { useCoachNotifications } from "@/hooks/useCoachNotifications";
import { InviteClientModal } from "@/components/coach/InviteClientModal";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 26 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

function formatRelativeTime(ts: string): string {
  if (!ts) return "";
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "yesterday";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ClientCard({ client, onClick }: { client: ClientCompliance; onClick: () => void }) {
  const weightIcon =
    client.weightTrend === null
      ? null
      : client.weightTrend < 0
      ? { Icon: TrendingDown, color: "text-emerald-500" }
      : client.weightTrend > 0
      ? { Icon: TrendingUp, color: "text-red-500" }
      : { Icon: Minus, color: "text-slate-400" };

  const adherenceColor =
    client.adherencePct >= 80 ? "text-emerald-600" : client.adherencePct >= 50 ? "text-amber-600" : "text-red-500";
  const macroColor =
    client.macroHitRate >= 80 ? "text-emerald-600" : client.macroHitRate >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <motion.button
      variants={fadeInUp}
      onClick={onClick}
      className="w-full text-left bg-white rounded-[24px] shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] active:scale-[0.985] transition-all overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
          {client.avatar_url ? (
            <img src={client.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-base font-bold text-emerald-700">
              {(client.full_name || "U")[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 truncate">
            {client.full_name || "Unnamed Client"}
          </h3>
          <p className="text-[11px] font-medium text-slate-500">
            {client.goal_type ? client.goal_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "General Health"}
            {client.daysTrackedThisWeek > 0 && ` · ${client.daysTrackedThisWeek}d tracked`}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-50">
        <div className="px-3 py-3.5 text-center">
          <CalendarCheck className="w-4 h-4 text-slate-400 mx-auto mb-1" />
          <p className={cn("text-lg font-extrabold", adherenceColor)}>{client.adherencePct}%</p>
          <p className="text-[10px] font-medium text-slate-400">Adherence</p>
        </div>
        <div className="px-3 py-3.5 text-center">
          <Target className="w-4 h-4 text-slate-400 mx-auto mb-1" />
          <p className={cn("text-lg font-extrabold", macroColor)}>{client.macroHitRate}%</p>
          <p className="text-[10px] font-medium text-slate-400">Nutrition</p>
        </div>
        <div className="px-3 py-3.5 text-center">
          {weightIcon ? (
            <weightIcon.Icon className={cn("w-4 h-4 mx-auto mb-1", weightIcon.color)} />
          ) : (
            <Minus className="w-4 h-4 text-slate-300 mx-auto mb-1" />
          )}
          <p className="text-lg font-extrabold text-slate-900">
            {client.weightTrend !== null ? `${client.weightTrend > 0 ? "+" : ""}${client.weightTrend.toFixed(1)}` : "-"}
          </p>
          <p className="text-[10px] font-medium text-slate-400">7d Δ kg</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50/50">
        <Flame className="w-4 h-4 text-amber-500" />
        <span className="text-[12px] font-bold text-slate-700">{client.streakDays}-day streak</span>
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-[#7C83F6] ring-1 ring-slate-200">
          P {client.proteinHitDays}/7
        </span>
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-[#38BDF8] ring-1 ring-slate-200">
          W {client.hydrationHitDays}/7
        </span>
        {client.weightLastKg !== null && (
          <span className="text-[11px] text-slate-400 ml-auto">{client.weightLastKg.toFixed(1)} kg</span>
        )}
      </div>
      <div className="border-t border-slate-100 bg-white px-5 py-2.5">
        <p className="text-[11px] font-bold text-slate-500">{client.coachSummary}</p>
      </div>
    </motion.button>
  );
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clients, pending, loading, refresh, handleAccept, handleReject } = useCoachClients(user?.id);
  const { milestones, unreadCount, markAsRead } = useCoachNotifications(user?.id);
  const coachId = user?.id;
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
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
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[180px] animate-pulse rounded-[24px] bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Your Clients</h1>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
            {clients.length} client{clients.length !== 1 ? "s" : ""} · {activeClients.length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setMilestonesOpen(!milestonesOpen)}
              className="relative w-[38px] h-[38px] rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {/* Milestone Dropdown */}
            {milestonesOpen && (
              <div className="absolute right-0 top-[44px] w-80 bg-white rounded-[20px] shadow-[0_20px_60px_rgba(15,23,42,0.15)] ring-1 ring-slate-200/80 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="text-[13px] font-extrabold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-semibold text-emerald-600">{unreadCount} new</span>
                  )}
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {milestones.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <p className="text-[12px] text-slate-400">No milestones yet</p>
                    </div>
                  ) : (
                    milestones.slice(0, 20).map((m) => {
                      const icon = m.type === "coach_milestone" ? (() => {
                        const mType = m.data?.milestone_type;
                        if (mType === "streak") return <Flame className="w-4 h-4 text-amber-500 shrink-0" />;
                        if (mType === "weight") return <TrendingDown className="w-4 h-4 text-emerald-500 shrink-0" />;
                        if (mType === "adherence") return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
                        if (mType === "missed_meals") return <Target className="w-4 h-4 text-orange-500 shrink-0" />;
                        return <Bell className="w-4 h-4 text-blue-500 shrink-0" />;
                      })() : <Bell className="w-4 h-4 text-blue-500 shrink-0" />;
                      return (
                        <button
                          key={m.id}
                          onClick={() => markAsRead(m.id)}
                          className={cn(
                            "w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors",
                            m.status === "unread" ? "bg-blue-50/30" : ""
                          )}
                        >
                          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5", m.status === "unread" ? "bg-blue-100" : "bg-slate-100")}>
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-800 leading-tight">{m.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{m.message}</p>
                            <p className="text-[9px] text-slate-400 mt-1">
                              {formatRelativeTime(m.created_at)}
                            </p>
                          </div>
                          {m.status === "unread" && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-1.5 h-[38px] px-4 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[13px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        </div>
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-500" />
            <h2 className="text-[13px] font-extrabold text-slate-700">Pending Requests ({pending.length})</h2>
          </div>
          <div className="space-y-2">
            {pending.map((req) => (
              <div
                key={req.assignmentId}
                className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0">
                  {req.avatarUrl ? (
                    <img src={req.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-amber-700">
                      {(req.fullName || "?")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{req.fullName}</p>
                  <p className="text-[10px] text-amber-600 font-medium">Wants to connect</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onAccept(req.assignmentId)}
                    disabled={acceptingId === req.assignmentId || rejectingId === req.assignmentId}
                    className="flex items-center gap-1 h-[34px] px-3 rounded-full bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {acceptingId === req.assignmentId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Accept
                  </button>
                  <button
                    onClick={() => onReject(req.assignmentId)}
                    disabled={acceptingId === req.assignmentId || rejectingId === req.assignmentId}
                    className="flex items-center gap-1 h-[34px] px-3 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {rejectingId === req.assignmentId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* At-risk alert */}
      {atRiskClients.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-3 p-4 rounded-[20px] bg-red-50 border border-red-200 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-[13px] font-semibold text-red-800">
            {atRiskClients.length} client{atRiskClients.length > 1 ? "s" : ""} at risk of falling off
          </p>
        </motion.div>
      )}

      {/* Client list */}
      {clients.length === 0 ? (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-12 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2">No clients yet</h3>
          <p className="text-[12px] text-slate-500 max-w-[260px] mx-auto mb-6">
            Send an invite code to your first client. They'll accept it in their profile settings.
          </p>
          <button
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center gap-2 h-[42px] px-5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[13px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Invite First Client
          </button>
        </motion.div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => navigate(`/coach/client/${client.id}`)}
            />
          ))}
        </motion.div>
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
