import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CoachMessage {
  id: string;
  coach_id: string;
  client_id: string;
  sender_role: "coach" | "client";
  message: string;
  read: boolean;
  created_at: string;
}

export interface ClientChatPreview {
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export function useCoachMessages(coachId: string | undefined) {
  const [conversations, setConversations] = useState<ClientChatPreview[]>([]);
  const [activeMessages, setActiveMessages] = useState<CoachMessage[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!coachId) return;
    try {
      const { data: activeClients } = await supabase
        .from("coach_client_assignments")
        .select("client_id")
        .eq("coach_id", coachId)
        .eq("status", "active");

      if (!activeClients?.length) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const clientIds = activeClients.map((a) => a.client_id);

      const [{ data: profiles }, { data: lastMessages }, { data: unreadCounts }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", clientIds),
        supabase.from("coach_messages")
          .select("client_id, message, created_at")
          .eq("coach_id", coachId)
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
          .limit(clientIds.length * 5),
        supabase.from("coach_messages")
          .select("client_id, count")
          .eq("coach_id", coachId)
          .in("client_id", clientIds)
          .eq("read", false)
          .eq("sender_role", "client"),
      ]);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const lastMsgMap = new Map<string, { message: string; created_at: string }>();
      for (const m of lastMessages || []) {
        if (!lastMsgMap.has(m.client_id) || m.created_at > (lastMsgMap.get(m.client_id)?.created_at || "")) {
          lastMsgMap.set(m.client_id, { message: m.message, created_at: m.created_at });
        }
      }

      const unreadMap = new Map<string, number>();
      for (const u of unreadCounts || []) {
        unreadMap.set(u.client_id, Number(u.count) || 0);
      }

      const previews: ClientChatPreview[] = clientIds.map((cid) => {
        const profile = profileMap.get(cid);
        const last = lastMsgMap.get(cid);
        return {
          clientId: cid,
          clientName: profile?.full_name || "Client",
          clientAvatar: profile?.avatar_url || null,
          lastMessage: last?.message || "No messages yet",
          lastMessageTime: last?.created_at || "",
          unreadCount: unreadMap.get(cid) || 0,
        };
      });

      previews.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.localeCompare(a.lastMessageTime);
      });

      setConversations(previews);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  const fetchMessages = useCallback(async (clientId: string) => {
    if (!coachId) return;
    try {
      const { data } = await supabase
        .from("coach_messages")
        .select("*")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      setActiveMessages(data || []);
      setActiveClientId(clientId);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [coachId]);

  const sendMessage = async (clientId: string, message: string) => {
    if (!coachId || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("coach_messages").insert({
        coach_id: coachId,
        client_id: clientId,
        sender_role: "coach",
        message: message.trim(),
      });
      if (error) throw error;
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (clientId: string) => {
    if (!coachId) return;
    try {
      await supabase
        .from("coach_messages")
        .update({ read: true })
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .eq("read", false)
        .eq("sender_role", "client");
    } catch (err) {
      console.error("Error marking messages as read:", err);
    }
  };

  // Subscribe to realtime for new messages
  useEffect(() => {
    if (!coachId) return;

    const channel = supabase
      .channel("coach-messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coach_messages",
          filter: `coach_id=eq.${coachId}`,
        },
        (payload) => {
          const newMsg = payload.new as CoachMessage;
          setActiveMessages((prev) => {
            if (activeClientId === newMsg.client_id) {
              return [...prev, newMsg];
            }
            return prev;
          });
          fetchConversations(); // refresh unread counts
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coachId, activeClientId]);

  useEffect(() => {
    if (coachId) {
      fetchConversations();
    }
  }, [coachId, fetchConversations]);

  return {
    conversations,
    activeMessages,
    activeClientId,
    loading,
    sending,
    fetchMessages,
    sendMessage,
    markAsRead,
    refreshConversations: fetchConversations,
  };
}
