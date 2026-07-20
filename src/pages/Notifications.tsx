import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  Truck,
  TrendingUp,
  Crown,
  Loader2,
  Trash2,
  Check,
  CheckCheck,
  Sparkles,
  Utensils,
  MessageCircle,
  Send,
  User,
  ArrowLeft,
  CalendarClock,
  ShieldAlert,
  Trophy,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientCoachMessages } from "@/hooks/useClientCoachMessages";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MealConsumptionSheet } from "@/components/MealConsumptionSheet";
import { buildSafeDeepLink } from "@/hooks/usePushNotificationDeepLink";
import type { Database } from "@/integrations/supabase/types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  status: "unread" | "read" | "archived";
  read_at: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; bg: string; gradient: string; shadow: string }> = {
  order_update: {
    icon: Truck,
    bg: "bg-[#E6FFF5]",
    gradient: "from-[#10B981] to-[#059669]",
    shadow: "shadow-[0_8px_16px_rgba(16,185,129,0.2)]"
  },
  order_delivered: {
    icon: Utensils,
    bg: "bg-[#E8FBF6]",
    gradient: "from-[#22C7A1] to-[#0D9F7F]",
    shadow: "shadow-[0_8px_16px_rgba(34,199,161,0.2)]"
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
  coach_message: {
    icon: MessageCircle,
    bg: "bg-[#F3E8FF]",
    gradient: "from-[#8B5CF6] to-[#7C3AED]",
    shadow: "shadow-[0_8px_16px_rgba(139,92,246,0.2)]"
  },
  health_insight: {
    icon: TrendingUp,
    bg: "bg-[#F3F4FF]",
    gradient: "from-[#7C83F6] to-[#6366F1]",
    shadow: "shadow-[0_8px_16px_rgba(124,131,246,0.2)]"
  },
  plan_update: {
    icon: TrendingUp,
    bg: "bg-[#ECFDF5]",
    gradient: "from-[#14B8A6] to-[#0F766E]",
    shadow: "shadow-[0_8px_16px_rgba(20,184,166,0.2)]"
  },
  system_alert: {
    icon: ShieldAlert,
    bg: "bg-[#FEF2F2]",
    gradient: "from-[#EF4444] to-[#B91C1C]",
    shadow: "shadow-[0_8px_16px_rgba(239,68,68,0.2)]"
  },
  delivery_update: {
    icon: Truck,
    bg: "bg-[#EFF6FF]",
    gradient: "from-[#3B82F6] to-[#1D4ED8]",
    shadow: "shadow-[0_8px_16px_rgba(59,130,246,0.2)]"
  },
  achievement: {
    icon: Trophy,
    bg: "bg-[#FFFBEB]",
    gradient: "from-[#F59E0B] to-[#B45309]",
    shadow: "shadow-[0_8px_16px_rgba(245,158,11,0.2)]"
  },
  subscription: {
    icon: Crown,
    bg: "bg-[#FFF7ED]",
    gradient: "from-[#F97316] to-[#C2410C]",
    shadow: "shadow-[0_8px_16px_rgba(249,115,22,0.2)]"
  },
  meal_scheduled: {
    icon: CalendarClock,
    bg: "bg-[#F0FDFA]",
    gradient: "from-[#2DD4BF] to-[#0F766E]",
    shadow: "shadow-[0_8px_16px_rgba(45,212,191,0.2)]"
  },
  coach_withdrawal: {
    icon: Crown,
    bg: "bg-[#FFF7ED]",
    gradient: "from-[#FB923C] to-[#C2410C]",
    shadow: "shadow-[0_8px_16px_rgba(251,146,60,0.2)]"
  },
  coach_onboarding: {
    icon: UserCheck,
    bg: "bg-[#F0FDF4]",
    gradient: "from-[#22C55E] to-[#15803D]",
    shadow: "shadow-[0_8px_16px_rgba(34,197,94,0.2)]"
  },
  coach_session_scheduled: {
    icon: CalendarClock,
    bg: "bg-[#EFF6FF]",
    gradient: "from-[#60A5FA] to-[#2563EB]",
    shadow: "shadow-[0_8px_16px_rgba(96,165,250,0.2)]"
  },
  coach_milestone: {
    icon: Trophy,
    bg: "bg-[#FFFBEB]",
    gradient: "from-[#FBBF24] to-[#D97706]",
    shadow: "shadow-[0_8px_16px_rgba(251,191,36,0.2)]"
  },
  coach_goal_accepted: {
    icon: CheckCheck,
    bg: "bg-[#ECFDF5]",
    gradient: "from-[#34D399] to-[#059669]",
    shadow: "shadow-[0_8px_16px_rgba(52,211,153,0.2)]"
  },
};

const filterLabelKeys: Record<string, string> = {
  all: "all",
  orders: "orders",
  meals: "meals",
  messages: "filter_messages",
  offers: "filter_offers",
};

const FILTERS = [
  { key: "all", icon: Bell },
  { key: "orders", icon: Truck },
  { key: "meals", icon: Utensils },
  { key: "messages", icon: MessageCircle },
  { key: "offers", icon: Sparkles },
] as const;

type FilterKey = typeof FILTERS[number]["key"];

const TYPE_TO_FILTER: Record<NotificationType, FilterKey> = {
  order_update: "orders",
  order_delivered: "meals",
  meal_reminder: "meals",
  subscription_alert: "offers",
  general: "offers",
  coach_message: "messages",
  health_insight: "offers",
  plan_update: "offers",
  system_alert: "offers",
  delivery_update: "orders",
  achievement: "offers",
  subscription: "offers",
  meal_scheduled: "meals",
  coach_withdrawal: "messages",
  coach_onboarding: "messages",
  coach_session_scheduled: "messages",
  coach_milestone: "messages",
  coach_goal_accepted: "messages",
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

// ─── Inline coach chat component ───
function CoachReplySheet({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { messages, coachInfo, loading, sending, sendMessage, markAsRead } = useClientCoachMessages(clientId);
  const [messageInput, setMessageInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (coachInfo) {
      markAsRead();
    }
  }, [coachInfo, messages.length, markAsRead]);

  const handleSend = async () => {
    if (!messageInput.trim()) return;
    await sendMessage(messageInput.trim());
    setMessageInput("");
    inputRef.current?.focus();
  };

  const formatTime = (ts: string) => {
    if (!ts) return "";
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100 shrink-0">
        <button
          data-testid="notifications-back-btn"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"
        >
          <ArrowLeft className="w-4 h-4 text-slate-700" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0">
            {coachInfo?.coachAvatar ? (
              <img src={coachInfo.coachAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-violet-600" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold text-slate-900 truncate">
              {coachInfo?.coachName || "Your Coach"}
            </h2>
            <p className="text-[10px] text-slate-500">{t("coach")}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
      >
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-2xl border p-4 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-[13px] text-slate-400">{t("notifications_no_messages")}</p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => {
              const isClient = msg.sender_role === "client";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", isClient ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl",
                      isClient
                        ? "bg-violet-600 text-white rounded-br-sm"
                        : "bg-white text-slate-700 rounded-bl-sm shadow-sm border border-slate-100"
                    )}
                  >
                    <p>{msg.message}</p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      isClient ? "text-violet-200" : "text-slate-400"
                    )}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {sending && (
          <div className="flex justify-end">
            <div className="bg-violet-600/50 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 flex items-center gap-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2 bg-slate-50 rounded-[20px] border border-slate-200 px-3 py-2">
          <input
            data-testid="notifications-message-input"
            ref={inputRef}
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Reply to your coach..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            autoFocus
          />
          <button
            data-testid="notifications-send-btn"
            onClick={handleSend}
            disabled={!messageInput.trim() || sending}
            className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Notifications() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  useEffect(() => { document.title = `${t("Notifications")} — Nutrio`; }, [t]);
  const { user } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const listRef = useRef<HTMLDivElement>(null);
  const [replyNotification, setReplyNotification] = useState<Notification | null>(null);
  const [consumptionNotification, setConsumptionNotification] = useState<Notification | null>(null);

  const clientId = user?.id;

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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => {
            const filtered = prev.filter((n) => n.id !== updated.id);
            return [updated, ...filtered];
          });
        }
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

  const openSmartGoalAdjustment = async (notification: Notification) => {
    if (notification.status === "unread") {
      await markAsRead(notification.id);
    }
    const route = typeof notification.data?.route === "string" ? notification.data.route : "/edit-goal";
    navigate(route);
  };

  const openNotificationDeepLink = async (notification: Notification, route: string) => {
    if (notification.status === "unread") {
      await markAsRead(notification.id);
    }
    navigate(route);
  };

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const filtered = activeFilter === "all"
    ? notifications
    : notifications.filter((n) => TYPE_TO_FILTER[n.type] === activeFilter);

  const groupedNotifications = groupNotificationsByTime(filtered);

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#020617]">
      {replyNotification && clientId && (
        <CoachReplySheet
          clientId={clientId}
          onClose={() => setReplyNotification(null)}
        />
      )}

      {consumptionNotification && (
        <MealConsumptionSheet
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setConsumptionNotification(null);
          }}
          sourceType={
            consumptionNotification.data.source_type === "meal_schedule"
              ? "meal_schedule"
              : "order"
          }
          sourceId={String(
            consumptionNotification.data.source_id
              || consumptionNotification.data.order_id
              || "",
          )}
          sourceMealId={String(consumptionNotification.data.meal_id || "")}
          meal={{
            meal_id: String(consumptionNotification.data.meal_id || ""),
            meal_name: String(consumptionNotification.data.meal_name || "Meal"),
            calories: Number(consumptionNotification.data.calories || 0),
            protein_g: Number(consumptionNotification.data.protein_g || 0),
            carbs_g: Number(consumptionNotification.data.carbs_g || 0),
            fat_g: Number(consumptionNotification.data.fat_g || 0),
            fiber_g: Number(consumptionNotification.data.fiber_g || 0),
          }}
          onSaved={() => {
            setNotifications((current) => current.map((item) => item.id === consumptionNotification.id
              ? { ...item, status: "read", read_at: new Date().toISOString() }
              : item));
            setConsumptionNotification(null);
          }}
        />
      )}

      <div className="sticky top-0 z-10 border-b border-[#E5EAF1] bg-white/95 px-4 pb-2 pt-safe backdrop-blur-xl">
        <div className="mx-auto max-w-[430px]">
          <div className="flex min-h-14 items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={t("back")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E5EAF1] bg-white text-[#020617] shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <h1 className="truncate text-[20px] font-extrabold text-[#020617]">
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
              aria-label="Mark all notifications as read"
              title="Mark all as read"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E5EAF1] bg-white text-[#22C7A1] shadow-sm transition active:scale-95 disabled:opacity-40"
            >
              <CheckCheck className="h-5 w-5" />
            </motion.button>
          </div>

          {/* Filter Tabs */}
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
                  {t(filterLabelKeys[f.key])}
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-4" ref={listRef}>
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
              <h3 className="mt-6 text-[17px] font-semibold text-slate-900">{t("dashboard_all_caught_up")}</h3>
              <p className="mt-1.5 text-[14px] text-slate-500">{t("notifications_no_new")}</p>
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
                    <div className="mb-3 flex items-center gap-2 px-1">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                        {group}
                      </span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

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
                        const isCoachMessage = n.type === "coach_message";
                        const isSmartGoalAdjustment = n.type === "health_insight" && n.data?.subtype === "smart_goal_adjustment";
                        const isConsumptionConfirmation = n.type === "order_delivered"
                          && (n.data?.action === "confirm_consumption" || n.data?.action === "add_to_progress")
                          && Boolean(n.data?.order_id)
                          && Boolean(n.data?.meal_id);
                        const safeDeepLink = buildSafeDeepLink(n.data);

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
                              {isUnread && (
                                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#10B981] to-[#059669]" />
                              )}

                              <div className="flex items-start gap-3 p-4">
                                <motion.div
                                  whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cfg.gradient} ${cfg.shadow}`}
                                >
                                  <Icon className="h-5 w-5 text-white" strokeWidth={2} />
                                </motion.div>

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
                                {isCoachMessage && clientId && (
                                  <motion.button
                                    whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                                    onClick={() => {
                                      markAsRead(n.id);
                                      setReplyNotification(n);
                                    }}
                                    className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
                                  >
                                    <MessageCircle className="h-3 w-3" strokeWidth={2.5} />
                                    Reply
                                  </motion.button>
                                )}
                                {isSmartGoalAdjustment && (
                                  <motion.button
                                    whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                                    onClick={() => openSmartGoalAdjustment(n)}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#F3F4FF] px-3 py-1.5 text-[11px] font-semibold text-[#7C83F6] transition hover:bg-[#EDEFFF]"
                                  >
                                    <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
                                    {t("view")}
                                  </motion.button>
                                )}
                                {isConsumptionConfirmation && (
                                  <motion.button
                                    whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                                    onClick={() => setConsumptionNotification(n)}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#E8FBF6] px-3 py-1.5 text-[11px] font-semibold text-[#0D9F7F] transition hover:bg-[#D9F8EF]"
                                  >
                                    <Utensils className="h-3 w-3" strokeWidth={2.5} />
                                    {t("confirm") === "confirm" ? "Confirm intake" : t("confirm")}
                                  </motion.button>
                                )}
                                {safeDeepLink && !isCoachMessage && !isSmartGoalAdjustment && !isConsumptionConfirmation && (
                                  <motion.button
                                    whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                                    onClick={() => openNotificationDeepLink(n, safeDeepLink)}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#E8FBF6] px-3 py-1.5 text-[11px] font-semibold text-[#0D9F7F] transition hover:bg-[#D9F8EF]"
                                  >
                                    <ArrowLeft className="h-3 w-3 rotate-180 rtl:rotate-0" strokeWidth={2.5} />
                                    {t("view")}
                                  </motion.button>
                                )}
                                {isUnread && !safeDeepLink && !isCoachMessage && !isSmartGoalAdjustment && !isConsumptionConfirmation && (
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
