import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CoachNote {
  id: string;
  coach_id: string;
  client_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export function useCoachNotes(coachId: string | undefined, clientId: string | undefined) {
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!coachId || !clientId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("coach_notes")
        .select("*")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error("Error fetching coach notes:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId, clientId]);

  const addNote = useCallback(
    async (note: string) => {
      if (!coachId || !clientId || !note.trim()) return;
      try {
        const { data, error } = await supabase
          .from("coach_notes")
          .insert({
            coach_id: coachId,
            client_id: clientId,
            note: note.trim(),
          })
          .select()
          .single();

        if (error) throw error;
        setNotes((prev) => [data, ...prev]);
        return data;
      } catch (err) {
        console.error("Error adding note:", err);
        throw err;
      }
    },
    [coachId, clientId]
  );

  const updateNote = useCallback(async (noteId: string, note: string) => {
    if (!note.trim()) return;
    try {
      const { error } = await supabase
        .from("coach_notes")
        .update({ note: note.trim(), updated_at: new Date().toISOString() })
        .eq("id", noteId)
        .eq("coach_id", coachId);

      if (error) throw error;
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, note: note.trim(), updated_at: new Date().toISOString() } : n
        )
      );
    } catch (err) {
      console.error("Error updating note:", err);
      throw err;
    }
  }, [coachId]);

  const deleteNote = useCallback(async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("coach_notes")
        .delete()
        .eq("id", noteId)
        .eq("coach_id", coachId);

      if (error) throw error;
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("Error deleting note:", err);
      throw err;
    }
  }, [coachId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return { notes, loading, addNote, updateNote, deleteNote, refresh: fetchNotes };
}
