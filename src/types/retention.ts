import type { Database, Json } from "@/integrations/supabase/types";

export type BodyMeasurementRow = Database["public"]["Tables"]["body_measurements"]["Row"];
export type HealthScoreRow = Database["public"]["Tables"]["user_health_scores"]["Row"];
export type SubscriptionFreezeRow = Database["public"]["Tables"]["subscription_freezes"]["Row"];
export type SubscriptionRolloverRow = Database["public"]["Tables"]["subscription_rollovers"]["Row"];
export type RetentionAuditLogRow = Database["public"]["Tables"]["retention_audit_logs"]["Row"];

export interface BodyMetrics {
  id: string;
  user_id: string;
  recorded_at: string;
  weight_kg: number;
  waist_cm?: number;
  body_fat_percent?: number;
  muscle_mass_percent?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BodyMetricsInput {
  weight_kg: number;
  waist_cm?: number;
  body_fat_percent?: number;
  muscle_mass_percent?: number;
  notes?: string;
  recorded_at?: string;
}

export type HealthScoreCategory = "green" | "orange" | "red";

export interface HealthScore {
  id: string;
  user_id: string;
  calculated_at: string;
  score_week_start: string;
  macro_adherence_score: number;
  meal_consistency_score: number;
  weight_logging_score: number;
  protein_accuracy_score: number;
  overall_score: number;
  category: HealthScoreCategory;
  metrics_used: Json;
}

export interface HealthScoreBreakdown {
  overall_score: number;
  category: HealthScoreCategory;
  macro_adherence: number;
  meal_consistency: number;
  weight_logging: number;
  protein_accuracy: number;
}

export type FreezeStatus = "scheduled" | "active" | "completed" | "cancelled";

export interface SubscriptionFreeze extends Omit<SubscriptionFreezeRow, "status"> {
  status: FreezeStatus;
}

export interface FreezeRequest {
  subscription_id: string;
  freeze_start_date: string;
  freeze_end_date: string;
}

export interface FreezeRequestResult {
  success: boolean;
  freeze_id?: string;
  freeze_days?: number;
  freeze_start?: string;
  freeze_end?: string;
  days_remaining_this_cycle?: number;
  error?: string;
}

export interface RolloverInfo {
  rollover_credits: number;
  expiry_date: string | null;
  total_credits: number;
  new_credits: number;
}

export type RolloverRecord = SubscriptionRolloverRow;

export interface RolloverStats {
  totalRollovers: number;
  consumedRollovers: number;
  expiredRollovers: number;
  utilizationRate: number;
  totalCreditsRolled: number;
  totalCreditsConsumed: number;
}

export interface RetentionAuditFilters {
  userId?: string;
  subscriptionId?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export type RetentionAuditLog = RetentionAuditLogRow;

export interface RetentionAnalyticsSummary {
  totalRollovers: number;
  totalRolloverCredits: number;
  activeFreezes: number;
  completedFreezes: number;
  averageHealthScore: number;
  usersWithMetrics: number;
}

export interface HealthScoreDistributionBucket {
  name: string;
  value: number;
}
