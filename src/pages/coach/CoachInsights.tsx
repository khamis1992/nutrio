import { motion, type Variants } from "framer-motion";
import { Users, Target, Flame, TrendingDown, BarChart3 } from "lucide-react";
import { useCoachClients } from "@/hooks/useCoachClients";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const statCard: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.04 } },
};

export default function CoachInsights() {
  const { user } = useAuth();
  const { clients, pending, loading } = useCoachClients(user?.id);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[100px] animate-pulse rounded-[20px] bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.daysTrackedThisWeek > 0);
  const atRiskClients = clients.filter((c) => c.adherencePct < 50 && c.daysTrackedThisWeek >= 3);
  const avgAdherence = totalClients > 0
    ? Math.round(clients.reduce((sum, c) => sum + c.adherencePct, 0) / totalClients)
    : 0;
  const avgMacroHit = totalClients > 0
    ? Math.round(clients.reduce((sum, c) => sum + c.macroHitRate, 0) / totalClients)
    : 0;
  const clientsLosing = clients.filter((c) => c.weightTrend !== null && c.weightTrend < 0).length;
  const clientsGaining = clients.filter((c) => c.weightTrend !== null && c.weightTrend > 0).length;
  const avgStreak = totalClients > 0
    ? Math.round(clients.reduce((sum, c) => sum + c.streakDays, 0) / totalClients)
    : 0;
  const highAdherence = clients.filter((c) => c.adherencePct >= 80).length;
  const stableClients = totalClients - clientsLosing - clientsGaining;

  const stats = [
    {
      label: "Active Clients",
      value: activeClients.length.toString(),
      sub: `/ ${totalClients} total`,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      label: "Avg Adherence",
      value: `${avgAdherence}%`,
      icon: Target,
      color: avgAdherence >= 70 ? "text-emerald-600" : avgAdherence >= 50 ? "text-amber-600" : "text-red-500",
      bg: avgAdherence >= 70 ? "bg-emerald-50" : avgAdherence >= 50 ? "bg-amber-50" : "bg-red-50",
      trend: highAdherence > 0 ? `${highAdherence} above 80%` : null,
    },
    {
      label: "Avg Streak",
      value: `${avgStreak}d`,
      icon: Flame,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "At Risk",
      value: atRiskClients.length.toString(),
      icon: TrendingDown,
      color: atRiskClients.length > 0 ? "text-red-500" : "text-slate-400",
      bg: atRiskClients.length > 0 ? "bg-red-50" : "bg-slate-50",
    },
    {
      label: "Macro Hit Rate",
      value: `${avgMacroHit}%`,
      icon: Target,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Pending",
      value: pending.length.toString(),
      icon: Users,
      color: pending.length > 0 ? "text-amber-600" : "text-slate-400",
      bg: pending.length > 0 ? "bg-amber-50" : "bg-slate-50",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Insights</h1>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">Coaching impact across all clients</p>
      </div>

      {/* Stats grid — 2 columns on mobile */}
      {totalClients === 0 ? (
        <motion.div
          variants={statCard}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-12 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-[15px] font-bold text-slate-900 mb-1">No data yet</h3>
          <p className="text-[12px] text-slate-500 max-w-[260px] mx-auto">
            Invite clients to start tracking their progress and see insights here.
          </p>
        </motion.div>
      ) : (
        <>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-3"
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={statCard}
                className="bg-white rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-slate-100/80"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <p className="text-xl font-extrabold text-slate-950">{stat.value}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{stat.label}</p>
                {stat.sub && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</p>
                )}
                {stat.trend && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1">{stat.trend}</p>
                )}
              </motion.div>
            ))}
          </motion.div>

          {/* Weight Trends */}
          <motion.div
            variants={statCard}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 mb-4">Weight Trends (7-day)</h2>
            <div className="flex h-3 rounded-full overflow-hidden">
              {clientsLosing > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((clientsLosing / totalClients) * 100)}%` }}
                />
              )}
              {stableClients > 0 && (
                <div
                  className="bg-slate-300 transition-all"
                  style={{ width: `${Math.round((stableClients / totalClients) * 100)}%` }}
                />
              )}
              {clientsGaining > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${Math.round((clientsGaining / totalClients) * 100)}%` }}
                />
              )}
            </div>
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-semibold text-slate-600">Losing: {clientsLosing}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="text-[11px] font-semibold text-slate-600">Stable: {stableClients}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-[11px] font-semibold text-slate-600">Gaining: {clientsGaining}</span>
              </div>
            </div>
          </motion.div>

          {/* Adherence Distribution */}
          <motion.div
            variants={statCard}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 mb-4">Adherence Distribution</h2>
            <div className="space-y-2">
              {[
                { label: "High (≥80%)", count: clients.filter(c => c.adherencePct >= 80).length, color: "bg-emerald-500" },
                { label: "Medium (50-79%)", count: clients.filter(c => c.adherencePct >= 50 && c.adherencePct < 80).length, color: "bg-amber-500" },
                { label: "Low (<50%)", count: clients.filter(c => c.adherencePct < 50).length, color: "bg-red-500" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", row.color)} />
                  <span className="text-[12px] font-semibold text-slate-600 flex-1">{row.label}</span>
                  <span className="text-[12px] font-extrabold text-slate-900">{row.count}</span>
                  <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", row.color)}
                      style={{ width: `${totalClients > 0 ? Math.round((row.count / totalClients) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
