import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string | null;
  read_at: string | null;
  data: Record<string, unknown> | null;
  created_at: string | null;
}

const PartnerNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channel = supabase
      .channel("partner-notifications-page")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) =>
          setNotifications((prev) => [payload.new as Notification, ...prev]),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setNotifications(data || []);
    setLoading(false);
  };

  const isUnread = (notification: Notification) =>
    notification.status !== "read";

  const markAsRead = async (id: string) => {
    const readAt = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ status: "read", read_at: readAt })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, status: "read", read_at: readAt } : n,
      ),
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const readAt = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ status: "read", read_at: readAt })
      .eq("user_id", user.id);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: "read", read_at: readAt })),
    );
    toast({ title: "All notifications marked as read" });
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = async () => {
    if (!user) return;

    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifications([]);
    toast({ title: "All notifications cleared" });
  };

  const unreadCount = notifications.filter(isUnread).length;
  const orderAlertCount = notifications.filter((n) =>
    n.type.includes("order"),
  ).length;

  const recentLabel = useMemo(() => {
    const latest = notifications[0]?.created_at;
    if (!latest) return "No recent activity";
    return new Date(latest).toLocaleString();
  }, [notifications]);

  const getIcon = (type: string) => {
    if (type === "new_order") {
      return <ShoppingBag className="h-5 w-5 text-[#22C7A1]" />;
    }
    if (type === "order_update") {
      return <Info className="h-5 w-5 text-[#38BDF8]" />;
    }
    return <Bell className="h-5 w-5 text-[#7C83F6]" />;
  };

  const getTypeLabel = (type: string) => {
    if (type === "new_order") return "New order";
    if (type === "order_update") return "Order update";
    return "Notification";
  };

  if (loading) {
    return (
      <PartnerLayout title="Notifications" subtitle="Order alerts and updates">
        <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 sm:p-6">
          <div className="mx-auto max-w-5xl space-y-4">
            <Skeleton className="h-48 rounded-[30px] bg-white" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-24 rounded-[22px] bg-white" />
              <Skeleton className="h-24 rounded-[22px] bg-white" />
              <Skeleton className="h-24 rounded-[22px] bg-white" />
            </div>
            <Skeleton className="h-72 rounded-[28px] bg-white" />
          </div>
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Notifications" subtitle="Order alerts and updates">
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#7C83F6]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      <Bell className="h-3.5 w-3.5" />
                      Notification center
                    </div>
                    <h1 className="mt-3 text-2xl font-black tracking-tight text-[#020617] sm:text-3xl">
                      Partner alerts
                    </h1>
                    <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#64748B]">
                      Track new orders, delivery updates, and platform messages
                      in one operational inbox.
                    </p>
                  </div>
                  <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#020617] text-white sm:flex">
                    <Bell className="h-6 w-6" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Total
                    </p>
                    <p className="mt-1 text-xl font-black text-[#020617]">
                      {notifications.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#F97316]/20 bg-[#F97316]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F97316]">
                      Unread
                    </p>
                    <p className="mt-1 text-xl font-black text-[#020617]">
                      {unreadCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0B9B7E]">
                      Orders
                    </p>
                    <p className="mt-1 text-xl font-black text-[#020617]">
                      {orderAlertCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#020617] p-5 text-white sm:p-6">
                <div className="flex h-full flex-col justify-between gap-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                      Latest activity
                    </p>
                    <p className="mt-3 text-xl font-black leading-8">
                      {recentLabel}
                    </p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-white/65">
                      Keep unread order alerts at zero to avoid missing partner
                      operations that need quick action.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="min-h-11 rounded-2xl bg-white font-black text-[#020617] hover:bg-white/90"
                      disabled={unreadCount === 0}
                      onClick={markAllAsRead}
                    >
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Read all
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11 rounded-2xl border-white/15 bg-white/10 font-black text-white hover:bg-white/15"
                      disabled={notifications.length === 0}
                      onClick={clearAll}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                  Inbox
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                  Recent notifications
                </h2>
              </div>
              {unreadCount > 0 && (
                <Badge className="rounded-full bg-[#F97316]/10 font-black text-[#F97316] hover:bg-[#F97316]/10">
                  {unreadCount} unread
                </Badge>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-10 text-center">
                <Bell className="mx-auto mb-3 h-10 w-10 text-[#94A3B8]" />
                <p className="text-sm font-black text-[#020617]">
                  No notifications yet
                </p>
                <p className="mt-1 text-xs font-medium text-[#94A3B8]">
                  New orders and partner updates will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const unread = isUnread(notification);
                  return (
                    <article
                      key={notification.id}
                      className={`rounded-[24px] border p-4 transition ${
                        unread
                          ? "border-[#22C7A1]/30 bg-[#22C7A1]/10"
                          : "border-[#E5EAF1] bg-[#F6F8FB]"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E5EAF1] bg-white">
                          {getIcon(notification.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-black text-[#020617]">
                                  {notification.title}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-[#E5EAF1] bg-white text-[10px] font-black uppercase tracking-[0.1em] text-[#94A3B8]"
                                >
                                  {getTypeLabel(notification.type)}
                                </Badge>
                                {unread && (
                                  <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                                )}
                              </div>
                              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                                {notification.message}
                              </p>
                              <p className="mt-3 text-xs font-bold text-[#94A3B8]">
                                {notification.created_at
                                  ? new Date(
                                      notification.created_at,
                                    ).toLocaleString()
                                  : ""}
                              </p>
                            </div>

                            <div className="flex shrink-0 gap-2">
                              {unread && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10 rounded-2xl border-[#E5EAF1] bg-white text-[#020617] hover:bg-[#F6F8FB]"
                                  onClick={() => markAsRead(notification.id)}
                                  aria-label="Mark notification as read"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-2xl border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#FB6B7A] hover:bg-[#FB6B7A]/15"
                                onClick={() =>
                                  deleteNotification(notification.id)
                                }
                                aria-label="Delete notification"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </PartnerLayout>
  );
};

export default PartnerNotifications;
