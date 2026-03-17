import { useState, useEffect } from "react";

/** Returns current timestamp, updated every 60 seconds so order-age colours stay accurate. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return now;
}

/** Maps elapsed minutes to a Tailwind border + animation class for urgency colour escalation. */
export function getUrgencyClass(elapsedMinutes: number): string {
  if (elapsedMinutes >= 20) return "border-red-500 animate-pulse";
  if (elapsedMinutes >= 10) return "border-amber-400";
  return "";
}

/** Returns a short human-readable age label, e.g. "4 min" or "23 min". */
export function formatElapsed(elapsedMinutes: number): string {
  return `${elapsedMinutes} min`;
}
