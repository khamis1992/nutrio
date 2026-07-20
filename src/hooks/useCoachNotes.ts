import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  addCareNote,
  amendCareNote,
  archiveCareNote,
  findActiveCareAssignment,
} from "@/hooks/useCareTeam";

export interface CoachNote {
  id: string;
  coach_id: string;
  client_id: string;
  note: string;
  created_at: string;
  updated_at: string;
  assignment_id?: string | null;
  note_type?: string;
  status?: string;
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
        const assignment = await findActiveCareAssignment(coachId, clientId);
        if (!assignment) throw new Error("No active care assignment found for this client.");
        const data = await addCareNote(assignment.id, "progress", note.trim()) as unknown as CoachNote;
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
    if (!coachId || !note.trim()) return;
    try {
      await amendCareNote(noteId, note.trim());
      await fetchNotes();
    } catch (err) {
      console.error("Error updating note:", err);
      throw err;
    }
  }, [coachId, fetchNotes]);

  const deleteNote = useCallback(async (noteId: string) => {
    if (!coachId) return;
    try {
      await archiveCareNote(noteId);
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
