import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseRealtimeTableOptions<T = Record<string, unknown>> {
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  schema?: "public";
  enabled?: boolean;
  onInsert?: (payload: { new: T }) => void;
  onUpdate?: (payload: { new: T; old: T }) => void;
  onDelete?: (payload: { old: T }) => void;
  onChange?: () => void;
}

interface PostgresChangePayload<T = Record<string, unknown>> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: T;
  schema: string;
  table: string;
}

export function useRealtimeTable<T = Record<string, unknown>>(
  table: string,
  options: UseRealtimeTableOptions<T> = {}
): { unsubscribe: () => void } {
  const {
    event = "*",
    filter,
    schema = "public",
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  } = options;

  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onChange });
  callbacksRef.current = { onInsert, onUpdate, onDelete, onChange };

  const channelName = useMemo(
    () =>
      `realtime:${table}:${filter ? filter.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50) : "all"}`,
    [table, filter]
  );

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel(channelName);

    channel
      .on(
        "postgres_changes",
        { event, schema, table, filter },
        (rawPayload) => {
          const payload = rawPayload as unknown as PostgresChangePayload<T>;
          const { onInsert: ins, onUpdate: upd, onDelete: del, onChange: chg } = callbacksRef.current;
          chg?.();

          if (payload.eventType === "INSERT" && ins) {
            ins({ new: payload.new });
          } else if (payload.eventType === "UPDATE" && upd) {
            upd({ new: payload.new, old: payload.old });
          } else if (payload.eventType === "DELETE" && del) {
            del({ old: payload.old });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, schema, enabled, channelName]);

  return { unsubscribe: () => {} };
}
