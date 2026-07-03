import { supabase } from "@/integrations/supabase/client";
import type { BloodMarkerDefinition, BloodWorkRecord, BloodMarker } from "@/lib/blood-markers";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export async function getLatestAbnormalMarkers(userId: string): Promise<BloodMarker[]> {
  const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS).toISOString().split("T")[0];

  const { data: records, error: recError } = await supabase
    .from("blood_work_records")
    .select("id, test_date")
    .eq("user_id", userId)
    .gte("test_date", sixMonthsAgo)
    .order("test_date", { ascending: false });

  if (recError) throw recError;
  if (!records || records.length === 0) return [];

  const latestRecordId = records[0].id;

  const { data: markers, error: markerError } = await supabase
    .from("blood_markers")
    .select("*")
    .eq("record_id", latestRecordId)
    .in("status", ["low", "high", "critical"])
    .order("category", { ascending: true });

  if (markerError) throw markerError;
  return (markers || []) as BloodMarker[];
}

export async function hasBloodWork(userId: string): Promise<boolean> {
  const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS).toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("blood_work_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("test_date", sixMonthsAgo);

  if (error) throw error;
  return (count || 0) > 0;
}

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
  if (file.type !== "application/pdf") {
    throw new Error("Only PDF blood reports can be uploaded.");
  }

  const path = `${userId}/${Date.now()}-blood-report.pdf`;
  const { error } = await supabase.storage
    .from("blood-reports")
    .upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
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
  type MarkerWithJoin = { value: number; blood_work_records: { test_date: string } };
  return (data as MarkerWithJoin[]).map((d) => ({
    test_date: d.blood_work_records.test_date,
    value: Number(d.value),
  }));
}
