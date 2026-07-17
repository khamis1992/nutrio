import { useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";

export function useCoachReport() {
  const [generating, setGenerating] = useState(false);

  const generateReport = useCallback(
    async (clientId: string, coachId: string, startDate: string, endDate: string) => {
      setGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-coach-report", {
          body: { clientId, coachId, startDate, endDate },
        });

        if (error) throw new Error(error.message || "Edge function returned an error");

        const htmlString = typeof data === "string" ? data : JSON.stringify(data);
        const safeHtml = DOMPurify.sanitize(htmlString, {
          WHOLE_DOCUMENT: true,
          FORBID_TAGS: ["script", "iframe", "object", "embed"],
          FORBID_ATTR: ["onerror", "onload", "onclick"],
        });
        const blob = new Blob([safeHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `progress-report-${startDate}-to-${endDate}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true };
      } catch (err) {
        console.error("Error generating report:", err);
        return { success: false, error: err as Error };
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  return { generating, generateReport };
}
