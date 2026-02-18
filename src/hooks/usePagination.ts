import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;

interface PaginationState {
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalCount?: number;
}

interface UsePaginationReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  totalCount?: number;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Hook for offset-based pagination
 * Usage: const { data, loading, hasMore, loadMore } = usePagination('orders', { pageSize: 20, filters: { user_id: userId } })
 */
export function usePagination<T = any>(
  table: TableName,
  options: {
    pageSize?: number;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
    filters?: Partial<Record<string, any>>;
    select?: string;
  } = {}
): UsePaginationReturn<T> {
  const {
    pageSize = 20,
    orderBy = "created_at",
    orderDirection = "desc",
    filters = {},
    select = "*",
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    pageSize,
    hasMore: true,
  });

  const fetchData = useCallback(
    async (pageNum: number, append: boolean = false) => {
      setLoading(true);
      setError(null);

      try {
        const from = pageNum * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from(table)
          .select(select, { count: "exact" })
          .order(orderBy, { ascending: orderDirection === "asc" })
          .range(from, to);

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });

        const { data: result, error: queryError, count } = await query;

        if (queryError) {
          throw new Error(queryError.message);
        }

        const newData = result || [];
        
        setData((prev) => (append ? [...prev, ...newData] : newData));
        setPagination((prev) => ({
          ...prev,
          page: pageNum,
          hasMore: newData.length === pageSize,
          totalCount: count || undefined,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error(`Error fetching ${table}:`, err);
      } finally {
        setLoading(false);
      }
    },
    [table, pageSize, orderBy, orderDirection, select, filters]
  );

  const loadMore = useCallback(() => {
    if (!loading && pagination.hasMore) {
      fetchData(pagination.page + 1, true);
    }
  }, [loading, pagination.hasMore, pagination.page, fetchData]);

  const refresh = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 0, hasMore: true }));
    fetchData(0, false);
  }, [fetchData]);

  useEffect(() => {
    fetchData(0, false);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    hasMore: pagination.hasMore,
    page: pagination.page,
    totalCount: pagination.totalCount,
    loadMore,
    refresh,
  };
}

/**
 * Simple pagination for one-time queries
 */
export async function fetchPaginatedData<T = any>(
  table: TableName,
  page: number = 0,
  pageSize: number = 20,
  options: {
    select?: string;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
    filters?: Record<string, any>;
  } = {}
): Promise<{ data: T[]; hasMore: boolean; totalCount?: number; error?: string }> {
  const {
    select = "*",
    orderBy = "created_at",
    orderDirection = "desc",
    filters = {},
  } = options;

  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(table)
      .select(select, { count: "exact" })
      .order(orderBy, { ascending: orderDirection === "asc" })
      .range(from, to);

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: data || [],
      hasMore: (data?.length || 0) === pageSize,
      totalCount: count || undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error in fetchPaginatedData for ${table}:`, err);
    return {
      data: [],
      hasMore: false,
      error: message,
    };
  }
}
