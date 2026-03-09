import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  Truck,
  CheckCircle2,
  Star,
  TrendingUp,
  Crown,
  Loader2,
  Trash2,
  Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
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

const TYPE_CONFIG: Record<Notification["type"], { icon: React.ElementType; bg: string; iconColor: string }> = {
  order_update:       { icon: Truck,        bg: "bg-teal-100 dark:bg-teal-900/40",   iconColor: "text-teal-600 dark:text-teal-400" },
  meal_reminder:      { icon: Bell,         bg: "bg-amber-100 dark:bg-amber-900/40", iconColor: "text-amber-500 dark:text-amber-400" },
  subscription_alert: { icon: Crown,        bg: "bg-orange-100 dark:bg-orange-900/40", iconColor: "text-orange-500 dark:text-orange-400" },
  general:            { icon: TrendingUp,   bg: "bg-blue-100 dark:bg-blue-900/40",   iconColor: "text-blue-500 dark:text-blue-400" },
  announcement:       { icon: Star,         bg: "bg-yellow-100 dark:bg-yellow-900/40", iconColor: "text-yellow-500 dark:text-yellow-400" },
};

const FILTERS = [
  { key: "all",    label: "All" },
  { key: "orders", label: "Orders" },
  { key: "meals",  label: "Meals" },
  { key: "offers", label: "Offers" },
] as const;

type FilterKey = typeof FILTERS[number]["key"];

const TYPE_TO_FILTER: Record<Notification["type"], FilterKey> = {
  order_update:       "orders",
  meal_reminder:      "meals",
  subscription_alert: "offers",
  general:            "offers",
  announcement:       "offers",
};

export default function Notifications() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 pb-28">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 bg-white dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("notifications")}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-semibold text-primary"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                activeFilter === f.key
                  ? "bg-primary text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <BellOff className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">No notifications</p>
            <p className="text-sm text-gray-400">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.general;
              const Icon = cfg.icon;
              const isUnread = n.status === "unread";

              return (
                <div
                  key={n.id}
                  className={`flex items-center gap-3 py-4 transition-colors ${
                    isUnread ? "bg-primary/5 -mx-5 px-5" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                      {n.title}
                      {isUnread && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary ml-1.5 mb-0.5 align-middle" />
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 block">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isUnread && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors"
                        aria-label="Mark as read"
                      >
                        <Check className="w-4 h-4 text-primary" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
