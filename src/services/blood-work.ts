import { supabase } from "@/integrations/supabase/client";
import type { BloodMarkerDefinition, BloodWorkRecord, BloodMarker } from "@/lib/blood-markers";

// ─── Fetch marker definitions ──────────────────────────────────────────
export async function fetchMarkerDefinitions(): Promise<BloodMarkerDefinition[]> {
  const { data, error } = await supabase
    .from("blood_marker_definitions")
    .select("*")
    .order("category", { ascending: true });
  if (error) throw error;
  return data as BloodMarkerDefinition[];
}

// ─── Fetch all records for a user ──────────────────────────────────────
export async function fetchBloodWorkRecords(userId: string): Promise<BloodWorkRecord[]> {
  const { data, error } = await supabase
    .from("blood_work_records")
    .select("*")
    .eq("user_id", userId)
    .order("test_date", { ascending: false });
  if (error) throw error;
  return data as BloodWorkRecord[];
}

// ─── Fetch markers for a specific record ───────────────────────────────
export async function fetchMarkersForRecord(recordId: string): Promise<BloodMarker[]> {
  const { data, error } = await supabase
    .from("blood_markers")
    .select("*")
    .eq("record_id", recordId)
    .order("category", { ascending: true });
  if (error) throw error;
  return data as BloodMarker[];
}

// ─── Create a blood work record ────────────────────────────────────────
export async function createBloodWorkRecord(record: {
  user_id: string;
  lab_name?: string;
  test_date: string;
  fasting?: boolean;
  report_url?: string;
}): Promise<BloodWorkRecord> {
  const { data, error } = await supabase
    .from("blood_work_records")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data as BloodWorkRecord;
}

// ─── Insert markers in batch ───────────────────────────────────────────
export async function insertMarkers(
  markers: Omit<BloodMarker, "id" | "created_at">[]
): Promise<BloodMarker[]> {
  const { data, error } = await supabase
    .from("blood_markers")
    .insert(markers)
    .select();
  if (error) throw error;
  return data as BloodMarker[];
}

// ─── Update record status and AI analysis ──────────────────────────────
export async function updateRecordAnalysis(
  recordId: string,
  aiAnalysis: string,
  status: "analyzed" | "error" = "analyzed"
): Promise<void> {
  const { error } = await supabase
    .from("blood_work_records")
    .update({ ai_analysis: aiAnalysis, status })
    .eq("id", recordId);
  if (error) throw error;
}

// ─── Upload report PDF to Supabase Storage ─────────────────────────────
export async function uploadBloodReport(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${Date.now()}-blood-report.${ext}`;
  const { error } = await supabase.storage
    .from("blood-reports")
    .upload(path, file);
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("blood-reports")
    .getPublicUrl(path);
  return urlData.publicUrl;
}

// ─── Delete a blood work record and its markers ────────────────────────
export async function deleteBloodWorkRecord(recordId: string): Promise<void> {
  const { error } = await supabase
    .from("blood_work_records")
    .delete()
    .eq("id", recordId);
  if (error) throw error;
}

// ─── Get marker history across records (for trend charts) ──────────────
export async function fetchMarkerHistory(
  userId: string,
  markerName: string
): Promise<{ test_date: string; value: number }[]> {
  const { data, error } = await supabase
    .from("blood_markers")
    .select("value, blood_work_records!inner(test_date)")
    .eq("marker_name", markerName)
    .eq("blood_work_records.user_id", userId)
    .order("blood_work_records(test_date)", { ascending: true });
  if (error) throw error;
  return (data as any[]).map((d) => ({
    test_date: d.blood_work_records.test_date,
    value: Number(d.value),
  }));
}
