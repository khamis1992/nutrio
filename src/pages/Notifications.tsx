import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Truck,
  Star,
  TrendingUp,
  Crown,
  Loader2,
  Trash2,
  Check,
  CheckCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface Notification {
  id: string;
  type: "order_update" | "meal_reminder" | "subscription_alert" | "general" | "announcement";
  title: string;
  message: string;
  status: "unread" | "read" | "archived";
  read_at: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

const TYPE_CONFIG: Record<Notification["type"], { icon: React.ElementType; bg: string; gradient: string; shadow: string }> = {
  order_update: {
    icon: Truck,
    bg: "bg-[#E6FFF5]",
    gradient: "from-[#10B981] to-[#059669]",
    shadow: "shadow-[0_8px_16px_rgba(16,185,129,0.2)]"
  },
  meal_reminder: {
    icon: Utensils,
    bg: "bg-[#FFF4E6]",
    gradient: "from-[#FB923C] to-[#EA580C]",
    shadow: "shadow-[0_8px_16px_rgba(251,146,60,0.2)]"
  },
  subscription_alert: {
    icon: Crown,
    bg: "bg-[#FFF7ED]",
    gradient: "from-[#F97316] to-[#EA580C]",
    shadow: "shadow-[0_8px_16px_rgba(249,115,22,0.25)]"
  },
  general: {
    icon: TrendingUp,
    bg: "bg-[#EFF6FF]",
    gradient: "from-[#3B82F6] to-[#2563EB]",
    shadow: "shadow-[0_8px_16px_rgba(59,130,246,0.2)]"
  },
  announcement: {
    icon: Sparkles,
    bg: "bg-[#FEF3C7]",
    gradient: "from-[#F59E0B] to-[#D97706]",
    shadow: "shadow-[0_8px_16px_rgba(245,158,11,0.2)]"
  },
};

const FILTERS = [
  { key: "all", label: "All", icon: Bell },
  { key: "orders", label: "Orders", icon: Truck },
  { key: "meals", label: "Meals", icon: Utensils },
  { key: "offers", label: "Offers", icon: Sparkles },
] as const;

type FilterKey = typeof FILTERS[number]["key"];

const TYPE_TO_FILTER: Record<Notification["type"], FilterKey> = {
  order_update: "orders",
  meal_reminder: "meals",
  subscription_alert: "offers",
  general: "offers",
  announcement: "offers",
};

function getTimeGroup(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date)) return "This Week";
  if (isThisMonth(date)) return "This Month";
  return "Earlier";
}

function groupNotificationsByTime(notifications: Notification[]): [string, Notification[]][] {
  const groups = new Map<string, Notification[]>();

  notifications.forEach((n) => {
    const date = new Date(n.created_at);
    const group = getTimeGroup(date);
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(n);
  });

  return Array.from(groups.entries());
}

// Animation variants
const prefersReducedMotion = typeof window !== "undefined"
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: prefersReducedMotion ? 0 : 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -16 },
  visible: { opacity: 1, x: 0 }
};

export default function Notifications() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setNotifications((data || []) as Notification[]);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel("notifications-channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications((prev) => [payload.new as Notification, ...prev])
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, status: "read" as const, read_at: new Date().toISOString() } : n));
    } catch {
      console.error("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("status", "unread");
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" as const, read_at: new Date().toISOString() })));
      toast({ title: "Marked all as read" });
    } catch {
      toast({ title: "Error", description: "Failed to mark all as read.", variant: "destructive" });
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    } catch {
      toast({ title: "Error", description: "Failed to delete notification.", variant: "destructive" });
    }
  };

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const filtered = activeFilter === "all"
    ? notifications
    : notifications.filter((n) => TYPE_TO_FILTER[n.type] === activeFilter);

  const groupedNotifications = groupNotificationsByTime(filtered);

  return (
    <div className="min-h-screen bg-white">
      {/* Floating Header */}
      <div className="sticky top-0 z-10 bg-white pt-12 px-5 pb-2">
        <div className="mx-auto max-w-[430px]">
          <div className="flex items-center justify-between">
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <h1 className="text-[28px] font-bold tracking-[-0.02em] text-slate-950">
                {t("notifications")}
              </h1>
              {unreadCount > 0 && (
                <motion.span
                  initial={prefersReducedMotion ? undefined : { scale: 0 }}
                  animate={prefersReducedMotion ? undefined : { scale: 1 }}
                  className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#10B981] px-1.5 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                >
                  {unreadCount}
                </motion.span>
              )}
            </motion.div>
            <motion.button
              initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </motion.button>
          </div>

          {/* Filter Tabs - Segmented Control Style */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
          >
            {FILTERS.map((f) => {
              const Icon = f.icon;
              const isActive = activeFilter === f.key;
              return (
                <motion.button
                  key={f.key}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                  onClick={() => setActiveFilter(f.key)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-[#10B981] text-white shadow-[0_6px_16px_rgba(16,185,129,0.25)]"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={isActive ? "h-4 w-4" : "h-4 w-4 text-slate-400"} strokeWidth={isActive ? 2.5 : 2} />
                  {f.label}
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-32" ref={listRef}>
        <div className="mx-auto max-w-[430px]">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] opacity-20 animate-ping" />
                <Loader2 className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-[#10B981]" />
              </div>
              <p className="mt-4 text-[13px] font-medium text-slate-500">Loading notifications...</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner">
                <BellOff className="h-12 w-12 text-slate-400" strokeWidth={1.5} />
              </div>
              <h3 className="mt-6 text-[17px] font-semibold text-slate-900">All caught up!</h3>
              <p className="mt-1.5 text-[14px] text-slate-500">You have no new notifications</p>
            </motion.div>
          ) : (
            <div className="mt-4 space-y-6">
              <AnimatePresence mode="popLayout">
                {groupedNotifications.map(([group, items]) => (
                  <motion.div
                    key={group}
                    initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -20 }}
                  >
                    {/* Time Group Header */}
                    <div className="mb-3 flex items-center gap-2 px-1">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                        {group}
                      </span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    {/* Notification Cards */}
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-2"
                    >
                      {items.map((n) => {
                        const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.general;
                        const Icon = cfg.icon;
                        const isUnread = n.status === "unread";

                        return (
                          <motion.div
                            key={n.id}
                            variants={itemVariants}
                            layout
                            className="relative"
                          >
                            <div
                              className={`relative overflow-hidden rounded-2xl border transition-all ${
                                isUnread
                                  ? "border-[#B6E9D0] bg-white shadow-[0_4px_16px_rgba(16,185,129,0.08)]"
                                  : "border-slate-100 bg-white/60 shadow-sm"
                              }`}
                            >
                              {/* Unread indicator bar */}
                              {isUnread && (
                                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#10B981] to-[#059669]" />
                              )}

                              <div className="flex items-start gap-3 p-4">
                                {/* Icon */}
                                <motion.div
                                  whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cfg.gradient} ${cfg.shadow}`}
                                >
                                  <Icon className="h-5 w-5 text-white" strokeWidth={2} />
                                </motion.div>

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-[14px] font-semibold leading-snug text-slate-900 ${isUnread ? "font-bold" : ""}`}>
                                        {n.title}
                                      </p>
                                      <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                                        {n.message}
                                      </p>
                                    </div>
                                    {isUnread && (
                                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                    )}
                                  </div>
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[11px] font-medium text-slate-400">
                                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1 border-t border-slate-100 bg-slate-50/50 px-4 py-2">
                                {isUnread && (
                                  <motion.button
                                    whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                                    onClick={() => markAsRead(n.id)}
                                    className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                  >
                                    <Check className="h-3 w-3" strokeWidth={2.5} />
                                    Mark as read
                                  </motion.button>
                                )}
                                <motion.button
                                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                                  onClick={() => deleteNotification(n.id)}
                                  className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" strokeWidth={2.5} />
                                  Delete
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}