import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Returns the count of orders in preparing/ready_for_pickup that have no driver assigned. */
export function useUnassignedOrderCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["preparing", "ready_for_pickup"])
        .is("driver_id", null);
      setCount(c || 0);
    };

    fetchCount();

    const channel = supabase
      .channel("unassigned-orders-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchCount)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return count;
}
