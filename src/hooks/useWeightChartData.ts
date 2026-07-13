import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WeightChartPoint {
  date: string;
  label: string;
  actual: number | null;
  predicted: number | null;
  lower: number | null;
  upper: number | null;
}

export function useWeightChartData(userId: string | undefined) {
  const [weightChartData, setWeightChartData] = useState<WeightChartPoint[]>([]);

  useEffect(() => {
    if (!userId) return;

    const buildChart = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const sinceStr = since.toISOString().split("T")[0];

      const [{ data: bodyLogs }, { data: progressLogs }] = await Promise.all([
        supabase
          .from("body_measurements")
          .select("log_date, weight_kg")
          .eq("user_id", userId)
          .not("weight_kg", "is", null)
          .gte("log_date", sinceStr)
          .order("log_date", { ascending: true }),
        supabase
          .from("progress_logs")
          .select("log_date, weight_kg")
          .eq("user_id", userId)
          .not("weight_kg", "is", null)
          .gte("log_date", sinceStr)
          .order("log_date", { ascending: true }),
      ]);

      const byDate = new Map<string, number>();
      for (const row of (progressLogs || [])) {
        if (row.weight_kg != null && row.weight_kg > 0) byDate.set(row.log_date, Number(row.weight_kg));
      }
      for (const row of (bodyLogs || [])) {
        if (row.weight_kg != null && row.weight_kg > 0) byDate.set(row.log_date, Number(row.weight_kg));
      }

      const sortedLogs = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b));

      if (sortedLogs.length === 0) return;

      const ys = sortedLogs.map(([, w]) => w);
      const n = ys.length;
      const xs = ys.map((_, i) => i);
      const xMean = xs.reduce((a, b) => a + b, 0) / n;
      const yMean = ys.reduce((a, b) => a + b, 0) / n;
      const xSS = xs.reduce((a, x) => a + (x - xMean) ** 2, 0);
      const slope = xSS === 0 ? 0 :
        xs.reduce((acc, x, i) => acc + (x - xMean) * (ys[i] - yMean), 0) / xSS;
      const residuals = ys.map((y, i) => Math.abs(y - (yMean + slope * (i - xMean))));
      const stdErr = Math.max(0.2, Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / n));
      const lastWeight = ys[n - 1];

      const history = sortedLogs.map(([date, w]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        actual: w,
        predicted: null,
        lower: null,
        upper: null,
      }));

      const future = [7, 14, 21, 28].map((days) => {
        const pw = Math.round((lastWeight + slope * days) * 10) / 10;
        const d = new Date();
        d.setDate(d.getDate() + days);
        return {
          date: d.toISOString().split("T")[0],
          label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          actual: null,
          predicted: pw,
          lower: Math.round((pw - stdErr * 1.5) * 10) / 10,
          upper: Math.round((pw + stdErr * 1.5) * 10) / 10,
        };
      });

      setWeightChartData([...history, ...future]);
    };

    buildChart();
  }, [userId]);

  const predictions = weightChartData
    .filter(d => d.predicted !== null)
    .map(d => ({
      date: d.date,
      predicted_weight: d.predicted!,
      confidence_lower: d.lower!,
      confidence_upper: d.upper!,
    }));

  return { weightChartData, predictions };
}
