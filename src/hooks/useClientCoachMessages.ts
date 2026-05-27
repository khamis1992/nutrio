import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CoachMessage } from "./useCoachMessages";

export function useClientCoachMessages(clientId: string | undefined) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [coachInfo, setCoachInfo] = useState<{ coachId: string; coachName: string; coachAvatar: string | null } | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!clientId) return;
    try {
      // Find the active coach assignment
      const { data: assignment } = await supabase
        .from("coach_client_assignments")
        .select("coach_id")
        .eq("client_id", clientId)
        .eq("status", "active")
        .single();

      if (!assignment) {
        setLoading(false);
        return;
      }

      const coachId = assignment.coach_id;

      // Get coach profile
      const { data: coachProfile } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .eq("user_id", coachId)
        .single();

      setCoachInfo({
        coachId,
        coachName: coachProfile?.full_name || "Your Coach",
        coachAvatar: coachProfile?.avatar_url || null,
      });

      // Fetch messages
      const { data } = await supabase
        .from("coach_messages")
        .select("*")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    } catch (err) {
      console.error("Error fetching client messages:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const sendMessage = async (message: string) => {
    if (!clientId || !coachInfo || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("coach_messages").insert({
        coach_id: coachInfo.coachId,
        client_id: clientId,
        sender_role: "client",
        message: message.trim(),
      });
      if (error) throw error;
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async () => {
    if (!clientId || !coachInfo) return;
    try {
      await supabase
        .from("coach_messages")
        .update({ read: true })
        .eq("coach_id", coachInfo.coachId)
        .eq("client_id", clientId)
        .eq("read", false)
        .eq("sender_role", "coach");
    } catch (err) {
      console.error("Error marking messages as read:", err);
    }
  };

  // Subscribe to realtime for new messages from coach
  useEffect(() => {
    if (!clientId || !coachInfo) return;

    const channel = supabase
      .channel(`client-coach-messages-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coach_messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const newMsg = payload.new as CoachMessage;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, coachInfo]);

  useEffect(() => {
    if (clientId) {
      fetchMessages();
    }
  }, [clientId, fetchMessages]);

  return {
    messages,
    coachInfo,
    loading,
    sending,
    sendMessage,
    markAsRead,
    refresh: fetchMessages,
  };
}
