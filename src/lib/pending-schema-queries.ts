import { supabase } from "@/integrations/supabase/client";

type QueryError = { message: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };

type NutritionSnapshotRow = { nutrition_score: number };

interface NutritionSnapshotQuery {
  eq(column: "user_id", value: string): NutritionSnapshotQuery;
  order(column: "snapshot_date", options: { ascending: boolean }): NutritionSnapshotQuery;
  limit(count: number): NutritionSnapshotQuery;
  maybeSingle(): PromiseLike<QueryResult<NutritionSnapshotRow>>;
}

type NutritionSnapshotTable = {
  select(columns: "nutrition_score"): NutritionSnapshotQuery;
};

export async function fetchLatestNutritionScore(userId: string): Promise<number> {
  const table = (supabase as unknown as {
    from(table: "daily_performance_snapshots"): NutritionSnapshotTable;
  }).from("daily_performance_snapshots");

  const { data, error } = await table
    .select("nutrition_score")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.nutrition_score ?? 0;
}

export type ActivityLeaderboardRow = {
  user_id: string;
  calories_burned: number | null;
  user: { full_name: string | null } | null;
};

interface ActivityLeaderboardQuery extends PromiseLike<QueryResult<ActivityLeaderboardRow[]>> {
  gte(column: "performed_at", value: string): ActivityLeaderboardQuery;
  limit(count: number): ActivityLeaderboardQuery;
}

type ActivityLogsTable = {
  select(columns: string): ActivityLeaderboardQuery;
};

export async function fetchActivityLeaderboardRows(since: string): Promise<ActivityLeaderboardRow[]> {
  const table = (supabase as unknown as {
    from(table: "activity_logs"): ActivityLogsTable;
  }).from("activity_logs");

  const { data, error } = await table
    .select("user_id, calories_burned, user:profiles!inner(full_name)")
    .gte("performed_at", since)
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}
