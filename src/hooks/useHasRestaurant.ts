import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useHasRestaurant(userId: string | undefined) {
  const [hasRestaurant, setHasRestaurant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setHasRestaurant(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const checkRestaurant = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: queryError } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setHasRestaurant(false);
        } else {
          setHasRestaurant(!!data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setHasRestaurant(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    checkRestaurant();
    return () => { cancelled = true; };
  }, [userId]);

  return { hasRestaurant, loading, error };
}
