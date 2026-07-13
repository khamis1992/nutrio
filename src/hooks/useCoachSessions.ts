import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CoachSessionStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface CoachSession {
  id: string;
  coach_id: string;
  client_id: string;
  title: string;
  description: string | null;
  session_type: string;
  scheduled_at: string;
  duration_minutes: number;
  status: CoachSessionStatus;
  meeting_link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type CoachSessionRow = Omit<CoachSession, "status"> & { status: string };

const SESSION_STATUSES: CoachSessionStatus[] = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

const normalizeSession = (session: CoachSessionRow): CoachSession => ({
  ...session,
  status: SESSION_STATUSES.includes(session.status as CoachSessionStatus)
    ? session.status as CoachSessionStatus
    : "scheduled",
});

export function useCoachSessions(coachId: string | undefined, clientId: string | undefined) {
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!coachId || !clientId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("coach_sessions")
        .select("*")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      setSessions((data ?? []).map(normalizeSession));
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId, clientId]);

  const createSession = useCallback(
    async (data: {
      title: string;
      description?: string | null;
      session_type?: string;
      scheduled_at: string;
      duration_minutes?: number;
      notes?: string | null;
    }) => {
      if (!coachId || !clientId) return { success: false, error: new Error("Missing data") };
      try {
        const { data: session, error } = await supabase
          .from("coach_sessions")
          .insert({
            coach_id: coachId,
            client_id: clientId,
            title: data.title,
            description: data.description || null,
            session_type: data.session_type || "video_call",
            scheduled_at: data.scheduled_at,
            duration_minutes: data.duration_minutes || 30,
            notes: data.notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        const normalizedSession = normalizeSession(session);
        setSessions((prev) => [normalizedSession, ...prev].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()));
        return { success: true, error: null, data: session };
      } catch (err) {
        console.error("Error creating session:", err);
        return { success: false, error: err as Error };
      }
    },
    [coachId, clientId]
  );

  const updateSession = useCallback(
    async (sessionId: string, updates: { status?: CoachSessionStatus; title?: string; description?: string | null; meeting_link?: string | null; notes?: string | null }) => {
      try {
        const { error } = await supabase
          .from("coach_sessions")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", sessionId);

        if (error) throw error;
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...updates, updated_at: new Date().toISOString() } : s)));
        return { success: true, error: null };
      } catch (err) {
        console.error("Error updating session:", err);
        return { success: false, error: err as Error };
      }
    },
    []
  );

  const cancelSession = useCallback(async (sessionId: string) => {
    return updateSession(sessionId, { status: "cancelled" });
  }, [updateSession]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, createSession, updateSession, cancelSession, refresh: fetchSessions };
}
