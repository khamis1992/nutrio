import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, CheckCheck, Trash2, ShoppingBag, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";

interface Notification { id: string; type: string; title: string; message: string; is_read: boolean; metadata: Record<string, unknown>; created_at: string; }

const PartnerNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => { if (user) { fetchNotifications(); subscribeToNotifications(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  };

  const subscribeToNotifications = () => {
    if (!user) return;
    const channel = supabase.channel("partner-notifications-page").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => setNotifications((prev) => [payload.new as Notification, ...prev])).subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const markAsRead = async (id: string) => { await supabase.from("notifications").update({ is_read: true }).eq("id", id); setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))); };
  const markAllAsRead = async () => { if (!user) return; await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false); setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true }))); toast({ title: "All notifications marked as read" }); };
  const deleteNotification = async (id: string) => { await supabase.from("notifications").delete().eq("id", id); setNotifications((prev) => prev.filter((n) => n.id !== id)); };
  const clearAll = async () => { if (!user) return; await supabase.from("notifications").delete().eq("user_id", user.id); setNotifications([]); toast({ title: "All notifications cleared" }); };

  const getIcon = (type: string) => { switch (type) { case "new_order": return <ShoppingBag className="h-5 w-5 text-primary" />; case "order_update": return <Info className="h-5 w-5 text-blue-500" />; default: return <Bell className="h-5 w-5 text-muted-foreground" />; } };
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <PartnerLayout title="Notifications"><Skeleton className="h-64 w-full" /></PartnerLayout>;

  return (
    <PartnerLayout title="Notifications" subtitle="Order alerts and updates">
      <div className="space-y-4">
        {notifications.length > 0 && <div className="flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={markAllAsRead}><CheckCheck className="h-4 w-4 mr-1" />Read All</Button><Button variant="outline" size="sm" onClick={clearAll}><Trash2 className="h-4 w-4 mr-1" />Clear</Button></div>}
        {notifications.length === 0 ? <Card><CardContent className="py-12 text-center"><Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" /><p className="text-muted-foreground">No notifications yet</p></CardContent></Card> : notifications.map((notification) => (
          <Card key={notification.id} className={`transition-colors ${!notification.is_read ? "bg-primary/5 border-primary/20" : ""}`}>
            <CardContent className="p-4"><div className="flex gap-4"><div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">{getIcon(notification.type)}</div><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{notification.title}</p><p className="text-sm text-muted-foreground mt-1">{notification.message}</p><p className="text-xs text-muted-foreground mt-2">{new Date(notification.created_at).toLocaleString()}</p></div><div className="flex gap-1 shrink-0">{!notification.is_read && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markAsRead(notification.id)}><Check className="h-4 w-4" /></Button>}<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteNotification(notification.id)}><Trash2 className="h-4 w-4" /></Button></div></div></div></div></CardContent>
          </Card>
        ))}
      </div>
    </PartnerLayout>
  );
};

export default PartnerNotifications;
