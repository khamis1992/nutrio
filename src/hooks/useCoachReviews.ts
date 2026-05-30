import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CoachReview {
  id: string;
  coach_id: string;
  client_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  client_name?: string;
  client_avatar?: string | null;
}

export interface CoachRatingSummary {
  average_rating: number;
  total_reviews: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

export function useCoachReviews(coachId: string | undefined) {
  const [reviews, setReviews] = useState<CoachReview[]>([]);
  const [summary, setSummary] = useState<CoachRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    if (!coachId) {
      setLoading(false);
      return;
    }
    try {
      const [{ data: reviewsData }, { data: summaryData }] = await Promise.all([
        supabase
          .from("coach_reviews")
          .select("id, coach_id, client_id, rating, review_text, created_at")
          .eq("coach_id", coachId)
          .order("created_at", { ascending: false }),
        supabase
          .from("coach_rating_summary")
          .select("*")
          .eq("coach_id", coachId)
          .maybeSingle(),
      ]);

      const reviewsArr = reviewsData || [];
      if (reviewsArr.length > 0) {
        const clientIds = [...new Set(reviewsArr.map((r) => r.client_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", clientIds);
        const profileMap = new Map((profiles || []).map((p: { user_id: string; full_name: string | null; avatar_url: string | null }) => [p.user_id, p]));
        setReviews(
          reviewsArr.map((r) => ({
            ...r,
            client_name: profileMap.get(r.client_id)?.full_name || "Client",
            client_avatar: profileMap.get(r.client_id)?.avatar_url || null,
          }))
        );
      } else {
        setReviews([]);
      }

      if (summaryData) {
        setSummary(summaryData as CoachRatingSummary);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  const submitReview = useCallback(
    async (clientId: string, rating: number, reviewText: string) => {
      if (!coachId || !clientId) return { success: false, error: new Error("Missing data") };
      setSubmitting(true);
      try {
        const { data, error } = await supabase
          .from("coach_reviews")
          .upsert(
            {
              coach_id: coachId,
              client_id: clientId,
              rating,
              review_text: reviewText || null,
            },
            { onConflict: "coach_id,client_id" }
          )
          .select()
          .single();

        if (error) throw error;
        await fetchReviews();
        return { success: true, error: null, data };
      } catch (err) {
        console.error("Error submitting review:", err);
        return { success: false, error: err as Error };
      } finally {
        setSubmitting(false);
      }
    },
    [coachId]
  );

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return { reviews, summary, loading, submitting, submitReview, refresh: fetchReviews };
}
